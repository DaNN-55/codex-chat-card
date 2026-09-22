import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import { loadEmojiAssets, loadFonts } from "./assets.js";
import { renderMarkdown } from "./markdown.js";
import { DEFAULT_EXPORT_MODE, DEFAULT_MOCKUP_MODE, } from "./types.js";
const WIDTH = 1200;
const OUTER_PADDING = 52;
function logicalLength(text) {
    return Array.from(text).length;
}
function estimatedTextHeight(text, charsPerLine, lineHeight) {
    return text
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
    if (padded > 50000) {
        throw new Error("The selected conversation is too large for a single safe canvas. Export a smaller selection.");
    }
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
    if (mode === "clean")
        return null;
    const { theme } = options;
    const minimal = mode === "minimal";
    return (_jsx("div", { style: {
            display: "flex",
            alignItems: "center",
            height: minimal ? "36px" : "42px",
            borderBottom: `1px solid ${theme.border}`,
            marginBottom: minimal ? "28px" : "32px",
            color: theme.foreground,
        }, children: _jsx("div", { style: {
                display: "flex",
                fontFamily: theme.fontFamily,
                fontSize: minimal ? "13px" : "14px",
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
            justifyContent: minimal ? "flex-end" : "space-between",
            height: minimal ? "28px" : "32px",
            borderTop: `1px solid ${theme.border}`,
            color: theme.muted,
            fontFamily: theme.fontFamily,
            fontSize: minimal ? "10px" : "11px",
            marginTop: minimal ? "0" : "2px",
        }, children: [minimal ? null : (_jsxs("div", { style: { display: "flex" }, children: ["Made with ", options.brandName ?? "codex-chat-card"] })), _jsx("div", { style: { display: "flex" }, children: repository })] }));
}
function roundCard(round, theme, emoji, content) {
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
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            gap: showUser && showCodex ? (classic ? "14px" : "24px") : "0",
            marginBottom: classic ? "32px" : "48px",
        }, children: [showUser ? (_jsx("div", { style: { display: "flex", justifyContent: "flex-end" }, children: _jsx("div", { style: {
                        ...bubbleBase,
                        width: classic ? "82%" : "78%",
                        background: theme.userBackground,
                        color: theme.userForeground,
                        borderRadius: classic ? "20px 20px 7px 20px" : "18px",
                        border: classic ? `1px solid ${theme.border}` : "none",
                    }, children: _jsx("div", { style: { display: "flex", flexDirection: "column" }, children: renderMarkdown(round.user, {
                            theme,
                            emoji,
                            foreground: theme.userForeground,
                            keyPrefix: `u-${round.index}`,
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
                            padding: "2px 4px",
                            color: theme.assistantForeground,
                        }, children: _jsx("div", { style: { display: "flex", flexDirection: "column" }, children: renderMarkdown(round.assistant, {
                            theme,
                            emoji,
                            foreground: theme.assistantForeground,
                            keyPrefix: `a-${round.index}`,
                        }) }) }) })) : null] }, round.turnId));
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
function visibleLineCount(text, charsPerLine) {
    return text
        .split("\n")
        .reduce((total, line) => total + Math.max(1, Math.ceil(logicalLength(line) / charsPerLine)), 0);
}
export function waterfallBarCount(rounds, content = "conversation") {
    const visibleMessagesPerRound = content === "conversation" ? 2 : 1;
    const visibleLines = rounds.reduce((total, round) => {
        let roundLines = 0;
        if (content !== "codex")
            roundLines += visibleLineCount(round.user, 38);
        if (content !== "user")
            roundLines += visibleLineCount(round.assistant, 34);
        return total + roundLines;
    }, 0);
    const count = Math.round(visibleLines * 0.75 + rounds.length * visibleMessagesPerRound);
    return Math.max(6, Math.min(80, count));
}
function waterfallWidths(seed, count) {
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
        if (index < 12)
            return 14 + (random % 9);
        if (index < count - 2)
            return 7 + (random % 7);
        return 8 + (random % 4);
    });
}
function waterfallRail(theme, seed, count) {
    const widths = waterfallWidths(seed, count);
    return (_jsx("div", { style: {
            display: "flex",
            position: "absolute",
            left: "16px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "24px",
            flexDirection: "column",
            gap: "7px",
            alignItems: "flex-start",
        }, children: widths.map((width, index) => (_jsx("div", { style: {
                display: "flex",
                width: `${width}px`,
                height: "2px",
                borderRadius: "2px",
                background: theme.muted,
                opacity: index >= widths.length - 2 ? 0.8 : 0.28 + (index % 4) * 0.1,
            } }, `waterfall-${index}`))) }));
}
function codexWindow(content, theme, seed, waterfallCount) {
    return (_jsxs("div", { style: {
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: theme.background,
            border: `1px solid ${theme.border}`,
            borderRadius: "18px",
            boxShadow: "0 18px 46px rgba(0,0,0,0.10)",
        }, children: [_jsxs("div", { style: {
                    display: "flex",
                    alignItems: "center",
                    height: "42px",
                    padding: "0 15px",
                    borderBottom: `1px solid ${theme.border}`,
                    background: theme.codeBackground,
                    color: theme.foreground,
                }, children: [_jsxs("div", { style: {
                            display: "flex",
                            alignItems: "center",
                            gap: "7px",
                            width: "72px",
                        }, children: [_jsx("div", { style: {
                                    display: "flex",
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "999px",
                                    background: "#ff5f57",
                                } }), _jsx("div", { style: {
                                    display: "flex",
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "999px",
                                    background: "#febc2e",
                                } }), _jsx("div", { style: {
                                    display: "flex",
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "999px",
                                    background: "#28c840",
                                } })] }), _jsx("div", { style: {
                            display: "flex",
                            flexGrow: 1,
                            justifyContent: "center",
                            fontFamily: theme.fontFamily,
                            fontSize: "12px",
                            fontWeight: 600,
                            color: theme.muted,
                        }, children: "Codex" }), _jsx("div", { style: { display: "flex", width: "72px" } })] }), _jsxs("div", { style: {
                    display: "flex",
                    position: "relative",
                    flexDirection: "column",
                    padding: "34px 36px 20px 86px",
                }, children: [waterfallRail(theme, seed, waterfallCount), content] })] }));
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
function trimCanvas(svg) {
    const svgTag = svg.match(/<svg[^>]*height="([0-9.]+)"[^>]*viewBox="0 0 1200 ([0-9.]+)"/);
    const background = svg.match(/<rect x="0" y="0" width="1200" height="([0-9.]+)" fill="[^"]*"(?: fill-opacity="[^"]*")?\/>/);
    if (!svgTag || !background)
        return svg;
    const [, canvasHeight, viewBoxHeight] = svgTag;
    const [, contentHeight] = background;
    if (Number(contentHeight) >= Number(canvasHeight))
        return svg;
    return svg
        .replace(`height="${canvasHeight}"`, `height="${contentHeight}"`)
        .replace(`viewBox="0 0 1200 ${viewBoxHeight}"`, `viewBox="0 0 1200 ${contentHeight}"`);
}
export async function renderToSvg(options) {
    const fonts = await loadFonts();
    const emoji = await loadEmojiAssets(options.rounds.flatMap((round) => [round.user, round.assistant]));
    const { theme } = options;
    const mockup = options.mockup ?? DEFAULT_MOCKUP_MODE;
    const contentView = options.content ?? "conversation";
    const content = (_jsxs("div", { style: { display: "flex", flexDirection: "column" }, children: [header(options), _jsx("div", { style: { display: "flex", flexDirection: "column" }, children: options.rounds.map((round) => roundCard(round, theme, emoji, contentView)) })] }));
    const presentation = mockup === "codex-window"
        ? codexWindow(content, theme, options.rounds.map((round) => round.turnId).join("|"), waterfallBarCount(options.rounds, contentView))
        : frame(content, theme);
    const outerPadding = mockup === "codex-window" ? 32 : OUTER_PADDING;
    const tree = (_jsxs("div", { style: {
            width: `${WIDTH}px`,
            display: "flex",
            flexDirection: "column",
            background: theme.background,
            padding: `${outerPadding}px`,
            color: theme.foreground,
            fontFamily: theme.fontFamily,
        }, children: [brandHeader(options), presentation, brandFooter(options)] }));
    return trimCanvas(await satori(tree, {
        width: WIDTH,
        height: estimateHeight(options.rounds, theme, mockup, contentView),
        fonts,
    }));
}
export async function renderToPng(options) {
    const svg = await renderToSvg(options);
    return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } }).render().asPng());
}
