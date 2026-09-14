# 鹈鹕骑车插件

本目录是一个**自包含的 Vetta 插件工程**，也是能力市场里的一个上架条目。开发时 `cd` 进这里，
所有工具命令都作用于「最近的那个 `plugin.json`」，不必关心仓库其它部分。功能与目录说明见 `README.md`。

## 先读手册，再写代码

不要凭记忆写 SDK API。手册随 `@vetta-org/plugin-sdk` 装进本目录的 `node_modules`，用命令定位
（**不要硬编码路径**）：

```bash
npm install
npx vetta-plugin-cli docs
```

它打印手册目录绝对路径与对应的 SDK 版本。先读 `README.md`，实现扩展点前再读对应章节
（本插件用到 `ui-slots.md` 的活动面板与 `conversation-and-agent.md` 的 registerTool / i18n）。

## 构建与验证

```bash
npm run check          # tsc --noEmit
npm test               # vitest
npm run build          # 产出 dist/ 与 release/vetta-tihu-<version>.zip
npm run install:vetta  # 装进正在运行的 Vetta
```

**`dist/` 必须提交进仓库**：桌面端按 `plugin.json` 的 `entry` / `styles` 直接读这个目录安装，
它不会替你构建。少了产物就是「本地能装、市场上装不了」。

## 本插件的约定

- 用户可见文案全部走 `locales/en.json` 与 `locales/zh.json`：宿主渲染的字符串写 `%key%`，
  组件内用 `useTranslation().t("key")`，两份 catalog 的 key 保持一致。
- 发给模型的工具 `description` 与参数说明用英文；「不该用它」的反向触发段必须保留。
- 样式只用 Tailwind `className`，`style.css` 只保留 Tailwind 入口。
- 可能失败的路径（Canvas、Web Audio、打开面板）必须 `ctx.ui.notify({ message, error })` 上报。

## 改了版本之后

`plugin.json`、`package.json`、`ability.json` 与 `.vetta/marketplace.json` 里本条目的 `version`
必须**完全相等**，否则宿主同步直接失败。改完回仓库根对账：

```bash
npx @vetta-org/plugin-cli sync          # 回填索引并推进 marketplaceVersion
npx @vetta-org/plugin-cli sync --check  # 只报不写（CI 用的就是这条）
```

## 其余规则看仓库根

上架条目的身份、展示层（`ability.json` / `detail*.json`）、多语言、体积与安全限制、
`marketplaceVersion` 发布规则，全部在仓库根 `AGENTS.md`，那份是本仓库的最高规范。
