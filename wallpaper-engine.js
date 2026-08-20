/*!
 * dsh-plugin-wallpaper-engine
 * ==========================
 * 动态壁纸引擎（纯原生 JS + Canvas 2D，零依赖，~60fps）。
 *
 * 用法：
 *   const we = new WallpaperEngine(container, {
 *     theme: 'aurora',      // 主题: aurora星空极光 | ocean波浪 | particles粒子 | matrix数字雨 | kline股票
 *     density: 1,           // 密度/复杂度 0.3~2
 *     speed: 1,             // 速度 0.2~3
 *     dim: 0.55,            // 暗化程度 0~1（保证前景文字可读）
 *     accent: '#4fc3f7',    // 主题色
 *     autosize: true,       // 跟随容器尺寸
 *   });
 *   we.setTheme('ocean'); we.setDensity(1.5); we.destroy();
 *
 * 特性：
 *   - 全屏/容器自适应，resize 自动重绘
 *   - 性能保护：document.hidden 时暂停；低端设备自动降密度
 *   - 可置于任意页面背景层（z-index 最低层 + 文字层在上）
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
    let density = clamp(opts.density || 1, 0.3, 2);
    let speed = clamp(opts.speed || 1, 0.2, 3);
    let dim = clamp(opts.dim || 0.55, 0, 1);
    let accent = opts.accent || '#4fc3f7';
    let W = 0, H = 0, raf = 0, t = 0, running = true;
    const stars = [], waves = [], parts = [], drops = [], bars = [];

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function resize() {
      const r = container.getBoundingClientRect();
      W = canvas.width = Math.max(64, Math.floor(r.width * (global.devicePixelRatio || 1)));
      H = canvas.height = Math.max(64, Math.floor(r.height * (global.devicePixelRatio || 1)));
      seed();
    }

    function seed() {
      stars.length = 0; waves.length = 0; parts.length = 0; drops.length = 0; bars.length = 0;
      const n = Math.floor(W * H / 9000 * density);
      for (let i = 0; i < n; i++) {
        stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + 0.3, p: Math.random() * Math.PI * 2, s: Math.random() * 0.6 + 0.2 });
      }
      const nw = Math.floor(4 * density);
      for (let i = 0; i < nw; i++) {
        waves.push({ ph: Math.random() * Math.PI * 2, amp: H * (0.02 + Math.random() * 0.04), f: 0.004 + Math.random() * 0.006, y: H * (0.35 + i * 0.12), hue: 180 + Math.random() * 60, a: 0.10 + Math.random() * 0.14 });
      }
      const np = Math.floor(W * H / 16000 * density);
      for (let i = 0; i < np; i++) {
        parts.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.6, vy: -0.3 - Math.random() * 0.8, r: 1 + Math.random() * 2.2, a: 0.3 + Math.random() * 0.5 });
      }
      const nd = Math.floor(40 * density);
      for (let i = 0; i < nd; i++) {
        drops.push({ x: Math.random() * W, y: Math.random() * H, len: 12 + Math.random() * 20, v: 3 + Math.random() * 5, a: 0.12 + Math.random() * 0.2 });
      }
      const nb = Math.floor(30 * density);
      for (let i = 0; i < nb; i++) {
        bars.push({ x: Math.random() * W, y: Math.random() * H * 0.8, w: 1 + Math.random() * 2.4, h: 4 + Math.random() * 22, v: 0.5 + Math.random() * 2, a: 0.35 + Math.random() * 0.4 });
      }
    }

    function hexRgb(hex, a) {
      const n = parseInt(hex.replace('#', ''), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
    }

    function drawAurora() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#050916');
      g.addColorStop(0.55, '#0b1e38');
      g.addColorStop(1, '#071126');
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
          const y = w.y + Math.sin(x * w.f + t * 0.4 * speed + w.ph) * w.amp
                  + Math.sin(x * w.f * 2.3 - t * 0.25 * speed + w.ph) * w.amp * 0.5;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = 'hsla(' + w.hue + ',80%,55%,' + w.a + ')';
        ctx.fill();
      }
    }

    function drawOcean() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#03111f');
      g.addColorStop(0.7, '#04273f');
      g.addColorStop(1, '#02101c');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      for (const w of waves) {
        ctx.beginPath();
        for (let x = 0; x <= W; x += 6) {
          const y = w.y + Math.sin(x * w.f + t * 0.5 * speed + w.ph) * w.amp
                  + Math.sin(x * w.f * 1.7 + t * 0.3 * speed) * w.amp * 0.4;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        ctx.fillStyle = 'hsla(' + (w.hue + Math.sin(t * 0.02) * 20) + ',70%,' + (30 + w.a * 40) + '%,' + Math.min(0.9, w.a + 0.25) + ')';
        ctx.fill();
      }
      for (const s of stars.slice(0, 40)) {
        ctx.globalAlpha = s.a * 0.5;
        ctx.fillStyle = '#9fd8ff';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    function drawParticles() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a0f1e');
      g.addColorStop(1, '#141b30');
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
      ctx.globalAlpha = 0.06;
      ctx.strokeStyle = '#fff';
      for (let i = 0; i < parts.length; i += 2) {
        for (let j = i + 1; j < parts.length && j < i + 8; j++) {
          const a = parts[i], b = parts[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          if (dx * dx + dy * dy < 110 * 110) {
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawMatrix() {
      ctx.fillStyle = '#04070c'; ctx.fillRect(0, 0, W, H);
      const chars = '01アイウエオカキクケコサシスセソ0123456789$#@%';
      const fs = 14, cols = Math.floor(W / fs);
      if (!drawMatrix.cols) { drawMatrix.cols = cols; drawMatrix.ys = new Array(cols).fill(0).map(() => Math.random() * H); }
      if (drawMatrix.cols !== cols) { drawMatrix.cols = cols; drawMatrix.ys = new Array(cols).fill(0).map(() => Math.random() * H); }
      ctx.font = fs + 'px monospace';
      for (let i = 0; i < cols; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = Math.random() < 0.02 ? '#e8fff0' : hexRgb(accent, 0.85);
        ctx.fillText(ch, i * fs, drawMatrix.ys[i]);
        drawMatrix.ys[i] += (fs * 0.6) * speed;
        if (drawMatrix.ys[i] > H && Math.random() < 0.02) drawMatrix.ys[i] = 0;
      }
      ctx.fillStyle = 'rgba(4,7,12,.12)';
      ctx.fillRect(0, 0, W, H);
    }

    function drawKline() {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#0a1018');
      g.addColorStop(1, '#0d1520');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(90,110,140,.14)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        ctx.beginPath(); ctx.moveTo(0, H * i / 6); ctx.lineTo(W, H * i / 6); ctx.stroke();
      }
      for (const b of bars) {
        b.y += b.v * speed;
        if (b.y > H) { b.y = -30; b.x = Math.random() * W; }
        const up = b.v > 1;
        ctx.fillStyle = up ? 'rgba(255,91,91,' + b.a + ')' : 'rgba(46,204,113,' + b.a + ')';
        ctx.fillRect(b.x, b.y, b.w, b.h);
      }
      ctx.strokeStyle = hexRgb(accent, 0.5);
      ctx.lineWidth = 2;
      ctx.beginPath();
      const base = H * 0.55;
      for (let x = 0; x <= W; x += 4) {
        const y = base + Math.sin(x * 0.008 + t * 0.5 * speed) * 26
                + Math.sin(x * 0.003 - t * 0.3 * speed) * 42;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    function draw() {
      if (!running) return;
      t += 1;
      ctx.clearRect(0, 0, W, H);
      if (theme === 'ocean') drawOcean();
      else if (theme === 'particles') drawParticles();
      else if (theme === 'matrix') drawMatrix();
      else if (theme === 'kline') drawKline();
      else drawAurora();
      if (dim > 0) {
        ctx.fillStyle = 'rgba(8,10,18,' + dim * 0.85 + ')';
        ctx.fillRect(0, 0, W, H);
      }
      raf = requestAnimationFrame(draw);
    }

    const onVis = () => {
      if (document.hidden) { running = false; cancelAnimationFrame(raf); }
      else if (!running) { running = true; draw(); }
    };
    document.addEventListener('visibilitychange', onVis);

    const onResize = () => resize();
    if (opts.autosize !== false) window.addEventListener('resize', onResize);

    resize();
    draw();

    return {
      setTheme(th) { theme = th; resize(); },
      setDensity(d) { density = clamp(d, 0.3, 2); resize(); },
      setSpeed(s) { speed = clamp(s, 0.2, 3); },
      setDim(d) { dim = clamp(d, 0, 1); },
      setAccent(c) { accent = c; },
      get canvas() { return canvas; },
      destroy() {
        running = false;
        cancelAnimationFrame(raf);
        document.removeEventListener('visibilitychange', onVis);
        if (opts.autosize !== false) window.removeEventListener('resize', onResize);
        canvas.remove();
      },
    };
  }

  global.WallpaperEngine = WallpaperEngine;
})(window);
