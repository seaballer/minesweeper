# AGENTS.md

React + Vite + Material UI. The game model in `src/game/` is plain ES-module
JavaScript with no React or MUI imports — keep it that way so the rules stay
testable outside a browser.

## Commands

- `npm run dev` — Vite dev server on <http://localhost:5173>
- `npm run build` — production bundle into `dist/`
- `npm run preview` — serve the built bundle
- `npm test` — both suites: the jsdom UI harness (336 assertions) and the model unit tests
- `npm run test:model` — just `node --test test/`, the model suite on its own (33 tests)
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
- `src/game/bestTimes.js` — the three best times per difficulty, and their storage. No DOM, no React.
- `src/hooks/useBestTimes.js` — loads the stored times and exposes `record(difficultyKey, seconds)`. Writes to storage from an effect, not from inside the state updater, because an updater must stay pure and React may call it twice.
- `src/components/` — presentational only. `Board`, `CellButton`, `ControlBar`, `DifficultySelect`, `ControlsInfo`, `BestTimes`, `StatusBanner`, `Timer`, `CustomSettings`, `MineIcon`. They receive data and callbacks as props and hold no game state.
- `src/hooks/useResetShortcut.js` — document-level `R` to reset. Takes a `suspended` flag: `App` passes the controls-dialog state, because the dialog is where `R` is documented and it must not wipe a live game while it is open.
- `CustomSettings.jsx` uses plain `<input>`s and one inline `<style>`, not MUI's `TextField`. `TextField` pulls in the FormControl/InputLabel/OutlinedInput family, which cost ~80kB for three numeric fields. Emotion can't express vendor pseudo-elements in a plain style object, hence the stylesheet tag. The `Seed?` checkbox is plain for the same reason: MUI's `Checkbox` would drag in the SwitchBase family for one control. `accentColor` themes the tick instead.

## Keyboard navigation and focus

`Board` is a roving-tabindex grid. **The board is one tab stop, not one per
cell** — without that, Tab would walk 81 buttons on Beginner and 480 on Expert.

- **Roving tabindex.** Exactly one cell carries `tabIndex={0}`; the rest are
  `-1`, so they are still focusable by script and by arrow keys but unreachable
  by Tab. `npm test` asserts there is exactly one.
- **The cursor is clamped at read time, and sent home on a new board.** `cursorRow`
  and `cursorCol` are `Math.min` against the board's dimensions on every render, so
  shrinking the board can never leave the grid with no tabbable cell. Clamping is
  not enough on its own, though: a reset keeps the same dimensions, so the cursor
  used to stay wherever the player left it — Tab entered the fresh board mid-way
  through, and Shift+Tab off the Reset button returned there rather than to the
  start. `useMinesweeper` therefore exposes `boardId` (the `gameId` that already
  restarts the clock), which bumps on reset, a difficulty switch and an applied
  size alike. `Board` resets the cursor **during render**, comparing `boardId` to
  the last one it saw, per React's guidance for adjusting state on a prop change.
  A `useEffect` here would mean `setState` inside an effect, cascading a render and
  tripping `react-hooks/set-state-in-effect`.
- **Focus follows the cursor home only from inside the board.** A layout effect
  re-points focus at cell `0-0`, but only when `boardRef` already contains
  `document.activeElement`. Pressing the Reset button leaves focus on that button,
  and stealing it back would yank the user out of the control they just used;
  pressing `R` from a focused cell keeps focus on the board, so it does follow. It
  is a layout effect so the move lands before paint, and it touches no state, so it
  cannot trip the rule the render-time adjust above avoids.
- **Focus follows focus.** `onFocus` on the grid re-points the cursor at
  whatever actually holds focus, so the tab stop follows a click or a Tab as well
  as an arrow. Without it, Tab would leave the board from wherever the cursor
  happened to be rather than where the player was.
- **`onKeyDown` claims only the navigation keys** and `preventDefault`s them, so
  running the cursor off an edge cannot scroll the page out from under it.
  `f`, `c`, Enter and Space fall through to the cell, which handles them.
- **Keys:** arrows move one cell, `PageUp`/`PageDown` jump four rows, `Home` and
  `End` go to the ends of the current row, `Ctrl`/`Cmd` with either jumps to the
  first or last cell of the board. Movement clamps rather than wrapping.
- **Rows are `display: contents`.** A row owns its semantics without owning a
  box, so the cells stay direct children of the CSS grid and the
  `gridTemplateColumns` / `gap` arithmetic is untouched. **This is the one claim
  in this section that `npm test` cannot check.** jsdom has no accessibility
  tree, so the suite asserts the roles exist in the DOM — one `row` per board
  row, 81 `gridcell`s, all 81 owned by a `row` — and nothing about whether they
  survive to a screen reader. Whether `display: contents` drops a box from the
  accessibility tree is a real-browser question; check it there before trusting
  the `grid` role.

**jsdom's `click()` does not move focus** — it dispatches the event and leaves
`document.activeElement` alone. Driving a focus test with it tests the shim, so
the harness uses `.focus()`. That a real click focuses the button is the
browser's behaviour and is **not** asserted anywhere: there is no browser driver
in this repo. Treat it as an untested assumption rather than a verified fact.

## Best times

Three runs per difficulty, kept in the browser. **There is no database** — this
app has no backend, so "the database" is `localStorage` and nothing else.

- **`localStorage`, not a cookie.** A cookie exists to talk to a server, and
  there isn't one; it would also attach a small value to every request to
  wherever this is hosted, in exchange for a 4kB cap and a per-domain cookie
  budget. If these ever need to be server-readable, swap `readTimes` and
  `writeTimes` and nothing else in the app changes — the key is the only thing
  that names the medium.
- **Both read and write swallow every error.** Blocked storage (private
  browsing, site-data settings) throws, and a hand-edited value throws on parse.
  A leaderboard that cannot persist degrades to one that does not remember;
  neither should stop the game running.
- **`sanitize` is not a formality.** Anything read off disk is rebuilt from
  `RANKED_DIFFICULTIES`: at most `KEEP` non-negative finite numbers, ascending.
  That makes `addTime` safe to call with whatever came back out of storage, and
  it means a hand-edited `custom` key cannot sneak into the shape.
- **Only the three presets are ranked** (`RANKED_DIFFICULTIES`). `App` renders
  the trophy only when `isRanked(difficulty.key)`, so a custom board has no
  leaderboard at all rather than an empty one — its "best time" is not
  comparable to another custom board, let alone to a preset.
- **A win is banked once, keyed on the transition.** `App` keeps
  `previousStatus` in a ref and records when the status _becomes_ `win`. Testing
  `status === 'win'` directly would bank the same run again on every re-render
  while the banner is up.
- **Times are whole seconds**, exactly what the clock read at the win, so the
  board and the leaderboard cannot disagree about the same run. `0` is therefore
  a legitimate value: it means the game was won inside the first second, which
  the presets make hard but scripted play can do.
- **Repeats are kept, not collapsed.** Two runs at the same whole second are two
  real runs, and the list says `1 / 2 / 3` by position.
- **The popover suspends `R`.** `App` passes `controlsOpen || bestTimesOpen` to
  `useResetShortcut`, so reading your times cannot cost you the run you just
  finished.

`ui-check.mjs` wins a real Beginner game to prove the wiring, by temporarily
shrinking that preset to 3×3 with a single mine and then solving it: with one
mine, a hidden cell that touches no revealed positive number is provably safe.
The preset is restored in a `finally`.

## The model has no DOM and no React, so it gets `node:test`

`src/game/` is plain ES modules, so it imports straight into Node — no jsdom, no
Vite, no mounting. `test/model.test.js` runs under `node:test` with
`node:assert/strict`, and `npm test` runs it after the UI harness.

The split matters: `ui-check.mjs` is for what the _interface_ does and has to
mount everything to observe it; this suite is for rules and arithmetic, where
mounting would only make failures harder to read. `placeMines` determinism and
exact mine count, `countNeighborMines`, flood-fill boundaries, win detection, the
flag tally, chording, and the shared coordinate contracts are all covered here.

Several of these tests were written wrong first and had to be corrected against
the model, which is the point of having them:

- **Opening a cell that is a `0` cascades, so a "numbered cell opens only itself"
  test needs a cell that actually touches a mine.** The 3×3 I first picked had
  the opening cell two steps from its mine.
- **A flagged cell cannot be revealed**, so a loss cannot be triggered by
  revealing the cell that carries the correct flag. It takes a second mine.
- **A wrong flag is permanent.** Marking one wrong also reveals that cell, and a
  revealed cell refuses to be flagged or unflagged — so the mistake cannot be
  tidied away. The board at game over is final, which is the better behaviour
  than the one the test originally asserted.
- **A chord can win the board**, and a win uncovers every mine. So "chording
  never reveals a mine" is not a safe blanket assertion; the test pins the
  narrower, always-true contract instead — the flags come back untouched.

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

**The seed is behind a `Seed?` checkbox**, not a fourth field. Pinning a board is
something you opt into, and a permanently visible field reads as "fill me in".
Three things about it are deliberate:

- **Unchecked passes `seed: ''` into `resolveCustom`**, so "no seed" travels the
  same sanitize path as any other input instead of being special-cased at the
  call site. It resolves to `undefined`, which is the only value that unpins.
- **Unticking the box and applying unpins the board.** The draft text is kept
  while unchecked, so toggling off and on again does not throw the seed away —
  but applying while unticked does clear it, which is the only way to unpin.
- **The seed field skips all the numeric machinery** in the shared `field()`
  helper: no spinners, no max clamp, no wheel stepping, and it is wider. It has
  its own renderer for that reason, and the `optional` parameter that used to
  exist on `field()` only ever served the old numeric seed, so it is gone.

`seedEnabled` initializes from `value.seed !== undefined`, which is what makes
the checkbox correct after leaving Custom for a preset and coming back.

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

## The held-press gesture

`Board` owns the whole press, and **a cell must not act on `click` or on
`pointerdown`.** Both of those were tried and both were wrong:

- **`click` loses every fast click.** A browser fires it only when the mousedown
  and mouseup targets **agree**; when they disagree it dispatches to their
  **nearest common ancestor** instead — the board.
- **`pointerdown` opens the wrong cell.** It fires on the element the press
  _started_ on, so dragging from A to B opened A. Press-and-hold has to open the
  cell you let go over.

`Board` arms on `pointerdown`, follows the pointer while the button is held, and
commits on `pointerup` against the cell under the cursor at that moment.
`pointerup` has no down/up agreement requirement, which is why it fixed the
fast-click bug and is also what makes the drag work.

- **`armed` is a ref, `pressing` is state.** Nothing renders differently when a
  press arms, so arming in state would re-render 480 cells twice per press for
  nothing. Only the one highlighted cell is state, and moving it changes exactly
  two cells' props. `showPressing` also returns the previous object when the
  cell has not changed, so ordinary hovering costs nothing.
- **`pressingRef` mirrors `pressing`** so the release can read the highlighted
  cell _after_ clearing the highlight, without depending on a render landing in
  between. No effect needed, and no `setState` inside one.
- **A release in a gap falls back to the highlighted cell.** Cells are 3px apart,
  so a release can land between two of them. The player watched that cell light
  up, so that is the one that opens — otherwise a release 1px off a cell reads as
  the board losing a click, which is the exact bug this whole section is about.
  `showPressing(null)` deliberately keeps the last cell lit for the same reason.
- **Releasing off the board commits nothing** and clears the highlight. A press
  that ends outside the grid is not a click the player started, and `pointerup`
  never reaches the board in that case anyway; `onPointerLeave` is what stops a
  stale highlight being left behind.
- **Only a primary-button, non-touch press arms.** Touch keeps long-press-to-flag
  — acting on press there would reveal the very cell the long press exists to
  flag. Right and middle press are flag and chord, which the cell handles itself;
  arming them would open the cell those gestures are aimed at.
- **`onClick` in the cell is now only for touch and keyboard.** A mouse press is
  committed by the board, and the `click` the browser synthesises afterwards
  would double-act, so the cell swallows it. `touchedByFinger` distinguishes a
  tap's click, and `event.detail === 0` distinguishes a keyboard one.

**`cellGestures` is the single definition of "what does activating this cell
do."** It lives in `src/game/Cell.js` and both `CellButton` and `Board` call it.
Two copies of `canReveal` / `canFlag` / `canChord` is how a flag removal once
vanished — the cell thought it was revealed, the board thought it was flaggable.
`npm test` asserts there is exactly one export of it.

## The trap that ate _every_ click: acting on `click` instead of press

**A cell must never act on `click`.** This is not a latency preference; it is
the difference between a board that works and one that ignores you.

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

## The silent-failure trap: a dotted string in `sx` is not a theme reference

**Never write `backgroundColor: 'board.revealed'`.** Read the value off
`useTheme()` and interpolate it: `backgroundColor: theme.board.revealed`.

MUI's `sx` resolves only the shorthands it knows about — `primary.main`,
`text.secondary`, `divider`, `error.main`, `background.paper`. Any _other_ dotted
string is not treated as a theme path at all. It is emitted into the stylesheet
verbatim, producing the declaration

```css
background-color: board.revealed;
```

which is not a colour, so the browser drops it without a warning. Verified in
MUI 9.4: nesting the tokens under a known namespace (`background.board.*`) does
**not** help; only interpolation does.

This was live for the whole `board.*` token set. `board.bezel`, `board.border`,
`board.revealed` and `board.mineTint` were all being dropped, so the board had no
bezel, revealed cells had no wash, covered mines had no tint, and the 1px border
fell back to `currentColor` at full brightness — a glaring white line instead of
the intended 7% white. Every assertion in the suite passed throughout, because
none of them looked at the emitted CSS.

`npm test` now scans the component sources for `: 'board.…'` and fails on it.
That is the only kind of check that catches this, for the same reason the gradient
trap needed a CSS-engine probe rather than a value comparison: **the declared
value can look completely correct while the browser renders nothing.**

## Chord hover is a lighter wash, not a key gradient

A hidden cell is a raised key, so hovering it lightens the key's own gradient
(`keyHoverTop` → `keyHoverBottom`). A **revealed** cell is flat, and the only
interactive revealed cells are the numbers you can chord. Those used to get the
same gradient, which made a revealed number look like a hidden key again —
exactly backwards for the one cell you are being invited to click.

So the hover branches on the surface: `canReveal` gets the gradient,
`canChord` gets `board.revealedHover`, a heavier version of the cell's own wash
(`rgba(255,255,255,0.10)` over `rgba(255,255,255,0.035)`). No gradient, and
plainly lighter than the uncovered cell. `canReveal` and `canChord` are mutually
exclusive, so exactly one branch ever applies.

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

- The constructor allocates cells and `initialize()` resets them, but **neither places mines**. Placement is deferred to the first `revealCell` via `ensureMinesPlaced`, which is where first-click safety is decided — safe opening cell for an unpinned board, no safe cell for a pinned one. Until then the board has no mines and all `neighborMines` are 0.
- `revealCell(row, col)` **always returns a status string** (`ready` / `playing` / `win` / `gameover`) and never `undefined`. A no-op — already-visible or flagged cell — returns the current status, because the board is unchanged. `chord` follows the same rule.
- Seeds: a seed passed to the constructor is **pinned**, so `initialize()` replays that exact board. No seed means unpinned, and `initialize()` advances it, so reset yields a new board. Don't "simplify" this into one seed field — resetting a pinned grid is what makes a board shareable.
- A seed may be a **number or a string**. `hashSeed` reduces one to the uint32 `mulberry32` consumes, summing each character's 1-based position times its char code. Positions start at 1 deliberately: a 0-indexed first term would make the leading character contribute nothing, so `"abc"` and `"xbc"` would share a board. `npm test` pins the formula (`hashSeed('ab') === 1*97 + 2*98`) because changing it silently invalidates every board shared under an old seed.
- The hash is **order-sensitive but not collision-resistant**, so anagrams agree — `aab` and `bba` both sum to 585. Documented in the README and asserted as a known property, so it reads as a decision rather than a surprise.
- Only `seed === undefined` means unpinned. An empty string is a _valid_ seed of 0, so `resolveCustom` normalizes blanks to `undefined` before they reach `Grid`. The hook's equality check in `applyCustomSize` compares seed strings, so changing one rebuilds the board.
- `grid.status` is `"ready" | "playing" | "win" | "gameover"`. Once `win` or `gameover`, the game is terminal: further `revealCell` calls return that status and don't change the board.
- Flood fill skips flagged and mined cells, and doesn't expand through them.
- **First-click safety is conditional on the board being unpinned.** `ensureMinesPlaced` excludes the opening cell only when `!this.pinnedSeed`; a pinned board calls `placeMines()` with no safe cell, so the layout comes from the seed alone and the first click can be a mine. That is not just a difficulty setting — excluding the opening cell made a seeded layout depend on the opening move, so two people holding the same seed got different boards, which is the opposite of what pinning is for.
- The constructor clamps `mineCount` to `rows * cols - 1`, always leaving one safe cell. For an _unpinned_ board that spare cell is the one the first click is guaranteed to open, so a board needing every cell to be a mine has nowhere safe to go and is unwinnable before it starts. A 1×1 board asking for 1 mine becomes 1×1 with none, and wins immediately. A _pinned_ board does not lean on the first click for safety, but the clamp still holds so the board is winnable at all.
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
- Colors come from `theme.js` — `board.*`, the palette, and `theme.mono`. A hardcoded hex in a component is a regression; it drifts the moment a token changes. **The `board.*` tokens must be interpolated from `useTheme()`, never written as a dotted `sx` string** — see the silent-failure trap below, because the string form is dropped by the browser without complaint.
- The board is a real ARIA `grid`, with owned `row` and `gridcell` elements and 2-D arrow-key navigation. It was `role="group"` for exactly as long as that structure was missing — **if you take the navigation away, put the role back to `group`**, because a `grid` that does not move focus in two dimensions is a promise the app is not keeping.
- The result banner and the mine counter are persistent live regions (`role="status"`). Keep them mounted: a live region that appears with its own content is usually silent.
- Grid uses 4-space indent and no trailing newline on its final brace. Match surrounding style rather than reformatting files you touch.

## Design direction

Industrial instrument panel: dark field, cool blue as the only structural
accent, amber/red reserved for mines and loss. Hidden cells are raised keys
(gradient face, top highlight, bottom shadow); revealed cells are flat. No
`background-attachment: fixed` or fixed overlays — they repaint on every scroll
frame on mobile.

**The page background is a flat colour and should stay that way until someone
deliberately redesigns it.** It used to layer two radial glows plus a tiled grain
texture composited with `background-blend-mode`, which is what made it look muddy
and cost a full-viewport repaint per scroll frame. If a background treatment
comes back, make it one layer. Panels size to their contents with
`width: 'fit-content'` rather than stretching — a `Stack` stretches its children,
so a bar that looks like it "pans the whole screen" usually just needs that.

**Input responsiveness outranks visual flair.** If an effect ever competes with
a click being registered, the effect loses. That is not a hypothetical: an
animated press feedback cost this board every click a fast player made. The
reveal "pop" is now the raised face fading and flattening, paint-only, and the
press state is a shadow. A cascade no longer reads as a ripple because the
scale that produced it also moved the hit box; `transition-delay` keyed on
distance from the clicked cell restores that read safely, and is the route to
take if it is wanted back.
