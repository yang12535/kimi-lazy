const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../dist/kimi-lazy.user.js'), 'utf8');

function page(scripts = [], readyState = 'loading', frame = false) {
  const events = new Map();
  let observed = 0, disconnected = 0;
  const document = { scripts: scripts.map(src => ({ src })), readyState,
    addEventListener: (name, fn) => events.set(name, fn) };
  const window = {}; window.self = window; window.top = frame ? {} : window;
  const context = vm.createContext({ window, document, URL,
    MutationObserver: class {
      observe() { observed++; }
      disconnect() { disconnected++; }
    }
  });
  vm.runInContext(source, context);
  return { window, document, events, counts: () => ({ observed, disconnected }) };
}

test('unrelated pages stop detection at DOMContentLoaded without touching Vue or storage', () => {
  const p = page(['https://example.net/assets/app.js']);
  assert.equal(p.counts().observed, 1);
  p.events.get('DOMContentLoaded')();
  assert.equal(p.counts().disconnected, 1);
  assert.equal(p.window.__VUE_INSTANCE_SETTERS__, undefined);
  assert.equal(p.window.KimiLazyPolicy, undefined);
});
test('late injection on unrelated or unsupported builds leaves no observer or adapter', () => {
  for (const url of ['https://example.net/app.js', 'http://host:123/assets/index-new-build.js']) {
    const p = page([url], 'complete');
    assert.equal(p.counts().observed, 0);
    assert.equal(p.events.size, 0);
    assert.equal(p.window.__KIMI_LAZY__, undefined);
  }
});
test('subframes are skipped even if a manager ignores @noframes', () => {
  const p = page(['http://host:123/assets/index--0t1wzw_.js'], 'loading', true);
  assert.equal(p.counts().observed, 0);
  assert.equal(p.events.size, 0);
});
test('shipped bundle whitelists both known frontend builds explicitly', () => {
  assert.match(source, /\/assets\/index--0t1wzw_\.js/);
  assert.match(source, /\/assets\/index-BkUUBejk\.js/);
});
test('single file targets all HTTP(S) hosts and has no privileged API or remote dependency', () => {
  assert.match(source, /^\/\/ @match\s+\*:\/\/\*\/\*$/m);
  assert.match(source, /^\/\/ @grant\s+none$/m);
  assert.match(source, /^\/\/ @run-at\s+document-start$/m);
  assert.doesNotMatch(source, /chrome\.storage|GM_getValue|GM_setValue|^\/\/ @require/m);
});
