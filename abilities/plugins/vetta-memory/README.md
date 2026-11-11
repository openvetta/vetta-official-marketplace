# Memory（记忆）

Vetta 的长期记忆插件。把偏好、事实、决定和项目约定保存在本机，并在每轮对话开始时提供给 Agent；另有每日日志、待办清单，以及独立的「记忆」页面用于管理。设计参考 [pi-memory](https://www.npmjs.com/package/pi-memory)。

## 能力边界

| 扩展点 | 说明 |
| --- | --- |
| 工作区视图 `memory` | 记忆 / 每日日志 / 待办 / 最近删除 / 设置五个标签页；默认在侧边栏「更多」里 |
| 系统提示词 Provider `memory-context` | 每轮注入：待办 → 今日日志 → 长期记忆 → 昨日日志，分段限长，总量 ≤ 16K 字符 |
| Agent 工具（7 个） | `memory_write`、`memory_read`、`memory_search`、`memory_forget`、`memory_restore`、`scratchpad`、`memory_status` |
| Hook | `SessionStart`、`UserPromptSubmit`、`Stop`（自动提取）、`PreCompact`（交接）、`PostCompact`、`SessionEnd`（会话总结） |

权限：`ui.slot.workspace-view`、`storage.read/write`、`agent.tools.register`、`agent.toolHandler.execute`、`agent.systemPrompt.write`、`agent.hooks.register`、`agent.hookHandler.execute`、`ai.complete`、`ai.models.list`。`ai.*` 只用于可选的自动提取与会话总结。

## 与 pi-memory 的对应

| pi-memory | 本插件 |
| --- | --- |
| `MEMORY.md` 长期记忆 | 长期记忆，带类型（偏好/事实/决定/经验/项目/反馈）、置顶、全局或按项目 |
| 每日日志 | 每日日志，按本地日期分文件，含 `note` / `summary` / `handoff` 三类条目 |
| `scratchpad` 清单 | `scratchpad` 工具与待办页，可全局或按项目 |
| `memory_forget` + `memory_restore`，恢复记录 | 同名工具；任何删除（含界面删除、全部清空）都先保存恢复记录，最近删除页可恢复 |
| 注入优先级与分段上限 | 同一顺序；待办 2K、今日 3K（取尾部）、长期记忆按条数/字数预算、昨日 3K（最先被丢弃） |
| KV cache 稳定快照 | `stable` 模式（默认）：每会话一份快照，仅在记忆/设置变化、上下文压缩、跨天、会话开始时刷新；`per-turn` 模式每轮重建并追加与当前消息最相关的 3 条 |
| `#tag` 与 `[[link]]` | 参与搜索分词，可直接用 `#tag` / `[[link]]` 搜索 |
| 压缩前的会话交接 | `PreCompact` 写入 `handoff` 日志条目（未完成待办 + 今日日志末 15 条） |
| 退出时的会话总结 | `SessionEnd` 用所选模型写 `summary` 条目；20 秒超时，失败只提示不影响对话；可关闭 |
| 工具返回受限预览 | 读取类工具输出上限 4000 字符 |
| `memory_status` | 同名工具：数量、设置、可恢复删除数 |
| 纯文本、可编辑 | 数据为 JSON（见下）；记忆页支持「复制为 Markdown」 |

### 有意不同或未实现

- **没有语义/混合检索。** pi-memory 借助外部 qmd；Vetta 插件 SDK 没有嵌入模型 API，这里用 BM25 关键词检索（拉丁词、`#tag`、`[[link]]`、CJK 单字与双字）。`memory_status` 会如实说明。
- **没有 Markdown 文件落盘。** 数据保存在插件私有存储（`~/.vetta/plugin-data/vetta-memory/`）：`memories.json`、`scratchpad.json`、`recovery.json`、`settings.json`、`daily/<日期>.json`。
- **宿主不向插件提供对话 transcript**，所以自动提取与会话总结基于插件自己在 `UserPromptSubmit` / `Stop` 中缓冲的最近 12 轮（每条截断到 1200 字符）。
- 会话总结在 `SessionEnd` 异步完成；应用直接退出时可能来不及写入。
- 新增：按项目记忆、置顶、自动学习（默认关闭）、疑似密钥（密码/token/私钥）拒绝保存、近似重复自动合并。

## 目录

```text
src/
├── index.tsx                          # 装配：提示词、工具、Hook、工作区视图
├── domain/                            # 存储、检索、提示词拼装、快照（纯逻辑，无 UI）
├── tools/                             # 7 个 Agent 工具与注册
├── hooks/                             # Hook 注册、自动提取、会话总结
├── prompt/                            # 系统提示词 Provider
├── features/memory-manager/           # 「记忆」页面（components / hooks）
├── shared/                            # 基础组件、样式常量、格式化
└── test/
```

## 开发

```bash
npm install
npm run check
npm test
npm run build
npm run install:vetta    # 打包并安装到正在运行的 Vetta
```
