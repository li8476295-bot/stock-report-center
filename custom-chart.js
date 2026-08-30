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
    // x 日期（均匀抽标签 + 强制最新一根，避免"最后标签停在旧日期"的误导）
    var every = Math.max(1, Math.ceil(n / 8));
    for (var i = 0; i < n; i += every) {
      var xx = xOf(i);
      ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + mainH); ctx.stroke();
      // 若是最后一根之前的普通标签，用常规色；最后一根单独高亮
      drawText(ctx, (bars[i][0] || '').slice(5), xx - 14, H - 8, COL.text, 9);
    }
    // 最新一根：高亮 + 显式"最新"标注
    var lbi = n - 1;
    var lx = xOf(lbi);
    var ldate = (bars[lbi][0] || '').slice(5);
    ctx.strokeStyle = 'rgba(241,196,15,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lx, padT); ctx.lineTo(lx, padT + mainH); ctx.stroke();
    drawText(ctx, ldate + ' ▲最新', lx - 24, H - 8, '#f1c40f', 10);
    // 最新一根蜡烛描边高亮
    ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 2;
    ctx.strokeRect(xOf(lbi) - cw / 2 - 1, yOf(Math.max(+bars[lbi][1], +bars[lbi][2])) - 2, cw + 2, Math.max(2, yOf(Math.min(+bars[lbi][1], +bars[lbi][2])) - yOf(Math.max(+bars[lbi][1], +bars[lbi][2])) + 4));
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
    // ── 历史破位点：凡当天最低价跌破止损的日子，标红色"破"字 + 竖线 ──
    if (ann && ann.stop != null) {
      for (var kb = 0; kb < n; kb++) {
        var lob = +bars[kb][4];
        if (lob < ann.stop) {
          var xb = xOf(kb), yb = yOf(lob);
          ctx.fillStyle = 'rgba(255,91,91,.9)';
          ctx.beginPath(); ctx.arc(xb, yb, 3, 0, 6.283); ctx.fill();
          ctx.strokeStyle = 'rgba(255,91,91,.85)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(xb, padT); ctx.lineTo(xb, padT + mainH); ctx.stroke();
          // 只在主图区右侧/最近处标一个"破"字避免拥挤：给最早那天标
          if (kb === firstBreakIdx()) drawText(ctx, '破止损', xb + 4, yb - 7, '#ff5b5b', 9);
        }
      }
    }
    function firstBreakIdx() {
      for (var q = 0; q < n; q++) { if (+bars[q][4] < (ann && ann.stop)) return q; }
      return -1;
    }
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
        // 明确买入点：在买入区间上沿（推荐买入价）标绿色▲
        var bpx = padL + (W - padL - padR) * 0.18;
        ctx.fillStyle = '#2ecc71'; ctx.beginPath();
        ctx.moveTo(bpx, cy1 - 7); ctx.lineTo(bpx - 6, cy1 + 3); ctx.lineTo(bpx + 6, cy1 + 3); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
        ctx.fillText('▲买入点 ' + ann.buy_cap, bpx + 9, cy1 + 8);
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
      // 状态徽标：现价 vs 止损 / 买入区间（帮助"能不能买"判断）
      var stText = '', stColor = '#9aa4bd';
      if (ann.price != null && ann.stop != null) {
        if (ann.price < ann.stop) { stText = '🔴 已破止损·观望'; stColor = '#ff5b5b'; }
        else if (ann.buy_cap != null && ann.buy_low != null && ann.price >= ann.buy_low && ann.price <= ann.buy_cap) {
          stText = '🟢 在买入区间·可买'; stColor = '#2ecc71';
        } else if (ann.buy_cap != null && ann.price < ann.buy_cap) {
          stText = '🟢 低于买入区间·可分批'; stColor = '#2ecc71';
        } else {
          stText = '🟠 高于买入区间·观望'; stColor = '#f1c40f';
        }
      }
      if (stText) {
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        var stw = ctx.measureText(stText).width;
        ctx.fillRect(padL, padT + 18, stw + 26, 18);
        ctx.fillStyle = stColor; ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'left'; ctx.fillText(stText, padL + 13, padT + 31);
      }
      // 破止损标记（现价 < 止损 → 红色文字+图标）
      if (ann.stop != null && ann.price != null && ann.price < ann.stop) {
        ctx.fillStyle = '#ff5b5b';
        ctx.beginPath(); ctx.arc(padL + 12, padT + 52, 8, 0, 6.283); ctx.fill();
        drawText(ctx, '破止损! 现价' + ann.price, padL + 26, padT + 56, '#ff5b5b', 12);
      }
    }
    // 标题 + 图例（右上，避开左上状态徽标）
    drawText(ctx, title || '日K', padL, 16, COL.title, 12);
    drawText(ctx, 'MA5', padL + 200, 16, COL.ma5, 10);
    drawText(ctx, 'MA10', padL + 238, 16, COL.ma10, 10);
    drawText(ctx, 'MA20', padL + 280, 16, COL.ma20, 10);
  }

  // ── 当日收盘分时走势图 ──
  // data: {date, pts:[[HHMM, price], ...]}  ann={buy_low,buy_cap,stop,price,pre_close}
  function drawMinute(canvas, data, title, ann) {
    var f = fit(canvas); var ctx = f.ctx, W = f.w, H = f.h;
    ctx.clearRect(0, 0, W, H);
    var pts = (data && data.pts) || [];
    if (!pts.length) { drawText(ctx, '暂无当日分时数据', 12, 24, '#c9d2e3', 13); return; }
    var padL = 52, padR = 12, padT = 30, padB = 24;
    var mh = H - padT - padB;
    var pre = ann && ann.pre_close;   // 昨收（基准）
    var prices = pts.map(function (p) { return p[1]; });
    var pmin = Math.min.apply(null, prices), pmax = Math.max.apply(null, prices);
    if (pre != null) { pmin = Math.min(pmin, pre); pmax = Math.max(pmax, pre); }
    if (ann && ann.stop != null) pmin = Math.min(pmin, ann.stop);
    if (ann && ann.buy_low != null) pmin = Math.min(pmin, ann.buy_low);
    if (ann && ann.buy_cap != null) pmax = Math.max(pmax, ann.buy_cap);
    var rng = niceRange(pmin, pmax);
    var xOf = function (i) { return pts.length === 1 ? padL : padL + i / (pts.length - 1) * (W - padL - padR); };
    var yOf = function (p) { return padT + (rng[1] - p) / (rng[1] - rng[0]) * mh; };
    // 网格 + 左轴
    var STEP = Math.max(0.5, (rng[1] - rng[0]) / 5);
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    for (var v = Math.ceil(rng[0] / STEP) * STEP; v <= rng[1]; v += STEP) {
      var yy = yOf(v); ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      drawText(ctx, v.toFixed(2), padL - 6, yy + 4, COL.text, 10, 'right');
    }
    // 昨收基准线（白虚线）
    if (pre != null) {
      var yPre = yOf(pre);
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(padL, yPre); ctx.lineTo(W - padR, yPre); ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, '昨收 ' + pre, W - padR - 90, yPre - 5, 'rgba(255,255,255,.5)', 9, 'right');
    }
    // 买入区间带
    if (ann && ann.buy_cap != null && ann.buy_low != null) {
      var cy1 = yOf(Math.max(ann.buy_cap, ann.buy_low)), cy2 = yOf(Math.min(ann.buy_cap, ann.buy_low));
      ctx.fillStyle = 'rgba(46,204,113,.12)'; ctx.fillRect(padL, cy2, W - padL - padR, Math.max(2, cy1 - cy2));
      ctx.strokeStyle = 'rgba(46,204,113,.5)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(padL, cy1); ctx.lineTo(W - padR, cy1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(padL, cy2); ctx.lineTo(W - padR, cy2); ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, '买入区间 ' + ann.buy_low + '~' + ann.buy_cap, W - padR - 150, cy2 + 12, '#2ecc71', 9, 'right');
      var bpx2 = padL + (W - padL - padR) * 0.18;
      ctx.fillStyle = '#2ecc71'; ctx.beginPath();
      ctx.moveTo(bpx2, cy1 - 7); ctx.lineTo(bpx2 - 6, cy1 + 3); ctx.lineTo(bpx2 + 6, cy1 + 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2ecc71'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('▲买入点 ' + ann.buy_cap, bpx2 + 9, cy1 + 8);
    }
    // 止损线
    if (ann && ann.stop != null) {
      var sy = yOf(ann.stop);
      ctx.strokeStyle = '#ff5b5b'; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(padL, sy); ctx.lineTo(W - padR, sy); ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, '止损 ' + ann.stop, W - padR - 80, sy + 12, '#ff5b5b', 9, 'right');
    }
    // 价格线 + 面积
    ctx.beginPath();
    for (var k = 0; k < pts.length; k++) {
      var px = xOf(k), py = yOf(pts[k][1]);
      if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = '#49b6ff'; ctx.lineWidth = 2; ctx.stroke();
    // 面积填充
    ctx.lineTo(xOf(pts.length - 1), padT + mh); ctx.lineTo(xOf(0), padT + mh); ctx.closePath();
    ctx.fillStyle = 'rgba(73,182,255,.12)'; ctx.fill();
    // 破位标记：当日任何分钟价跌破止损 → 标红点 + 文字
    var bIdx = -1;
    if (ann && ann.stop != null) {
      for (var b = 0; b < pts.length; b++) {
        if (pts[b][1] < ann.stop) { bIdx = b; break; }
      }
      if (bIdx >= 0) {
        var bx = xOf(bIdx), by = yOf(pts[bIdx][1]);
        ctx.fillStyle = '#ff5b5b'; ctx.beginPath(); ctx.arc(bx, by, 4, 0, 6.283); ctx.fill();
        drawText(ctx, '▼破位 ' + pts[bIdx][0], bx + 6, by + 14, '#ff5b5b', 11);
        // 破位后到收盘区间淡红
        var byEnd = yOf(pts[pts.length - 1][1]);
        ctx.fillStyle = 'rgba(255,91,91,.10)';
        var xEnd = xOf(pts.length - 1);
        ctx.fillRect(bx, Math.min(by, byEnd), xEnd - bx, Math.abs(byEnd - by));
      }
    }
    // 时间刻度（09:30/11:30/13:00/15:00）
    var marks = ['0930', '1030', '1130', '1300', '1400', '1500'];
    marks.forEach(function (t) {
      for (var m = 0; m < pts.length; m++) { if (pts[m][0].slice(0, 4) === t) { var mx = xOf(m); ctx.strokeStyle = COL.grid; ctx.beginPath(); ctx.moveTo(mx, padT); ctx.lineTo(mx, padT + mh); ctx.stroke(); drawText(ctx, t.slice(0, 2) + ':' + t.slice(2), mx - 12, H - 8, COL.text, 9); break; } }
    });
    // 状态徽标
    var stText = '', stColor = '#9aa4bd';
    if (ann && ann.price != null && ann.stop != null) {
      if (ann.price < ann.stop) { stText = '🔴 已破止损·观望'; stColor = '#ff5b5b'; }
      else if (ann.buy_cap != null && ann.buy_low != null && ann.price >= ann.buy_low && ann.price <= ann.buy_cap) { stText = '🟢 在买入区间·可买'; stColor = '#2ecc71'; }
      else if (ann.buy_cap != null && ann.price < ann.buy_cap) { stText = '🟢 低于买入区间·可分批'; stColor = '#2ecc71'; }
      else { stText = '🟠 高于买入区间·观望'; stColor = '#f1c40f'; }
    }
    if (stText) { ctx.fillStyle = 'rgba(0,0,0,.35)'; var stw = ctx.measureText(stText).width; ctx.fillRect(padL, padT + 18, stw + 26, 18); ctx.fillStyle = stColor; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(stText, padL + 13, padT + 31); }
    // 标题 + 最新价
    drawText(ctx, title || '当日走势', padL, 16, COL.title, 12);
    if (ann && ann.price != null) drawText(ctx, '现价 ' + ann.price, padL + 200, 16, '#ffffff', 11);
  }

  // ── 净值双折线 ──
  function drawNav(canvas, sim, exp, title) {
    var f = fit(canvas); var ctx = f.ctx, W = f.w, H = f.h;
    ctx.clearRect(0, 0, W, H);
    var padL = 56, padR = 14, padT = 34, padB = 24;
    var mw = W - padL - padR, mh = H - padT - padB;
    // 归一化到基准 100（首个交易日=100），两条线同轴直接对比（避免 5000vs100 量级差）
    function norm(series) {
      if (!series || !series.length) return [];
      var base = series[0][1]; if (!base) return [];
      return series.map(function (x) { return [x[0], +(x[1] / base * 100).toFixed(2)]; });
    }
    var snorm = norm(sim), enorm = norm(exp);
    var all = {}; snorm.forEach(function (x) { all[x[0]] = x[1]; });
    enorm.forEach(function (x) { all[x[0]] = x[1]; });
    var dates = Object.keys(all).sort();
    if (!dates.length) { drawText(ctx, '暂无净值数据', 12, 24, '#c9d2e3', 13); return; }
    var vals = dates.map(function (d) { return all[d]; });
    var rng = niceRange(Math.min.apply(null, vals), Math.max.apply(null, vals));
    rng = [Math.floor(rng[0] - 0.5), Math.ceil(rng[1] + 0.5)];
    var xOf = function (i) { return dates.length === 1 ? padL : padL + i / (dates.length - 1) * mw; };
    var yOf = function (v) { return padT + (rng[1] - v) / (rng[1] - rng[0]) * mh; };
    // 基准 100 参考线
    if (rng[0] <= 100 && rng[1] >= 100) {
      var y100 = yOf(100);
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1; ctx.setLineDash([6,4]);
      ctx.beginPath(); ctx.moveTo(padL, y100); ctx.lineTo(W - padR, y100); ctx.stroke();
      ctx.setLineDash([]);
      drawText(ctx, '基准100', W - padR - 60, y100 - 5, 'rgba(255,255,255,.5)', 9, 'right');
    }
    // 网格 + 左轴刻度
    ctx.strokeStyle = COL.grid; ctx.lineWidth = 1;
    var STEP = Math.max(0.5, (rng[1] - rng[0]) / 5);
    for (var v = rng[0]; v <= rng[1]; v += STEP) {
      var yy = yOf(v);
      ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(W - padR, yy); ctx.stroke();
      drawText(ctx, v.toFixed(1), padL - 6, yy + 4, COL.text, 10, 'right');
    }
    // x 日期
    var every = Math.max(1, Math.ceil(dates.length / 6));
    for (var i = 0; i < dates.length; i += every) {
      var xx = xOf(i);
      ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + mh); ctx.stroke();
      drawText(ctx, dates[i].slice(5), xx - 14, H - 8, COL.text, 9);
    }
    function line(series, color, dash) {
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash(dash || []);
      ctx.beginPath(); var st = false;
      series.forEach(function (x) {
        var idx = dates.indexOf(x[0]); if (idx < 0) return;
        var px = xOf(idx), py = yOf(x[1]);
        if (!st) { ctx.moveTo(px, py); st = true; } else { ctx.lineTo(px, py); }
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(px, py, 2.5, 0, 6.283); ctx.fill();
      });
      ctx.stroke(); ctx.setLineDash([]);
    }
    if (snorm && snorm.length) line(snorm, COL.up, []);
    if (enorm && enorm.length) line(enorm, '#c792ea', [6, 4]);
    drawText(ctx, title || '资金净值（归一化基准100）', padL, 16, COL.title, 12);
    drawText(ctx, '■ 模拟盘', padL + 230, 16, COL.up, 10);
    drawText(ctx, '◇ 策略期望', padL + 290, 16, '#c792ea', 10);
  }

  function clear(canvas) {
    var f = fit(canvas); f.ctx.clearRect(0, 0, f.w, f.h);
  }

  global.CCK = { drawKline: drawKline, drawMinute: drawMinute, drawNav: drawNav, clear: clear };
})(window);
