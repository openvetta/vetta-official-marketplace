# Pelican Ride（鹈鹕骑车）

活动面板里骑自行车的鹈鹕。面板没有交互控件，状态只能经 Agent 工具 `pelican_bike_control` 修改。

## 能力边界

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 Tab `pelican` | Canvas 动画，显示当前速度与场景；`retention: "pinned"` 保持动画状态 |
| Agent 工具 `pelican_bike_control` | `speed`（0–10）、`jumps`（1–5）、`ringBell`（1–5）、`scene`（`day` / `dusk` / `night` / `rain`）可在一次调用中组合；全部省略时只查询状态 |
| 引导词 | 新会话页的三条示例指令，文案来自 `locales/` |

权限：`ui.slot.activity-tab`、`agent.tools.register`、`agent.toolHandler.execute`。不读写文件、存储或网络。

状态保存在模块内存（`src/domain/pelican-state.ts`），插件重新激活或应用重启后恢复初始值。
铃声由 Web Audio 实时合成，不包含音频文件。

## 目录

```text
src/
├── index.tsx                              # 装配：注册活动面板与 Agent 工具
├── domain/pelican-state.ts                # 共享状态：工具写入，动画循环读取
├── features/pelican-ride/
│   ├── components/pelican-panel.tsx       # 面板组件
│   ├── components/bike-icon.tsx           # Tab 图标
│   ├── hooks/use-pelican-animation.ts     # requestAnimationFrame 循环
│   └── services/                          # Canvas 绘制、铃声合成
├── tools/                                 # pelican_bike_control 及注册
└── test/
```

## 开发

```bash
npm install
npm run check
npm test
npm run build            # dist/ 必须提交
npm run install:vetta    # 打包并安装到正在运行的 Vetta
```
