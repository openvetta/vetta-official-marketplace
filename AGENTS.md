# 能力编写手册

本仓库是 Vetta 桌面端「开放能力市场」的官方源。桌面端会拉取本仓库的 `main` 分支归档，解析 `.vetta/marketplace.json`，校验每个能力包后才展示与安装。

这份手册面向在本仓库中添加/修改能力的人与 AI。**所有规则都对应桌面端的硬校验**：任何一条不满足，整个市场源都会同步失败——桌面端只会给出 `sync-failed`，不会告诉你具体哪里错了。所以宁可对着本手册逐条核对，也不要靠试。

## 添加一个能力的流程

1. 选类型：`skill` / `mcp` / `plugin` / `bundle`（没有别的类型，`scene` 不被支持）
2. 建包目录：`abilities/skills/<slug>/`、`abilities/mcp/<slug>/`、`abilities/plugins/<slug>/`、`abilities/bundles/<slug>/`（注意 mcp 目录没有复数 s）
3. 写包内文件（见「各类型包规范」）
4. 写展示层 `ability.json`（可选 `detail.json`、`assets/`）
5. 需要独立展示时在 `.vetta/marketplace.json` 的 `abilities[]` 注册；仅 bundle 成员则在 bundle 中写包路径引用
6. **bump 顶层 `marketplaceVersion`**
7. 按「提交前检查清单」自检

## 目录结构

```text
.vetta/marketplace.json
abilities/skills/<slug>/SKILL.md
abilities/mcp/<slug>/mcp.json
abilities/plugins/<slug>/plugin.json
abilities/bundles/<slug>/
abilities/<type>/<slug>/ability.json
abilities/<type>/<slug>/detail.json
abilities/<type>/<slug>/README.md
abilities/<type>/<slug>/assets/
```

## `.vetta/marketplace.json`

顶层：

| 字段 | 约束 |
| --- | --- |
| `schemaVersion` | `1` 或 `2`；包路径 bundle 成员需 `2`，官方源当前使用 `2` |
| `name` | slug 格式，市场标识 |
| `displayName` | 可选 |
| `marketplaceVersion` | 版本格式；**内容一变就必须改** |
| `repository` | 合法 URL |
| `minAppVersion` | 语义版本；低于该版本的桌面端整源拒绝加载 |
| `abilities` | 独立上架条目数组，可以为空 |

- slug 格式：`^[a-z0-9][a-z0-9-]{0,63}$`
- 版本格式：`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`

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
- `parameters[]` 是让用户在 UI 里填的凭据项。`key` 会作为 stdio 的 `env` 键名或 http 的 header 名写入；`valueTemplate` 必须包含 `{value}`（例如 `"Bearer {value}"`），用户填的值会替换进去
- `parameters[]` 也是 strict schema，不要加自定义字段

需要由 Desktop 托管官方二进制的 MCP 可以使用 `schemaVersion: 2`，在同一个 `mcp.json` 中增加受管运行时：

```json
{
  "schemaVersion": 2,
  "runtime": {
    "kind": "managed-binary",
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
    "type": "stdio",
    "command": "${VETTA_MCP_EXECUTABLE}",
    "args": ["--stdio"]
  }
}
```

- `runtime.kind` 当前只能是 `managed-binary`；平台键为 `win32|darwin|linux` 与 `x64|arm64` 的组合。
- 产物 URL 必须是无凭据的 HTTPS，`sha256` 必须是 64 位小写十六进制；`archive` 只能是 `file` 或 `zip`。
- ZIP 内不能有绝对路径、目录逃逸、符号链接或加密条目；不要提交或执行任何 shell、PowerShell、JavaScript 安装脚本。
- `server.command` 必须精确为 `${VETTA_MCP_EXECUTABLE}`。参数、环境变量和工作目录可以使用 `${VETTA_MCP_RUNTIME_DIR}`、`${VETTA_MCP_DATA_DIR}`、`${VETTA_MCP_CACHE_DIR}`。
- 只有已发布并可验证的 Release 产物才能注册；示例 URL 和 SHA-256 不能直接用于市场条目。

### plugin

包内必须有 `plugin.json`：

```json
{
  "id": "open-marketplace-demo-plugin",
  "name": "Extension Safety Demo",
  "version": "1.0.0",
  "pluginApiVersion": "1.1.0",
  "entry": "dist/index.js",
  "permissions": ["storage.read"]
}
```

- `id` 必须 === 条目的 `slug`，`version` 必须 === 条目的 `version`
- `name`、`pluginApiVersion`、`entry` 必填非空
- `entry` 以及 `styles[]` 里的每个路径都必须是包内**真实存在的文件**，否则报 missing or outside the package
- 构建产物要提交进仓库（桌面端不会替你构建）

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
- 改变上架位置时保留成员 slug、version、configVersion，只有实际制品或配置契约变化才提升对应版本；始终 bump marketplaceVersion
- 本源 v2 需要包含该解析功能的 Desktop 构建（目标 `0.5.49`），先更新客户端再切换格式；
  旧构建刷新不能获得新解析器，会拒绝 v2 整源并沿用可用旧缓存。包文件自身的 schemaVersion 不因此改变

## 展示层：`ability.json` / `detail.json`

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

`detail.json`（`format: "blocks"` 时）：

```json
{ "schemaVersion": 1, "blocks": [ … ] }
```

可用的 block 类型只有 7 种，**没有自定义 HTML / JS / CSS / iframe 的口子**：

| type | 必填 | 说明 |
| --- | --- | --- |
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

1. **目录卡片**（名称 / 简介 / 标签）—— 独立条目在 `.vetta/marketplace.json` 中，仅 bundle 成员在包内 `ability.json` 中：

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
| `.vetta/marketplace.json` | ≤ 2 MB |
| 单个 `ability.json` | ≤ 64 KB |
| 单个 detail 文件 | ≤ 512 KB |
| 单个图片资源 | ≤ 8 MB |

另外：归档内不允许符号链接、不允许加密条目、所有路径必须落在市场根目录内；`ability.json` 引用的任何文件都不能逃出自己的包目录。

## 提交前检查清单

- [ ] `marketplaceVersion` 已 bump（**最常见的翻车点**：内容变了但版本没变，桌面端直接报 `Marketplace content changed without a marketplaceVersion update`）
- [ ] 新能力的 `slug` 在 manifest 内唯一
- [ ] 默认名称与多语言名称不包含能力类型后缀，现有 slug 未因展示改名而变化
- [ ] 包内 `SKILL.md` / `mcp.json` / `plugin.json` 的 slug、version 与 manifest 条目逐字一致
- [ ] `ability.json` 的 `type` / `slug` / `version` 与 manifest 条目逐字一致
- [ ] bundle 无路径成员在顶层存在；路径成员使用 v2、包与元信息存在、身份和路径无冲突
- [ ] 仅 bundle 成员没有重复注册到顶层，除非确实需要独立展示；包内默认名称、语言覆盖和分类齐全
- [ ] mcp 条目在 manifest 里没有 `config` 键
- [ ] `schemaVersion: 2` 的受管 MCP 为每个已支持平台填写真实 Release URL、SHA-256 和可执行文件路径，并确认没有安装脚本
- [ ] plugin 的 `entry`（及 `styles`）文件确实已提交
- [ ] detail 里所有 `href` 是 http/https，所有图片路径在包内且格式受支持
- [ ] 默认语言（manifest 的 `name`/`description`/`tags` 与 `detail.json`）是英文，中文放在 `zh` 覆盖里
- [ ] `categoryI18n` 已补齐 `zh` / `en`，同分类译名一致，`category` 保持稳定
- [ ] 若能力用到桌面端新特性，`minAppVersion` 已相应提高
- [ ] 已运行 `node --test tests/marketplace.test.mjs`；这是内容回归检查，不替代 Desktop 的完整 Schema 校验
- [ ] 在桌面端「能力 → 添加市场源」里实际添加本仓库，确认能列出新能力并安装成功

最后一条最有效：桌面端同步失败时只会记一句 `sync-failed`，没有具体原因，所以本地跑通一次比读十遍手册可靠。
