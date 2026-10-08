# Build Apple Apps（构建 Apple App）

把 iOS 模拟器搬进活动面板，并随插件提供 SwiftUI 开发指南 Skill。插件只负责拉起
[serve-sim](https://github.com/EvanBacon/serve-sim)（OpenAI Codex 的 Build iOS Apps 插件使用的同一个模拟器镜像）
并把它自带的预览页嵌入面板；构建、安装、启动与检查由 Agent 通过 Skill 调用 `xcrun simctl` 与 `xcodebuild` 完成。

## 能力边界

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 Tab | 按 cwd 在 Xcode / SwiftPM 工程中出现，内嵌 serve-sim 的模拟器预览页 |
| 工作区视图 | 设置页：运行时状态、服务控制、默认设备与面板选项 |
| Agent Skill `vetta-apple-app-dev-guide` | 单一入口，SwiftUI 组件、Liquid Glass 与性能审计指南放在 `references/` 按需展开 |

命令白名单只有 `npx`，用来启动版本固定的 `serve-sim`（见 `src/runtime/serve-sim-command.ts`）；宿主把它交给自带的
Node 运行时，用户无需另装任何东西。不注册 Agent 工具，Skill 也不提及 serve-sim，Agent 只使用 Xcode 自带的工具。
不写用户文件，配置只存在插件自己的 storage。

## 运行要求

- Apple Silicon Mac 与 Xcode（含模拟器运行时）；serve-sim 的辅助程序只提供 arm64 版本
- 首次启动从 npm 下载 serve-sim（约 5 MB）；没有已启动的模拟器时它会自动启动一台
- Xcode 27 上键盘输入需要 Device Hub 中的模拟器窗口可见，并在「隐私与安全性 → 辅助功能」中允许 Vetta
- 服务端口由宿主分配，插件停用或退出 App 时回收

键盘诊断：serve-sim 以 `NSUnbufferedIO=YES` 启动，插件运行期间读取它的输出；出现
`[hid] Device Hub keyboard unavailable … ; using legacy HID` 时在面板顶部提示原因（见 `parseKeyboardIssue`）。
macOS 27.0.1 + Xcode 27.0 上 serve-sim 0.1.47 拿不到 Device Hub 进程号，键盘输入不可用，修复见
[EvanBacon/serve-sim#164](https://github.com/EvanBacon/serve-sim/pull/164)，发布后提升版本即可。

升级 serve-sim：修改 `SERVE_SIM_PACKAGE` 的版本，在窄面板里核对预览页布局与 `Local:` 输出格式后再发布。

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
