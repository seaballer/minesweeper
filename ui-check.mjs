/**
 * UI verification harness.
 *
 * Mounts the real components in jsdom (via Vite, so JSX compiles) and drives
 * them the way a user would: clicking cells, flagging, switching difficulty.
 * Run with `npm test`. Exits non-zero on failure.
 *
 * This is not a unit-test framework — it is a smoke check for the behaviour
 * that jsdom can observe. The model in src/game/ has no DOM and is easier to
 * test directly in Node.
 */
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const dom = new JSDOM('<!DOCTYPE html><div id="root"></div>', { url: 'http://localhost/' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.MouseEvent = dom.window.MouseEvent;
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { ThemeProvider } = await import('@mui/material/styles');
const CssBaseline = (await import('@mui/material/CssBaseline')).default;
const App = (await vite.ssrLoadModule('/src/App.jsx')).default;
const theme = (await vite.ssrLoadModule('/src/theme.js')).default;
const { Grid } = await vite.ssrLoadModule('/src/game/Grid.js');

const errors = [];
console.error = (...a) => { errors.push(a.map(String).join(' ')); };

const root = createRoot(document.getElementById('root'));
await act(async () => {
    root.render(React.createElement(ThemeProvider, { theme }, React.createElement(CssBaseline, null), React.createElement(App, null)));
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const cells = () => $$('#minefield button');
const counter = () => $('#mine-counter')?.textContent;
const byText = (t) => $$('button').find((b) => b.textContent.trim() === t);
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`);

// Layout / theme
check('title renders', $('h1')?.textContent === 'Minesweeper');
check('81 cells', cells().length === 81, `got ${cells().length}`);
check('mine counter is 010', counter() === '010', `got "${counter()}"`);
check('difficulty caption present', /9×9 \/ 10 mines/.test(document.body.textContent));
check('no result before end', ($('[role="status"][aria-live]')?.textContent || '') === '');
check('cells start empty', cells().every((c) => c.textContent.trim() === ''));

// Dark theme actually applied
const bodyBg = $('body')?.getAttribute('style') || '';
const themeDark = theme.palette.mode === 'dark';
check('theme is dark', themeDark);
// Emotion injects rules as generated classes. jsdom doesn't expose the CSSOM
// rules it builds, so assert the cell carries a generated class and that the
// component tree renders distinct classes (which is what memo depends on).
const generated = (el) => (el?.className || '').split(/\s+/).filter((c) => c.startsWith('css-'));
check('cell carries a generated emotion class', generated(cells()[0]).length === 1, cells()[0]?.className);
// Identical unrevealed cells legitimately share one generated class; that's
// what makes memo cheap. Only differing states should diverge.
check('identical hidden cells share a class', new Set(cells().slice(0, 12).map((c) => c.className)).size === 1,
    `${new Set(cells().slice(0, 12).map((c) => c.className)).size} distinct in first 12`);
// A revealed cell must differ from a raised one, or depth would be invisible.
const raisedClass = cells()[0].className;
await act(async () => { cells()[40].click(); });
const revealedClass = cells()[40].className;
check('revealed cell styled differently from raised', raisedClass !== revealedClass);

// The check that matters: a gradient passed to `backgroundColor` is silently
// dropped by every browser, leaving the cell transparent. Ask the CSS engine
// directly, which is what actually decides whether a declaration survives.
const probe = (prop) => {
    const el = document.createElement('div');
    el.style[prop] = 'linear-gradient(180deg, #232a33 0%, #1a1f26 100%)';
    return el.style[prop];
};
check('gradient in backgroundColor is dropped (hence backgroundImage)',
    probe('backgroundColor') === '', JSON.stringify(probe('backgroundColor')));
check('gradient in backgroundImage survives', /linear-gradient/.test(probe('backgroundImage')));

// Live region must exist before it has content.
const liveRegion = $('[role="status"][aria-live]');
check('live region is always present', !!liveRegion);
check('live region starts empty', (liveRegion?.textContent || '') === '');

// Reveal (the click already happened above, to compare cell styling)
const revealed = cells().filter((c) => c.textContent.trim() !== '');
check('first click reveals', revealed.length >= 1, `${revealed.length} visible`);
// A safe cell is labelled "clear" or "N adjacent mines", never ", mine".
check('first click is not a mine', !/, mine\b/.test(cells()[40].getAttribute('aria-label') || ''),
    cells()[40].getAttribute('aria-label'));

// Accessible labels
const lbl = cells()[40].getAttribute('aria-label') || '';
check('aria-label describes state', /Row 5 column 5/.test(lbl) && !/hidden/.test(lbl), lbl);

// Flag. Select via the aria-label, which encodes "hidden": a flood-filled
// zero cell is visible but renders no text, so matching on empty textContent
// can pick a revealed cell — and right-clicking one correctly does nothing.
const hidden = cells().find((c) => /hidden/.test(c.getAttribute('aria-label') || ''));
check('found a hidden cell to flag', !!hidden, hidden?.getAttribute('aria-label'));
await act(async () => { hidden.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
check('right click flags', /flagged/.test(hidden.getAttribute('aria-label') || ''),
    hidden.getAttribute('aria-label'));
check('flagged cell stays hidden', hidden.textContent.trim() === '');
check('counter decrements', counter() === '009', `got "${counter()}"`);

// Revealed cells must not react
const alreadyRevealed = cells()[40];
await act(async () => { alreadyRevealed.click(); });
check('revealed cell is inert', alreadyRevealed.getAttribute('aria-label') === lbl, alreadyRevealed.getAttribute('aria-label'));

// Reset
await act(async () => { byText('Reset').click(); });
check('reset restores counter', counter() === '010');
check('reset hides cells', cells().every((c) => c.textContent.trim() === ''));

// Difficulties
for (const [label, n, count] of [['Intermediate', 256, '040'], ['Expert', 480, '099']]) {
    await act(async () => { byText(label).click(); });
    check(`${label} board size`, cells().length === n, `got ${cells().length}`);
    check(`${label} counter ${count}`, counter() === count, `got "${counter()}"`);
}
await act(async () => { byText('Beginner').click(); });
// Switching difficulty starts a new board, so the banner must be empty again.
check('banner clears on new board', ($('[role="status"][aria-live]')?.textContent || '') === '',
    $('[role="status"][aria-live]')?.textContent);

// End of game
for (let i = 0; i < 81; i++) {
    const c = cells()[i];
    if (c.disabled) break;
    await act(async () => { c.click(); });
    if (($('[role="status"][aria-live]')?.textContent || '').length > 0) break;
}
const alert = $('[role="status"][aria-live]')?.textContent || '';
check('game concludes', /Detonated|Field clear/.test(alert), alert);
check('live region now has text', ($('[role="status"][aria-live]')?.textContent || '').length > 0,
    $('[role="status"][aria-live]')?.textContent);

// Assert end-of-game board state here, before the reset below wipes it.
check('all mines revealed', cells().filter((c) => /, mine\b/.test(c.getAttribute('aria-label') || '')).length === 10,
    `${cells().filter((c) => /, mine\b/.test(c.getAttribute('aria-label') || '')).length} found`);
check('input disabled at end', cells().every((c) => c.disabled));

// Keyboard path to flag: 'f' must work, since right-click needs a mouse.
await act(async () => { byText('Reset').click(); });
// Same reason as above: pick a genuinely hidden cell, not an empty-looking one.
const kbTarget = cells().find((c) => /hidden/.test(c.getAttribute('aria-label') || ''));
kbTarget.focus();
await act(async () => {
    kbTarget.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'f', bubbles: true }));
});
check('keyboard f flags a cell', /flagged/.test(kbTarget.getAttribute('aria-label') || ''),
    kbTarget.getAttribute('aria-label'));
check('keyboard flag updates counter', counter() === '009', `got "${counter()}"`);

// Mine counter must be a live region, not a bare div with an ignored label.
check('counter exposes a role', $('#mine-counter')?.getAttribute('role') === 'status',
    `role=${$('#mine-counter')?.getAttribute('role')}`);

// Board must not claim the ARIA grid pattern it doesn't implement.
check('board is a group not a malformed grid',
    !!$('#minefield') && !$('[role="grid"]'));

// Cell size is a CONSTANT, independent of board size. This is the reported
// bug: cells used to shrink on wider boards, so an Expert cell was visibly
// smaller than a Beginner one. Assert the constant and the fit against it,
// using the constants imported from Board.jsx.
const { GAP, BOARD_CHROME, CELL } = await vite.ssrLoadModule('/src/components/Board.jsx');
const CONTAINER_MAX = 1920; // MUI `xl`, set in App.jsx to fit the widest board
const GUTTER = 48;

const boardWidth = (cols) => cols * CELL + (cols - 1) * GAP + BOARD_CHROME;

check('cell size is a constant 30px', CELL === 30, `${CELL}px`);
for (const cols of [9, 16, 30, 40]) {
    check(`board width for ${cols} cols assumes a constant cell`,
        boardWidth(cols) === cols * CELL + (cols - 1) * GAP + BOARD_CHROME,
        `${boardWidth(cols).toFixed(0)}px`);
}

// Every preset must still fit without scrolling on a desktop viewport.
for (const [label, cols] of [['beginner', 9], ['intermediate', 16], ['expert', 30]]) {
    for (const vw of [1920, 1440, 1280, 1200, 1100]) {
        const container = Math.min(vw, CONTAINER_MAX) - GUTTER;
        check(`${label} fits at ${vw}px`, boardWidth(cols) <= container,
            `board ${boardWidth(cols)} vs ${container} available`);
    }
}

// The App container must be wide enough for the widest preset, or the
// constant cell size would trade cell consistency for scrolling.
const appSrc = await (await import('node:fs/promises')).readFile('src/App.jsx', 'utf8');
check('App container is xl', /maxWidth="xl"/.test(appSrc), 'expected maxWidth="xl"');
check('widest preset fits the xl container', boardWidth(30) + GUTTER <= 1920,
    `${boardWidth(30) + GUTTER} <= 1920`);

// Cells must size from the shared variable so tracks and cells agree. The
// rules live in Emotion's sheet, which jsdom does not expose, so read the
// component source instead of guessing.
const boardSrc = await (await import('node:fs/promises')).readFile('src/components/Board.jsx', 'utf8');
const cellSrc = await (await import('node:fs/promises')).readFile('src/components/CellButton.jsx', 'utf8');
// Strip comments before scanning, so prose about old approaches isn't mistaken
// for real code.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
// The cell size must be a plain constant. Any viewport- or container-relative
// unit (vw, cqi, %, clamp, min) means cells would vary with board size again.
check('cell size uses no responsive units', !/(--cell[^\n]*\b(vw|cqi|vh|%)\b)/.test(code(boardSrc)));
check('cell size has no clamp/min/max', !/--cell[^\n]*(clamp|min|max)\(/.test(code(boardSrc)));
check('cells size from the shared variable', /var\(--cell\)/.test(code(cellSrc)));
check('no hardcoded 30px cell width', !/width:\s*30\s*,/.test(cellSrc));

// Chording: a revealed number with matching flags must open its neighbors.
await act(async () => { byText('Reset').click(); });
const chordProbe = new Grid(5, 5, 2, 1);
chordProbe.initialize();
chordProbe.cells[0][0].placeMine();
chordProbe.cells[4][4].placeMine();
chordProbe.countNeighborMines();
chordProbe.minesPlaced = true;
chordProbe.cells[0][1].reveal();
chordProbe.cells[0][0].toggleFlag();
const beforeChord = chordProbe.cells.flat().filter((c) => c.isVisible).length;
chordProbe.chord(0, 1);
const afterChord = chordProbe.cells.flat().filter((c) => c.isVisible).length;
check('chord reveals the remaining neighbors', afterChord > beforeChord, `${beforeChord} -> ${afterChord}`);
check('chord leaves the flagged mine hidden', !chordProbe.cells[0][0].isVisible);
// A second chord on an already-open cell must not reveal anything new.
const afterSecond = chordProbe.cells.flat().filter((c) => c.isVisible).length;
chordProbe.chord(0, 1);
check('repeat chord is a no-op', chordProbe.cells.flat().filter((c) => c.isVisible).length === afterSecond);

await act(async () => { byText('Reset').click(); });
// Chording with the wrong flag count must be a no-op.
const wrong = new Grid(5, 5, 2, 1);
wrong.initialize();
wrong.cells[0][0].placeMine();
wrong.cells[4][4].placeMine();
wrong.countNeighborMines();
wrong.minesPlaced = true;
wrong.cells[0][1].reveal();
const beforeWrong = wrong.cells.flat().filter((c) => c.isVisible).length;
check('chord with no flags does nothing', wrong.chord(0, 1) === undefined
    && wrong.cells.flat().filter((c) => c.isVisible).length === beforeWrong);

// A chordable cell must tell assistive tech the gesture exists. Replay the
// same board as the model probe so a numbered cell is definitely revealed.
const chordUi = new Grid(5, 5, 2, 1);
chordUi.initialize();
chordUi.cells[0][0].placeMine();
chordUi.cells[4][4].placeMine();
chordUi.countNeighborMines();
chordUi.minesPlaced = true;
chordUi.revealCell(0, 1);
check('model exposes a chordable revealed number', chordUi.cells[0][1].isVisible
    && chordUi.cells[0][1].neighborMines === 1);

// Flagging must be reversible: right-clicking a flagged cell removes the flag.
await act(async () => { byText('Reset').click(); });
const target = cells().find((c) => !c.disabled && c.textContent.trim() === '');
const rightClick = (el) => el.dispatchEvent(
    new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
await act(async () => { rightClick(target); });
check('right click flags', counter() === '009', `got "${counter()}"`);
await act(async () => { rightClick(target); });
check('right click again unflags', counter() === '010', `got "${counter()}"`);

// The counter must show a mine glyph beside the number. The icon is a sibling
// inside the counter's parent, so look there rather than at the counter itself.
const counterParent = $('#mine-counter')?.parentElement;
check('mine counter has a mine icon', (counterParent?.querySelectorAll('svg').length ?? 0) >= 1,
    `${counterParent?.querySelectorAll('svg').length} svg beside the counter`);
check('mine icon sits left of the digits',
    counterParent?.firstElementChild?.tagName.toLowerCase() === 'svg');

// --- Detonation marks the whole connected mine cluster ---
// The reported bug: chording detonated one mine while its adjacent mine stayed
// grey, so the board implied the neighbours were safe.
{
    const g = new Grid(5, 5, 4, 1);
    g.initialize();
    [[2, 2], [2, 3]].forEach(([r, c]) => g.cells[r][c].placeMine());
    g.cells[0][0].placeMine();
    g.countNeighborMines();
    g.minesPlaced = true;
    // Flag a safe neighbour and one real mine, so the counts match while the
    // other real mine is left unflagged: the chord opens it.
    g.cells[1][2].reveal();
    g.cells[1][1].toggleFlag();
    g.cells[2][2].toggleFlag();
    g.chord(1, 2);
    check('chording detonates', g.status === 'gameover', g.status);
    check('detonated mine is marked', g.cells[2][3].isExploded);
    check('ADJACENT mine is also marked', g.cells[2][2].isExploded, 'this is the reported bug');
    check('unrelated mine is not marked', !g.cells[0][0].isExploded);
}

// A win marks nothing, and a lone mine marks only itself.
{
    const w = new Grid(2, 2, 1, 1);
    w.revealCell(0, 0);
    check('a win marks no mines as exploded', w.cells.flat().every((c) => !c.isExploded));
}
{
    const s = new Grid(5, 5, 1, 1);
    s.initialize();
    s.cells[2][2].placeMine();
    s.countNeighborMines();
    s.minesPlaced = true;
    s.revealAllMines(2, 2);
    check('a lone mine marks exactly one cell', s.cells.flat().filter((c) => c.isExploded).length === 1);
}
{
    // A chain of touching mines must all be marked.
    const c = new Grid(7, 7, 6, 1);
    c.initialize();
    for (let i = 0; i < 6; i++) c.cells[3][i].placeMine();
    c.countNeighborMines();
    c.minesPlaced = true;
    c.revealAllMines(3, 2);
    check('a chain of 6 marks all 6', c.cells.flat().filter((x) => x.isExploded).length === 6,
        `${c.cells.flat().filter((x) => x.isExploded).length} marked`);
}

// --- Custom difficulty: pure config logic ---
const { resolveCustom, DEFAULT_CUSTOM } = await vite.ssrLoadModule('/src/game/difficulties.js');
check('resolveCustom parses numeric strings',
    resolveCustom({ rows: '12', cols: '14', mineCount: '25' }).rows === 12);
check('resolveCustom falls back on junk input',
    JSON.stringify(resolveCustom({ rows: 'abc', cols: '', mineCount: '' })) === JSON.stringify(DEFAULT_CUSTOM));
check('resolveCustom clamps oversized input',
    resolveCustom({ rows: 999, cols: 999, mineCount: 9999 }).rows === 30);
check('resolveCustom always leaves a safe first cell',
    resolveCustom({ rows: 2, cols: 2, mineCount: 99 }).mineCount === 3,
    `${resolveCustom({ rows: 2, cols: 2, mineCount: 99 }).mineCount}`);
// The mixed case that actually broke: a cleared Mines field fell back to the
// previous 25 without clamping, giving a 2x2 board with more mines than cells.
check('resolveCustom clamps the fallback too',
    resolveCustom({ rows: 2, cols: 2, mineCount: '' }, DEFAULT_CUSTOM).mineCount === 3,
    JSON.stringify(resolveCustom({ rows: 2, cols: 2, mineCount: '' }, DEFAULT_CUSTOM)));
check('custom board minimum is 2x2 (1x1 cannot be won)',
    resolveCustom({ rows: 1, cols: 1, mineCount: 1 }).rows === 2
    && resolveCustom({ rows: 1, cols: 1, mineCount: 1 }).cols === 2,
    JSON.stringify(resolveCustom({ rows: 1, cols: 1, mineCount: 1 })));
check('resolveCustom honours the previous value',
    resolveCustom({}, { rows: 7, cols: 8, mineCount: 9 }).rows === 7);
// No combination of input may produce an unwinnable board.
{
    let allSafe = true;
    for (const rows of [2, 3, 5, 9]) {
        for (const cols of [2, 4, 9]) {
            for (const mc of ['', '0', '1', '999', 'abc', 3]) {
                const r = resolveCustom({ rows, cols, mineCount: mc });
                if (r.mineCount >= r.rows * r.cols) allSafe = false;
            }
        }
    }
    check('no input combination yields a fully-mined board', allSafe);
}

// --- Custom difficulty: the UI ---
check('custom difficulty is offered', $$('button').some((b) => b.textContent.trim() === 'Custom'));
await act(async () => { $$('button').find((b) => b.textContent.trim() === 'Custom').click(); });
check('custom settings appear', /Rows/.test(document.body.textContent) && /Mines/.test(document.body.textContent));
check('custom board uses the default size', cells().length === DEFAULT_CUSTOM.rows * DEFAULT_CUSTOM.cols,
    `${cells().length} cells`);

const numFields = $$('input[type="number"]');
check('three numeric fields exist', numFields.length === 3, `${numFields.length} found`);
const setNative = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
await act(async () => { setNative(numFields[0], '5'); });
await act(async () => { setNative(numFields[1], '6'); });
await act(async () => { setNative(numFields[2], '7'); });
const applyBtn = $$('button').find((b) => b.textContent.trim() === 'Apply');
check('apply is enabled once the draft changes', !!applyBtn && !applyBtn.disabled);
await act(async () => { applyBtn.click(); });
check('custom size applies to the board', cells().length === 30, `${cells().length} cells (expect 5x6)`);
check('custom mine count shows in the counter', counter() === '007', `got "${counter()}"`);

// Switching back to a preset restores a fixed board.
await act(async () => { $$('button').find((b) => b.textContent.trim() === 'Beginner').click(); });
check('preset overrides custom size', cells().length === 81, `${cells().length} cells`);

// --- Timer ---
check('timer renders', !!$('[role="timer"]'), 'no [role=timer] found');
check('timer starts at 0:00', $('[role="timer"]')?.textContent === '0:00', $('[role="timer"]')?.textContent);
check('timer does not run before the first click', $('[role="timer"]')?.textContent === '0:00');
check('timer is labelled', /elapsed time/i.test($('[role="timer"]')?.getAttribute('aria-label') || ''));
check('timer is not a chatty live region', $('[role="timer"]')?.getAttribute('aria-live') === 'off');

const { formatTime } = await vite.ssrLoadModule('/src/hooks/useTimer.js');
check('formatTime(0)', formatTime(0) === '0:00');
check('formatTime(9) pads seconds', formatTime(9) === '0:09');
check('formatTime(65)', formatTime(65) === '1:05');
check('formatTime(600)', formatTime(600) === '10:00');

await act(async () => { cells()[40].click(); });
check('timer still 0:00 right after the first click', $('[role="timer"]')?.textContent === '0:00',
    $('[role="timer"]')?.textContent);

// The reset bug only shows once the clock has actually advanced, so run a fake
// clock whose offset is moved forward between ticks. A constant offset would
// cancel out against a clock started while it was active.
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const advance = async (ms) => {
    offset += ms;
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
};
try {
    // The board is already mid-game from the click above.
    await advance(65_000);
    check('timer advances while playing', $('[role="timer"]')?.textContent === '1:05',
        $('[role="timer"]')?.textContent);

    await act(async () => { byText('Reset').click(); });
    check('reset zeroes an advanced timer', $('[role="timer"]')?.textContent === '0:00',
        `got "${$('[role="timer"]')?.textContent}"`);

    // A new game must start from zero and count again, not inherit the old time.
    await act(async () => { cells()[40].click(); });
    await advance(65_000);
    check('second game advances again', $('[role="timer"]')?.textContent === '1:05',
        $('[role="timer"]')?.textContent);

    // Switching difficulty is a new game too.
    await act(async () => { $$('button').find((b) => b.textContent.trim() === 'Intermediate').click(); });
    check('difficulty switch zeroes the timer', $('[role="timer"]')?.textContent === '0:00',
        `got "${$('[role="timer"]')?.textContent}"`);

    // The clock must stop the moment the game is decided. Play a board out so
    // game over is guaranteed rather than hoping cell 0 is a mine.
    await act(async () => { byText('Reset').click(); });
    await act(async () => { cells()[40].click(); });
    for (let i = 0; i < 256; i++) {
        const c = cells()[i];
        if (c.disabled) break;
        await act(async () => { c.click(); });
        if (($('[role="status"][aria-live]')?.textContent || '').length > 0) break;
    }
    const over = ($('[role="status"][aria-live]')?.textContent || '');
    check('board reached a conclusion for the timer test', over.length > 0, over);
    await advance(5_000);
    const decided = $('[role="timer"]')?.textContent;
    await advance(30_000);
    check('clock stops when the game is decided',
        $('[role="timer"]')?.textContent === decided, `held at ${decided}`);
} finally {
    Date.now = realNow;
}

const real = errors.filter((e) => !/act\(|useLayoutEffect|deprecat/i.test(e));
check('no react warnings', real.length === 0, real.slice(0, 2).join(' | '));

console.log(results.join('\n'));
const passed = results.filter((r) => r.startsWith('PASS')).length;
console.log(`\n${passed}/${results.length} passed`);

root.unmount();
await vite.close();
// Non-zero exit on failure so `npm test` is usable in CI.
process.exit(passed === results.length ? 0 : 1);
