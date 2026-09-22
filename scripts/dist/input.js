import { homedir } from "node:os";
import { basename, extname, join } from "node:path";
import { readFile, readdir } from "node:fs/promises";
function textParts(content) {
    if (!Array.isArray(content))
        return [];
    const parts = [];
    for (const entry of content) {
        if (!entry || typeof entry !== "object")
            continue;
        const value = entry;
        if (typeof value.text === "string" && value.text.trim())
            parts.push(value.text.trim());
    }
    return parts;
}
export function sanitizeUserMessage(text) {
    const hasAttachmentEnvelope = /^\s*# Files mentioned by the user:/m.test(text);
    if (!hasAttachmentEnvelope)
        return text.trim();
    const requestMarker = text.match(/^## My request:\s*$/m);
    const request = requestMarker
        ? text.slice((requestMarker.index ?? 0) + requestMarker[0].length)
        : text;
    return request
        .replace(/^\s*<(?:image|audio|video)\b[^>]*>\s*$/gim, "")
        .trim();
}
function currentDesktopRounds(records) {
    const byTurn = new Map();
    const order = [];
    const getRound = (turnId, timestamp) => {
        let round = byTurn.get(turnId);
        if (!round) {
            round = { turnId, timestamp, user: [], assistant: [] };
            byTurn.set(turnId, round);
            order.push(turnId);
        }
        return round;
    };
    for (const record of records) {
        if (record.type !== "event_msg")
            continue;
        const payload = record.payload ?? {};
        if (payload.type !== "item_completed")
            continue;
        const turnId = typeof payload.turn_id === "string" ? payload.turn_id : undefined;
        const item = payload.item;
        if (!turnId || !item || typeof item !== "object")
            continue;
        const typedItem = item;
        const round = getRound(turnId, record.timestamp);
        if (typedItem.type === "UserMessage") {
            round.user.push(...textParts(typedItem.content));
        }
        if (typedItem.type === "AgentMessage" &&
            typedItem.phase === "final_answer") {
            round.assistant.push(...textParts(typedItem.content));
        }
    }
    return order
        .map((turnId) => byTurn.get(turnId))
        .filter((round) => round.user.length > 0 && round.assistant.length > 0)
        .map((round, index) => ({
        index: index + 1,
        turnId: round.turnId,
        timestamp: round.timestamp,
        user: sanitizeUserMessage(round.user.join("\n\n")),
        assistant: round.assistant.join("\n\n"),
    }));
}
function legacyRounds(records) {
    const rounds = [];
    let pending = null;
    for (const record of records) {
        const payload = record.payload ?? {};
        if (record.type === "event_msg" && payload.type === "user_message") {
            if (typeof payload.message === "string" && payload.message.trim()) {
                pending = {
                    timestamp: record.timestamp,
                    user: payload.message.trim(),
                    assistant: [],
                };
            }
            continue;
        }
        if (record.type !== "response_item" ||
            payload.type !== "message" ||
            payload.role !== "assistant")
            continue;
        if (!pending || payload.phase === "commentary")
            continue;
        pending.assistant.push(...textParts(payload.content));
        if (pending.assistant.length > 0) {
            rounds.push({
                index: rounds.length + 1,
                turnId: `legacy-${rounds.length + 1}`,
                timestamp: pending.timestamp,
                user: sanitizeUserMessage(pending.user),
                assistant: pending.assistant.join("\n\n"),
            });
            pending = null;
        }
    }
    return rounds;
}
export async function loadConversation(inputPath) {
    const raw = await readFile(inputPath, "utf8");
    const records = raw
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => JSON.parse(line));
    const sessionMeta = records.find((record) => record.type === "session_meta")?.payload;
    const sessionId = (typeof sessionMeta?.id === "string" && sessionMeta.id) ||
        basename(inputPath, extname(inputPath));
    const current = currentDesktopRounds(records);
    const rounds = current.length > 0 ? current : legacyRounds(records);
    if (rounds.length === 0) {
        throw new Error("No completed Codex conversation rounds were found in this session.");
    }
    return { sessionId, sourcePath: inputPath, rounds };
}
async function findByThreadId(directory, threadId) {
    let entries;
    try {
        entries = await readdir(directory, { withFileTypes: true });
    }
    catch {
        return null;
    }
    for (const entry of entries) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) {
            const found = await findByThreadId(path, threadId);
            if (found)
                return found;
        }
        else if (entry.isFile() &&
            entry.name.includes(threadId) &&
            entry.name.endsWith(".jsonl")) {
            return path;
        }
    }
    return null;
}
export async function resolveCurrentSession() {
    const threadId = process.env.CODEX_THREAD_ID;
    if (!threadId)
        throw new Error("CODEX_THREAD_ID is not set; pass --input with a Codex JSONL path.");
    const codexRoot = join(homedir(), ".codex");
    for (const directory of [
        join(codexRoot, "sessions"),
        join(codexRoot, "archived_sessions"),
    ]) {
        const found = await findByThreadId(directory, threadId);
        if (found)
            return found;
    }
    throw new Error(`No Codex session file was found for thread ${threadId}.`);
}
