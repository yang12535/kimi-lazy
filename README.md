# Kimi Lazy · Kimi 会话轻量浏览

让 Kimi Code Web 的长会话按需渲染：保留最新消息，需要时恢复历史，闲置后回收旧内容的渲染组件。

**[下载最新版本](https://github.com/yang12535/kimi-lazy/releases/latest)** · **[直接安装用户脚本](https://github.com/yang12535/kimi-lazy/releases/latest/download/kimi-lazy.user.js)** · **[问题反馈](https://github.com/yang12535/kimi-lazy/issues)**

## 选择安装方式

| 版本 | 适用场景 | 下载文件 | 页面匹配范围 |
| --- | --- | --- | --- |
| 用户脚本 | Via 等支持用户脚本的手机浏览器；Tampermonkey / Violentmonkey | `kimi-lazy.user.js` | 所有 HTTP(S) 域名、IP、端口，通过 Kimi 页面特征决定是否启动 |
| Chrome 扩展 | 在桌面浏览器访问本机 Kimi | `kimi-lazy-0.1.0.crx` 或 `kimi-lazy-0.1.0-extension.zip` | 默认 `127.0.0.1`、`localhost` 的 HTTP 页面，端口不限 |

两种版本选一种安装即可。用户脚本已在 **Via 7.3.3 / Waydroid Android 13 / WebView 146** 中完成安装和运行验证。

### Via / 用户脚本

1. 用 Via 打开上面的 `.user.js` 下载链接，在脚本安装提示中确认安装并启用。
2. 或先下载文件，在 Via 的脚本页面选择「导入脚本」。通过「添加脚本」粘贴时，需要包含文件开头的完整 UserScript 元数据。
3. 刷新 Kimi 页面，右上角出现「轻量浏览」按钮。

若 Via 对当前网站单独禁用了脚本，需要启用该网站的脚本。手机的 `127.0.0.1` 指手机自身；访问电脑服务时，使用手机可达的服务地址。

同一个文件包含 Tampermonkey / Violentmonkey 的页面环境注入声明，无 `@require`，不依赖 GM API 或 Chrome 扩展 API。管理器支持更新检查时，会从本仓库的最新 Release 获取更新。两种管理器的正式安装流程尚未在本项目测试中执行。[元数据说明](https://violentmonkey.github.io/api/metadata-block/)

### Chrome 扩展

通用的开发者安装方式：下载扩展 ZIP，解压后打开 `chrome://extensions`，开启开发者模式，选择「加载已解压的扩展程序」，指向包含 `manifest.json` 的目录。

CRX 使用 Chrome 原生工具打包，格式为 CRX3。是否允许安装商店外 CRX 由浏览器、操作系统和管理策略决定；打包签名成功并不代表所有 Chrome 都允许直接安装。若 CRX 被拒绝，使用上述解压加载方式。本项目未上架 Chrome Web Store。[Chrome 官方安装说明](https://developer.chrome.com/docs/extensions/how-to/distribute/install-extensions)

## 默认行为

- 常驻最近 **20 条消息**，每组常驻最近 **20 个工具 / 内容块**，数量均可设置。
- 旧内容留下轻量占位，点击或滚动到对应位置时恢复。
- 恢复的内容离开视口且 **10 分钟**没有活动后，卸载其渲染组件。
- 保护正在阅读、选中、聚焦及生成中的内容。
- 「加载全部历史」调用 Kimi 原生历史读取能力，数据补齐后仍按需渲染，也可以停止读取。
- 「回到最新并回收」收起临时恢复的历史内容。
- 关闭开关并应用，可恢复 Kimi 原生渲染。

“消息”按用户和助手条目分别计数，一问一答通常是两条。

## 兼容范围与限制

当前适配 **Kimi Web 前端 0.39.1 与 0.37.2（均为 Vue 3.5.39）**，识别资源路径 `/assets/index--0t1wzw_.js` 与 `/assets/index-BkUUBejk.js`。服务端版本不等于前端版本。未知前端构建不会启用适配，需要更新本项目后再使用。

通过 Vue 自身的渲染流程挂载 / 卸载组件，不删除服务端记录。Kimi 原有的消息缓存仍保留，因此不能把组件或 DOM 的减少比例理解为总内存的减少比例，也不减少模型上下文 Token。单个巨大代码块尚未进行逐行虚拟化。

Via 的 `document-start` 实际执行时机可能变化。实测有一轮先全量挂载后由脚本收回，也有一轮在首次渲染前就接入成功；因此**不能保证消除每次首次加载的卡顿**。脚本接入后的历史恢复、回收和流式更新已通过测试。浏览器暂停后台计时器时，回收会在恢复运行后继续执行。

## 隐私与设置

用户脚本只保存开关、数量和回收时间，使用当前网站的 localStorage；不同域名或端口的设置相互独立。存储不可用时仍可本次使用，面板会提示无法保存。扩展使用 Chrome 本地存储保存设置。

渲染适配器没有外部统计、会话上传或远程代码依赖。诊断接口只返回计数。仓库不包含真实会话正文、服务器令牌、APK 或 CRX 签名私钥。

## 验证

- 8 项 Node 测试：窗口租约、可见保护、消息变化、会话清理、非目标页面和子框架退出等。
- 13 项浏览器功能检查：历史恢复、工具组展开 / 折叠、闲置回收、流式更新、补齐历史、停用还原等。
- Via 原生脚本安装与运行通过；真实会话显示 **20 条已渲染、39 条休眠**，开关还原正常。
- 320 × 640 窄屏面板检查通过。
- CRX3 签名、ID、ZIP 内容及篡改拒绝检查。

[详细测试范围](docs/validation.md) · [浏览器测试复现](tests/README.md)

## 构建

需要 Python 3、Node.js；签名打包额外需要 OpenSSL 和 Chrome/Chromium。

```bash
python3 scripts/build.py
node --test tests/*.test.cjs
python3 -m unittest discover -s tests -p 'test_*.py' -v
```

产物位于 `dist/`：扩展目录、扩展 ZIP、用户脚本、更新元数据和 SHA256 校验和。

签名密钥应放在仓库外，并在后续版本重复使用，以保持扩展 ID 不变：

```bash
# 使用你自己保管的 RSA PEM 私钥。
python3 scripts/build.py --key /absolute/path/to/private-key.pem
python3 scripts/verify_crx.py dist/kimi-lazy-0.1.0.crx
```

可以通过 `--chrome /path/to/chrome` 指定打包程序。`src/core/` 由两种版本共享；`src/extension/` 和 `src/userscript/` 分别提供设置面板与注入入口。修改 `project.json` 的版本后重新构建。

## 许可

[MIT](LICENSE)。本项目是独立适配工具，非 Kimi 或 Via 官方产品。
