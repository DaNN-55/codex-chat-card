export type ConversationRound = {
  index: number;
  turnId: string;
  timestamp?: string;
  user: string;
  assistant: string;
};

export type ConversationDocument = {
  sessionId: string;
  sourcePath: string;
  rounds: ConversationRound[];
};

export type ExportMode = "branded" | "minimal" | "clean";
export type MockupMode = "none" | "codex-window";
export type ContentView = "conversation" | "user" | "codex";

export const DEFAULT_EXPORT_MODE: ExportMode = "minimal";
export const DEFAULT_MOCKUP_MODE: MockupMode = "codex-window";

export type ThemeName =
  | "codex-ink"
  | "warm-editorial"
  | "frosted-indigo"
  | "raycast-night";

export type Theme = {
  name: string;
  label: string;
  background: string;
  foreground: string;
  muted: string;
  accent: string;
  link: string;
  listMarker: string;
  userBackground: string;
  userForeground: string;
  assistantBackground: string;
  assistantForeground: string;
  border: string;
  codeBackground: string;
  codeForeground: string;
  frameBackground: string;
  frameShadow: string;
  frame: "none" | "sheet" | "window";
  layout: "native" | "classic";
  tableStyle: "native" | "grid";
  fontFamily: string;
  bodyFontSize: number;
  codeFontSize: number;
  titleFont: string;
};
