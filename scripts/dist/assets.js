import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import emojiRegex from "emoji-regex";
const FONT_FILES = {
    notoRegular: "@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff",
    notoBold: "@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-700-normal.woff",
    geistRegular: "@fontsource/geist/files/geist-latin-400-normal.woff",
    geistSemiBold: "@fontsource/geist/files/geist-latin-600-normal.woff",
    geistBold: "@fontsource/geist/files/geist-latin-700-normal.woff",
    emojiRegular: "@fontsource/noto-emoji/files/noto-emoji-emoji-400-normal.woff",
    serifBold: "@fontsource/source-serif-4/files/source-serif-4-latin-700-normal.woff",
    monoRegular: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff",
    monoBold: "@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-700-normal.woff",
};
export async function loadFonts() {
    const [notoRegular, notoBold, geistRegular, geistSemiBold, geistBold, emojiRegular, serifBold, monoRegular, monoBold,] = await Promise.all(Object.values(FONT_FILES).map((file) => readFile(fileURLToPath(import.meta.resolve(file)))));
    return [
        {
            name: "Noto Sans SC",
            data: notoRegular,
            weight: 400,
            style: "normal",
        },
        {
            name: "Noto Sans SC",
            data: notoBold,
            weight: 700,
            style: "normal",
        },
        {
            name: "Geist",
            data: geistRegular,
            weight: 400,
            style: "normal",
        },
        {
            name: "Geist",
            data: geistSemiBold,
            weight: 600,
            style: "normal",
        },
        {
            name: "Geist",
            data: geistBold,
            weight: 700,
            style: "normal",
        },
        {
            name: "Noto Emoji",
            data: emojiRegular,
            weight: 400,
            style: "normal",
        },
        {
            name: "Source Serif 4",
            data: serifBold,
            weight: 700,
            style: "normal",
        },
        {
            name: "IBM Plex Mono",
            data: monoRegular,
            weight: 400,
            style: "normal",
        },
        {
            name: "IBM Plex Mono",
            data: monoBold,
            weight: 700,
            style: "normal",
        },
    ];
}
export async function loadEmojiAssets(texts) {
    const found = new Set();
    for (const text of texts) {
        const regex = emojiRegex();
        for (const match of text.matchAll(regex))
            found.add(match[0]);
    }
    return new Map([...found].map((emoji) => [emoji, ""]));
}
