#!/usr/bin/env python3
"""Recover an adaptation branch before building/testing the tree to be pushed."""
import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ['.github/upstream-state.json', 'src/core/main.js', 'src/extension/panel.js',
             'src/userscript/bootstrap.js', 'src/userscript/panel.js']


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def main():
    items = json.loads(os.environ['NEW_OK'])
    if not items or any(not re.fullmatch(r'/assets/index-[\w-]+\.js', x['asset']) for x in items):
        raise SystemExit('Invalid adaptation assets')
    branch = 'bot/frontend-' + Path(items[0]['asset']).stem
    state_path = ROOT / GENERATED[0]
    detected = json.loads(state_path.read_text())
    base = git('rev-parse', 'HEAD')
    # Only discard detector-owned files, after retaining the full detected state.
    git('restore', '--', *GENERATED)
    remote = subprocess.run(['git', 'ls-remote', '--exit-code', '--heads', 'origin', branch],
                            cwd=ROOT, capture_output=True, text=True)
    if remote.returncode == 0:
        # An explicit destination also works with actions/checkout's narrow refspec.
        git('fetch', 'origin', f'refs/heads/{branch}:refs/remotes/origin/{branch}')
        git('checkout', '-B', branch, f'origin/{branch}')
        # Retain branch work and current base changes. Conflicts stop before publication.
        git('merge', '--no-edit', base)
    elif remote.returncode == 2:
        git('checkout', '-b', branch)
    else:
        raise SystemExit('Remote branch lookup failed: ' + remote.stderr)
    recovered = json.loads(state_path.read_text())
    for version, asset in detected['versions'].items():
        if version in recovered['versions'] and recovered['versions'][version] != asset:
            raise SystemExit(f'Conflicting upstream mapping for {version}')
        recovered['versions'][version] = asset
    state_path.write_text(json.dumps(recovered, ensure_ascii=False, indent=2) + '\n')
    print(f'Prepared {branch}; build and browser tests must run before pushing.')


if __name__ == '__main__':
    main()
