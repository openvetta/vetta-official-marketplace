# 插件项目结构规范

这份文档规定官方市场插件的推荐目录和职责边界。它适用于带有 React UI、受管服务、MCP、本地持久化或工具调用的插件。简单插件可以省略不使用的目录，但不应把所有实现堆进 `index.tsx`，也不应使用含义宽泛的 `ui.ts`、`ui.tsx` 或 `primitives.tsx` 作为长期容器。

## 推荐目录

```text
abilities/plugins/<slug>/
├── .gitignore
├── plugin.json                         # 插件身份、权限、服务和 MCP 声明
├── ability.json                        # 市场展示元数据
├── detail.json                         # 英文详情
├── detail.zh.json                      # 中文详情覆盖
├── README.md                           # 开发者接入、配置和排错说明
├── package.json
├── package-lock.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── index.tsx                       # 唯一装配入口：注册 UI、服务和生命周期
│   ├── runtime-contract.ts             # 宿主能力的最小类型边界
│   ├── runtime.ts                      # 受管服务生命周期适配
│   ├── domain/                         # 领域模型、协议解析和持久化
│   │   ├── xiaohongshu-accounts.ts
│   │   └── xiaohongshu-accounts.test.ts
│   ├── tools/                          # ctx.agent.registerTool 注册的 Agent 工具
│   │   ├── register-tools.ts           # 统一装配并返回 Disposable 清理句柄
│   │   └── <tool-name>.ts              # 一个 Agent 工具及其参数/handler
│   ├── features/                       # 按用户目标组织的 UI 功能
│   │   └── <feature>/
│   │       ├── components/             # 所有 .tsx；一个文件一个主组件
│   │       ├── hooks/                  # 异步流程和状态模型
│   │       ├── services/               # 仅在需要时放副作用适配
│   │       └── index.ts                # 该功能的语义化公开入口（可选）
│   ├── shared/                         # 两个以上功能共同使用的内容
│   │   ├── components/                 # 每个文件只导出一个基础 UI 组件
│   │   │   ├── account-avatar.tsx
│   │   │   ├── modal-dialog.tsx
│   │   │   ├── status-line.tsx
│   │   │   └── xhs-logo.tsx
│   │   ├── state/                      # 跨功能状态类型和状态映射
│   │   │   └── status.ts
│   │   ├── styles/                     # Tailwind class 组合和设计令牌
│   │   └── formatters/                 # 无副作用格式化函数
│   ├── test/                            # 所有插件测试，与生产代码分离
│   │   ├── account-ui.test.tsx
│   │   └── <domain>.test.ts
│   └── style.css                       # Tailwind 入口和少量主题适配
├── assets/                             # 官方品牌图标等静态资源
├── locales/                            # 插件运行期 i18n catalog
├── runtime-lock.json                   # 受管二进制的固定版本、来源和校验值
└── release/                            # 提交的可安装插件归档
```

### 文件命名规则

- 文件名必须表达领域或组件职责，例如 `account-avatar.tsx`、`qr-login-dialog.tsx`、`account-state.ts`、`qr-code.ts`。
- 不使用 `ui.ts`、`ui.tsx`、`common.ts`、`utils.ts`、`helpers.ts`、`primitives.tsx` 作为多个职责的容器。确实需要共享时，按职责拆成目录和语义化文件。
- 所有 UI `.tsx` 生产文件放在对应 feature 的 `components/` 或 `shared/components/` 下；根目录 `index.tsx` 是只负责插件装配的明确例外。一个组件文件原则上只放一个主要 UI 组件。页面容器可以组合子组件，但不要在同一文件继续定义多个无关弹窗、卡片和基础控件。
- `index.tsx` 只负责注册插件、装配插槽/工作区、启动必要资源和返回清理函数。业务状态、网络请求和 JSX 细节放到对应领域或 feature 文件。
- 目录名按产品功能或领域命名，避免用 `misc`、`stuff` 等无法表达边界的目录。

## 职责边界

- `plugin.json` 声明插件身份、权限、MCP 绑定和受管服务；第三方协议路径仍属于插件源码，不放入宿主。
- `runtime.ts` 只处理服务安装、启动、停止、健康状态和宿主服务 API 适配。
- `runtime-contract.ts` 只描述宿主桥接的最小类型，不把小红书等具体业务协议写进宿主 SDK。
- `domain/` 负责外部响应收窄、持久化 schema、账号/会话状态转换和领域错误。Cookie、Token 等敏感数据只能通过 secrets 或服务数据目录保存，不写入日志。
- `tools/` 专门放通过 `ctx.agent.registerTool()` 注册给 Agent 的工具。每个工具声明稳定的 `id`、描述、参数 schema、`scope_use` 和 handler；`register-tools.ts` 负责统一注册并在插件停用时释放句柄。二维码渲染、请求解码等普通实现不属于该目录，应放在所属 feature 的 `services/`。
- `features/<feature>/hooks` 负责异步状态机和副作用，`components` 负责可见状态、交互和可访问语义。组件文件不应同时承担完整的异步状态机；当流程变长时先抽 hook。
- `shared/components` 只接收 props，不直接读取服务或持久化状态；每个文件一个组件，组件名和文件名保持对应。
- `shared` 只放确实跨功能复用的内容，避免建立万能 barrel 文件。跨目录导入应指向具体语义文件，而不是重新导出整个 shared 目录。
- Tailwind 样式通过 `style.css` 的 `@import "tailwindcss"` 和 Vite 插件接入；组件优先使用 utility class，只有主题变量映射、第三方内容适配或 utility 难以清晰表达的规则才保留在 CSS。

## UI 与状态组织示例

以账号登录插件为例：

```text
features/
├── account-connection/
│   ├── components/
│   │   ├── xhs-setup-slot.tsx          # 详情页插槽
│   │   └── qr-login-dialog.tsx         # 扫码登录弹窗
│   └── services/
│       └── qr-code.ts                  # 登录 feature 的普通服务适配
└── account-management/
    ├── components/
    │   ├── xhs-accounts-view.tsx       # 账号工作区
    │   ├── account-card-item.tsx       # 单个账号卡片
    │   ├── delete-account-dialog.tsx   # 删除确认弹窗
    │   └── rename-account-dialog.tsx   # 备注编辑弹窗
    └── hooks/
        └── use-copy-account-id.ts      # 账号卡片交互 hook

shared/components/
├── account-avatar.tsx
├── modal-dialog.tsx
├── status-line.tsx
└── xhs-logo.tsx

tools/                                  # 只有确实注册 Agent 工具时才创建
├── register-tools.ts
└── <tool-name>.ts
```

目录结构应随着职责变化拆分，而不是用一个新的万能文件替代旧的 `ui.tsx`。如果同一组件继续膨胀，应优先抽出该组件自己的 `hooks/`、`services/` 或 `components/` 子目录。

## 测试约定

每个用户可观察流程至少从最接近产品入口的组件或公开服务接口开始测试。登录类流程应覆盖“点击登录 → 等待二维码 → 状态轮询 → 成功或超时反馈”；账号管理流程应覆盖“加载列表 → 切换/重命名/删除 → 刷新后状态一致”。纯函数测试不能替代组件接线测试，外部网络和进程才使用 mock。

统一使用：

```bash
bun run check
bun run test
bun run build
node --test tests/marketplace.test.mjs
```

插件运行内容变化时提升插件版本，并同步 `plugin.json`、`ability.json`、`package.json`、锁文件、构建产物、归档和顶层 `marketplaceVersion`。
