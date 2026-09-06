#!/usr/bin/env python3
"""CI 版上游检测：抓 npm 新版本的前端构建 hash，与仓库白名单对比，新构建做契约核对。

与本地套件 kimi-lazy-watch 的区别：无 config.json、无代理、无 docker；状态文件在
.github/upstream-state.json（版本→hash 映射），已记录的版本不重复下载 tarball。

输出（写到 $GITHUB_OUTPUT，同时打印）：
  new_ok=[...]     契约通过、可进白名单的新构建
  new_fail=[...]   契约破坏的新构建（含缺失标识，供开 issue）
退出码：0 正常（含"无新版"）；1 执行错误。
"""
import io
import json
import os
import re
import sys
import tarfile
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REGISTRY = os.environ.get('NPM_REGISTRY', 'https://registry.npmjs.org').rstrip('/')
ASSET_RE = re.compile(r'/assets/index-[\w-]+\.js')
STATE_PATH = ROOT / '.github' / 'upstream-state.json'
CONTRACT = json.loads((ROOT / 'ci' / 'contract.json').read_text())


def fetch(url, timeout=120):
    req = urllib.request.Request(url, headers={'User-Agent': 'kimi-lazy-ci'})
    return urllib.request.urlopen(req, timeout=timeout).read()


def known_builds():
    return set(ASSET_RE.findall((ROOT / 'src' / 'core' / 'main.js').read_text()))


def contract_check(text):
    ids = CONTRACT['identifiers']
    hard = [it for it in ids['injectionPoint'] + ids['components'] if it not in text]
    if not re.search(r'["\']3\.5\.\d+["\']', text) and not re.search(r'version[=:]\s*["\']3\.5\.', text):
        hard.append('vue:' + CONTRACT['vue'])
    soft = [it for it in ids['classes'] + ids['props'] if it not in text]
    return hard, soft


def main():
    state = json.loads(STATE_PATH.read_text()) if STATE_PATH.exists() else {'versions': {}}
    meta = json.loads(fetch(f'{REGISTRY}/@moonshot-ai%2Fkimi-code'))
    times = meta.get('time', {})
    todo = [(v, i['dist']['tarball']) for v, i in sorted(
        meta['versions'].items(), key=lambda kv: times.get(kv[0], ''))
        if v not in state['versions']]
    print(f'已记录 {len(state["versions"])} 个版本，新增待查 {len(todo)} 个')

    known = known_builds()
    new_ok, new_fail = [], []
    for ver, tarball in todo:
        try:
            with tarfile.open(fileobj=io.BytesIO(fetch(tarball, timeout=180)), mode='r:gz') as tf:
                names = [m.name for m in tf.getmembers() if m.name.endswith('dist-web/index.html')]
                if not names:
                    state['versions'][ver] = None
                    print(f'  {ver}: 无 web UI')
                    continue
                html = tf.extractfile(names[0]).read().decode('utf-8', errors='replace')
                m = ASSET_RE.search(html)
                asset = m.group(0) if m else None
                state['versions'][ver] = asset
                if not asset or asset in known:
                    print(f'  {ver}: {asset or "无入口 hash"}（已知）')
                    continue
                bundle = tf.extractfile('package/dist-web' + asset).read().decode('utf-8', errors='replace')
                hard, soft = contract_check(bundle)
                if not hard and len(soft) <= 2:
                    new_ok.append({'asset': asset, 'versions': [ver]})
                    known.add(asset)
                    print(f'  {ver}: {asset} 契约通过')
                else:
                    new_fail.append({'asset': asset, 'versions': [ver], 'missing': hard + soft})
                    print(f'  {ver}: {asset} 契约破坏，缺 {hard + soft}')
        except Exception as e:
            print(f'  {ver}: 抓取失败 {e}（下轮重试）', file=sys.stderr)

    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + '\n')
    out = {'new_ok': new_ok, 'new_fail': new_fail}
    print(json.dumps(out, ensure_ascii=False))
    gh_out = os.environ.get('GITHUB_OUTPUT')
    if gh_out:
        with open(gh_out, 'a') as f:
            f.write(f"new_ok={json.dumps(new_ok)}\nnew_fail={json.dumps(new_fail)}\n")


if __name__ == '__main__':
    main()
