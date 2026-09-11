#!/usr/bin/env node
/**
 * 跑 kimi-lazy 的 全量夹具浏览器测试（无头 Chrome/Chromium + CDP）。
 *
 * 用法: node fixture_check.mjs <repoDir> <outDir>
 * 流程: 构建夹具与用户脚本 → 起静态服务 → CDP 驱动无头浏览器打开夹具页
 *       → 等待 全量结果 → 截图 + 写 <outDir>/cdp-report.json
 * 退出码: 0 = 全部完成且通过；1 = 有失败/超时；2 = 环境错误。
 * 环境变量: CHROME_BIN 指定浏览器路径，默认 /usr/bin/chromium。
 */
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync, rmSync, mkdtempSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import {panelChecks} from './panel_checks.mjs';

const [repoDir, outDir] = process.argv.slice(2);
if (!repoDir || !outDir) { console.error('usage: fixture_check.mjs <repoDir> <outDir>'); process.exit(2); }

const CHROME = process.env.CHROME_BIN || '/usr/bin/chromium';
const profile = mkdtempSync(path.join(os.tmpdir(), 'kimi-lazy-fixture-'));
mkdirSync(outDir, {recursive: true});
const PORT = await new Promise(resolve => {
  const socket = net.createServer();
  socket.listen(0, '127.0.0.1', () => { const port=socket.address().port; socket.close(() => resolve(port)); });
});
const resultsFile = path.join(repoDir, 'tests', 'last-browser-result.json');
try { rmSync(resultsFile, { force: true }); } catch {}

console.log('[1/4] 构建夹具与用户脚本...');
execFileSync('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: repoDir, stdio: 'inherit' });
execFileSync('node', ['tests/build.cjs'], { cwd: repoDir, stdio: 'inherit' });
execFileSync('python3', ['scripts/build.py'], { cwd: repoDir, stdio: 'inherit' });

console.log('[2/4] 起静态服务与无头浏览器...');
const die = (what, err) => { console.error(`环境错误：${what} 启动失败 — ${err?.message || err}`); process.exit(2); };
const server = spawn('python3', ['tests/serve.py', '--port', String(PORT)], { cwd: repoDir, stdio: 'ignore' });
server.on('error', e => die('静态服务(python3)', e));
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
chrome.on('error', e => die(`浏览器(${CHROME})`, e));
process.on('exit', () => { try { chrome.kill(); server.kill(); } catch {} });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const port = readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0];
      const r = await fetch(`http://127.0.0.1:${port}/json/version`);
      return (await r.json()).webSocketDebuggerUrl;
    } catch { await sleep(500); }
  }
  throw new Error('chromium CDP 端口未就绪');
}

const ws = new WebSocket(await wsUrl());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0;
const pending = new Map();
ws.onmessage = ev => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
};
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = ++seq; pending.set(id, { res, rej });
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
});

console.log('[3/4] 打开夹具页...');
const { targetId } = await send('Target.createTarget', { url: `http://127.0.0.1:${PORT}/fixture.html` });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);

let last = -1, stale = 0, done = false;
for (let i = 0; i < 120 && !done; i++) {
  await sleep(1000);
  try {
    const { result } = await send('Runtime.evaluate', {
      expression: '({count: window.fixtureTestResults?.length ?? -1, done: window.fixtureTestsDone === true})',
      returnByValue: true,
    }, sessionId);
    const n = result.value?.count ?? -1;
    done = result.value?.done === true;
    stale = n === last ? stale + 1 : 0;
    last = n;
    if (stale >= 20) break; // 20 秒无进展视为卡死（某项 check 抛错后结果数不再增长）
  } catch { /* 页面导航中 */ }
}

console.log('[4/4] 收集结果...');
let report = { total: 0, passed: 0, failed: ['无结果：夹具页未产出 fixtureTestResults'] };
try {
  const { result } = await send('Runtime.evaluate', {
    expression: `JSON.stringify({results: window.fixtureTestResults || [], stats: window.__KIMI_LAZY__ ? window.__KIMI_LAZY__.stats() : null, error: window.__KIMI_LAZY__ ? window.__KIMI_LAZY__.stats().error : 'adapter missing'})`,
    returnByValue: true,
  }, sessionId);
  const data = JSON.parse(result.value);
  const failed = data.results.filter(r => !r.pass).map(r => r.name);
  report = { completed: done, total: data.results.length, passed: data.results.length - failed.length, failed, error: data.error, stats: data.stats ? { states: data.stats.states, groups: data.stats.groups?.length } : null };
} catch (e) {
  report.failed = [`CDP 收集失败: ${e.message}`];
}
try {
  const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(path.join(outDir, 'cdp-fixture.png'), Buffer.from(shot.data, 'base64'));
  report.screenshot = 'cdp-fixture.png';
} catch {}
if (existsSync(resultsFile)) {
  try { report.serverPosted = JSON.parse(readFileSync(resultsFile, 'utf8')).results?.length ?? null; } catch {}
}
try {
  if (!report.completed || report.failed.length) throw new Error('main fixture did not complete successfully');
  report.panelChecks = await panelChecks(send, sessionId, 'userscript');
  // A reload must also pass when the previous run persisted an edge position.
  await send('Page.navigate', {url: `http://127.0.0.1:${PORT}/fixture.html`}, sessionId);
  let repeat;
  for (let i=0; i<150; i++) {
    await sleep(100);
    const {result} = await send('Runtime.evaluate', {expression: '({done: window.fixtureTestsDone===true, results: window.fixtureTestResults || []})', returnByValue:true}, sessionId);
    repeat=result.value;
    if(repeat?.done) break;
  }
  if (!repeat?.done || repeat.results.some(r=>!r.pass)) throw new Error('persisted-position fixture rerun failed: '+JSON.stringify(repeat));
  report.repeatTotal=repeat.results.length;
  // CLI 0.42.0+ 的 HistoryWindow 结构：上游自行开窗，适配只做块级窗口。
  await send('Page.navigate', {url: `http://127.0.0.1:${PORT}/fixture.html?hw=1`}, sessionId);
  let hwRun;
  for (let i=0; i<150; i++) {
    await sleep(100);
    const {result} = await send('Runtime.evaluate', {expression: '({done: window.fixtureTestsDone===true, results: window.fixtureTestResults || []})', returnByValue:true}, sessionId);
    hwRun=result.value;
    if(hwRun?.done) break;
  }
  if (!hwRun?.done || hwRun.results.some(r=>!r.pass)) throw new Error('HistoryWindow-mode fixture failed: '+JSON.stringify(hwRun));
  report.hwTotal=hwRun.results.length;
  await send('Page.navigate', {url: `http://127.0.0.1:${PORT}/extension-fixture.html`}, sessionId);
  for(let i=0; i<50; i++) {
    await sleep(100);
    const {result}=await send('Runtime.evaluate',{expression: "document.title==='Extension panel fixture' && !!document.getElementById('kimi-lazy-panel')", returnByValue:true},sessionId);
    if(result.value)break;
  }
  const {result:initial}=await send('Runtime.evaluate',{expression:"document.getElementById('kimi-lazy-panel').style.left",returnByValue:true},sessionId);
  if(initial.value) throw new Error('extension restored a position belonging to another origin');
  report.panelChecks.push(...await panelChecks(send, sessionId, 'extension'));
} catch(e) { report.failed.push(e.message); }
writeFileSync(path.join(outDir, 'cdp-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
chrome.kill(); server.kill();
process.exit(report.completed && report.total > 0 && report.passed === report.total && !report.failed.length ? 0 : 1);
