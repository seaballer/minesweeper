# Codebase structure

A map of what every file in this repo is for. It is deliberately a **baseline**
document: it describes each file's _responsibility_ and its public surface, not
its internals, so ordinary edits inside a file do not require touching it.

## When to update this file

Update it when:

- a file is **added, removed, or renamed** (every source file needs an entry);
- a file's **responsibility changes** — e.g. a component starts owning state it
  did not before, or a module gains a public export others depend on;
- a new **directory** appears under `src/`.

Do **not** update it for internal refactors, new props that do not change a
component's role, new styles, new assertions, or bug fixes. Those belong in
`git log` and, when they encode a decision worth keeping,
[`AGENTS.md`](../AGENTS.md).

Each entry answers three questions: what the file owns, what it exposes, and
what to touch it for. Implementation detail and the reasoning behind
non-obvious choices live in `AGENTS.md`; this file links there rather than
repeating it.

## Repository layout

```
index.html                     HTML shell, #root, font/viewport meta
vite.config.js                 Vite config (React plugin)
eslint.config.js               ESLint flat config
.prettierrc.json / .prettierignore
package.json                   Scripts and dependencies
ui-check.mjs                   npm test: jsdom + Vite SSR harness
README.md                      Install, run, layout, to-do
AGENTS.md                      Architecture notes and non-obvious decisions
docs/structure.md              This file
src/
  main.jsx                     React entry point
  App.jsx                      Page layout, no game logic
  theme.js                     Design tokens (single source of truth)
  index.css                    Page shell only
  game/                        Plain JS model, no React or MUI imports
  hooks/                       State and effects that own the model
  components/                  Presentational React components
```

## Root

### index.html

The Vite entry document. Declares `<div id="root">`, the language, the viewport
meta tag (required for the phone layout to scale), the theme colour, and the
`<script type="module" src="/src/main.jsx">` that boots the app. Contains no
markup of its own — everything visible is rendered by React.

### vite.config.js

Registers `@vitejs/plugin-react` so JSX and Fast Refresh work. No aliases, no
plugins beyond that, no proxy or build-time env. Add build configuration here.

### eslint.config.js

Flat ESLint config. Applies `js.configs.recommended` plus `react-hooks`
recommended rules to all `**/*.{js,jsx,mjs}`, and adds a Node globals block for
`ui-check.mjs`. `no-unused-vars` ignores arguments prefixed with `_`, which is
how deliberately-bound-but-unread props stay lint-clean. Ignores `dist/`,
`node_modules/`, and `.opencode/`.

### .prettierrc.json / .prettierignore

Formatting config matching the existing style: 4-space indent, single quotes,
100 columns, semicolons, ES5 trailing commas. The ignore file excludes
`node_modules/`, `dist/`, `package-lock.json`, and `.opencode/`. Run
`npm run format` before committing.

### package.json

Scripts: `dev`, `build`, `preview`, `test` (`node ui-check.mjs`), `lint`,
`format`, `format:check`. Runtime dependencies are React 19, Material UI 9, and
the two Emotion packages MUI needs; dev dependencies are Vite 8, the React
plugin, ESLint with `react-hooks`, Prettier, and jsdom.

### ui-check.mjs

The `npm test` harness. There is no test framework: it builds a jsdom document,
starts a Vite dev server for SSR module loading, mounts the real `App` inside
`ThemeProvider` + `CssBaseline`, and drives it with dispatched events, asserting
along the way (244 assertions).

What it covers, in file order: theme and generated-class sanity, cell styling and
the live region, the press-not-click path, layout of the readouts and title, the
info popover, the `R` shortcut, board sizing arithmetic (importing `CELL`,
`GAP` and `BOARD_CHROME` from `Board.jsx` rather than copying them),
source-level bans on transforms and on gradients passed to `backgroundColor`,
grid model behaviour (chording, wrong flags, `flagCount`, out-of-range
coordinates, degenerate boards), touch long-press, the seed input, the custom
difficulty panel, and the timer. Exits non-zero on any failure or unhandled
error.

Use it as the place to add a regression assertion when you fix a bug. Note its
limitation: `element.click()` dispatches a finished click, so it cannot
reproduce down/up target disagreement — assert on `pointerdown` or drive a real
browser.

### README.md

Install and run instructions, command table, the repo layout, and the to-do
list. User-facing; keep in step with the command table above.

### AGENTS.md

Architecture notes and the reasoning behind decisions that are easy to undo by
accident: the in-place mutation / `memo` contract, the press-vs-click fix, the
constant cell size, the seed hashing rule, and the "input responsiveness outranks
visual flair" rule. Read this before changing anything in `src/game/`,
`Board.jsx`, or `CellButton.jsx`.

## src

### src/main.jsx

React entry. Creates the root on `#root` and renders `App` inside `StrictMode`,
`ThemeProvider` (with `theme.js`), and `CssBaseline`, then imports
`index.css`. Nothing else belongs here.

### src/App.jsx

Page layout and the wiring point between the hook and the components. It holds
no game logic: it calls `useMinesweeper()` and passes results down as props. It
owns exactly one piece of local state — `controlsOpen` — so the `R` shortcut can
stand down while the controls dialog is open, and renders the vertical stack:
info button, wordmark, difficulty selector, custom-size panel (custom only),
status banner, and then a centred column holding `ControlBar` above `Board`.
`Container maxWidth="xl"` is load-bearing: cells are a fixed 30px, so an Expert
board is 1021px wide and a narrower cap would scroll it horizontally.

### src/theme.js

The single source of design tokens. Dark palette, `board.*` surface tokens
(bezel, raised-key gradient stops, revealed wash, mine tint, border), the `mono`
font stack, `wordmark` gradient stops, typography, and MUI component overrides
for `Button`, `ToggleButton`, and `ToggleButtonGroup`. Components reference
tokens; a hardcoded hex in a component is a regression. Change colours here.

### src/index.css

The only stylesheet in the app, and it owns only the page shell: the Google
Fonts import, `color-scheme`, the flat page background, `#root` sizing and
stacking, and the `prefers-reduced-motion` block. All component styling is MUI
`sx`. Do not add component CSS here.

## src/components

Presentational only. Every component receives data and callbacks as props and
holds no game state. Two of them (`Board`, `CellButton`) are `memo`ized and take
flat primitives rather than model objects — see "Contracts" below.

### components/Board.jsx

The minefield: a CSS grid of `grid.cells` mapped one-to-one onto `CellButton`s,
with the bezel styling that makes it read as a panel sunk into the page.

Also the owner of board geometry, exported so the sizing arithmetic has one
definition: `CELL` (30, fixed), `GAP` (3), `PAD` (16), `BORDER` (1), and the
derived `BOARD_CHROME`. It sets `--cell` on the grid so tracks and cells cannot
disagree, and uses `role="group"` — do not upgrade to `role="grid"` without also
implementing owned rows and 2-D arrow-key navigation.

Touch it for: cell size, gap, bezel look, grid semantics, the `version` prop.

### components/CellButton.jsx

One cell: rendering (mine glyph, wrong-flag cross, flag, or the neighbour count)
and the entire input vocabulary. Three separate predicates gate the gestures —
`canReveal`, `canFlag`, `canChord` — plus `LONG_PRESS_MS` for touch, the
`PRESSED_SHADOW` press feedback, and the `NUMBER_COLORS` digit palette.

Input contract worth preserving: mouse acts on `pointerdown` (primary button,
touch excluded), with `actedOnPress` swallowing the follow-up click and
`onPointerLeave` clearing that flag; right click flags or chords; middle click
chords; `f` and `c` are the keyboard equivalents; touch long-press flags. No
`transform` or scale may return on a cell in any state — it moves the hit box.

Touch it for: cell appearance, digit colours, gesture behaviour, accessibility
label text.

### components/ControlBar.jsx

The readout row directly above the board: mine counter, Reset button, timer.
`1fr auto 1fr` tracks keep the Reset on the board's axis at any board width, and
it imports `PAD` and `BORDER` from `Board.jsx` to offset the readouts so they
align to the first and last _cell_ rather than the bezel edge. The counter's
wrapper carries the colour (green only when the flags actually add up), since
the icon and digits inherit from it.

### components/ControlsInfo.jsx

The circular info button and its popover holding the control reference. Two
constant tables at the top (`CONTROLS`, `KEYS`) are the whole content — editing
those is the only reason to touch this file normally. `anchor` is the single
source of truth for open state and `open` is derived, so there is no effect
syncing the two; the parent is simply told on each change. Uses a native `title`
rather than MUI's Tooltip.

### components/CustomSettings.jsx

The custom board-size panel: rows, cols, mines, an optional seed behind a
`Seed?` checkbox, an Apply button, and a caption showing the _resolved_ size.

Built from plain `<input>`s and one inline `<style>`, not MUI `TextField` or
`Checkbox`, for bundle size. It holds raw string drafts so a half-typed value is
not clamped mid-keystroke, snaps over-limit numeric input immediately, and lets
the wheel step a focused field by one. `preview` is the draft run through
`resolveCustom`, and `dirty` compares resolved values rather than raw strings.

Touch it for: field behaviour, the seed toggle, the resolved-size caption, panel
styling.

### components/DifficultySelect.jsx

The beginner / intermediate / expert / custom toggle group, rendered from
`DIFFICULTY_LIST`. Ignores the `null` value MUI sends when the active button is
clicked again. Change the presets in `game/difficulties.js`, not here.

### components/StatusBanner.jsx

The win / loss message. The live region is permanently mounted and only its text
changes, because a live region that appears with its content is usually silent.
Space is reserved via `minHeight` so the board does not jump when a result
appears. Add or reword outcomes in the `MESSAGES` map.

### components/Timer.jsx

The elapsed-time readout. Uses `role="timer"` with `aria-live="off"` so a
per-second clock does not interrupt a screen reader, while `aria-label` still
exposes the current value. Imports `formatTime` from the hook rather than
reimplementing the formatting.

### components/MineIcon.jsx

A hand-drawn SVG spiked ball — MUI has no `Bomb` icon. Shared by revealed
cells and the mine counter so both read as the same object. `size` accepts any
CSS length including `calc()` against `--cell`. Decorative (`aria-hidden`), and
it inherits its colour from its wrapper.

## src/hooks

State and effects. `useMinesweeper.js` is the only place the game model is
mutated; the other two are self-contained utilities.

### hooks/useMinesweeper.js

Owns the `Grid` instance and every action the UI can take: `reveal`,
`toggleFlag`, `chord`, `reset`, `changeDifficulty`, `applyCustomSize`. Returns
the model plus derived readouts (`status`, `isOver`, `minesRemaining`,
`allMinesFlagged`, `elapsed`, `timerRunning`) and `version`.

The `Grid` is `useMemo`d on `[difficultyKey, customSize]`, so changing either
builds a fresh board rather than mutating one. `version` is an invalidation
token bumped after every mutation — it is not game state, nothing branches on
its value, and it exists so `memo`ized consumers repaint. Read the header comment
before changing anything here.

### hooks/useTimer.js

The game clock (`useTimer`) and the `formatTime(seconds)` → `m:ss` helper shared
with `Timer.jsx`. Time is derived from a start timestamp rather than counted, so
a throttled background tab cannot make it drift; the 250ms interval only forces
a repaint. `resetKey` is `gameId` from `useMinesweeper`, bumped on every new
board to zero the clock.

### hooks/useResetShortcut.js

Document-level `r` / `R` to reset. Ignores repeats, modifier combinations, and
keystrokes aimed at a text field, so typing in the custom-size inputs cannot
wipe a live game. Takes a `suspended` flag that `App` wires to the controls
dialog state.

## src/game

Plain ES-module JavaScript. **No React and no MUI imports here** — that is what
keeps the rules testable in bare Node. Nothing in this directory may import from
`src/components`, `src/hooks`, or `@mui/*`.

### game/Grid.js

The board model: mine placement, neighbour counting, flood fill, chording,
win/loss detection, and the flag tally. Exports the `Grid` class and
`hashSeed`.

Contracts to know before calling it: the constructor allocates but does **not**
place mines — placement is deferred to the first `revealCell` via
`ensureMinesPlaced`, which is where first-click safety is decided (skipped for a
pinned board). `revealCell`, `chord`, and `toggleFlag` all return a status
string, never `undefined`, and all three enforce the terminal status themselves.
Coordinate entry points call `assertInBounds` and throw a `RangeError` on bad
input. `toggleFlag` is the only supported way to change a flag, and keeps
`flagCount` in step so the UI tally is an O(1) field read. `seed === undefined`
is the only "no seed"; an empty string is a valid seed of zero.

### game/Cell.js

One cell's state: `isMine`, `isExploded`, `isFlagged`, `isVisible`,
`isWrongFlag`, `neighborMines`, and the three mutators `reveal()`,
`toggleFlag()`, `placeMine()`. Mutated in place by `Grid` and never replaced —
this is the root cause of the `memo` contract below.

### game/difficulties.js

The board presets (`DIFFICULTIES`, `DIFFICULTY_LIST`, `DEFAULT_DIFFICULTY`,
`CUSTOM_KEY`), the custom bounds (`CUSTOM_LIMITS`, `DEFAULT_CUSTOM`), and
`resolveCustom(input, previous)` — the sanitizer every custom value passes
through. It never throws; invalid input falls back to the previous value, and
the fallback is clamped too. A blank seed resolves to `undefined` (unpinned),
which is how clearing the field unpins a board.

## docs

### docs/structure.md

This file. Updated on structural change only, per the policy at the top.

## Contracts that span files

These are the things that look wrong in one file and are only correct because of
another. `AGENTS.md` has the full reasoning; the short version:

1. **`Grid` and `Cell` mutate in place.** React sees no change between renders,
   so `useMinesweeper` bumps `version` after every mutation. Never pass a `Cell`
   instance to a `memo`ized component — the reference never changes, so it will
   not repaint. `CellButton` takes flat primitives for this reason.

2. **`Board` is `memo`ized and survives on `version` alone.** On a click, none of
   its real props change. Do not drop `version` from its props or from `App`,
   or the board goes dead while the model keeps working.

3. **Cells act on `pointerdown`, not `click`.** A browser sends a click to the
   nearest common ancestor when press and release targets disagree, which is
   exactly what a fast sweep across the board produces. The guards around it
   (primary button only, touch excluded, follow-up click swallowed) are
   load-bearing and each has an assertion.

4. **No `transform` on a cell, ever.** It changes the hit box, not just the
   look. Press feedback is a shadow; reveal feedback is the raised face fading.

5. **Cell size is a constant 30px**, exposed as `--cell` and exported as `CELL`
   so `Board.jsx` and `ui-check.mjs` agree. It is not responsive by decision.

6. **Gradients go through `backgroundImage`, never `backgroundColor`.** A
   gradient in `backgroundColor` is silently dropped and renders transparent.

7. **Colours come from `theme.js`.** No hardcoded hex in a component.

## Where to start for a specific change

| Goal                                                 | Start here                                               |
| ---------------------------------------------------- | -------------------------------------------------------- |
| Colours, spacing, type, board surfaces               | `src/theme.js`                                           |
| Page background, fonts, reduced motion               | `src/index.css`                                          |
| Layout, ordering, max width                          | `src/App.jsx`                                            |
| Cell size, gap, bezel, grid semantics                | `src/components/Board.jsx`                               |
| How a cell looks, digit colours, press feedback      | `src/components/CellButton.jsx`                          |
| Mouse / touch / keyboard gestures                    | `src/components/CellButton.jsx`                          |
| Cell aria-label text                                 | `src/components/CellButton.jsx`                          |
| Mine counter, Reset button, timer row                | `src/components/ControlBar.jsx`                          |
| Win / loss wording                                   | `src/components/StatusBanner.jsx`                        |
| Controls / shortcuts reference text                  | `src/components/ControlsInfo.jsx`                        |
| Difficulty presets, custom limits, `resolveCustom`   | `src/game/difficulties.js`                               |
| Board sizes, mine count, seeding                     | `src/game/difficulties.js` and `src/game/Grid.js`        |
| Rules: placement, flood fill, chord, win, flag tally | `src/game/Grid.js`                                       |
| Cell state flags                                     | `src/game/Cell.js`                                       |
| What a click does end to end                         | `src/hooks/useMinesweeper.js`                            |
| Clock behaviour or `m:ss` formatting                 | `src/hooks/useTimer.js`                                  |
| `R` shortcut                                         | `src/hooks/useResetShortcut.js`                          |
| Custom-size field behaviour, seed checkbox           | `src/components/CustomSettings.jsx`                      |
| Mine glyph artwork                                   | `src/components/MineIcon.jsx`                            |
| Build / lint / format config                         | `vite.config.js`, `eslint.config.js`, `.prettierrc.json` |
