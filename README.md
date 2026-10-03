
# Minesweeper

A browser-based Minesweeper built with **React 19**, **Material UI 9**, and **Vite 8**.

The game logic lives in plain JavaScript modules with no React or MUI dependencies, so it can also run and be tested directly in Node.

Features include three presets, custom boards, optional seeds, first-click safety, keyboard controls, and local best times.

## Running it

Requires **Node 20.19+ or 22.12+** and npm.

```bash
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

| Command                  | Description                  |
| ------------------------ | ---------------------------- |
| `npm run dev`          | Start the dev server         |
| `npm run build`        | Create the production build  |
| `npm run preview`      | Preview the production build |
| `npm test`             | Run UI and model tests       |
| `npm run test:model`   | Run model tests only         |
| `npm run lint`         | Run ESLint                   |
| `npm run format`       | Format with Prettier         |
| `npm run format:check` | Check formatting             |

## Layout

```text
src/
  game/                     Game logic, independent from React
    Grid.js                 Board state and game rules
    Cell.js                 Cell state and gestures
    difficulties.js         Presets and custom board settings
    bestTimes.js            Best-time storage

  hooks/
    useMinesweeper.js       Game state controller
    useTimer.js             Game timer
    useResetShortcut.js     R shortcut
    useBestTimes.js         Best-time handling

  components/               UI components
    Board.jsx
    CellButton.jsx
    ControlBar.jsx
    DifficultySelect.jsx
    ControlsInfo.jsx
    BestTimes.jsx
    CustomSettings.jsx
    StatusBanner.jsx
    Timer.jsx
    MineIcon.jsx

  App.jsx                   Main layout
  theme.js                  Design tokens
  index.css                 Page-level styles

test/
  model.test.js              Model tests

ui-check.mjs                 UI test harness
AGENTS.md                    Architecture notes
docs/structure.md            Per-file documentation
```

The project is split into three main layers:

* **`game/`** — game rules and board state.
* **`hooks/`** — connects the model to React state.
* **`components/`** — UI and user interaction.

## Game

### Presets

| Preset       | Size           | Mines           |
| ------------ | -------------- | --------------- |
| Beginner     | 9 × 9         | 10              |
| Intermediate | 16 × 16       | 40              |
| Expert       | 16 × 30       | 99              |
| Custom       | 2–30 × 2–30 | 1 to cells − 1 |

Custom boards can also use an optional text seed.

Mines are normally placed on the first reveal, keeping the opening cell safe. Seeded boards are deterministic, so the same seed, size, and mine count produce the same layout.

```js
new Grid(9, 9, 10);          // New board each reset
new Grid(9, 9, 10, 1234);    // Reproducible board
new Grid(9, 9, 10, 'hello'); // Text seed
```

The model has four states:

```text
ready → playing → win
              ↘ gameover
```

Once a game ends, the board is locked until reset.

## Controls

| Input                         | Action                |
| ----------------------------- | --------------------- |
| Left click                    | Reveal                |
| Right click                   | Flag / unflag         |
| Long press                    | Flag on touch         |
| Click a number                | Chord                 |
| `F`                         | Flag focused cell     |
| `C`                         | Chord focused cell    |
| `R`                         | Reset                 |
| `Tab`                       | Enter / leave board   |
| Arrow keys                    | Move around the board |
| `PageUp` / `PageDown`     | Move four rows        |
| `Home` / `End`            | Row start / end       |
| `Ctrl` + `Home` / `End` | Board start / end     |
| `Enter` / `Space`         | Reveal / chord        |

The board uses a single keyboard focus point rather than making every cell a tab stop. Arrow navigation stays inside the board and does not scroll the page.

## Best Times

The top three times for each preset are stored locally in:

```text
minesweeper.best-times.v1
```

Custom boards do not have a leaderboard. If `localStorage` is unavailable, the game still works without saving times.

## Custom Boards

Custom settings support:

* 2–30 rows
* 2–30 columns
* 1 to `rows × columns - 1` mines
* Optional text seed

Settings are validated when applied, and every board always has at least one safe cell.

A seed pins the board layout, making it possible to replay the same board or share it with someone else.

## Tests

There are two test suites:

* **Model tests** use Node's `node:test` and test the game rules directly.
* **UI tests** use jsdom and Vite to interact with the actual React components.

```bash
npm test
```

The UI harness covers interactions such as keyboard navigation, pointer gestures, board sizing, and accessibility-related behavior.

Some browser behavior cannot be fully reproduced in jsdom, so pointer gestures and visual hit-testing should be checked in a real browser.

## Conventions

* `.jsx` for React components, `.js` for plain modules.
* Named exports and function components.
* 4-space indentation and single quotes.
* MUI `sx` for component styling.
* `theme.js` is the source of design tokens.
* `index.css` is limited to page-level styles.

The important architectural rule is that **game logic stays independent from the UI**. `Grid` owns the rules, `useMinesweeper` owns the game state, and components handle presentation and input.

For the reasoning behind some less obvious implementation details, see [`AGENTS.md`](AGENTS.md) and [`docs/structure.md`](docs/structure.md).
