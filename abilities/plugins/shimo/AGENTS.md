# 石墨文档插件

本目录是一个**自包含的 Vetta 插件工程**，也是能力市场里的一个上架条目。开发时 `cd` 进这里，
所有工具命令都作用于「最近的那个 `plugin.json`」，不必关心仓库其它部分。

## 先读手册，再写代码

不要凭记忆写 SDK API。手册随 `@vetta-org/plugin-sdk` 装进本目录的 `node_modules`，用命令定位
（**不要硬编码路径**）：

```bash
npm install
npx vetta-plugin-cli docs        # 装依赖后可用；未装时用 npx @vetta-org/plugin-cli docs
```

它打印手册目录绝对路径与对应的 SDK 版本。手册与 SDK 同版本发布，因此它描述的合同**就是本
工程即将编译的合同**。

> ⚠️ 本工程目前钉的是 `@vetta-org/plugin-sdk@^0.2.0`，**早于手册随包发布的 0.3.1**，所以
> `docs` 现在会报找不到。升级到 `^0.3.1` 之前，按仓库根 `AGENTS.md` 的规范写，SDK API 以
> 已安装版本的 `.d.ts` 为准。升级涉及 0.3.0 的破坏性变更（私有存储合同、自有模型 Provider、
> 移除设置页配置槽），要逐项对照 CHANGELOG。

## 构建与验证

```bash
npm run build          # 产出 dist/
npm run check          # tsc --noEmit
npm test
```

**`dist/` 必须提交进仓库**：桌面端按 `plugin.json` 的 `entry` / `styles` 直接读这个目录安装，
它不会替你构建。少了产物就是「本地能装、市场上装不了」。

## 改了版本之后

`plugin.json` 的 `version` 必须与 `.vetta/marketplace.json` 里本条目的 `version` **完全相等**，
否则宿主同步直接失败。改完回仓库根对账：

```bash
npx @vetta-org/plugin-cli sync          # 回填索引并推进 marketplaceVersion
npx @vetta-org/plugin-cli sync --check  # 只报不写（CI 用的就是这条）
```

仓库根没有 `node_modules`，所以在根上执行时用全名 `@vetta-org/plugin-cli`。

## 其余规则看仓库根

上架条目的身份、展示层（`ability.json` / `detail*.json`）、多语言、体积与安全限制、
`marketplaceVersion` 发布规则，全部在仓库根 `AGENTS.md`，那份是本仓库的最高规范。
