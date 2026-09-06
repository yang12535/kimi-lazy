/* Small metadata-only lease cache. No messages, VNodes or DOM nodes are stored. */
(function (root) {
  'use strict';
  class WindowPolicy {
    constructor() { this.records = new Map(); this.serial = 0; this.ids = []; }
    sync(ids, now, signatures) {
      this.ids = ids;
      const present = new Set(ids);
      for (const id of this.records.keys()) if (!present.has(id)) this.records.delete(id);
      for (const id of ids) if (!this.records.has(id)) {
        this.records.set(id, { serial: ++this.serial, touched: null, height: 64, mounted: false });
      }
      if (signatures) ids.forEach((id, i) => {
        const r = this.records.get(id);
        if (r.signature !== undefined && r.signature !== signatures[i] && r.mounted) r.touched = now;
        r.signature = signatures[i];
      });
    }
    touch(id, now) { const r = this.records.get(id); if (r) r.touched = now; }
    wanted(id, index, keep, now, idleMs, protectedIds = new Set()) {
      const r = this.records.get(id);
      return index >= this.ids.length - keep || protectedIds.has(id) ||
        (r && r.touched !== null && now - r.touched < idleMs);
    }
    expire(now, idleMs, protectedIds = new Set()) {
      for (const [id, r] of this.records) {
        if (protectedIds.has(id) && r.mounted) r.touched = now;
        else if (r.touched !== null && now - r.touched >= idleMs) r.touched = null;
      }
    }
  }
  if (typeof module === 'object' && module.exports) module.exports = { WindowPolicy };
  else root.KimiLazyPolicy = Object.freeze({ WindowPolicy });
})(globalThis);
