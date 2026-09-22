# 贡献指南

感谢你帮助改进 Codex Chat Card。

## 开发环境

要求：

- Node.js 20 或更高版本
- npm

安装依赖并运行检查：

```bash
npm ci
npm test
```

测试命令会编译 TypeScript 运行时，并检查会话解析、轮次选择、主题、Markdown 渲染、PNG/SVG 输出、内容视图和展示模式。

## Pull Request

- 改动应聚焦于 Codex 对话卡片导出。
- 会话夹具和截图只能使用合成内容或完整脱敏内容。
- CLI 行为变化时同步更新 `references/usage.md`。
- TypeScript 源码变化时同步提交生成的 `scripts/dist/` 文件。
- 创建 Pull Request 前运行 `npm test`。

不要提交 Codex 会话日志、临时导出图片、凭据或机器专属路径。
