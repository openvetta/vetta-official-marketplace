# Xiaohongshu service

该目录是小红书插件自有的 Node.js + TypeScript + Playwright 服务，不属于 Desktop 宿主业务。

- `src/browser/`：长期 Browser 与按账号隔离的 BrowserContext；普通状态检查复用 context，只有登录会话创建可见 context。
- `src/accounts/`：账号元数据与 Playwright storage state 路径管理。
- `src/mcp/`：MCP 协议适配（服务端工具不放在插件前端 `src/tools/`）。
- `src/main.ts`：HTTP 健康检查、账号管理和登录会话路由。

服务只接收宿主注入的 `VETTA_SERVICE_PORT`、`VETTA_SERVICE_DATA_DIR`。账号 cookie/storage state 只保存在服务数据目录，前端和宿主不读取。
