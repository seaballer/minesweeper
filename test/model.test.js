/**
 * Unit tests for the game model.
 *
 * The model in `src/game/` has no DOM and no React, so it can be exercised
 * directly in Node — no jsdom, no Vite, no mounting. This is the suite for
 * rules and arithmetic; `ui-check.mjs` is the suite for what the interface does.
 *
 * Run with `npm run test:model`, or as part of `npm test`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { Grid, hashSeed } from '../src/game/Grid.js';
import { Cell } from '../src/game/Cell.js';

/** Builds a board with mines placed by hand, bypassing the shuffle. */
function board(rows, cols, mineCount, mineCoords = [], seed = 1) {
    const g = new Grid(rows, cols, mineCount, seed);
    g.initialize();
    for (const [r, c] of mineCoords) {
        g.cells[r][c].placeMine();
    }
    g.countNeighborMines();
    g.minesPlaced = true;
    return g;
}

const layout = (g) => g.cells.map((row) => row.map((c) => (c.isMine ? 1 : 0)));
const mineCountOf = (g) => g.cells.flat().filter((c) => c.isMine).length;
const visibleCount = (g) => g.cells.flat().filter((c) => c.isVisible).length;

// --- placeMines: determinism, exact count, and the safe cell ---

test('placeMines lays down exactly the requested number of mines', () => {
    for (const [rows, cols, mines] of [
        [9, 9, 10],
        [16, 16, 40],
        [16, 30, 99],
        [2, 2, 1],
        [5, 5, 24],
    ]) {
        const g = new Grid(rows, cols, mines, 12345);
        g.initialize();
        g.revealCell(0, 0);
        assert.equal(mineCountOf(g), mines, `${rows}x${cols} with ${mines}`);
    }
});

test('a pinned board is the same every time, from the same seed', () => {
    const first = new Grid(9, 9, 10, 'a fixed seed');
    first.initialize();
    first.revealCell(4, 4);

    for (let i = 0; i < 25; i += 1) {
        const again = new Grid(9, 9, 10, 'a fixed seed');
        again.initialize();
        again.revealCell(4, 4);
        assert.deepEqual(layout(again), layout(first));
    }
});

test('different seeds give different boards', () => {
    const shapes = new Set();
    for (const seed of ['alpha', 'beta', 'gamma', 'delta', 'epsilon']) {
        const g = new Grid(9, 9, 10, seed);
        g.initialize();
        g.revealCell(4, 4);
        shapes.add(JSON.stringify(layout(g)));
    }
    assert.equal(shapes.size, 5);
});

test('a pinned board does not depend on which cell is opened first', () => {
    const openings = [
        [0, 0],
        [8, 8],
        [4, 1],
        [0, 8],
    ].map(([r, c]) => {
        const g = new Grid(9, 9, 10, 'opening independent');
        g.initialize();
        g.revealCell(r, c);
        return JSON.stringify(layout(g));
    });
    assert.equal(new Set(openings).size, 1);
});

test('an unpinned board never mines the opening cell', () => {
    for (let i = 0; i < 60; i += 1) {
        const g = new Grid(9, 9, 10);
        g.initialize();
        const r = i % 9;
        const c = (i * 7) % 9;
        g.revealCell(r, c);
        assert.equal(g.cells[r][c].isMine, false, `opening ${r},${c} hit a mine`);
    }
});

test('an unpinned board draws a new layout on every reset', () => {
    const g = new Grid(9, 9, 10);
    g.initialize();
    g.revealCell(0, 0);
    const first = JSON.stringify(layout(g));
    g.initialize();
    g.revealCell(0, 0);
    assert.notEqual(JSON.stringify(layout(g)), first);
});

test('the mine count is clamped to leave one safe cell', () => {
    assert.equal(new Grid(2, 2, 99).mineCount, 3);
    assert.equal(new Grid(1, 1, 1).mineCount, 0);
    assert.equal(new Grid(5, 5, -5).mineCount, 0);
    assert.equal(new Grid(5, 5, 25).mineCount, 24);
});

test('a seed hash is stable, order-sensitive, and position-weighted from one', () => {
    assert.equal(hashSeed('ab'), 1 * 97 + 2 * 98);
    assert.notEqual(hashSeed('ab'), hashSeed('ba'));
    // Counting positions from zero would make the leading character irrelevant.
    assert.notEqual(hashSeed('abc'), hashSeed('xbc'));
    assert.equal(hashSeed(4242), 4242);
    assert.equal(hashSeed(-1), 4294967295);
    assert.ok(Number.isInteger(hashSeed('anything at all')));
});

// --- countNeighborMines ---

test('countNeighborMines counts the eight surrounding cells', () => {
    // A 3x3 with its centre mined: only the centre sees a mine.
    const g = board(3, 3, 1, [[1, 1]]);
    assert.equal(g.cells[1][1].neighborMines, 0, 'a mine does not count itself');
    for (const [r, c] of [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 0],
        [1, 2],
        [2, 0],
        [2, 1],
        [2, 2],
    ]) {
        assert.equal(g.cells[r][c].neighborMines, 1, `${r},${c}`);
    }
});

test('countNeighborMines handles corners and edges with fewer neighbours', () => {
    // Every cell of a 2x2 is a corner with exactly three neighbours.
    const g = board(2, 2, 1, [[0, 0]]);
    assert.equal(g.cells[0][0].neighborMines, 0);
    for (const [r, c] of [
        [0, 1],
        [1, 0],
        [1, 1],
    ]) {
        assert.equal(g.cells[r][c].neighborMines, 1, `${r},${c}`);
    }
});

test('countNeighborMines agrees with a hand-computed neighbourhood', () => {
    const g = board(5, 5, 3, [
        [0, 0],
        [2, 2],
        [4, 4],
    ]);
    for (let r = 0; r < 5; r += 1) {
        for (let c = 0; c < 5; c += 1) {
            let expected = 0;
            for (let dr = -1; dr <= 1; dr += 1) {
                for (let dc = -1; dc <= 1; dc += 1) {
                    if (dr === 0 && dc === 0) continue;
                    const rr = r + dr;
                    const cc = c + dc;
                    if (rr < 0 || rr >= 5 || cc < 0 || cc >= 5) continue;
                    if (g.cells[rr][cc].isMine) expected += 1;
                }
            }
            assert.equal(g.cells[r][c].neighborMines, expected, `${r},${c}`);
        }
    }
});

// --- flood fill boundaries ---

test('flood fill spreads through empty cells and stops at numbers', () => {
    // 2x4 with the mine in the top right corner. Opening (1,0) is a zero, so the
    // fill runs left to right and halts where (0,2) and (1,2) become numbered,
    // because the mine is adjacent to them.
    const g = board(2, 4, 1, [[0, 3]]);
    g.revealCell(1, 0);

    for (const [r, c] of [
        [1, 0],
        [0, 0],
        [0, 1],
        [1, 1],
        [0, 2],
        [1, 2],
    ]) {
        assert.equal(g.cells[r][c].isVisible, true, `${r},${c} should be revealed by the fill`);
    }
    assert.equal(g.cells[0][3].isVisible, false, 'the mine is never revealed');
    assert.equal(g.cells[1][3].isVisible, false, 'the fill must stop short of it');
    assert.equal(g.cells[0][2].neighborMines, 1, 'and it stopped at these numbers');
    assert.equal(g.cells[1][2].neighborMines, 1);
    assert.equal(g.remainingSafeCells, 1, 'one safe cell is still hidden');
});

test('flood fill never reveals a mine', () => {
    const g = new Grid(9, 9, 40, 'flood fill');
    g.initialize();
    g.revealCell(4, 4);
    g.cells.flat().forEach((c) => {
        if (c.isMine) assert.equal(c.isVisible, false, 'a mine was revealed by the fill');
    });
});

test('flood fill does not pass through a flagged cell', () => {
    // (0,1) is empty and is the only route from (0,0) to (0,2), so flagging it
    // must stop the fill dead.
    const g = board(1, 3, 0);
    g.toggleFlag(0, 1);
    g.revealCell(0, 0);
    assert.equal(g.cells[0][0].isVisible, true, 'the opening cell still opens');
    assert.equal(g.cells[0][2].isVisible, false, 'the fill crossed a flag');
    assert.equal(g.cells[0][1].isVisible, false, 'and opened the flag itself');
});

test('revealing a numbered cell opens only that cell', () => {
    // (0,1) touches the mine, so it is a 1 and must not cascade.
    const g = board(3, 3, 1, [[0, 0]]);
    assert.equal(g.cells[0][1].neighborMines, 1);
    g.revealCell(0, 1);
    assert.equal(g.cells[0][1].isVisible, true);
    assert.equal(visibleCount(g), 1, 'a non-zero cell must not cascade');
});

test('an empty opening cell on an all-clear board clears everything', () => {
    const g = board(4, 4, 0);
    g.revealCell(2, 2);
    assert.equal(visibleCount(g), 16, 'with no mines every cell is zero');
    assert.equal(g.status, 'win');
});

// --- win detection ---

test('revealing every safe cell wins', () => {
    const g = board(2, 2, 1, [[0, 0]]);
    assert.equal(g.revealCell(1, 1), 'playing');
    assert.equal(g.revealCell(0, 1), 'playing');
    assert.equal(g.revealCell(1, 0), 'win');
});

test('a 1x1 board with no mines wins on the first click', () => {
    const g = new Grid(1, 1, 1, 1);
    g.initialize();
    assert.equal(g.mineCount, 0);
    assert.equal(g.revealCell(0, 0), 'win');
});

test('remainingSafeCells tracks the cells still hidden', () => {
    const g = board(3, 3, 2, [
        [0, 0],
        [2, 2],
    ]);
    assert.equal(g.remainingSafeCells, 7);
    g.revealCell(0, 1);
    assert.equal(g.remainingSafeCells, 6);
});

test('a decided game is terminal', () => {
    const won = board(2, 2, 1, [[0, 0]]);
    won.revealCell(1, 1);
    won.revealCell(0, 1);
    won.revealCell(1, 0);
    assert.equal(won.status, 'win');
    const settled = JSON.stringify(layout(won));
    assert.equal(won.revealCell(0, 0), 'win', 'a won game cannot be flipped to a loss');
    won.toggleFlag(1, 1);
    assert.equal(JSON.stringify(layout(won)), settled);

    const lost = board(3, 3, 1, [[1, 1]]);
    lost.revealCell(1, 1);
    assert.equal(lost.status, 'gameover');
    assert.equal(lost.revealCell(2, 2), 'gameover', 'a lost game stays lost');
});

test('a win exposes the mines and marks nothing as exploded', () => {
    const g = board(2, 2, 1, [[0, 0]]);
    g.revealCell(1, 1);
    g.revealCell(0, 1);
    g.revealCell(1, 0);
    assert.equal(g.status, 'win');
    assert.equal(g.cells[0][0].isVisible, true, 'the mine is uncovered on a win');
    assert.ok(
        g.cells.flat().every((c) => !c.isExploded),
        'nothing detonates on a win'
    );
    assert.ok(g.cells.flat().every((c) => !c.isWrongFlag));
});

test('a loss marks the whole connected mine cluster as exploded', () => {
    // Two mines touching, so detonating one must mark both.
    const g = board(4, 4, 2, [
        [1, 1],
        [1, 2],
    ]);
    g.revealCell(1, 1);
    assert.equal(g.status, 'gameover');
    assert.equal(g.cells[1][1].isExploded, true, 'the clicked mine');
    assert.equal(g.cells[1][2].isExploded, true, 'the adjacent mine');
});

test('a flag on a safe cell is marked wrong at game over', () => {
    // Two mines, so the loss can be triggered on a cell that is not the one
    // carrying the correct flag: a flagged cell cannot be revealed.
    const g = board(4, 4, 2, [
        [3, 3],
        [0, 3],
    ]);
    g.toggleFlag(0, 0); // On a safe cell: a mistake.
    g.toggleFlag(3, 3); // On a real mine: correct.
    g.revealCell(0, 3);

    assert.equal(g.status, 'gameover');
    assert.equal(g.cells[0][0].isWrongFlag, true, 'the mistake is recorded');
    assert.equal(g.cells[0][0].isVisible, true, 'and uncovered so it is visible');
    assert.equal(g.cells[3][3].isWrongFlag, false, 'a correct flag is left alone');
    assert.equal(g.cells[3][3].isFlagged, true, 'and is still shown');
    assert.equal(g.cells[3][3].isVisible, true, 'the mine under it is uncovered on a loss');
});

test('a wrong flag is permanent, because the cell it sits on is revealed', () => {
    const g = board(4, 4, 2, [
        [3, 3],
        [0, 3],
    ]);
    g.toggleFlag(0, 0);
    g.revealCell(0, 3);
    assert.equal(g.cells[0][0].isWrongFlag, true);
    assert.equal(g.cells[0][0].isVisible, true, 'marking it wrong also uncovers it');

    // Marking a flag wrong and revealing the cell are done together, and a
    // revealed cell refuses to be flagged or unflagged. So the mistake cannot be
    // tidied away — which is the point: the board at game over is final.
    g.toggleFlag(0, 0);
    assert.equal(g.cells[0][0].isFlagged, true, 'the flag cannot be taken back');
    assert.equal(g.cells[0][0].isWrongFlag, true, 'and the marker stays with it');
});

// --- flag tally and chording ---

test('the flag tally tracks what is on the board', () => {
    const g = board(4, 4, 2);
    assert.equal(g.flagCount, 0);
    g.toggleFlag(0, 0);
    g.toggleFlag(1, 1);
    assert.equal(g.flagCount, 2);
    g.toggleFlag(0, 0);
    assert.equal(g.flagCount, 1);
    g.initialize();
    assert.equal(g.flagCount, 0, 'reset clears the tally with the cells');
});

test('a revealed cell refuses to be flagged', () => {
    const g = board(3, 3, 1, [[2, 2]]);
    g.revealCell(0, 0);
    const before = g.flagCount;
    g.toggleFlag(0, 0);
    assert.equal(g.cells[0][0].isFlagged, false);
    assert.equal(g.flagCount, before, 'a refused flag must not move the tally');
});

test('chording opens the neighbours once the flags add up', () => {
    const g = board(3, 3, 1, [[0, 0]]);
    g.revealCell(1, 1);
    assert.equal(g.cells[1][1].neighborMines, 1);
    const before = visibleCount(g);

    g.chord(1, 1); // No flags yet, so nothing should open.
    assert.equal(visibleCount(g), before, 'chorded with a mismatched flag count');

    g.toggleFlag(0, 0);
    g.chord(1, 1);
    assert.ok(visibleCount(g) > before, 'chorded once the flags match');
});

test('chording leaves the flags exactly as it found them', () => {
    const g = board(4, 4, 2, [
        [0, 0],
        [3, 3],
    ]);
    g.revealCell(1, 1);
    g.toggleFlag(0, 0);
    const flagsBefore = g.cells.flat().filter((c) => c.isFlagged).length;

    g.chord(1, 1);

    assert.equal(g.flagCount, flagsBefore, 'chording must not add or remove a flag');
    assert.equal(g.cells[0][0].isFlagged, true, 'the flag it relied on is still there');
    // This chord happens to win the board, and a win uncovers every mine. That
    // is `revealAllMines` reporting the result, not the chord reaching over a
    // flag: the flag itself is untouched either way.
    assert.equal(g.status, 'win', 'this chord finishes the board');
});

test('chording is still a guess: a miscounted flag detonates', () => {
    // (1,1) has one mine around it. Flag the safe cell beside it instead and the
    // count still matches, so the chord fires — into the real mine.
    const g = board(4, 4, 1, [[0, 0]]);
    g.revealCell(1, 1);
    assert.equal(g.cells[1][1].neighborMines, 1);
    g.toggleFlag(0, 1); // Safe, but it is the only flagged neighbour.
    assert.equal(g.chord(1, 1), 'gameover');
    assert.equal(g.cells[0][0].isVisible, true, 'the mine was opened');
});

// --- contracts the coordinates share ---

test('out-of-range coordinates throw a RangeError naming the board', () => {
    const g = board(3, 3, 1, [[0, 0]]);
    for (const call of [
        () => g.revealCell(3, 0),
        () => g.revealCell(0, -1),
        () => g.chord(99, 1),
        () => g.toggleFlag(0, 3),
    ]) {
        assert.throws(call, RangeError);
    }
    try {
        g.revealCell(3, 0);
    } catch (e) {
        assert.match(e.message, /3x3/);
        assert.match(e.message, /0\.\.2/);
    }
});

test('every coordinate entry point returns a status, never undefined', () => {
    const g = board(4, 4, 2, [
        [1, 1],
        [2, 2],
    ]);
    for (const value of [
        g.revealCell(0, 0),
        g.revealCell(0, 0),
        g.chord(0, 0),
        g.chord(3, 3),
        g.revealCell(2, 2),
        g.toggleFlag(3, 0),
        g.toggleFlag(3, 0),
    ]) {
        assert.equal(typeof value, 'string');
        assert.ok(['ready', 'playing', 'win', 'gameover'].includes(value), value);
    }
});

test('nothing is a mine until placement is triggered', () => {
    const g = new Grid(9, 9, 10, 1);
    g.initialize();
    assert.equal(g.minesPlaced, false);
    assert.equal(mineCountOf(g), 0);
    assert.ok(g.cells.flat().every((c) => c.neighborMines === 0));
    g.revealCell(4, 4);
    assert.equal(g.minesPlaced, true);
    assert.equal(mineCountOf(g), 10);
});

test('a Cell refuses to change once revealed', () => {
    const c = new Cell();
    c.toggleFlag();
    assert.equal(c.isFlagged, true);
    c.reveal();
    c.toggleFlag();
    assert.equal(c.isFlagged, true, 'a revealed cell keeps its flag');
    assert.equal(c.reveal(), false, 'revealing twice reports no change');
});
