# Minesweeper

A browser Minesweeper built with React and Material UI, on Vite.

> **Status: playable.** The game logic and UI are both working. See [To-do](#to-do) for what's next.

## Running it

```bash
npm install     # first time only
npm run dev     # http://localhost:5173
```

Other scripts:

| Command             | Does                                 |
| ------------------- | ------------------------------------ |
| `npm run dev`     | Dev server with hot reload           |
| `npm run build`   | Production bundle into `dist/`      |
| `npm run preview` | Serve the built bundle               |
| `npm test`        | Mounts the UI in jsdom and drives it |

To poke at the game logic without a browser, run the model directly in Node:

```bash
node --input-type=module -e "import('./src/game/Grid.js').then(m => { const g = new m.Grid(9,9,10,1); g.revealCell(4,4); console.log(g.status); })"
```

## Layout

```
src/
  main.jsx                  React entry; mounts App in the theme provider
  App.jsx                   Layout only, no game logic
  theme.js                  The single MUI theme
  hooks/
    useMinesweeper.js       Owns game state; the only place the model is mutated
  game/                     Plain JavaScript, no React or MUI imports
    Grid.js                 Board state, mine placement, flood fill, win detection
    Cell.js                 A single cell
    difficulties.js         Board size presets
  components/               Presentational; no game state
    Board.jsx               Grid layout
    CellButton.jsx          One cell
    ControlBar.jsx          Mine counter, difficulty, reset
    StatusBanner.jsx        Win / loss message
```

The model layer is deliberately framework-free, so the rules stay testable in Node without a DOM.

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

| Return value   | Meaning                                           |
| -------------- | ------------------------------------------------- |
| `"playing"`  | Reveal succeeded, game continues                  |
| `"win"`      | Last safe cell revealed                           |
| `"gameover"` | A mine was revealed                               |
| `undefined`  | No-op: the cell was already visible or is flagged |

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
- **Flagging needs a right click or the `f` key**, so it doesn't work on touch
  devices yet.

## To-do

Roughly in the order they'd unblock each other.

### Make it playable

- [X] Render the board to the DOM
- [X] Wire up clicks: left click reveals, right click toggles a flag
- [X] Re-render on state change
- [X] Show the mine counter and a reset button
- [X] Display win / game-over state and stop accepting input
- [X] Difficulty presets (Beginner 9×9/10, Intermediate 16×16/40, Expert 30×16/99)
- [X] Move the UI to React with Vite and Material UI
- [X] Keyboard flagging with `f`
- [ ] Long-press to flag on touch devices (right click doesn't exist there)
- [ ] Mark incorrect flags at game over (a flag on a safe cell)

### Fix the issues listed above

- [X] Add first-click safety: `placeMines()` runs on the first `revealCell` and excludes that cell
- [X] Make `floodFill` skip flagged cells
- [X] Reveal all mines on game over (and on win, for a legible final board)
- [X] Guard `mineCount` against exceeding `rows * cols` (clamped in the constructor)
- [X] Make a decided game terminal so a win can't become a loss
- [ ] Decide what `revealCell` should return on a no-op — `undefined` is inconsistent with the documented states
- [ ] Validate out-of-range coordinates instead of throwing a raw `TypeError`

### Structure and polish

- [X] Replace the empty `Game.js` stub with `useMinesweeper` as the controller
- [X] Move board sizes into `difficulties.js` config
- [ ] Persist best times per difficulty
- [ ] Add a seed input for shareable/reproducible boards
- [ ] Keyboard navigation and focus management across the board
- [ ] Chording (click both buttons on a numbered cell to reveal neighbors)

### Testing

- [X] Add a `test` script and a jsdom harness driving the real components
- [ ] Add `node:test` unit tests for the model: `placeMines` determinism and exact mine count, `countNeighborMines` correctness, flood fill boundaries, win detection
- [ ] Cover the remaining edge cases: the 1×1/1-mine board, out-of-range coordinates

## Contributing

Model code in `src/game/` stays framework-free — no React or MUI imports — so it can be exercised in Node without a DOM. UI components stay presentational: they take props and hold no game state, and all mutation goes through `useMinesweeper`.

> **Careful:** `Grid` mutates `Cell` objects in place, so a `Cell` reference never changes between renders. Never pass one into a `memo`ized component — the prop comparison will always match and the component will stop repainting. `CellButton` takes flat primitives for exactly this reason.

Match the existing style: function components, named exports, 4-space indent, MUI `sx` props for styling.
