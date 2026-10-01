// All messages, identifiers, and timestamps in this fixture are synthetic.
export const timestamp = "2026-10-01T02:00:00.000Z";

export function record(type, payload) {
  return JSON.stringify({ timestamp, type, payload });
}

export function item(turnId, role, texts, phase = "final_answer") {
  return record("event_msg", {
    type: "item_completed",
    turn_id: turnId,
    item: {
      id: `${turnId}-${role}-${phase}`,
      type: role,
      ...(role === "AgentMessage" ? { phase } : {}),
      content: texts.map((text) => ({ type: "text", text })),
    },
  });
}

const messages = [
  {
    user: ["U1_BEGIN 请核对这份合成导出。", "U1_END 用户消息第二段也要保留。"],
    assistant: [
      "## A1_BEGIN 合成验收结果\n\n首段包含 **粗体**、*斜体*、~~删除线~~ 和 `inline_code`。",
      "> 引用内容需要完整显示。\n\n- 列表第一项\n- 列表第二项\n\n| 检查项 | 结果 |\n| --- | --- |\n| TABLE_BODY | ✅ |\n\n[LINK_BODY](https://example.com/synthetic)\n\n```ts\nconst CODE_BODY = 'synthetic';\n```\n\nA1_END 第一轮回答末尾。",
    ],
  },
  {
    user: ["EXCLUDED_USER 这一轮不应出现在选择 1、3 的导出中。"],
    assistant: ["EXCLUDED_ASSISTANT 未选择的回答。"],
  },
  {
    user: ["U3_BEGIN 请继续核对最后一轮。", "U3_END 最后一条用户消息末尾。"],
    assistant: [
      "A3_BEGIN 这是最后一轮的回答。",
      "正文中段必须保留。\n\nA3_END 全部所选内容到这里结束。",
    ],
  },
];

export const expectedRounds = messages.map((message, offset) => ({
  index: offset + 1,
  turnId: `synthetic-${offset + 1}`,
  timestamp,
  user: message.user.join("\n\n"),
  assistant: message.assistant.join("\n\n"),
}));

export const sessionRecords = [
  record("session_meta", { id: "synthetic-boundary-audit" }),
  ...messages.flatMap((message, offset) => {
    const turnId = `synthetic-${offset + 1}`;
    return [
      item(turnId, "UserMessage", message.user),
      item(turnId, "AgentMessage", ["HIDDEN_COMMENTARY 合成进度消息。"], "commentary"),
      item(turnId, "AgentMessage", message.assistant),
    ];
  }),
  item("synthetic-pending", "UserMessage", ["INCOMPLETE_USER 尚无最终回答。"]),
];

export const sessionJsonl = `${sessionRecords.join("\n")}\n`;
