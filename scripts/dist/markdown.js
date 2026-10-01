import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { Fragment } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import emojiRegex from "emoji-regex";
const parser = unified().use(remarkParse).use(remarkGfm);
function parseMarkdown(text) {
    const tree = parser.parse(text);
    const definitions = new Map();
    const walk = (node, visit) => {
        visit(node);
        for (const child of node.children ?? [])
            walk(child, visit);
    };
    walk(tree, (node) => { if (node.type === "definition")
        definitions.set(node.identifier, node.url); });
    walk(tree, (node) => {
        if (node.type === "imageReference" && definitions.has(node.identifier)) {
            node.type = "image";
            node.url = definitions.get(node.identifier);
        }
    });
    return tree;
}
export function markdownImageSources(text) {
    const sources = [];
    const visit = (node) => {
        if (node.type === "image" && typeof node.url === "string")
            sources.push(node.url);
        for (const child of node.children ?? [])
            visit(child);
    };
    visit(parseMarkdown(text));
    return sources;
}
// Image destinations may contain large base64 payloads; they are not visible text.
export function markdownDisplayText(text) {
    const replacements = [];
    const visit = (node) => {
        if ((node.type === "image" || node.type === "definition") && node.position) {
            replacements.push({ start: node.position.start.offset, end: node.position.end.offset,
                value: node.type === "image" ? `[图片${node.alt ? `：${node.alt}` : ""}]` : "" });
        }
        else
            for (const child of node.children ?? [])
                visit(child);
    };
    visit(parseMarkdown(text));
    let result = text;
    for (const entry of replacements.sort((a, b) => b.start - a.start)) {
        result = result.slice(0, entry.start) + entry.value + result.slice(entry.end);
    }
    return result;
}
function renderImage(node, context, key, maxWidth = context.imageMaxWidth ?? 1000) {
    const asset = context.images?.get(node.url);
    if (!asset || !("data" in asset)) {
        return _jsxs("div", { style: { display: "flex", flexDirection: "column", width: `${maxWidth}px`, maxWidth: "100%", padding: "18px", border: `1px dashed ${context.theme.border}`, borderRadius: "12px", color: context.foreground, fontSize: "18px" }, children: [_jsxs("div", { style: { display: "flex", overflowWrap: "anywhere" }, children: ["\u56FE\u7247\u4E0D\u53EF\u7528 \u00B7 ", node.alt || "图片"] }), _jsx("div", { style: { display: "flex", marginTop: "6px", color: context.theme.muted, fontSize: "14px" }, children: asset && "reason" in asset ? asset.reason : "图片未加载" })] }, key);
    }
    const scale = Math.min(1, maxWidth / asset.width, 640 / asset.height);
    const width = Math.max(1, Math.floor(asset.width * scale));
    const height = Math.max(1, Math.floor(asset.height * scale));
    return _jsx("div", { style: { display: "flex", width: `${width}px`, maxWidth: "100%", borderRadius: "12px", overflow: "hidden" }, children: _jsx("img", { src: asset.data, width: width, height: height, style: { objectFit: "contain", maxWidth: "100%" } }) }, key);
}
function imageOnlyParagraph(node) {
    if (node.type !== "paragraph" || !node.children?.some((child) => child.type === "image"))
        return null;
    return node.children.every((child) => child.type === "image" || (child.type === "text" && !child.value.trim()))
        ? node.children.filter((child) => child.type === "image") : null;
}
function renderGallery(nodes, context, key) {
    const width = context.imageMaxWidth ?? 1000;
    const cellWidth = nodes.length > 1 ? Math.floor((width - 16) / 2) : width;
    return _jsx("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: "16px", margin: "8px 0 16px", maxWidth: "100%" }, children: nodes.map((node, index) => nodes.length > 1
            ? _jsx("div", { style: { display: "flex", width: `${cellWidth}px`, maxWidth: "100%", flexShrink: 0 }, children: renderImage(node, context, `${key}-${index}-image`, cellWidth) }, `${key}-${index}`)
            : renderImage(node, context, `${key}-${index}`, cellWidth)) }, key);
}
function baseText(color, theme) {
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
            return renderImage(node, context, key);
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
                background: rowIndex === 0
                    ? native ? context.theme.codeBackground : context.theme.userBackground
                    : "transparent",
                borderTop: rowIndex === 0 ? "none" : `1px solid ${context.theme.border}`,
            }, children: (row.children ?? []).map((cell, cellIndex) => (_jsx("div", { style: {
                    display: "flex",
                    width: `${100 / columns}%`,
                    padding: native ? "13px 12px" : "11px 12px",
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
            if (imageOnlyParagraph(node))
                return renderGallery(imageOnlyParagraph(node), context, key);
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
                            color: context.theme.muted,
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
    const tree = parseMarkdown(text);
    const result = [];
    for (let index = 0; index < tree.children.length; index += 1) {
        const node = tree.children[index];
        const images = imageOnlyParagraph(node);
        const key = `${context.keyPrefix}-${index}`;
        if (images) {
            while (index + 1 < tree.children.length) {
                const next = imageOnlyParagraph(tree.children[index + 1]);
                if (!next)
                    break;
                images.push(...next);
                index += 1;
            }
            result.push(renderGallery(images, context, key));
        }
        else
            result.push(renderBlock(node, context, key));
    }
    return result;
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
