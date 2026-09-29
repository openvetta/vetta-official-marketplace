# Build Apple Apps（构建 Apple App）

把 iOS 模拟器搬进活动面板，并随插件提供 SwiftUI 开发指南 Skill。插件只负责运行时门禁、拉起 `baguette serve`
并把它自带的控制台嵌入面板；设备操作、构建与安装由 Agent 通过 Skill 调用 `baguette`、`xcrun` 与 `xcodebuild` 完成。

## 能力边界

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 Tab | 按 cwd 在 Xcode / SwiftPM 工程中出现，内嵌 baguette 的模拟器控制台 |
| 工作区视图 | 设置页：运行时状态、服务控制、默认设备与面板选项 |
| Agent Skill `vetta-apple-app-dev-guide` | 单一入口，SwiftUI 组件、Liquid Glass 与性能审计指南放在 `references/` 按需展开 |

命令白名单只有 `baguette`。不注册 Agent 工具，不写用户文件，配置只存在插件自己的 storage。

## 运行要求

- macOS 与 Xcode（含模拟器运行时）
- baguette ≥ 0.1.97：`brew install baguette`。iOS 26 改过手势注入的调用约定，低版本会静默失效，插件读不出版本时按不兼容处理
- 服务端口由宿主分配，只监听 127.0.0.1，插件停用或退出 App 时回收

## 开发

```bash
npm install
npm run check
npm test
npm run build            # 本地预检；dist/ 与 release/ 不提交
npm run install:vetta    # 打包并安装到正在运行的 Vetta
```

来源：自 Vetta 0.5.60 起从 OpenVetta 系统插件（`packages/plugins/presets/build-apple-apps`）迁出，插件 id 保持不变，
已有用户重新安装后沿用原来的插件存储。
