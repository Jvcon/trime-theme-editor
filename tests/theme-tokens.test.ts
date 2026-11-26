import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/index.css", import.meta.url), "utf8");

type Tokens = Record<string, string>;

function readBlock(selector: string): Tokens {
  const match = css.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([\\s\\S]*?)\\n\\}`));
  if (!match) throw new Error(`Missing ${selector} token block`);
  return Object.fromEntries(
    [...match[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((entry) => [entry[1], entry[2].trim()]),
  );
}

function rgb(value: string): [number, number, number] {
  if (value.startsWith("#") && value.length === 7) {
    return [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) as [number, number, number];
  }
  const channels = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length !== 3) throw new Error(`Unsupported color: ${value}`);
  return channels as [number, number, number];
}

function luminance(color: [number, number, number]): number {
  const [red, green, blue] = color.map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(foreground: string, background: string): number {
  const first = luminance(rgb(foreground));
  const second = luminance(rgb(background));
  const [light, dark] = first > second ? [first, second] : [second, first];
  return (light + 0.05) / (dark + 0.05);
}

function tint(color: string, base: string, alpha: number): string {
  const [red, green, blue] = rgb(color);
  const [baseRed, baseGreen, baseBlue] = rgb(base);
  const mix = (channel: number, baseChannel: number) => Math.round(alpha * channel + (1 - alpha) * baseChannel);
  return `rgb(${mix(red, baseRed)}, ${mix(green, baseGreen)}, ${mix(blue, baseBlue)})`;
}

const modes = [
  ["light", readBlock(":root")],
  ["dark", readBlock(".dark")],
] as const;

const textPairs = [
  ["foreground", "background"],
  ["foreground", "card"],
  ["foreground", "popover"],
  ["muted-foreground", "background"],
  ["muted-foreground", "card"],
  ["muted-foreground", "muted"],
  ["primary", "card"],
  ["primary", "background"],
  ["primary-foreground", "primary"],
  ["secondary-foreground", "secondary"],
  ["accent-foreground", "accent"],
  ["destructive", "card"],
  ["success", "card"],
  ["warning", "card"],
  ["destructive-foreground", "destructive"],
  ["success-foreground", "success"],
  ["warning-foreground", "warning"],
] as const;

const nonTextPairs = [
  ["input", "card"],
  ["input", "background"],
  ["ring", "card"],
  ["ring", "background"],
] as const;

describe("semantic theme tokens", () => {
  it("defines both supported modes and the shared semantic names", () => {
    for (const [, tokens] of modes) {
      for (const name of ["background", "foreground", "card", "primary", "muted-foreground", "border", "input", "ring", "success", "warning", "destructive"]) {
        expect(tokens[name], `${name} should be tokenized`).toBeTruthy();
      }
    }
  });

  for (const [mode, tokens] of modes) {
    it(`${mode} mode keeps text pairs at WCAG AA contrast`, () => {
      for (const [foreground, background] of textPairs) {
        expect(contrast(tokens[foreground], tokens[background]), `${mode}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
      }
      for (const token of ["primary", "success", "warning", "destructive"]) {
        for (const alpha of [0.12, 0.15, 0.2]) {
          expect(
            contrast(tokens[token], tint(tokens[token], tokens.card, alpha)),
            `${mode}: ${token} on ${Math.round(alpha * 100)}% tint`,
          ).toBeGreaterThanOrEqual(4.5);
        }
      }
    });

    it(`${mode} mode keeps control boundaries and focus rings at 3:1`, () => {
      for (const [foreground, background] of nonTextPairs) {
        expect(contrast(tokens[foreground], tokens[background]), `${mode}: ${foreground} on ${background}`).toBeGreaterThanOrEqual(3);
      }
    });
  }
});
