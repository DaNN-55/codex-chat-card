import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { resolveLocalCodexTheme } from "./dist/local-style.js";
import { renderToPng } from "./dist/renderer.js";
import { getTheme } from "./dist/themes.js";

const outputDirectory = resolve("assets/readme");

const markdownShowcase = [
  "## 导出结果",
  "",
  "已完成 **核心能力**，并保留 *可编辑 SVG*。",
  "",
  "> 所有解析与渲染都在本地完成，对话内容不会上传。",
  "",
  "- 支持 `last:3`、连续范围与离散轮次",
  "- 导出 [PNG 与 SVG](https://github.com/DaNN-55/codex-chat-card)",
  "- 正确显示中文、emoji ✅ 与 ~~过期内容~~",
  "",
  "| 能力 | 状态 | 说明 |",
  "| --- | :---: | --- |",
  "| Markdown | ✅ | 标题、列表、引用、链接 |",
  "| 代码 | ✅ | 行内代码与代码块 |",
  "| 表格 | ✅ | GFM 表格布局 |",
  "",
  "```bash",
  "node scripts/dist/cli.js export \\",
  "  --current --select last:3 --format png",
  "```",
].join("\n");

const richRounds = [
  {
    index: 1,
    turnId: "readme-markdown-showcase",
    user: "请把功能清单整理成一张适合分享的进度卡，并展示常见 Markdown 格式。",
    assistant: markdownShowcase,
  },
];

const compactRounds = [
  {
    index: 1,
    turnId: "readme-mode-showcase",
    user: "主题和内容视图可以独立选择吗？",
    assistant:
      "### 可以\n\n主题控制**视觉**，内容视图控制显示双方、用户或 `Codex`。 ✅",
  },
];

await mkdir(outputDirectory, { recursive: true });

await writeFile(
  resolve(outputDirectory, "markdown-showcase.png"),
  await renderToPng({
    rounds: richRounds,
    theme: getTheme("codex-ink"),
    mode: "minimal",
    mockup: "codex-window",
  }),
);

const fixtureDirectory = await mkdtemp(
  join(tmpdir(), "codex-chat-card-readme-"),
);
const localConfigPath = join(fixtureDirectory, "config.toml");
await writeFile(
  localConfigPath,
  `[desktop]
appearanceTheme = "system"
sansFontSize = 18
codeFontSize = 15

[desktop.appearanceLightChromeTheme]
accent = "#3b82f6"
ink = "#1f1f1f"
surface = "#ffffff"

[desktop.appearanceLightChromeTheme.fonts]
ui = "Geist"

[desktop.appearanceDarkChromeTheme]
accent = "#6ea8e8"
ink = "#f5f5f5"
surface = "#161616"

[desktop.appearanceDarkChromeTheme.fonts]
ui = "Geist"
`,
  "utf8",
);

try {
  for (const appearance of ["light", "dark"]) {
    const resolution = await resolveLocalCodexTheme({
      configPath: localConfigPath,
      systemAppearance: appearance,
    });
    if (resolution.source !== "local-codex") {
      throw new Error(`Unable to resolve local-codex ${appearance} fixture.`);
    }
    await writeFile(
      resolve(outputDirectory, `local-codex-${appearance}.png`),
      await renderToPng({
        rounds: richRounds,
        theme: resolution.theme,
        mode: "minimal",
        mockup: "codex-window",
      }),
    );
  }
} finally {
  await rm(fixtureDirectory, { recursive: true, force: true });
}

for (const name of [
  "codex-ink",
  "warm-editorial",
  "frosted-indigo",
  "raycast-night",
]) {
  await writeFile(
    resolve(outputDirectory, `theme-${name}.png`),
    await renderToPng({
      rounds: richRounds,
      theme: getTheme(name),
      mode: "minimal",
      mockup: "codex-window",
    }),
  );
}

for (const mode of ["clean", "minimal", "branded"]) {
  await writeFile(
    resolve(outputDirectory, `mode-${mode}.png`),
    await renderToPng({
      rounds: compactRounds,
      theme: getTheme("codex-ink"),
      mode,
      mockup: "none",
    }),
  );
}

process.stdout.write(`Generated README assets in ${outputDirectory}\n`);
