---
name: codex-chat-card
description: 将 Codex Desktop 对话中选定的已完成轮次导出为精美的 PNG 长图或可编辑 SVG。
---

# Codex 对话卡片

只导出用户选定的内容，并在本地处理会话数据。

## 工作流程

1. 阅读[运行说明](references/usage.md)，确认轮次选择规则、展示选项和命令。
2. 用户已指定轮次时直接导出；未指定轮次时，先列出带编号的预览并询问要导出的轮次。
3. 根据所选轮次生成一张高度自适应的图片。默认使用 `conversation`、`local-codex`、`minimal`、`codex-window` 和 PNG。
4. 只保留用户消息和 Codex 最终回答，排除 commentary、reasoning、system/developer 消息和原始工具输出。
5. 使用绝对路径把生成的图片直接展示给用户。

不同轮次需要混合角色时，分别导出多张图片。`codex-window` 只模拟克制的窗口外框，不添加虚构控件。仅在用户要求时添加标题或额外品牌信息。

缺少依赖或编译产物时，在 Skill 目录运行 `npm install` 和 `npm run build`。无法定位当前会话时，请用户提供明确的 Codex JSONL 路径，不要自行选择其他会话。
