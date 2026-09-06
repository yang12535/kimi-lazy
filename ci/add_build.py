#!/usr/bin/env python3
"""CI 版机械适配：把新构建 hash 追加进 4 处 BUILDS 白名单，重建产物，跑回归。

用法：add_build.py /assets/index-A.js [/assets/index-B.js ...]
退出码：0 全部完成且测试通过；1 失败。
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ASSET_RE = re.compile(r'^/assets/index-[\w-]+\.js$')
TARGETS = ['src/core/main.js', 'src/extension/panel.js', 'src/userscript/bootstrap.js', 'src/userscript/panel.js']
SET_RE = re.compile(r'(BUILDS\s*=\s*new\s+Set\s*\(\s*\[)')


def main():
    assets = sys.argv[1:]
    if not assets or not all(ASSET_RE.match(a) for a in assets):
        raise SystemExit('用法: add_build.py /assets/index-XXX.js ...')
    for asset in assets:
        for rel in TARGETS:
            p = ROOT / rel
            text = p.read_text()
            if asset in text:
                continue
            m = SET_RE.search(text)
            if not m:
                raise SystemExit(f'{rel} 不是 BUILDS Set 形态，需人工检查')
            p.write_text(text[:m.end(1)] + f"'{asset}', " + text[m.end(1):])
            print(f'{rel}: +{asset}')

    b = subprocess.run(['python3', 'scripts/build.py'], cwd=ROOT, capture_output=True, text=True, timeout=300)
    if b.returncode != 0:
        raise SystemExit('构建失败: ' + (b.stdout + b.stderr)[-500:])
    tests = sorted(str(p) for p in (ROOT / 'tests').glob('*.test.cjs'))
    r = subprocess.run(['node', '--test'] + tests, cwd=ROOT, capture_output=True, text=True, timeout=300)
    print('\n'.join((r.stdout + r.stderr).strip().splitlines()[-8:]))
    if r.returncode != 0:
        raise SystemExit('回归测试失败')
    print('适配完成。')


if __name__ == '__main__':
    main()
