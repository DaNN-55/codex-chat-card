import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadEmojiAssets, loadFonts } from "./assets.js";
import { markdownDisplayText, markdownImageSources, renderMarkdown } from "./markdown.js";
import { answerActions, chromeIcon } from "./icons.js";
import { loadImageAssets } from "./images.js";
import { DEFAULT_EXPORT_MODE, DEFAULT_MOCKUP_MODE, } from "./types.js";
const WIDTH = 1200;
const OUTER_PADDING = 52;
const MAX_CANVAS_HEIGHT = 50000;
function checkCanvasHeight(height) {
    if (height > MAX_CANVAS_HEIGHT) {
        throw new Error("The selected conversation is too large for a single safe canvas. Export a smaller selection.");
    }
}
function logicalLength(text) {
    return Array.from(text).length;
}
function estimatedTextHeight(text, charsPerLine, lineHeight) {
    return markdownDisplayText(text)
        .split("\n")
        .reduce((total, line) => total +
        Math.max(1, Math.ceil(logicalLength(line) / charsPerLine)) * lineHeight, 0);
}
function estimateHeight(rounds, theme, mockup, content) {
    let height = theme.frame === "window" ? 230 : 160;
    if (mockup === "codex-window")
        height += 82;
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
function header(options) {
    if (!options.title)
        return null;
    const { theme } = options;
    return (_jsx("div", { style: {
            display: "flex",
            fontFamily: theme.titleFont,
            fontSize: "34px",
            fontWeight: 700,
            letterSpacing: "-0.4px",
            color: theme.foreground,
            marginBottom: "34px",
        }, children: options.title }));
}
function brandHeader(options) {
    const mode = options.mode ?? DEFAULT_EXPORT_MODE;
    if (mode !== "branded")
        return null;
    const { theme } = options;
    return (_jsx("div", { style: {
            display: "flex",
            alignItems: "center",
            height: "42px",
            borderBottom: `1px solid ${theme.border}`,
            marginBottom: "32px",
            color: theme.foreground,
        }, children: _jsx("div", { style: {
                display: "flex",
                fontFamily: theme.fontFamily,
                fontSize: "14px",
                fontWeight: 600,
                letterSpacing: "-0.1px",
            }, children: options.brandName ?? "codex-chat-card" }) }));
}
function brandFooter(options) {
    const mode = options.mode ?? DEFAULT_EXPORT_MODE;
    if (mode === "clean")
        return null;
    const { theme } = options;
    const minimal = mode === "minimal";
    const repository = options.repository ?? "github.com/DaNN-55/codex-chat-card";
    return (_jsxs("div", { style: {
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
        }, children: [_jsxs("div", { style: { display: "flex" }, children: [minimal ? "" : "Made with ", options.brandName ?? "codex-chat-card"] }), minimal ? _jsx("div", { style: { display: "flex" }, children: "\u00B7" }) : null, _jsx("div", { style: { display: "flex", maxWidth: "100%" }, children: repository })] }));
}
function roundCard(round, theme, emoji, content, mockup, images) {
    const bubbleBase = {
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
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            gap: showUser && showCodex ? (classic ? "14px" : "48px") : "0",
        }, children: [showUser ? (_jsx("div", { style: { display: "flex", justifyContent: "flex-end" }, children: _jsx("div", { style: {
                        ...bubbleBase,
                        ...(classic ? { width: "82%" } : { maxWidth: "78%" }),
                        padding: classic ? "20px 22px" : "18px 24px",
                        background: theme.userBackground,
                        color: theme.userForeground,
                        borderRadius: classic ? "20px 20px 7px 20px" : "18px",
                        border: classic ? `1px solid ${theme.border}` : "none",
                    }, children: _jsx("div", { style: { display: "flex", flexDirection: "column" }, children: renderMarkdown(round.user, {
                            theme,
                            emoji,
                            foreground: theme.userForeground,
                            keyPrefix: `u-${round.index}`,
                            images,
                            imageMaxWidth: Math.floor(contentWidth * (classic ? 0.82 : 0.78) - 48),
                        }) }) }) })) : null, showCodex ? (_jsx("div", { style: { display: "flex", justifyContent: "flex-start" }, children: _jsx("div", { style: classic
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
                        }, children: _jsxs("div", { style: { display: "flex", flexDirection: "column" }, children: [renderMarkdown(round.assistant, {
                                theme,
                                emoji,
                                foreground: theme.assistantForeground,
                                keyPrefix: `a-${round.index}`,
                                images,
                                imageMaxWidth: classic ? Math.floor(contentWidth * 0.91 - 44) : contentWidth,
                            }), mockup === "codex-window" ? answerActions(theme.muted) : null] }) }) })) : null] }, round.turnId));
}
function windowBar(theme) {
    return (_jsx("div", { style: {
            display: "flex",
            alignItems: "center",
            height: "48px",
            padding: "0 17px",
            borderBottom: `1px solid ${theme.border}`,
            background: "rgba(255,255,255,0.78)",
        }, children: _jsxs("div", { style: { display: "flex", gap: "8px" }, children: [_jsx("div", { style: {
                        display: "flex",
                        width: "11px",
                        height: "11px",
                        borderRadius: "999px",
                        background: "#ff5f57",
                    } }), _jsx("div", { style: {
                        display: "flex",
                        width: "11px",
                        height: "11px",
                        borderRadius: "999px",
                        background: "#febc2e",
                    } }), _jsx("div", { style: {
                        display: "flex",
                        width: "11px",
                        height: "11px",
                        borderRadius: "999px",
                        background: "#28c840",
                    } })] }) }));
}
function codexWindow(content, theme, title) {
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            background: theme.background,
            border: `1px solid ${theme.border}`,
            borderRadius: "28px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.035)",
        }, children: [_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "flex-start",
                    minHeight: "100px",
                    padding: "30px 28px 24px",
                    color: theme.foreground,
                }, children: [_jsxs("div", { style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "22px",
                            width: "196px",
                            flexShrink: 0,
                            paddingTop: "6px",
                        }, children: [_jsx("div", { style: { display: "flex", gap: "10px", alignItems: "center" }, children: ["#ff5f57", "#febc2e", "#28c840"].map((color) => (_jsx("div", { style: {
                                        display: "flex",
                                        width: "14px",
                                        height: "14px",
                                        borderRadius: "999px",
                                        background: color,
                                    } }, color))) }), _jsxs("div", { style: { display: "flex", gap: "20px", opacity: 0.85 }, children: [chromeIcon("sidebar", theme.muted), chromeIcon("compose", theme.muted)] })] }), _jsx("div", { style: {
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
                        }, children: title || "Codex" }), _jsx("div", { style: { display: "flex", width: "196px", flexShrink: 0 } })] }), _jsx("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    padding: "22px 48px 48px",
                }, children: content })] }));
}
function frame(content, theme) {
    if (theme.frame === "none")
        return content;
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: theme.frameBackground,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.frame === "window" ? "19px" : "6px",
            boxShadow: theme.frameShadow,
        }, children: [theme.frame === "window" ? windowBar(theme) : null, _jsx("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    padding: theme.frame === "window" ? "34px 36px 22px" : "42px 44px 28px",
                }, children: content })] }));
}
export async function renderToSvg(options) {
    const fonts = await loadFonts();
    const emoji = await loadEmojiAssets(options.rounds.flatMap((round) => [round.user, round.assistant]));
    const { theme } = options;
    const mockup = options.mockup ?? DEFAULT_MOCKUP_MODE;
    const contentView = options.content ?? "conversation";
    const visibleText = options.rounds.flatMap((round) => [
        ...(contentView !== "codex" ? [round.user] : []),
        ...(contentView !== "user" ? [round.assistant] : []),
    ]);
    const images = await loadImageAssets(visibleText.flatMap(markdownImageSources), options.imageBaseDirectory);
    const content = (_jsxs("div", { style: { display: "flex", flexDirection: "column" }, children: [mockup === "none" ? header(options) : null, _jsx("div", { style: { display: "flex", flexDirection: "column", gap: theme.layout === "classic" ? "32px" : "64px" }, children: options.rounds.map((round) => roundCard(round, theme, emoji, contentView, mockup, images)) })] }));
    const presentation = mockup === "codex-window"
        ? codexWindow(content, theme, options.title)
        : frame(content, theme);
    const outerPadding = mockup === "codex-window" ? 24 : OUTER_PADDING;
    const tree = (_jsxs("div", { style: {
            width: `${WIDTH}px`,
            display: "flex",
            flexDirection: "column",
            background: theme.background,
            padding: `${outerPadding}px`,
            color: theme.foreground,
            fontFamily: theme.fontFamily,
        }, children: [brandHeader(options), presentation, brandFooter(options)] }));
    // Keep the early size guard, but let layout determine the actual height.
    // A fixed estimate can clip wrapped titles or rich multi-line messages.
    estimateHeight(options.rounds, theme, mockup, contentView);
    const svg = await satori(tree, { width: WIDTH, fonts });
    const height = Number(svg.match(/^<svg[^>]* height="([0-9.]+)"/)?.[1]);
    checkCanvasHeight(height);
    return svg;
}
export async function renderToPng(options) {
    const svg = await renderToSvg(options);
    return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}
