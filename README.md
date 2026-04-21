# Calculator App

This is a calculator app I built using **HTML, CSS and JavaScript**.

It supports normal calculations (like `12+3*4`), has a clean UI, and also works on mobile screens.

## What it does

- Basic operations: `+ - × ÷`
- Brackets: `(` and `)`
- Percent button (`%`) for the last number
- `+/−` to change sign of the last number
- Memory buttons: `MC`, `MR`, `M+`, `M−`
- History: saves recent calculations (you can click an item to reuse it)
- Light/Dark mode toggle
- Copy result button

## Tech stack

- HTML
- CSS
- JavaScript (Vanilla)

## How to run

### Option 1 (easy)

Open `index.html` in your browser.

### Option 2 (local server)

```bash
python -m http.server 5173
```

Then open `http://localhost:5173`.

## How I built it (short)

- The buttons and keyboard update an **expression string** (example: `(12+3)*4`)
- On every change, I update the UI and show a **preview** result
- When you press `=`, I evaluate the expression and store it in **history**
- Theme + history are saved using **localStorage**

## Improvements I want to add later

- Better validation messages (instead of only `Error`)
- Optional scientific mode (sin/cos/log etc.)
- Small animations and sound toggle

