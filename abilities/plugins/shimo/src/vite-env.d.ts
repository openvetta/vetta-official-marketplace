/// <reference types="vite/client" />

// theme-ui 以 TS 源码发布，其中用了 Vite 的 `?url` 资源导入后缀（provider 图标）。
// 没有这条引用，tsc 会在 node_modules 里的那些 import 上报 TS2307。
