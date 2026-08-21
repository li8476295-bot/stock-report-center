/*!
 * we-ui.js - 报表中心交互组件（2026-08-20）
 * 1) 点击右下角鲸鱼 → 输入/修改 DeepSeek API Key → 数字滚动显示余额
 * 2) 左下角 🖼 按钮 → 壁纸面板（切换主题/视频壁纸、透明度、模糊）
 * 依赖：window.WallpaperEngine（wallpaper-engine.js）
 */
(function () {
  'use strict';
  var LS_KEY = 'ds_api_key';
  var LS_PREF = 'we_pref';

  function getWE() { return window.__REPORT_WE__ || window.__WE__; }
  function $(s) { return document.querySelector(s); }

  // ── 弹窗 ──
  function modal(title, bodyHtml) {
    var old = $('.weui-modal'); if (old) old.remove();
    var m = document.createElement('div');
    m.className = 'weui-modal';
    m.innerHTML = '<div class="weui-box"><div class="weui-title">' + title + '</div>'
      + '<div class="weui-body">' + bodyHtml + '</div></div>';
    document.body.appendChild(m);
    return m;
  }
  function closeModal() { var m = $('.weui-modal'); if (m) m.remove(); }
  function css() {
    var st = document.createElement('style');
    st.textContent = [
      '.weui-modal{position:fixed;inset:0;z-index:99999;background:rgba(8,10,18,.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px)}',
      '.weui-box{background:#151d31;border:1px solid #3a4a6e;border-radius:14px;padding:18px 20px;width:340px;max-width:90vw;color:#e8eaf0;box-shadow:0 12px 40px rgba(0,0,0,.5)}',
      '.weui-title{font-size:15px;color:#c9d2e3;margin-bottom:12px}',
      '.weui-body input[type=password],.weui-body input[type=text]{width:100%;box-sizing:border-box;padding:8px 10px;border-radius:8px;border:1px solid #3a4a6e;background:#0d1524;color:#e8eaf0;font-size:13px;margin:4px 0 10px}',
      '.weui-bal{font-size:30px;font-weight:700;text-align:center;color:#2ecc71;margin:10px 0;font-variant-numeric:tabular-nums}',
      '.weui-bal small{font-size:14px;color:#9aa4bd;font-weight:400}',
      '.weui-note{font-size:11px;color:#9aa4bd;text-align:center;margin-top:6px}',
      '.weui-btns{display:flex;gap:8px;margin-top:10px}',
      '.weui-btns button{flex:1;padding:7px;border:0;border-radius:8px;cursor:pointer;font-size:13px}',
      '.weui-ok{background:#2ecc71;color:#0b1220;font-weight:600}',
      '.weui-cancel{background:#3a3f55;color:#c9d2e3}',
      '#we-panel{position:fixed;left:14px;bottom:10px;z-index:9998}',
      '#we-panel .we-pbtn{width:40px;height:40px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(16,22,38,.8);color:#e8eaf0;font-size:18px;cursor:pointer;backdrop-filter:blur(6px)}',
      '#we-panel .we-pbody{display:none;margin-top:8px;width:230px;background:rgba(16,22,38,.92);border:1px solid #3a4a6e;border-radius:12px;padding:12px;color:#e8eaf0;font-size:12px;backdrop-filter:blur(8px)}',
      '#we-panel.open .we-pbody{display:block}',
      '#we-panel .we-sec{color:#9aa4bd;margin:8px 0 4px;font-size:11px}',
      '#we-panel .we-item{display:inline-block;padding:3px 9px;margin:2px;border-radius:10px;background:#232c47;cursor:pointer;border:1px solid transparent}',
      '#we-panel .we-item.on{background:#b388d6;color:#fff}',
      '#we-panel label{display:flex;justify-content:space-between;margin:6px 0;color:#c9d2e3}',
      '#we-panel input[type=range]{flex:1;margin-left:8px}',
      '.bw-host{cursor:pointer}'
    ].join('\n');
    document.head.appendChild(st);
  }

  // ── 余额（数字滚动）──
  function fetchBalance(key) {
    return fetch('https://api.deepseek.com/user/balance', {
      headers: { 'Authorization': 'Bearer ' + key }
    }).then(function (r) { return r.json(); });
  }
  function rollNumber(el, target) {
    var start = performance.now(), dur = 900;
    function step(now) {
      var p = Math.min(1, (now - start) / dur);
      var v = target * (1 - Math.pow(1 - p, 3));
      el.textContent = v.toFixed(2);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function showBalance(key) {
    var m = modal('🐋 DeepSeek 余额', '<div class="weui-bal">--<small> 元</small></div>'
      + '<div class="weui-note">查询中…</div>'
      + '<div class="weui-btns"><button class="weui-cancel" onclick="document.querySelector(\'.weui-modal\').remove()">关闭</button>'
      + '<button class="weui-ok" onclick="(window.__WEUI__||{}).editKey&&window.__WEUI__.editKey()">更换 Key</button></div>');
    var bal = m.querySelector('.weui-bal');
    fetchBalance(key).then(function (d) {
      if (d && d.balance_infos && d.balance_infos.length) {
        var b = d.balance_infos[0];
        bal.innerHTML = '';
        rollNumber(bal, parseFloat(b.total_balance) || 0);
        bal.insertAdjacentHTML('beforeend', '<small> 元（' + (b.currency || 'CNY') + '）</small>');
        m.querySelector('.weui-note').textContent = '账户可用 ✓' + (b.granted_balance > 0 ? '（赠送 ' + b.granted_balance + '）' : '');
      } else {
        bal.textContent = '--';
        m.querySelector('.weui-note').textContent = '查询失败：' + ((d && d.error && d.error.message) || '未知错误');
      }
    }).catch(function (e) {
      bal.textContent = '--';
      m.querySelector('.weui-note').textContent = '查询失败：' + e.message;
    });
  }
  function editKey() {
    var key = localStorage.getItem(LS_KEY) || '';
    var m = modal('🔑 DeepSeek API Key',
      '<input type="password" id="weui-key" placeholder="sk-..." value="' + key + '">'
      + '<div class="weui-note">Key 只保存在本浏览器 localStorage，用于查询余额（api.deepseek.com/user/balance）</div>'
      + '<div class="weui-btns"><button class="weui-cancel" onclick="document.querySelector(\'.weui-modal\').remove()">取消</button>'
      + '<button class="weui-ok" id="weui-save">保存并查询</button></div>');
    m.querySelector('#weui-save').onclick = function () {
      var k = m.querySelector('#weui-key').value.trim();
      if (!k) { m.querySelector('.weui-note').textContent = 'Key 不能为空'; return; }
      localStorage.setItem(LS_KEY, k);
      showBalance(k);
    };
  }

  // ── 壁纸面板 ──
  var THEMES = [['aurora', '✨ 星空极光'], ['ocean', '🌊 深海'], ['particles', '💫 粒子'], ['matrix', '🟢 数字雨'], ['kline', '📈 股票']];
  function buildPanel() {
    var wrap = document.createElement('div');
    wrap.id = 'we-panel';
    wrap.innerHTML = '<button class="we-pbtn" title="壁纸面板">🖼</button><div class="we-pbody">'
      + '<div class="we-sec">内置主题</div><div id="we-themes"></div>'
      + '<div class="we-sec">视频壁纸（Wallpaper Engine）</div><div id="we-vids"></div>'
      + '<div class="we-sec">效果</div>'
      + '<label>暗化 <input type="range" id="we-dim" min="0" max="1" step="0.05" value="0.55"></label>'
      + '<label>模糊 <input type="range" id="we-blur" min="0" max="20" step="1" value="0"></label>'
      + '</div>';
    document.body.appendChild(wrap);

    var btn = wrap.querySelector('.we-pbtn');
    btn.onclick = function () { wrap.classList.toggle('open'); };

    var cfg = window.__WE_CONFIG__ || {};
    var vids = (cfg.videos || []);
    var themesBox = wrap.querySelector('#we-themes');
    THEMES.forEach(function (t) {
      var s = document.createElement('span');
      s.className = 'we-item' + (t[0] === (cfg.theme || 'aurora') ? ' on' : '');
      s.textContent = t[1];
      s.onclick = function () {
        themesBox.querySelectorAll('.we-item').forEach(function (x) { x.classList.remove('on'); });
        s.classList.add('on');
        var we = getWE(); if (we) we.setTheme(t[0]);
        savePref({ theme: t[0] });
      };
      themesBox.appendChild(s);
    });
    var vidsBox = wrap.querySelector('#we-vids');
    if (vids.length) {
      vids.forEach(function (v, i) {
        var s = document.createElement('span');
        s.className = 'we-item';
        s.textContent = '视频 ' + (i + 1);
        s.onclick = function () {
          vidsBox.querySelectorAll('.we-item').forEach(function (x) { x.classList.remove('on'); });
          s.classList.add('on');
          var we = getWE(); if (we) we.setVideo('wallpapers/' + v);
        };
        vidsBox.appendChild(s);
      });
    } else {
      vidsBox.innerHTML = '<span style="color:#5d688a">公网版无视频（本地报表中心有）</span>';
    }

    var dimEl = wrap.querySelector('#we-dim'), blurEl = wrap.querySelector('#we-blur');
    dimEl.oninput = function () { var we = getWE(); if (we) we.setDim(parseFloat(dimEl.value)); savePref({ dim: parseFloat(dimEl.value) }); };
    blurEl.oninput = function () { applyBlur(parseFloat(blurEl.value)); savePref({ blur: parseFloat(blurEl.value) }); };

    // 恢复偏好
    var pref = {};
    try { pref = JSON.parse(localStorage.getItem(LS_PREF) || '{}'); } catch (e) {}
    if (pref.dim !== undefined) { dimEl.value = pref.dim; var we = getWE(); if (we) we.setDim(pref.dim); }
    if (pref.blur !== undefined) { blurEl.value = pref.blur; applyBlur(pref.blur); }
  }
  function applyBlur(v) {
    var we = getWE();
    if (we && we.canvas) we.canvas.style.filter = v > 0 ? ('blur(' + v + 'px)') : '';
  }
  function savePref(patch) {
    var pref = {};
    try { pref = JSON.parse(localStorage.getItem(LS_PREF) || '{}'); } catch (e) {}
    for (var k in patch) pref[k] = patch[k];
    localStorage.setItem(LS_PREF, JSON.stringify(pref));
  }

  // ── DeepSeek娘 点击（挥手动画 + 余额/Key）──
  function hookWhale() {
    var wh = document.querySelector('.ds-pet');
    if (!wh) return;
    wh.title = '点击查看 DeepSeek 余额';
    wh.onclick = function () {
      var img = document.getElementById('ds-pet-img');
      if (img) {
        img.src = 'images/waving.gif';
        clearTimeout(window.__DS_PET_T__);
        window.__DS_PET_T__ = setTimeout(function () { img.src = 'images/idle.gif'; }, 2000);
      }
      var key = localStorage.getItem(LS_KEY);
      if (key) showBalance(key);
      else editKey();
    };
  }

  window.__WEUI__ = { editKey: editKey };
  function init() {
    css();
    buildPanel();
    hookWhale();
    // 已存 key 时角色旁显示余额小标签
    var key = localStorage.getItem(LS_KEY);
    if (key && document.querySelector('.ds-pet')) {
      fetchBalance(key).then(function (d) {
        if (d && d.balance_infos && d.balance_infos.length && document.querySelector('.ds-pet')) {
          var tag = document.createElement('div');
          tag.style.cssText = 'position:fixed;right:14px;bottom:' + (window.innerWidth <= 640 ? '108px' : '150px') + ';z-index:9999;pointer-events:none;font-size:11px;color:#9fc6dd;background:rgba(10,16,28,.7);padding:3px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.1)';
          tag.textContent = '余额 ¥' + (parseFloat(d.balance_infos[0].total_balance) || 0).toFixed(2) + '（点DeepSeek娘查询）';
          document.body.appendChild(tag);
        }
      }).catch(function () {});
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
