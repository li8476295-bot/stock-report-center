/*!
 * dsh-plugin-wallpaper-engine
 * ==========================
 * 动态壁纸引擎（纯原生 JS + Canvas 2D，零依赖）。
 *
 * 三来源：
 *   source:'canvas'  内置动态主题（aurora星空极光/ocean深海/particles粒子/matrix数字雨/kline股票）
 *   source:'image'   导入图片壁纸（单图或 images:[...] 轮播，淡入淡出）
 *   source:'video'   导入视频壁纸（静音循环）
 *   source:'auto'    有壁纸配置用配置，否则内置主题
 *
 * 导入壁纸（像 Wallpaper Engine 一样）：
 *   1) 编程：we.setImage('https://.../a.jpg') / we.setImages([...]) / we.setVideo('https://.../v.mp4')
 *   2) 清单：同目录放 wallpapers/config.json（{"source":"image","images":["a.jpg","b.png"],"dim":0.5}
 *     或 {"source":"video","video":"v.mp4"}），页面加载时自动 fetch 应用
 *
 * 用法：
 *   const we = new WallpaperEngine(container, { theme:'aurora', density:1, speed:1, dim:0.55, accent:'#4fc3f7', source:'auto' });
 *   we.setTheme('ocean'); we.setImage(url); we.setImages([...]); we.setVideo(url); we.setDim(0.5); we.destroy();
 */

(function (global) {
  'use strict';

  function WallpaperEngine(container, opts) {
    if (!container) throw new Error('wallpaper-engine: container required');
    opts = opts || {};

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0;';
    container.style.position = container.style.position || 'relative';
    container.insertBefore(canvas, container.firstChild);
    const ctx = canvas.getContext('2d');

    let theme = opts.theme || 'aurora';
    let source = opts.source || 'canvas';       // canvas | image | video | auto
    let images = Array.isArray(opts.images) ? opts.images : (opts.url ? [opts.url] : []);
    let videoUrl = opts.video || '';
    let density = clamp(opts.density || 1, 0.3, 2);
    let speed = clamp(opts.speed || 1, 0.2, 3);
    let dim = clamp(opts.dim || 0.55, 0, 1);
    let accent = opts.accent || '#4fc3f7';
    let W = 0, H = 0, raf = 0, t = 0, running = true;

    const imgs = [];            // 已加载的图片
    let imgIdx = 0, cross = 1;  // 轮播索引与淡入淡出进度
    let videoEl = null;

    const stars = [], waves = [], parts = [], drops = [], bars = [];

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    // ── 图片/视频加载 ──
    function loadImage(url) {
      return new Promise((res) => {
        const im = new Image();
        im.onload = () => { imgs.push(im); res(); };
        im.onerror = () => res();
        im.src = url;
      });
    }

    function loadVideo(url) {
      return new Promise((res) => {
        const v = document.createElement('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
        v.src = url;
        v.addEventListener('loadeddata', () => { videoEl = v; v.play().catch(() => {}); res(); }, { once: true });
        v.addEventListener('error', () => res(), { once: true });
      });
    }

    async function applySource() {
      if (source === 'auto') {
        // 尝试读壁纸清单（与页面同目录）
        try {
          const r = await fetch('./wallpapers/config.json', { cache: 'no-store' });
          if (r.ok) {
            const cfg = await r.json();
            if (cfg.source === 'image' && Array.isArray(cfg.images)) { images = cfg.images; source = 'image'; }
            else if (cfg.source === 'video' && cfg.video) { videoUrl = cfg.video; source = 'video'; }
            else { source = 'canvas'; }
            if (cfg.theme) theme = cfg.theme;
            if (cfg.dim !== undefined) dim = clamp(cfg.dim, 0, 1);
            if (cfg.density !== undefined) density = clamp(cfg.density, 0.3, 2);
            if (cfg.speed !== undefined) speed = clamp(cfg.speed, 0.2, 3);
            if (cfg.accent) accent = cfg.accent;
          }
        } catch (e) { /* 无清单则用默认 */ }
        if (source === 'auto') source = 'canvas';
      }
      imgs.length = 0;
      if (source === 'image' && images.length) {
        for (const u of images) await loadImage(u);
        if (!imgs.length) source = 'canvas';
      } else if (source === 'video' && videoUrl) {
        await loadVideo(videoUrl);
        if (!videoEl) source = 'canvas';
      }
      resize();
    }

    function coverRect(iw, ih) {
      const s = Math.max(W / iw, H / ih);
      const dw = iw * s, dh = ih * s;
      return { dw, dh, dx: (W - dw) / 2, dy: (H - dh) / 2 };
    }

    // ── 内置主题绘制（沿用 v1）──
    function hexRgb(hex, a) {
      const n = parseInt(hex.replace('#', ''), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    function seed() {
      stars.length = 0; waves.length = 0; parts.length = 0; drops.length = 0; bars.length = 0;
      const n = Math.floor(W * H / 9000 * density);
      for (let i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.3, p: Math.random() * Math.PI * 2, s: Math.random() * 0.6 + 0.2 });
      const nw = Math.floor(4 * density);
      for (let i = 0; i < nw; i++) waves.push({ ph: Math.random() * Math.PI * 2, amp: H * (0.02 + Math.random() * 0.04), f: 0.004 + Math.random() * 0.006, y: H * (0.35 + i * 0.12), hue: 180 + Math.random() * 60, a: 0.10 + Math.random() * 0.14 });
      const np = Math.floor(W * H / 16000 * density);
      for (let i = 0; i < np; i++) parts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.8, r: 1 + Math.random() * 2.2, a: 0.3 + Math.random() * 0.5 });
      const nd = Math.floor(40 * density);
      for (let i = 0; i < nd; i++) drops.push({ x: Math.random() * W, y: Math.random() * H, len: 12 + Math.random() * 20, v: 3 + Math.random() * 5, a: 0.12 + Math.random() * 0.2 });
      const nb = Math.floor(30 * density);
      for (let i = 0; i < nb; i++) bars.push({ x: Math.random() * W, y: Math.random() * H * 0.8, w: 1 + Math.random() * 2.4, h: 4 + Math.random() * 22, v: 0.5 + Math.random() * 2, a: 0.35 + Math.random() * 0.4 });
    }

    function drawAurora() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#050916'); g.addColorStop(0.55, '#0b1e38'); g.addColorStop(1, '#071126');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const s of stars) {
        s.p += 0.008 * speed; s.y += 0.05 * speed;
        if (s.y > H) s.y = 0;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(s.p));
        ctx.fillStyle = '#dff4ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      for (const w of waves) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 8) {
          const y = w.y + Math.sin(x * w.f + t * 0.4 * speed + w.ph) * w.amp + Math.sin(x * w.f * 2.3 - t * 0.25 * speed + w.ph) * w.amp * 0.5;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = 'hsla(' + w.hue + ',80%,55%,' + w.a + ')';
        ctx.fill();
      }
    }

    function drawOcean() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#03111f'); g.addColorStop(0.7, '#04273f'); g.addColorStop(1, '#02101c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const w of waves) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = w.y + Math.sin(x * w.f + t * 0.5 * speed + w.ph) * w.amp + Math.sin(x * w.f * 1.7 + t * 0.3 * speed) * w.amp * 0.4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = 'hsla(' + (w.hue + Math.sin(t * 0.02) * 20) + ',70%,' + (30 + w.a * 40) + '%,' + Math.min(0.9, w.a + 0.25) + ')';
        ctx.fill();
      }
    }

    function drawParticles() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a0f1e'); g.addColorStop(1, '#141b30');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const p of parts) {
        p.x += p.vx * speed; p.y += p.vy * speed;
        if (p.y < -10) { p.y = H + 10; p.x = Math.random() * W; }
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        ctx.globalAlpha = p.a;
        ctx.fillStyle = hexRgb(accent, 1);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawMatrix() {
      ctx.fillStyle = '#04070c'; ctx.fillRect(0, 0, W, H);
      const chars = '01アイウエオカキクケコサシスセソ0123456789$#@%';
      const fs = 14, cols = Math.floor(W / fs);
      if (drawMatrix.cols !== cols) { drawMatrix.cols = cols; drawMatrix.ys = new Array(cols).fill(0).map(() => Math.random() * H); }
      ctx.font = fs + 'px monospace';
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() < 0.02 ? '#e8fff0' : hexRgb(accent, 0.85);
        ctx.fillText(ch, i * fs, drawMatrix.ys[i]);
        drawMatrix.ys[i] += (fs * 0.6) * speed;
        if (drawMatrix.ys[i] > H && Math.random() < 0.02) drawMatrix.ys[i] = 0;
      }
      ctx.fillStyle = 'rgba(4,7,12,.12)'; ctx.fillRect(0, 0, W, H);
    }

    function drawKline() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a1018'); g.addColorStop(1, '#0d1520');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(90,110,140,.14)'; ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) { ctx.beginPath(); ctx.moveTo(0, H * i / 6); ctx.lineTo(W, H * i / 6); ctx.stroke(); }
      for (const b of bars) {
        b.y += b.v * speed;
        if (b.y > H) { b.y = -30; b.x = Math.random() * W; }
        ctx.fillStyle = (b.v > 1 ? 'rgba(255,91,91,' : 'rgba(46,204,113,') + b.a + ')';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.strokeStyle = hexRgb(accent, 0.5); ctx.lineWidth = 2;
      ctx.beginPath();
      const base = H * 0.55;
      for (let x = 0; x <= W; x += 4) {
        const y = base + Math.sin(x * 0.008 + t * 0.5 * speed) * 26 + Math.sin(x * 0.003 - t * 0.3 * speed) * 42;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function drawTheme() {
      if (theme === 'ocean') drawOcean();
      else if (theme === 'particles') drawParticles();
      else if (theme === 'matrix') drawMatrix();
      else if (theme === 'kline') drawKline();
      else drawAurora();
    }

    function resize() {
      const r = container.getBoundingClientRect();
      W = canvas.width = Math.max(64, Math.floor(r.width * (global.devicePixelRatio || 1)));
      H = canvas.height = Math.max(64, Math.floor(r.height * (global.devicePixelRatio || 1)));
      seed();
    }

    function draw() {
      if (!running) return;
      t += 1;
      ctx.clearRect(0, 0, W, H);
      if (source === 'image' && imgs.length) {
        // 图片壁纸：cover + 轮播淡入淡出
        const im = imgs[imgIdx];
        const cr = coverRect(im.naturalWidth || im.width, im.naturalHeight || im.height);
        ctx.globalAlpha = 1;
        ctx.drawImage(im, cr.dx, cr.dy, cr.dw, cr.dh);
        if (images.length > 1) {
          cross += 0.012 * speed;
          if (cross >= 1) { cross = 1; }
          const nxt = imgs[(imgIdx + 1) % imgs.length];
          if (cross < 1) {
            const c2 = coverRect(nxt.naturalWidth || nxt.width, nxt.naturalHeight || nxt.height);
            ctx.globalAlpha = cross;
            ctx.drawImage(nxt, c2.dx, c2.dy, c2.dw, c2.dh);
          } else {
            imgIdx = (imgIdx + 1) % imgs.length;
            cross = 0;
          }
        }
        ctx.globalAlpha = 1;
      } else if (source === 'video' && videoEl) {
        const vw = videoEl.videoWidth || 16, vh = videoEl.videoHeight || 9;
        const cr = coverRect(vw, vh);
        ctx.drawImage(videoEl, cr.dx, cr.dy, cr.dw, cr.dh);
      } else {
        drawTheme();
      }
      if (dim > 0) {
        ctx.fillStyle = 'rgba(8,10,18,' + dim * 0.85 + ')';
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(draw);
    }

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); if (videoEl) videoEl.pause(); }
      else if (!running) { running = true; if (videoEl) videoEl.play().catch(() => {}); draw(); }
    };
    document.addEventListener('visibilitychange', onVis);
    const onResize = () => resize();
    if (opts.autosize !== false) window.addEventListener('resize', onResize);

    applySource().then(() => { draw(); });

    return {
      setTheme(th) { theme = th; if (source !== 'canvas') { source = 'canvas'; } resize(); },
      async setImage(url) { source = 'image'; images = [url]; imgs.length = 0; await loadImage(url); if (!imgs.length) source = 'canvas'; },
      async setImages(list) { source = 'image'; images = list; imgs.length = 0; for (const u of list) await loadImage(u); if (!imgs.length) source = 'canvas'; },
      async setVideo(url) { source = 'video'; videoUrl = url; if (videoEl) { videoEl.pause(); videoEl = null; } await loadVideo(url); if (!videoEl) source = 'canvas'; },
      setDensity(d) { density = clamp(d, 0.3, 2); resize(); },
      setSpeed(s) { speed = clamp(s, 0.2, 3); },
      setDim(d) { dim = clamp(d, 0, 1); },
      setAccent(c) { accent = c; },
      get source() { return source; },
      get canvas() { return canvas; },
      destroy() {
        running = false;
        cancelAnimationFrame(raf);
        if (videoEl) videoEl.pause();
        document.removeEventListener('visibilitychange', onVis);
        if (opts.autosize !== false) window.removeEventListener('resize', onResize);
        canvas.remove();
      },
    };
  }

  global.WallpaperEngine = WallpaperEngine;
})(window);
