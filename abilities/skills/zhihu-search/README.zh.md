# 知乎检索指南

为中文社区调研选择合适路径：需要可核查来源时搜索，需要综合解释时直答，需要当前讨论时查看热榜。
输出来源并说明证据不足，不为纯仓库代码问题、翻译或逻辑题自动调用外部接口，除非用户明确要求外部证据。

## 在 Vetta 中使用

可单独安装，也可在“知乎调研”中选择。搭配“知乎搜索”时直接复用可见的 `zhihu-search-mcp` 工具，不重复发起 CLI 查询。
只安装指南不会安装服务，也不会自动安装 Python/uv。

独立 CLI 使用需要 PATH 中可用的 [uv](https://docs.astral.sh/uv/getting-started/installation/)、Python 3.10+
（uv 可获取）、网络和单独配置的凭据。所有 CLI 示例均固定 `zhihu-search==2.0.0`。
MCP 的 Secret 不自动共享给 CLI，指南不得通过读取 Vetta 文件提取凭据。
技术配置见包内 [setup and diagnostics](references/setup.md)。

用户数据、知识库、上传、PDF/PPT 和 OAuth 操作需要用户明确要求。真实查询可能消耗上游额度，不将其用作自动健康检查。

## 来源与许可

基于 [Klarkxy 的上游指南](https://github.com/klarkxy/zhihu-search/tree/2246138b8c04a7d1647beaf23381468f63aa1bfe/skills/zhihu-search) 适配；
`upstream.json` 记录精确提交和调整范围，不改动 Python 实现。保留[原 SATA 2.0 许可](LICENSE)，包括点赞与致谢条款。
感谢 Klarkxy。这是社区项目，并非知乎官方客户端。
