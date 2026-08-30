# 知乎搜索

通过社区维护的 [zhihu-search](https://github.com/klarkxy/zhihu-search) 接入知乎开放平台的搜索、直答和热榜。
可以搭配“知乎检索指南”，也可以单独使用工具；这不是知乎官方发布的客户端。

## 配置方式

1. 安装一次 [uv](https://docs.astral.sh/uv/getting-started/installation/)，使 Vetta 的 PATH 能找到 `uvx`，
   修改 PATH 后重启 Vetta。Vetta 不负责安装 uv。
2. 在[知乎开发者平台](https://developer.zhihu.com/)创建 Access Secret。
3. 安装此能力，在密码参数弹窗填写 Secret。服务通过 `ZHIHU_ACCESS_SECRET` 接收，不会复制到 CLI 凭据文件。

固定启动命令：`uvx --from zhihu-search==2.0.0 zhihu-search serve --tools compact`。
首次启动需要联网下载包和依赖，需要 Python 3.10+；uv 可按自身下载策略获取兼容解释器。
若首次下载较慢导致 Vetta 连接超时，可在自己的终端执行
`uvx --from zhihu-search==2.0.0 zhihu-search --version` 完成包准备后重新连接；该命令不请求知乎业务接口。
不需要 Node.js 或手动下载源码。

## 工具范围

初始展示 `search`、`ask`、`trending`、`other`。`other` 可在当前会话展开额度、用户数据、知识库及 PDF/PPT 等低频工具，
所以这不是只读白名单；仅在明确要求时使用扩展功能，沿用 Vetta 的工具审批。本地文件上传和 OAuth token 交换不通过 MCP 提供。

请求可能消耗知乎额度。不要把凭据发到聊天或日志中。排查找不到命令时，可以在本地执行 `uvx --version`，
验证安装不需要调用真实知乎接口。

## 来源与许可

直接使用 [PyPI 2.0.0](https://pypi.org/project/zhihu-search/2.0.0/)，不修改 Python 源码；固定顶层包版本，
间接依赖由 uv 解析，本仓库未锁定。上游使用
[SATA 2.0](https://github.com/klarkxy/zhihu-search/blob/2246138b8c04a7d1647beaf23381468f63aa1bfe/LICENSE)，
请注意其中的点赞与致谢条款。感谢 Klarkxy。
