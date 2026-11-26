# Trime Theme Editor

一个自包含的 [Trime](https://github.com/osfans/trime) 主题作者工具：用类型化 preset
（主题色卡 / 键盘布局 / 宏）组合项目，并编译成一份完整的 `trime.yaml`，通过复制或
下载导出。

[![ci](https://github.com/Jvcon/trime-theme-editor/actions/workflows/ci.yml/badge.svg)](https://github.com/Jvcon/trime-theme-editor/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/Jvcon/trime-theme-editor)](./LICENSE)

- 在线使用：`https://trime-theme-editor.<your-subdomain>.workers.dev`（部署后替换）
- 问题反馈：[Issues](https://github.com/Jvcon/trime-theme-editor/issues)

> 这是开发工具，不进入 Rime 安装包，也不替代 Android 真机测试。

## 特性

所有项目草稿与快照都保存在浏览器 IndexedDB 中，不经过服务器。

```text
① 主题 → ② 布局 → ③ 界面（可选）→ ④ 设备 → ⑤ 检查与导出
项目抽屉：项目 / 导入导出 / 快照
高级抽屉：schema 绑定 / 原始字段 / 概要
宏：可选工具，不占用主干步骤
```

### 项目与流程

- 着陆页：从模板开始 / 导入现有 `trime.yaml` / 打开最近项目
- 顶部步进器显示每一步的完成依据（✓ / ⚠ / ✗ / 使用默认），位置与可选状态一目了然
- 设备是必须步骤，但默认的 Phone·竖屏 即可通过，只需确认
- 界面与宏标记为可选；跳过不影响导出
- 项目抽屉：IndexedDB 保存 / 打开 / 删除、bundle v3 导入导出（兼容 v2）、trime.yaml 导入、快照
- 设备步骤：`phone / fold / tablet`、`portrait / landscape`、`folded / unfolded`；
  绑定布局组，只保存尺寸差异；三档适配（继承 / 横屏推荐 / 精细）
- Schema 绑定放在高级抽屉：`schema_id → keyset`，自动生成 alias keyboard
- 导入现有 `trime.yaml`（支持多文件、`__include` / `__patch`、`base:` 包装）
- 导入默认保留原始行宽；校准到 100% 为可选
- Import report：Mapped / Passthrough / Needs review / Dropped
- 未建模字段进入 bundle `passthrough`，编译时合并回输出
- 撤销 / 重做（`Cmd/Ctrl+Z`、`Shift+Cmd/Ctrl+Z`），危险操作先显示影响面

### 布局

- 布局组：主布局 + Pages 组合
- **不会自动删除你修改过的布局**：切换主布局、改设备后，旧的自定义布局进入「保留的布局」，可继续编辑、设为主布局或手动删除；保留的布局仍会编译进导出
- **横屏变体**：一个布局下可挂 `landscapeId`，横屏设备自动解析；未创建时回退竖屏并给 warning
- 变体可「克隆」或「精简派生」（去一行 + 行宽校准），只影响横屏
- 每处编辑显示「使用于哪些设备」的影响面
- 26 / 18 / 14 / 9 键、数字、符号内置布局
- 键盘预览、点击选键、长按 popup、双击 action（布局步骤在右侧预览中直接编辑）
- 键拖拽重排、跨行移动；Key 面板提供 `Row ↑/↓`
- 行新增/删除/排序、行高、键宽
- `Fit all` / `Reflow` / `Distribute` / `Fit 100%`
- Page / Key / Behavior / Style 设置
- Keycode、字符集、宏、Page、Toggle、Command、Preset key 选择器
- Popup 增删、排序、批量粘贴、anchored 预览
- 右侧常驻预览跟随设备与朝向；布局步骤中它同时是键盘编辑画布，编辑变体时自动切到横屏

### 主题 / 色卡

- 内置 Dracula / Alucard、Catppuccin Latte / Frappé / Macchiato / Mocha、
  Solarized Light / Dark、Material Light / Dark、Nord Light / Dark
- 浅色方案与深色方案分别选择，互不影响；色卡本身是一套单方案
- 修改内置色卡时自动复制为自定义方案；自定义方案显示“自定义”
- 自定义色卡保存在项目内，随 bundle 导出，切换选择不会丢失
- token 与 hover / pressed / disabled 状态覆盖
- 色卡复制 / 新建 / 删除 / 重命名
- Key style：键只引用 style type，style type 只引用色卡 token
- `default` 写入 `key_*`，`off` 写入 `off_key_*`；`modifier` / `enter` / `space` /
  自定义样式只写 `preset_keyboards` 的单键颜色
- 非 default 单键颜色按预览方向固化，不随浅色/深色方案自动切换
- style type 新增 / 复制 / 删除
- Metrics 与 popup 尺寸

### 界面（可选）

- Toolbar：primary button、按钮增删排序、action / long press / icon / size /
  background / foreground
- Liquid：single_width、margin_x、key_height、row、vertical_gap、
  fixed key bar、tabs（SINGLE / HISTORY / TABS / SYMBOL）
- Window：insets、item padding、radius、border、shadow、alpha、字号
- Preedit：padding、top radius、alpha、字号
- Toolbar / liquid 网格 / window / preedit 实时预览

### 宏（可选）

- 内置只读宏 + 用户新建 / 复制 / 删除
- text + keycode 步骤编辑
- 编译为 `preset_keys`

### 检查与导出

- 每个 device 一张检查卡片：编译布局、schema 状态、error / warning、复制 / 下载
- 顶部总状态（`2/3 可导出`）与「导出全部」；error 标记为不可导出但不硬阻断
- `manifest.json`：device、path、sha256、projectHash、editorVersion
- 官方 Trime JSON Schema（v3.3.13）校验，显示具体路径与错误
- 引用、行宽、popup/long_click、liquid tab、preset key、schema alias、
  横屏变体回退 校验
- 上传现有 `trime.yaml` 做归一化漂移对比：
  - `up to date` / 行级 diff
  - 同时校验上传文件的 schema
- 与任一快照对比（同一 device）：
  - YAML 行级 diff
  - 结构化 diff（Meta / Theme / Key styles / Layouts / Macros / Devices /
    Interface / Metrics / Preset keys）
  - 搜索、复制/下载 Markdown

> 目标 Trime 版本固定为 **v3.3.13**；官方 schema 与主题 fixture 位于
> `fixtures/trime/`。

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
ThemeCardPreset   单套色卡 token + 状态 + 可选 appearance/family
LayoutPreset      行、键、行为引用、style type、popup、可选 landscapeId
MacroPreset       text + keycode 序列
ProjectBundle v3  meta + theme { light, dark } + customThemeCards
                  + layouts/pages + macros + key styles
                  + chrome + devices + schemaBindings + fallbackColors
                  + customPresetKeys + passthrough
```

`ProjectBundle` 就是导出格式，也是编译输入。v3 把浅色、深色拆成两张独立色卡；
`variant` 只表示预览方向。编译时 `preset_color_schemes.light` 使用
`theme.light`，`.dark` 使用 `theme.dark`。项目保存实际使用的色卡、主布局、
页面布局和宏、你保留的自定义布局，以及用户创建的自定义色卡。
编译只读 bundle，不会回退到内置目录。内置 preset 只作为选择器目录存在。

横屏结构差异归布局（`layout.landscapeId`），尺寸差异归设备
（`device.metrics`）；「横屏推荐」的系数集中在
`src/authoring/devicePresets.ts`，调参表见
[`docs/device-presets.md`](./docs/device-presets.md)。

编译器把 bundle 展开为：

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
- bundle v3 可导入/导出（兼容 v2 导入），可直接入库、diff、复现
- 快照包为独立 JSON，可跨浏览器迁移
- 所有操作都在本地浏览器完成，不写盘、不上传

## 目录结构

```text
.
├── .github/workflows/
│   ├── ci.yml                 # typecheck + test + build
│   └── deploy.yml             # 构建并部署到 Cloudflare Workers
├── fixtures/golden/           # 编译产物 golden 文件
├── fixtures/trime/            # v3.3.13 官方 schema 与主题 fixture
├── docs/
│   └── device-presets.md      # 设备适配系数 / 结构规则调参表
├── public/
│   ├── _headers               # 静态资源缓存与安全响应头
│   └── favicon.svg
├── src/authoring/             # 编辑器主体：模型、编译器、面板
├── src/components/ui/         # shadcn/ui 基础组件
├── tests/                     # vitest 确定性 / golden 测试
├── index.html
├── package.json
├── vite.config.ts
├── vitest.config.ts
└── wrangler.jsonc             # Workers 静态资源配置
```

## 边界

- 不运行 Rime 引擎，不模拟 Android 字体、inset、真实 popup 定位和触感
- 导入会展开受支持的 `__include` / `__patch` 子集；不支持的 DSL 会进入 import report
- 未建模字段进入 passthrough；行分组仍按宽度推断，默认不再强制校准
- 结构化 diff 是只读的，不支持单条 Apply / Revert
- Liquid `TABS` 子 tab 由运行时决定
- 拖拽是桌面 HTML5 drag，触屏使用 Row ↑/↓ 或左右移动按钮

## License

[MIT](./LICENSE) © 2026 Jacques Yip

---

## English

A self-contained authoring tool for [Trime](https://github.com/osfans/trime)
themes. The editor follows a five-step flow — theme, layouts, interface
(optional), devices, check & export — with an explainable completion state
for every step. A layout can own an optional landscape variant (`landscapeId`),
so landscape structure is authored once instead of being rebuilt per device;
devices only bind a layout group and store size overrides. A persistent preview
follows the selected device and orientation. Compose typed presets (color
cards, keyboard layouts, macros), add phone / fold / tablet profiles, then
compile each device into a single `trime.yaml` plus a deterministic
`manifest.json`. Import supports multi-file `__include` / `__patch` themes,
keeps unmodelled fields in `passthrough`, and reports mapped / passthrough /
review / dropped entries. Generated output is validated against the pinned
Trime v3.3.13 JSON Schema, and an existing `trime.yaml` can be uploaded for
normalized drift comparison. Projects are stored as self-contained v3 bundles
(selected schemes, custom theme cards, and the presets actually used) and can
be exported/imported as JSON; v2 bundles are migrated on import.
Everything runs in the browser; deploy as static assets on Cloudflare Workers
with `npm run deploy`.
