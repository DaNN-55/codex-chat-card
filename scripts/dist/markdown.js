import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Fragment } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import emojiRegex from "emoji-regex";
const parser = unified().use(remarkParse).use(remarkGfm);
function baseText(color, theme) {
    return {
        display: "flex",
        flexWrap: "wrap",
        color,
        fontFamily: theme.fontFamily,
        fontSize: `${theme.bodyFontSize}px`,
        lineHeight: 1.58,
        whiteSpace: "pre-wrap",
        overflowWrap: "anywhere",
    };
}
function textWithEmoji(value, context, key) {
    const regex = emojiRegex();
    const nodes = [];
    let cursor = 0;
    let count = 0;
    for (const match of value.matchAll(regex)) {
        const start = match.index ?? 0;
        if (start > cursor)
            nodes.push(_jsx(Fragment, { children: value.slice(cursor, start) }, `${key}-t-${count++}`));
        const character = match[0];
        const source = context.emoji.get(character);
        nodes.push(source ? (_jsx("img", { src: source, width: 25, height: 25, style: { margin: "3px 2px 0 2px" } }, `${key}-e-${count++}`)) : (_jsx("span", { style: { display: "flex", fontFamily: "Noto Emoji", margin: "0 2px" }, children: character }, `${key}-ef-${count++}`)));
        cursor = start + character.length;
    }
    if (cursor < value.length)
        nodes.push(_jsx(Fragment, { children: value.slice(cursor) }, `${key}-t-${count++}`));
    return nodes;
}
function renderInline(node, context, key) {
    const children = (node.children ?? []).map((child, index) => renderInline(child, context, `${key}-${index}`));
    switch (node.type) {
        case "text":
            return (_jsx(Fragment, { children: textWithEmoji(node.value ?? "", context, key) }, key));
        case "strong":
            return (_jsx("span", { style: { display: "flex", fontWeight: 700 }, children: children }, key));
        case "emphasis":
            return (_jsx("span", { style: { display: "flex", fontStyle: "italic" }, children: children }, key));
        case "delete":
            return (_jsx("span", { style: { display: "flex", textDecoration: "line-through" }, children: children }, key));
        case "inlineCode":
            return (_jsx("span", { style: {
                    display: "flex",
                    fontFamily: "IBM Plex Mono",
                    fontSize: `${Math.max(13, context.theme.bodyFontSize - 3)}px`,
                    background: context.theme.codeBackground,
                    color: context.theme.codeForeground,
                    borderRadius: "7px",
                    padding: "1px 7px",
                    margin: "0 3px",
                }, children: node.value }, key));
        case "link":
            return (_jsx("span", { style: {
                    display: "flex",
                    color: context.theme.link,
                    textDecoration: "underline",
                    textDecorationThickness: "1px",
                    textUnderlineOffset: "3px",
                }, children: children }, key));
        case "break":
            return _jsx(Fragment, { children: "\n" }, key);
        case "image":
            return (_jsx(Fragment, { children: node.alt ? `[图片：${node.alt}]` : "[图片]" }, key));
        default:
            return _jsx(Fragment, { children: children }, key);
    }
}
function inlineContainer(children, context, key, style) {
    return (_jsx("div", { style: { ...baseText(context.foreground, context.theme), ...style }, children: children.map((child, index) => renderInline(child, context, `${key}-${index}`)) }, key));
}
function headingFontSize(depth, bodyFontSize) {
    if (depth === 1)
        return bodyFontSize + 8;
    if (depth === 2)
        return bodyFontSize + 5;
    return bodyFontSize + 2;
}
function renderTable(node, context, key) {
    const rows = node.children ?? [];
    const columns = Math.max(1, ...rows.map((row) => row.children?.length ?? 0));
    const native = context.theme.tableStyle === "native";
    return (_jsx("div", { style: {
            display: "flex",
            flexDirection: "column",
            border: native ? "none" : `1px solid ${context.theme.border}`,
            borderRadius: native ? "0" : "12px",
            overflow: native ? "visible" : "hidden",
            margin: "7px 0 14px",
        }, children: rows.map((row, rowIndex) => (_jsx("div", { style: {
                display: "flex",
                width: "100%",
                background: native
                    ? "transparent"
                    : rowIndex === 0
                        ? context.theme.userBackground
                        : "transparent",
                borderTop: rowIndex === 0 ? "none" : `1px solid ${context.theme.border}`,
            }, children: (row.children ?? []).map((cell, cellIndex) => (_jsx("div", { style: {
                    display: "flex",
                    width: `${100 / columns}%`,
                    padding: native ? "13px 12px 13px 0" : "11px 12px",
                    borderLeft: native || cellIndex === 0
                        ? "none"
                        : `1px solid ${context.theme.border}`,
                }, children: inlineContainer(cell.children ?? [], rowIndex === 0 && !native
                    ? { ...context, foreground: context.theme.userForeground }
                    : context, `${key}-ci-${rowIndex}-${cellIndex}`, {
                    fontSize: `${Math.max(14, context.theme.bodyFontSize - 4)}px`,
                    lineHeight: 1.45,
                    fontWeight: rowIndex === 0
                        ? 700
                        : native && cellIndex === 0
                            ? 600
                            : 400,
                }) }, `${key}-c-${rowIndex}-${cellIndex}`))) }, `${key}-r-${rowIndex}`))) }, key));
}
function renderBlock(node, context, key) {
    switch (node.type) {
        case "paragraph":
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
            return (_jsx("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    borderLeft: `4px solid ${context.theme.accent}`,
                    paddingLeft: "15px",
                    color: context.theme.muted,
                    margin: "5px 0 10px",
                }, children: (node.children ?? []).map((child, index) => renderBlock(child, { ...context, foreground: context.theme.muted }, `${key}-${index}`)) }, key));
        case "list":
            return (_jsx("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    gap: "5px",
                    margin: "3px 0 10px",
                }, children: (node.children ?? []).map((item, index) => (_jsxs("div", { style: { display: "flex", alignItems: "flex-start", gap: "10px" }, children: [_jsx("div", { style: {
                                ...baseText(context.theme.listMarker, context.theme),
                                width: "24px",
                                flexShrink: 0,
                            }, children: node.ordered ? `${(node.start ?? 1) + index}.` : "•" }), _jsx("div", { style: {
                                display: "flex",
                                flexDirection: "column",
                                width: "100%",
                            }, children: (item.children ?? []).map((child, childIndex) => renderBlock(child, context, `${key}-${index}-${childIndex}`)) })] }, `${key}-${index}`))) }, key));
        case "code":
            return (_jsxs("div", { style: {
                    display: "flex",
                    flexDirection: "column",
                    background: context.theme.codeBackground,
                    color: context.theme.codeForeground,
                    borderRadius: "13px",
                    padding: "15px 17px",
                    margin: "7px 0 12px",
                    border: `1px solid ${context.theme.border}`,
                }, children: [_jsx("div", { style: {
                            display: "flex",
                            color: context.theme.accent,
                            fontFamily: "IBM Plex Mono",
                            fontSize: "13px",
                            fontWeight: 700,
                            marginBottom: "9px",
                            textTransform: "uppercase",
                        }, children: node.lang || "code" }), _jsx("div", { style: {
                            display: "flex",
                            fontFamily: "IBM Plex Mono",
                            fontSize: `${context.theme.codeFontSize}px`,
                            lineHeight: 1.55,
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                        }, children: node.value ?? "" })] }, key));
        case "table":
            return renderTable(node, context, key);
        case "thematicBreak":
            return (_jsx("div", { style: {
                    display: "flex",
                    height: "1px",
                    background: context.theme.border,
                    margin: "10px 0 15px",
                } }, key));
        case "html":
            return (_jsx("div", { style: {
                    ...baseText(context.theme.muted, context.theme),
                    fontSize: `${Math.max(13, context.theme.bodyFontSize - 5)}px`,
                }, children: node.value ?? "" }, key));
        default:
            return (_jsx("div", { style: { display: "flex", flexDirection: "column" }, children: (node.children ?? []).map((child, index) => renderBlock(child, context, `${key}-${index}`)) }, key));
    }
}
export function renderMarkdown(text, context) {
    const tree = parser.parse(text);
    return (tree.children ?? []).map((node, index) => renderBlock(node, context, `${context.keyPrefix}-${index}`));
}
export function markdownFeatures(text) {
    const tree = parser.parse(text);
    const blockTypes = [];
    const visit = (node) => {
        if (typeof node.type === "string")
            blockTypes.push(node.type);
        for (const child of node.children ?? [])
            visit(child);
    };
    visit(tree);
    return { blockTypes, emojiCount: [...text.matchAll(emojiRegex())].length };
}
