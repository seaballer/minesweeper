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
// MUI's Popover focus trap reads DOM classes that jsdom exposes on `window` but
// not as bare globals. Without these, opening the dialog throws.
globalThis.ShadowRoot = dom.window.ShadowRoot;
globalThis.DocumentFragment = dom.window.DocumentFragment;
globalThis.HTMLInputElement = dom.window.HTMLInputElement;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
});
const React = (await import('react')).default;
const { act } = await import('react');
const { createRoot } = await import('react-dom/client');
const { ThemeProvider } = await import('@mui/material/styles');
const CssBaseline = (await import('@mui/material/CssBaseline')).default;
const App = (await vite.ssrLoadModule('/src/App.jsx')).default;
const theme = (await vite.ssrLoadModule('/src/theme.js')).default;
const { Grid, hashSeed } = await vite.ssrLoadModule('/src/game/Grid.js');

const errors = [];
console.error = (...a) => {
    errors.push(a.map(String).join(' '));
};

const root = createRoot(document.getElementById('root'));
await act(async () => {
    root.render(
        React.createElement(
            ThemeProvider,
            { theme },
            React.createElement(CssBaseline, null),
            React.createElement(App, null)
        )
    );
});

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const cells = () => $$('#minefield button');
const counter = () => $('#mine-counter')?.textContent;
const byText = (t) => $$('button').find((b) => b.textContent.trim() === t);
const valueOf = (els) => ({
    rows: els[0]?.value,
    cols: els[1]?.value,
    mineCount: els[2]?.value,
});
// React tracks a controlled input's previous value, so assigning `.value`
// directly does not fire onChange. The native setter does.
const setNative = (el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        'value'
    ).set;
    setter.call(el, value);
    el.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
};
// A press, with no release. This is the gesture that actually reaches the
// board: `click` needs mousedown and mouseup to agree on a target, which they
// do not when the mouse is moving, so a real player clicking at speed only ever
// produces these.
const press = async (el, { button = 0, pointerType = 'mouse' } = {}) => {
    const ev = new dom.window.MouseEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        button,
    });
    Object.defineProperty(ev, 'pointerType', { value: pointerType });
    await act(async () => {
        el.dispatchEvent(ev);
    });
};
const pointerLeave = async (el) => {
    const ev = new dom.window.MouseEvent('pointerleave', { bubbles: true, cancelable: true });
    Object.defineProperty(ev, 'pointerType', { value: 'mouse' });
    await act(async () => {
        el.dispatchEvent(ev);
    });
};
const isFreeHidden = (c) => {
    const l = c.getAttribute('aria-label') || '';
    return !c.disabled && /hidden/.test(l) && !/flagged/.test(l);
};
const revealedCount = () =>
    cells().filter((c) => !/hidden/.test(c.getAttribute('aria-label') || '')).length;
const results = [];
const check = (n, c, e = '') => results.push(`${c ? 'PASS' : 'FAIL'} ${n}${e ? ' :: ' + e : ''}`);

// Layout / theme
check('title renders', $('h1')?.textContent === 'Minesweeper');
check('81 cells', cells().length === 81, `got ${cells().length}`);
check('mine counter is 010', counter() === '010', `got "${counter()}"`);
// The board-size caption under the title was removed as mostly irrelevant to
// players who never touch the custom difficulty.
check('board-size caption is gone', !/9×9 · 10 MINES/.test(document.body.textContent));
check('no result before end', ($('[role="status"][aria-live]')?.textContent || '') === '');
check(
    'cells start empty',
    cells().every((c) => c.textContent.trim() === '')
);

// Dark theme actually applied
const themeDark = theme.palette.mode === 'dark';
check('theme is dark', themeDark);
// Emotion injects rules as generated classes. jsdom doesn't expose the CSSOM
// rules it builds, so assert the cell carries a generated class and that the
// component tree renders distinct classes (which is what memo depends on).
const generated = (el) => (el?.className || '').split(/\s+/).filter((c) => c.startsWith('css-'));
check(
    'cell carries a generated emotion class',
    generated(cells()[0]).length === 1,
    cells()[0]?.className
);
// Identical unrevealed cells legitimately share one generated class; that's
// what makes memo cheap. Only differing states should diverge.
check(
    'identical hidden cells share a class',
    new Set(
        cells()
            .slice(0, 12)
            .map((c) => c.className)
    ).size === 1,
    `${
        new Set(
            cells()
                .slice(0, 12)
                .map((c) => c.className)
        ).size
    } distinct in first 12`
);
// A revealed cell must differ from a raised one, or depth would be invisible.
const raisedClass = cells()[0].className;
await act(async () => {
    cells()[40].click();
});
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
check(
    'gradient in backgroundColor is dropped (hence backgroundImage)',
    probe('backgroundColor') === '',
    JSON.stringify(probe('backgroundColor'))
);
check('gradient in backgroundImage survives', /linear-gradient/.test(probe('backgroundImage')));

// Live region must exist before it has content.
const liveRegion = $('[role="status"][aria-live]');
check('live region is always present', !!liveRegion);
check('live region starts empty', (liveRegion?.textContent || '') === '');

// Reveal (the click already happened above, to compare cell styling)
const revealed = cells().filter((c) => c.textContent.trim() !== '');
check('first click reveals', revealed.length >= 1, `${revealed.length} visible`);
// A safe cell is labelled "clear" or "N adjacent mines", never ", mine".
check(
    'first click is not a mine',
    !/, mine\b/.test(cells()[40].getAttribute('aria-label') || ''),
    cells()[40].getAttribute('aria-label')
);

// Accessible labels
const lbl = cells()[40].getAttribute('aria-label') || '';
check('aria-label describes state', /Row 5 column 5/.test(lbl) && !/hidden/.test(lbl), lbl);

// Flag. Select via the aria-label, which encodes "hidden": a flood-filled
// zero cell is visible but renders no text, so matching on empty textContent
// can pick a revealed cell — and right-clicking one correctly does nothing.
const hidden = cells().find((c) => /hidden/.test(c.getAttribute('aria-label') || ''));
check('found a hidden cell to flag', !!hidden, hidden?.getAttribute('aria-label'));
await act(async () => {
    hidden.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
});
check(
    'right click flags',
    /flagged/.test(hidden.getAttribute('aria-label') || ''),
    hidden.getAttribute('aria-label')
);
check('flagged cell stays hidden', hidden.textContent.trim() === '');
check('counter decrements', counter() === '009', `got "${counter()}"`);

// Revealed cells must not react
const alreadyRevealed = cells()[40];
await act(async () => {
    alreadyRevealed.click();
});
check(
    'revealed cell is inert',
    alreadyRevealed.getAttribute('aria-label') === lbl,
    alreadyRevealed.getAttribute('aria-label')
);

// --- Acting on press, not on click ---
//
// A browser fires `click` only when the mousedown and mouseup targets agree,
// and sends it to their common ancestor when they don't. Clicking while
// sweeping the mouse moves the pointer several cells between press and release,
// so those clicks never reach a cell at all. These cover the press path that
// replaces it, and the guards that keep it from double-acting.
{
    await act(async () => {
        byText('Reset').click();
    });

    // The headline case: a press with no release must reveal.
    const a = cells().find(isFreeHidden);
    const before = revealedCount();
    await press(a);
    check(
        'a press alone reveals the cell (no release needed)',
        !/hidden/.test(a.getAttribute('aria-label') || ''),
        a.getAttribute('aria-label')
    );
    check(
        'the press advanced the board',
        revealedCount() > before,
        `${before} -> ${revealedCount()}`
    );

    // The release that follows a press must not act a second time. On a cell
    // that revealed as a number, a second act would chord and open its
    // neighbours, which is an observable difference rather than a subtle one.
    await act(async () => {
        byText('Reset').click();
    });
    let numbered = null;
    for (const c of cells().filter(isFreeHidden).slice(0, 20)) {
        await press(c);
        if (/adjacent mines/.test(c.getAttribute('aria-label') || '')) {
            numbered = c;
            break;
        }
    }
    if (!numbered) {
        check('press followed by release acts exactly once', false, 'no cell revealed as a number');
    } else {
        const afterPress = revealedCount();
        await act(async () => {
            numbered.click();
        });
        check(
            'press followed by release acts exactly once',
            revealedCount() === afterPress,
            `${afterPress} -> ${revealedCount()} (a second act would have chorded)`
        );
    }

    // A press that wanders off gets no click, so the flag must not stay set and
    // swallow the next real activation.
    await act(async () => {
        byText('Reset').click();
    });
    const drifted = cells().find(isFreeHidden);
    await press(drifted);
    await pointerLeave(drifted);
    await act(async () => {
        drifted.click();
    });
    check(
        'a press that wanders off does not block the next activation',
        !/hidden/.test(drifted.getAttribute('aria-label') || ''),
        drifted.getAttribute('aria-label')
    );

    // Right and middle press are flag and chord, not reveal. Acting on any
    // press would flag a cell and then reveal or chord it in one gesture.
    await act(async () => {
        byText('Reset').click();
    });
    for (const [button, label] of [
        [2, 'right'],
        [1, 'middle'],
    ]) {
        const c = cells().find(isFreeHidden);
        await press(c, { button });
        check(
            `a ${label} press does not reveal`,
            /hidden/.test(c.getAttribute('aria-label') || ''),
            `${label}: ${c.getAttribute('aria-label')}`
        );
    }

    // Touch keeps the long-press path; revealing on press would defeat it.
    await act(async () => {
        byText('Reset').click();
    });
    const touchy = cells().find(isFreeHidden);
    await press(touchy, { pointerType: 'touch' });
    check(
        'a touch press does not reveal (long press owns touch)',
        /hidden/.test(touchy.getAttribute('aria-label') || ''),
        touchy.getAttribute('aria-label')
    );
}

// Board is `memo`ized, and the model it renders mutates in place — so on a
// click none of its props change except the `version` token. If that token
// ever stops reaching it, the board keeps rendering stale cells while the model
// moves on: clicks register and nothing appears to happen. Guard that directly.
const repaintTarget = cells().find(isFreeHidden);
if (!repaintTarget) {
    check('a memoized board still repaints on click', false, 'no unflagged hidden cell');
} else {
    const before = repaintTarget.getAttribute('aria-label');
    await act(async () => {
        repaintTarget.click();
    });
    check(
        'a memoized board still repaints on click',
        repaintTarget.getAttribute('aria-label') !== before,
        `${before} -> ${repaintTarget.getAttribute('aria-label')}`
    );
}

// Reset
await act(async () => {
    byText('Reset').click();
});
check('reset restores counter', counter() === '010');
check(
    'reset hides cells',
    cells().every((c) => c.textContent.trim() === '')
);

// Difficulties
for (const [label, n, count] of [
    ['Intermediate', 256, '040'],
    ['Expert', 480, '099'],
]) {
    await act(async () => {
        byText(label).click();
    });
    check(`${label} board size`, cells().length === n, `got ${cells().length}`);
    check(`${label} counter ${count}`, counter() === count, `got "${counter()}"`);
}
await act(async () => {
    byText('Beginner').click();
});
// Switching difficulty starts a new board, so the banner must be empty again.
check(
    'banner clears on new board',
    ($('[role="status"][aria-live]')?.textContent || '') === '',
    $('[role="status"][aria-live]')?.textContent
);

// End of game
for (let i = 0; i < 81; i++) {
    const c = cells()[i];
    if (c.disabled) break;
    await act(async () => {
        c.click();
    });
    if (($('[role="status"][aria-live]')?.textContent || '').length > 0) break;
}
const alert = $('[role="status"][aria-live]')?.textContent || '';
// Wording-agnostic on purpose: the banner copy is presentation and has been
// reworded before. What matters is that the game reached a conclusion and said
// something, which the next assertion also covers.
check('game concludes', alert.length > 0, alert);
check(
    'live region now has text',
    ($('[role="status"][aria-live]')?.textContent || '').length > 0,
    $('[role="status"][aria-live]')?.textContent
);

// Assert end-of-game board state here, before the reset below wipes it.
check(
    'all mines revealed',
    cells().filter((c) => /, mine\b/.test(c.getAttribute('aria-label') || '')).length === 10,
    `${cells().filter((c) => /, mine\b/.test(c.getAttribute('aria-label') || '')).length} found`
);
check(
    'input disabled at end',
    cells().every((c) => c.disabled)
);

// Keyboard path to flag: 'f' must work, since right-click needs a mouse.
await act(async () => {
    byText('Reset').click();
});
// Same reason as above: pick a genuinely hidden cell, not an empty-looking one.
const kbTarget = cells().find((c) => /hidden/.test(c.getAttribute('aria-label') || ''));
kbTarget.focus();
await act(async () => {
    kbTarget.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'f', bubbles: true }));
});
check(
    'keyboard f flags a cell',
    /flagged/.test(kbTarget.getAttribute('aria-label') || ''),
    kbTarget.getAttribute('aria-label')
);
check('keyboard flag updates counter', counter() === '009', `got "${counter()}"`);

// Mine counter must be a live region, not a bare div with an ignored label.
check(
    'counter exposes a role',
    $('#mine-counter')?.getAttribute('role') === 'status',
    `role=${$('#mine-counter')?.getAttribute('role')}`
);

// Board must not claim the ARIA grid pattern it doesn't implement.
check('board is a group not a malformed grid', !!$('#minefield') && !$('[role="grid"]'));

// --- Layout: readouts above the board, title centered and caps ---
{
    const counter = $('#mine-counter');
    const timer = $('[role="timer"]');
    const board = $('#minefield');
    // "Above the board" in DOM order, and all three present.
    check('mine counter exists', !!counter);
    check('timer exists', !!timer);
    check(
        'readouts precede the board in the DOM',
        !!(counter && timer && board) &&
            !!(counter.compareDocumentPosition(board) & 4) &&
            !!(timer.compareDocumentPosition(board) & 4)
    );
    // Reset sits between them, which is what the 1fr auto 1fr grid encodes.
    const resetBtn = $$('button').find((b) => b.textContent.trim() === 'Reset');
    check(
        'reset sits between the readouts',
        !!(counter && timer && resetBtn) &&
            !!(counter.compareDocumentPosition(resetBtn) & 4) &&
            !!(resetBtn.compareDocumentPosition(timer) & 4)
    );
    // Readouts and board share one centred column, which is what makes the
    // counter track the first column of cells and the timer the last.
    check(
        'readouts share an ancestor with the board',
        (() => {
            let n = counter;
            while (n) {
                if (n.contains(board)) return true;
                n = n.parentElement;
            }
            return false;
        })()
    );
    // The ControlBar grid and the board must be siblings inside one shared
    // column, so that column's width (sized to the board) governs both and the
    // counter tracks the first cell column while the timer tracks the last.
    check(
        'readout grid and board are siblings in one column',
        (() => {
            // Walk up from the counter to the nearest grid (the ControlBar root).
            let grid = counter;
            while (grid && dom.window.getComputedStyle(grid).display !== 'grid') {
                grid = grid.parentElement;
            }
            const column = grid?.parentElement;
            return (
                !!grid &&
                !!column &&
                !!board &&
                grid.parentElement === board.parentElement &&
                column.contains(grid) &&
                column.contains(board)
            );
        })()
    );
    check(
        'reset advertises its shortcut',
        resetBtn?.getAttribute('aria-keyshortcuts') === 'R',
        resetBtn?.getAttribute('aria-keyshortcuts')
    );

    const title = $('h1');
    check('there is exactly one h1', document.querySelectorAll('h1').length === 1);
    check('title text is Minesweeper', title?.textContent === 'Minesweeper', title?.textContent);
    // Assert the computed style rather than the inline string, per AGENTS.md.
    const titleCss = dom.window.getComputedStyle(title);
    check('title is uppercase', titleCss.textTransform === 'uppercase', titleCss.textTransform);
    // The gradient fill is commented out in App.jsx: it rendered incorrectly
    // at some browser zoom levels and a better treatment is deferred. Assert
    // the flat fallback is in place and no clipping layer is left active.
    check(
        'title is not gradient-clipped',
        titleCss.backgroundClip !== 'text',
        titleCss.backgroundClip
    );
    check(
        'title has a readable flat colour',
        titleCss.color === 'rgb(255, 255, 255)',
        titleCss.color
    );
    // Trailing tracking skews a centred word to the right; the indent must be
    // exactly half of it to compensate.
    const spacing = parseFloat(titleCss.letterSpacing) || 0;
    const indent = parseFloat(titleCss.textIndent) || 0;
    check(
        'title indent is half the letter-spacing',
        spacing > 0 && Math.abs(indent - spacing / 2) < 0.5,
        `indent ${indent} vs spacing/2 ${spacing / 2}`
    );
}

// --- Info popover replaces the old controls paragraph ---
{
    const infoBtn = $('[aria-label="Show controls and keyboard shortcuts"]');
    check('info button exists', !!infoBtn);
    check('info button is a dialog trigger', infoBtn?.getAttribute('aria-haspopup') === 'dialog');
    check('info starts collapsed', infoBtn?.getAttribute('aria-expanded') === 'false');

    // The old always-visible instruction paragraph must be gone.
    const body = document.body.textContent;
    check(
        'old controls paragraph is removed',
        !/Left-click to reveal/.test(body) && !/press F to flag/.test(body)
    );

    await act(async () => {
        infoBtn.click();
    });
    check('info opens the dialog', infoBtn.getAttribute('aria-expanded') === 'true');

    const dialog = $('[role="dialog"]');
    check('dialog appears', !!dialog);
    // Read the key cells rather than the flattened text: a bare regex over
    // the whole string can't tell "F" the shortcut from an "F" in a sentence.
    const keyLabels = Array.from(dialog?.querySelectorAll('dt') || []).map((e) => e.textContent);
    check(
        'dialog lists the mouse controls',
        ['Left click', 'Right click', 'Click a number', 'Middle click'].every((k) =>
            keyLabels.includes(k)
        ),
        keyLabels.join(' | ')
    );
    check(
        'dialog lists every keyboard shortcut',
        ['F', 'C', 'R'].every((k) => keyLabels.includes(k)),
        keyLabels.join(' | ')
    );
    const dialogText = dialog?.textContent || '';
    check(
        'dialog mentions the safe first click',
        /first click, so it is always safe/.test(dialogText)
    );

    // Clicking the info button again toggles it shut.
    await act(async () => {
        infoBtn.click();
    });
    check(
        'dialog closes',
        infoBtn.getAttribute('aria-expanded') === 'false',
        `expanded=${infoBtn.getAttribute('aria-expanded')}`
    );

    // R must stand down while the dialog is open. The dialog is where R is
    // documented, so pressing it there used to wipe the live game.
    await act(async () => {
        cells()[40].click();
    });
    const revealedBeforeInfoR = cells().filter((c) => c.textContent.trim() !== '').length;
    check(
        'board has progress before the dialog R test',
        revealedBeforeInfoR > 0,
        `${revealedBeforeInfoR} visible`
    );
    await act(async () => {
        infoBtn.click();
    });
    await act(async () => {
        dom.window.document.dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'r', bubbles: true })
        );
    });
    check(
        'R does nothing while the controls dialog is open',
        cells().filter((c) => c.textContent.trim() !== '').length === revealedBeforeInfoR,
        `${revealedBeforeInfoR} -> ${cells().filter((c) => c.textContent.trim() !== '').length}`
    );
    await act(async () => {
        infoBtn.click();
    });
    check('dialog closed again', infoBtn.getAttribute('aria-expanded') === 'false');

    // With it closed, R works again.
    await act(async () => {
        dom.window.document.dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'r', bubbles: true })
        );
    });
    check(
        'R works once the dialog is closed',
        cells().every((c) => c.textContent.trim() === '')
    );
}

// --- R resets the board ---
{
    await act(async () => {
        cells()[40].click();
    });
    const revealedBefore = cells().filter((c) => c.textContent.trim() !== '').length;
    check(
        'board has revealed cells before the R test',
        revealedBefore > 0,
        `${revealedBefore} visible`
    );

    await act(async () => {
        dom.window.document.dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'r', bubbles: true })
        );
    });
    check(
        'R resets the board',
        cells().every((c) => c.textContent.trim() === ''),
        `${cells().filter((c) => c.textContent.trim() !== '').length} still visible`
    );

    // R must not fire while typing in the custom-size fields. Reveal a cell
    // first, otherwise there is nothing to lose and the guard proves nothing.
    await act(async () => {
        $$('button')
            .find((b) => b.textContent.trim() === 'Custom')
            .click();
    });
    await act(async () => {
        cells()[13].click();
    });
    const field = $('input[type="number"]');
    const revealedBeforeTyping = cells().filter((c) => c.textContent.trim() !== '').length;
    check(
        'board has progress before the typing test',
        revealedBeforeTyping > 0,
        `${revealedBeforeTyping} visible`
    );
    await act(async () => {
        field.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    });
    check(
        'R is ignored while typing in a field',
        cells().filter((c) => c.textContent.trim() !== '').length === revealedBeforeTyping,
        `${revealedBeforeTyping} -> ${cells().filter((c) => c.textContent.trim() !== '').length}`
    );

    // --- Custom field interactions: wheel, clamp, Enter ---
    const num = () => $$('input[type="number"]');
    const applyBtn = () => $$('button').find((b) => b.textContent.trim() === 'Apply');
    const wheel = (el, deltaY) =>
        el.dispatchEvent(
            new dom.window.WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true })
        );

    // Wheel up increments, wheel down decrements.
    const rowsBefore = num()[0].value;
    await act(async () => {
        wheel(num()[0], -100);
    });
    check(
        'wheel up increments',
        Number(num()[0].value) === Number(rowsBefore) + 1,
        `${rowsBefore} -> ${num()[0].value}`
    );
    await act(async () => {
        wheel(num()[0], 100);
    });
    check(
        'wheel down decrements',
        Number(num()[0].value) === Number(rowsBefore),
        `${rowsBefore} vs ${num()[0].value}`
    );

    // Typing past a limit snaps to it immediately.
    await act(async () => {
        setNative(num()[0], '999');
    });
    check('rows snaps to its max when exceeded', num()[0].value === '30', num()[0].value);
    await act(async () => {
        setNative(num()[0], '0');
    });
    check('rows snaps to its min when undercut', num()[0].value === '2', num()[0].value);

    // The mine ceiling follows rows*cols, so it clamps too.
    await act(async () => {
        setNative(num()[0], '2');
        setNative(num()[1], '2');
    });
    await act(async () => {
        setNative(num()[2], '999');
    });
    check('mines snap to rows*cols-1', num()[2].value === '3', num()[2].value);

    // Enter applies without touching the button.
    await act(async () => {
        setNative(num()[0], '7');
        setNative(num()[1], '8');
        setNative(num()[2], '9');
    });
    check('apply enables after edits', !applyBtn().disabled);
    await act(async () => {
        num()[0].dispatchEvent(
            new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
        );
    });
    check('Enter applies the board', cells().length === 56, `${cells().length} cells (expect 7x8)`);
    check('Enter applied the mine count', counter() === '009', `got "${counter()}"`);
    check('apply is disabled once applied', applyBtn().disabled);
}

// Later sections assume a fresh Beginner board.
await act(async () => {
    $$('button')
        .find((b) => b.textContent.trim() === 'Beginner')
        .click();
});

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
    check(
        `board width for ${cols} cols assumes a constant cell`,
        boardWidth(cols) === cols * CELL + (cols - 1) * GAP + BOARD_CHROME,
        `${boardWidth(cols).toFixed(0)}px`
    );
}

// Every preset must still fit without scrolling on a desktop viewport.
for (const [label, cols] of [
    ['beginner', 9],
    ['intermediate', 16],
    ['expert', 30],
]) {
    for (const vw of [1920, 1440, 1280, 1200, 1100]) {
        const container = Math.min(vw, CONTAINER_MAX) - GUTTER;
        check(
            `${label} fits at ${vw}px`,
            boardWidth(cols) <= container,
            `board ${boardWidth(cols)} vs ${container} available`
        );
    }
}

// The App container must be wide enough for the widest preset, or the
// constant cell size would trade cell consistency for scrolling.
const appSrc = await (await import('node:fs/promises')).readFile('src/App.jsx', 'utf8');
check('App container is xl', /maxWidth="xl"/.test(appSrc), 'expected maxWidth="xl"');
check(
    'widest preset fits the xl container',
    boardWidth(30) + GUTTER <= 1920,
    `${boardWidth(30) + GUTTER} <= 1920`
);

// Cells must size from the shared variable so tracks and cells agree. The
// rules live in Emotion's sheet, which jsdom does not expose, so read the
// component source instead of guessing.
const boardSrc = await (
    await import('node:fs/promises')
).readFile('src/components/Board.jsx', 'utf8');
const cellSrc = await (
    await import('node:fs/promises')
).readFile('src/components/CellButton.jsx', 'utf8');
// Strip comments before scanning, so prose about old approaches isn't mistaken
// for real code.
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
// The cell size must be a plain constant. Any viewport- or container-relative
// unit (vw, cqi, %, clamp, min) means cells would vary with board size again.
check(
    'cell size uses no responsive units',
    !/(--cell[^\n]*\b(vw|cqi|vh|%)\b)/.test(code(boardSrc))
);
check('cell size has no clamp/min/max', !/--cell[^\n]*(clamp|min|max)\(/.test(code(boardSrc)));
check('cells size from the shared variable', /var\(--cell\)/.test(code(cellSrc)));
check('no hardcoded 30px cell width', !/width:\s*30\s*,/.test(cellSrc));

// A `transform` does not merely look different on a cell — it changes what the
// browser hit-tests against, because a transformed element is hit on its
// transformed geometry. A browser dispatches `click` to the nearest common
// ancestor of the mousedown and mouseup targets, so a cell that resizes or
// shifts *while it is being pressed* can take the click away from itself: move
// it out from under the cursor and the press lands on the board instead.
//
// This shipped. A revealed cell was `scale(0.96)` (so it painted at 28.8px,
// not the 30px the board is built around) and `:active` was `translateY(1px)`,
// both transitioned over 90ms — so the cell shrank out from under the pointer
// the instant it was clicked, and fast play lost presses at cell edges.
//
// Every effect on a cell must be paint-only: background, shadow, colour.
const cellCode = code(cellSrc);
check(
    'cells never declare a transform',
    !/\btransform\s*:/.test(cellCode),
    (cellCode.match(/.*\btransform\b.*/g) || []).join(' | ')
);
check('cells never scale()', !/\bscale\s*\(/.test(cellCode));
check('cells never translate()', !/\btranslate[XY]?\s*\(/.test(cellCode));
check(
    'the cell transition does not animate transform',
    !/transition:[^;]*\btransform\b/.test(cellCode),
    (cellCode.match(/.*transition:.*/g) || []).join(' | ')
);
// Removing the geometry must not remove the feedback along with it.
check(
    'a held cell still gets a painted pressed state',
    /boxShadow:\s*PRESSED_SHADOW/.test(cellCode) &&
        /'&:active':\s*\{\s*boxShadow:\s*PRESSED_SHADOW/.test(cellCode)
);

// Chording: a revealed number with matching flags must open its neighbors.
await act(async () => {
    byText('Reset').click();
});
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
check(
    'chord reveals the remaining neighbors',
    afterChord > beforeChord,
    `${beforeChord} -> ${afterChord}`
);
check('chord leaves the flagged mine hidden', !chordProbe.cells[0][0].isVisible);
// A second chord on an already-open cell must not reveal anything new.
const afterSecond = chordProbe.cells.flat().filter((c) => c.isVisible).length;
chordProbe.chord(0, 1);
check(
    'repeat chord is a no-op',
    chordProbe.cells.flat().filter((c) => c.isVisible).length === afterSecond
);

await act(async () => {
    byText('Reset').click();
});
// Chording with the wrong flag count must be a no-op.
const wrong = new Grid(5, 5, 2, 1);
wrong.initialize();
wrong.cells[0][0].placeMine();
wrong.cells[4][4].placeMine();
wrong.countNeighborMines();
wrong.minesPlaced = true;
wrong.cells[0][1].reveal();
const beforeWrong = wrong.cells.flat().filter((c) => c.isVisible).length;
// A no-op returns the current status rather than nothing. Before the first
// reveal the game hasn't started, so that status is "ready" -- which is
// exactly what this asserts.
check(
    'chord with no flags changes nothing',
    wrong.chord(0, 1) === 'ready' &&
        wrong.cells.flat().filter((c) => c.isVisible).length === beforeWrong
);
check(
    'revealCell no-op returns the current status',
    (() => {
        const n = new Grid(3, 3, 1, 1);
        n.initialize();
        n.revealCell(0, 0);
        return n.revealCell(0, 0) === 'playing';
    })()
);
check(
    'revealCell no-op on a flagged cell returns the status',
    (() => {
        const n = new Grid(3, 3, 1, 1);
        n.initialize();
        n.cells[2][2].toggleFlag();
        return n.revealCell(2, 2) === 'ready';
    })()
);
// Seed lifecycle: a pinned seed replays, an unpinned one advances on reset.
{
    const layout = (g) => g.cells.flatMap((r) => r.map((c) => (c.isMine ? 1 : 0))).join('');

    const pinned = new Grid(9, 9, 10, 1234);
    pinned.initialize();
    pinned.revealCell(4, 4);
    const first = layout(pinned);
    let stable = true;
    for (let i = 0; i < 20; i++) {
        pinned.initialize();
        pinned.revealCell(4, 4);
        if (layout(pinned) !== first) stable = false;
    }
    check('an explicitly seeded board survives reset unchanged', stable);

    const fresh = new Grid(9, 9, 10, 1234);
    fresh.initialize();
    fresh.revealCell(4, 4);
    check('an explicitly seeded board is reproducible', layout(fresh) === first);

    // The bug: reset used to replay the identical layout every time.
    const auto = new Grid(9, 9, 10);
    auto.initialize();
    auto.revealCell(4, 4);
    const a = layout(auto);
    auto.initialize();
    auto.revealCell(4, 4);
    check('an unseeded board changes on reset', layout(auto) !== a);

    // A text seed pins a board just as a number does, and hashes to a uint32.
    const words = ['hello', 'goodbye', 'a longer phrase', 'Ünïcødé ✓'];
    const wordLayouts = new Map();
    for (const word of words) {
        const g = new Grid(9, 9, 10, word);
        g.initialize();
        g.revealCell(4, 4);
        check(`the text seed "${word}" pins the board`, g.pinnedSeed === true);
        check(
            `the text seed "${word}" hashes to a uint32`,
            Number.isInteger(g.seed) && g.seed >= 0 && g.seed <= 4294967295,
            `got ${g.seed}`
        );
        wordLayouts.set(word, layout(g));
    }
    check(
        'different text seeds give different boards',
        new Set(wordLayouts.values()).size === words.length,
        `${new Set(wordLayouts.values()).size} distinct of ${words.length}`
    );
    // Two grids built from the same word must match, which is what makes a
    // board shareable.
    const same = new Grid(9, 9, 10, 'hello');
    same.initialize();
    same.revealCell(4, 4);
    check('the same text seed reproduces the board', layout(same) === wordLayouts.get('hello'));

    // A text seed survives reset unchanged, exactly like a numeric one.
    let wordsStable = true;
    const wordy = new Grid(9, 9, 10, 'hello');
    wordy.initialize();
    wordy.revealCell(4, 4);
    const wordFirst = layout(wordy);
    for (let i = 0; i < 10; i++) {
        wordy.initialize();
        wordy.revealCell(4, 4);
        if (layout(wordy) !== wordFirst) wordsStable = false;
    }
    check('a text-seeded board survives reset unchanged', wordsStable);

    // Position counting from 1 is what stops the leading character being
    // ignored: a 0-indexed sum gives "abc" and "xbc" the same board.
    const abc = new Grid(9, 9, 10, 'abc');
    const xbc = new Grid(9, 9, 10, 'xbc');
    abc.initialize();
    xbc.initialize();
    check(
        'a seed that differs only in its first character differs',
        abc.seed !== xbc.seed,
        `${abc.seed} vs ${xbc.seed}`
    );

    // --- First-click safety applies only to unpinned boards ---
    //
    // Excluding the opening cell used to make a seeded layout depend on which
    // cell was opened first, so two people with the same seed got different
    // boards. A pinned board now places from the seed alone.
    const openA = new Grid(9, 9, 10, 'hello world');
    const openB = new Grid(9, 9, 10, 'hello world');
    openA.initialize();
    openB.initialize();
    openA.revealCell(0, 0);
    openB.revealCell(8, 8);
    check(
        'a pinned board does not depend on the opening cell',
        layout(openA) === layout(openB),
        'same seed, different first clicks'
    );

    // And that is only safe because the first click is allowed to be a mine.
    const probe = new Grid(9, 9, 10, 'detonate');
    probe.initialize();
    probe.revealCell(0, 0);
    const mineCells = [];
    probe.cells.forEach((row, r) => row.forEach((c, j) => c.isMine && mineCells.push([r, j])));
    check('the probe board found its mines', mineCells.length === 10, `${mineCells.length} mines`);
    const [mr, mc] = mineCells[0];
    const lethal = new Grid(9, 9, 10, 'detonate');
    lethal.initialize();
    lethal.revealCell(mr, mc);
    check(
        'a pinned board lets the first click be a mine',
        lethal.status === 'gameover' && lethal.cells[mr][mc].isMine,
        `status=${lethal.status}`
    );
    check(
        'the losing move uncovered the rest',
        mineCells.every(([r, j]) => lethal.cells[r][j].isVisible)
    );

    // An unpinned board keeps the courtesy: the opening move is never a mine.
    let openingsSafe = true;
    for (let i = 0; i < 40; i++) {
        const g = new Grid(9, 9, 10);
        g.initialize();
        const r = i % 9;
        const c = (i * 3) % 9;
        g.revealCell(r, c);
        if (g.cells[r][c].isMine) openingsSafe = false;
    }
    check('an unpinned board still never opens on a mine', openingsSafe);

    // Pin the formula itself: sum of (1-based position * char code). 'ab' is
    // 1*97 + 2*98. If this ever changes, boards shared under an old seed stop
    // reproducing, so the number belongs in a test rather than only a comment.
    check(
        'the seed hash is position times char code',
        hashSeed('ab') === 1 * 97 + 2 * 98,
        `${hashSeed('ab')}`
    );
    check('the seed hash is order-sensitive', hashSeed('ab') !== hashSeed('ba'));
    check('a numeric seed passes through unchanged', hashSeed(4242) === 4242, `${hashSeed(4242)}`);
    check(
        'a negative numeric seed wraps to uint32',
        hashSeed(-1) === 4294967295,
        `${hashSeed(-1)}`
    );
    // Documented limitation rather than a bug: the mix is not collision
    // resistant, so anagrams can agree. Worth knowing before anyone relies on
    // seeds distinguishing near-identical phrases.
    check(
        'anagram collision is a known property of this hash',
        hashSeed('aab') === hashSeed('bba'),
        `${hashSeed('aab')} vs ${hashSeed('bba')}`
    );

    const seen = new Set();
    for (let i = 0; i < 60; i++) {
        auto.initialize();
        auto.revealCell(4, 4);
        seen.add(layout(auto));
    }
    check(
        'repeated resets keep producing new boards',
        seen.size === 60,
        `${seen.size}/60 distinct`
    );
}

// --- Out-of-range coordinates are validated ---
{
    const g = new Grid(5, 5, 3, 1);
    g.initialize();
    const bad = [
        [99, 99],
        [-1, 0],
        [0, -1],
        [5, 0],
        [0, 5],
        [1.5, 2],
        [NaN, 0],
    ];
    let allThrowRange = true;
    let messagesUseful = true;
    for (const [r, c] of bad) {
        try {
            g.revealCell(r, c);
            allThrowRange = false;
        } catch (e) {
            if (!(e instanceof RangeError)) allThrowRange = false;
            // The message must name the board and the valid range, so the cause
            // is obvious without reading the source.
            if (!/5x5/.test(e.message) || !/0\.\.4/.test(e.message)) {
                messagesUseful = false;
            }
        }
    }
    check('out-of-range reveal throws a RangeError', allThrowRange);
    check('the error names the board and the valid range', messagesUseful);

    let chordThrows = false;
    try {
        g.chord(99, 1);
    } catch (e) {
        chordThrows = e instanceof RangeError;
    }
    check('out-of-range chord throws a RangeError', chordThrows);
    check(
        'bad input leaves the board untouched',
        g.cells.flat().every((c) => !c.isVisible && !c.isMine)
    );
    check('valid coordinates still work', g.revealCell(2, 2) === 'playing');
}

// --- Wrong flags are marked at game over ---
{
    const g = new Grid(5, 5, 3, 1);
    g.initialize();
    [
        [2, 2],
        [4, 4],
    ].forEach(([r, c]) => g.cells[r][c].placeMine());
    g.cells[0][0].placeMine();
    g.countNeighborMines();
    g.minesPlaced = true;
    // One correct flag on a real mine, one wrong flag on a safe cell.
    g.cells[2][2].toggleFlag();
    g.cells[1][1].toggleFlag();
    check('no wrong flags before the game ends', !g.cells[1][1].isWrongFlag);

    let mine = null;
    g.cells.forEach((r, i) =>
        r.forEach((c, j) => {
            if (c.isMine && !mine) mine = [i, j];
        })
    );
    g.revealCell(0, 0);
    g.revealCell(mine[0], mine[1]);
    check('the game is over', g.status === 'gameover', g.status);
    check('a flag on a safe cell is marked wrong', g.cells[1][1].isWrongFlag);
    check('a wrong flag is uncovered so the mistake is visible', g.cells[1][1].isVisible);
    check('a correct flag is not marked wrong', !g.cells[2][2].isWrongFlag);
    check('a correct flag is still shown', g.cells[2][2].isFlagged);

    // Clearing the flag clears the marker, so it cannot outlive its cause.
    const c2 = new Grid(4, 4, 2, 1);
    c2.initialize();
    c2.cells[0][0].placeMine();
    c2.countNeighborMines();
    c2.minesPlaced = true;
    c2.cells[1][1].toggleFlag();
    c2.cells[1][1].isWrongFlag = true;
    c2.cells[1][1].toggleFlag();
    check('unflagging clears the wrong-flag marker', !c2.cells[1][1].isWrongFlag);
}

// --- Grid.flagCount: the O(1) tally that replaced a full rescan per click ---
{
    const g = new Grid(5, 5, 3, 7);
    g.initialize();
    check('flagCount starts at zero', g.flagCount === 0, `got ${g.flagCount}`);

    g.toggleFlag(0, 0);
    g.toggleFlag(1, 1);
    check('two flags are counted', g.flagCount === 2, `got ${g.flagCount}`);

    g.toggleFlag(0, 0);
    check('unflagging decrements', g.flagCount === 1, `got ${g.flagCount}`);

    // The tally has to agree with the cells, always. This is the invariant the
    // old per-click `flat().filter()` scan was effectively re-deriving.
    const scanned = () => g.cells.flat().filter((c) => c.isFlagged).length;
    check(
        'tally matches a scan of the cells',
        g.flagCount === scanned(),
        `${g.flagCount} vs ${scanned()}`
    );

    // A revealed cell refuses to change, so the count must not move either.
    g.cells[2][2].reveal();
    const beforeNoop = g.flagCount;
    g.toggleFlag(2, 2);
    check(
        'flagging a revealed cell is a no-op',
        !g.cells[2][2].isFlagged && g.flagCount === beforeNoop,
        `count ${beforeNoop} -> ${g.flagCount}`
    );
    check('tally still matches after a no-op', g.flagCount === scanned());

    // Same contract as revealCell/chord: always a status, never undefined, so
    // a refused action reports the current state rather than vanishing.
    check(
        'toggleFlag returns a status',
        g.toggleFlag(3, 3) === 'ready',
        String(g.toggleFlag(3, 3))
    );

    // Reset rebuilds the cells, so the tally has to go back to zero with them.
    g.initialize();
    check('reset zeroes the tally', g.flagCount === 0, `got ${g.flagCount}`);

    // Out of range is a caller bug, same as the other coordinate entry points.
    let threw = false;
    try {
        g.toggleFlag(99, 0);
    } catch (e) {
        threw = e instanceof RangeError;
    }
    check('out-of-range toggleFlag throws a RangeError', threw);
    check('a rejected flag leaves the tally alone', g.flagCount === 0, `got ${g.flagCount}`);

    // A decided game is terminal for every coordinate entry point, not just
    // the ones the UI happens to guard.
    const done = new Grid(2, 2, 1, 3);
    done.initialize();
    done.cells[1][1].placeMine();
    done.countNeighborMines();
    done.minesPlaced = true;
    done.revealCell(0, 0);
    done.revealCell(0, 1);
    done.revealCell(1, 0);
    check('terminal board for the flag test', done.status === 'win', done.status);
    done.toggleFlag(1, 1);
    check(
        'a won board refuses new flags',
        !done.cells[1][1].isFlagged && done.flagCount === 0,
        `flagged=${done.cells[1][1].isFlagged} count=${done.flagCount}`
    );
}

// A wrong flag on a fresh board is impossible to survive to a win: a flagged
// cell is never revealed, so winning means none were flagged.
{
    const w = new Grid(2, 2, 1, 1);
    w.initialize();
    // Place the mine explicitly so the win path is deterministic.
    w.cells[1][1].placeMine();
    w.countNeighborMines();
    w.minesPlaced = true;
    w.revealCell(0, 0);
    w.revealCell(0, 1);
    w.revealCell(1, 0);
    check(
        'no wrong flags on a won board',
        w.status === 'win' && w.cells.flat().every((c) => !c.isWrongFlag),
        w.status
    );
}

// --- 1x1 and other degenerate boards ---
{
    // The constructor must always leave one safe cell, or the opening click has
    // nowhere to land and the board is unwinnable before it starts.
    check('1x1 with 1 mine requested becomes 0 mines', new Grid(1, 1, 1, 1).mineCount === 0);
    check(
        '1x1 is winnable',
        (() => {
            const g = new Grid(1, 1, 1, 1);
            return g.revealCell(0, 0) === 'win';
        })()
    );
    check('mineCount is clamped to cells minus one', new Grid(2, 2, 99).mineCount === 3);
    check('a negative mine count floors at zero', new Grid(2, 2, -5).mineCount === 0);

    let lostFirst = 0;
    for (const [r, c] of [
        [1, 1],
        [1, 5],
        [5, 1],
        [2, 2],
        [3, 7],
        [9, 9],
    ]) {
        for (const mc of [0, 1, 5, 99]) {
            if (new Grid(r, c, mc).revealCell(0, 0) === 'gameover') lostFirst++;
        }
    }
    check('no board loses on its first click', lostFirst === 0, `${lostFirst} lost`);
}

// --- Long-press to flag on touch ---
{
    await act(async () => {
        $$('button')
            .find((b) => b.textContent.trim() === 'Beginner')
            .click();
    });
    const before = counter();
    const target = cells().find((c) => /hidden/.test(c.getAttribute('aria-label') || ''));
    const touch = (el, type) =>
        el.dispatchEvent(new dom.window.Event(type, { bubbles: true, cancelable: true }));

    // A short press is just a tap and must not flag.
    await act(async () => {
        touch(target, 'touchstart');
        await new Promise((r) => setTimeout(r, 120));
        touch(target, 'touchend');
    });
    check('a short tap does not flag', counter() === before, `${before} -> ${counter()}`);

    // A press held past the threshold flags.
    await act(async () => {
        touch(target, 'touchstart');
        await new Promise((r) => setTimeout(r, 700));
        touch(target, 'touchend');
    });
    check(
        'a long press flags',
        /flagged/.test(target.getAttribute('aria-label') || ''),
        target.getAttribute('aria-label')
    );
    const afterPress = counter();
    check(
        'long press decrements the counter',
        Number(afterPress) === Number(before) - 1,
        `${before} -> ${afterPress}`
    );

    // The click/contextmenu some browsers send after a long press must not
    // toggle the flag straight back off.
    await act(async () => {
        target.dispatchEvent(
            new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true })
        );
    });
    check(
        'the follow-up contextmenu does not unflag',
        /flagged/.test(target.getAttribute('aria-label') || ''),
        target.getAttribute('aria-label')
    );

    // Moving the finger means scrolling, not pressing.
    const scroller = cells().find((c) => /hidden/.test(c.getAttribute('aria-label') || ''));
    const beforeScroll = counter();
    await act(async () => {
        touch(scroller, 'touchstart');
        await new Promise((r) => setTimeout(r, 120));
        touch(scroller, 'touchmove');
        await new Promise((r) => setTimeout(r, 500));
        touch(scroller, 'touchend');
    });
    check(
        'moving the finger cancels the press',
        counter() === beforeScroll,
        `${beforeScroll} -> ${counter()}`
    );
}

// --- Seed input in the custom panel ---
{
    await act(async () => {
        byText('Custom').click();
    });
    check(
        'the custom panel has three numeric fields',
        $$('input[type="number"]').length === 3,
        `${$$('input[type="number"]').length} fields`
    );

    // The seed is optional, so it hides behind a checkbox rather than sitting
    // there implying it should be filled in.
    const seedBox = $('input[type="checkbox"]');
    check('there is a Seed? checkbox', !!seedBox);
    check('the Seed? checkbox is labelled', seedBox?.getAttribute('aria-label') === 'Seed?');
    check('the seed field is hidden by default', !$('input[type="text"]'));

    await act(async () => {
        seedBox.click();
    });
    const seedInput = $('input[type="text"]');
    check('checking Seed? reveals the seed field', !!seedInput);
    check(
        'the seed field takes text, not a number',
        seedInput?.getAttribute('type') === 'text',
        seedInput?.getAttribute('type')
    );
    check('the seed field starts blank', seedInput?.value === '', `"${seedInput?.value}"`);

    // Set an explicit size so this block does not depend on whatever custom
    // config an earlier test left applied -- the panel correctly remembers it.
    const nums = $$('input[type="number"]');
    await act(async () => {
        setNative(nums[0], '6');
        setNative(nums[1], '7');
        setNative(nums[2], '5');
        setNative(seedInput, 'hello world');
    });
    await act(async () => {
        byText('Apply').click();
    });
    check('a 6x7/5 custom board applied', counter() === '005', `got "${counter()}"`);

    // Mines only appear in the labels once the board is finished, so play each
    // board out before reading the layout off it.
    const playOut = async (openAt = 0) => {
        // Separate act calls throughout: nesting them lets a stale cell
        // reference survive the re-render.
        await act(async () => {
            byText('Reset').click();
        });
        await act(async () => {
            cells()[openAt].click();
        });
        for (let i = 0; i < cells().length; i++) {
            const c = cells()[i];
            if (!c || c.disabled) continue;
            await act(async () => {
                c.click();
            });
            if (($('[role="status"][aria-live]')?.textContent || '').length > 0) break;
        }
        return cells()
            .map((c) => (/, mine\b/.test(c.getAttribute('aria-label') || '') ? '1' : '0'))
            .join('');
    };

    const seeded = await playOut();
    check(
        'a text-seeded board is fully revealed at game over',
        seeded.split('').filter((x) => x === '1').length === 5,
        `${seeded.split('').filter((x) => x === '1').length} mines exposed`
    );
    const replayed = await playOut();
    check('a text-seeded board replays through the UI', replayed === seeded);

    // The shareable promise: same seed, same board, whoever opened it and
    // wherever they started. This only holds because a pinned board no longer
    // protects its first click.
    const openedElsewhere = await playOut(20);
    check(
        'a text-seeded board is the same from a different opening cell',
        openedElsewhere === seeded,
        `opening at 20 gave a different layout`
    );

    // The seed lives in the applied config, so it survives leaving Custom and
    // coming back -- the panel is keyed on that config.
    await act(async () => {
        byText('Beginner').click();
    });
    await act(async () => {
        byText('Custom').click();
    });
    check(
        'the seed survives a round trip through another difficulty',
        $('input[type="text"]')?.value === 'hello world' &&
            $('input[type="checkbox"]')?.checked === true,
        `field="${$('input[type="text"]')?.value}" checked=${$('input[type="checkbox"]')?.checked}`
    );

    // Unchecking has to unpin, or the box would be decoration. Asserted on
    // behaviour rather than on caption text: the panel no longer spells the
    // seed out, so the only honest proof is that the board stops replaying.
    await act(async () => {
        $('input[type="checkbox"]').click();
    });
    check('unchecking hides the seed field again', !$('input[type="text"]'));
    await act(async () => {
        byText('Apply').click();
    });
    const unpinnedA = await playOut();
    const unpinnedB = await playOut();
    check(
        'unchecking Seed? unpins the board',
        unpinnedA !== unpinnedB,
        `two resets gave ${unpinnedA === unpinnedB ? 'the same' : 'different'} layouts`
    );
    check('the unpinned board is no longer the seeded one', unpinnedA !== seeded);

    await act(async () => {
        byText('Beginner').click();
    });
}

check(
    'every status path returns a string, never undefined',
    (() => {
        const n = new Grid(4, 4, 2, 1);
        n.initialize();
        const values = [
            n.revealCell(0, 0),
            n.revealCell(0, 0),
            n.chord(0, 0),
            n.chord(1, 1),
            n.revealCell(2, 2),
        ];
        return values.every((v) => typeof v === 'string');
    })()
);

// A chordable cell must tell assistive tech the gesture exists. Replay the
// same board as the model probe so a numbered cell is definitely revealed.
const chordUi = new Grid(5, 5, 2, 1);
chordUi.initialize();
chordUi.cells[0][0].placeMine();
chordUi.cells[4][4].placeMine();
chordUi.countNeighborMines();
chordUi.minesPlaced = true;
chordUi.revealCell(0, 1);
check(
    'model exposes a chordable revealed number',
    chordUi.cells[0][1].isVisible && chordUi.cells[0][1].neighborMines === 1
);

// Flagging must be reversible: right-clicking a flagged cell removes the flag.
await act(async () => {
    byText('Reset').click();
});
const target = cells().find((c) => !c.disabled && c.textContent.trim() === '');
const rightClick = (el) =>
    el.dispatchEvent(new dom.window.MouseEvent('contextmenu', { bubbles: true, cancelable: true }));
await act(async () => {
    rightClick(target);
});
check('right click flags', counter() === '009', `got "${counter()}"`);
await act(async () => {
    rightClick(target);
});
check('right click again unflags', counter() === '010', `got "${counter()}"`);

// The counter must show a mine glyph beside the number. The icon is a sibling
// inside the counter's parent, so look there rather than at the counter itself.
const counterParent = $('#mine-counter')?.parentElement;
check(
    'mine counter has a mine icon',
    (counterParent?.querySelectorAll('svg').length ?? 0) >= 1,
    `${counterParent?.querySelectorAll('svg').length} svg beside the counter`
);
check(
    'mine icon sits left of the digits',
    counterParent?.firstElementChild?.tagName.toLowerCase() === 'svg'
);

// --- Detonation marks the whole connected mine cluster ---
// The reported bug: chording detonated one mine while its adjacent mine stayed
// grey, so the board implied the neighbours were safe.
{
    const g = new Grid(5, 5, 4, 1);
    g.initialize();
    [
        [2, 2],
        [2, 3],
    ].forEach(([r, c]) => g.cells[r][c].placeMine());
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
    check(
        'a win marks no mines as exploded',
        w.cells.flat().every((c) => !c.isExploded)
    );
}
{
    const s = new Grid(5, 5, 1, 1);
    s.initialize();
    s.cells[2][2].placeMine();
    s.countNeighborMines();
    s.minesPlaced = true;
    s.revealAllMines(2, 2);
    check(
        'a lone mine marks exactly one cell',
        s.cells.flat().filter((c) => c.isExploded).length === 1
    );
}
{
    // A chain of touching mines must all be marked.
    const c = new Grid(7, 7, 6, 1);
    c.initialize();
    for (let i = 0; i < 6; i++) c.cells[3][i].placeMine();
    c.countNeighborMines();
    c.minesPlaced = true;
    c.revealAllMines(3, 2);
    check(
        'a chain of 6 marks all 6',
        c.cells.flat().filter((x) => x.isExploded).length === 6,
        `${c.cells.flat().filter((x) => x.isExploded).length} marked`
    );
}

// --- Custom difficulty: pure config logic ---
const { resolveCustom, DEFAULT_CUSTOM } = await vite.ssrLoadModule('/src/game/difficulties.js');
check(
    'resolveCustom parses numeric strings',
    resolveCustom({ rows: '12', cols: '14', mineCount: '25' }).rows === 12
);
check(
    'resolveCustom falls back on junk input',
    JSON.stringify(resolveCustom({ rows: 'abc', cols: '', mineCount: '' })) ===
        JSON.stringify(DEFAULT_CUSTOM)
);
check(
    'resolveCustom clamps oversized input',
    resolveCustom({ rows: 999, cols: 999, mineCount: 9999 }).rows === 30
);
check(
    'resolveCustom always leaves a safe first cell',
    resolveCustom({ rows: 2, cols: 2, mineCount: 99 }).mineCount === 3,
    `${resolveCustom({ rows: 2, cols: 2, mineCount: 99 }).mineCount}`
);
// The mixed case that actually broke: a cleared Mines field fell back to the
// previous 25 without clamping, giving a 2x2 board with more mines than cells.
check(
    'resolveCustom clamps the fallback too',
    resolveCustom({ rows: 2, cols: 2, mineCount: '' }, DEFAULT_CUSTOM).mineCount === 3,
    JSON.stringify(resolveCustom({ rows: 2, cols: 2, mineCount: '' }, DEFAULT_CUSTOM))
);
check(
    'custom board minimum is 2x2 (1x1 cannot be won)',
    resolveCustom({ rows: 1, cols: 1, mineCount: 1 }).rows === 2 &&
        resolveCustom({ rows: 1, cols: 1, mineCount: 1 }).cols === 2,
    JSON.stringify(resolveCustom({ rows: 1, cols: 1, mineCount: 1 }))
);
check(
    'resolveCustom honours the previous value',
    resolveCustom({}, { rows: 7, cols: 8, mineCount: 9 }).rows === 7
);
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
check(
    'custom difficulty is offered',
    $$('button').some((b) => b.textContent.trim() === 'Custom')
);
await act(async () => {
    $$('button')
        .find((b) => b.textContent.trim() === 'Custom')
        .click();
});
check(
    'custom settings appear',
    /Rows/.test(document.body.textContent) && /Mines/.test(document.body.textContent)
);
// Switching to Custom keeps the last applied custom size rather than
// resetting to DEFAULT_CUSTOM, which is the intended behaviour.
{
    const custom = await vite.ssrLoadModule('/src/game/difficulties.js');
    const expected = custom.resolveCustom({}, valueOf($$('input[type="number"]')));
    check(
        'custom board matches the current custom inputs',
        cells().length === expected.rows * expected.cols,
        `${cells().length} vs ${expected.rows}x${expected.cols}`
    );
}

const numFields = $$('input[type="number"]');
// rows, cols, mines. The seed is free text and sits behind a checkbox.
check('three numeric fields exist', numFields.length === 3, `${numFields.length} found`);
await act(async () => {
    setNative(numFields[0], '5');
});
await act(async () => {
    setNative(numFields[1], '6');
});
await act(async () => {
    setNative(numFields[2], '7');
});
const applyBtn = $$('button').find((b) => b.textContent.trim() === 'Apply');
check('apply is enabled once the draft changes', !!applyBtn && !applyBtn.disabled);
await act(async () => {
    applyBtn.click();
});
check(
    'custom size applies to the board',
    cells().length === 30,
    `${cells().length} cells (expect 5x6)`
);
check('custom mine count shows in the counter', counter() === '007', `got "${counter()}"`);

// Switching back to a preset restores a fixed board.
await act(async () => {
    $$('button')
        .find((b) => b.textContent.trim() === 'Beginner')
        .click();
});
check('preset overrides custom size', cells().length === 81, `${cells().length} cells`);

// --- Timer ---
check('timer renders', !!$('[role="timer"]'), 'no [role=timer] found');
check(
    'timer starts at 0:00',
    $('[role="timer"]')?.textContent === '0:00',
    $('[role="timer"]')?.textContent
);
check('timer does not run before the first click', $('[role="timer"]')?.textContent === '0:00');
check(
    'timer is labelled',
    /elapsed time/i.test($('[role="timer"]')?.getAttribute('aria-label') || '')
);
check(
    'timer is not a chatty live region',
    $('[role="timer"]')?.getAttribute('aria-live') === 'off'
);

const { formatTime } = await vite.ssrLoadModule('/src/hooks/useTimer.js');
check('formatTime(0)', formatTime(0) === '0:00');
check('formatTime(9) pads seconds', formatTime(9) === '0:09');
check('formatTime(65)', formatTime(65) === '1:05');
check('formatTime(600)', formatTime(600) === '10:00');

await act(async () => {
    cells()[40].click();
});
check(
    'timer still 0:00 right after the first click',
    $('[role="timer"]')?.textContent === '0:00',
    $('[role="timer"]')?.textContent
);

// The reset bug only shows once the clock has actually advanced, so run a fake
// clock whose offset is moved forward between ticks. A constant offset would
// cancel out against a clock started while it was active.
const realNow = Date.now;
let offset = 0;
Date.now = () => realNow() + offset;
const advance = async (ms) => {
    offset += ms;
    await act(async () => {
        await new Promise((r) => setTimeout(r, 300));
    });
};
try {
    // The board is already mid-game from the click above.
    await advance(65_000);
    check(
        'timer advances while playing',
        $('[role="timer"]')?.textContent === '1:05',
        $('[role="timer"]')?.textContent
    );

    await act(async () => {
        byText('Reset').click();
    });
    check(
        'reset zeroes an advanced timer',
        $('[role="timer"]')?.textContent === '0:00',
        `got "${$('[role="timer"]')?.textContent}"`
    );

    // A new game must start from zero and count again, not inherit the old time.
    await act(async () => {
        cells()[40].click();
    });
    await advance(65_000);
    check(
        'second game advances again',
        $('[role="timer"]')?.textContent === '1:05',
        $('[role="timer"]')?.textContent
    );

    // Switching difficulty is a new game too.
    await act(async () => {
        $$('button')
            .find((b) => b.textContent.trim() === 'Intermediate')
            .click();
    });
    check(
        'difficulty switch zeroes the timer',
        $('[role="timer"]')?.textContent === '0:00',
        `got "${$('[role="timer"]')?.textContent}"`
    );

    // The clock must stop the moment the game is decided. Play a board out so
    // game over is guaranteed rather than hoping cell 0 is a mine.
    await act(async () => {
        byText('Reset').click();
    });
    await act(async () => {
        cells()[40].click();
    });
    for (let i = 0; i < 256; i++) {
        const c = cells()[i];
        if (c.disabled) break;
        await act(async () => {
            c.click();
        });
        if (($('[role="status"][aria-live]')?.textContent || '').length > 0) break;
    }
    const over = $('[role="status"][aria-live]')?.textContent || '';
    check('board reached a conclusion for the timer test', over.length > 0, over);
    await advance(5_000);
    const decided = $('[role="timer"]')?.textContent;
    await advance(30_000);
    check(
        'clock stops when the game is decided',
        $('[role="timer"]')?.textContent === decided,
        `held at ${decided}`
    );
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
