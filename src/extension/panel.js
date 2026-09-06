(() => {
  'use strict';
  const BUILDS = new Set(['/assets/index-Bxn5yOTB.js', '/assets/index-CgXirkUy.js', '/assets/index-ClWTW3HX.js', '/assets/index-CvgiEu-R.js', '/assets/index-B-HzRssS.js', '/assets/index-yKYHPeXU.js', '/assets/index-BdL5hCoZ.js', '/assets/index-D-7nOosq.js', '/assets/index-HRJ6xRtC.js', '/assets/index-CiHMlsuo.js', '/assets/index--0t1wzw_.js', '/assets/index-BkUUBejk.js']);
  if (!Array.from(document.scripts).some(s => {
    try { return BUILDS.has(new URL(s.src).pathname); } catch { return false; }
  })) return;
  const defaults = { enabled: true, keep: 20, blocks: 20, idleMinutes: 10, auto: true };
  const host = document.createElement('div');
  host.id = 'kimi-lazy-panel';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{position:fixed;right:18px;top:62px;z-index:2147483000;font:13px/1.55 system-ui;color:#eee;color-scheme:dark;width:max-content;max-width:calc(100vw - 20px)}
    button,input{font:inherit}button{cursor:pointer;border:1px solid #555;border-radius:7px;padding:6px 10px;background:#292929;color:#eee}
    button:hover{background:#393939}button:focus-visible,input:focus-visible{outline:2px solid #7ca7ff;outline-offset:2px}
    #toggle{box-shadow:0 2px 12px #0005;background:#222e;backdrop-filter:blur(6px);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
    #toggle.dragging{cursor:grabbing;background:#393939}
    #body{position:absolute;top:calc(100% + 6px);left:0;width:270px;max-width:calc(100vw - 20px);max-height:calc(100dvh - 20px);overflow:auto;padding:15px;background:#202020;border:1px solid #555;border-radius:12px;box-shadow:0 8px 28px #0006}
    #body.up{top:auto;bottom:calc(100% + 6px)}#body.left{left:auto;right:0}
    #body[hidden]{display:none}strong{font-size:15px}label{display:flex;justify-content:space-between;align-items:center;margin:10px 0;gap:12px}
    input[type=number]{width:65px;background:#151515;color:#eee;border:1px solid #666;border-radius:5px;padding:3px 5px}
    input[type=checkbox]{accent-color:#7ca7ff}p{margin:10px 0;color:#bbb}#status{color:#b6cbff}.buttons{display:flex;gap:7px;flex-wrap:wrap}
    small{display:block;color:#aaa;margin-top:12px;font-size:11px}#save{background:#234578;border-color:#5580b8}
  </style>
  <button id="toggle" aria-expanded="false" aria-controls="body">轻量浏览</button>
  <section id="body" aria-label="Kimi 轻量浏览设置" hidden>
    <strong>Kimi 会话轻量浏览</strong>
    <p id="status" role="status">正在连接页面…</p>
    <label>启用按需渲染<input id="enabled" type="checkbox" checked></label>
    <label>常驻最近消息<input id="keep" type="number" min="1" max="200" value="20"></label>
    <label>每组常驻内容块<input id="blocks" type="number" min="1" max="200" value="20"></label>
    <label>闲置回收（分钟）<input id="idleMinutes" type="number" min="1" max="120" value="10"></label>
    <label>滚动到旧记录时恢复<input id="auto" type="checkbox" checked></label>
    <div class="buttons"><button id="save">应用设置</button><button id="recent">回到最新并回收</button></div>
    <p>历史数据按需读取，屏幕外仍保留轻量占位。</p>
    <div class="buttons"><button id="all">加载全部历史</button><button id="cancel" hidden>停止加载</button></div>
    <small>适配前端 0.39.1。回收浏览器渲染组件；Kimi 自身的原始消息缓存仍保留。关闭此开关可恢复原生界面。</small>
  </section>`;
  document.documentElement.append(host);
  const $ = id => shadow.getElementById(id);
  const action = command => window.dispatchEvent(new CustomEvent('kimi-lazy-action', { detail: command }));
  function apply(value) {
    for (const key of Object.keys(defaults)) $(key)[typeof defaults[key] === 'boolean' ? 'checked' : 'value'] = value[key];
    window.dispatchEvent(new CustomEvent('kimi-lazy-config', { detail: JSON.stringify(value) }));
  }
  const toggle = $('toggle'), body = $('body');
  let lastDragEnd = 0;
  function flipBody() {
    const r = toggle.getBoundingClientRect();
    body.classList.toggle('up', r.top + r.height / 2 > window.innerHeight / 2);
    body.classList.toggle('left', r.left + r.width / 2 > window.innerWidth / 2);
  }
  function setPos(left, top) {
    const r = host.getBoundingClientRect();
    const l = Math.min(Math.max(left, 4), Math.max(4, window.innerWidth - r.width - 4));
    const t = Math.min(Math.max(top, 4), Math.max(4, window.innerHeight - r.height - 4));
    host.style.right = 'auto';
    host.style.left = l + 'px';
    host.style.top = t + 'px';
    flipBody();
  }
  async function savePos() {
    if (!host.style.left) return;
    try { await chrome.storage.local.set({ kimiLazyPanelPos: { fx: parseFloat(host.style.left) / window.innerWidth, fy: parseFloat(host.style.top) / window.innerHeight } }); } catch { /* fixture / invalidated extension */ }
  }
  const drag = { id: -1, sx: 0, sy: 0, baseL: 0, baseT: 0, moved: false };
  toggle.addEventListener('pointerdown', e => {
    if (e.button > 0) return;
    const r = host.getBoundingClientRect();
    drag.id = e.pointerId; drag.sx = e.clientX; drag.sy = e.clientY; drag.baseL = r.left; drag.baseT = r.top; drag.moved = false;
    try { toggle.setPointerCapture(e.pointerId); } catch { /* synthetic events have no active pointer */ }
  });
  toggle.addEventListener('pointermove', e => {
    if (e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) { drag.moved = true; toggle.classList.add('dragging'); }
    setPos(drag.baseL + dx, drag.baseT + dy);
  });
  function endDrag(e) {
    if (e.pointerId !== drag.id) return;
    drag.id = -1;
    toggle.classList.remove('dragging');
    if (drag.moved) { drag.moved = false; lastDragEnd = Date.now(); savePos(); }
  }
  toggle.addEventListener('pointerup', endDrag);
  toggle.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', () => {
    if (host.style.left) { const r = host.getBoundingClientRect(); setPos(r.left, r.top); } else flipBody();
  });
  toggle.addEventListener('click', () => {
    if (Date.now() - lastDragEnd < 350) return;
    body.hidden = !body.hidden;
    toggle.setAttribute('aria-expanded', String(!body.hidden));
    flipBody();
    action('status');
  });
  flipBody();
  $('save').onclick = async () => {
    const value = {};
    for (const key of Object.keys(defaults)) {
      const input = $(key);
      if (typeof defaults[key] === 'boolean') value[key] = input.checked;
      else {
        if (!input.reportValidity()) return;
        value[key] = Number(input.value);
      }
    }
    try { await chrome.storage.local.set({ kimiLazySettings: value }); } catch { /* live setting still works */ }
    apply(value);
  };
  for (const key of ['recent', 'all', 'cancel']) $(key).onclick = () => action(key);
  window.addEventListener('kimi-lazy-status', event => {
    try {
      const s = JSON.parse(event.detail);
      const mounted = Number.isInteger(s.mounted) ? s.mounted : 0;
      const asleep = Number.isInteger(s.asleep) ? s.asleep : 0;
      $('status').textContent = s.error ? `已恢复原生界面：${String(s.error).slice(0,100)}` :
        !s.enabled ? '已关闭 · 使用 Kimi 原生渲染' : !s.attached ? '等待会话消息列表…' :
        `已渲染 ${mounted} 条 · 休眠 ${asleep} 条${s.fullHistory ? ' · 正在读取历史' : ''}`;
      $('cancel').hidden = !s.fullHistory;
      $('all').disabled = !!s.fullHistory || !s.hasMore || !s.enabled;
      $('all').textContent = s.hasMore ? '加载全部历史' : '历史已全部读取';
    } catch { /* Only bounded, aggregate status is accepted. */ }
  });
  (async () => {
    let saved = {}, pos = null;
    try {
      const all = await chrome.storage.local.get(['kimiLazySettings', 'kimiLazyPanelPos']);
      saved = all.kimiLazySettings || {};
      pos = all.kimiLazyPanelPos || null;
    } catch { /* fixture / invalidated extension */ }
    apply({ ...defaults, ...saved });
    if (pos && typeof pos.fx === 'number' && typeof pos.fy === 'number') setPos(pos.fx * window.innerWidth, pos.fy * window.innerHeight);
    action('status');
  })();
})();
