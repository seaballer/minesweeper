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

The constructor only allocates cells. `initialize()` resets the board but deliberately does **not** place mines — placement is deferred to the first `revealCell`, which is what makes the opening click safe. Calling `initialize()` on a fresh grid is enough to start:

```js
const grid = new Grid(9, 9, 10);
grid.initialize();
grid.revealCell(4, 4); // mines are placed here, and (4, 4) is never a mine
```

To inspect a board without playing it, trigger placement directly with `grid.ensureMinesPlaced(row, col)`. Note that until mines are placed, every `neighborMines` is `0` and no cell is a mine.

### `grid.revealCell(row, col)`

Reveals a cell and floods outward through any zero-count cells. Returns the game state, which is also readable at `grid.status`:

| Return value | Meaning |
| --- | --- |
| `"playing"` | Reveal succeeded, game continues |
| `"win"` | Last safe cell revealed |
| `"gameover"` | A mine was revealed |
| `undefined` | No-op: the cell was already visible or is flagged |

Two rules to be aware of:

- A no-op returns **`undefined`**, not `"playing"`. Check for it explicitly rather than assuming a string.
- Once `grid.status` is `"win"` or `"gameover"`, further calls return that status without changing the board, so a won game can't be flipped to a loss by clicking a revealed mine.

### `grid.cells[row][col]`

A 2D array of `Cell`. Each cell exposes `isMine`, `isExploded`, `isFlagged`, `isVisible`, and `neighborMines`, plus `reveal()`, `toggleFlag()`, and `placeMine()`.

## Known behavior

These are current characteristics of the code. Most of the rough edges from the
first version have been smoothed out; what remains is noted here.

- **Mines are placed on the first click**, and that cell is excluded from the
  candidate list, so an opening move can never hit a mine. On a 1×1 board with
  1 mine there is no safe cell to give, so the first click loses — this is
  unavoidable, not a bug.
- **A game stops accepting input once decided.** After `win` or `gameover`,
  `revealCell` returns the same status and leaves the board alone.
- **A loss or a win reveals every mine.** The mine that was clicked is marked
  `isExploded`; the rest are simply uncovered.
- **Flags are respected by flood fill** — a flagged neighbor is not revealed
  and does not block the expansion.
- **Out-of-range coordinates throw a `TypeError`** rather than a friendly
  error. Validate at the UI layer.

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

- [x] Add first-click safety: `placeMines()` runs on the first `revealCell` and excludes that cell
- [x] Make `floodFill` skip flagged cells
- [x] Reveal all mines on game over (and on win, for a legible final board)
- [x] Guard `mineCount` against exceeding `rows * cols` (clamped in the constructor)
- [x] Make a decided game terminal so a win can't become a loss
- [ ] Decide what `revealCell` should return on a no-op — `undefined` is inconsistent with the documented states
- [ ] Validate out-of-range coordinates instead of throwing a raw `TypeError`
- [ ] Mark incorrect flags at game over (flagged cells that turned out to be safe)

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
