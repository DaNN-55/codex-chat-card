import type { CSSProperties, ReactNode } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadEmojiAssets, loadFonts } from "./assets.js";
import { renderMarkdown } from "./markdown.js";
import {
  DEFAULT_EXPORT_MODE,
  DEFAULT_MOCKUP_MODE,
  type ContentView,
  type ConversationRound,
  type ExportMode,
  type MockupMode,
  type Theme,
} from "./types.js";

const WIDTH = 1200;
const OUTER_PADDING = 52;

export type RenderOptions = {
  title?: string;
  theme: Theme;
  rounds: ConversationRound[];
  createdAt?: Date;
  mode?: ExportMode;
  mockup?: MockupMode;
  content?: ContentView;
  brandName?: string;
  repository?: string;
};

function logicalLength(text: string): number {
  return Array.from(text).length;
}

function estimatedTextHeight(
  text: string,
  charsPerLine: number,
  lineHeight: number,
): number {
  return text
    .split("\n")
    .reduce(
      (total, line) =>
        total +
        Math.max(1, Math.ceil(logicalLength(line) / charsPerLine)) * lineHeight,
      0,
    );
}

function estimateHeight(
  rounds: ConversationRound[],
  theme: Theme,
  mockup: MockupMode,
  content: ContentView,
): number {
  let height = theme.frame === "window" ? 230 : 160;
  if (mockup === "codex-window") height += 82;
  const lineHeight = theme.bodyFontSize * 1.75;
  for (const round of rounds) {
    height += content === "conversation" ? 150 : 90;
    if (content !== "codex")
      height += estimatedTextHeight(round.user, 38, lineHeight);
    if (content !== "user") {
      height += estimatedTextHeight(round.assistant, 34, lineHeight);
      const tableLines = round.assistant
        .split("\n")
        .filter((line) => /^\s*\|.*\|\s*$/.test(line)).length;
      height += tableLines * 24;
    }
  }
  height += 80;
  const padded = Math.ceil(height * 1.18);
  if (padded > 50000) {
    throw new Error(
      "The selected conversation is too large for a single safe canvas. Export a smaller selection.",
    );
  }
  return Math.max(720, padded);
}

function header(options: RenderOptions): ReactNode {
  if (!options.title) return null;
  const { theme } = options;
  return (
    <div
      style={{
        display: "flex",
        fontFamily: theme.titleFont,
        fontSize: "34px",
        fontWeight: 700,
        letterSpacing: "-0.4px",
        color: theme.foreground,
        marginBottom: "34px",
      }}
    >
      {options.title}
    </div>
  );
}

function brandHeader(options: RenderOptions): ReactNode {
  const mode = options.mode ?? DEFAULT_EXPORT_MODE;
  if (mode === "clean") return null;
  const { theme } = options;
  const minimal = mode === "minimal";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: minimal ? "36px" : "42px",
        borderBottom: `1px solid ${theme.border}`,
        marginBottom: minimal ? "28px" : "32px",
        color: theme.foreground,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: theme.fontFamily,
          fontSize: minimal ? "13px" : "14px",
          fontWeight: 600,
          letterSpacing: "-0.1px",
        }}
      >
        {options.brandName ?? "codex-chat-card"}
      </div>
    </div>
  );
}

function brandFooter(options: RenderOptions): ReactNode {
  const mode = options.mode ?? DEFAULT_EXPORT_MODE;
  if (mode === "clean") return null;
  const { theme } = options;
  const minimal = mode === "minimal";
  const repository = options.repository ?? "github.com/DaNN-55/codex-chat-card";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: minimal ? "flex-end" : "space-between",
        height: minimal ? "28px" : "32px",
        borderTop: `1px solid ${theme.border}`,
        color: theme.muted,
        fontFamily: theme.fontFamily,
        fontSize: minimal ? "10px" : "11px",
        marginTop: minimal ? "0" : "2px",
      }}
    >
      {minimal ? null : (
        <div style={{ display: "flex" }}>
          Made with {options.brandName ?? "codex-chat-card"}
        </div>
      )}
      <div style={{ display: "flex" }}>{repository}</div>
    </div>
  );
}

function roundCard(
  round: ConversationRound,
  theme: Theme,
  emoji: Awaited<ReturnType<typeof loadEmojiAssets>>,
  content: ContentView,
): ReactNode {
  const bubbleBase: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    borderRadius: "20px",
    padding: "20px 22px",
    border: `1px solid ${theme.border}`,
  };
  const classic = theme.layout === "classic";
  const showUser = content !== "codex";
  const showCodex = content !== "user";
  return (
    <div
      key={round.turnId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: showUser && showCodex ? (classic ? "14px" : "24px") : "0",
        marginBottom: classic ? "32px" : "48px",
      }}
    >
      {showUser ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              ...bubbleBase,
              width: classic ? "82%" : "78%",
              background: theme.userBackground,
              color: theme.userForeground,
              borderRadius: classic ? "20px 20px 7px 20px" : "18px",
              border: classic ? `1px solid ${theme.border}` : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {renderMarkdown(round.user, {
                theme,
                emoji,
                foreground: theme.userForeground,
                keyPrefix: `u-${round.index}`,
              })}
            </div>
          </div>
        </div>
      ) : null}
      {showCodex ? (
        <div style={{ display: "flex", justifyContent: "flex-start" }}>
          <div
            style={
              classic
                ? {
                    ...bubbleBase,
                    width: "91%",
                    background: theme.assistantBackground,
                    color: theme.assistantForeground,
                    borderRadius: "20px 20px 20px 7px",
                  }
                : {
                    display: "flex",
                    flexDirection: "column",
                    width: "100%",
                    padding: "2px 4px",
                    color: theme.assistantForeground,
                  }
            }
          >
            <div style={{ display: "flex", flexDirection: "column" }}>
              {renderMarkdown(round.assistant, {
                theme,
                emoji,
                foreground: theme.assistantForeground,
                keyPrefix: `a-${round.index}`,
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function windowBar(theme: Theme): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "48px",
        padding: "0 17px",
        borderBottom: `1px solid ${theme.border}`,
        background: "rgba(255,255,255,0.78)",
      }}
    >
      <div style={{ display: "flex", gap: "8px" }}>
        <div
          style={{
            display: "flex",
            width: "11px",
            height: "11px",
            borderRadius: "999px",
            background: "#ff5f57",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "11px",
            height: "11px",
            borderRadius: "999px",
            background: "#febc2e",
          }}
        />
        <div
          style={{
            display: "flex",
            width: "11px",
            height: "11px",
            borderRadius: "999px",
            background: "#28c840",
          }}
        />
      </div>
    </div>
  );
}

function visibleLineCount(text: string, charsPerLine: number): number {
  return text
    .split("\n")
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(logicalLength(line) / charsPerLine)),
      0,
    );
}

export function waterfallBarCount(
  rounds: ConversationRound[],
  content: ContentView = "conversation",
): number {
  const visibleMessagesPerRound = content === "conversation" ? 2 : 1;
  const visibleLines = rounds.reduce((total, round) => {
    let roundLines = 0;
    if (content !== "codex") roundLines += visibleLineCount(round.user, 38);
    if (content !== "user")
      roundLines += visibleLineCount(round.assistant, 34);
    return total + roundLines;
  }, 0);
  const count = Math.round(
    visibleLines * 0.75 + rounds.length * visibleMessagesPerRound,
  );
  return Math.max(6, Math.min(80, count));
}

function waterfallWidths(seed: string, count: number): number[] {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619);
  }
  return Array.from({ length: count }, (_, index) => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    const random = Math.abs(state);
    if (index < 12) return 14 + (random % 9);
    if (index < count - 2) return 7 + (random % 7);
    return 8 + (random % 4);
  });
}

function waterfallRail(theme: Theme, seed: string, count: number): ReactNode {
  const widths = waterfallWidths(seed, count);
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: "16px",
        top: "50%",
        transform: "translateY(-50%)",
        width: "24px",
        flexDirection: "column",
        gap: "7px",
        alignItems: "flex-start",
      }}
    >
      {widths.map((width, index) => (
        <div
          key={`waterfall-${index}`}
          style={{
            display: "flex",
            width: `${width}px`,
            height: "2px",
            borderRadius: "2px",
            background: theme.muted,
            opacity:
              index >= widths.length - 2 ? 0.8 : 0.28 + (index % 4) * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function codexWindow(
  content: ReactNode,
  theme: Theme,
  seed: string,
  waterfallCount: number,
): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: theme.background,
        border: `1px solid ${theme.border}`,
        borderRadius: "18px",
        boxShadow: "0 18px 46px rgba(0,0,0,0.10)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          height: "42px",
          padding: "0 15px",
          borderBottom: `1px solid ${theme.border}`,
          background: theme.codeBackground,
          color: theme.foreground,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            width: "72px",
          }}
        >
          <div
            style={{
              display: "flex",
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: "#ff5f57",
            }}
          />
          <div
            style={{
              display: "flex",
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: "#febc2e",
            }}
          />
          <div
            style={{
              display: "flex",
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              background: "#28c840",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            justifyContent: "center",
            fontFamily: theme.fontFamily,
            fontSize: "12px",
            fontWeight: 600,
            color: theme.muted,
          }}
        >
          Codex
        </div>
        <div style={{ display: "flex", width: "72px" }} />
      </div>
      <div
        style={{
          display: "flex",
          position: "relative",
          flexDirection: "column",
          padding: "34px 36px 20px 86px",
        }}
      >
        {waterfallRail(theme, seed, waterfallCount)}
        {content}
      </div>
    </div>
  );
}

function frame(content: ReactNode, theme: Theme): ReactNode {
  if (theme.frame === "none") return content;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: theme.frameBackground,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.frame === "window" ? "19px" : "6px",
        boxShadow: theme.frameShadow,
      }}
    >
      {theme.frame === "window" ? windowBar(theme) : null}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding:
            theme.frame === "window" ? "34px 36px 22px" : "42px 44px 28px",
        }}
      >
        {content}
      </div>
    </div>
  );
}

function trimCanvas(svg: string): string {
  const svgTag = svg.match(
    /<svg[^>]*height="([0-9.]+)"[^>]*viewBox="0 0 1200 ([0-9.]+)"/,
  );
  const background = svg.match(
    /<rect x="0" y="0" width="1200" height="([0-9.]+)" fill="[^"]*"(?: fill-opacity="[^"]*")?\/>/,
  );
  if (!svgTag || !background) return svg;
  const [, canvasHeight, viewBoxHeight] = svgTag;
  const [, contentHeight] = background;
  if (Number(contentHeight) >= Number(canvasHeight)) return svg;
  return svg
    .replace(`height="${canvasHeight}"`, `height="${contentHeight}"`)
    .replace(
      `viewBox="0 0 1200 ${viewBoxHeight}"`,
      `viewBox="0 0 1200 ${contentHeight}"`,
    );
}

export async function renderToSvg(options: RenderOptions): Promise<string> {
  const fonts = await loadFonts();
  const emoji = await loadEmojiAssets(
    options.rounds.flatMap((round) => [round.user, round.assistant]),
  );
  const { theme } = options;
  const mockup = options.mockup ?? DEFAULT_MOCKUP_MODE;
  const contentView = options.content ?? "conversation";
  const content = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {header(options)}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {options.rounds.map((round) =>
          roundCard(round, theme, emoji, contentView),
        )}
      </div>
    </div>
  );
  const presentation =
    mockup === "codex-window"
      ? codexWindow(
          content,
          theme,
          options.rounds.map((round) => round.turnId).join("|"),
          waterfallBarCount(options.rounds, contentView),
        )
      : frame(content, theme);
  const outerPadding = mockup === "codex-window" ? 32 : OUTER_PADDING;
  const tree = (
    <div
      style={{
        width: `${WIDTH}px`,
        display: "flex",
        flexDirection: "column",
        background: theme.background,
        padding: `${outerPadding}px`,
        color: theme.foreground,
        fontFamily: theme.fontFamily,
      }}
    >
      {brandHeader(options)}
      {presentation}
      {brandFooter(options)}
    </div>
  );
  return trimCanvas(
    await satori(tree, {
      width: WIDTH,
      height: estimateHeight(options.rounds, theme, mockup, contentView),
      fonts,
    }),
  );
}

export async function renderToPng(options: RenderOptions): Promise<Buffer> {
  const svg = await renderToSvg(options);
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng(),
  );
}
