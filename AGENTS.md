# 能力编写手册

本仓库是 Vetta 桌面端「开放能力市场」的官方源。新模型在源码分支开发能力，由 CI 向 gh-pages 发布 schema v3 索引、向 GitHub Releases 发布固定 .vettapkg。旧客户端仍引用的历史分支需要单独保留，不能在客户端迁移前删除其目录合同。

这份手册面向在本仓库中添加/修改能力的人与 AI。源码检查、发布检查与客户端校验分别保护不同边界；来源同步失败时查看主进程中的 open-marketplace 日志。

## 静态市场发布规则

本仓库采用 Helm 静态包仓库模式。`marketplace-source` 是新模型的源码分支，事实源是 `.vetta/marketplace.source.json`；CI 在 `gh-pages` 生成 `.vetta/marketplace.json`。`main` 固定保留旧客户端读取的 schema v2 市场，不接收新模型源码。源码不保存制品索引，也不手工维护 marketplaceVersion。

- 修改前运行 git status，保留已有改动。没有用户授权不得提交或推送。
- 通过以 `marketplace-source` 为基准分支的普通源码 PR 审核代码及能力版本。合入后 CI 发布新版本，不能自动合并源码 PR。
- 插件源码条目（含仅 Bundle 引用的成员）声明 minAppVersion；API、权限、命令与摘要由构建结果派生。
- 同版本运行内容继续使用已发布制品；准备发布时提升能力版本并同步相关身份文件。
- CI 先校验、上传并复核制品，再推进 gh-pages。已有版本不可覆盖。
- 文档和源码开发提交不增加市场版本。只有分发内容变化时 CI 分配新 marketplaceVersion。
- 不执行向 `marketplace-source` 回写生成索引、先发包后提目录 PR 或逐提交版本递增的旧流程；不得用新模型提交改写兼容分支 `main`。
- 完成时依次运行 node scripts/marketplace.mjs check、node scripts/marketplace.mjs build 与 node --test tests/*.test.mjs；内容测试同时检查生成后的插件资源，不能放在构建前。Windows Python shim 环境可将 VETTA_PYTHON 指向真实解释器。
- 本地构建使用 node scripts/marketplace.mjs build；正式发布由 publish-marketplace.yml 执行。
- 旧客户端使用的历史 ref 保留；gh-pages 验证成功后再显式切换来源。

## 添加一个能力的流程

1. 选类型：`skill` / `mcp` / `plugin` / `bundle`（没有别的类型，`scene` 不被支持）
2. 建包目录：`abilities/skills/<slug>/`、`abilities/mcp/<slug>/`、`abilities/plugins/<slug>/`、`abilities/bundles/<slug>/`（注意 mcp 目录没有复数 s）
3. 写包内文件（见「各类型包规范」）
4. 写展示层 `ability.json`（可选 `detail.json`、`assets/`）
5. 需要独立展示时在 `.vetta/marketplace.source.json` 的 `abilities[]` 注册；仅 bundle 成员则在 bundle 中写包路径引用
6. 准备发布运行内容时提升能力版本，普通源码 PR 审核通过后由 CI 自动发布
7. 执行源码与发布工具测试；用户要求提交时再核对暂存内容

插件项目的目录、职责拆分、Tailwind 接入和用户流程测试遵循
[`docs/plugin-project-structure.md`](docs/plugin-project-structure.md)。文件名必须表达职责；不要使用 `ui.ts`、`ui.tsx`、`utils.ts` 或 `primitives.tsx` 作为多个职责的容器。所有 UI `.tsx` 生产文件放在 feature/shared 的 `components/` 下（根目录 `index.tsx` 仅作为插件装配入口），基础组件原则上一个文件只放一个组件；`tools/` 仅用于 `ctx.agent.registerTool()` 的 Agent 工具。

## 开发插件：工具与手册

插件类能力的**开发单位是它自己的目录**（`abilities/plugins/<slug>/`），每个目录里有一份
`AGENTS.md` 交代该怎么开工。开发时先 `cd` 进去——所有工具命令都作用于「最近的那个 `plugin.json`」。

```bash
cd abilities/plugins/<slug> && npm install
npx vetta-plugin-cli docs          # 手册目录绝对路径 + 对应的 SDK 版本
npm run build                      # v3 本地预检可打包；正式 .vettapkg 由受保护 CI 构建，dist/ 不提交
```

SDK 手册随 `@vetta-org/plugin-sdk` 装进各插件自己的 `node_modules`，因此读到的合同与该插件
实际编译的版本一致。**不要硬编码 node_modules 路径**，用上面的命令解析。

> 现状：四个插件钉的都是 `^0.1.1` / `^0.2.0`，**早于手册随包发布的 0.3.1**，所以 `docs` 现在
> 都报找不到。升到 `^0.3.1` 才能用上，但那是跨 0.3.0 破坏性变更的升级，需要逐个插件评估。

新建插件工程（仓库根没有 `node_modules`，用全名）：

```bash
npx @vetta-org/plugin-cli init --id <slug> --name "<Display Name>" abilities/plugins/<slug>
```

它只创建目录，**不动索引**——什么时候上架是人的决定，按上面「添加一个能力的流程」登记。

### 索引生成与验证

源码声明不包含 marketplaceVersion 或 releases。通过 node scripts/marketplace.mjs check 校验；完整构建后的 .marketplace-build/site 由 CI 使用固定提交中的 Plugin CLI 源码对账（公开的 0.1.6 尚不支持此分发目录）。不要用旧 sync 改写源码配置。详见 [静态发布说明](docs/marketplace-v3.md)。

## 目录结构

```text
.vetta/marketplace.source.json
abilities/skills/<slug>/SKILL.md
abilities/mcp/<slug>/mcp.json
abilities/plugins/<slug>/plugin.json
abilities/bundles/<slug>/
abilities/<type>/<slug>/ability.json
abilities/<type>/<slug>/detail.json
abilities/<type>/<slug>/README.md
abilities/<type>/<slug>/assets/
```

## 源码配置

.vetta/marketplace.source.json 包含 schemaVersion: 3、name、displayName、repository、minAppVersion 与 abilities。
每个插件条目额外声明 minAppVersion，不填写 releases。普通条目字段和各类型身份合同如下。
源码版本可领先于 gh-pages 中已发布版本；每个能力版本独立发布。configVersion 只标识配置结构。

`abilities[]` 每一项：

```json
{
  "type": "skill",
  "slug": "hello-vetta",
  "name": "Hello Vetta",
  "description": "一句话说明这个能力做什么。",
  "version": "1.0.0",
  "configVersion": 1,
  "license": "MIT",
  "author": "Vetta",
  "category": "Examples",
  "categoryI18n": { "zh": "示例", "en": "Examples" },
  "tags": ["example"],
  "detail": { "i18n": { "zh": { "name": "…", "description": "…" } } },
  "source": { "path": "abilities/skills/hello-vetta" }
}
```

- `slug` 在整个解析后目录内**全局唯一**，不分类型；多个 bundle 可引用同一个类型和路径的成员
- 展示名称描述用途，不包含 `MCP` / `Skill` / `Plugin` / `Bundle` 或「技能 / 插件 / 套装」类型后缀；
  类型由客户端标签展示。改名只调整默认名称、语言覆盖及详情标题，不改变已有 slug、安装身份或配置版本。
- `source.path` 必须是仓库内相对路径，不能逃出市场根目录
- `configVersion` 在能力的配置契约变化时 +1
- `detail.i18n.<locale>` 用来放多语言的 `name` / `description`，目录页直接用
- `category` 是稳定分组标识，`categoryI18n` 是可选的语言键到显示名的字符串映射。官方能力必须补齐 `zh` / `en`，
  同一分类的译名保持一致；不要把 `category` 改成当前语言的译名。旧客户端忽略该可选字段，无须提高 `minAppVersion`。
- **`type: "mcp"` 的条目禁止出现 `config` 键**（安装配置只能放在包里的 `mcp.json`）；写了会直接报 `MCP configuration must be stored in source.path/mcp.json`

## 各类型包规范

### skill

包内必须有 `SKILL.md`，frontmatter 三个字段与 manifest 条目严格对齐：

```markdown
---
name: hello-vetta        # 必须 === 条目的 slug
description: …           # 必填，非空
version: 1.0.0           # 必须 === 条目的 version
---

正文就是发给 Agent 的指令。
```

整个包目录内不允许符号链接。

### mcp

包内必须有 `mcp.json`，schema 是 **strict** 的（多写任何键都会失败）：

```json
{
  "schemaVersion": 1,
  "slug": "context7",
  "version": "1.1.0",
  "server": { "type": "http", "url": "https://mcp.context7.com/mcp" },
  "parameters": [
    {
      "key": "CONTEXT7_API_KEY",
      "label": "Context7 API Key",
      "required": false,
      "secret": true,
      "placeholder": "sk-…",
      "helpUrl": "https://context7.com/dashboard",
      "valueTemplate": "Bearer {value}"
    }
  ],
  "browserAuth": false
}
```

- `slug` / `version` 必须与 manifest 条目一致
- `server` 走桌面端 MCP 配置校验，只允许两种形态，且**键名白名单之外的键一律拒绝**：
  - `type: "http"`：必填 `url`；可选 `headers`、`oauthClientId`、`oauthDeviceFlow`、`oauthScopes`
  - `type: "stdio"`（或省略 `type`）：必填 `command`；可选 `args`、`env`、`cwd`
  - 两者共有可选键：`disabled`、`autoApprove`、`startupTimeout`（正整数）、`debug`、`displayName`、`description`、`icon`
- `parameters[]` 是让用户在 UI 里填的连接参数。`key` 通常作为 stdio 的 `env` 键名或远程 http 的 header 名写入；对于 schema v3 的受管 HTTP runtime，它会作为经 manifest 白名单约束的子进程环境变量写入。`valueTemplate` 必须包含 `{value}`（例如 `"Bearer {value}"`），用户填的值会替换进去
- `parameters[]` 也是 strict schema，不要加自定义字段

需要由 Desktop 托管官方二进制的 MCP 可以使用 `schemaVersion: 3`，在同一个 `mcp.json` 中增加受管运行时：

```json
{
  "schemaVersion": 3,
  "runtime": {
    "kind": "managed-binary",
    "process": {
      "args": ["-port=:${VETTA_MCP_PORT}"],
      "env": {}
    },
    "service": {
      "kind": "http-mcp",
      "path": "/mcp"
    },
    "platforms": {
      "win32-x64": {
        "url": "https://example.com/server.exe",
        "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        "archive": "file",
        "executable": "server.exe"
      }
    }
  },
  "server": {
    "type": "http",
    "url": "${VETTA_MCP_URL}"
  }
}
```

- `runtime.kind` 当前只能是 `managed-binary`；平台键为 `win32|darwin|linux` 与 `x64|arm64` 的组合。
- 产物 URL 必须是无凭据的 HTTPS，`sha256` 必须是 64 位小写十六进制；`archive` 只能是 `file` 或 `zip`。
- ZIP 内不能有绝对路径、目录逃逸、符号链接或加密条目；不要提交或执行任何 shell、PowerShell、JavaScript 安装脚本。
- `server.url` 必须精确为 `${VETTA_MCP_URL}`。`runtime.process` 的参数、环境变量和工作目录可以使用 `${VETTA_MCP_RUNTIME_DIR}`、`${VETTA_MCP_DATA_DIR}`、`${VETTA_MCP_CACHE_DIR}`。
- 只有已发布并可验证的 Release 产物才能注册；示例 URL 和 SHA-256 不能直接用于市场条目。

有些官方二进制**本身就是一个本地 HTTP MCP 服务**（只监听端口，没有 stdio 模式）。这类要在 `runtime` 里加 `service`：

```json
{
  "runtime": {
    "kind": "managed-binary",
    "service": { "kind": "http-mcp", "path": "/mcp", "readyTimeoutMs": 300000 },
    "platforms": { "...": {} }
  },
  "server": {
    "type": "http",
    "url": "${VETTA_MCP_URL}"
  }
}
```

- 桌面端会分配一个空闲端口、拉起二进制并等待 `path` 就绪，然后通过 direct HTTP 连接；进程随 MCP 生命周期退出。
- `runtime.process` 描述**怎么启动这个二进制**；`${VETTA_MCP_PORT}` 必须出现在 `args` 或 `env` 里，否则校验直接失败。
- `readyTimeoutMs` 上限 600000。首次运行要下载依赖（例如浏览器内核）的服务要放宽这个值。

安装完还需要用户做一次动作（扫码登录等）的受管 MCP，用 `schemaVersion: 3` 的可选 `setup` 声明：

```json
{
  "setup": {
    "kind": "http-qrcode",
    "statusPath": "/api/v1/login/status",
    "qrcodePath": "/api/v1/login/qrcode",
    "logoutPath": "/api/v1/login/cookies"
  }
}
```

- `setup` 只允许受管运行时（有 `runtime` 的 `schemaVersion: 3`）使用。
- `http-qrcode` 使用上游结构化 REST 接口；二维码由 `qrcodePath` 返回，登录结论只读取 `statusPath` 响应中的 `data.is_logged_in`。
- `logoutPath` 供设置页执行显式退出登录；不使用 Cookies 文件存在与否推断登录状态。

### plugin

包内必须有 `plugin.json`：

```json
{
  "id": "open-marketplace-demo-plugin",
  "name": "Extension Safety Demo",
  "version": "1.0.0",
  "pluginApiVersion": "^2.0.0",
  "entry": "dist/index.js",
  "permissions": ["storage.read"]
}
```

- `id` 必须 === 条目的 `slug`，`version` 必须 === 条目的 `version`
- `name`、`pluginApiVersion`、`entry` 必填非空
- `entry` 以及 `styles[]` 里的每个路径都必须是包内**真实存在的文件**，否则报 missing or outside the package
- 插件构建产物由 CI 发布为不可变 .vettapkg；dist/、release/ 不进入源码 Git。历史 .zip 制品保留兼容。
- 插件需要成熟的通用能力时应把依赖显式安装进自己的 `package.json`，不要依赖宿主或开发机偶然存在的包，
  也不要手写低质量替代实现。UI 样式优先使用 `tailwindcss` + `@tailwindcss/vite`；外部输入、
  持久化数据和协议响应的运行时校验按插件现有技术栈选择 `zod` 或 `@sinclair/typebox`；React 交互测试使用
  `@testing-library/react`、`@testing-library/user-event` 与 `jsdom`/`happy-dom`。只安装实际使用的依赖，
  不为假设中的未来需求预装工具。
- 使用 Tailwind 时在 Vite 中接入 `@tailwindcss/vite`，样式入口导入 `tailwindcss`，组件优先使用 utility class；
  仅宿主主题变量映射、第三方内容适配或 utility 难以清晰表达的规则保留业务 CSS。依赖版本与锁文件必须随源码提交。

### bundle

bundle 只是一个可勾选安装的集合，自己没有可执行内容：

```json
{
  "type": "bundle",
  "slug": "starter",
  "config": {
    "members": [
      { "type": "skill", "slug": "hello-vetta", "source": { "path": "abilities/skills/hello-vetta" } },
      { "type": "mcp", "slug": "context7", "source": { "path": "abilities/mcp/context7" } }
    ]
  }
}
```

- `members` 至少 1 项，`type` 只能是 `skill` / `mcp` / `plugin`
- v1 / v2 都允许 `{ type, slug }` 引用顶层已注册能力；没有 `source` 的成员必须在顶层存在
- v2 支持成员 `source.path`，相对**市场根目录**，不是 bundle 所在目录。包无需在顶层注册；
  未注册成员必须在自己的 `ability.json` 提供名称、版本和其他目录元信息（见下节）
- 顶层注册决定独立展示。仅 bundle 引用的成员不进入「发现」及顶部图标区，仍可在 bundle 详情中查看、勾选安装，
  安装后可在「我的」中更新、启停和卸载；未被任何条目引用的包不会自动加载
- 同 slug 必须同 type、同规范化路径；同时顶层注册时沿用顶层目录字段及既有包展示合并规则，不重复生成成员
- 成员不能重复
- bundle 自身的 `source` 可选（通常指向一个只放展示资源的目录），与成员的 source 相互独立
- 不增设 `hidden` / `listed` 作者字段，不内联成员制品、运行配置或安装脚本
- 改变上架位置时保留成员 slug、version、configVersion，只有实际制品或配置契约变化才提升对应版本；CI 自动更新分发索引
- 本源 v2 需要包含该解析功能的 Desktop 构建（目标 `0.5.49`），先更新客户端再切换格式；
  旧构建刷新不能获得新解析器，会拒绝 v2 整源并沿用可用旧缓存。包文件自身的 schemaVersion 不因此改变

## 展示层：`ability.json` / `detail.json`

### 面向 Vetta 用户编写

- 详情是 Vetta 中的产品介绍，不是上游官网、工具目录或开发者 README 的复制品。先说用户能得到什么，
  再给一个可直接在对话中使用的例子，最后用简短步骤说明安装、必要配置与开始使用。
- 复用宿主的声明式详情区块；常见结构为用途介绍、对话示例、使用场景、开始步骤及必要提醒。
  步骤描述用户在 Vetta 中的操作，不把工具调用、环境变量或内部存储流程写成用户操作。
- 命令、固定版本、协议和高级排查留在独立技术文档，通过帮助链接按需访问；不要把技术 README 设为详情的静默 fallback。
- 简化不能变成虚假承诺：尚需用户安装的依赖、提供的凭据、费用/额度及重要权限边界，应在开始使用前简明告知，
  不宣称尚未实现的自动安装或免配置。示例回复用于说明预期流程，不冒充实际查询结果。
- 默认英文与中文覆盖保持同等内容；卡片简介也描述使用价值。知乎三项的 `detail.json` / `detail.zh.json` 可作为案例，
  `README.md` / `README.zh.md` 负责高级接入说明。更新后运行内容测试及 Desktop 真实解析器校验。

### 包描述文件

独立上架的能力可省略 `ability.json`，此时只用 manifest 字段。仅 bundle 引用的包则必须提供它作为目录元信息入口：
除下例身份与展示字段外，还必须有 `name`；可提供 `description`、`configVersion`、`license`、`author`、`category`、
`categoryI18n`、`tags`，校验规则与顶层条目相同。不允许包含 `config` / `source`，MCP 配置仍只放 `mcp.json`。
翻译直接放 `detail.i18n.zh`，可以同时包含 `name` / `description` / `tags` 与详情 `path`，无需再在 marketplace 复制一份。

```json
{
  "schemaVersion": 1,
  "type": "skill",
  "slug": "hello-vetta",
  "version": "1.0.0",
  "icon": "solar:magic-stick-3-bold",
  "detail": {
    "format": "blocks",
    "path": "detail.json",
    "fallback": "README.md",
    "meta": [{ "key": "repository", "value": "https://github.com/openvetta/vetta-official-marketplace" }],
    "i18n": { "zh": { "path": "detail.zh.json" } }
  }
}
```

- `type` / `slug` / `version` 三者必须与对应目录能力**完全一致**；未上架成员的 type / slug 匹配引用，version 匹配制品
- `detail.format`：`blocks`（结构化）或 `markdown`（整篇正文）
- `detail.fallback`：主 detail 解析失败时的兜底文件，通常写 `README.md`。**注意它会掩盖错误** —— 详情页看起来正常但内容退化成了 README，本地自检时要留意
- `meta[].key` 只能是 `homepage` / `repository` / `docs` / `license`；也可以不给 key 而给 `label` 自定义标题
- 图标 `icon` 三选一：`solar:` 开头的 Iconify 名、`https://` 链接、包内相对图片路径。包内图片扩展名限 `.avif .gif .ico .jpeg .jpg .png .svg .webp`
- **卡片图标不得随意设置。** 这是目录页的产品识别，不是装饰。有官方品牌或应用图标的能力必须用官方位图（通常提交为 `assets/icon.png`），来源应是官网、应用商店或官方品牌资源；禁止拿 Solar / Iconify 里「看起来有点像」的图形凑数，也不要自行绘制或生成近似商标。没有独立品牌标识的工具型能力才选用 Solar，且图形必须能代表该能力本身。飞书、小红书、知乎、X 等条目是前者的案例。

`detail.json`（`format: "blocks"` 时）：

```json
{ "schemaVersion": 1, "blocks": [ … ] }
```

常用 block 类型如下（完整白名单以 Desktop Schema 为准），**没有自定义 HTML / JS / CSS / iframe 的口子**：

| type | 必填 | 说明 |
| --- | --- | --- |
| `hero` | `title` | 用一句话说明价值，可加 `eyebrow`、`description` 与 `badges` |
| `feature-grid` | `items[]{title, description}` | `items[].icon` 可用 `solar:` 或包内图片 |
| `steps` | `items[]{title}` | `description` 可选 |
| `showcase` | `showcase{template, user_prompt, assistant_reply}` | `template` 限 `chat-over-canvas` / `chat-thread`；`canvas` 限 `design` / `code` / `docs` / `generic`；`brand_icon_url` **不支持 `solar:`** |
| `image` | `src` | `src` **不支持 `solar:`**，用包内图片或 https |
| `callout` | `content` | `tone` 限 `info` / `success` / `warning`，默认 `info` |
| `markdown` | `content` | 纯 Markdown 正文 |
| `links` | `items[]{label, href}` | `href` 必须是 `http:` / `https:` |

## 多语言（必做）

**规则：默认语言一律写英文，中文放在 `zh` 覆盖里。** 不要把中文写在默认位置——那样英文界面的用户看到的就是中文。

卡片、分组和正文都要写：

1. **目录卡片**（名称 / 简介 / 标签）—— 独立条目在 `.vetta/marketplace.source.json` 中，仅 bundle 成员在包内 `ability.json` 中：

   ```json
   {
     "name": "Spreadsheet Toolkit",
     "description": "Create, read, analyze and edit spreadsheets without format loss.",
     "tags": ["spreadsheet", "excel"],
     "detail": { "i18n": { "zh": { "name": "表格工具箱", "description": "创建、读取、分析与编辑表格文件，保留透视表、宏与格式。" } } }
   }
   ```

2. **分类分组** —— 条目保留英文分类标识，并通过 `categoryI18n` 提供译名：

   ```json
   { "category": "Documents", "categoryI18n": { "zh": "文档", "en": "Documents" } }
   ```

   `categoryI18n` 与 `detail.i18n` 是不同字段；只翻译卡片或正文不会翻译分组。切换语言只改变显示名，
   不改变分类归属或排序；自定义来源不提供译名时，客户端显示原分类名。

3. **详情页正文** —— 在包里放两份 detail 文件，`ability.json` 用 `detail.i18n.<locale>.path` 指过去：

   ```text
   detail.json      # 英文，默认
   detail.zh.json   # 中文覆盖
   ```

   ```json
   "detail": { "format": "blocks", "path": "detail.json", "i18n": { "zh": { "path": "detail.zh.json" } } }
   ```

要点：

- locale 键用基语言 `zh` 即可，界面语言是 `zh-CN` 时会回退命中；写 `zh-CN` 反而只对该地区生效
- i18n 覆盖是**整体替换**，不与默认值合并：`i18n.zh` 给了 `blocks`，中文详情页就完全用这份，不会跟英文块混排
- `i18n.<locale>` 不写 `format` 时继承外层；不写 `meta` 时回落到外层 `meta`（元信息一般不用翻译，不必重复）
- `tags` 整体替换，给空数组等于没给
- 目录里的 `name` / `description` / `tags` 同时是搜索词来源，中文覆盖写全才能被中文关键词搜到

## 体积与安全限制

| 限制 | 值 |
| --- | --- |
| 仓库归档下载 | ≤ 25 MB |
| 解压后总大小 | ≤ 100 MB |
| 归档条目数 | ≤ 10000 |
| `.vetta/marketplace.source.json` | ≤ 2 MB |
| 单个 `ability.json` | ≤ 64 KB |
| 单个 detail 文件 | ≤ 512 KB |
| 单个图片资源 | ≤ 8 MB |

另外：归档内不允许符号链接、不允许加密条目、所有路径必须落在市场根目录内；`ability.json` 引用的任何文件都不能逃出自己的包目录。

## 提交前检查清单

- [ ] 已运行 node scripts/marketplace.mjs check 与发布工具测试
- [ ] 需要发布的运行内容已提升能力版本
- [ ] 新能力的 `slug` 在 manifest 内唯一
- [ ] 默认名称与多语言名称不包含能力类型后缀，现有 slug 未因展示改名而变化
- [ ] 包内 `SKILL.md` / `mcp.json` / `plugin.json` 的 slug、version 与 manifest 条目逐字一致
- [ ] `ability.json` 的 `type` / `slug` / `version` 与 manifest 条目逐字一致
- [ ] bundle 无路径成员在顶层存在；路径成员使用 v2、包与元信息存在、身份和路径无冲突
- [ ] 仅 bundle 成员没有重复注册到顶层，除非确实需要独立展示；包内默认名称、语言覆盖和分类齐全
- [ ] mcp 条目在 manifest 里没有 `config` 键
- [ ] `schemaVersion: 3` 的受管 MCP 为每个已支持平台填写真实 Release URL、SHA-256 和可执行文件路径，并确认没有安装脚本
- [ ] 声明了 `setup` 的 MCP 确认 status/qrcode/logout 三个上游 REST 路径正确，且状态响应提供 `data.is_logged_in`
- [ ] 插件 minAppVersion 与实际宿主要求一致；生成制品通过摘要与包内容检查，构建结果未跟踪
- [ ] 卡片 `icon` 不是随手挑的：有官方品牌/应用图标则用包内官方位图，否则才用贴切的 Solar 名
- [ ] detail 里所有 `href` 是 http/https，所有图片路径在包内且格式受支持
- [ ] 默认语言（manifest 的 `name`/`description`/`tags` 与 `detail.json`）是英文，中文放在 `zh` 覆盖里
- [ ] `categoryI18n` 已补齐 `zh` / `en`，同分类译名一致，`category` 保持稳定
- [ ] 若能力用到桌面端新特性，`minAppVersion` 已相应提高
- [ ] 已运行 `node --test tests/marketplace.test.mjs`；这是内容回归检查，不替代 Desktop 的完整 Schema 校验
- [ ] 在桌面端「能力 → 添加市场源」里实际添加本仓库，确认能列出新能力并安装成功

最后一条最有效：界面上的 `sync-failed` 只表示同步失败，具体原因以主进程日志中的 `open-marketplace` 记录为准；本地跑通一次仍然比只读手册可靠。
