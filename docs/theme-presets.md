# 内置主题色卡

> 运行时以 `src/authoring/presets.ts` 为准；本文件记录来源、token 映射和色值，
> 方便设计与实现对齐。

## 1. 数据模型

一张色卡就是**一套方案**，不再内含 light/dark 两个 variant。项目分别选择：

```ts
theme: {
  light: ThemeCardPreset;
  dark: ThemeCardPreset;
}
```

`variant` 只表示预览方向。编译时：

- `preset_color_schemes.light` ← `theme.light`
- `preset_color_schemes.dark` ← `theme.dark`

每张卡提供 12 个 token：

`bg / surface / surfaceAlt / border / text / textMuted / primary / onPrimary /
accent / danger / success / warning`

状态统一派生：

| 状态 | surface | text |
|---|---|---|
| `hover` | `surfaceAlt` | — |
| `pressed` | `primary` | `onPrimary` |
| `disabled` | `surfaceAlt` | `textMuted` |

## 2. 来源

| family | 来源 |
|---|---|
| Dracula / Alucard | https://github.com/dracula/dracula-theme（README 的 OSS palette） |
| Catppuccin | https://github.com/catppuccin/catppuccin（官方 palette） |
| Solarized | https://github.com/altercation/solarized（官方 palette） |
| Material / Nord | 保留项目原有内置值，按单方案拆分 |

Catppuccin 的 `catppuccin/squirrel` 用于确认四个 flavour，但色值不直接照搬
Squirrel 的 `#AABBGGRR` 候选条配置，而是使用官方 palette 映射到 Trime token。

## 3. 色卡清单

| id | 显示名 | family | appearance |
|---|---|---|---|
| `dracula` | Dracula | Dracula | dark |
| `alucard` | Alucard | Dracula | light |
| `catppuccin-latte` | Catppuccin Latte | Catppuccin | light |
| `catppuccin-frappe` | Catppuccin Frappé | Catppuccin | dark |
| `catppuccin-macchiato` | Catppuccin Macchiato | Catppuccin | dark |
| `catppuccin-mocha` | Catppuccin Mocha | Catppuccin | dark |
| `solarized-light` | Solarized Light | Solarized | light |
| `solarized-dark` | Solarized Dark | Solarized | dark |
| `material-light` | Material Light | Material | light |
| `material-dark` | Material Dark | Material | dark |
| `nord-light` | Nord Light | Nord | light |
| `nord-dark` | Nord Dark | Nord | dark |

`appearance` 只用于默认值和排序，不在色卡本身上显示 light/dark 标签。

## 4. 基础 token

| 方案 | bg | surface | surfaceAlt | border | text | textMuted | onPrimary |
|---|---|---|---|---|---|---|---|
| Dracula | `#282a36` | `#44475a` | `#343746` | `#6272a4` | `#f8f8f2` | `#b8b8c8` | `#282a36` |
| Alucard | `#fffbeb` | `#f5eedd` | `#cfcfde` | `#d8d0bc` | `#1f1f1f` | `#6c664b` | `#fffbeb` |
| Catppuccin Latte | `#dce0e8` | `#eff1f5` | `#ccd0da` | `#acb0be` | `#4c4f69` | `#6c6f85` | `#dce0e8` |
| Catppuccin Frappé | `#232634` | `#303446` | `#414559` | `#626880` | `#c6d0f5` | `#a5adce` | `#232634` |
| Catppuccin Macchiato | `#181926` | `#24273a` | `#363a4f` | `#5b6078` | `#cad3f5` | `#a5adcb` | `#181926` |
| Catppuccin Mocha | `#11111b` | `#1e1e2e` | `#313244` | `#585b70` | `#cdd6f4` | `#a6adc8` | `#11111b` |
| Solarized Light | `#fdf6e3` | `#eee8d5` | `#e3dcc8` | `#d5cdb6` | `#657b83` | `#93a1a1` | `#fdf6e3` |
| Solarized Dark | `#002b36` | `#073642` | `#0e3f4b` | `#586e75` | `#93a1a1` | `#839496` | `#002b36` |
| Material Light | `#fafafa` | `#ffffff` | `#f0f0f0` | `#d0d0d0` | `#212121` | `#757575` | `#ffffff` |
| Material Dark | `#121212` | `#1e1e1e` | `#2a2a2a` | `#3d3d3d` | `#e8e8e8` | `#a0a0a0` | `#0d47a1` |
| Nord Light | `#eceff4` | `#ffffff` | `#e5e9f0` | `#d8dee9` | `#2e3440` | `#4c566a` | `#eceff4` |
| Nord Dark | `#2e3440` | `#3b4252` | `#434c5e` | `#4c566a` | `#eceff4` | `#d8dee9` | `#2e3440` |

## 5. 强调色

| 方案 | primary | accent | danger | success | warning |
|---|---|---|---|---|---|
| Dracula | `#bd93f9` | `#ff79c6` | `#ff5555` | `#50fa7b` | `#f1fa8c` |
| Alucard | `#644ac9` | `#a3144d` | `#cb3a2a` | `#14710a` | `#846e15` |
| Catppuccin Latte | `#8839ef` | `#ea76cb` | `#d20f39` | `#40a02b` | `#df8e1d` |
| Catppuccin Frappé | `#ca9ee6` | `#f4b8e4` | `#e78284` | `#a6d189` | `#e5c890` |
| Catppuccin Macchiato | `#c6a0f6` | `#f5bde6` | `#ed8796` | `#a6da95` | `#eed49f` |
| Catppuccin Mocha | `#cba6f7` | `#f5c2e7` | `#f38ba8` | `#a6e3a1` | `#f9e2af` |
| Solarized Light | `#268bd2` | `#d33682` | `#dc322f` | `#859900` | `#b58900` |
| Solarized Dark | `#268bd2` | `#d33682` | `#dc322f` | `#859900` | `#b58900` |
| Material Light | `#1976d2` | `#e91e63` | `#d32f2f` | `#388e3c` | `#f57c00` |
| Material Dark | `#90caf9` | `#f48fb1` | `#ef9a9a` | `#a5d6a7` | `#ffcc80` |
| Nord Light | `#5e81ac` | `#b48ead` | `#bf616a` | `#a3be8c` | `#ebcb8b` |
| Nord Dark | `#88c0d0` | `#b48ead` | `#bf616a` | `#a3be8c` | `#ebcb8b` |

## 6. 自定义与迁移

- 修改内置色卡时自动复制为自定义方案，原内置方案保持不变。
- 自定义方案进入项目 `customThemeCards`，随 bundle 导出。
- v2 bundle 的 `theme.variants.light/dark` 在 `normalizeBundle` 中拆成两张卡：
  - token 与某张新内置卡一致时复用内置卡；
  - 否则生成 `split-<id>-light/dark` 自定义卡，保留原色值。

## 7. 样式输出与已知限制

`preset_color_schemes` 只输出 Trime 支持的颜色键：

- `default` → `key_*`
- `off` → `off_key_*`
- `on` → `on_key_*`（如果存在该样式）

`modifier / enter / space / 自定义样式` 不会写入 scheme，而是作为单键颜色写入
`preset_keyboards`。`off` 同时会写入 `off_key_*`，但编辑器里的 off 键仍会写入
单键颜色，保证导出后在 Trime 中外观一致。所有非 default 单键颜色会按当前
预览方向（`variant`）固化，不随浅色/深色 scheme 自动切换；浅色/深色 scheme
仍分别使用 `theme.light` / `theme.dark`。这样既保留编辑器的样式便利，也不会
输出 Trime 不识别的无效 scheme 字段。
