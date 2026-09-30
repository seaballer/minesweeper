# AGENTS.md

React + Vite + Material UI. The game model in `src/game/` is plain ES-module
JavaScript with no React or MUI imports — keep it that way so the rules stay
testable outside a browser.

## Commands

- `npm run dev` — Vite dev server on <http://localhost:5173>
- `npm run build` — production bundle into `dist/`
- `npm run preview` — serve the built bundle
- `npm test` — mounts the components in jsdom and drives them (198 assertions)
- `npm run lint` — ESLint (`react-hooks` rules included). Must be clean before committing.
- `npm run format` / `npm run format:check` — Prettier. The config matches the
  existing style: 4-space indent, single quotes, 100 columns.
- `.opencode/` is gitignored third-party tooling and is excluded from both.
- To check the model alone, run it directly in Node:
  `node --input-type=module -e "import('./src/game/Grid.js').then(m => { const g = new m.Grid(9,9,10,1); g.revealCell(4,4); console.log(g.status); })"`
  The 4th `Grid` arg is a seed, so results are reproducible.
- `node_modules/`, `dist/`, and `.opencode/` are gitignored. Never commit them.

## Architecture

- `src/main.jsx` — React entry. Mounts `App` inside `ThemeProvider` + `CssBaseline`.
- `src/App.jsx` — layout only. Holds no game logic; it calls `useMinesweeper()` and passes results down.
- `src/theme.js` — the single source of design tokens. Palette, typography, the `board.*` surface tokens, and the `mono` font stack live here; components reference tokens instead of hex values.
- `src/index.css` — global shell only: font import, page background, reduced-motion. Everything else is themed or `sx`.
- `ui-check.mjs` — the `npm test` harness. jsdom + Vite SSR; no browser needed.
- `src/hooks/useMinesweeper.js` — **the only place game state is mutated.** Owns the `Grid` instance and exposes `reveal`, `toggleFlag`, `chord`, `reset`, `changeDifficulty`, `applyCustomSize`.
- `src/hooks/useTimer.js` — the game clock and `formatTime`. Time is derived from a start timestamp, not by counting ticks, so a throttled tab can't make it drift.
- `src/game/Grid.js` — model: mine placement, flood fill, win detection. No DOM, no React.
- `src/game/Cell.js` — single cell state. No DOM, no React.
- `src/game/difficulties.js` — board size presets plus `resolveCustom()`, which sanitizes player-entered sizes. The fallback path is clamped too, not returned verbatim: a cleared Mines field would otherwise fall back to the previous board's count and produce an unwinnable board.
- `src/components/` — presentational only. `Board`, `CellButton`, `ControlBar`, `DifficultySelect`, `ControlsInfo`, `StatusBanner`, `Timer`, `CustomSettings`, `MineIcon`. They receive data and callbacks as props and hold no game state.
- `src/hooks/useResetShortcut.js` — document-level `R` to reset. Takes a `suspended` flag: `App` passes the controls-dialog state, because the dialog is where `R` is documented and it must not wipe a live game while it is open.
- `CustomSettings.jsx` uses plain `<input>`s and one inline `<style>`, not MUI's `TextField`. `TextField` pulls in the FormControl/InputLabel/OutlinedInput family, which cost ~80kB for three numeric fields. Emotion can't express vendor pseudo-elements in a plain style object, hence the stylesheet tag.

## Custom board inputs

`CustomSettings` holds a raw string per field while editing so a half-typed
value isn't clamped out from under the cursor. Two behaviours are deliberate:

- **Typing past a limit snaps to it immediately**, rather than clamping on
  Apply, so a field can never hold a value the board can't use. Empty and
  partial input is left alone; `resolveCustom` covers the rest.
- **Wheel over a focused field steps it by one.** The number spinners are
  hidden, so the wheel is the only nudge affordance; without `preventDefault`
  a focused input swallows the scroll and the page jumps instead.

`maxMines` is computed from the current rows/cols rather than read from
`CUSTOM_LIMITS`, because a board always needs one safe cell.

## Board sizing

Cell size is a **constant 30px**, exposed as the `--cell` custom property on
`Board` and read by both the grid tracks and the cells so they cannot disagree.

Do not make it responsive. It used to shrink to fit the container, which meant
an Expert cell was visibly smaller than a Beginner one — inconsistent cells
between difficulties, and the whole reason the board looked like it "freaked
out" when switching modes. The board grows instead, and `App.jsx` uses
`maxWidth="xl"` so the widest preset still fits without scrolling. Only
oversized custom boards (and phones) scroll, which is the right trade.

`GAP`, `BOARD_CHROME`, and `CELL` are exported from `Board.jsx` and imported by
`ui-check.mjs`, so the test asserts the same arithmetic the CSS encodes rather
than a hand-copied version. The test also fails if any viewport- or
container-relative unit (`vw`, `cqi`, `clamp`) reappears in `--cell`.

## The one non-obvious React gotcha

**`Grid` mutates `Cell` objects in place, so never pass a `Cell` instance into
a `memo`ized component.** The object reference never changes, `memo`'s shallow
compare sees identical props, and the component silently stops repainting. This
is not hypothetical — it shipped a bug where clicking a cell revealed nothing.

`CellButton` therefore takes flat primitives (`isMine`, `isVisible`, `isFlagged`,
`isExploded`, `neighborMines`) rather than the cell object. Keep it that way when
adding props. See the "Model mutates in place" note in the hook for the other
half of this problem.

The same trap has a second form, on `Board` itself. `Board` **is** `memo`ized, and
on a click none of its real props change — `grid` is the same object, and the cells
inside it are mutated in place. It survives only because `version` (the hook's
invalidation token) is passed to it as a prop, and that prop is the one thing that
moves. `npm test` asserts a click repaints the board for exactly this reason. If
you ever drop `version` from `Board`'s props, or stop passing it in `App.jsx`,
the board goes dead: clicks still register in the model and nothing appears to
happen. `_version` is bound but unread on purpose — it is there to be compared.

The win is that `useTimer` re-renders `App` four times a second, and without
`memo` on `Board` each of those rebuilt all 480 cells to redraw one clock.
Measured: a 1200ms stretch of timer ticks now produces **zero** `Board` renders,
while every live click still produces one.

## Where the per-click work goes

The flag tally is an O(1) field read, not a rescan. It used to be a `useMemo` doing
`grid.cells.flat().filter(...)` keyed on `version` — an O(n) pass allocating two
throwaway arrays on **every click and every render for any reason**. `Grid` now owns
`flagCount` and `Grid.toggleFlag(row, col)` is the only way to place or lift a
flag, so the UI no longer reaches into `cells[row][col]` to do it itself. That
also means the bounds check happens on that path; when the hook indexed the array
directly it had to call `assertInBounds` by hand.

If you add a way to change a flag, route it through `Grid.toggleFlag`. The tally is
derived from before/after cell state, not from what `Cell.toggleFlag` reports, so
a refused toggle (a visible cell) cannot skew it — but only if the mutation still
goes through `Grid`. `npm test` cross-checks `flagCount` against a scan of the
cells and covers the no-op, reset, and out-of-range cases.

## A note on measuring input

A "clicks aren't registering" report here was chased down to nothing: rapid clicks
all applied. Two things made it look like loss, and both are traps to avoid
re-introducing into a probe:

- Once the game is decided the board correctly ignores clicks, and unvisited safe
  cells keep their `hidden` label at game over. Counting those as dropped input
  invents a bug. Filter on `!cell.disabled` and on the banner being empty.
- The first click after switching difficulty also renders every cell for the first
  time (emotion styles, `cell.reveal` state). Timing that one and calling it
  per-click cost measures JIT warmup, not steady state. Benchmark the median of a
  run, not a single click.

A single large flood fill legitimately costs a whole board re-render. That is one
render, not a dropped click.

## The other silent-failure trap: gradients

**A gradient passed to `backgroundColor` is silently dropped.** It accepts only
a `<color>`; the declaration is invalid, so the cell renders fully transparent
and the "raised key" look disappears — with no error anywhere. This shipped once.

Use `backgroundImage` for gradients, `backgroundColor` for flat colors. Verify
with the CSS engine directly rather than by eye:

```bash
node -e "const {JSDOM}=require('jsdom');const d=new JSDOM('<div/>');const e=d.window.document.querySelector('div');e.style.backgroundColor='linear-gradient(#fff,#000)';console.log(JSON.stringify(e.style.backgroundColor))"
```

An empty string means the value was rejected. `npm test` asserts this too.

## `Grid` contracts worth knowing before you call it

- The constructor allocates cells and `initialize()` resets them, but **neither places mines**. Placement is deferred to the first `revealCell` via `ensureMinesPlaced`, so the opening click is always safe. Until then the board has no mines and all `neighborMines` are 0.
- `revealCell(row, col)` **always returns a status string** (`ready` / `playing` / `win` / `gameover`) and never `undefined`. A no-op — already-visible or flagged cell — returns the current status, because the board is unchanged. `chord` follows the same rule.
- Seeds: a seed passed to the constructor is **pinned**, so `initialize()` replays that exact board. No seed means unpinned, and `initialize()` advances it, so reset yields a new board. Don't "simplify" this into one seed field — resetting a pinned grid is what makes a board shareable.
- `grid.status` is `"ready" | "playing" | "win" | "gameover"`. Once `win` or `gameover`, the game is terminal: further `revealCell` calls return that status and don't change the board.
- Flood fill skips flagged and mined cells, and doesn't expand through them.
- The constructor clamps `mineCount` to `rows * cols - 1`, always leaving one safe cell. Mines are placed on the first click with that cell excluded, so a board needing every cell to be a mine has nowhere safe to open and is unwinnable before it starts. A 1×1 board asking for 1 mine becomes 1×1 with none, and wins immediately.
- Coordinate entry points (`revealCell`, `chord`, `toggleFlag`) call `assertInBounds` and throw a `RangeError` naming the board size and valid range. Out of range is a caller bug, not a game state, so it throws rather than being silently ignored — an ignored bad coordinate would make a cell quietly unclickable with no signal.
- `toggleFlag(row, col)` places or lifts a flag and keeps `flagCount` in step. Like `revealCell` and `chord` it **always returns a status string**, and it is a no-op on a visible cell (a flag there would be nonsense, and `Cell` refuses). It is the only supported way to change a flag — see "Where the per-click work goes" for why the UI stopped reaching into `cells` directly.
- `remainingSafeCells` only decrements when `Cell.reveal()` returns `true`. Win is an exact `=== 0` check.
- `revealAllMines(explodedRow, explodedCol)` uncovers every mine. On a loss it marks the whole **connected** mine cluster around the detonation (mine → adjacent mine → …) as `isExploded`, not just the clicked cell — after a chording detonation, one red cell among grey ones reads as if the neighbours were safe. On a win nothing is marked.
- `revealAllMines` also marks **wrong flags**: a flagged cell that was not a mine is uncovered and flagged `isWrongFlag`, rendered as a cross over the flag. Correctly-placed flags are untouched. A win can never contain one, since a flagged cell is never revealed.
- `chord(row, col)` reveals the hidden neighbors of a revealed number once its flagged-neighbor count matches. It no-ops on zero cells, hidden cells, mines, and mismatched flag counts, and delegates each reveal to `revealCell` so `remainingSafeCells` and flood fill stay owned by one code path. Chording is still a guess: flagging a safe cell and leaving the real mine unflagged will detonate it.
- `placeMines` is a seeded Fisher-Yates shuffle (`mulberry32`). `mineCount` is clamped to `rows * cols`.

## Cell gestures

`CellButton` has three separate predicates. Conflating them broke flag removal
once already — don't:

- `canReveal` — hidden and unflagged: left click reveals
- `canFlag` — hidden, flagged or not: right click or `f` toggles the flag, so a
  misplaced flag is removable without a reset
- `canChord` — revealed, safe, and numbered: click, middle click, right click,
  or `c` chords

On touch, a press held past `LONG_PRESS_MS` flags instead of revealing. The
press sets a ref that `act` and `onContextMenu` consume, because mobile browsers
fire a `contextmenu` and a `click` after a long press — without that, one long
press toggles the flag straight back off. `touchmove` cancels, so scrolling never
strays a flag.

## Conventions

- `.jsx` for components, `.js` for plain modules. Named exports, function components, 4-space indent.
- Styling is MUI `sx` props against theme tokens. `src/index.css` is the only stylesheet and is limited to the page shell. Don't add component CSS.
- Colors come from `theme.js` — `board.*`, the palette, and `theme.mono`. A hardcoded hex in a component is a regression; it drifts the moment a token changes.
- The board uses `role="group"`, not `role="grid"`. A real ARIA grid needs owned `row`/`gridcell` elements and 2-D arrow-key navigation, which this doesn't implement. Don't upgrade the role without also building the pattern.
- The result banner and the mine counter are persistent live regions (`role="status"`). Keep them mounted: a live region that appears with its own content is usually silent.
- Grid uses 4-space indent and no trailing newline on its final brace. Match surrounding style rather than reformatting files you touch.

## Design direction

Industrial instrument panel: dark field, cool blue as the only structural
accent, amber/red reserved for mines and loss. Hidden cells are raised keys
(gradient face, top highlight, bottom shadow); revealed cells are flat. Motion is
limited to one short pop on reveal so a cascade reads as a sequence. No
`background-attachment: fixed` or fixed overlays — they repaint on every scroll
frame on mobile.
