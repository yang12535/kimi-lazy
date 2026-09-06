#!/usr/bin/env python3
"""Build the extension ZIP and standalone userscript; optionally sign with Chrome."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent

def build(key=None, chrome=None):
    project = json.loads((ROOT / 'project.json').read_text())
    version = project['version']
    dist = ROOT / 'dist'
    extension = dist / 'extension'
    extension.mkdir(parents=True, exist_ok=True)
    for name in ['main.js', 'policy.js']:
        shutil.copyfile(ROOT / 'src/core' / name, extension / name)
    shutil.copyfile(ROOT / 'src/extension/panel.js', extension / 'panel.js')
    manifest = json.loads((ROOT / 'src/extension/manifest.json').read_text())
    manifest['version'] = version
    (extension / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
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
    archive = dist / f'kimi-lazy-{version}-extension.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as out:
        for name in ['manifest.json', 'policy.js', 'main.js', 'panel.js']:
            info = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = 0o100644 << 16
            out.writestr(info, (extension / name).read_bytes())
    artifacts = [archive, dist / 'kimi-lazy.user.js', dist / 'kimi-lazy.meta.js']
    if key:
        key = Path(key).resolve()
        if not key.is_file():
            raise SystemExit('Signing key does not exist; create it outside the repository first.')
        chrome = chrome or shutil.which('google-chrome') or shutil.which('chromium')
        if not chrome:
            raise SystemExit('Chrome/Chromium executable is required for CRX packaging.')
        with tempfile.TemporaryDirectory(prefix='kimi-lazy-pack-') as profile:
            subprocess.run([chrome, f'--user-data-dir={profile}', '--no-first-run',
                            '--no-default-browser-check', f'--pack-extension={extension}',
                            f'--pack-extension-key={key}'], check=True, timeout=60)
        packed = dist / f'kimi-lazy-{version}.crx'
        (dist / 'extension.crx').replace(packed)
        from verify_crx import verify
        report = verify(packed)
        (dist / 'extension-id.txt').write_text(report['extension_id'] + '\n')
        artifacts += [packed, dist / 'extension-id.txt']
    (dist / 'SHA256SUMS').write_text(''.join(
        f'{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}\n' for p in sorted(artifacts)
    ))
    return artifacts

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--key', help='Private PEM key kept outside this repository')
    parser.add_argument('--chrome', help='Chrome/Chromium executable path')
    args = parser.parse_args()
    for artifact in build(args.key, args.chrome):
        print(artifact.relative_to(ROOT))
