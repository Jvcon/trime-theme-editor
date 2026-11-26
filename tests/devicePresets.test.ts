import { describe, expect, it } from "vitest";
import { LANDSCAPE_RECIPE, METRIC_DEFAULTS, applyLandscapeRecipe, isLandscapeRecipe } from "../src/authoring/devicePresets";

describe("landscape recipe", () => {
  it("matches the documented coefficients", () => {
    expect(applyLandscapeRecipe({
      keyboardHeight: 270,
      verticalGap: 3,
      candidateViewHeight: 44,
      popupBottomMargin: 8,
    })).toEqual({
      keyboardHeight: 230,
      verticalGap: 3,
      candidateViewHeight: 40,
      popupBottomMargin: 6,
    });
  });

  it("falls back to compiler defaults and respects floors", () => {
    const result = applyLandscapeRecipe(undefined);
    expect(result.keyboardHeight).toBe(Math.round(METRIC_DEFAULTS.keyboardHeight * LANDSCAPE_RECIPE.keyboardHeight));
    expect(result.keyboardHeight).toBeGreaterThanOrEqual(160);
    expect(result.popupBottomMargin).toBeGreaterThanOrEqual(LANDSCAPE_RECIPE.popupBottomMarginFloor);
  });

  it("detects its own output", () => {
    const recipe = applyLandscapeRecipe(undefined);
    expect(isLandscapeRecipe(recipe, undefined)).toBe(true);
    expect(isLandscapeRecipe({ ...recipe, keyboardHeight: (recipe.keyboardHeight ?? 0) + 1 }, undefined)).toBe(false);
  });
});
