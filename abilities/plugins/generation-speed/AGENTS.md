<!-- vetta-guide-revision: 3 -->
# Generation Speed

Vetta 桌面插件工程（插件 id：`generation-speed`）。

**本文件不讲规则，只告诉你去哪读。** 规则在手册里，手册随 SDK 升级；写在这里的任何一条都会
停在这个工程创建那天。两者冲突时一律以手册为准。

## 第一步：装依赖，找到手册

```bash
npm install
npx vetta-plugin-cli docs --check-latest
```

`npm install` 必须先跑：`vetta-plugin-cli` 是 `@vetta-org/plugin-cli` 的命令名，装完才在
`node_modules/.bin` 里。还没装就想跑，用全名 `npx @vetta-org/plugin-cli docs`。

它打印手册目录的**绝对路径**、手册对应的 SDK 版本，以及本工程与所属 hub 的位置。
**不要硬编码这个路径**：工作区可能把依赖提升到仓库根，一仓多插件时各插件还可能钉不同版本。

输出里出现 `Manual is behind` 或 `This brief is stale` 就按它给的命令升级，再重跑一次。

## 第二步：按顺序读手册

| 顺序 | 文件 | 何时读 |
| --- | --- | --- |
| 1 | `README.md` | **总是先读**：能力矩阵、信任模型、**不可违反的红线**、导航 |
| 2 | `getting-started.md` | 首次写代码、构建、安装调试 |
| 3 | `manifest.md` | 写/改 `plugin.json`、贡献智能体与团队 |
| 4 | `permissions.md` | 选定权限列表之前 |
| 5 | 按扩展点选读 | `ui-slots.md` / `conversation-and-agent.md` / `message-cards.md` / `mcp.md` / `ai.md` / `browser.md` / `app-actions.md` / `styling-and-pitfalls.md` |

实现任一扩展点**之前**再读对应那章，不要凭记忆写 SDK API——这套合同变化很快。

## 常用命令

```bash
npm run dev            # 开发服务器
npm run build          # 产出 dist/
npm run install:vetta  # 打包并装进正在运行的 Vetta（需要 Vetta 已启动）

npx vetta-plugin-cli watch       # 热更新：宿主改从本工程目录加载，改完即生效
npx vetta-plugin-cli reload generation-speed   # 装完提示有 pending 版本时用它
npx vetta-plugin-cli uninstall   # 卸载（省略 id 即本工程对应的插件）
npx vetta-plugin-cli sync        # 在 hub 仓库根上跑：把索引与各能力目录对账
```

细节都在 `getting-started.md`。`docs` 打印了 `Marketplace index:` 就说明这个目录之上有能力
市场索引，改完 `version` / `permissions` / `pluginApiVersion` 后要回仓库根跑 `sync`。

## 信息不足时

插件 id、展示名、要用哪些权限、功能边界、是否立刻安装——**问用户**，不要自己假定。
