const { test } = require('node:test');
const assert = require('node:assert/strict');
const { WindowPolicy } = require('../src/core/policy.js');
test('latest window and a ten-minute lease restore/expire independently', () => {
  const p = new WindowPolicy();
  const ids = Array.from({length:100}, (_,i)=>`t${i}`);
  p.sync(ids, 0);
  assert.equal(ids.filter((id,i)=>p.wanted(id,i,20,0,600000)).length,20);
  p.touch('t0',100);
  assert.equal(p.wanted('t0',0,20,600099,600000),true);
  assert.equal(p.wanted('t0',0,20,600100,600000),false);
  assert.equal(p.wanted('t99',99,20,999999,600000),true);
});
test('visible/focused record is protected even after idle timeout', () => {
  const p = new WindowPolicy();p.sync(['a','b'],0);
  p.records.get('a').mounted=true;p.touch('a',0);
  p.expire(900000,600000,new Set(['a']));
  assert.equal(p.wanted('a',0,1,900000,600000),true);
});
test('pagination keeps leases by ID and removes discarded session metadata', () => {
  const p = new WindowPolicy();p.sync(['b','c'],0);p.touch('b',10);
  const serial=p.records.get('b').serial;
  p.sync(['a','b','c'],20);
  assert.equal(p.records.get('b').serial,serial);
  assert.equal(p.wanted('b',1,1,30,600000),true);
  p.sync(['new'],40);
  assert.equal(p.records.size,1);assert.equal(p.records.has('b'),false);
});
test('an updated mounted message restarts its idle lease', () => {
  const p = new WindowPolicy(); p.sync(['a','b'],0,['old','b']);
  p.records.get('a').mounted=true; p.touch('a',0);
  p.sync(['a','b'],590000,['changed','b']);
  assert.equal(p.wanted('a',0,1,600001,600000),true);
  assert.equal(p.wanted('a',0,1,1190000,600000),false);
});
