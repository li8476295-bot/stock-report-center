/*!
 * custom-chart.js - 自绘 Canvas 图表（2026-08-30，零依赖，替代 echarts CDN）
 * 解决 GitHub Pages CDN 对 echarts.min.js 大文件截断导致的"图表加载中"。
 * API：
 *   window.CCK.drawKline(canvasEl, bars, title)  bars=[[date,open,close,high,low,volume],...]
 *   window.CCK.drawNav(canvasEl, sim, exp, title) sim/exp=[[date,value],...]
 *   window.CCK.clear(el)
 */
(function (global) {
  'use strict';
  var COL = { up: '#ff5b5b', down: '#2ecc71', grid: 'rgba(74,68,112,.35)',
              text: '#9aa4bd', title: '#e8eaf0', ma5: '#f1c40f', ma10: '#d9a5f0', ma20: '#49b6ff' };

  function dpr() { return global.devicePixelRatio || 1; }
  function fit(canvas) {
    var r = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: canvas.clientWidth || 600, height: canvas.clientHeight || 300 };
    var w = Math.max(200, r.width), h = Math.max(120, canvas.clientHeight || (r.height || 300));
    canvas.width = w * dpr(); canvas.height = h * dpr();
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d'); ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    return { ctx: ctx, w: w, h: h };
  }
  function fmtNum(v, d) { if (v == null || isNaN(v)) return '--'; return (+v).toFixed(d == null ? 2 : d); }
  function niceRange(min, max) {
    if (!isFinite(min) || !isFinite(max)) { min = 0; max = 1; }
    if (min === max) { min -= 1; max += 1; }
    return [min, max];
  }
  function drawText(ctx, t, x, y, color, size, align) {
    ctx.fillStyle = color || COL.text; ctx.font = (size || 11) + 'px sans-serif';
    ctx.textAlign = align || 'left'; ctx.fillText(t, x, y);
  }

  // ── 日K蜡烛图 ──
  function drawKline(canvas, bars, title, ann) {
    var f = fit(canvas); var ctx = f.ctx, W = f.w, H = f.h;
    ctx.clearRect(0, 0, W, H);
    if (!bars || !bars.length) { drawText(ctx, '暂无K线数据', 12, 24, '#c9d2e3', 13); return; }
    var padL = 56, padR = 12, padT = 30, padB = 22;
    var volH = Math.round(H * 0.20);            // 成交量区
    var mainH = H - padT - padB - volH - 8;      // 主图区（K线+均线）
    var n = bars.length;
    var highs = bars.map(function (b) { return b[3]; });
    var lows = bars.map(function (b) { return b[4]; });
    var min = Math.min.apply(null, lows), max = Math.max.apply(null, highs);
    var rng = niceRange(min, max);
    var xw = (W - padL - padR) / n;
    var cw = Math.max(2, Math.min(9, xw * 0.62));
    var yOf = function (p) { return padT + (rng[1] - p) / (rng[1] - rng[0]) * mainH; };
    var xOf = function (i) { return padL + i * xw + xw / 2; };

    // 网格 + y 刻度
    var STEP = Math.max(3, Math.round((rng[1] - rng[0]) / (mainH / 45)));
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (var v = Math.ceil(rng[0] / STEP) * STEP; v <= rng[1]; v += STEP) {
      var yy = yOf(v);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      drawText(ctx, v.toFixed(2), padL - 6, yy + 4, COL.text, 10, 'right');
    }
    // x 日期（每 6-8 根）
    var every = Math.max(1, Math.ceil(n / 8));
    for (var i = 0; i < n; i += every) {
      var xx = xOf(i);
      ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + mainH); ctx.stroke();
      drawText(ctx, (bars[i][0] || '').slice(5), xx - 14, H - 8, COL.text, 9);
    }
    // 蜡烛
    var vMax = 1;
    for (var i2 = 0; i2 < n; i2++) { if (bars[i2][5] > vMax) vMax = bars[i2][5]; }
    for (var i3 = 0; i3 < n; i3++) {
      var b = bars[i3], o = +b[1], c = +b[2], hi = +b[3], lo = +b[4], v = +b[5];
      var up = c >= o, col = up ? COL.up : COL.down;
      var x = xOf(i3);
      // 影线
      ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, yOf(hi)); ctx.lineTo(x, yOf(lo)); ctx.stroke();
      // 实体
      var yTop = yOf(Math.max(o, c)), yBot = yOf(Math.min(o, c));
      var bh = Math.max(1, yBot - yTop);
      if (up) { ctx.fillStyle = COL.up; }
      else { ctx.fillStyle = COL.down; }
      ctx.fillRect(x - cw / 2, yTop, cw, bh);
      // 成交量
      var vy = H - padB - (v / vMax) * volH;
      ctx.globalAlpha = 0.6; ctx.fillRect(x - cw / 2, vy, cw, H - padB - vy); ctx.globalAlpha = 1;
    }
    // MA
    function maVals(nn) {
      var out = [];
      for (var k = 0; k < n; k++) {
        if (k < nn - 1) { out.push(null); continue; }
        var s = 0; for (var j = k - nn + 1; j <= k; j++) s += +bars[j][2];
        out.push(s / nn);
      }
      return out;
    }
    function drawMA(arr, color) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.beginPath();
      var started = false;
      for (var k = 0; k < arr.length; k++) {
        if (arr[k] == null) { started = false; continue; }
        var px = xOf(k), py = yOf(arr[k]);
        if (!started) { ctx.moveTo(px, py); started = true; } else { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    }
    drawMA(maVals(5), COL.ma5); drawMA(maVals(10), COL.ma10); drawMA(maVals(20), COL.ma20);
    // ── 买入区间 / 止损 / 现价 标记（ann = {buy_low,buy_cap,stop,price}）──
    if (ann) {
      // 买入区间（buy_low ~ buy_cap）浅绿矩形带
      if (ann.buy_cap != null && ann.buy_low != null) {
        var cy1 = yOf(Math.max(ann.buy_cap, ann.buy_low)), cy2 = yOf(Math.min(ann.buy_cap, ann.buy_low));
        ctx.fillStyle = 'rgba(46,204,113,.12)';
        ctx.fillRect(padL, cy2, W - padL - padR, Math.max(2, cy1 - cy2));
        ctx.strokeStyle = 'rgba(46,204,113,.5)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(padL, cy1); ctx.lineTo(W - padR, cy1); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padL, cy2); ctx.lineTo(W - padR, cy2); ctx.stroke();
        ctx.setLineDash([]);
        drawText(ctx, '买入区间 ' + ann.buy_low + '~' + ann.buy_cap, W - padR - 150, cy2 + 12, '#2ecc71', 9, 'right');
      }
      // 止损线（红色虚线）
      if (ann.stop != null) {
        var sy = yOf(ann.stop);
        ctx.strokeStyle = '#ff5b5b'; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.moveTo(padL, sy); ctx.lineTo(W - padR, sy); ctx.stroke();
        ctx.setLineDash([]);
        drawText(ctx, '止损 ' + ann.stop, W - padR - 80, sy + 12, '#ff5b5b', 9, 'right');
      }
      // 现价（白色点线）
      if (ann.price != null) {
        var py2 = yOf(ann.price);
        ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
        ctx.beginPath(); ctx.moveTo(padL, py2); ctx.lineTo(W - padR, py2); ctx.stroke();
        ctx.setLineDash([]);
        drawText(ctx, '现价 ' + ann.price, padL + 70, py2 - 6, '#ffffff', 9);
      }
      // 破止损标记（现价 < 止损 → 红色文字+图标）
      if (ann.stop != null && ann.price != null && ann.price < ann.stop) {
        ctx.fillStyle = '#ff5b5b';
        ctx.beginPath(); ctx.arc(padL + 12, padT + 12, 8, 0, 6.283); ctx.fill();
        drawText(ctx, '破止损! 现价' + ann.price, padL + 26, padT + 16, '#ff5b5b', 12);
      }
    }
    // 标题 + 图例
    drawText(ctx, title || '日K', padL, 16, COL.title, 12);
    drawText(ctx, 'MA5', padL + 130, 16, COL.ma5, 10);
    drawText(ctx, 'MA10', padL + 168, 16, COL.ma10, 10);
    drawText(ctx, 'MA20', padL + 210, 16, COL.ma20, 10);
  }

  // ── 净值双折线 ──
  function drawNav(canvas, sim, exp, title) {
    var f = fit(canvas); var ctx = f.ctx, W = f.w, H = f.h;
    ctx.clearRect(0, 0, W, H);
    var padL = 56, padR = 14, padT = 34, padB = 24;
    var mw = W - padL - padR, mh = H - padT - padB;
    var simMap = {}, expMap = {};
    (sim || []).forEach(function (x) { simMap[x[0]] = x[1]; });
    (exp || []).forEach(function (x) { expMap[x[0]] = x[1]; });
    var dates = Object.keys(simMap).concat(Object.keys(expMap).filter(function (d) { return !(d in simMap); })).sort();
    if (!dates.length) { drawText(ctx, '暂无净值数据', 12, 24, '#c9d2e3', 13); return; }
    // 双 y 轴：模拟盘（5000级）左轴 / 策略期望（100级）右轴，避免量级差 50 倍挤在图端
    function rangeOf(map) {
      var vs = dates.map(function (d) { return map[d]; }).filter(function (v) { return v != null; });
      if (!vs.length) return [0, 1];
      return niceRange(Math.min.apply(null, vs), Math.max.apply(null, vs));
    }
    var srng = rangeOf(simMap), erng = rangeOf(expMap);
    var xOf = function (i) { return dates.length === 1 ? padL : padL + i / (dates.length - 1) * mw; };
    var yOfS = function (v) { return padT + (srng[1] - v) / (srng[1] - srng[0]) * mh; };
    var yOfE = function (v) { return padT + (erng[1] - v) / (erng[1] - erng[0]) * mh; };
    // 左轴网格（模拟盘）
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    var STEP = (srng[1] - srng[0]) / 5;
    for (var v = srng[0]; v <= srng[1] + 0.001; v += STEP) {
      var yy = yOfS(v);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      drawText(ctx, v.toFixed(0), padL - 6, yy + 4, COL.text, 10, 'right');
    }
    // 右轴刻度（策略，紫色）
    var ESTEP = (erng[1] - erng[0]) / 4;
    for (var ev = erng[0]; ev <= erng[1] + 0.001; ev += ESTEP) {
      drawText(ctx, ev.toFixed(1), W - padR + 2, yOfE(ev) + 4, '#c792ea', 9, 'left');
    }
    // x 日期
    var every = Math.max(1, Math.ceil(dates.length / 6));
    for (var i = 0; i < dates.length; i += every) {
      var xx = xOf(i);
      ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + mh); ctx.stroke();
      drawText(ctx, dates[i].slice(5), xx - 14, H - 8, COL.text, 9);
    }
    function line(series, color, dash, yf) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
      ctx.beginPath(); var st = false;
      series.forEach(function (x) {
        var idx = dates.indexOf(x[0]); if (idx < 0) return;
        var px = xOf(idx), py = yf(x[1]);
        if (!st) { ctx.moveTo(px, py); st = true; } else { ctx.lineTo(px, py); }
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 6.283); ctx.fill();
      });
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (sim && sim.length) line(sim, COL.up, [], yOfS);
    if (exp && exp.length) line(exp, '#c792ea', [6, 4], yOfE);
    drawText(ctx, title || '资金净值（基准100）', padL, 16, COL.title, 12);
    drawText(ctx, '■ 模拟盘(左轴)', padL + 205, 16, COL.up, 10);
    drawText(ctx, '◇ 策略期望(右轴)', padL + 300, 16, '#c792ea', 10);
  }

  function clear(canvas) {
    var f = fit(canvas); f.ctx.clearRect(0, 0, f.w, f.h);
  }

  global.CCK = { drawKline: drawKline, drawNav: drawNav, clear: clear };
})(window);
