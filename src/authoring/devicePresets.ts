import type { DeviceKind, FoldState, Orientation, ProjectMetrics } from "./types";

/**
 * Device adaptation coefficients.
 *
 * This file is the single runtime source of truth. The human-editable tuning
 * table lives in `docs/device-presets.md`; update both together.
 */

export type DevicePresetOption = {
  label: string;
  kind: DeviceKind;
  orientation: Orientation;
  foldState?: FoldState;
};

export const DEVICE_PRESET_OPTIONS: DevicePresetOption[] = [
  { label: "Phone · 竖屏", kind: "phone", orientation: "portrait" },
  { label: "Phone · 横屏", kind: "phone", orientation: "landscape" },
  { label: "Tablet · 竖屏", kind: "tablet", orientation: "portrait" },
  { label: "Tablet · 横屏", kind: "tablet", orientation: "landscape" },
  { label: "Fold · 折叠", kind: "fold", orientation: "portrait", foldState: "folded" },
  { label: "Fold · 展开", kind: "fold", orientation: "portrait", foldState: "unfolded" },
];

/** Placeholder values, mirroring the compiler defaults. */
export const METRIC_DEFAULTS: Record<keyof ProjectMetrics, number> = {
  keyWidth: 10,
  keyHeight: 52,
  keyboardHeight: 270,
  horizontalGap: 2,
  verticalGap: 3,
  candidateViewHeight: 44,
  candidateTextSize: 18,
  commentTextSize: 12,
  keyTextSize: 22,
  popupWidth: 44,
  popupHeight: 56,
  popupKeyHeight: 48,
  popupTextSize: 22,
  popupBottomMargin: 8,
};

/**
 * "横屏推荐" recipe. It writes concrete overrides so the result stays visible
 * and editable; it never mutates the project-level metrics.
 */
export const LANDSCAPE_RECIPE = {
  keyboardHeight: 0.85,
  verticalGap: 0.9,
  candidateViewHeight: 0.9,
  popupBottomMargin: 0.75,
  popupBottomMarginFloor: 4,
} as const;

export function applyLandscapeRecipe(base: ProjectMetrics | undefined): ProjectMetrics {
  const merged = { ...METRIC_DEFAULTS, ...(base ?? {}) };
  return {
    keyboardHeight: Math.max(160, Math.round(merged.keyboardHeight * LANDSCAPE_RECIPE.keyboardHeight)),
    verticalGap: Math.max(0, Math.round(merged.verticalGap * LANDSCAPE_RECIPE.verticalGap)),
    candidateViewHeight: Math.max(24, Math.round(merged.candidateViewHeight * LANDSCAPE_RECIPE.candidateViewHeight)),
    popupBottomMargin: Math.max(
      LANDSCAPE_RECIPE.popupBottomMarginFloor,
      Math.round(merged.popupBottomMargin * LANDSCAPE_RECIPE.popupBottomMargin),
    ),
  };
}

export function isLandscapeRecipe(metrics: ProjectMetrics | undefined, base: ProjectMetrics | undefined): boolean {
  if (!metrics) return false;
  const recipe = applyLandscapeRecipe(base);
  return Object.entries(recipe).every(([key, value]) => metrics[key as keyof ProjectMetrics] === value);
}

/**
 * Structural rules shared by the layout editor and the validator.
 * Tuning table: docs/device-presets.md.
 */
export const LAYOUT_RULES = {
  /** Rows above this count can be trimmed by "精简派生". */
  simplifyAboveRows: 4,
  /** Suffix appended to a base layout id for its landscape variant. */
  landscapeSuffix: "-landscape",
} as const;
