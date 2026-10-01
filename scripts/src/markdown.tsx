import { Fragment, type CSSProperties, type ReactNode } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import emojiRegex from "emoji-regex";
import type { EmojiAssets } from "./assets.js";
import type { Theme } from "./types.js";
import type { ImageAssets } from "./images.js";

const parser = unified().use(remarkParse).use(remarkGfm);

type RenderContext = {
  theme: Theme;
  emoji: EmojiAssets;
  foreground: string;
  keyPrefix: string;
  images?: ImageAssets;
  imageMaxWidth?: number;
};

function parseMarkdown(text: string): any {
  const tree = parser.parse(text) as any;
  const definitions = new Map<string, string>();
  const walk = (node: any, visit: (node: any) => void) => {
    visit(node);
    for (const child of node.children ?? []) walk(child, visit);
  };
  walk(tree, (node) => { if (node.type === "definition") definitions.set(node.identifier, node.url); });
  walk(tree, (node) => {
    if (node.type === "imageReference" && definitions.has(node.identifier)) {
      node.type = "image";
      node.url = definitions.get(node.identifier);
    }
  });
  return tree;
}

export function markdownImageSources(text: string): string[] {
  const sources: string[] = [];
  const visit = (node: any) => {
    if (node.type === "image" && typeof node.url === "string") sources.push(node.url);
    for (const child of node.children ?? []) visit(child);
  };
  visit(parseMarkdown(text));
  return sources;
}

// Image destinations may contain large base64 payloads; they are not visible text.
export function markdownDisplayText(text: string): string {
  const replacements: { start: number; end: number; value: string }[] = [];
  const visit = (node: any) => {
    if ((node.type === "image" || node.type === "definition") && node.position) {
      replacements.push({ start: node.position.start.offset, end: node.position.end.offset,
        value: node.type === "image" ? `[图片${node.alt ? `：${node.alt}` : ""}]` : "" });
    } else for (const child of node.children ?? []) visit(child);
  };
  visit(parseMarkdown(text));
  let result = text;
  for (const entry of replacements.sort((a, b) => b.start - a.start)) {
    result = result.slice(0, entry.start) + entry.value + result.slice(entry.end);
  }
  return result;
}

function renderImage(node: any, context: RenderContext, key: string, maxWidth = context.imageMaxWidth ?? 1000): ReactNode {
  const asset = context.images?.get(node.url);
  if (!asset || !("data" in asset)) {
    return <div key={key} style={{ display: "flex", flexDirection: "column", width: `${maxWidth}px`, maxWidth: "100%", padding: "18px", border: `1px dashed ${context.theme.border}`, borderRadius: "12px", color: context.foreground, fontSize: "18px" }}>
      <div style={{ display: "flex", overflowWrap: "anywhere" }}>图片不可用 · {node.alt || "图片"}</div>
      <div style={{ display: "flex", marginTop: "6px", color: context.theme.muted, fontSize: "14px" }}>{asset && "reason" in asset ? asset.reason : "图片未加载"}</div>
    </div>;
  }
  const scale = Math.min(1, maxWidth / asset.width, 640 / asset.height);
  const width = Math.max(1, Math.floor(asset.width * scale));
  const height = Math.max(1, Math.floor(asset.height * scale));
  return <div key={key} style={{ display: "flex", width: `${width}px`, maxWidth: "100%", borderRadius: "12px", overflow: "hidden" }}>
    <img src={asset.data} width={width} height={height} style={{ objectFit: "contain", maxWidth: "100%" }} />
  </div>;
}

function imageOnlyParagraph(node: any): any[] | null {
  if (node.type !== "paragraph" || !node.children?.some((child: any) => child.type === "image")) return null;
  return node.children.every((child: any) => child.type === "image" || (child.type === "text" && !child.value.trim()))
    ? node.children.filter((child: any) => child.type === "image") : null;
}

function renderGallery(nodes: any[], context: RenderContext, key: string): ReactNode {
  const width = context.imageMaxWidth ?? 1000;
  const cellWidth = nodes.length > 1 ? Math.floor((width - 16) / 2) : width;
  return <div key={key} style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "16px", margin: "8px 0 16px", maxWidth: "100%" }}>
    {nodes.map((node, index) => nodes.length > 1
      ? <div key={`${key}-${index}`} style={{ display: "flex", width: `${cellWidth}px`, maxWidth: "100%", flexShrink: 0 }}>
          {renderImage(node, context, `${key}-${index}-image`, cellWidth)}
        </div>
      : renderImage(node, context, `${key}-${index}`, cellWidth))}
  </div>;
}

function baseText(color: string, theme: Theme): CSSProperties {
  return {
    display: "flex",
    flexWrap: "wrap",
    color,
    fontFamily: theme.fontFamily,
    fontSize: `${theme.bodyFontSize}px`,
    lineHeight: 1.55,
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  };
}

function textWithEmoji(
  value: string,
  context: RenderContext,
  key: string,
): ReactNode[] {
  const regex = emojiRegex();
  const nodes: ReactNode[] = [];
  let cursor = 0;
  let count = 0;
  for (const match of value.matchAll(regex)) {
    const start = match.index ?? 0;
    if (start > cursor)
      nodes.push(
        <Fragment key={`${key}-t-${count++}`}>
          {value.slice(cursor, start)}
        </Fragment>,
      );
    const character = match[0];
    const source = context.emoji.get(character);
    nodes.push(
      source ? (
        <img
          key={`${key}-e-${count++}`}
          src={source}
          width={25}
          height={25}
          style={{ margin: "3px 2px 0 2px" }}
        />
      ) : (
        <span
          key={`${key}-ef-${count++}`}
          style={{ display: "flex", fontFamily: "Noto Emoji", margin: "0 2px" }}
        >
          {character}
        </span>
      ),
    );
    cursor = start + character.length;
  }
  if (cursor < value.length)
    nodes.push(
      <Fragment key={`${key}-t-${count++}`}>{value.slice(cursor)}</Fragment>,
    );
  return nodes;
}

function renderInline(
  node: any,
  context: RenderContext,
  key: string,
): ReactNode {
  const children = (node.children ?? []).map((child: any, index: number) =>
    renderInline(child, context, `${key}-${index}`),
  );
  switch (node.type) {
    case "text":
      return (
        <Fragment key={key}>
          {textWithEmoji(node.value ?? "", context, key)}
        </Fragment>
      );
    case "strong":
      return (
        <span key={key} style={{ display: "flex", fontWeight: 700 }}>
          {children}
        </span>
      );
    case "emphasis":
      return (
        <span key={key} style={{ display: "flex", fontStyle: "italic" }}>
          {children}
        </span>
      );
    case "delete":
      return (
        <span
          key={key}
          style={{ display: "flex", textDecoration: "line-through" }}
        >
          {children}
        </span>
      );
    case "inlineCode":
      return (
        <span
          key={key}
          style={{
            display: "flex",
            fontFamily: "IBM Plex Mono",
            fontSize: `${Math.max(13, context.theme.bodyFontSize - 3)}px`,
            background: context.theme.codeBackground,
            color: context.theme.codeForeground,
            borderRadius: "7px",
            padding: "1px 7px",
            margin: "0 3px",
          }}
        >
          {node.value}
        </span>
      );
    case "link":
      return (
        <span
          key={key}
          style={{
            display: "flex",
            color: context.theme.link,
            textDecoration: "underline",
            textDecorationThickness: "1px",
            textUnderlineOffset: "3px",
          }}
        >
          {children}
        </span>
      );
    case "break":
      return <Fragment key={key}>{"\n"}</Fragment>;
    case "image":
      return renderImage(node, context, key);
    default:
      return <Fragment key={key}>{children}</Fragment>;
  }
}

function inlineContainer(
  children: any[],
  context: RenderContext,
  key: string,
  style?: CSSProperties,
) {
  return (
    <div
      key={key}
      style={{ ...baseText(context.foreground, context.theme), ...style }}
    >
      {children.map((child, index) =>
        renderInline(child, context, `${key}-${index}`),
      )}
    </div>
  );
}

function headingFontSize(depth: number, bodyFontSize: number): number {
  if (depth === 1) return bodyFontSize + 8;
  if (depth === 2) return bodyFontSize + 5;
  return bodyFontSize + 2;
}

function renderTable(
  node: any,
  context: RenderContext,
  key: string,
): ReactNode {
  const rows = node.children ?? [];
  const columns = Math.max(
    1,
    ...rows.map((row: any) => row.children?.length ?? 0),
  );
  const native = context.theme.tableStyle === "native";
  return (
    <div
      key={key}
      style={{
        display: "flex",
        flexDirection: "column",
        border: native ? "none" : `1px solid ${context.theme.border}`,
        borderRadius: native ? "0" : "12px",
        overflow: native ? "visible" : "hidden",
        margin: "7px 0 14px",
      }}
    >
      {rows.map((row: any, rowIndex: number) => (
        <div
          key={`${key}-r-${rowIndex}`}
          style={{
            display: "flex",
            width: "100%",
            background: rowIndex === 0
              ? native ? context.theme.codeBackground : context.theme.userBackground
              : "transparent",
            borderTop:
              rowIndex === 0 ? "none" : `1px solid ${context.theme.border}`,
          }}
        >
          {(row.children ?? []).map((cell: any, cellIndex: number) => (
            <div
              key={`${key}-c-${rowIndex}-${cellIndex}`}
              style={{
                display: "flex",
                width: `${100 / columns}%`,
                padding: native ? "13px 12px" : "11px 12px",
                borderLeft:
                  native || cellIndex === 0
                    ? "none"
                    : `1px solid ${context.theme.border}`,
              }}
            >
              {inlineContainer(
                cell.children ?? [],
                rowIndex === 0 && !native
                  ? { ...context, foreground: context.theme.userForeground }
                  : context,
                `${key}-ci-${rowIndex}-${cellIndex}`,
                {
                  fontSize: `${Math.max(14, context.theme.bodyFontSize - 4)}px`,
                  lineHeight: 1.45,
                  fontWeight:
                    rowIndex === 0
                      ? 700
                      : native && cellIndex === 0
                        ? 600
                        : 400,
                },
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function renderBlock(
  node: any,
  context: RenderContext,
  key: string,
): ReactNode {
  switch (node.type) {
    case "paragraph":
      if (imageOnlyParagraph(node)) return renderGallery(imageOnlyParagraph(node)!, context, key);
      return inlineContainer(node.children ?? [], context, key, {
        marginBottom: "8px",
      });
    case "heading":
      return inlineContainer(node.children ?? [], context, key, {
        fontSize: `${headingFontSize(node.depth, context.theme.bodyFontSize)}px`,
        lineHeight: 1.35,
        fontWeight: 700,
        margin: "7px 0 5px",
      });
    case "blockquote":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            borderLeft: `4px solid ${context.theme.accent}`,
            paddingLeft: "15px",
            color: context.theme.muted,
            margin: "5px 0 10px",
          }}
        >
          {(node.children ?? []).map((child: any, index: number) =>
            renderBlock(
              child,
              { ...context, foreground: context.theme.muted },
              `${key}-${index}`,
            ),
          )}
        </div>
      );
    case "list":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            margin: "3px 0 10px",
          }}
        >
          {(node.children ?? []).map((item: any, index: number) => (
            <div
              key={`${key}-${index}`}
              style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}
            >
              <div
                style={{
                  ...baseText(context.theme.listMarker, context.theme),
                  width: "24px",
                  flexShrink: 0,
                }}
              >
                {node.ordered ? `${(node.start ?? 1) + index}.` : "•"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  width: "100%",
                }}
              >
                {(item.children ?? []).map((child: any, childIndex: number) =>
                  renderBlock(child, context, `${key}-${index}-${childIndex}`),
                )}
              </div>
            </div>
          ))}
        </div>
      );
    case "code":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            background: context.theme.codeBackground,
            color: context.theme.codeForeground,
            borderRadius: "13px",
            padding: "15px 17px",
            margin: "7px 0 12px",
            border: `1px solid ${context.theme.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              color: context.theme.muted,
              fontFamily: "IBM Plex Mono",
              fontSize: "13px",
              fontWeight: 700,
              marginBottom: "9px",
              textTransform: "uppercase",
            }}
          >
            {node.lang || "code"}
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Mono",
              fontSize: `${context.theme.codeFontSize}px`,
              lineHeight: 1.55,
              whiteSpace: "pre-wrap",
              overflowWrap: "anywhere",
            }}
          >
            {node.value ?? ""}
          </div>
        </div>
      );
    case "table":
      return renderTable(node, context, key);
    case "thematicBreak":
      return (
        <div
          key={key}
          style={{
            display: "flex",
            height: "1px",
            background: context.theme.border,
            margin: "10px 0 15px",
          }}
        />
      );
    case "html":
      return (
        <div
          key={key}
          style={{
            ...baseText(context.theme.muted, context.theme),
            fontSize: `${Math.max(13, context.theme.bodyFontSize - 5)}px`,
          }}
        >
          {node.value ?? ""}
        </div>
      );
    default:
      return (
        <div key={key} style={{ display: "flex", flexDirection: "column" }}>
          {(node.children ?? []).map((child: any, index: number) =>
            renderBlock(child, context, `${key}-${index}`),
          )}
        </div>
      );
  }
}

export function renderMarkdown(
  text: string,
  context: RenderContext,
): ReactNode[] {
  const tree = parseMarkdown(text);
  const result: ReactNode[] = [];
  for (let index = 0; index < tree.children.length; index += 1) {
    const node = tree.children[index];
    const images = imageOnlyParagraph(node);
    const key = `${context.keyPrefix}-${index}`;
    if (images) {
      while (index + 1 < tree.children.length) {
        const next = imageOnlyParagraph(tree.children[index + 1]);
        if (!next) break;
        images.push(...next);
        index += 1;
      }
      result.push(renderGallery(images, context, key));
    } else result.push(renderBlock(node, context, key));
  }
  return result;
}

export function markdownFeatures(text: string): {
  blockTypes: string[];
  emojiCount: number;
} {
  const tree = parser.parse(text) as any;
  const blockTypes: string[] = [];
  const visit = (node: any) => {
    if (typeof node.type === "string") blockTypes.push(node.type);
    for (const child of node.children ?? []) visit(child);
  };
  visit(tree);
  return { blockTypes, emojiCount: [...text.matchAll(emojiRegex())].length };
}
