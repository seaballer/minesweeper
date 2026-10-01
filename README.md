# Minesweeper

A browser Minesweeper. React 19 and Material UI 9 on Vite 8; the rules live in a
plain ES-module JavaScript model with no React or MUI imports.

## Running it

Needs Node 20.19+ or 22.12+ (Vite 8's floor) and npm.

```bash
npm install     # first time only
npm run dev     # http://localhost:5173
```

| Command                  | Does                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `npm run dev`          | Dev server with hot reload                                    |
| `npm run build`        | Production bundle into`dist/`                               |
| `npm run preview`      | Serve the built bundle                                        |
| `npm test`             | Both suites: the UI in jsdom (310 assertions), then the model |
| `npm run test:model`   | Just the model unit tests (33) — no browser, no jsdom        |
| `npm run lint`         | ESLint,`react-hooks` rules included                         |
| `npm run format`       | Prettier, writes in place                                     |
| `npm run format:check` | Prettier, reports only                                        |

`node_modules/`, `dist/`, and `.opencode/` are gitignored. Never commit them.

To exercise the model without a browser, run it directly in Node:

```bash
node --input-type=module -e "import('./src/game/Grid.js').then(m => { const g = new m.Grid(9,9,10,1); g.revealCell(4,4); console.log(g.status); })"
```

The fourth `Grid` argument is a seed, so that board is reproducible.

## Layout

```
index.html
vite.config.js
eslint.config.js
.prettierrc.json
ui-check.mjs               The UI harness: jsdom + Vite SSR, drives real components
test/
  model.test.js            node:test unit tests for the model; no browser, no jsdom
src/
  main.jsx                 React entry; mounts App in ThemeProvider + CssBaseline
  App.jsx                  Layout only, no game logic
  theme.js                 The single source of design tokens
  index.css                Page shell only: font import, background, reduced motion
  game/                    Plain JS, no React or MUI imports
    Grid.js                Board state, mine placement, flood fill, win detection
    Cell.js                A single cell
    difficulties.js        Board size presets and resolveCustom()
    bestTimes.js           Three best times per difficulty, and their storage
  hooks/
    useMinesweeper.js      Owns the Grid; the only place game state is mutated
    useTimer.js            The game clock, and formatTime
    useResetShortcut.js    Document-level R to reset
    useBestTimes.js        Loads stored best times, and records a finished run
  components/              Presentational; no game state
    Board.jsx              Grid layout; exports CELL, GAP, BOARD_CHROME, PAD, BORDER
    CellButton.jsx         One cell
    ControlBar.jsx         Mine counter, reset, timer
    DifficultySelect.jsx   Preset switcher
    ControlsInfo.jsx       Info button and its controls popover
    BestTimes.jsx          Trophy button and the best-times popover
    CustomSettings.jsx     Rows / cols / mines / seed inputs
    StatusBanner.jsx       Win / loss message
    Timer.jsx              Elapsed time
    MineIcon.jsx           Inline SVG mine glyph
```

Three layers, and the boundary between them is the point:

- `game/` is the model. No DOM, no React, no MUI, so the rules run in plain Node.
- `hooks/useMinesweeper.js` is the controller. It owns the `Grid` instance and
  is the only thing that mutates it.
- `components/` are presentational. Props in, callbacks out, no state of their
  own. `Board` is the one place that holds a little of its own state — the
  keyboard cursor — which is view state, not game state.

Two test suites, split by what each can observe:

- `test/model.test.js` imports `src/game/` straight into Node and asserts the
  rules: `placeMines` determinism and exact mine count, `countNeighborMines`,
  flood-fill boundaries, win detection, the flag tally, chording, and the
  coordinate contracts. No mounting, so a failure points at a rule.
- `ui-check.mjs` stands up jsdom, loads `App` through Vite SSR so JSX compiles,
  and drives it the way a player would — 310 assertions, no browser. It imports
  `GAP`, `BOARD_CHROME`, and `CELL` from `Board.jsx` so it asserts the same
  sizing arithmetic the CSS encodes rather than a hand-copied version.

`npm test` runs both, UI first.

## The model

### `new Grid(rows, cols, mineCount, seed?)`

The seed decides what reset does:

```js
new Grid(9, 9, 10, 1234); // pinned: this exact board, every time
new Grid(9, 9, 10, 'hello world'); // pinned: hashed to a number first
new Grid(9, 9, 10); // unpinned: a new board on every reset
```

`mineCount` is clamped to `rows * cols`.

The constructor allocates cells and `initialize()` resets them, but **neither
places mines**. Placement is deferred to the first `revealCell`, which is what
makes the opening click safe:

```js
const grid = new Grid(9, 9, 10);
grid.initialize();
grid.revealCell(4, 4); // mines are placed here, and (4, 4) is never one
```

Until that happens no cell is a mine and every `neighborMines` is `0`. To
inspect a board without playing it, trigger placement yourself with
`grid.ensureMinesPlaced(row, col)`.

**First-click safety applies only to an unpinned board.** A board with no seed
leaves the opening cell out of the shuffle, so the first click is always safe.
A **pinned** board places from the seed alone and does not: its layout is
knowable in advance, and letting the first click be a mine is what makes that
worth anything. It also means a seeded board is genuinely reproducible — the
same seed gives the same layout whoever plays it and wherever they start, rather
than depending on the opening move.

`grid.status` is `"ready" | "playing" | "win" | "gameover"`. Once it is `win` or
`gameover` the game is terminal: further calls return that status and leave the
board alone, so a won game can't be flipped to a loss.

### `grid.revealCell(row, col)`

Reveals a cell and floods outward through any zero-count cells. **Always returns
a status string**, never `undefined`:

| Return value   | Meaning                                                          |
| -------------- | ---------------------------------------------------------------- |
| `"ready"`    | A no-op before the first reveal, while the board is unplaced     |
| `"playing"`  | The reveal succeeded, or the cell was already visible or flagged |
| `"win"`      | The last safe cell was revealed                                  |
| `"gameover"` | A mine was revealed                                              |

A no-op returns the current status rather than nothing, so a caller never has to
special-case `undefined`. `grid.chord` follows the same rule.

Both `revealCell` and `chord` validate coordinates before anything else, and
throw a `RangeError` naming the board and the valid range:

```
RangeError: Cell (9, 0) is outside a 9x9 board; expected integer row 0..8 and col 0..8.
```

`isInBounds` rejects non-integers and `NaN`, not just out-of-range values. The
check runs before the terminal-state check, so a bad coordinate throws even on a
decided board: out of range is a bug in the caller, not a game state.

`floodFill` skips visible, mined, and flagged cells, and doesn't expand through
them. `remainingSafeCells` only decrements when `Cell.reveal()` returns `true`,
and win is an exact `=== 0` check.

### `grid.chord(row, col)`

Reveals a revealed number's hidden neighbors once its flagged-neighbor count
matches `neighborMines`. It no-ops on a zero cell, a hidden cell, a mine, before
mines are placed, and on a mismatched flag count. Every reveal is delegated to
`revealCell`, so flood fill and `remainingSafeCells` stay owned by one code path.

It's still a guess: flag a safe cell, leave the real mine unflagged, and the
counts still match.

### `grid.revealAllMines(explodedRow, explodedCol)`

Uncovers every mine, on a loss and on a win, so the final board is legible. On a
loss it also marks the whole **connected** mine cluster around the detonation as
`isExploded`, mine to adjacent mine. Chording can uncover a mine sitting against
other mines, and one red cell among identical grey ones reads as though the
neighbours were safe. On a win nothing is marked.

A flag on a safe cell is uncovered too, and marked `isWrongFlag`, so the final
board shows which guesses were wrong instead of leaving a flag on empty space.

### `grid.cells[row][col]`

A 2D array of `Cell`. Each cell exposes `isMine`, `isExploded`, `isFlagged`,
`isVisible`, `isWrongFlag`, and `neighborMines`, plus three methods:

- `reveal()` — sets `isVisible`; returns `true` only on the first call
- `toggleFlag()` — no-op once visible; also clears `isWrongFlag`
- `placeMine()` — sets `isMine`

`isWrongFlag` is set by `revealAllMines` when a flag was sitting on a safe cell,
so the marker can never outlive the flag that caused it. It is purely
presentational and does not affect play.

## Playing it

Presets, as rows × cols and mines:

| Preset       | Size           | Mines                  |
| ------------ | -------------- | ---------------------- |
| Beginner     | 9 × 9         | 10                     |
| Intermediate | 16 × 16       | 40                     |
| Expert       | 16 × 30       | 99                     |
| Custom       | 2–30 × 2–30 | 1 to rows × cols − 1 |

| Gesture                                        | Does                                               |
| ---------------------------------------------- | -------------------------------------------------- |
| Left click                                     | Reveal a cell                                      |
| Right click                                    | Flag a cell, or remove a flag                      |
| Click / middle click / right click on a number | Chord — reveal its neighbors once the flags match |
| `F`                                          | Flag the focused cell                              |
| `C`                                          | Chord the focused cell                             |
| `R`                                          | Reset                                              |
| `Tab`                                        | Enter the board once, then leave it                |
| Arrow keys                                     | Move the cursor around the board                   |
| `Home` / `End`                             | Jump to the ends of the current row                |
| `Ctrl` + `Home` / `End`                  | Jump to the first / last cell of the board         |
| `PageUp` / `PageDown`                      | Move four rows                                     |
| `Enter` / `Space`                          | Reveal or chord the focused cell                   |

**Keyboard.** The board is a real ARIA grid and it is **one tab stop**, not one
per cell — otherwise Tab would walk 81 buttons on Beginner and 480 on Expert.
Tab moves into the grid, the arrow keys move around inside it, and the next Tab
leaves. Whichever cell you last had focus in is the one Tab returns to, whether
you got there by clicking or by arrowing. The cursor stops at the edges rather
than wrapping, and the navigation keys are consumed so the page never scrolls
out from under you.

`R` stands down while either popover is open, and while focus is in a
board-size field, so it can't wipe a game you're in the middle of typing into or
reading the results of.

**Best times.** The trophy on the left keeps the three fastest completed runs for
the current difficulty, and the list follows whichever preset is selected. Only
the three presets are ranked — a custom board is whatever size and mine count you
typed, so its best time wouldn't mean anything, and the trophy isn't offered
there at all. Times are whole seconds, exactly as the clock read them at the win.

They live in `localStorage` under `minesweeper.best-times.v1`. There's no server
here, so there's no database to adjust: that key is the whole of it, and
`localStorage` is preferred over a cookie because a cookie exists to talk to a
server that doesn't exist. Blocked or unreadable storage is ignored rather than
thrown, so the board still plays with a leaderboard that can't remember.

Custom takes rows, columns, mines, and an optional seed, defaulting to
12 × 14 / 25 with no seed. Input is clamped to 2–30 in each dimension and to at
most `rows × cols - 1` mines, so an unseeded board always has a safe first
click. Enter or Apply commits it.

**Seed.** The field sits behind a **Seed?** checkbox, because pinning a board is
something you opt into rather than something you fill in. Tick it and type any
text to pin the layout: reset then replays exactly the same board, and anyone
with the same seed, size, and mine count gets the identical board — from wherever
they make their first move, and a seeded board gives you no free opening click,
so if you know where the mines are you can open one on purpose. Unticking it
and applying unpins the board again. The seed is part of the custom config, so
switching to a preset and back restores it, checkbox and all.

Text is reduced to the number the PRNG actually uses by summing each character's
position times its character code, counting positions from 1 so the leading
character still counts. It is deliberately plain, which has one consequence
worth knowing: it is order-sensitive but not collision-resistant, so anagrams can
land on the same board (`aab` and `bba` both sum to 585). Fine for
remembering "the board called hello world", not fine for distinguishing
near-identical phrases.

## Engineering notes

The things that are easy to break and hard to notice.

**`Grid` mutates `Cell` objects in place.** A cell reference never changes
between renders, so passing one into a `memo`ized component defeats the shallow
compare and the component silently stops repainting. This isn't hypothetical: it
shipped a bug where clicking a cell revealed nothing. `CellButton` takes flat
primitives — `isMine`, `isVisible`, `isFlagged`, `isExploded`, `isWrongFlag`,
`neighborMines` — for exactly that reason. Keep it that way when adding props,
and when adding one, forward it in `Board.jsx` too: a primitive the parent
forgets to pass down is indistinguishable from `false`.

**A gradient passed to `backgroundColor` is silently dropped.** The property
only accepts a `<color>`, so the declaration is invalid, the cell renders fully
transparent, the "raised key" look disappears, and nothing logs an error. This
also shipped. Use `backgroundImage` for gradients and `backgroundColor` for flat
colors, and check against the CSS engine rather than by eye:

```bash
node -e "const {JSDOM}=require('jsdom');const d=new JSDOM('<div/>');const e=d.window.document.querySelector('div');e.style.backgroundColor='linear-gradient(#fff,#000)';console.log(JSON.stringify(e.style.backgroundColor))"
```

An empty string means the value was rejected. `npm test` asserts this too.

**Cell gestures are three predicates, not one.** `CellButton` keeps them
separate:

- `canReveal` — hidden and unflagged: left click reveals
- `canFlag` — hidden, flagged or not: right click or `F` toggles the flag, so a
  misplaced flag comes off without reaching for Reset
- `canChord` — revealed, safe, and numbered: click, middle click, right click,
  or `C` chords

Conflating them broke flag removal once already.

**`resolveCustom` clamps its fallback too, not just the parsed input.** A cleared
Mines field falls back to the previous board's count, which on a smaller board
could allow more mines than there are safe cells. The fallback goes through the
same clamp.

**`CustomSettings` holds raw strings while editing**, so a half-typed value
isn't clamped out from under the cursor. Typing past a limit does snap
immediately instead, so a field can never hold a value the board can't use. The
wheel over a focused field steps it by one: the number spinners are hidden, so
the wheel is the only nudge affordance, and without `preventDefault` a focused
input swallows the scroll and the page jumps. It also uses plain `<input>` plus
one inline `<style>` rather than MUI's `TextField`, which pulls in the
FormControl / InputLabel / OutlinedInput family — about 80kB for three numeric
fields.

**`useTimer` derives time from a start timestamp** rather than counting ticks,
so a throttled or backgrounded tab can't make the clock drift. The interval
exists only to force a repaint.

**Cell size is a constant 30px.** `Board.jsx` exports it as `CELL` and exposes it
as the `--cell` custom property, which both the grid tracks and the cells read,
so they can't disagree. Don't make it responsive: cells used to shrink to fit
the container, which made an Expert cell visibly smaller than a Beginner one. The
board grows instead, `App.jsx` uses `maxWidth="xl"` so the widest preset still
fits, and only oversized custom boards and phones scroll.

**The ARIA roles are load-bearing.** The board is `role="group"`, not
`role="grid"` — a real ARIA grid needs owned `row`/`gridcell` elements and 2-D
arrow-key navigation, which this doesn't implement. The result banner and the
mine counter are persistent `role="status"` live regions and must stay mounted;
a live region that appears with its own content is usually silent. The timer is
`role="timer"` with `aria-live="off"`, so a clock ticking every second doesn't
interrupt a screen reader mid-sentence.

**Conventions.** `.jsx` for components, `.js` for plain modules; named exports,
function components, 4-space indent. Styling is MUI `sx` against tokens from
`theme.js` — a hardcoded hex in a component drifts the moment a token changes.
`src/index.css` is the only stylesheet and is limited to the page shell.

## Known limitations

- **The wordmark is a flat colour.** `background-clip: text` rendered
  incorrectly at some browser zoom levels, so the gradient is commented out in
  `src/App.jsx` until there's a better treatment.
- **The page background is a flat colour.** The layered radial glows and grain
  texture it used to carry are gone, along with the `background-blend-mode` that
  composited them. Any replacement should be a single layer.
- **Long-press cancels on scroll.** The press that flags a cell is aborted as
  soon as a finger moves, so scrolling a wide board never places a stray flag
  by accident.
