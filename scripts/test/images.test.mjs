import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import test from "node:test";
import { Resvg } from "@resvg/resvg-js";
import { loadConversation } from "../dist/input.js";
import { loadImageAssets } from "../dist/images.js";
import { markdownImageSources } from "../dist/markdown.js";
import { renderToPng, renderToSvg } from "../dist/renderer.js";
import { preview } from "../dist/selection.js";
import { getTheme } from "../dist/themes.js";
import { record } from "./fixtures/boundaries.mjs";

const execute = promisify(execFile);
const theme = getTheme("codex-ink");
const cli = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const jpegFixture = new URL("./fixtures/synthetic-shapes.jpg", import.meta.url);

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "chat-card-images-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "images"));
  // Transparent synthetic shapes; no real conversation or personal images.
  const png = Buffer.from(new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect x="60" y="40" width="520" height="320" rx="50" fill="#9bc7b0"/><circle cx="320" cy="200" r="95" fill="#204936"/></svg>').render().asPng());
  const jpeg = await readFile(jpegFixture);
  await writeFile(join(directory, "images", "green shape.png"), png);
  await writeFile(join(directory, "images", "warm.jpg"), jpeg);
  await writeFile(join(directory, "broken.png"), "not an image");
  return { directory, png, jpeg };
}

function rasterImages(svg) {
  return [...svg.matchAll(/<image\b[^>]*>/g)].filter(([tag]) => /data:image\/(png|jpeg);base64,/.test(tag)).map(([tag]) => ({
    data: tag.match(/(?:href|xlink:href)="([^"]+)"/)?.[1],
    ...Object.fromEntries(["x", "y", "width", "height"].map((key) => [key, Number(tag.match(new RegExp(`${key}="([0-9.]+)"`))?.[1])])),
  }));
}

test("structured image messages retain image-only turns and interleaved content order", async (t) => {
  const { directory } = await fixture(t);
  const input = join(directory, "session.jsonl");
  const message = (turn, type, content) => record("event_msg", { type: "item_completed", turn_id: turn,
    item: { type, phase: "final_answer", content } });
  await writeFile(input, [
    message("mixed", "UserMessage", [{ type: "text", text: "前文" }, { type: "LocalImage", path: "images/green shape.png", alt: "绿图" }, { type: "text", text: "后文" }]),
    message("mixed", "AgentMessage", [{ type: "image_url", image_url: { url: "images/warm.jpg" }, alt: "暖图" }]),
    message("image-only", "UserMessage", [{ type: "Image", url: "images/warm.jpg" }]),
    message("image-only", "AgentMessage", [{ type: "text", text: "完成" }]),
  ].join("\n"));
  const { rounds } = await loadConversation(input);
  assert.equal(rounds.length, 2);
  assert.equal(rounds[0].user, "前文\n\n![绿图](<images/green shape.png>)\n\n后文");
  assert.deepEqual(markdownImageSources(rounds[0].assistant), ["images/warm.jpg"]);
  assert.deepEqual(markdownImageSources(rounds[1].user), ["images/warm.jpg"]);
});

test("image loading supports relative paths, file URLs and data URLs with visible fallbacks", async (t) => {
  const { directory, png, jpeg } = await fixture(t);
  const data = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const url = pathToFileURL(join(directory, "images", "green shape.png")).href;
  const sources = ["images/green%20shape.png", url, data, "missing.png", "broken.png", "https://example.invalid/image.jpg"];
  const assets = await loadImageAssets(sources, directory);
  for (const source of sources.slice(0, 3)) {
    assert.equal(assets.get(source).width, 640);
    assert.equal(assets.get(source).height, 400);
  }
  assert.equal(assets.get(url).data, `data:image/png;base64,${png.toString("base64")}`);
  assert.equal(assets.get(data).data, data);
  for (const source of sources.slice(3)) assert.ok(assets.get(source).reason);
});

test("reference-style images and previews preserve labels without exposing encoded image data", () => {
  const markdown = "前文\n\n![示意图][asset]\n\n后文\n\n[asset]: data:image/png;base64,abc123";
  assert.deepEqual(markdownImageSources(markdown), ["data:image/png;base64,abc123"]);
  assert.equal(preview(markdown), "前文 [图片：示意图] 后文");
});

test("multi-image exports embed actual PNG/JPG bytes in order without cropping", async (t) => {
  const { directory, png, jpeg } = await fixture(t);
  const rounds = [{ index: 1, turnId: "gallery", user: "请比较合成图片", assistant:
    "前文\n\n![绿图](<images/green shape.png>)\n\n![暖图](images/warm.jpg)\n\n后文\n\n![第三图](images/warm.jpg)\n\nTAIL_END" }];
  const svg = await renderToSvg({ rounds, theme, imageBaseDirectory: directory });
  const images = rasterImages(svg);
  assert.equal(images.length, 3);
  assert.equal(images[0].data, `data:image/png;base64,${png.toString("base64")}`);
  assert.equal(images[1].data, `data:image/jpeg;base64,${jpeg.toString("base64")}`);
  assert.equal(images[0].y, images[1].y, "adjacent images share a gallery row");
  assert.ok(images[1].x > images[0].x + images[0].width);
  assert.ok(images[2].y > images[1].y + images[1].height, "intervening text breaks the gallery");
  for (const image of images) {
    assert.ok(image.x >= 0 && image.x + image.width <= 1200);
    assert.ok(Math.abs(image.width / image.height - 640 / 400) < 0.01);
  }
  const changed = [{ ...rounds[0], assistant: rounds[0].assistant.replace("TAIL_END", "TAIL_ENX") }];
  assert.ok(!(await renderToPng({ rounds, theme, imageBaseDirectory: directory })).equals(
    await renderToPng({ rounds: changed, theme, imageBaseDirectory: directory })), "last text remains visible after images");
  const small = Buffer.from(new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#9bc7b0"/></svg>').render().asPng());
  const smallImage = `![小图](data:image/png;base64,${small.toString("base64")})`;
  const smallImages = rasterImages(await renderToSvg({ rounds: [{ ...rounds[0], assistant: Array(3).fill(smallImage).join("\n\n") }], theme }));
  assert.equal(smallImages[0].y, smallImages[1].y);
  assert.ok(smallImages[2].y >= smallImages[0].y + smallImages[0].height, "small images also wrap after two columns");
  assert.equal(smallImages[2].x, smallImages[0].x);
});

test("image payload size does not count as visible text in the canvas estimate", async (t) => {
  const { directory, jpeg } = await fixture(t);
  const data = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  const svg = await renderToSvg({ rounds: [{ index: 1, turnId: "embedded", user: "合成数据图片", assistant:
    Array.from({ length: 12 }, () => `![图片](${data})`).join("\n\n") }], theme, imageBaseDirectory: directory });
  assert.equal(rasterImages(svg).length, 12);
});

test("content views exclude the other role's images and missing files do not abort export", async (t) => {
  const { directory } = await fixture(t);
  const rounds = [{ index: 1, turnId: "roles", user: "![用户图](<images/green shape.png>)",
    assistant: "![回答图](images/warm.jpg)\n\n![缺图](missing.png)\n\n末尾" }];
  const userSvg = await renderToSvg({ rounds, theme, content: "user", imageBaseDirectory: directory });
  const codexSvg = await renderToSvg({ rounds, theme, content: "codex", imageBaseDirectory: directory });
  assert.equal(rasterImages(userSvg).length, 1);
  assert.match(rasterImages(userSvg)[0].data, /^data:image\/png/);
  assert.equal(rasterImages(codexSvg).length, 1);
  assert.match(rasterImages(codexSvg)[0].data, /^data:image\/jpeg/);
  const changed = [{ ...rounds[0], assistant: "![其他缺图](other-missing.png)" }];
  assert.ok(userSvg === await renderToSvg({ rounds: changed, theme, content: "user", imageBaseDirectory: directory }));
  const missingChanged = [{ ...rounds[0], assistant: rounds[0].assistant.replace("缺图", "缺失示意图") }];
  assert.ok(codexSvg !== await renderToSvg({ rounds: missingChanged, theme, content: "codex", imageBaseDirectory: directory }),
    "missing image labels must remain visible");
});

test("CLI resolves image references relative to the input session and keeps SVG/PNG consistent", async (t) => {
  const { directory, png } = await fixture(t);
  const input = join(directory, "session.jsonl");
  await writeFile(input, [
    record("event_msg", { type: "user_message", message: "合成测试" }),
    record("response_item", { type: "message", role: "assistant", content: [{ text: "![绿图](<images/green shape.png>)" }] }),
  ].join("\n"));
  const svgPath = join(directory, "card.svg");
  const pngPath = join(directory, "card.png");
  for (const output of [svgPath, pngPath]) {
    await execute(process.execPath, [cli, "export", "--input", input, "--theme", "codex-ink", "--output", output]);
  }
  const svg = await readFile(svgPath, "utf8");
  assert.equal(rasterImages(svg)[0].data, `data:image/png;base64,${png.toString("base64")}`);
  assert.ok((await readFile(pngPath)).equals(Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng())));
});
