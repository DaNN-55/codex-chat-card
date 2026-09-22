import type { ConversationRound } from "./types.js";

function integer(value: string, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1)
    throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

export function selectRounds(
  rounds: ConversationRound[],
  expression: string,
): ConversationRound[] {
  const normalized = expression.trim().toLowerCase();
  if (!normalized) throw new Error("Selection cannot be empty.");
  if (normalized === "all") return [...rounds];
  if (normalized.startsWith("last:")) {
    const count = integer(normalized.slice(5), "last count");
    return rounds.slice(Math.max(0, rounds.length - count));
  }

  const indexes = new Set<number>();
  for (const token of normalized
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const range = token.match(/^(\d+)-(\d+)$/);
    if (range) {
      const start = integer(range[1], "range start");
      const end = integer(range[2], "range end");
      if (start > end)
        throw new Error(`Range start must not exceed range end: ${token}`);
      for (let value = start; value <= end; value += 1) indexes.add(value);
      continue;
    }
    indexes.add(integer(token, "round number"));
  }

  const missing = [...indexes].filter(
    (index) => !rounds.some((round) => round.index === index),
  );
  if (missing.length > 0)
    throw new Error(`Unknown round number(s): ${missing.join(", ")}`);
  return rounds.filter((round) => indexes.has(round.index));
}

export function preview(text: string, length = 72): string {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length <= length
    ? compact
    : `${compact.slice(0, length - 1)}…`;
}
