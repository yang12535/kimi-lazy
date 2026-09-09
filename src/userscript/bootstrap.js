(() => {
  'use strict';
  if (window.top !== window.self) return;
  // Known frontend builds: Kimi Web bundles shipped with kimi-code CLI 0.33.0–0.42.0.
  const BUILDS = new Set(['/assets/index-HU0LCM-X.js', '/assets/index-Bxn5yOTB.js', '/assets/index-CgXirkUy.js', '/assets/index-ClWTW3HX.js', '/assets/index-CvgiEu-R.js', '/assets/index-B-HzRssS.js', '/assets/index-yKYHPeXU.js', '/assets/index-BdL5hCoZ.js', '/assets/index-D-7nOosq.js', '/assets/index-HRJ6xRtC.js', '/assets/index-CiHMlsuo.js', '/assets/index--0t1wzw_.js', '/assets/index-BkUUBejk.js']);
  const STORAGE_KEY = 'kimi-lazy.userscript.settings.v1';
  const defaults = { enabled: true, keep: 20, blocks: 20, idleMinutes: 10, auto: true };
  function normalize(value) {
    const result = { ...defaults };
    if (!value || typeof value !== 'object') return result;
    for (const key of ['enabled', 'auto']) if (typeof value[key] === 'boolean') result[key] = value[key];
    for (const key of ['keep', 'blocks', 'idleMinutes']) {
      const n = Number(value[key]);
      if (Number.isInteger(n) && n >= 1 && n <= (key === 'idleMinutes' ? 120 : 200)) result[key] = n;
    }
    return result;
  }
  let storageNotice = '', launched = false, observer;
  let initial = { ...defaults };
  function launch() {
    if (launched) return;
    launched = true;
    observer?.disconnect();
    if (window.__KIMI_LAZY__ || document.getElementById('kimi-lazy-panel')) return;
    try { initial = normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')); }
    catch { storageNotice = '无法读取已存设置，本次使用默认值。'; }
    /* BUNDLE_CORE */
    // Apply preferences before Vue gets its first opportunity to mount.
    window.__KIMI_LAZY__?.configure(initial);
    function mountPanel() {
      /* BUNDLE_PANEL */
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountPanel, { once: true });
    else mountPanel();
  }
  function detect() {
    if (Array.from(document.scripts).some(script => {
      try { return BUILDS.has(new URL(script.src).pathname); } catch { return false; }
    })) launch();
  }
  detect();
  if (!launched && document.readyState === 'loading') {
    observer = new MutationObserver(detect);
    observer.observe(document, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { detect(); observer.disconnect(); }, { once: true });
  }
})();
