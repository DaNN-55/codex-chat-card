# Codex Chat Card

把 Codex Desktop 对话里选中的轮次导出成一张 PNG 长图，或可继续编辑的 SVG。

支持按轮次选择内容、只保留一方消息、切换主题和展示模式。解析与渲染都在本地完成，不上传会话。

## 效果

下面这张合成对话展示标题、粗体、斜体、删除线、引用、列表、链接、表格、行内代码、代码块和 emoji 的实际导出效果。

<img src="assets/readme/markdown-showcase.png" alt="Codex Chat Card 的 Markdown 格式导出效果，包括标题、列表、引用、链接、表格和代码块">

### 本机 Codex 主题

`local-codex` 会读取用户本地 Codex 配置中的明暗模式、颜色、字体和字号。下面使用脱敏的代表性本地配置分别展示 light 和 dark；实际导出效果以每位用户的本地配置为准。

<table>
  <tr>
    <th><code>local-codex · light</code><br><sub>读取用户本地配置</sub></th>
    <th><code>local-codex · dark</code><br><sub>读取用户本地配置</sub></th>
  </tr>
  <tr>
    <td><img src="assets/readme/local-codex-light.png" alt="local-codex light，读取用户本地 Codex 配置生成"></td>
    <td><img src="assets/readme/local-codex-dark.png" alt="local-codex dark，读取用户本地 Codex 配置生成"></td>
  </tr>
</table>

### 固定主题

四种固定主题使用同一份 Markdown 内容生成，方便直接比较配色和排版差异。

<table>
  <tr>
    <th><code>codex-ink</code></th>
    <th><code>warm-editorial</code></th>
  </tr>
  <tr>
    <td><img src="assets/readme/theme-codex-ink.png" alt="codex-ink 黑白主题效果"></td>
    <td><img src="assets/readme/theme-warm-editorial.png" alt="warm-editorial 暖色主题效果"></td>
  </tr>
  <tr>
    <th><code>frosted-indigo</code></th>
    <th><code>raycast-night</code></th>
  </tr>
  <tr>
    <td><img src="assets/readme/theme-frosted-indigo.png" alt="frosted-indigo 淡靛蓝主题效果"></td>
    <td><img src="assets/readme/theme-raycast-night.png" alt="raycast-night 深色主题效果"></td>
  </tr>
</table>

展示模式控制卡片上保留多少身份信息，与主题可以自由组合。

<table>
  <tr>
    <th><code>clean</code></th>
    <th><code>minimal</code></th>
    <th><code>branded</code></th>
  </tr>
  <tr>
    <td><img src="assets/readme/mode-clean.png" alt="clean 模式，只显示对话"></td>
    <td><img src="assets/readme/mode-minimal.png" alt="minimal 模式，显示名称和仓库地址"></td>
    <td><img src="assets/readme/mode-branded.png" alt="branded 模式，显示完整署名信息"></td>
  </tr>
</table>

## 特点

- **按轮次导出**：支持最近几轮、全部、连续范围和离散编号。
- **三种内容视图**：导出完整对话、只看用户消息，或只看 Codex 回答。
- **本机 Codex 外观**：默认读取本机明暗模式、颜色和字体；读取失败时回退到 `codex-ink`。
- **固定主题**：内置 `codex-ink`、`warm-editorial`、`frosted-indigo` 和 `raycast-night`。
- **两种格式**：PNG 适合直接分享，SVG 适合继续编辑。
- **Markdown 渲染**：支持标题、列表、链接、表格、代码块、中文和 emoji。
- **内容过滤**：图片只包含用户消息和 Codex 最终回答，不包含 reasoning、commentary 和工具日志。
- **动态窗口刻度**：左侧瀑布条会随所选轮数和可见内容长度增减。

默认组合是 `local-codex` 主题、`minimal` 模式和 `codex-window` 外框。

## 安装

在 Codex 中使用 Skill Installer：

```text
使用 $skill-installer 从 https://github.com/DaNN-55/codex-chat-card 安装这个 Skill
```

也可以手动安装。需要 Node.js 20+ 和 npm：

```bash
git clone https://github.com/DaNN-55/codex-chat-card.git \
  ~/.agents/skills/codex-chat-card
```

安装后如果没有立即显示，重启一次 Codex。首次使用时，Skill 会在安装目录执行 `npm ci --omit=dev --ignore-scripts` 下载锁定的运行依赖，然后继续原来的预览或导出命令；这一步需要网络和一次安装目录写入权限。后续使用不会重复安装，除非 `package-lock.json` 发生变化。

## 用法

直接告诉 Codex 要导出哪些内容：

```text
使用 $codex-chat-card 导出最近三轮对话。
```

也可以一次说清轮次和样式：

```text
使用 $codex-chat-card 导出第 2–4 轮完整对话，
使用 warm-editorial 主题、branded 模式和 Codex 窗口外框。
```

没有指定轮次时，Skill 会先列出带编号的对话预览，再询问要导出哪些轮次。

## 命令行

列出当前会话最近 10 轮：

```bash
node scripts/run.mjs list --current --limit 10
```

导出最近 3 轮：

```bash
node scripts/run.mjs export \
  --current \
  --select last:3 \
  --content conversation \
  --mode minimal \
  --mockup codex-window \
  --output output/chat.png
```

无法自动定位当前会话时，用 `--input /path/to/session.jsonl` 代替 `--current`。全部参数和示例见 [`references/usage.md`](references/usage.md)。

## 隐私

Skill 只在本地读取 Codex JSONL、字体和外观设置，然后把图片写入指定路径。项目不包含上传或遥测功能。

分享前请检查导出图片是否包含不适合公开的信息。仓库截图和测试只使用合成或已脱敏内容。

## 本地测试

```bash
npm ci
npm test
```

测试覆盖会话解析、轮次选择、内容视图、主题回退、Markdown、emoji，以及 PNG/SVG 输出。

## 目录结构

```text
SKILL.md             Skill 工作流和默认行为
scripts/run.mjs      首次运行依赖初始化和统一命令入口
scripts/src/         TypeScript 源码
scripts/dist/        可直接运行的编译产物
scripts/test/        自动化测试
references/usage.md  参数、选择规则和命令示例
assets/readme/       README 展示图片
```

## 当前限制

- 当前会话自动定位面向 Codex Desktop 会话日志。
- Codex 日志格式和本地外观配置可能变化，运行时会使用兼容回退。
- 一张图片只能使用一种内容视图；混合角色需求会分别导出。
- 超长对话应拆成多个较小的导出任务。

## 许可证

本项目使用 [MIT License](LICENSE)。第三方依赖及其许可证见[第三方软件说明](THIRD_PARTY_NOTICES.md)。
