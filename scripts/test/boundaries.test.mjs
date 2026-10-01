import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { Resvg } from "@resvg/resvg-js";
import { loadConversation } from "../dist/input.js";
import { renderToSvg } from "../dist/renderer.js";
import { selectRounds } from "../dist/selection.js";
import { getTheme } from "../dist/themes.js";
import {
  expectedRounds,
  item,
  record,
  sessionJsonl,
  sessionRecords,
} from "./fixtures/boundaries.mjs";

const execute = promisify(execFile);
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));

async function fixture(t, raw = sessionJsonl) {
  const directory = await mkdtemp(join(tmpdir(), "chat-card-boundary-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, "synthetic.jsonl");
  await writeFile(input, raw);
  return { directory, input };
}

function exportArgs(input, output, selection) {
  return [cli, "export", "--input", input, "--select", selection,
    "--theme", "codex-ink", "--output", output];
}

test("JSONL accepts blank lines, CRLF and a complete final record without a newline", async (t) => {
  const raw = `\r\n${sessionRecords.slice(0, -1).join("\r\n\r\n")}`;
  const { input } = await fixture(t, raw);
  const document = await loadConversation(input);
  assert.equal(document.sessionId, "synthetic-boundary-audit");
  // Exact text verifies that multiple content parts survive parsing in order.
  assert.deepEqual(document.rounds, expectedRounds);
});

test("truncated JSON tails and malformed middle records currently reject the whole log", async (t) => {
  const { input } = await fixture(t);
  for (const raw of [
    `${sessionJsonl}{"type":"event_msg","payload":`,
    `${sessionJsonl}{"type":"event_msg","payload":\n`,
    `${sessionRecords[0]}\n{broken}\n${sessionRecords.slice(1).join("\n")}`,
  ]) {
    await writeFile(input, raw);
    await assert.rejects(() => loadConversation(input), SyntaxError);
  }
});

test("sessions with no complete round report a useful error", async (t) => {
  const { input } = await fixture(t);
  for (const raw of [
    "\n \n",
    record("session_meta", { id: "empty-synthetic" }),
    item("orphan", "AgentMessage", ["没有对应用户消息"]),
    item("pending", "UserMessage", ["只有问题"]),
  ]) {
    await writeFile(input, raw);
    await assert.rejects(() => loadConversation(input), /No completed Codex conversation rounds/);
  }
});

test("legacy logs ignore commentary and replayed answers without losing equal-text later rounds", async (t) => {
  const user = record("event_msg", { type: "user_message", message: "相同问题" });
  const answer = record("response_item", {
    type: "message", role: "assistant", phase: "final_answer",
    content: [{ type: "output_text", text: "相同回答" }],
  });
  const commentary = record("response_item", {
    type: "message", role: "assistant", phase: "commentary",
    content: [{ type: "output_text", text: "不导出的进度" }],
  });
  const { input } = await fixture(t, [user, commentary, answer, answer, user, answer, user].join("\n"));
  assert.deepEqual((await loadConversation(input)).rounds.map(({ index, user, assistant }) =>
    ({ index, user, assistant })), [
    { index: 1, user: "相同问题", assistant: "相同回答" },
    { index: 2, user: "相同问题", assistant: "相同回答" },
  ]);
});

test("invalid selections reject empty, malformed, reversed and unknown round numbers", () => {
  const cases = [
    ["", /Selection cannot be empty/],
    ["  ", /Selection cannot be empty/],
    [",", /Selection cannot be empty/],
    [", ,", /Selection cannot be empty/],
    [",,,", /Selection cannot be empty/],
    ["0", /Invalid round number/],
    ["-1", /Invalid round number/],
    ["1.5", /Invalid round number/],
    ["wat", /Invalid round number/],
    ["4", /Unknown round number/],
    ["1,4", /Unknown round number/],
    ["1-4", /Unknown round number/],
    ["3-1", /Range start must not exceed/],
    ["0-2", /Invalid range start/],
    ["last:0", /Invalid last count/],
    ["last:-1", /Invalid last count/],
    ["last:1.5", /Invalid last count/],
    ["last:wat", /Invalid last count/],
  ];
  for (const [expression, error] of cases) {
    assert.throws(() => selectRounds(expectedRounds, expression), error, expression);
  }
});

test("selection normalizes overlap in conversation order and caps recent counts", () => {
  for (const expression of [" ALL ", " last:99 ", "3,1-2,2,1"]) {
    const selected = selectRounds(expectedRounds, expression);
    assert.deepEqual(selected, expectedRounds);
    assert.notEqual(selected, expectedRounds);
  }
});

test("CLI invalid selections fail before creating or replacing an export", async (t) => {
  const { directory, input } = await fixture(t);
  const output = join(directory, "not-created", "card.svg");
  for (const selection of [",,", "1,4", "3-1", "last:0"]) {
    await assert.rejects(() => execute(process.execPath, exportArgs(input, output, selection)),
      (error) => error.code === 1 && /Selection cannot be empty|Unknown round|Range start|Invalid last count/.test(error.stderr));
    await assert.rejects(() => access(join(directory, "not-created")), { code: "ENOENT" });
  }
  const existing = join(directory, "existing.svg");
  await writeFile(existing, "existing export sentinel");
  await assert.rejects(() => execute(process.execPath, exportArgs(input, existing, ",,")));
  assert.equal(await readFile(existing, "utf8"), "existing export sentinel");
});

test("CLI exports exactly the selected multi-part rounds and content view to SVG and PNG", async (t) => {
  const { directory, input } = await fixture(t);
  // Expected data comes from the synthetic messages, never from loadConversation.
  const rounds = [expectedRounds[0], expectedRounds[2]];
  for (const content of ["conversation", "user", "codex"]) {
    const output = join(directory, `${content}.svg`);
    const args = exportArgs(input, output, "3,1,1");
    if (content !== "conversation") args.push("--content", content);
    const { stdout } = await execute(process.execPath, args);
    const result = JSON.parse(stdout);
    assert.deepEqual(result.selected, [1, 3]);
    assert.equal(result.content, content);
    assert.equal(result.themeSource, "named");
    const svg = await readFile(output, "utf8");
    const expected = await renderToSvg({ rounds, theme: getTheme("codex-ink"), content });
    assert.ok(svg === expected, `${content}: exported SVG must equal the full expected messages`);
    if (content === "conversation") {
      const pngOutput = join(directory, "conversation.png");
      await execute(process.execPath, exportArgs(input, pngOutput, "3,1,1"));
      const expectedPng = Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng());
      assert.ok((await readFile(pngOutput)).equals(expectedPng), "PNG must rasterize the same complete SVG");
    }
  }
});
