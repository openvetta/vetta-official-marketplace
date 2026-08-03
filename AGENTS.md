# 能力编写手册

本仓库是 Vetta 桌面端「开放能力市场」的官方源。桌面端会拉取本仓库的 `main` 分支归档，解析 `.vetta/marketplace.json`，校验每个能力包后才展示与安装。

这份手册面向在本仓库中添加/修改能力的人与 AI。**所有规则都对应桌面端的硬校验**：任何一条不满足，整个市场源都会同步失败——桌面端只会给出 `sync-failed`，不会告诉你具体哪里错了。所以宁可对着本手册逐条核对，也不要靠试。

## 添加一个能力的流程

1. 选类型：`skill` / `mcp` / `plugin` / `bundle`（没有别的类型，`scene` 不被支持）
2. 建包目录：`abilities/skills/<slug>/`、`abilities/mcp/<slug>/`、`abilities/plugins/<slug>/`、`abilities/bundles/<slug>/`（注意 mcp 目录没有复数 s）
3. 写包内文件（见「各类型包规范」）
4. 写展示层 `ability.json`（可选 `detail.json`、`assets/`）
5. 在 `.vetta/marketplace.json` 的 `abilities[]` 注册条目
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
| `schemaVersion` | 固定 `1` |
| `name` | slug 格式，市场标识 |
| `displayName` | 可选 |
| `marketplaceVersion` | 版本格式；**内容一变就必须改** |
| `repository` | 合法 URL |
| `minAppVersion` | 语义版本；低于该版本的桌面端整源拒绝加载 |
| `abilities` | 数组，可以为空 |

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
  "tags": ["example"],
  "detail": { "i18n": { "zh": { "name": "…", "description": "…" } } },
  "source": { "path": "abilities/skills/hello-vetta" }
}
```

- `slug` 在整个 manifest 内**全局唯一**，不分类型
- `source.path` 必须是仓库内相对路径，不能逃出市场根目录
- `configVersion` 在能力的配置契约变化时 +1
- `detail.i18n.<locale>` 用来放多语言的 `name` / `description`，目录页直接用
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
      { "type": "skill", "slug": "hello-vetta" },
      { "type": "mcp", "slug": "context7" }
    ]
  }
}
```

- `members` 至少 1 项，`type` 只能是 `skill` / `mcp` / `plugin`
- 每个成员必须是**同一份 manifest 里已声明**的能力，且 type 与 slug 都对得上，否则报 `Bundle member not found in marketplace`
- 成员不能重复
- `source` 可选（通常指向一个只放展示资源的目录）

## 展示层：`ability.json` / `detail.json`

`ability.json` 存在才会加载展示信息，不存在就只用 manifest 里的字段。

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
    "i18n": { "en": { "path": "detail.en.json" } }
  }
}
```

- `type` / `slug` / `version` 三者必须与 manifest 条目**完全一致**，否则报 Presentation identity does not match ability
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

多语言：`ability.json` 的 `detail.i18n.<locale>.path` 指向另一份 detail 文件（不写 `format` 时继承外层）。

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
- [ ] 包内 `SKILL.md` / `mcp.json` / `plugin.json` 的 slug、version 与 manifest 条目逐字一致
- [ ] `ability.json` 的 `type` / `slug` / `version` 与 manifest 条目逐字一致
- [ ] bundle 成员都能在本 manifest 里找到，且类型匹配
- [ ] mcp 条目在 manifest 里没有 `config` 键
- [ ] plugin 的 `entry`（及 `styles`）文件确实已提交
- [ ] detail 里所有 `href` 是 http/https，所有图片路径在包内且格式受支持
- [ ] 若能力用到桌面端新特性，`minAppVersion` 已相应提高
- [ ] 在桌面端「能力 → 添加市场源」里实际添加本仓库，确认能列出新能力并安装成功

最后一条最有效：桌面端同步失败时只会记一句 `sync-failed`，没有具体原因，所以本地跑通一次比读十遍手册可靠。
