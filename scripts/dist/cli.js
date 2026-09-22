#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { loadConversation, resolveCurrentSession } from "./input.js";
import { preview, selectRounds } from "./selection.js";
import { themes } from "./themes.js";
import { resolveExportTheme } from "./local-style.js";
import { renderToPng, renderToSvg } from "./renderer.js";
import { DEFAULT_EXPORT_MODE, DEFAULT_MOCKUP_MODE, } from "./types.js";
function parseArguments(argv) {
    const [command, ...rest] = argv;
    const flags = new Map();
    for (let index = 0; index < rest.length; index += 1) {
        const token = rest[index];
        if (!token.startsWith("--"))
            throw new Error(`Unexpected argument: ${token}`);
        const name = token.slice(2);
        const next = rest[index + 1];
        if (!next || next.startsWith("--"))
            flags.set(name, true);
        else {
            flags.set(name, next);
            index += 1;
        }
    }
    return { command, flags };
}
function stringFlag(flags, name) {
    const value = flags.get(name);
    return typeof value === "string" ? value : undefined;
}
function exportMode(value) {
    const mode = value ?? DEFAULT_EXPORT_MODE;
    if (mode !== "branded" && mode !== "minimal" && mode !== "clean") {
        throw new Error("--mode must be branded, minimal, or clean.");
    }
    return mode;
}
function mockupMode(value) {
    const mockup = value ?? DEFAULT_MOCKUP_MODE;
    if (mockup !== "none" && mockup !== "codex-window") {
        throw new Error("--mockup must be codex-window or none.");
    }
    return mockup;
}
function contentView(value) {
    const content = value ?? "conversation";
    if (content !== "conversation" && content !== "user" && content !== "codex") {
        throw new Error("--content must be conversation, user, or codex.");
    }
    return content;
}
async function inputPath(flags) {
    const explicit = stringFlag(flags, "input");
    if (explicit)
        return resolve(explicit);
    if (flags.has("current"))
        return resolveCurrentSession();
    throw new Error("Choose --current or pass --input <session.jsonl>.");
}
function timestamp(value) {
    if (!value)
        return "时间未知";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat("zh-CN", {
            dateStyle: "short",
            timeStyle: "short",
            hour12: false,
        }).format(date);
}
async function list(flags) {
    const document = await loadConversation(await inputPath(flags));
    const limit = Number(stringFlag(flags, "limit") ?? "10");
    if (!Number.isInteger(limit) || limit < 1)
        throw new Error("--limit must be a positive integer.");
    const rounds = document.rounds.slice(-limit);
    if (flags.has("json")) {
        process.stdout.write(`${JSON.stringify(rounds.map((round) => ({
            index: round.index,
            timestamp: round.timestamp,
            user: preview(round.user),
            assistant: preview(round.assistant),
        })), null, 2)}\n`);
        return;
    }
    for (const round of rounds) {
        const lines = [
            `${round.index}. ${timestamp(round.timestamp)}`,
            `   你：${preview(round.user)}`,
            `   Codex：${preview(round.assistant)}`,
        ];
        process.stdout.write(`${lines.join("\n")}\n`);
    }
}
async function exportImage(flags) {
    const document = await loadConversation(await inputPath(flags));
    const selection = stringFlag(flags, "select") ?? "last:1";
    const rounds = selectRounds(document.rounds, selection);
    const themeResolution = await resolveExportTheme(stringFlag(flags, "theme"));
    const theme = themeResolution.theme;
    const mode = exportMode(stringFlag(flags, "mode"));
    const mockup = mockupMode(stringFlag(flags, "mockup"));
    const content = contentView(stringFlag(flags, "content"));
    const outputFlag = stringFlag(flags, "output");
    const format = (stringFlag(flags, "format") ??
        (outputFlag ? extname(outputFlag).slice(1) : "png")).toLowerCase();
    if (!new Set(["png", "svg"]).has(format))
        throw new Error("--format must be png or svg.");
    const selectionName = rounds.map((round) => round.index).join("-");
    const filename = outputFlag ??
        `output/codex-chat-rounds-${selectionName}-${content}-${theme.name}-${mode}-${mockup}.${format}`;
    const output = resolve(filename);
    await mkdir(dirname(output), { recursive: true });
    const options = {
        rounds,
        theme,
        title: stringFlag(flags, "title"),
        mode,
        mockup,
        content,
        brandName: stringFlag(flags, "brand-name"),
        repository: stringFlag(flags, "repository"),
    };
    if (format === "svg")
        await writeFile(output, await renderToSvg(options), "utf8");
    else
        await writeFile(output, await renderToPng(options));
    const result = {
        output,
        format,
        theme: theme.name,
        themeSource: themeResolution.source,
        appearance: themeResolution.appearance,
        mode,
        mockup,
        content,
        selected: rounds.map((round) => round.index),
        width: 1200,
    };
    process.stdout.write(`${JSON.stringify(result)}\n`);
}
function usage() {
    const lines = [
        "codex-chat-card",
        "",
        "Commands:",
        "  list --current [--limit 10] [--json]",
        "  export --current --select last:3 --content conversation" +
            " --mode branded --mockup codex-window --output output/chat.png",
        "  export --current --select last:3 --content user" +
            " --output output/user.png",
        "  export --current --select last:3 --content codex" +
            " --output output/codex.png",
        "  export --current --select last:3 --mode clean --mockup none" +
            " --output output/chat.png",
        "  export --current --select last:3 --theme codex-ink" +
            " --output output/chat.png",
        "  themes",
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
}
async function main() {
    const { command, flags } = parseArguments(process.argv.slice(2));
    if (command === "list")
        await list(flags);
    else if (command === "export")
        await exportImage(flags);
    else if (command === "themes") {
        process.stdout.write("local-codex\tLocal Codex (automatic default)\n");
        for (const theme of Object.values(themes))
            process.stdout.write(`${theme.name}\t${theme.label}\n`);
    }
    else
        usage();
}
main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
});
