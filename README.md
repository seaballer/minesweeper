# Minesweeper

A browser Minesweeper built with plain ES modules — no framework, no build step, no dependencies.

> **Status: work in progress.** The game logic is complete and tested by hand, but there is no user interface yet. The board renders to the browser console, not to the page. See [To-do](#to-do).

## Running it

The page loads JavaScript as an ES module, which browsers block over `file://`. You need a local server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

To poke at the game logic without a browser:

```bash
node js/main.js
```

This prints the grid and a `console.table` of the board. Node 20.19+ auto-detects ES module syntax, so no `package.json` or `--experimental` flag is needed.

## Layout

| File | Role |
| --- | --- |
| `index.html` | Page shell. Loads `js/main.js` as a module. `<body>` is currently empty. |
| `js/main.js` | Entrypoint. Builds a 9×9 board with 10 mines and logs it. |
| `js/Grid.js` | The model. Board state, mine placement, flood fill, win detection. |
| `js/Cell.js` | A single cell: mine, flag, visibility, adjacent mine count. |
| `js/Game.js` | **Stub.** Declared but empty and not imported anywhere. |
| `style.css` | Empty, and not referenced from `index.html` yet. |

## API

### `new Grid(rows, cols, mineCount, seed?)`

Builds the board. The seed is optional — pass one to make a board reproducible:

```js
new Grid(9, 9, 10, 1234)  // same seed always yields the same board
```

Omit it and seeds increment from a clock base, so successive boards differ.

The constructor only allocates cells. Mines and neighbor counts are set up by `initialize()`, which you must call yourself:

```js
const grid = new Grid(9, 9, 10);
grid.initialize();
```

Skip it and you get a valid-looking board with no mines and all-zero counts — silently, with no error.

### `grid.revealCell(row, col)`

Reveals a cell and floods outward through any zero-count cells. Returns the game state:

| Return value | Meaning |
| --- | --- |
| `"playing"` | Reveal succeeded, game continues |
| `"win"` | Last safe cell revealed |
| `"gameover"` | A mine was revealed |
| `undefined` | No-op: the cell was already visible or is flagged |

Note that last row — the return is `undefined`, not `"playing"`, on a skipped reveal. Check for it explicitly rather than assuming a string.

### `grid.cells[row][col]`

A 2D array of `Cell`. Each cell exposes `isMine`, `isExploded`, `isFlagged`, `isVisible`, and `neighborMines`, plus `reveal()`, `toggleFlag()`, and `placeMine()`.

## Known behavior

These are current characteristics of the code, not intended design:

- **No first-click safety.** Mines are placed during `initialize()`, before any click, so your opening move can hit one. On a 9×9/10 board the center cell was a mine in 12.4% of 2000 sampled games, which is just the base rate for 10 mines in 81 cells.
- **Flood fill ignores flags.** Revealing a zero cell uncovers its flagged neighbors while leaving the flag set.
- **A loss reveals one mine.** Hitting a mine marks that cell `isExploded`; the other mines stay hidden.
- **Mines are placed up front.** There is no way to place them lazily on first click without also adding first-click safety.

## To-do

Roughly in the order they'd unblock each other.

### Make it playable

- [ ] Render the board to the DOM — grid of buttons/divs reflecting `cell.isVisible`, `isFlagged`, `isMine`, `neighborMines`
- [ ] Wire up clicks: left click reveals, right click (or long press on touch) toggles a flag
- [ ] Re-render on state change, or render from `grid` after every `revealCell`
- [ ] Show the mine counter (from `grid.mineCount` minus flags) and a reset button
- [ ] Display win / game-over state and stop accepting input
- [ ] Link `style.css` from `index.html` and give the board a basic look

### Fix the issues listed above

- [ ] Add first-click safety: defer `placeMines()` until the first `revealCell`, re-rolling if it lands on a mine
- [ ] Make `floodFill` skip flagged cells
- [ ] Reveal all mines on game over
- [ ] Decide what `revealCell` should return on a no-op — `undefined` is inconsistent with the documented states
- [ ] Guard `mineCount` against exceeding `rows * cols`

### Structure and polish

- [ ] Fill in `Game.js` as the controller holding game state, or delete it if `Grid` is doing the job
- [ ] Move board size and mine count out of the hardcoded `new Grid(9, 9, 10)` into config; add difficulty presets
- [ ] Persist best times per difficulty
- [ ] Add a seed input for shareable/reproducible boards

### Testing

- [ ] Add a test runner (Node's built-in `node:test` needs no dependencies) and cover `placeMines` determinism and exact mine count, `countNeighborMines` correctness, flood fill boundaries, and win detection
- [ ] Add a `test` script once there's a `package.json`

## Contributing

Keep it dependency-free and buildless. Match the existing style: named ES module exports, classes, 4-space indent.
