# Trime Theme Editor

一个自包含的 [Trime](https://github.com/osfans/trime) 主题作者工具：用类型化 preset
（主题色卡 / 键盘布局 / 宏）组合项目，并编译成一份完整的 `trime.yaml`，通过复制或
下载导出。

[![ci](https://github.com/Jvcon/trime-theme-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/Jvcon/trime-theme-editor/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/Jvcon/trime-theme-editor)](./LICENSE)

- 在线使用：`https://trime-theme-editor.<your-subdomain>.workers.dev`（部署后替换）
- 主配置仓库：[Jvcon/rime-enhanced-config](https://github.com/Jvcon/rime-enhanced-config)
- 问题反馈：[Issues](https://github.com/Jvcon/trime-theme-editor/issues)

> 这是开发工具，不进入 Rime 安装包，也不替代 Android 真机测试。

## 特性

编辑器不读取、不写入任何 `rime/` 目录，也不依赖 Python 或仓库外的主题脚本。
所有项目草稿与快照都保存在浏览器 IndexedDB 中，不经过服务器。

```text
Basic / Layouts / Themes / Interface / Macros / Export
```

### Basic

- 主题 meta：名称、作者、描述、config version
- 选择主题色卡、light/dark variant、主布局
- 项目列表：IndexedDB 保存 / 打开 / 删除
- 项目 JSON 导入 / 导出
- 导入现有 `trime.yaml`（含 `base:` 包装的 `rime/trime.base.yaml`）
- 快照：命名创建、保存前自动快照、恢复、删除、JSON/YAML 导出、快照包导入导出
- 组合摘要

### Layouts

- 主布局 + Pages 组合
- 26 / 18 / 14 / 9 键、数字、符号内置布局
- 键盘预览、点击选键、长按 popup、双击 action
- 键拖拽重排、跨行移动；Key 面板提供 `Row ↑/↓`
- 行新增/删除/排序、行高、键宽
- `Fit all` / `Reflow` / `Distribute` / `Fit 100%`
- Page / Key / Behavior / Style 设置
- Keycode、字符集、宏、Page、Toggle、Command、Preset key 选择器
- Popup 增删、排序、批量粘贴、anchored 预览

### Themes

- Dracula / Material / Nord 内置色卡
- light/dark token 与 hover / pressed / disabled 状态覆盖
- 色卡复制 / 新建 / 删除
- Key style：键只引用 style type，style type 只引用色卡 token
- style type 新增 / 复制 / 删除
- Metrics 与 popup 尺寸

### Interface

- Toolbar：primary button、按钮增删排序、action / long press / icon / size /
  background / foreground
- Liquid：single_width、margin_x、key_height、row、vertical_gap、
  fixed key bar、tabs（SINGLE / HISTORY / TABS / SYMBOL）
- Window：insets、item padding、radius、border、shadow、alpha、字号
- Preedit：padding、top radius、alpha、字号
- Toolbar / liquid 网格 / window / preedit 实时预览

### Macros

- 内置只读宏 + 用户新建 / 复制 / 删除
- text + keycode 步骤编辑
- 编译为 `preset_keys`

### Export

- 唯一产物：完整单文件 `trime.yaml`
- 复制 / 下载
- 引用、行宽、popup/long_click、liquid tab、preset key 校验
- 与任一快照对比：
  - YAML 行级 diff
  - 结构化 diff（Meta / Theme / Key styles / Layouts / Macros / Interface /
    Metrics / Preset keys）
  - 搜索、复制/下载 Markdown

## 本地开发

需要 Node.js >= 22.12.0。

```bash
npm install
npm run dev
# http://127.0.0.1:5173
```

构建与本地预览：

```bash
npm run build
npm run preview
```

类型检查：

```bash
npm run typecheck
```

## 部署到 Cloudflare Workers

项目使用 Cloudflare Workers 的静态资源能力，`wrangler.jsonc` 已配置为
SPA 回退（`not_found_handling: single-page-application`）。

### 方式一：本地手动部署

```bash
npx wrangler login
npm run deploy
```

首次部署会创建名为 `trime-theme-editor` 的 Worker。部署成功后可在
Cloudflare Dashboard 的 Workers & Pages 中看到访问地址，形如：

```text
https://trime-theme-editor.<your-subdomain>.workers.dev
```

也可以在本地验证 Worker 静态资源：

```bash
npm run cf:dev
```

### 方式二：GitHub Actions 自动部署

在仓库的 **Settings → Secrets and variables → Actions** 中添加：

| Secret | 说明 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token，至少包含 `Workers Scripts:Edit` 与 `Account Settings:Read` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

之后每次推送到 `main`，或手动运行 `deploy` workflow，都会构建并部署。
`ci` workflow 只做类型检查与构建，不需要 Cloudflare 凭据。

### 自定义域名

如需绑定自定义域名，可在 `wrangler.jsonc` 中增加 `routes`，或直接在
Cloudflare Dashboard 的 Worker 设置中配置 Custom Domain。

## 数据模型

```text
ThemeCardPreset   色卡 token + 状态
LayoutPreset      行、键、行为引用、style type、popup
MacroPreset       text + keycode 序列
ProjectDoc        meta + 色卡 + key styles + layouts/pages + macros + chrome
```

编译器把项目展开为：

```yaml
config_version
name
author
style
window
preedit
tool_bar
fallback_colors
preset_color_schemes
preset_keys
preset_keyboards
liquid_keyboard
```

## 存储与隐私

- 项目草稿与快照存 IndexedDB
- 项目 JSON 可导入/导出
- 快照包为独立 JSON，可跨浏览器迁移
- 所有操作都在本地浏览器完成，不写盘、不上传

## 目录结构

```text
.
├── .github/workflows/
│   ├── ci.yml                 # typecheck + build
│   └── deploy.yml             # 构建并部署到 Cloudflare Workers
├── public/
│   ├── _headers               # 静态资源缓存与安全响应头
│   └── favicon.svg
├── src/authoring/             # 编辑器主体：模型、编译器、面板
├── src/components/ui/         # shadcn/ui 基础组件
├── index.html
├── package.json
├── vite.config.ts
└── wrangler.jsonc             # Workers 静态资源配置
```

## 边界

- 不运行 Rime 引擎，不模拟 Android 字体、inset、真实 popup 定位和触感
- 导入现有主题是近似转换：行分组按宽度推断、颜色映射为语义 token
- 结构化 diff 是只读的，不支持单条 Apply / Revert
- Liquid `TABS` 子 tab 由运行时决定
- 拖拽是桌面 HTML5 drag，触屏使用 Row ↑/↓ 或左右移动按钮

## License

[MIT](./LICENSE) © 2026 Jacques Yip

---

## English

A self-contained authoring tool for [Trime](https://github.com/osfans/trime)
themes. Compose typed presets (color cards, keyboard layouts, macros) and
compile them into a single `trime.yaml`. Everything runs in the browser;
projects are stored in IndexedDB. Deploy as static assets on Cloudflare
Workers with `npm run deploy`.
