import type { ReactNode } from "react";

type IconName = "sidebar" | "compose" | "copy" | "retry" | "speaker" | "like" | "dislike" | "share" | "more";

// Static, original line icons for exported window chrome.
export function chromeIcon(name: IconName, color: string): ReactNode {
  const shapes: Record<IconName, ReactNode> = {
    sidebar: <g><rect x="3" y="3.5" width="18" height="17" rx="4" /><path d="M9 4v16" /></g>,
    compose: <g><path d="M13 4H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-5" /><path d="m11 14 1-4 7-7a1.8 1.8 0 0 1 2.5 2.5l-7 7-3.5 1.5Z" /></g>,
    copy: <g><rect x="4" y="7" width="12" height="14" rx="2.5" /><path d="M8 3h10a2 2 0 0 1 2 2v12" /></g>,
    retry: <g><path d="M20.5 10A8.5 8.5 0 0 0 5 6M3.5 14A8.5 8.5 0 0 0 19 18" /><path d="m16 10 4.5.5.5-4.5M8 14l-4.5-.5L3 18" /></g>,
    speaker: <g><path d="m11 4-6 5H2v6h3l6 5V4Z" /><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" /></g>,
    like: <g><path d="M8 20H4V10h4M8 10l4-7c2 0 3 1 2 4l-1 3h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H8V10Z" /></g>,
    dislike: <g transform="translate(24 24) rotate(180)"><path d="M8 20H4V10h4M8 10l4-7c2 0 3 1 2 4l-1 3h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H8V10Z" /></g>,
    share: <path d="m14 4 8 7-8 7v-4c-5 0-8 2-11 6 0-7 4-12 11-12V4Z" />,
    more: <g><circle cx="4" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="20" cy="12" r="1" /></g>,
  };
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {shapes[name]}
    </svg>
  );
}

export function answerActions(color: string): ReactNode {
  const icons: IconName[] = ["copy", "retry", "speaker", "like", "dislike", "share", "more"];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "24px", marginTop: "22px", opacity: 0.85 }}>
      {icons.map((name) => <div key={name} style={{ display: "flex" }}>{chromeIcon(name, color)}</div>)}
    </div>
  );
}
