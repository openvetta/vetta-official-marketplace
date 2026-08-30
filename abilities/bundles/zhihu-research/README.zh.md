# 知乎调研：接入与排查说明

本文面向需要高级设置、问题排查或维护集成的人。Vetta 详情页使用独立的[产品介绍](detail.zh.json)，
不直接展示这份技术说明；另有[英文详情](detail.json)。

结合检索指南与调用工具，研究中文社区观点、真实体验、口碑和当前热点。底层使用
[Klarkxy 的 zhihu-search](https://github.com/klarkxy/zhihu-search)：这是对接知乎开放平台的
社区项目，并非知乎官方发布的客户端。

## 选择安装成员

- **知乎检索指南**：按任务选择搜索、直答或热榜，整理来源；已有配套工具时直接复用，不重复执行 CLI 查询。
- **知乎搜索**：提供本地 stdio MCP 服务，默认 `compact` 模式展示 `search`、`ask`、`trending` 和会话级 `other` 开关。

推荐同时选择，也可以只安装其中一个。组合入口本身没有独立进程或凭据，安装使用 Vetta 现有的成员选择弹窗；
各成员仍能独立安装、卸载和启停。
「发现」中只展示“知乎调研”入口；两个成员可从这里打开详情，安装后在「我的」中分别更新、卸载和启停。

## 首次使用

1. 安装 [uv](https://docs.astral.sh/uv/getting-started/installation/)，确保 Vetta 可见的 PATH 中有 `uvx`；
   修改 PATH 后重启 Vetta。Vetta 不会替你安装 uv。
2. 在[知乎开发者平台](https://developer.zhihu.com/)创建 Access Secret。
3. 安装所选成员。选择“知乎搜索”后，在 Vetta 的密码输入框填写 Secret，服务通过环境变量
   `ZHIHU_ACCESS_SECRET` 接收；不要把 Secret 发到聊天中。
4. 发起具体问题，例如：“查一下中文开发者社区对 RAG 评测方法的讨论，给出三个来源链接。”

服务固定执行 `uvx --from zhihu-search==2.0.0 zhihu-search serve --tools compact`。uv 首次启动时下载固定版本的 Python 包和依赖；
需要 Python 3.10 或以上，uv 可按自身的 Python 下载策略获取兼容解释器。首次使用需要访问软件包源，耗时可能较长。
不需要 Node.js、手动克隆仓库、全局安装 Python 包，也不运行能力仓库提供的安装脚本。

## 凭据与权限边界

只安装指南时，需要用户单独配置 CLI 凭据。MCP 的 Secret 不会自动共享给 CLI，指南不得读取 Vetta 配置提取凭据。
配套服务被关闭或断开时，应在 Vetta 中配置并启用，不能通过 CLI 绕过该状态。

搜索、直答和热榜请求可能消耗上游额度。`compact` 只是精简初始工具目录，**不代表只读权限隔离**：
`other` 能在当前会话展开用户数据、知识库、PDF/PPT 和额度工具，仅在用户明确要求对应功能时使用。
本地文件上传和 OAuth token 交换不暴露为 MCP 工具。沿用 Vetta 的工具审批策略，不预先自动批准调用。

## 来源与许可

Python 实现直接使用 PyPI 2.0.0，不修改源码。指南基于上游提交
`2246138b8c04a7d1647beaf23381468f63aa1bfe` 做 Vetta 适配，包内记录来源并保留 SATA 2.0 许可。
感谢 Klarkxy；分发前请查看上游许可，包括其中的点赞与致谢条款。本次集成不会代用户给仓库点赞。
