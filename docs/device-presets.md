# 设备适配系数（调参表）

> 运行时以 `src/authoring/devicePresets.ts` 为准；本文件是给设计和产品调参用的说明。
> 调整时两处一起改，避免文档与实现漂移。

## 1. 设备预设

| 预设 | `kind` | `orientation` | `foldState` |
|---|---|---|---|
| Phone · 竖屏 | phone | portrait | — |
| Phone · 横屏 | phone | landscape | — |
| Tablet · 竖屏 | tablet | portrait | — |
| Tablet · 横屏 | tablet | landscape | — |
| Fold · 折叠 | fold | portrait | folded |
| Fold · 展开 | fold | portrait | unfolded |

设备条目只保存 `id / kind / orientation / foldState / metrics / mainLayoutId`。
`mainLayoutId` 绑定的是**基础布局（竖屏）**；横屏变体由布局组自动解析。

## 2. 布局解析规则

| 设备朝向 | 绑定的布局有横屏变体 | 编译使用 | 状态 |
|---|---|---|---|
| portrait | — | 基础布局 | — |
| landscape | 是 | `base.landscapeId` | 正常 |
| landscape | 否 | 基础布局（回退） | warning，不阻断导出 |

Schema 绑定仍指向**基础布局**；横屏设备编译出的 alias 会自动 `import_preset` 横屏变体。

## 3. 「横屏推荐」配方系数

作用于**设备级**覆盖（`device.metrics`），不改项目级 `project.metrics`。
基准值取 `project.metrics` 与编译默认值合并后的结果。

| 字段 | 系数 | 下限 | 默认基准 | 结果示例 |
|---|---|---|---|---|
| `keyboardHeight` | × 0.85 | 160 | 270 | 230 |
| `verticalGap` | × 0.90 | 0 | 3 | 3 |
| `candidateViewHeight` | × 0.90 | 24 | 44 | 40 |
| `popupBottomMargin` | × 0.75 | 4 | 8 | 6 |

不参与缩放的字段（保持继承或手填）：`keyHeight`、`keyWidth`、`horizontalGap`、
`keyTextSize`、`candidateTextSize`、`commentTextSize`、`popupWidth`、`popupHeight`、
`popupKeyHeight`、`popupTextSize`。

> 经验规则（写进设备步骤说明）：横屏通常只需要降低键盘高度、控制行数、
> 收紧 toolbar；结构差异放到「布局组的横屏变体」，不要用尺寸去模拟结构。

## 4. 横屏变体的派生规则

| 方式 | 行为 | 是否默认 |
|---|---|---|
| 克隆为横屏变体 | 全量复制基础布局，id 追加 `-landscape` | 是 |
| 精简派生 | 克隆后去掉最后一行，并把每行宽度校准到 100% | 否（需确认） |

变体与基础布局是独立的两个 `LayoutPreset`；编辑任一方不会自动同步另一方。
删除变体会清除 `base.landscapeId` 并移除该变体布局，横屏设备回退到基础布局。

## 5. 结构规则常量

| 常量 | 值 | 作用 |
|---|---|---|
| `simplifyAboveRows` | 4 | 行数大于该值时，「精简派生」会去掉最后一行 |
| `rowWidthTolerance` | 1.5 (%) | 行宽合计偏离 100% 超过该值才提示 |
| `landscapeSuffix` | `-landscape` | 横屏变体的 id 后缀；重名时追加 `-2`、`-3` |

## 6. 调参检查清单

1. 改完 `devicePresets.ts` 后跑 `npm run typecheck && npm test`。
2. 确认 `fixtures/golden/default-26.yaml` 无 diff（默认 bundle 不含变体）。
3. 至少手动走查：Phone 竖屏 + Phone 横屏 + Tablet 横屏 三张设备卡片。
4. 如果新增字段，同步更新本文件的表格和 `METRIC_DEFAULTS` / `LAYOUT_RULES`。
