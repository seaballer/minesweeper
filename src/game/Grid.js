import { Cell } from './Cell.js';

// Small, fast, well-distributed 32-bit PRNG. Returns a function producing
// floats in [0, 1). Used so a given seed always yields the same board.
function mulberry32(seed) {
    let a = seed >>> 0;

    return function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
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
        this.mineCount = Math.min(mineCount, rows * cols);
        this.seed = seed ?? nextSeed++;
        this.remainingSafeCells = rows * cols - this.mineCount;
        this.cells = this.createGrid();
        this.minesPlaced = false;
        this.status = "ready";
    }

    // Resets to a fresh, unplayed board. Mines are deliberately NOT placed
    // here: they are placed on the first revealCell so the opening click is
    // always safe. See ensureMinesPlaced.
    initialize() {
        this.cells = this.createGrid();
        this.remainingSafeCells = this.rows * this.cols - this.mineCount;
        this.minesPlaced = false;
        this.status = "ready";
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
    // candidate list, so it cannot be mined. If excluding it would leave too
    // few cells to satisfy mineCount (e.g. a 1x1 board with 1 mine), the
    // exclusion is dropped rather than under-filling the board.
    placeMines(safeRow, safeCol) {
        const total = this.rows * this.cols;
        const canExclude = total - 1 >= this.mineCount;
        const safePosition = safeRow * this.cols + safeCol;
        const safeInBounds = canExclude
            && safeRow >= 0 && safeRow < this.rows
            && safeCol >= 0 && safeCol < this.cols;

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
                    cell: this.cells[newRow][newCol]
                });
            }
        }

        return neighbors;
    }

    countNeighborMines() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const cell = this.cells[i][j];
                if (!cell.isMine) {
                    const neighbors = this.getNeighbors(i, j);
                    cell.neighborMines = neighbors.filter(n => n.cell.isMine).length;
                }
            }
        }    
    }

    revealCell(row, col) {
        // Once the game is decided it stops accepting input, so a won game
        // can't be flipped to a loss by clicking a revealed mine.
        if (this.status === "win" || this.status === "gameover") {
            return this.status;
        }

        // First click of a game decides the layout, so it is never a mine.
        this.ensureMinesPlaced(row, col);

        const cell = this.cells[row][col];

        if (cell.isVisible || cell.isFlagged) {
            return;
        }
        if (cell.isMine) {
            this.revealAllMines(row, col);
            this.status = "gameover";
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
            this.status = "win";
            return this.status;
        }

        this.status = "playing";
        return this.status;
    }

    // Uncovers every mine, used both on a loss and on a win so the final board
    // is fully legible. The mine that was clicked is marked as exploded.
    revealAllMines(explodedRow, explodedCol) {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
                const cell = this.cells[i][j];
                if (!cell.isMine) {
                    continue;
                }
                cell.reveal();
                if (i === explodedRow && j === explodedCol) {
                    cell.isExploded = true;
                }
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