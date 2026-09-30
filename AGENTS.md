# AGENTS.md

React + Vite + Material UI. The game model in `src/game/` is plain ES-module
JavaScript with no React or MUI imports — keep it that way so the rules stay
testable outside a browser.

## Commands

- `npm run dev` — Vite dev server on <http://localhost:5173>
- `npm run build` — production bundle into `dist/`
- `npm run preview` — serve the built bundle
- `npm test` — mounts the components in jsdom and drives them (212 assertions)
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

A "clicks aren't registering" report here spent a long time looking like nothing.
In jsdom every rapid click applied, latency was flat, DOM node count and Emotion
class count were flat across repeated games, and per-click cost was sub-millisecond
at every board size. Every one of those measurements was correct and the board was
still unusable, because **jsdom dispatches a finished `click` directly and so
never asks the question the bug was about.** See the section below.

Two probes that made it worse, both worth avoiding:

- Once the game is decided the board correctly ignores clicks, and unvisited safe
  cells keep their `hidden` label at game over. Counting those as dropped input
  invents a bug. Filter on `!cell.disabled` and on the banner being empty.
- The first click after switching difficulty renders every cell for the first time
  (emotion styles, reveal state). Timing that one and calling it per-click cost
  measures JIT warmup, not steady state. Benchmark the median of a run.

What actually settled it: the user recorded the screen, and the recording showed
a cursor crossing about three cells per click. That is a shape jsdom cannot
produce, and reading it took seconds once there was something to read. **When a
reported input bug will not reproduce, get a recording before optimising
anything.**

A single large flood fill legitimately costs a whole board re-render. That is one
render, not a dropped click.

## The trap that ate _every_ click: acting on `click` instead of press

**A cell acts on `pointerdown`, not on `click`. Do not move this back to
`onClick`.** This is not a latency preference; it is the difference between a
board that works and one that ignores you.

A browser fires `click` only when the mousedown and mouseup targets **agree**.
When they disagree, it dispatches the click to their **nearest common ancestor**
instead — the board. So play the way a fast player does, sweeping the pointer
across the board and clicking as you go, and the pointer travels several cells
between press and release. Every one of those clicks is sent to the board, and
no cell ever hears about it.

Measured on a screen recording of the bug: a median cursor speed of 1719 px/sec
against a 33px cell pitch, so a 60ms click crosses about three cells. Across six
seconds of continuous clicking, **exactly one cell revealed** — the one click
where the mouse happened to be momentarily still. Reproduced in headless
Chromium by pressing a cell and dragging 90px before release: **0 of 12 presses
registered** on the old code, **12 of 12** after the change, and still 10 of 10
with a 170px drag.

Why this hid for so long, and why jsdom is the wrong place to look for it:

- **jsdom cannot reproduce it.** `element.click()` dispatches a finished click
  directly, so the down/up agreement — the entire question — never arises. Every
  test written that way passes while the real app is unusable. Assert on
  dispatched `pointerdown`, or drive a real browser.
- **Hover still worked**, because hover is a hit-test, not a down/up agreement.
  So the cells were visibly there, lit up under the cursor, and did nothing.

`pointerdown` fires on the element the press _started_ on, however far the
pointer travels afterwards, and it removes the wait for release. The guards
around it are load-bearing, and each has a test:

- **Primary button only** (`button !== 0`). Right click flags and middle click
  chords; acting on their press too would flag a cell and then reveal or chord it
  in one gesture.
- **Touch is excluded** (`pointerType === 'touch'`). Touch keeps the long-press
  path, and revealing on press would defeat the thing long press exists to do.
- **`actedOnPress` swallows the follow-up click** so a press and its release act
  once, not twice. A double act is not harmless: on a cell that revealed as a
  number it chords and opens the neighbours on top of the reveal.
- **`onPointerLeave` clears that flag**, for a press that started here and ended
  elsewhere. That press never produces a click here, and a stale flag would
  swallow the next real activation.

## Secondary: `transform` on a cell moves its own hit box

**A `transform` on a cell is not just visual** — it changes what the browser
hit-tests against, because a transformed element is hit on its transformed
geometry. A cell that resizes while the pointer is over it can shed presses near
its edges.

A revealed cell was `scale(0.96)`, painting at 28.8px rather than the 30px the
board is built around, and it transitioned there over 90ms; `:active` was
`translateY(1px)`. Both are gone, replaced by `PRESSED_SHADOW`, and the cell is
paint-only now.

**Know that this was diagnosed alongside the real bug and was not its cause.**
The press-versus-click routing above was the cause, and it accounts for
essentially all of the lost input. The transform removal is a real but secondary
hazard, and it is in place at the moment. If a planned effect needs a cell to
scale, the paint-only route is `transition-delay` keyed on distance from the
clicked cell, which cannot move a hit box. The source-level `transform` /
`scale(` / `translate(` checks in `npm test` will fail if a transform returns,
so drop them deliberately rather than by accident.

Why those checks exist is worth keeping in mind: the suite asserted
`width: var(--cell)` and passed throughout, because `width` genuinely was 30px.
**The declared size was correct and the painted size was not.** A stylesheet
assertion can only catch that by banning the property, not by checking its value.

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

- `canReveal` — hidden and unflagged: primary-button press reveals
- `canFlag` — hidden, flagged or not: right click or `f` toggles the flag, so a
  misplaced flag is removable without a reset
- `canChord` — revealed, safe, and numbered: press, middle click, right click,
  or `c` chords

**Left and middle button aside, a mouse acts on `pointerdown`, not `click`** —
see "The trap that ate _every_ click" above for why, and for the guards
(primary button only, touch excluded, the follow-up click suppressed).

On touch, a press held past `LONG_PRESS_MS` flags instead of revealing. The
press sets a ref that `act` and `onContextMenu` consume, because mobile browsers
fire a `contextmenu` and a `click` after a long press — without that, one long
press toggles the flag straight back off. `touchmove` cancels, so scrolling never
strays a flag. Touch is excluded from the press path for the same reason: acting
on press would reveal the very cell the long press exists to flag.

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
(gradient face, top highlight, bottom shadow); revealed cells are flat. No
`background-attachment: fixed` or fixed overlays — they repaint on every scroll
frame on mobile.

**Input responsiveness outranks visual flair.** If an effect ever competes with
a click being registered, the effect loses. That is not a hypothetical: an
animated press feedback cost this board every click a fast player made. The
reveal "pop" is now the raised face fading and flattening, paint-only, and the
press state is a shadow. A cascade no longer reads as a ripple because the
scale that produced it also moved the hit box; `transition-delay` keyed on
distance from the clicked cell restores that read safely, and is the route to
take if it is wanted back.
