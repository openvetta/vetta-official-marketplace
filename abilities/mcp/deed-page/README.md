# deed.page

This optional Ability connects Vetta to the hosted deed.page MCP server at <https://deed.page/mcp> (Streamable HTTP). It lets Vetta publish HTML pages or small static sites that it has built to a public `https://<slug>.deed.page/` URL, then update, list or delete them. No account, email or API key is needed to install it.

The install form has one optional field. Leave it empty the first time: the first `publish_site` call returns an owner token (`deed_tok_…`) in the tool result, and Vetta can pass it as the `token` argument for later calls in the same conversation. To keep every site under one owner across conversations, paste that token into the field; `mcp.json` sends it as `Authorization: Bearer {value}`. Anyone with the token can change or delete those sites, so do not put it in this repository, an issue, a prompt you share, a published page or a log. Vetta stores MCP configuration through its existing settings mechanism; the masked input is not a promise of encrypted storage.

Published pages are public to anyone with the link. Tool inputs (the files to publish) leave Vetta for the hosted service. `ttl_seconds` gives an expiring page; omit it for a permanent one. The Free plan has limits on sites, size and publishes per hour, and Free sites show a small "Published with deed.page" link; paid plans and their prices are listed at <https://deed.page/pricing>. A limit error includes an upgrade link; Vetta should show it to the user and not retry or pay on its own.

Documentation: <https://deed.page/docs>. The MIT agent skill and plugin are at <https://github.com/f-o-x11/deed-page-skill>. The service is operated by Avatar 8 LLC; the icon is loaded from deed.page and the marketplace's MIT license does not grant rights in the deed.page name or mark.
