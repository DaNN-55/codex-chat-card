import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Static, original line icons for exported window chrome.
export function chromeIcon(name, color) {
    const shapes = {
        sidebar: _jsxs("g", { children: [_jsx("rect", { x: "3", y: "3.5", width: "18", height: "17", rx: "4" }), _jsx("path", { d: "M9 4v16" })] }),
        compose: _jsxs("g", { children: [_jsx("path", { d: "M13 4H7a4 4 0 0 0-4 4v9a4 4 0 0 0 4 4h9a4 4 0 0 0 4-4v-5" }), _jsx("path", { d: "m11 14 1-4 7-7a1.8 1.8 0 0 1 2.5 2.5l-7 7-3.5 1.5Z" })] }),
        copy: _jsxs("g", { children: [_jsx("rect", { x: "4", y: "7", width: "12", height: "14", rx: "2.5" }), _jsx("path", { d: "M8 3h10a2 2 0 0 1 2 2v12" })] }),
        retry: _jsxs("g", { children: [_jsx("path", { d: "M20.5 10A8.5 8.5 0 0 0 5 6M3.5 14A8.5 8.5 0 0 0 19 18" }), _jsx("path", { d: "m16 10 4.5.5.5-4.5M8 14l-4.5-.5L3 18" })] }),
        speaker: _jsxs("g", { children: [_jsx("path", { d: "m11 4-6 5H2v6h3l6 5V4Z" }), _jsx("path", { d: "M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14" })] }),
        like: _jsx("g", { children: _jsx("path", { d: "M8 20H4V10h4M8 10l4-7c2 0 3 1 2 4l-1 3h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H8V10Z" }) }),
        dislike: _jsx("g", { transform: "translate(24 24) rotate(180)", children: _jsx("path", { d: "M8 20H4V10h4M8 10l4-7c2 0 3 1 2 4l-1 3h6a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H8V10Z" }) }),
        share: _jsx("path", { d: "m14 4 8 7-8 7v-4c-5 0-8 2-11 6 0-7 4-12 11-12V4Z" }),
        more: _jsxs("g", { children: [_jsx("circle", { cx: "4", cy: "12", r: "1" }), _jsx("circle", { cx: "12", cy: "12", r: "1" }), _jsx("circle", { cx: "20", cy: "12", r: "1" })] }),
    };
    return (_jsx("svg", { width: "24", height: "24", viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: "1.65", strokeLinecap: "round", strokeLinejoin: "round", children: shapes[name] }));
}
export function answerActions(color) {
    const icons = ["copy", "retry", "speaker", "like", "dislike", "share", "more"];
    return (_jsx("div", { style: { display: "flex", alignItems: "center", gap: "24px", marginTop: "22px", opacity: 0.85 }, children: icons.map((name) => _jsx("div", { style: { display: "flex" }, children: chromeIcon(name, color) }, name)) }));
}
