# 运行说明

所有命令都在 Skill 目录中执行。

## 运行入口

```bash
node scripts/run.mjs <command> [...options]
```

首次运行缺少 `node_modules` 时，入口会执行 `npm ci --omit=dev --ignore-scripts` 安装锁定的运行依赖，并在成功后继续原命令。该过程需要网络和 Skill 目录写入权限；后续运行不会重复安装。普通用户不需要执行 `npm run build`。

## 查看当前对话

```bash
node scripts/run.mjs list --current --limit 10
```

列表使用稳定的时间顺序轮次编号，并显示时间戳以及用户和 Codex 消息的简短预览。

## 导出

```bash
node scripts/run.mjs export --current --select last:3 --output output/chat.png
node scripts/run.mjs export --current --select last:3 --content user --output output/user-only.png
node scripts/run.mjs export --current --select last:3 --content codex --output output/codex-only.png
node scripts/run.mjs export --current --select last:3 --mode branded --output output/chat-branded.png
node scripts/run.mjs export --current --select last:3 --mode minimal --output output/chat-minimal.png
node scripts/run.mjs export --current --select last:3 --mode clean --output output/chat-clean.png
node scripts/run.mjs export --current --select last:3 --mode branded --mockup codex-window --output output/chat-window.png
node scripts/run.mjs export --current --select last:3 --theme codex-ink --output output/chat.png
node scripts/run.mjs export --current --select 2-4 --theme warm-editorial --output output/chat.png
node scripts/run.mjs export --current --select 1,3,6 --theme frosted-indigo --output output/chat.png
node scripts/run.mjs export --current --select last:2 --theme raycast-night --output output/chat.png
```

轮次选择支持 `last:N`、`all`、`2-4` 这类连续范围，以及用英文逗号分隔的编号或范围。

一轮是“一条用户消息 + 对应的 Codex 最终回答”。轮次选择和内容视图相互独立：

- `--content conversation`：保留每轮双方的内容，默认值。
- `--content user`：只保留每轮的用户消息。
- `--content codex`：只保留每轮的 Codex 最终回答。

用户只说“段”或“条”、没有指定角色时，把数量理解为 `conversation` 视图中的已完成轮次。不同轮次需要混合角色超出了全局内容视图的能力，应分别导出。

自然语言示例：

- “最近两轮对话” → `--select last:2 --content conversation`
- “最近两轮，只要我说的” → `--select last:2 --content user`
- “最近两轮，只要 Codex 说的” → `--select last:2 --content codex`
- “第 1、3、6 轮，双方都要” → `--select 1,3,6 --content conversation`
- “全部，只要 Codex 回答” → `--select all --content codex`

展示模式：

- `branded`：顶部显示 Skill 名称，底部显示署名和仓库地址。
- `minimal`：顶部显示简洁名称，底部只显示仓库地址，默认值。
- `clean`：只显示对话内容。

使用 `--brand-name` 或 `--repository` 可以覆盖显示的名称和仓库地址，不会改变对话内容。

窗口外框：

- `codex-window`：克制的 Codex Desktop 窗口外框，包含 macOS 窗口按钮、小标题栏、圆角边框、轻微阴影，以及随内容长度变化的左侧瀑布条，默认值。
- `none`：不添加应用窗口外框。

窗口外框和展示模式相互独立，`branded`、`minimal`、`clean` 都可以与 `codex-window` 组合。

主题：

- `local-codex`：自动默认值。从 `~/.codex/config.toml` 读取当前 Codex Desktop 的明暗外观、颜色、字体和字号，再应用 Codex 风格的 Markdown 组件规则；读取失败时回退到 `codex-ink`。
- `codex-ink`：固定的 Codex 风格白色画布、黑色用户气泡和少量橙色强调。
- `warm-editorial`：暖纸色画布、浓咖啡色用户气泡和陶土色强调。
- `frosted-indigo`：冷蓝灰画布、靛蓝用户气泡和紫色强调。
- `raycast-night`：近黑色画布、浅色用户气泡和珊瑚色强调。

默认不显示标题或辅助标签。只有需要可见标题时才传入 `--title "..."`。

省略 `--theme` 时使用 `local-codex`。传入固定主题名可以得到不受本机 Codex 设置影响的稳定外观。

需要可编辑的矢量母版时使用 `--format svg`；默认格式为 PNG。
