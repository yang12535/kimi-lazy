/** Real-browser regressions shared by the userscript and extension panels. */
export async function panelChecks(send, sessionId, kind) {
  const checks = [];
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}, sessionId);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + r.exceptionDetails.exception?.description);
    return r.result.value;
  };
  const check = (name, ok, detail) => {
    checks.push({name: `${kind}: ${name}`, pass: !!ok, detail});
    if (!ok) throw new Error(JSON.stringify(checks.at(-1)));
  };
  const resize = async (width, height) => {
    await send('Emulation.setDeviceMetricsOverride', {width, height, deviceScaleFactor: 1, mobile: false}, sessionId);
    await evaluate('new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))');
  };
  await resize(320, 640);
  await evaluate(`window.panelTest = {
    host: document.getElementById('kimi-lazy-panel'),
    drag(left, top) {
      const t=this.host.shadowRoot.getElementById('toggle'), r=this.host.getBoundingClientRect();
      const p=(type,x,y)=>t.dispatchEvent(new PointerEvent(type,{pointerId:71,button:0,clientX:x,clientY:y,bubbles:true}));
      p('pointerdown',r.left+10,r.top+10);p('pointermove',left+10,top+10);p('pointerup',left+10,top+10);
    },
    rect() { return this.host.getBoundingClientRect().toJSON(); },
    click(detail=0) { this.host.shadowRoot.getElementById('toggle').dispatchEvent(new MouseEvent('click',{bubbles:true,detail})); },
    body() { return this.host.shadowRoot.getElementById('body'); }
  }`);
  for (const [left, top] of [[110, 295], [-500, -500], [900, 900]]) {
    const data = await evaluate(`(() => {panelTest.drag(${left},${top}); if(panelTest.body().hidden)panelTest.click(); return {toggle:panelTest.rect(),body:panelTest.body().getBoundingClientRect().toJSON()};})()`);
    check(`expanded panel stays visible at ${left},${top}`, data.body.left >= 3.5 && data.body.top >= 3.5 && data.body.right <= 316.5 && data.body.bottom <= 636.5, data);
  }
  await evaluate('panelTest.drag(210, 450)');
  const before = await evaluate('panelTest.rect()');
  await resize(640, 320);
  const rotated = await evaluate('panelTest.rect()');
  check('rotation reapplies both viewport fractions', Math.abs(rotated.left - before.left * 2) < 1 && Math.abs(rotated.top - before.top / 2) < 1, {before, rotated});
  await resize(160, 160);
  await resize(320, 640);
  const restored = await evaluate('panelTest.rect()');
  check('shrink then expand retains the unclamped position', Math.abs(restored.left - before.left) < 1 && Math.abs(restored.top - before.top) < 1, {before, restored});
  const keyboard = await evaluate(`(() => {panelTest.drag(70,100); const was=panelTest.body().hidden; panelTest.click(1); const suppressed=panelTest.body().hidden===was; panelTest.click(0); return {suppressed,keyboard:panelTest.body().hidden!==was};})()`);
  check('drag click suppressed while immediate keyboard click works', keyboard.suppressed && keyboard.keyboard, keyboard);
  // Model resolved CSS env() insets; actual notched-device rendering remains device-specific.
  const safe = await evaluate(`(() => { const probe=panelTest.host.shadowRoot.querySelector('div[style]'); probe.style.padding='30px 24px 28px 22px'; panelTest.drag(-999,-999); const first=panelTest.rect(); panelTest.drag(999,999); const last=panelTest.rect(); return {first,last}; })()`);
  check('clamping respects resolved safe-area padding on all sides', safe.first.left >= 22 && safe.first.top >= 30 && safe.last.right <= 296 && safe.last.bottom <= 612, safe);
  const saved = await evaluate(kind === 'extension' ? 'window.extensionStorage' : `JSON.parse(localStorage.getItem('kimi-lazy.userscript.pos.v1'))`);
  check('finite position persisted', kind === 'extension' ? Number.isFinite(saved['kimiLazyPanelPos:' + new URL(await evaluate('location.href')).origin]?.fx) : Number.isFinite(saved?.fx), saved);
  const modes = await evaluate(`(() => {
    const root=panelTest.host.shadowRoot;
    const emit=s=>window.dispatchEvent(new CustomEvent('kimi-lazy-status',{detail:JSON.stringify({attached:true,enabled:true,mounted:0,asleep:151,hasMore:true,...s})}));
    emit({mode:'adapter',unit:'turns'});
    const adapter=!root.getElementById('tuning').hidden && !root.getElementById('keep').disabled && root.getElementById('status').textContent.includes('条消息');
    emit({mode:'native',unit:'folds'});
    const native=root.getElementById('tuning').hidden && root.getElementById('keep').disabled && root.getElementById('status').textContent.includes('151 个折叠区');
    emit({mode:'native',unit:'folds',enabled:false});
    const disabled=root.getElementById('tuning').hidden;
    emit({mode:'adapter',unit:'turns',asleep:0});
    const empty=!root.getElementById('tuning').hidden && !root.getElementById('keep').disabled;
    emit({mode:'native',unit:'folds',error:'fixture incompatibility'});
    const failed=root.getElementById('native-hint').hidden && root.getElementById('status').textContent.includes('已恢复原生界面') && root.getElementById('all').disabled;
    return {adapter,native,disabled,empty,failed};
  })()`);
  check('actual window mode controls labels and tuning, including disabled and empty chats', Object.values(modes).every(Boolean), modes);
  return checks;
}
