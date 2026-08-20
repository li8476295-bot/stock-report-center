/*!
 * DeepSeek-Balance-Whale-Widget
 * =============================
 * 动态鲸鱼挂件（纯原生 JS + SVG，零依赖）。
 *
 * 用法：
 *   <balance-whale size="120" speed="1" color="#4fc3f7"></balance-whale>
 *
 * 特性：
 *   - SVG 鲸鱼游动动画（身体起伏 + 尾巴摆动 + 喷水 + 气泡）
 *   - 可配置：size 尺寸 / speed 速度 / color 主色 / 是否喷水
 *   - 自动适配深色/浅色背景
 *
 * 集成到任意页面：<script src="whale-widget.js"></script> 即可。
 * 也提供 window.BalanceWhale = { create(container, opts) } 编程接口。
 */
(function () {
  'use strict';

  const TPL = `
  <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg" class="bw-svg">
    <defs>
      <linearGradient id="bw-body" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="__C1__"/>
        <stop offset="100%" stop-color="__C2__"/>
      </linearGradient>
    </defs>
    <g class="bw-spout">
      <path d="M100 42 Q108 22 118 14 Q112 26 104 32" fill="none" stroke="#bfe9ff" stroke-width="2.4" stroke-linecap="round" opacity="0.9"/>
      <circle cx="118" cy="13" r="2.2" fill="#dff4ff" class="bw-drop"/>
      <circle cx="124" cy="8" r="1.6" fill="#dff4ff" class="bw-drop"/>
      <circle cx="112" cy="8" r="1.4" fill="#dff4ff" class="bw-drop"/>
    </g>
    <g class="bw-fish">
      <ellipse cx="100" cy="78" rx="52" ry="26" fill="url(#bw-body)"/>
      <path d="M148 78 Q172 62 182 46 Q170 74 148 80 Z" fill="__C2__" class="bw-tail"/>
      <circle cx="76" cy="70" r="4.2" fill="#fff"/>
      <circle cx="75" cy="69" r="2.2" fill="#10324a"/>
      <path d="M60 82 Q70 90 84 82" fill="none" stroke="#0b2b40" stroke-width="2" stroke-linecap="round" opacity="0.55"/>
      <path d="M52 70 Q66 84 84 86 Q70 92 56 80" fill="__C1__" opacity="0.35" class="bw-fin"/>
      <path d="M118 96 Q130 104 142 94" fill="none" stroke="#bfe9ff" stroke-width="2" stroke-linecap="round" opacity="0.8" class="bw-bubble"/>
      <circle cx="150" cy="90" r="2" fill="#bfe9ff" opacity="0.7" class="bw-bubble"/>
    </g>
  </svg>`;

  function buildSvg(color) {
    return TPL
      .replace(/__C1__/g, color || '#4fc3f7')
      .replace(/__C2__/g, shade(color || '#4fc3f7', -25));
  }

  function shade(hex, amt) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function create(container, opts) {
    opts = opts || {};
    const size = opts.size || 120;
    const speed = opts.speed || 1;
    const color = opts.color || '#4fc3f7';
    const host = document.createElement('div');
    host.className = 'bw-host';
    host.style.cssText = 'display:inline-block;line-height:0;vertical-align:middle;';
    host.innerHTML = buildSvg(color);
    container.appendChild(host);

    const svg = host.querySelector('.bw-svg');
    svg.style.width = size + 'px';
    svg.style.height = size * 0.6 + 'px';
    svg.style.overflow = 'visible';
    svg.style.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,.25))';

    const style = document.createElement('style');
    style.textContent = `
      .bw-host .bw-fish{transform-origin:100px 78px;animation:bw-swim ${2.6 / speed}s ease-in-out infinite}
      .bw-host .bw-tail{transform-origin:148px 78px;animation:bw-tail ${0.9 / speed}s ease-in-out infinite}
      .bw-host .bw-fin{transform-origin:52px 78px;animation:bw-fin ${1.6 / speed}s ease-in-out infinite}
      .bw-host .bw-spout{transform-origin:100px 42px;animation:bw-spout ${3.2 / speed}s ease-in-out infinite}
      .bw-host .bw-drop{animation:bw-drop ${1.2 / speed}s ease-in infinite}
      .bw-host .bw-drop:nth-child(2){animation-delay:.25s}
      .bw-host .bw-drop:nth-child(3){animation-delay:.5s}
      .bw-host .bw-bubble{animation:bw-bubble ${2.4 / speed}s ease-in-out infinite}
      .bw-host .bw-bubble:nth-child(2){animation-delay:1.2s}
      @keyframes bw-swim{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-5px) rotate(-1.5deg)}}
      @keyframes bw-tail{0%,100%{transform:rotate(0deg)}50%{transform:rotate(14deg)}}
      @keyframes bw-fin{0%,100%{transform:rotate(0deg) scaleY(1)}50%{transform:rotate(-12deg) scaleY(1.06)}}
      @keyframes bw-spout{0%,100%{transform:translateY(0);opacity:.95}50%{transform:translateY(-2px);opacity:1}}
      @keyframes bw-drop{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(16px);opacity:0}}
      @keyframes bw-bubble{0%{transform:translateY(0);opacity:.7}100%{transform:translateY(-14px);opacity:0}}
    `;
    document.head.appendChild(style);

    return {
      host,
      setSize(s) { svg.style.width = s + 'px'; svg.style.height = s * 0.6 + 'px'; },
      setSpeed(sp) {
        style.textContent = style.textContent.replace(/\/\s*[\d.]+s/g, (m) => {
          const base = parseFloat(m.slice(1, -1));
          return '/' + (base / sp).toFixed(2) + 's';
        });
      },
      destroy() { host.remove(); style.remove(); },
    };
  }

  class BalanceWhaleElement extends HTMLElement {
    connectedCallback() {
      const size = parseFloat(this.getAttribute('size') || '120');
      const speed = parseFloat(this.getAttribute('speed') || '1');
      const color = this.getAttribute('color') || '#4fc3f7';
      this._w = create(this, { size, speed, color });
    }
    disconnectedCallback() { if (this._w) this._w.destroy(); }
  }
  if (!customElements.get('balance-whale')) {
    customElements.define('balance-whale', BalanceWhaleElement);
  }

  window.BalanceWhale = { create };
})();
