# AGENTS.md

React + Vite + Material UI. The game model in `src/game/` is plain ES-module
JavaScript with no React or MUI imports — keep it that way so the rules stay
testable outside a browser.

## Commands

- `npm run dev` — Vite dev server on <http://localhost:5173>
- `npm run build` — production bundle into `dist/`
- `npm run preview` — serve the built bundle
- There is **no test runner**. To check the model, run it directly in Node:
  `node --input-type=module -e "import('./src/game/Grid.js').then(m => { const g = new m.Grid(9,9,10,1); g.revealCell(4,4); console.log(g.status); })"`
  The 4th `Grid` arg is a seed, so results are reproducible.
- `node_modules/` and `dist/` are gitignored. Never commit them.

## Architecture

- `src/main.jsx` — React entry. Mounts `App` inside `ThemeProvider` + `CssBaseline`.
- `src/App.jsx` — layout only. Holds no game logic; it calls `useMinesweeper()` and passes results down.
- `src/theme.js` — the single MUI theme. Change colors/typography here, not per component.
- `src/hooks/useMinesweeper.js` — **the only place game state is mutated.** Owns the `Grid` instance and exposes `reveal`, `toggleFlag`, `reset`, `changeDifficulty`.
- `src/game/Grid.js` — model: mine placement, flood fill, win detection. No DOM, no React.
- `src/game/Cell.js` — single cell state. No DOM, no React.
- `src/game/difficulties.js` — board size presets.
- `src/components/` — presentational only. `Board`, `CellButton`, `ControlBar`, `StatusBanner`. They receive data and callbacks as props and hold no game state.

## The one non-obvious React gotcha

**`Grid` mutates `Cell` objects in place, so never pass a `Cell` instance into
a `memo`ized component.** The object reference never changes, `memo`'s shallow
compare sees identical props, and the component silently stops repainting. This
is not hypothetical — it shipped a bug where clicking a cell revealed nothing.

`CellButton` therefore takes flat primitives (`isMine`, `isVisible`, `isFlagged`,
`isExploded`, `neighborMines`) rather than the cell object. Keep it that way when
adding props. See the "Model mutates in place" note in the hook for the other
half of this problem.

## `Grid` contracts worth knowing before you call it

- The constructor allocates cells and `initialize()` resets them, but **neither places mines**. Placement is deferred to the first `revealCell` via `ensureMinesPlaced`, so the opening click is always safe. Until then the board has no mines and all `neighborMines` are 0.
- `revealCell(row, col)` returns `"playing" | "win" | "gameover"`, but returns **`undefined`** when the cell is already visible or is flagged. Don't assume a string back.
- `grid.status` is `"ready" | "playing" | "win" | "gameover"`. Once `win` or `gameover`, the game is terminal: further `revealCell` calls return that status and don't change the board.
- Flood fill skips flagged and mined cells, and doesn't expand through them.
- On a 1×1 board with 1 mine there is no safe first cell, so the opening click loses. Unavoidable, not a bug.
- Out-of-range coordinates throw a raw `TypeError`; there is no bounds checking.
- `remainingSafeCells` only decrements when `Cell.reveal()` returns `true`. Win is an exact `=== 0` check.
- `placeMines` is a seeded Fisher-Yates shuffle (`mulberry32`). Pass a seed for a reproducible board. `mineCount` is clamped to `rows * cols`.

## Conventions

- `.jsx` for components, `.js` for plain modules. Named exports, function components, 4-space indent.
- Styling is MUI `sx` props only — no CSS files, no CSS-in-JS beyond `sx`. The empty `style.css` from the pre-React version is gone; don't reintroduce one.
- Grid uses 4-space indent and no trailing newline on its final brace. Match surrounding style rather than reformatting files you touch.
