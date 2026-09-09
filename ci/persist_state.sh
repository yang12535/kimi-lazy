#!/usr/bin/env bash
set -euo pipefail
# Commit detector changes first; rebase refuses a dirty working tree.
git add .github/upstream-state.json src/core/main.js src/extension/panel.js src/userscript/bootstrap.js src/userscript/panel.js
if git diff --cached --quiet; then
  echo '状态无变化'
  exit 0
fi
git commit -qm 'chore(ci): 上游版本状态更新（无新构建）'
git pull --rebase origin main
git push origin HEAD:main
