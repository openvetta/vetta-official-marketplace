# Xiaohongshu service

该目录是小红书插件自有的 Node.js + TypeScript + Playwright 服务，不属于 Desktop 宿主业务。

- `src/browser/`：长期 Browser 与按账号隔离的 BrowserContext；普通状态检查复用 context，只有登录会话创建可见 context。
- `src/accounts/`：账号元数据与 Playwright storage state 路径管理。
- `src/mcp/`：MCP 协议适配（服务端工具不放在插件前端 `src/tools/`）。
- `src/main.ts`：HTTP 健康检查、账号管理和登录会话路由。

服务只接收宿主注入的 `VETTA_SERVICE_PORT`、`VETTA_SERVICE_DATA_DIR`。账号 cookie/storage state 只保存在服务数据目录，前端和宿主不读取。

## 浏览器运行时

服务不依赖用户电脑上已经安装的 Chrome 或 Edge。第一次执行需要浏览器的操作时，服务会通过随制品发布的 Playwright CLI 下载 Chromium，并将浏览器缓存隔离在：

```text
<VETTA_SERVICE_DATA_DIR>/browser-cache/
```

后续启动会复用该缓存，不会重复下载。下载过程由服务内部的并发锁保护；多个账号同时发起检查时只会进行一次安装。测试或受控环境可以使用 `XHS_BROWSER_EXECUTABLE` 指定现有 Chromium，`XHS_HEADLESS=false` 仅用于需要显示登录窗口的登录会话。
