import { Cell } from './Cell.js';

// Small, fast, well-distributed 32-bit PRNG. Returns a function producing
// floats in [0, 1). Used so a given seed always yields the same board.
function mulberry32(seed) {
    let a = seed >>> 0;

    return function () {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Default seeds come from the clock, but bumped per instantiation: Date.now()
// alone is millisecond-resolution, so grids built in the same tick would
// collide and produce identical boards.
let nextSeed = Date.now();

export class Grid {
    constructor(rows, cols, mineCount, seed) {
        this.rows = rows;
        this.cols = cols;
        // Clamped to leave one safe cell. Mines are placed on the first click
        // and that cell is excluded, so a board needs a spare cell or the
        // opening move has nowhere safe to land and the game is unwinnable
        // before it starts. This is what makes a 1x1 board with 1 requested
        // mine become a 1x1 board with none, rather than an instant loss.
        this.mineCount = Math.max(0, Math.min(mineCount, rows * cols - 1));
        // A seed passed by the caller means "this exact board": it is pinned so
        // reset replays it and the board stays shareable. No seed means the
        // board is random, so reset draws a new one.
        this.pinnedSeed = seed !== undefined;
        this.seed = seed ?? nextSeed++;
        this.remainingSafeCells = rows * cols - this.mineCount;
        this.flagCount = 0;
        this.cells = this.createGrid();
        this.minesPlaced = false;
        this.status = 'ready';
    }

    // Resets to a fresh, unplayed board. Mines are deliberately NOT placed
    // here: they are placed on the first revealCell so the opening click is
    // always safe. See ensureMinesPlaced.
    //
    // An unpinned board takes a new seed here. Without this, reset replayed
    // the identical mine layout every time, because the seed was fixed once in
    // the constructor and never advanced.
    initialize() {
        if (!this.pinnedSeed) {
            this.seed = nextSeed++;
        }
        this.cells = this.createGrid();
        this.remainingSafeCells = this.rows * this.cols - this.mineCount;
        // createGrid() hands back brand new Cells, so every flag is already
        // gone; the counter just has to follow it back to zero.
        this.flagCount = 0;
        this.minesPlaced = false;
        this.status = 'ready';
    }

    createGrid() {
        const grid = [];
        for (let i = 0; i < this.rows; i++) {
            grid[i] = [];
            for (let j = 0; j < this.cols; j++) {
                grid[i][j] = new Cell();
            }
        }
        return grid;
    }

    // Places mines if they aren't placed yet, guaranteeing that (safeRow,
    // safeCol) is not a mine. Called on the first revealCell so a player's
    // opening click can never lose.
    ensureMinesPlaced(safeRow, safeCol) {
        if (this.minesPlaced) {
            return;
        }

        this.placeMines(safeRow, safeCol);
        this.countNeighborMines();
        this.minesPlaced = true;
    }

    // Builds a flat list of every cell, shuffle it with Fisher-Yates, then
    // take the first mineCount entries. The first `mineCount` cells of a
    // uniform shuffle are a uniform sample, so this matches plain rejection
    // sampling without the retry loop.
    //
    // When safeRow/safeCol are in bounds that cell is left out of the
    // candidate list, so it cannot be mined. The constructor guarantees
    // mineCount <= total - 1, so there is always room for the exclusion and no
    // fallback is needed.
    placeMines(safeRow, safeCol) {
        const safePosition = safeRow * this.cols + safeCol;
        const safeInBounds =
            safeRow >= 0 && safeRow < this.rows && safeCol >= 0 && safeCol < this.cols;

        const positions = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                if (safeInBounds && i * this.cols + j === safePosition) {
                    continue;
                }
                positions.push(i * this.cols + j);
            }
        }

        const random = mulberry32(this.seed);

        for (let i = positions.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [positions[i], positions[j]] = [positions[j], positions[i]];
        }

        for (let i = 0; i < this.mineCount; i++) {
            const position = positions[i];
            this.cells[Math.floor(position / this.cols)][position % this.cols].placeMine();
        }
    }

    isInBounds(row, col) {
        return (
            Number.isInteger(row) &&
            Number.isInteger(col) &&
            row >= 0 &&
            row < this.rows &&
            col >= 0 &&
            col < this.cols
        );
    }

    // Guards every coordinate entry point. Previously an out-of-range click
    // fell through to `this.cells[row][col].isVisible` and died with
    // "Cannot read properties of undefined", which says nothing about the real
    // problem. Out of range is a bug in the caller, not a game state, so it
    // throws rather than being silently ignored.
    assertInBounds(row, col) {
        if (!this.isInBounds(row, col)) {
            throw new RangeError(
                `Cell (${row}, ${col}) is outside a ${this.rows}x${this.cols} board; ` +
                    'expected integer row 0..' +
                    (this.rows - 1) +
                    ' and col 0..' +
                    (this.cols - 1) +
                    '.'
            );
        }
    }

    getNeighbors(row, col) {
        const neighbors = [];
        const dx = [-1, -1, -1, 0, 0, 1, 1, 1];
        const dy = [-1, 0, 1, -1, 1, -1, 0, 1];

        for (let k = 0; k < 8; k++) {
            const newRow = row + dx[k];
            const newCol = col + dy[k];

            if (newRow >= 0 && newRow < this.rows && newCol >= 0 && newCol < this.cols) {
                neighbors.push({
                    row: newRow,
                    col: newCol,
                    cell: this.cells[newRow][newCol],
                });
            }
        }

        return neighbors;
    }

    // Chording: when a revealed number has exactly as many flagged neighbors
    // as it has adjacent mines, the remaining hidden neighbors are safe and
    // are revealed at once. No-ops otherwise, which is what makes it a guess
    // the player can be wrong about.
    //
    // Returns the game status, as revealCell does. A no-op returns the current
    // status rather than nothing: the board is unchanged, so the status is
    // simply whatever it already was.
    chord(row, col) {
        this.assertInBounds(row, col);

        if (this.status === 'win' || this.status === 'gameover') {
            return this.status;
        }

        const cell = this.cells[row][col];

        // Only a revealed, safe, numbered cell can be chorded. A zero cell is
        // already covered by flood fill.
        if (!cell.isVisible || cell.isMine || cell.neighborMines === 0) {
            return this.status;
        }

        // Mines must already be placed; chording before the first reveal has
        // no flags to compare against.
        if (!this.minesPlaced) {
            return this.status;
        }

        const neighbors = this.getNeighbors(row, col);
        const flagged = neighbors.filter((n) => n.cell.isFlagged).length;

        if (flagged !== cell.neighborMines) {
            return this.status;
        }

        for (const n of neighbors) {
            if (n.cell.isFlagged || n.cell.isVisible) {
                continue;
            }
            const result = this.revealCell(n.row, n.col);
            if (result === 'win' || result === 'gameover') {
                return result;
            }
        }

        return 'playing';
    }

    countNeighborMines() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const cell = this.cells[i][j];
                if (!cell.isMine) {
                    const neighbors = this.getNeighbors(i, j);
                    cell.neighborMines = neighbors.filter((n) => n.cell.isMine).length;
                }
            }
        }
    }

    // Always returns the game status: "playing", "win", or "gameover".
    //
    // A no-op — the cell is already visible or is flagged — returns the current
    // status rather than nothing. The board is unchanged, so "playing" is
    // simply true, and a caller never has to special-case undefined.
    revealCell(row, col) {
        this.assertInBounds(row, col);

        // Once the game is decided it stops accepting input, so a won game
        // can't be flipped to a loss by clicking a revealed mine.
        if (this.status === 'win' || this.status === 'gameover') {
            return this.status;
        }

        // First click of a game decides the layout, so it is never a mine.
        this.ensureMinesPlaced(row, col);

        const cell = this.cells[row][col];

        if (cell.isVisible || cell.isFlagged) {
            return this.status;
        }
        if (cell.isMine) {
            this.revealAllMines(row, col);
            this.status = 'gameover';
            return this.status;
        }

        if (cell.reveal()) {
            this.remainingSafeCells--;
        }

        if (cell.neighborMines === 0) {
            this.floodFill(row, col);
        }

        if (this.remainingSafeCells === 0) {
            this.revealAllMines();
            this.status = 'win';
            return this.status;
        }

        this.status = 'playing';
        return this.status;
    }

    // Places or lifts a flag, keeping `flagCount` in step.
    //
    // This exists so flagging goes through the same door as reveal and chord:
    // the UI used to reach into `cells[row][col]` and flip the flag itself,
    // which meant the flag tally had to be recounted by scanning every cell on
    // every render. Owning it here makes the tally O(1) and keeps the
    // bounds check that direct indexing would otherwise have skipped.
    //
    // Like `revealCell` and `chord`, this enforces the terminal status itself
    // rather than trusting the caller to. The UI checks too, but a decided game
    // is a property of the model, and a rule that lives only in the view is one
    // refactor away from being wrong.
    //
    // The count is derived from before/after state rather than from what
    // `Cell.toggleFlag` reports, so a no-op (a visible cell, which refuses to
    // change) can never skew it.
    toggleFlag(row, col) {
        this.assertInBounds(row, col);

        if (this.status === 'win' || this.status === 'gameover') {
            return this.status;
        }

        const cell = this.cells[row][col];
        const wasFlagged = cell.isFlagged;
        cell.toggleFlag();

        if (cell.isFlagged !== wasFlagged) {
            this.flagCount += wasFlagged ? -1 : 1;
        }

        return this.status;
    }

    // Uncovers every mine, used both on a loss and on a win so the final board
    // is fully legible.
    //
    // On a loss the whole connected mine cluster around the detonation is
    // marked `isExploded`, not just the single cell that was revealed. Chording
    // in particular can uncover a mine that sits next to other mines, and
    // showing one red cell among identical grey ones reads as if the others
    // were safe. The spread is cluster-wide (mine -> adjacent mine -> ...)
    // because a blast does not stop at one square.
    //
    // On a win no mine is detonated, so nothing is marked.
    revealAllMines(explodedRow, explodedCol) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const cell = this.cells[i][j];

                if (cell.isMine) {
                    cell.reveal();
                } else if (cell.isFlagged) {
                    // A flag on a safe cell is a mistake. Uncover it and mark
                    // it, so the final board shows which guesses were wrong
                    // rather than leaving a flag on empty space.
                    cell.isWrongFlag = true;
                    cell.reveal();
                }
            }
        }

        if (explodedRow === undefined || explodedCol === undefined) {
            return;
        }

        const origin = this.cells[explodedRow]?.[explodedCol];
        if (!origin?.isMine) {
            return;
        }

        // Breadth-first walk over mine-to-mine contact. Uses an index cursor
        // rather than shift(), matching floodFill below.
        const seen = new Set([`${explodedRow},${explodedCol}`]);
        const queue = [[explodedRow, explodedCol]];
        let head = 0;

        while (head < queue.length) {
            const [currentRow, currentCol] = queue[head++];
            this.cells[currentRow][currentCol].isExploded = true;

            for (const n of this.getNeighbors(currentRow, currentCol)) {
                if (!n.cell.isMine) {
                    continue;
                }
                const key = `${n.row},${n.col}`;
                if (seen.has(key)) {
                    continue;
                }
                seen.add(key);
                queue.push([n.row, n.col]);
            }
        }
    }

    floodFill(row, col) {
        const queue = [];
        let head = 0;

        queue.push([row, col]);
        while (head < queue.length) {
            const [currentRow, currentCol] = queue[head++];
            const neighbors = this.getNeighbors(currentRow, currentCol);

            for (const n of neighbors) {
                if (n.cell.isVisible) continue;
                if (n.cell.isMine) continue;
                if (n.cell.isFlagged) continue;

                if (n.cell.reveal()) {
                    this.remainingSafeCells--;
                }

                if (n.cell.neighborMines === 0) {
                    queue.push([n.row, n.col]);
                }
            }
        }
    }
}
