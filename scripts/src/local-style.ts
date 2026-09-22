import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { parse } from "smol-toml";
import { getTheme } from "./themes.js";
import type { Theme } from "./types.js";

const execFileAsync = promisify(execFile);

type Appearance = "light" | "dark";

export type ThemeResolution = {
  theme: Theme;
  source: "local-codex" | "named" | "fallback";
  appearance?: Appearance;
  configPath?: string;
  reason?: string;
};

type ResolveLocalOptions = {
  configPath?: string;
  systemAppearance?: Appearance;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function hexToRgb(color: string): [number, number, number] | null {
  const match = color.trim().match(/^#([0-9a-f]{6})$/i);
  if (!match) return null;
  const value = Number.parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(
  first: string,
  second: string,
  secondWeight: number,
  fallback: string,
): string {
  const a = hexToRgb(first);
  const b = hexToRgb(second);
  if (!a || !b) return fallback;
  const channel = (index: number) =>
    Math.round(a[index] * (1 - secondWeight) + b[index] * secondWeight);
  return `#${[0, 1, 2].map((index) => channel(index).toString(16).padStart(2, "0")).join("")}`;
}

async function detectSystemAppearance(): Promise<Appearance> {
  if (process.platform !== "darwin") return "light";
  try {
    const { stdout } = await execFileAsync("defaults", [
      "read",
      "-g",
      "AppleInterfaceStyle",
    ]);
    return stdout.trim().toLowerCase() === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function supportedUiFont(value: unknown): string {
  const configured = typeof value === "string" ? value : "";
  return /\b(Geist|Inter)\b/i.test(configured)
    ? "Geist, Noto Sans SC"
    : "Noto Sans SC";
}

export async function resolveLocalCodexTheme(
  options: ResolveLocalOptions = {},
): Promise<ThemeResolution> {
  const configPath =
    options.configPath ?? join(homedir(), ".codex", "config.toml");
  try {
    const config = record(parse(await readFile(configPath, "utf8")));
    const desktop = record(config.desktop);
    const preference = stringValue(
      desktop.appearanceTheme,
      "system",
    ).toLowerCase();
    const appearance: Appearance =
      preference === "dark" || preference === "light"
        ? preference
        : (options.systemAppearance ?? (await detectSystemAppearance()));
    const chrome = record(
      desktop[
        appearance === "dark"
          ? "appearanceDarkChromeTheme"
          : "appearanceLightChromeTheme"
      ],
    );
    const fonts = record(chrome.fonts);
    const surface = stringValue(
      chrome.surface,
      appearance === "dark" ? "#111111" : "#ffffff",
    );
    const ink = stringValue(
      chrome.ink,
      appearance === "dark" ? "#fcfcfc" : "#0d0d0d",
    );
    const chromeAccent = stringValue(
      chrome.accent,
      appearance === "dark" ? "#6ea8e8" : "#3a83f7",
    );
    const bodySize = numberValue(desktop.sansFontSize, 16);
    const codeSize = numberValue(desktop.codeFontSize, 14);
    const dark = appearance === "dark";
    const border = mix(
      surface,
      ink,
      dark ? 0.16 : 0.1,
      dark ? "#343434" : "#e5e5e5",
    );
    const codeBackground = mix(
      surface,
      ink,
      dark ? 0.08 : 0.05,
      dark ? "#232323" : "#f3f3f3",
    );
    const muted = mix(
      surface,
      ink,
      dark ? 0.64 : 0.55,
      dark ? "#a5a5a5" : "#777777",
    );
    const userBackground = dark ? mix(surface, ink, 0.12, "#2d2d2d") : ink;

    return {
      source: "local-codex",
      appearance,
      configPath,
      theme: {
        name: `local-codex-${appearance}`,
        label: `Local Codex ${appearance === "dark" ? "Dark" : "Light"}`,
        background: surface,
        foreground: ink,
        muted,
        accent: chromeAccent,
        link: chromeAccent,
        listMarker: ink,
        userBackground,
        userForeground: dark ? ink : surface,
        assistantBackground: "transparent",
        assistantForeground: ink,
        border,
        codeBackground,
        codeForeground: ink,
        frameBackground: "transparent",
        frameShadow: "none",
        frame: "none",
        layout: "native",
        tableStyle: "native",
        fontFamily: supportedUiFont(fonts.ui),
        bodyFontSize: bodySize * 1.375,
        codeFontSize: codeSize * 1.215,
        titleFont: supportedUiFont(fonts.ui),
      },
    };
  } catch (error) {
    return {
      source: "fallback",
      configPath,
      reason: error instanceof Error ? error.message : String(error),
      theme: getTheme("codex-ink"),
    };
  }
}

export async function resolveExportTheme(
  requested?: string,
): Promise<ThemeResolution> {
  if (requested && requested !== "local-codex") {
    return { source: "named", theme: getTheme(requested) };
  }
  return resolveLocalCodexTheme();
}
