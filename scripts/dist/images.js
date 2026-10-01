import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;
function dimensions(bytes) {
    if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
        bytes.toString("ascii", 12, 16) === "IHDR" && bytes.toString("ascii", bytes.length - 8, bytes.length - 4) === "IEND") {
        return { mime: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    }
    if (bytes.length >= 4 && bytes.readUInt16BE(0) === 0xffd8 && bytes.readUInt16BE(bytes.length - 2) === 0xffd9) {
        let offset = 2;
        while (offset + 3 < bytes.length) {
            if (bytes[offset++] !== 0xff)
                break;
            while (bytes[offset] === 0xff)
                offset += 1;
            const marker = bytes[offset++];
            if (marker === 0xda || marker === 0xd9)
                break;
            if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7))
                continue;
            if (offset + 2 > bytes.length)
                break;
            const length = bytes.readUInt16BE(offset);
            if (length < 2 || offset + length > bytes.length)
                break;
            if (length >= 8 && marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
                return { mime: "image/jpeg", width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
            }
            offset += length;
        }
    }
    throw new Error("仅支持完整的 PNG / JPG 文件");
}
async function loadImage(source, baseDirectory) {
    try {
        let bytes;
        const data = source.match(/^data:image\/(?:png|jpe?g);base64,([\s\S]*)$/i);
        if (data) {
            if (data[1].length > MAX_BYTES * 4 / 3 + 4)
                return { reason: "图片超过 20 MB" };
            if (!/^[a-z0-9+/=\s]+$/i.test(data[1]))
                return { reason: "图片数据损坏" };
            bytes = Buffer.from(data[1], "base64");
        }
        else {
            if (/^(?!file:)[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith("//")) {
                return { reason: "需要本地 PNG / JPG 文件" };
            }
            let localSource = source;
            try {
                localSource = decodeURIComponent(source);
            }
            catch { /* Literal percent signs are valid in local filenames. */ }
            const path = source.startsWith("file:") ? fileURLToPath(source) : resolve(baseDirectory, localSource);
            const info = await stat(path);
            if (!info.isFile())
                return { reason: "图片文件不可用" };
            if (info.size > MAX_BYTES)
                return { reason: "图片超过 20 MB" };
            bytes = await readFile(path);
        }
        const size = dimensions(bytes);
        if (!size.width || !size.height || size.width * size.height > MAX_PIXELS) {
            return { reason: "图片尺寸不可用" };
        }
        return { data: `data:${size.mime};base64,${bytes.toString("base64")}`, width: size.width, height: size.height };
    }
    catch {
        return { reason: "图片文件缺失或格式不可用" };
    }
}
export async function loadImageAssets(sources, baseDirectory = process.cwd()) {
    const images = new Map();
    // Read only selected, visible references, one file at a time.
    for (const source of new Set(sources))
        images.set(source, await loadImage(source, baseDirectory));
    return images;
}
