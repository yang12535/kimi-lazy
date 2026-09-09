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
    :host{position:fixed;right:max(10px,env(safe-area-inset-right));top:max(62px,env(safe-area-inset-top));max-width:calc(100vw - 20px);z-index:2147483000;font:13px/1.55 system-ui;color:#eee;color-scheme:dark}
    *{box-sizing:border-box}button,input{font:inherit}button{min-height:44px;touch-action:manipulation;cursor:pointer;border:1px solid #555;border-radius:7px;padding:6px 10px;background:#292929;color:#eee}
    button:hover{background:#393939}button:focus-visible,input:focus-visible{outline:2px solid #7ca7ff;outline-offset:2px}
    #toggle{box-shadow:0 2px 12px #0005;background:#222e;backdrop-filter:blur(6px)}
    #body{margin-top:6px;width:300px;max-width:calc(100vw - 20px);max-height:70vh;max-height:calc(100dvh - 126px);overflow:auto;overscroll-behavior:contain;padding:15px;background:#202020;border:1px solid #555;border-radius:12px;box-shadow:0 8px 28px #0006}
    #body[hidden]{display:none}strong{font-size:15px}label{display:flex;justify-content:space-between;align-items:center;margin:10px 0;gap:12px}
    input[type=number]{width:65px;background:#151515;color:#eee;border:1px solid #666;border-radius:5px;padding:8px 5px;min-height:44px;font-size:16px}
    input[type=checkbox]{width:22px;height:22px;flex-shrink:0;accent-color:#7ca7ff}p{margin:10px 0;color:#bbb}#status{color:#b6cbff}.buttons{display:flex;gap:7px;flex-wrap:wrap}
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
    <div class="buttons"><button id="save">应用设置</button><button id="recent">回到最新并回收</button></div>
    <p>历史数据按需读取，屏幕外仍保留轻量占位。</p>
    <div class="buttons"><button id="all">加载全部历史</button><button id="cancel" hidden>停止加载</button></div>
    <small>适配前端 0.39.1。回收浏览器渲染组件；Kimi 自身的原始消息缓存仍保留。关闭此开关可恢复原生界面。</small>
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
  $('toggle').onclick = () => {
    $('body').hidden = !$('body').hidden;
    $('toggle').setAttribute('aria-expanded', String(!$('body').hidden));
    action('status');
  };
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
        `已渲染 ${mounted} 条 · 休眠 ${asleep} 条${s.fullHistory ? ' · 正在读取历史' : ''}`;
      $('cancel').hidden = !s.fullHistory;
      $('all').disabled = !!s.fullHistory || !s.hasMore || !s.enabled;
      $('all').textContent = s.hasMore ? '加载全部历史' : '历史已全部读取';
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
