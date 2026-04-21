// ----------------------
// DOM
// ----------------------
const displayEl = document.getElementById("display");
const expressionEl = document.getElementById("expr");
const keysEl = document.querySelector(".keys");
const historyListEl = document.getElementById("historyList");
const clearHistoryBtn = document.getElementById("clearHistory");
const themeToggleBtn = document.getElementById("themeToggle");
const copyBtn = document.getElementById("copyBtn");

// ----------------------
// State
// ----------------------
const MAX_EXPRESSION_LENGTH = 80;
const HISTORY_STORAGE_KEY = "calc.history.v2";
const THEME_STORAGE_KEY = "calc.theme.v1";
const HISTORY_LIMIT = 20;

let expression = "";
let isResultOnScreen = false;
let memory = 0;
let history = loadHistory();

// ----------------------
// UI
// ----------------------
function updateUI() {
  expressionEl.textContent = expression;
  displayEl.textContent = getPreview(expression);
  renderHistory();
  themeToggleBtn.textContent = document.documentElement.dataset.theme === "light" ? "Light" : "Dark";
}

function truncateExpression(value) {
  return value.length > MAX_EXPRESSION_LENGTH ? value.slice(0, MAX_EXPRESSION_LENGTH) : value;
}

// ----------------------
// Expression editing
// ----------------------
function clearAll() {
  expression = "";
  isResultOnScreen = false;
  updateUI();
}

function backspace() {
  expression = expression.slice(0, -1);
  isResultOnScreen = false;
  updateUI();
}

function appendText(text) {
  // If a result is showing and the user starts a new number/bracket, start a new expression.
  if (isResultOnScreen && /^[0-9.(]$/.test(text)) {
    expression = "";
  }

  isResultOnScreen = false;
  expression = truncateExpression(expression + text);
  updateUI();
}

function appendDigit(digit) {
  appendText(digit);
}

function appendDecimal() {
  const lastToken = getLastNumberToken(expression);
  if (lastToken.includes(".")) return;

  if (expression === "" || /[+\-*/(]$/.test(expression)) appendText("0.");
  else appendText(".");
}

function appendOperator(op) {
  if (!expression && op !== "-") return;

  // Replace the last operator instead of appending another.
  if (/[+\-*/]$/.test(expression)) {
    expression = expression.slice(0, -1) + op;
    isResultOnScreen = false;
    updateUI();
    return;
  }

  appendText(op);
}

function insertLeftParen() {
  // Example: "2(" => "2*("
  if (expression && /[0-9.)]$/.test(expression)) appendText("*");
  appendText("(");
}

function insertRightParen() {
  if (!expression) return;
  appendText(")");
}

function applyPercentToLastNumber() {
  // Example: "50%" => "0.5" (we convert the last number only)
  const range = getLastNumberRange(expression);
  if (range.start === -1) return;

  const n = Number(expression.slice(range.start, range.end));
  if (!Number.isFinite(n)) return;

  const percent = n / 100;
  expression = truncateExpression(
    expression.slice(0, range.start) + String(percent) + expression.slice(range.end),
  );
  isResultOnScreen = false;
  updateUI();
}

function toggleSignOfLastNumber() {
  const range = getLastNumberRange(expression);
  if (range.start === -1) return;

  const token = expression.slice(range.start, range.end);
  if (!token) return;

  expression = token.startsWith("-")
    ? expression.slice(0, range.start) + token.slice(1) + expression.slice(range.end)
    : expression.slice(0, range.start) + "-" + token + expression.slice(range.end);

  isResultOnScreen = false;
  updateUI();
}

// ----------------------
// Evaluation
// ----------------------
function onEquals() {
  const normalized = normalizeExpression(expression);
  if (!normalized) return;

  const value = evaluateExpression(normalized);
  if (value === null) {
    displayEl.textContent = "Error";
    return;
  }

  const resultText = formatNumber(value);
  addHistoryItem(normalized, resultText);

  expression = resultText;
  expressionEl.textContent = normalized;
  displayEl.textContent = resultText;
  isResultOnScreen = true;
}

function normalizeExpression(input) {
  let out = input.trim();
  while (out && /[+\-*/(]$/.test(out[out.length - 1])) out = out.slice(0, -1);
  return out;
}

function getPreview(input) {
  const normalized = normalizeExpression(input);
  if (!normalized) return "0";

  const value = evaluateExpression(normalized);
  return value === null ? "Error" : formatNumber(value);
}

function evaluateExpression(input) {
  // Interview-friendly approach:
  // 1) sanitize (only allow calculator characters)
  // 2) evaluate the math using Function()
  const safe = toSafeJsExpression(input);
  if (safe === null) return null;

  try {
    const result = Function(`"use strict"; return (${safe});`)();
    return Number.isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

function toSafeJsExpression(input) {
  const cleaned = input.replace(/\s+/g, "");

  // Whitelist allowed characters only.
  if (!/^[0-9+\-*/().]+$/.test(cleaned)) return null;

  // Block obvious invalid sequences like "**" or "+++" (keeps behavior predictable).
  if (/[*+/]{2,}/.test(cleaned)) return null;

  return cleaned;
}

// ----------------------
// Formatting helpers
// ----------------------
function formatNumber(n) {
  const v = Object.is(n, -0) ? 0 : n;
  const abs = Math.abs(v);

  const str =
    abs !== 0 && (abs >= 1e12 || abs < 1e-9) ? v.toPrecision(12) : String(roundTo(v, 12));

  return trimTrailingZeros(str);
}

function roundTo(n, decimals) {
  const p = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * p) / p;
}

function trimTrailingZeros(s) {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

function getLastNumberRange(s) {
  // Finds the last numeric token at the end of the expression
  // e.g. "12+(-3.5)" (when cursor is at end) -> selects "3.5"
  let i = s.length - 1;
  if (i < 0) return { start: -1, end: -1 };

  while (i >= 0 && /[0-9.]/.test(s[i])) i--;
  const end = i + 1;
  if (end <= 0) return { start: -1, end: -1 };

  // allow unary minus: "...*(-3)" or "(-3)" or "-3"
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

// ----------------------
// History (saved)
// ----------------------
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
  } catch {
    // ignore
  }
}

function addHistoryItem(expr, result) {
  history.unshift({ expr, result, ts: Date.now() });
  history = history.slice(0, HISTORY_LIMIT);
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

    const reuse = () => {
      expression = item.expr;
      isResultOnScreen = false;
      updateUI();
    };

    el.addEventListener("click", reuse);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        reuse();
      }
    });

    historyListEl.appendChild(el);
  }
}

// ----------------------
// Theme (saved)
// ----------------------
function loadTheme() {
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore
  }
}

// ----------------------
// Events
// ----------------------
keysEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;

  if (btn.dataset.digit) return appendDigit(btn.dataset.digit);
  if (btn.dataset.op) return appendOperator(btn.dataset.op);

  switch (btn.dataset.action) {
    case "clear":
      return clearAll();
    case "backspace":
      return backspace();
    case "dot":
      return appendDecimal();
    case "equals":
      return onEquals();
    case "percent":
      return applyPercentToLastNumber();
    case "sign":
      return toggleSignOfLastNumber();
    case "lparen":
      return insertLeftParen();
    case "rparen":
      return insertRightParen();

    // Memory buttons (simple and explainable)
    case "mc":
      memory = 0;
      return updateUI();
    case "mr":
      return appendText(formatNumber(memory));
    case "mplus": {
      const v = evaluateExpression(normalizeExpression(expression));
      if (v !== null) memory += v;
      return updateUI();
    }
    case "mminus": {
      const v = evaluateExpression(normalizeExpression(expression));
      if (v !== null) memory -= v;
      return updateUI();
    }
    default:
      return;
  }
});

clearHistoryBtn.addEventListener("click", () => {
  history = [];
  saveHistory();
  updateUI();
});

themeToggleBtn.addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "light" ? "dark" : "light";
  setTheme(next);
  updateUI();
});

copyBtn.addEventListener("click", async () => {
  const text = displayEl.textContent || "";
  try {
    await navigator.clipboard.writeText(text);
    copyBtn.textContent = "Copied";
    setTimeout(() => updateUI(), 700);
  } catch {
    // ignore
  }
});

window.addEventListener("keydown", (e) => {
  const k = e.key;

  if (/^[0-9]$/.test(k)) return appendDigit(k);
  if (k === ".") return appendDecimal();
  if (k === "(") return insertLeftParen();
  if (k === ")") return insertRightParen();
  if (k === "+" || k === "-" || k === "*" || k === "/") return appendOperator(k);

  if (k === "Enter" || k === "=") {
    e.preventDefault();
    return onEquals();
  }

  if (k === "Backspace") return backspace();
  if (k === "Escape") return clearAll();
  if (k === "%") return applyPercentToLastNumber();
});

// init
setTheme(loadTheme());
updateUI();
