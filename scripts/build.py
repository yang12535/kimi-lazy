#!/usr/bin/env python3
"""Build the standalone userscript and its update metadata."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

def build():
    project = json.loads((ROOT / 'project.json').read_text())
    version = project['version']
    dist = ROOT / 'dist'
    dist.mkdir(parents=True, exist_ok=True)
    base = f"https://github.com/{project['repository']}/releases/latest/download"
    metadata = f'''// ==UserScript==
// @name         Kimi 会话轻量浏览（Via / 用户脚本版）
// @namespace    local.kimi.lazy
// @version      {version}
// @description  Kimi Code 会话按需渲染；默认保留最近 20 条，旧内容闲置 10 分钟回收。自动识别页面，不限域名。
// @match        *://*/*
// @run-at       document-start
// @grant        none
// @sandbox      raw
// @inject-into  page
// @noframes
// @homepageURL  https://github.com/{project['repository']}
// @supportURL   https://github.com/{project['repository']}/issues
// @downloadURL  {base}/kimi-lazy.user.js
// @updateURL    {base}/kimi-lazy.meta.js
// ==/UserScript==

'''
    core = '\n'.join((ROOT / 'src/core' / n).read_text() for n in ['policy.js', 'main.js'])
    body = (ROOT / 'src/userscript/bootstrap.js').read_text()
    body = body.replace('/* BUNDLE_CORE */', core)
    body = body.replace('/* BUNDLE_PANEL */', (ROOT / 'src/userscript/panel.js').read_text())
    (dist / 'kimi-lazy.user.js').write_text(metadata + body)
    (dist / 'kimi-lazy.meta.js').write_text(metadata)
    artifacts = [dist / 'kimi-lazy.user.js', dist / 'kimi-lazy.meta.js']
    (dist / 'SHA256SUMS').write_text(''.join(
        f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(artifacts)
    ))
    return artifacts

if __name__ == '__main__':
    for artifact in build():
        print(artifact.relative_to(ROOT))
