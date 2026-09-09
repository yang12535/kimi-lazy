/* Kimi Web adapter (Vue 3.5.x). Guarded by the known-build whitelist; fails open to native UI. */
(() => {
  'use strict';
  if (window.__KIMI_LAZY__ || !window.KimiLazyPolicy) return;
  // Known frontend builds: Kimi Web bundles shipped with kimi-code CLI 0.33.0–0.41.0.
  const BUILDS = new Set(['/assets/index-HU0LCM-X.js', '/assets/index-Bxn5yOTB.js', '/assets/index-CgXirkUy.js', '/assets/index-ClWTW3HX.js', '/assets/index-CvgiEu-R.js', '/assets/index-B-HzRssS.js', '/assets/index-yKYHPeXU.js', '/assets/index-BdL5hCoZ.js', '/assets/index-D-7nOosq.js', '/assets/index-HRJ6xRtC.js', '/assets/index-CiHMlsuo.js', '/assets/index--0t1wzw_.js', '/assets/index-BkUUBejk.js']);
  const { WindowPolicy } = window.KimiLazyPolicy;
  const names = new Set(['ChatPane', 'ActivityRun', 'TurnFold', 'ThinkingBlock']);
  let config = { enabled: true, keep: 20, blocks: 20, idleMinutes: 10, auto: true };
  let failed = '', serial = 0, route = location.pathname, fullHistory = false;
  let frame = 0, maintenance = 0, loadingTimer = 0, lastPaging = 0;
  const states = new Map(), patchedInstances = new WeakSet(), pending = new Set();
  const originals = new WeakMap();
  const fingerprints = new WeakMap();
  function fingerprint(value) {
    if (fingerprints.has(value)) return fingerprints.get(value);
    // Kimi's transcript turns are immutable; weak keys do not retain their payloads.
    const text = JSON.stringify(value);
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
    const result = `${text.length}:${h >>> 0}`;
    fingerprints.set(value, result);
    return result;
  }
  const idleMs = () => config.idleMinutes * 60000;
  const supported = () => Array.from(document.scripts).some(s => {
    try { return BUILDS.has(new URL(s.src).pathname); } catch { return false; }
  });
  const cls = v => typeof v?.props?.class === 'string' ? v.props.class.split(/\s+/) : [];
  const has = (v, name) => cls(v).includes(name);
  const fragment = v => typeof v?.type === 'symbol' && v.type.description === 'v-fgt';
  const children = v => Array.isArray(v?.children) ? v.children : [];
  const liveVNode = v => !!(v?.props?.streaming || v?.props?.live || v?.props?.tool?.status === 'running' ||
    v?.props?.items?.some?.(i => i?.tool?.status === 'running') || children(v).some(liveVNode));
  const liveKeys = list => new Set(list.flatMap((v, i) => liveVNode(v) ? [String(v.key ?? i)] : []));
  const copy = (v, changes = {}) => ({ ...v, ...changes, patchFlag: 0, dynamicChildren: null });
  // Vue will create/unmount these VNodes through its own renderer.
  const element = (template, props, kids) => ({
    ...template, __v_isVNode: true, __v_skip: true, type: 'div', props,
    key: props.key ?? null, ref: null, scopeId: null, slotScopeIds: null,
    children: kids, component: null, suspense: null, ssContent: null, ssFallback: null,
    dirs: null, transition: null, el: null, anchor: null, target: null, targetAnchor: null,
    shapeFlag: typeof kids === 'string' ? 9 : 17, patchFlag: 0,
    dynamicProps: null, dynamicChildren: null, appContext: null, ctx: null, memo: null
  });
  function mapTree(v, fn) {
    if (!v || typeof v !== 'object') return v;
    const hit = fn(v);
    if (hit !== v) return hit;
    const list = children(v);
    if (!list.length) return v;
    let changed = false;
    const mapped = list.map(c => { const n = mapTree(c, fn); changed ||= n !== c; return n; });
    return changed ? copy(v, { children: mapped }) : v;
  }
  function deopt(v) {
    if (!v || typeof v !== 'object' || !v.__v_isVNode) return v;
    return copy(v, Array.isArray(v.children) ? { children: v.children.map(deopt) } : {});
  }
  function group(state, name) {
    state.used.add(name);
    if (!state.groups.has(name)) state.groups.set(name, { policy: new WindowPolicy(), tokens: new Map() });
    return state.groups.get(name);
  }
  function restore(state, domain, id) {
    const g = state.groups.get(domain);
    if (!g) return;
    g.policy.touch(id, Date.now());
    queue(state);
  }
  function renderList(state, domain, list, keep, opts = {}) {
    const g = group(state, domain), now = Date.now();
    const ids = list.map((v, i) => String(v.key ?? i));
    g.policy.sync(ids, now, opts.signatures);
    g.tokens.clear();
    const protectedIds = opts.protectedIds || new Set();
    return list.map((v, i) => {
      const id = ids[i], record = g.policy.records.get(id);
      const token = `${state.id}-${domain}-${record.serial}`;
      g.tokens.set(token, id);
      const active = g.policy.wanted(id, i, keep, now, idleMs(), protectedIds);
      record.pinned = protectedIds.has(id);
      record.mounted = active;
      if (!active) {
        const text = opts.turns ? '较早的消息 · 点击或滚动到此处恢复' : '较早的工具 / 内容块 · 点击恢复';
        const placeholder = element(v, {
          class: 'kl-placeholder' + (opts.turns ? ' turn-anchor' : ''),
          'data-turn-id': opts.turns ? id : undefined,
          'data-kl-token': token, 'data-kl-sleeping': '1',
          style: { minHeight: `${Math.max(48, record.height)}px` },
          role: 'button', tabindex: 0,
          onClick: () => restore(state, domain, id),
          onKeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); restore(state, domain, id); } }
        }, text);
        return fragment(v) ? copy(v, { children: [placeholder] }) : placeholder;
      }
      let value = opts.process ? opts.process(v, id) : v;
      if (opts.turns) {
        let marked = false;
        return mapTree(value, n => {
          if (!marked && typeof n.type === 'string') {
            marked = true;
            return copy(n, { props: { ...n.props, 'data-kl-token': token } });
          }
          return n;
        });
      }
      // A stable wrapper gives each multi-root block a measurable scroll anchor.
      const wrapper = element(v, { class: 'kl-block', 'data-kl-token': token }, [value]);
      return fragment(v) ? copy(v, { children: [wrapper] }) : wrapper;
    });
  }
  function adapt(state, vnode) {
    if (state.path !== location.pathname) {
      state.path = location.pathname; state.groups.clear(); fullHistory = false; route = location.pathname;
    }
    const props = state.instance.props;
    state.used = new Set();
    if (state.name === 'ChatPane') {
      if (props.inspector || !Array.isArray(props.turns)) return vnode;
      const protectedIds = new Set();
      if (props.turnActive && props.turns.length) protectedIds.add(props.turns.at(-1).id);
      for (const turn of props.turns) {
        if (turn.tools?.some(t => t.status === 'running') || turn.blocks?.some(b => b.tool?.status === 'running')) protectedIds.add(turn.id);
      }
      vnode = mapTree(vnode, chat => {
        if (!has(chat, 'chat')) return chat;
        const list = children(chat).find(n => fragment(n) && children(n).length === props.turns.length &&
          children(n).every((v, i) => v.key === props.turns[i].id));
        if (!list) {
          if (props.turns.length) throw new Error('消息列表结构与适配版本不同');
          return chat;
        }
        const mapped = renderList(state, 'turns', children(list), config.keep, {
          turns: true, protectedIds, signatures: props.turns.map(fingerprint),
          process(v, id) {
            return mapTree(v, n => {
              if (!has(n, 'a-msg')) return n;
              return copy(n, { children: children(n).map(c => {
                if (!fragment(c) || !children(c).length || !children(c).every(fragment)) return c;
                return copy(c, { children: renderList(state, `turn:${id}`, children(c), config.blocks,
                  { protectedIds: liveKeys(children(c)) }) });
              }) });
            });
          }
        });
        return copy(chat, { props: { ...chat.props, 'data-kl-owner': state.id },
          children: children(chat).map(c => c === list ? copy(c, { children: mapped }) : c) });
      });
    } else {
      const bodyClass = { ActivityRun: 'ar-body', TurnFold: 'tf-body', ThinkingBlock: 'think-body' }[state.name];
      vnode = mapTree(vnode, body => {
        if (!has(body, bodyClass)) return body;
        // These versions normally keep collapsed bodies mounted with `inert`.
        if (body.props?.inert === true || body.props?.inert === '') return copy(body, { children: [] });
        return mapTree(copy(body), n => {
          if (!fragment(n) || !children(n).length || !children(n).every(fragment)) return n;
          return copy(n, { children: renderList(state, 'items', children(n), config.blocks,
            { protectedIds: liveKeys(children(n)) }) });
        });
      });
    }
    for (const name of state.groups.keys()) if (!state.used.has(name)) state.groups.delete(name);
    return vnode;
  }
  function wrap(instance, original) {
    if (originals.has(original)) return original;
    const state = { id: ++serial, instance, name: instance.type.__name, path: location.pathname, groups: new Map(), used: new Set() };
    states.set(instance.uid, state);
    const wrapped = function (...args) {
      const result = original.apply(this, args);
      // The previous tree may contain placeholders. Vue's compiler-generated block
      // fast path assumes its original topology, so a full diff is required here.
      if (!config.enabled || failed) return deopt(result);
      try { return adapt(state, result); }
      catch (error) { fail(error); return deopt(result); }
    };
    originals.set(wrapped, original);
    return wrapped;
  }
  function hook(instance) {
    if (!instance || !names.has(instance.type?.__name) || !supported()) return;
    if (patchedInstances.has(instance)) return;
    const descriptor = Object.getOwnPropertyDescriptor(instance, 'render');
    if (descriptor && !descriptor.configurable) return;
    patchedInstances.add(instance);
    let render = instance.render;
    if (typeof render === 'function') render = wrap(instance, render);
    // Observe the per-instance render assignment; leave Vue's setup contract intact.
    Object.defineProperty(instance, 'render', {
      configurable: true, enumerable: true,
      get() { return render; },
      set(next) { render = typeof next === 'function' ? wrap(instance, next) : next; }
    });
  }
  const setter = instance => {
    try { hook(instance); } catch (e) { fail(e); }
  };
  const setters = window.__VUE_INSTANCE_SETTERS__ ||= [];
  setters.push(setter);
  function scan(v, seen = new Set()) {
    if (!v || typeof v !== 'object' || seen.has(v)) return;
    seen.add(v);
    if (v.component) {
      hook(v.component);
      scan(v.component.subTree, seen);
    }
    for (const child of children(v)) scan(child, seen);
  }
  function scroller() { return document.querySelector('.chat-scroll'); }
  function anchor() {
    const scroll = scroller();
    if (!scroll) return null;
    const box = scroll.getBoundingClientRect();
    const bottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 80;
    for (const el of scroll.querySelectorAll('[data-kl-token]')) {
      const r = el.getBoundingClientRect();
      if (r.height > 0 && r.bottom > box.top + 2 && r.top < box.bottom) {
        return { scroll, bottom, token: el.dataset.klToken, offset: r.top - box.top, top: scroll.scrollTop };
      }
    }
    return { scroll, bottom, top: scroll.scrollTop };
  }
  function settle(saved) {
    if (!saved?.scroll.isConnected) return;
    if (saved.bottom) { saved.scroll.scrollTop = saved.scroll.scrollHeight; return; }
    const el = saved.token && Array.from(saved.scroll.querySelectorAll('[data-kl-token]')).find(e => e.dataset.klToken === saved.token);
    if (el) saved.scroll.scrollTop += el.getBoundingClientRect().top - saved.scroll.getBoundingClientRect().top - saved.offset;
    else saved.scroll.scrollTop = saved.top;
  }
  function queue(state) {
    if (!state || state.instance.isUnmounted) return;
    pending.add(state);
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const saved = anchor();
      const batch = [...pending]; pending.clear();
      for (const item of batch) if (!item.instance.isUnmounted) item.instance.proxy?.$forceUpdate();
      // Vue flushes its jobs in a microtask; anchor before the next paint.
      queueMicrotask(() => { settle(saved); status(); });
    });
  }
  function fail(error) {
    if (failed) return;
    failed = error?.message || '适配器出错';
    fullHistory = false;
    for (const state of states.values()) queue(state);
    console.warn('[Kimi Lazy] 已恢复原生渲染：', failed);
    status();
  }
  function observe(now = Date.now(), sweep = true) {
    for (const [uid, state] of states) if (state.instance.isUnmounted) states.delete(uid);
    const scroll = scroller();
    if (!scroll || !config.enabled || failed) return;
    const viewport = scroll.getBoundingClientRect();
    const elements = new Map(Array.from(scroll.querySelectorAll('[data-kl-token]'), e => [e.dataset.klToken, e]));
    let restoreBudget = 3;
    const selection = window.getSelection();
    for (const [uid, state] of states) {
      if (state.instance.isUnmounted) { states.delete(uid); continue; }
      let dirty = false;
      for (const g of state.groups.values()) {
        const protectedIds = new Set();
        for (const [id, record] of g.policy.records) if (record.pinned) protectedIds.add(id);
        for (const [token, id] of g.tokens) {
          const el = elements.get(token), r = g.policy.records.get(id);
          if (!el || !r) continue;
          const rect = el.getBoundingClientRect();
          const visible = document.visibilityState === 'visible' && rect.height > 0 && rect.bottom > viewport.top && rect.top < viewport.bottom && !el.closest('[inert]');
          let selected = el.contains(document.activeElement);
          if (!selection?.isCollapsed && selection?.rangeCount) {
            try { selected ||= selection.getRangeAt(0).intersectsNode(el); } catch { /* detached range */ }
          }
          if (r.mounted) {
            if (rect.height > 0) r.height = rect.height;
            if (visible || selected) { protectedIds.add(id); g.policy.touch(id, now); }
          } else if (config.auto && visible && restoreBudget > 0 && document.visibilityState === 'visible') {
            restoreBudget--; g.policy.touch(id, now); dirty = true;
          }
        }
        if (sweep) {
          g.policy.expire(now, idleMs(), protectedIds);
          g.policy.ids.forEach((id, index) => {
            const keep = state.name === 'ChatPane' && g === state.groups.get('turns') ? config.keep : config.blocks;
            if (g.policy.records.get(id).mounted && !g.policy.wanted(id, index, keep, now, idleMs(), protectedIds)) dirty = true;
          });
        }
      }
      if (dirty) queue(state);
    }
    pumpHistory();
    status();
  }
  function mainState() { return [...states.values()].find(s => s.name === 'ChatPane' && !s.instance.isUnmounted && !s.instance.props.inspector); }
  function pumpHistory() {
    if (route !== location.pathname) { fullHistory = false; return; }
    const state = mainState();
    if (!fullHistory || !state || !config.enabled || failed) return;
    const p = state.instance.props;
    if (p.loadingMoreError) { fullHistory = false; status(); return; }
    if (p.loadingMore || p.sessionLoading || Date.now() - lastPaging < 400) return;
    if (!p.hasMoreMessages) { fullHistory = false; status(); return; }
    lastPaging = Date.now();
    state.instance.emit('loadOlderMessages');
  }
  function status() {
    const main = mainState(), g = main?.groups.get('turns');
    let mounted = 0, asleep = 0;
    if (g) for (const r of g.policy.records.values()) r.mounted ? mounted++ : asleep++;
    window.dispatchEvent(new CustomEvent('kimi-lazy-status', { detail: JSON.stringify({
      supported: supported(), attached: !!main, enabled: config.enabled, error: failed,
      mounted, asleep, fullHistory, hasMore: !!main?.instance.props.hasMoreMessages,
      config, version: '0.1.1'
    }) }));
  }
  function configure(next) {
    const integer = (v, low, high, fallback) => Number.isFinite(Number(v)) ? Math.min(high, Math.max(low, Math.round(Number(v)))) : fallback;
    config = {
      enabled: typeof next.enabled === 'boolean' ? next.enabled : config.enabled,
      auto: typeof next.auto === 'boolean' ? next.auto : config.auto,
      keep: integer(next.keep ?? config.keep, 1, 200, 20),
      blocks: integer(next.blocks ?? config.blocks, 1, 200, 20),
      idleMinutes: integer(next.idleMinutes ?? config.idleMinutes, 1, 120, 10)
    };
    if (!config.enabled) fullHistory = false;
    for (const state of states.values()) queue(state);
    status();
  }
  window.addEventListener('kimi-lazy-config', e => {
    try { const data = JSON.parse(e.detail); if (data && typeof data === 'object') configure(data); } catch { /* invalid bridge input */ }
  });
  window.addEventListener('kimi-lazy-action', e => {
    if (e.detail === 'status') status();
    if (e.detail === 'all') { fullHistory = true; pumpHistory(); status(); }
    if (e.detail === 'cancel') { fullHistory = false; status(); }
    if (e.detail === 'recent') {
      fullHistory = false;
      const s = scroller(); if (s) s.scrollTop = s.scrollHeight;
      for (const state of states.values()) {
        for (const g of state.groups.values()) for (const r of g.policy.records.values()) r.touched = null;
        queue(state);
      }
    }
  });
  let scrollTimer = 0;
  document.addEventListener('scroll', e => {
    if (!e.target?.classList?.contains('chat-scroll') || scrollTimer) return;
    scrollTimer = setTimeout(() => { scrollTimer = 0; observe(Date.now(), false); }, 120);
  }, true);
  document.addEventListener('visibilitychange', () => observe());
  function start() {
    if (!supported()) { status(); return; }
    const style = document.createElement('style');
    style.textContent = '.kl-placeholder{box-sizing:border-box;display:flex;align-items:center;justify-content:center;padding:14px;border:1px dashed #7776;border-radius:10px;color:#999;cursor:pointer;font:13px/1.6 system-ui;overflow-anchor:none}.kl-placeholder:focus-visible{outline:2px solid #568efa}.kl-block{min-width:0}.kl-placeholder:hover{background:#8881}';
    document.head.append(style);
    scan(document.querySelector('#app')?._vnode);
    for (const state of states.values()) queue(state);
    maintenance = setInterval(() => {
      if (route !== location.pathname) {
        route = location.pathname; fullHistory = false;
        for (const [uid, state] of states) {
          if (state.instance.isUnmounted) states.delete(uid);
          else { state.groups.clear(); queue(state); }
        }
      }
      observe();
    }, 5000);
    loadingTimer = setInterval(pumpHistory, 500);
    status();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
  // Diagnostic surface deliberately returns counts only, never conversation contents.
  window.__KIMI_LAZY__ = Object.freeze({
    configure, sweep: observe,
    stats: () => ({ states: states.size, error: failed, enabled: config.enabled,
      groups: [...states.values()].filter(s => !s.instance.isUnmounted).map(s => ({ name: s.name,
        counts: [...s.groups.values()].map(g => ({ total: g.policy.records.size,
          mounted: [...g.policy.records.values()].filter(r => r.mounted).length })) })) }),
    stop: () => { configure({ enabled: false }); clearInterval(maintenance); clearInterval(loadingTimer); }
  });
})();
