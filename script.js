const displayEl = document.getElementById("display");
const exprEl = document.getElementById("expr");
const keysEl = document.querySelector(".keys");
const historyListEl = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const themeToggleBtn = document.getElementById("themeToggle");
const copyBtn = document.getElementById("copyBtn");

const MAX_LEN = 80;
const HISTORY_KEY = "calc.history.v2";
const THEME_KEY = "calc.theme.v1";

let expr = "";
let justEvaluated = false;
let memory = 0;
let history = loadHistory();

function render() {
  exprEl.textContent = expr;
  displayEl.textContent = preview(expr);
  renderHistory();
  themeToggleBtn.textContent = document.documentElement.dataset.theme === "light" ? "Light" : "Dark";
}

function clamp(s) {
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN) : s;
}

function clearAll() {
  expr = "";
  justEvaluated = false;
  render();
}

function backspace() {
  expr = expr.slice(0, -1);
  justEvaluated = false;
  render();
}

function append(s) {
  if (justEvaluated) {
    // If user starts typing a number or '(' after result, start fresh.
    if (/^[0-9.(]$/.test(s)) expr = "";
    justEvaluated = false;
  }
  expr = clamp(expr + s);
  render();
}

function appendDigit(d) {
  append(d);
}

function appendDot() {
  const lastToken = getLastNumberToken(expr);
  if (lastToken.includes(".")) return;
  if (expr === "" || /[+\-*/(]$/.test(expr)) append("0.");
  else append(".");
}

function appendOp(op) {
  if (!expr && op !== "-") return;
  if (/[+\-*/]$/.test(expr)) {
    expr = expr.slice(0, -1) + op;
    justEvaluated = false;
    render();
    return;
  }
  append(op);
}

function insertLParen() {
  if (expr && /[0-9.)]$/.test(expr)) append("*");
  append("(");
}

function insertRParen() {
  if (!expr) return;
  append(")");
}

function togglePercent() {
  // n% => n/100 (only for last number)
  const r = getLastNumberRange(expr);
  if (r.start === -1) return;
  const n = Number(expr.slice(r.start, r.end));
  if (!Number.isFinite(n)) return;
  const pct = n / 100;
  expr = clamp(expr.slice(0, r.start) + String(pct) + expr.slice(r.end));
  justEvaluated = false;
  render();
}

function toggleSign() {
  const r = getLastNumberRange(expr);
  if (r.start === -1) return;
  const token = expr.slice(r.start, r.end);
  if (token.startsWith("-")) expr = expr.slice(0, r.start) + token.slice(1) + expr.slice(r.end);
  else expr = expr.slice(0, r.start) + "-" + token + expr.slice(r.end);
  justEvaluated = false;
  render();
}

function equals() {
  const normalized = normalize(expr);
  if (!normalized) return;
  const v = evaluate(normalized);
  if (v === null) {
    displayEl.textContent = "Error";
    return;
  }
  const out = formatNumber(v);
  pushHistory(normalized, out);
  expr = out;
  exprEl.textContent = normalized;
  displayEl.textContent = out;
  justEvaluated = true;
}

function normalize(s) {
  let out = s.trim();
  while (out && /[+\-*/(]$/.test(out[out.length - 1])) out = out.slice(0, -1);
  return out;
}

function preview(s) {
  const normalized = normalize(s);
  if (!normalized) return "0";
  const v = evaluate(normalized);
  return v === null ? "Error" : formatNumber(v);
}

function evaluate(s) {
  const jsExpr = toSafeJsExpr(s);
  if (jsExpr === null) return null;
  try {
    const result = Function(`"use strict"; return (${jsExpr});`)();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function toSafeJsExpr(s) {
  // Allow only digits, operators, parentheses, dot and spaces.
  // This makes Function() usage interview-friendly and safe enough for this small project.
  const cleaned = s.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null;
  // Block obvious invalid operator sequences
  if (/[*+/]{2,}/.test(cleaned)) return null;
  return cleaned;
}

function formatNumber(n) {
  const v = Object.is(n, -0) ? 0 : n;
  const abs = Math.abs(v);
  const str = abs !== 0 && (abs >= 1e12 || abs < 1e-9) ? v.toPrecision(12) : String(roundTo(v, 12));
  return trimZeros(str);
}

function roundTo(n, decimals) {
  const p = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * p) / p;
}

function trimZeros(s) {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

function getLastNumberRange(s) {
  let i = s.length - 1;
  if (i < 0) return { start: -1, end: -1 };
  while (i >= 0 && /[0-9.]/.test(s[i])) i--;
  const end = i + 1;
  if (end <= 0) return { start: -1, end: -1 };
  if (i >= 0 && s[i] === "-") {
    const before = i - 1 >= 0 ? s[i - 1] : "";
    if (before === "" || /[+\-*/(]$/.test(before)) i--;
  }
  const start = i + 1;
  return start === end ? { start: -1, end: -1 } : { start, end };
}

function getLastNumberToken(s) {
  const r = getLastNumberRange(s);
  return r.start === -1 ? "" : s.slice(r.start, r.end);
}

// History (saved)
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {
    // ignore
  }
}

function pushHistory(expression, resultStr) {
  history.unshift({ expr: expression, result: resultStr, ts: Date.now() });
  history = history.slice(0, 20);
  saveHistory();
}

function renderHistory() {
  historyListEl.innerHTML = "";
  for (const item of history) {
    const el = document.createElement("div");
    el.className = "history__item";
    el.tabIndex = 0;
    el.innerHTML = `<div class="history__expr"></div><div class="history__res"></div>`;
    el.querySelector(".history__expr").textContent = item.expr;
    el.querySelector(".history__res").textContent = item.result;
    el.addEventListener("click", () => {
      expr = item.expr;
      justEvaluated = false;
      render();
    });
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        expr = item.expr;
        justEvaluated = false;
        render();
      }
    });
    historyListEl.appendChild(el);
  }
}

// Theme (saved)
function loadTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

// Events
keysEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.digit) return appendDigit(btn.dataset.digit);
  if (btn.dataset.op) return appendOp(btn.dataset.op);

  switch (btn.dataset.action) {
    case "clear":
      return clearAll();
    case "backspace":
      return backspace();
    case "dot":
      return appendDot();
    case "equals":
      return equals();
    case "percent":
      return togglePercent();
    case "sign":
      return toggleSign();
    case "lparen":
      return insertLParen();
    case "rparen":
      return insertRParen();
    case "mc":
      memory = 0;
      return render();
    case "mr":
      return append(formatNumber(memory));
    case "mplus": {
      const v = evaluate(normalize(expr));
      if (v !== null) memory += v;
      return render();
    }
    case "mminus": {
      const v = evaluate(normalize(expr));
      if (v !== null) memory -= v;
      return render();
    }
    default:
      return;
  }
});

clearHistoryBtn.addEventListener("click", () => {
  history = [];
  saveHistory();
  render();
});

themeToggleBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  setTheme(next);
  render();
});

copyBtn.addEventListener("click", async () => {
  const text = displayEl.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => render(), 700);
  } catch {
    // ignore
  }
});

window.addEventListener("keydown", (e) => {
  const k = e.key;
  if (/^[0-9]$/.test(k)) return appendDigit(k);
  if (k === ".") return appendDot();
  if (k === "(") return insertLParen();
  if (k === ")") return insertRParen();
  if (k === "+" || k === "-" || k === "*" || k === "/") return appendOp(k);
  if (k === "Enter" || k === "=") {
    e.preventDefault();
    return equals();
  }
  if (k === "Backspace") return backspace();
  if (k === "Escape") return clearAll();
  if (k === "%") return togglePercent();
});

setTheme(loadTheme());
render();
