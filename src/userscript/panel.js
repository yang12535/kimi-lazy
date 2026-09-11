(() => {
  'use strict';
  const BUILDS = new Set(['/assets/index-HU0LCM-X.js', '/assets/index-Bxn5yOTB.js', '/assets/index-CgXirkUy.js', '/assets/index-ClWTW3HX.js', '/assets/index-CvgiEu-R.js', '/assets/index-B-HzRssS.js', '/assets/index-yKYHPeXU.js', '/assets/index-BdL5hCoZ.js', '/assets/index-D-7nOosq.js', '/assets/index-HRJ6xRtC.js', '/assets/index-CiHMlsuo.js', '/assets/index--0t1wzw_.js', '/assets/index-BkUUBejk.js']);
  if (!Array.from(document.scripts).some(s => {
    try { return BUILDS.has(new URL(s.src).pathname); } catch { return false; }
  })) return;
  if (document.getElementById('kimi-lazy-panel')) return;
  const host = document.createElement('div');
  host.id = 'kimi-lazy-panel';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>
    :host{position:fixed;right:max(10px,env(safe-area-inset-right));top:max(62px,env(safe-area-inset-top));max-width:calc(100vw - 20px);z-index:2147483000;font:13px/1.55 system-ui;color:#eee;color-scheme:dark;width:max-content}
    *{box-sizing:border-box}button,input{font:inherit}button{min-height:44px;touch-action:manipulation;cursor:pointer;border:1px solid #555;border-radius:7px;padding:6px 10px;background:#292929;color:#eee}
    button:hover{background:#393939}button:focus-visible,input:focus-visible{outline:2px solid #7ca7ff;outline-offset:2px}
    #toggle{box-shadow:0 2px 12px #0005;background:#222e;backdrop-filter:blur(6px);touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
    #toggle.dragging{cursor:grabbing;background:#393939}
    #body{position:absolute;top:calc(100% + 6px);left:0;width:300px;max-width:calc(100vw - 20px);max-height:70vh;max-height:calc(100dvh - 126px);overflow:auto;overscroll-behavior:contain;padding:15px;background:#202020;border:1px solid #555;border-radius:12px;box-shadow:0 8px 28px #0006}
    #body[hidden]{display:none}strong{font-size:15px}label{display:flex;justify-content:space-between;align-items:center;margin:10px 0;gap:12px}
    input[type=number]{width:65px;background:#151515;color:#eee;border:1px solid #666;border-radius:5px;padding:8px 5px;min-height:44px;font-size:16px}
    input[type=checkbox]{width:22px;height:22px;flex-shrink:0;accent-color:#7ca7ff}input:disabled{opacity:.45}p{margin:10px 0;color:#bbb}#status{color:#b6cbff}.buttons{display:flex;gap:7px;flex-wrap:wrap}
    small{display:block;color:#aaa;margin-top:12px;font-size:11px}#save{background:#234578;border-color:#5580b8}
  </style>
  <button id="toggle" aria-expanded="false" aria-controls="body">轻量浏览</button>
  <section id="body" aria-label="Kimi 轻量浏览设置" hidden>
    <strong>Kimi 会话轻量浏览</strong>
    <p id="status" role="status">正在连接页面…</p><p id="notice" role="status" hidden></p>
    <label>启用按需渲染<input id="enabled" type="checkbox" checked></label>
    <label>常驻最近消息<input id="keep" type="number" min="1" max="200" value="20"></label>
    <label>每组常驻内容块<input id="blocks" type="number" min="1" max="200" value="20"></label>
    <label>闲置回收（分钟）<input id="idleMinutes" type="number" min="1" max="120" value="10"></label>
    <label>滚动到旧记录时恢复<input id="auto" type="checkbox" checked></label>
    <p id="native-hint" hidden>0.42.0+ 的消息与内容块窗口由 Kimi 原生管理，以上四项设置暂不生效；折叠内容回收仍自动进行。</p>
    <div class="buttons"><button id="save">应用设置</button><button id="recent">回到最新并回收</button></div>
    <p>历史数据按需读取，屏幕外仍保留轻量占位。</p>
    <div class="buttons"><button id="all">加载全部历史</button><button id="cancel" hidden>停止加载</button></div>
    <small>仅在已核对的前端构建启用。回收浏览器渲染组件；Kimi 自身的原始消息缓存仍保留。关闭此开关可恢复原生界面。</small>
  </section>`;
  document.documentElement.append(host);
  const $ = id => shadow.getElementById(id);
  function notice(text) { $('notice').textContent = text; $('notice').hidden = !text; }
  notice(storageNotice);
  let connected = false;
  const action = command => window.dispatchEvent(new CustomEvent('kimi-lazy-action', { detail: command }));
  function apply(value) {
    for (const key of Object.keys(defaults)) $(key)[typeof defaults[key] === 'boolean' ? 'checked' : 'value'] = value[key];
    window.dispatchEvent(new CustomEvent('kimi-lazy-config', { detail: JSON.stringify(value) }));
  }
  const toggle = $('toggle'), body = $('body');
  const POS_KEY = 'kimi-lazy.userscript.pos.v1';
  let lastDragEnd = 0, position = null;
  // Resolve env() through CSS so dragging and restoring retain mobile safe areas.
  const safeArea = document.createElement('div');
  safeArea.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  shadow.append(safeArea);
  function bounds() {
    const s = getComputedStyle(safeArea);
    return { left: Math.max(4, parseFloat(s.paddingLeft) || 0), top: Math.max(4, parseFloat(s.paddingTop) || 0),
      right: window.innerWidth - Math.max(4, parseFloat(s.paddingRight) || 0),
      bottom: window.innerHeight - Math.max(4, parseFloat(s.paddingBottom) || 0) };
  }
  const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
  const validPos = pos => pos && Number.isFinite(pos.fx) && Number.isFinite(pos.fy);
  function flipBody() {
    if (body.hidden) return;
    const r = host.getBoundingClientRect(), b = bounds();
    const above = Math.max(0, r.top - b.top - 6), below = Math.max(0, b.bottom - r.bottom - 6);
    const up = above > below;
    body.style.maxWidth = Math.max(0, b.right - b.left) + 'px';
    body.style.maxHeight = (up ? above : below) + 'px';
    body.style.right = 'auto'; body.style.bottom = 'auto';
    const size = body.getBoundingClientRect();
    const preferredLeft = r.left + r.width / 2 > window.innerWidth / 2 ? r.right - size.width : r.left;
    body.style.left = (clamp(preferredLeft, b.left, b.right - size.width) - r.left) + 'px';
    body.style.top = (up ? -size.height - 6 : r.height + 6) + 'px';
  }
  function setPos(left, top) {
    const r = host.getBoundingClientRect(), b = bounds();
    host.style.right = 'auto';
    host.style.left = clamp(left, b.left, b.right - r.width) + 'px';
    host.style.top = clamp(top, b.top, b.bottom - r.height) + 'px';
    flipBody();
  }
  function restorePosition(pos) {
    if (!validPos(pos)) return;
    position = { fx: pos.fx, fy: pos.fy };
    setPos(position.fx * window.innerWidth, position.fy * window.innerHeight);
  }
  function savePos() {
    if (!host.style.left) return;
    position = { fx: parseFloat(host.style.left) / window.innerWidth, fy: parseFloat(host.style.top) / window.innerHeight };
    try { localStorage.setItem(POS_KEY, JSON.stringify(position)); } catch { /* position persistence is optional */ }
  }
  function restorePos() {
    try { restorePosition(JSON.parse(localStorage.getItem(POS_KEY) || 'null')); } catch { /* storage is optional */ }
  }
  const drag = { id: -1, sx: 0, sy: 0, baseL: 0, baseT: 0, moved: false };
  toggle.addEventListener('pointerdown', e => {
    if (e.button > 0 || drag.id !== -1) return;
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
  toggle.addEventListener('lostpointercapture', endDrag);
  window.addEventListener('resize', () => {
    if (position) restorePosition(position);
    else { const r = host.getBoundingClientRect(); setPos(r.left, r.top); }
  });
  toggle.addEventListener('click', e => {
    if (e.detail !== 0 && Date.now() - lastDragEnd < 350) return;
    body.hidden = !body.hidden;
    toggle.setAttribute('aria-expanded', String(!body.hidden));
    flipBody();
    action('status');
  });
  restorePos();
  new ResizeObserver(flipBody).observe(body);
  flipBody();
  $('save').onclick = () => {
    const value = {};
    for (const key of Object.keys(defaults)) {
      const input = $(key);
      if (typeof defaults[key] === 'boolean') value[key] = input.checked;
      else {
        if (!input.reportValidity()) return;
        value[key] = Number(input.value);
      }
    }
    apply(value);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(value))); notice('设置已保存（仅当前网站）。'); }
    catch { notice('设置已生效，但浏览器禁止存储；刷新后不会保留。'); }
  };
  for (const key of ['recent', 'all', 'cancel']) $(key).onclick = () => action(key);
  window.addEventListener('kimi-lazy-status', event => {
    try {
      const s = JSON.parse(event.detail);
      connected = !!s.attached;
      const mounted = Number.isInteger(s.mounted) ? s.mounted : 0;
      const asleep = Number.isInteger(s.asleep) ? s.asleep : 0;
      $('status').textContent = s.error ? `已恢复原生界面：${String(s.error).slice(0,100)}` :
        !s.enabled ? '已关闭 · 使用 Kimi 原生渲染' : !s.attached ? '等待会话消息列表…' :
        `已渲染 ${mounted} ${s.unit === 'blocks' ? '块' : '条'} · 休眠 ${asleep} ${s.unit === 'blocks' ? '块' : '条'}${s.fullHistory ? ' · 正在读取历史' : ''}`;
      $('cancel').hidden = !s.fullHistory;
      $('all').disabled = !!s.fullHistory || !s.hasMore || !s.enabled;
      $('all').textContent = s.hasMore ? '加载全部历史' : '历史已全部读取';
      // On 0.42.0+ (blocks unit) upstream windows everything list-like natively;
      // the four tuning knobs only apply to the ≤0.41.x adapter-managed windows.
      const native = s.unit === 'blocks' && !s.error && !!s.enabled && !!s.attached;
      for (const key of ['keep', 'blocks', 'idleMinutes', 'auto']) $(key).disabled = native;
      $('native-hint').hidden = !native;
    } catch { /* Only bounded, aggregate status is accepted. */ }
  });
  apply(initial);
  action('status');
  // Some script managers isolate page objects despite @grant none.
  // Report this explicitly instead of claiming an active rendering adapter.
  let attempts = 0;
  const connectionCheck = setInterval(() => {
    action('status');
    if (connected || ++attempts >= 15) clearInterval(connectionCheck);
    if (!connected && document.querySelector('.chat')) {
      $('status').textContent = document.querySelector('#app')?._vnode
        ? '未接入消息组件：页面结构可能已变化，保持原生界面。'
        : '无法访问页面组件：请使用页面环境运行脚本，然后刷新。';
    }
  }, 2000);
})();
