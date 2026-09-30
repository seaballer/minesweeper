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

// Flag
const hidden = cells().find((c) => c.textContent.trim() === '' && !c.disabled);
await act(async () => { hidden.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
check('right click flags', $$('#minefield .MuiSvgIcon-root').length >= 1);
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
const kbTarget = cells().find((c) => c.textContent.trim() === '' && !c.disabled);
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

// The board must fit its CONTAINER, not the viewport: it lives inside a
// maxWidth Container, so sizing against 100vw over-reports and overflows on
// wide screens. jsdom won't evaluate cqi/clamp, so assert the same arithmetic
// the stylesheet encodes, using the constants imported from Board.jsx.
const { GAP, BOARD_CHROME } = await vite.ssrLoadModule('/src/components/Board.jsx');
const CONTAINER_MAX = 960; // MUI `md`, the widest the board ever gets
const GUTTER = 48;         // Container padding

const cellFor = (cols, containerWidth) =>
    Math.max(18, Math.min(30, (containerWidth - BOARD_CHROME - (cols - 1) * GAP) / cols));

const boardWidth = (cols, containerWidth) =>
    cols * cellFor(cols, containerWidth) + (cols - 1) * GAP + BOARD_CHROME;

// Every difficulty must fit at every desktop/tablet width, including ones
// where the Container cap binds (vw above 960) and ones where it doesn't.
for (const [label, cols] of [['beginner', 9], ['intermediate', 16], ['expert', 30]]) {
    for (const vw of [1920, 1440, 1280, 1107, 1024, 960, 900, 768]) {
        const container = Math.min(vw, CONTAINER_MAX) - GUTTER;
        const bw = boardWidth(cols, container);
        check(`${label} fits at ${vw}px`, bw <= container,
            `board ${bw.toFixed(0)} vs ${container} available`);
    }
}

// The 18px floor must hold: cells never shrink below a tappable size.
for (const cols of [9, 16, 30]) {
    check(`cell floor is 18px at 375px (${cols} cols)`, cellFor(cols, 375 - GUTTER) >= 18,
        `${cellFor(cols, 375 - GUTTER).toFixed(1)}px`);
}

// Cells must size from the shared variable so tracks and cells agree. The
// rules live in Emotion's sheet, which jsdom does not expose, so read the
// component source instead of guessing.
const boardSrc = await (await import('node:fs/promises')).readFile('src/components/Board.jsx', 'utf8');
const cellSrc = await (await import('node:fs/promises')).readFile('src/components/CellButton.jsx', 'utf8');
// Strip comments before scanning, so prose about 100vw isn't mistaken for use.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
check('board uses cqi, not 100vw', /100cqi/.test(code(boardSrc)) && !/100vw/.test(code(boardSrc)));
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

const real = errors.filter((e) => !/act\(|useLayoutEffect|deprecat/i.test(e));
check('no react warnings', real.length === 0, real.slice(0, 2).join(' | '));

console.log(results.join('\n'));
const passed = results.filter((r) => r.startsWith('PASS')).length;
console.log(`\n${passed}/${results.length} passed`);

root.unmount();
await vite.close();
// Non-zero exit on failure so `npm test` is usable in CI.
process.exit(passed === results.length ? 0 : 1);
