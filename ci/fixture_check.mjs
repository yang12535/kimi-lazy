#!/usr/bin/env node
/**
 * 在沙盒容器内跑 kimi-lazy 的 13 项夹具浏览器测试（无头 chromium + CDP）。
 *
 * 用法: node cdp_fixture_check.mjs <repoDir> <outDir>
 * 流程: 构建夹具与用户脚本 → 起静态服务 → CDP 驱动无头 chromium 打开夹具页
 *       → 等待 13 项结果 → 截图 + 写 <outDir>/cdp-report.json
 * 退出码: 0 = 13/13 通过；1 = 有失败/超时；2 = 环境错误。
 */
import { spawn, execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const [repoDir, outDir] = process.argv.slice(2);
if (!repoDir || !outDir) { console.error('usage: cdp_fixture_check.mjs <repoDir> <outDir>'); process.exit(2); }

const CHROME = process.env.CHROME_BIN || '/usr/bin/chromium';
const PORT = 58791;
const resultsFile = path.join(repoDir, 'tests', 'last-browser-result.json');
try { if (existsSync(resultsFile)) execFileSync('rm', [resultsFile]); } catch {}

console.log('[1/4] 构建夹具与用户脚本...');
execFileSync('npm', ['ci', '--no-audit', '--no-fund', '--loglevel=error'], { cwd: repoDir, stdio: 'inherit' });
execFileSync('node', ['tests/build.cjs'], { cwd: repoDir, stdio: 'inherit' });
execFileSync('python3', ['scripts/build.py'], { cwd: repoDir, stdio: 'inherit' });

console.log('[2/4] 起静态服务与无头 chromium...');
const server = spawn('python3', ['tests/serve.py', '--port', String(PORT)], { cwd: repoDir, stdio: 'ignore' });
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
  '--remote-debugging-port=9222', '--user-data-dir=/tmp/chrome-profile', 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });
process.on('exit', () => { try { chrome.kill(); server.kill(); } catch {} });

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch('http://127.0.0.1:9222/json/version');
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
      expression: 'window.fixtureTestResults ? window.fixtureTestResults.length : -1',
      returnByValue: true,
    }, sessionId);
    const n = result.value ?? -1;
    if (n >= 13) done = true;
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
  report = { total: data.results.length, passed: data.results.length - failed.length, failed, error: data.error, stats: data.stats ? { states: data.stats.states, groups: data.stats.groups?.length } : null };
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
writeFileSync(path.join(outDir, 'cdp-report.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report));
chrome.kill(); server.kill();
process.exit(report.total === 13 && report.passed === 13 ? 0 : 1);
