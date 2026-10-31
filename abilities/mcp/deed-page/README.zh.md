# deed.page

此可选能力使 Vetta 通过 Streamable HTTP 连接托管的 deed.page MCP 服务：<https://deed.page/mcp>。Vetta 可以把自己生成的 HTML 页面或小型静态站点发布到公开的 `https://<slug>.deed.page/` 地址，之后再更新、列出或删除。安装时不需要账号、邮箱或 API Key。

安装表单只有一个可选字段，首次使用请留空：第一次调用 `publish_site` 时，工具结果会返回所有者令牌（`deed_tok_…`），Vetta 可在同一对话的后续调用中把它作为 `token` 参数传入。若希望跨对话把所有站点放在同一所有者下，可把该令牌填入此字段，`mcp.json` 会以 `Authorization: Bearer {value}` 发送。持有令牌的人可以修改或删除这些站点，请不要把它写进本仓库、Issue、对外分享的提示词、已发布页面或日志。Vetta 按现有设置机制保存 MCP 配置；输入遮罩不等于承诺落盘加密。

已发布页面对任何拿到链接的人公开，工具输入（要发布的文件）会离开 Vetta 发往托管服务。`ttl_seconds` 可生成到期自动失效的页面，不填则长期保留。免费版对站点数、大小和每小时发布次数有限制，免费站点右下角会显示一个小的 “Published with deed.page” 链接；付费方案及价格见 <https://deed.page/pricing>。超出限制时错误中会附带升级链接，Vetta 应把它原样展示给用户，不要自行重试或付款。

文档：<https://deed.page/docs>。MIT 许可的 Agent 技能和插件：<https://github.com/f-o-x11/deed-page-skill>。服务由 Avatar 8 LLC 运营；图标从 deed.page 加载，市场仓的 MIT 许可不授予 deed.page 名称或标识的任何权利。
