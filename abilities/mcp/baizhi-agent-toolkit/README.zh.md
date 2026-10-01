# 百智云 Agent Toolkit

此可选能力使 Vetta 通过 Streamable HTTP 连接百智云托管的 Agent Toolkit MCP 服务：<https://agent-toolkit.app.baizhi.cloud/mcp>。请在[百智云控制台](https://agent-toolkit.app.baizhi.cloud/)创建自己的 Key；在 Vetta 安装表单中仅输入 Key 本身，`mcp.json` 会组装 `Authorization: Bearer {value}`。不要把真实 Key 放入仓库、Issue、提示词或日志。

[百智云集成仓库](https://github.com/chaitin/baizhi-agent-toolkit)以 MIT 许可公开客户端配置和文档，不包含托管后端源码。服务条款、密钥权限和可能费用独立计算。本包不设置工具白名单；实际可用工具取决于账号及 Key 权限，部分工具可能消耗额度或产生副作用。使用前请在控制台和 Vetta 中核对工具列表及额度。工具输入会离开 Vetta 发往托管服务，返回内容也可能依客户端设置交给模型提供方。

Vetta 按现有设置机制保存已安装的 MCP 配置。安装表单中的敏感输入遮罩不等于承诺落盘加密；请使用限定权限的 Key 并保护本地配置及备份。接入或凭据问题请参考[上游集成文档](https://github.com/chaitin/baizhi-agent-toolkit)，账号问题通过百智云控制台处理。

卡片图像为未修改的百智云官方产品标识，来源和校验和见 [BRAND-ASSET.md](BRAND-ASSET.md)；市场仓的 MIT 许可不转让该标识的权利。
