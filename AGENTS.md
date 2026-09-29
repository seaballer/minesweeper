# AGENTS.md

Vanilla JS Minesweeper. No `package.json`, no build, no test runner, no linter, no CI. There is nothing to `npm install` and no command to run tests — don't invent tooling or add one unless asked.

## Running it

- `index.html` loads `./js/main.js` via `<script type="module">`. ES modules are blocked over `file://`, so opening the HTML directly will fail with a CORS error. Serve it:
  - `python3 -m http.server 8000` then open `http://localhost:8000`
- To exercise game logic without a browser, Node works directly: `node js/main.js`. (Node ≥20.19 auto-detects ESM syntax; the repo has no `type: module` marker.)
- `js/main.js` currently only `console.log`s the grid. **Nothing renders to the DOM yet** — the model is built, the UI is not. `index.html` has an empty `<body>`.

## Architecture

- `js/Grid.js` — the real model. Owns a 2D array of `Cell` at `grid.cells[row][col]`, mine placement, neighbor counting, reveal/flood-fill, and win detection.
- `js/Cell.js` — plain state holder (`isMine`, `isExploded`, `isFlagged`, `isVisible`, `neighborMines`).
- `js/Game.js` — **empty stub class, imported by nothing.** It imports `Grid` but has no body and no wiring. `main.js` uses `Grid` directly. Don't treat `Game` as the entrypoint.
- `js/main.js` — the only real entrypoint. Hardcodes `new Grid(9, 9, 10)`.

## `Grid` contracts worth knowing before you call it

- The constructor **only builds cells**; mines and neighbor counts are set by a separate `initialize()`. Forget it and you get a silent, empty, all-zero grid — no error.
- `revealCell(row, col)` returns `"playing" | "win" | "gameover"`, but returns **`undefined`** when the cell is already visible or is flagged. Don't assume a string back.
- `floodFill` does not skip flagged cells: a flagged neighbor is revealed while keeping its flag. Pre-existing behavior, not a contract.
- No first-click safety — mines are placed in `initialize()` before any click, so the first click can hit one (measured: ~29/200 center clicks on 9×9/10).
- `remainingSafeCells` only decrements when `Cell.reveal()` returns `true` (i.e. the cell wasn't already visible). Win is an exact `=== 0` check.
- `placeMines` is a seeded Fisher-Yates shuffle (`mulberry32`) over flat cell indices, not rejection sampling. Pass a 4th constructor arg to make a board reproducible: `new Grid(9, 9, 10, 1234)`. Omit it and the seed auto-increments from a clock base, so successive grids differ.

## Conventions

- Named ES module exports, classes, no default exports. 4-space indent, no semicolon style churn.
- Several files (`index.html`, `js/Grid.js`, `js/Cell.js`, `js/Game.js`) have **no trailing newline**. Match it.
- `readme.md` and `style.css` are both 0 bytes. `style.css` is **not referenced from `index.html`** — wire it up in when styling, don't assume it loads.
