import type { CSSProperties, ReactNode } from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadEmojiAssets, loadFonts } from "./assets.js";
import { markdownDisplayText, markdownImageSources, renderMarkdown } from "./markdown.js";
import { answerActions, chromeIcon } from "./icons.js";
import { loadImageAssets, type ImageAssets } from "./images.js";
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
const MAX_CANVAS_HEIGHT = 50000;

function checkCanvasHeight(height: number): void {
  if (height > MAX_CANVAS_HEIGHT) {
    throw new Error(
      "The selected conversation is too large for a single safe canvas. Export a smaller selection.",
    );
  }
}

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
  imageBaseDirectory?: string;
};

function logicalLength(text: string): number {
  return Array.from(text).length;
}

function estimatedTextHeight(
  text: string,
  charsPerLine: number,
  lineHeight: number,
): number {
  return markdownDisplayText(text)
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
  checkCanvasHeight(padded);
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
  if (mode !== "branded") return null;
  const { theme } = options;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: "42px",
        borderBottom: `1px solid ${theme.border}`,
        marginBottom: "32px",
        color: theme.foreground,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: theme.fontFamily,
          fontSize: "14px",
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
        justifyContent: minimal ? "center" : "space-between",
        flexWrap: "wrap",
        gap: "6px 12px",
        minHeight: "32px",
        borderTop: minimal ? "none" : `1px solid ${theme.border}`,
        color: theme.muted,
        fontFamily: theme.fontFamily,
        fontSize: "11px",
        marginTop: minimal ? "14px" : "8px",
        overflowWrap: "anywhere",
      }}
    >
      <div style={{ display: "flex" }}>
        {minimal ? "" : "Made with "}{options.brandName ?? "codex-chat-card"}
      </div>
      {minimal ? <div style={{ display: "flex" }}>·</div> : null}
      <div style={{ display: "flex", maxWidth: "100%" }}>{repository}</div>
    </div>
  );
}

function roundCard(
  round: ConversationRound,
  theme: Theme,
  emoji: Awaited<ReturnType<typeof loadEmojiAssets>>,
  content: ContentView,
  mockup: MockupMode,
  images: ImageAssets,
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
  const contentWidth = mockup === "codex-window" ? 1054 : theme.frame === "none" ? 1096 : 1006;
  return (
    <div
      key={round.turnId}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: showUser && showCodex ? (classic ? "14px" : "48px") : "0",
      }}
    >
      {showUser ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <div
            style={{
              ...bubbleBase,
              ...(classic ? { width: "82%" } : { maxWidth: "78%" }),
              padding: classic ? "20px 22px" : "18px 24px",
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
                images,
                imageMaxWidth: Math.floor(contentWidth * (classic ? 0.82 : 0.78) - 48),
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
                images,
                imageMaxWidth: classic ? Math.floor(contentWidth * 0.91 - 44) : contentWidth,
              })}
              {mockup === "codex-window" ? answerActions(theme.muted) : null}
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

function codexWindow(
  content: ReactNode,
  theme: Theme,
  title?: string,
): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: theme.background,
        border: `1px solid ${theme.border}`,
        borderRadius: "28px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.035)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          minHeight: "100px",
          padding: "30px 28px 24px",
          color: theme.foreground,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "22px",
            width: "196px",
            flexShrink: 0,
            paddingTop: "6px",
          }}
        >
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((color) => (
            <div
              key={color}
              style={{
                display: "flex",
                width: "14px",
                height: "14px",
                borderRadius: "999px",
                background: color,
              }}
            />
          ))}
          </div>
          <div style={{ display: "flex", gap: "20px", opacity: 0.85 }}>
            {chromeIcon("sidebar", theme.muted)}
            {chromeIcon("compose", theme.muted)}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexGrow: 1,
            flexShrink: 1,
            minWidth: 0,
            justifyContent: "center",
            textAlign: "center",
            fontFamily: theme.titleFont,
            fontSize: "28px",
            fontWeight: 700,
            lineHeight: 1.35,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {title || "Codex"}
        </div>
        <div style={{ display: "flex", width: "196px", flexShrink: 0 }} />
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "22px 48px 48px",
        }}
      >
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

export async function renderToSvg(options: RenderOptions): Promise<string> {
  const fonts = await loadFonts();
  const emoji = await loadEmojiAssets(
    options.rounds.flatMap((round) => [round.user, round.assistant]),
  );
  const { theme } = options;
  const mockup = options.mockup ?? DEFAULT_MOCKUP_MODE;
  const contentView = options.content ?? "conversation";
  const visibleText = options.rounds.flatMap((round) => [
    ...(contentView !== "codex" ? [round.user] : []),
    ...(contentView !== "user" ? [round.assistant] : []),
  ]);
  const images = await loadImageAssets(visibleText.flatMap(markdownImageSources), options.imageBaseDirectory);
  const content = (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {mockup === "none" ? header(options) : null}
      <div style={{ display: "flex", flexDirection: "column", gap: theme.layout === "classic" ? "32px" : "64px" }}>
        {options.rounds.map((round) =>
          roundCard(round, theme, emoji, contentView, mockup, images),
        )}
      </div>
    </div>
  );
  const presentation =
    mockup === "codex-window"
      ? codexWindow(content, theme, options.title)
      : frame(content, theme);
  const outerPadding = mockup === "codex-window" ? 24 : OUTER_PADDING;
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
  // Keep the early size guard, but let layout determine the actual height.
  // A fixed estimate can clip wrapped titles or rich multi-line messages.
  estimateHeight(options.rounds, theme, mockup, contentView);
  const svg = await satori(tree, { width: WIDTH, fonts });
  const height = Number(svg.match(/^<svg[^>]* height="([0-9.]+)"/)?.[1]);
  checkCanvasHeight(height);
  return svg;
}

export async function renderToPng(options: RenderOptions): Promise<Buffer> {
  const svg = await renderToSvg(options);
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng(),
  );
}
