# 验证与合成会话

仓库根目录执行：

```bash
python3 scripts/build.py
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

CRX 签名和篡改拒绝测试需要先通过 `--key` 构建 CRX；无 CRX 时这两项明确跳过。CI 使用临时 RSA 私钥，由 Chrome 打包后运行全部检查；发行版必须重复使用维护者保管的正式密钥。

## 浏览器功能验证

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run fixture
python3 tests/serve.py
```

访问 `http://127.0.0.1:58791/fixture.html` 自动运行 16 项合成会话检查（追加 `?hw=1` 则运行 7 项 HistoryWindow 结构检查）。页面内嵌用户脚本，用于验证首次渲染接入；保持页面可见直到显示结果。结果写入忽略提交的 `tests/last-browser-result.json`。

实际用户脚本管理器验证：先导入并启用 `dist/kimi-lazy.user.js`，再访问 `/via-fixture.html`。这个页面自身不包含用户脚本标签，等待管理器注入。晚注入时，首项明确验证过多原生组件被卸载，不计作首次渲染优化。

让 Waydroid 访问时，可使用 `--bind` 指定宿主的 Waydroid 网桥地址；用设备可以访问的 IP 和端口打开页面。页面使用合成消息，不连接真实 Kimi 服务，不需要服务令牌。`via-results.json` 是既有 Via 实测记录。

测试涵盖窗口大小、旧消息恢复、工具组恢复与折叠、可见内容保护、闲置回收、流式更新、补齐历史、停用还原、切换会话、错误状态，以及面板拖动、视口边界钳制、拖动后的点击抑制。十分钟回收通过模拟时间验证。

无头 Chrome 回归（Node 24+）：

```sh
CHROME_BIN=/usr/bin/google-chrome node ci/fixture_check.mjs . /tmp/kimi-lazy-fixture-out
```

运行器等待明确的完成信号，执行 16 项主夹具、同网站保留位置后的第二轮夹具、7 项 HistoryWindow 模式夹具，以及用户脚本 / 扩展各 8 项面板检查（窄屏中点与边缘、旋转比例、缩小后恢复、键盘点击、安全区和存储）。扩展面板在真实 Chrome 中运行，存储 API 使用夹具模拟；安全区用解析后的 CSS 内边距模拟，不代表新增手机实测。常规 PR CI 和 watch-upstream 都执行此检查。
