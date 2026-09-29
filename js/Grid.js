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
        this.mineCount = mineCount;
        this.seed = seed ?? nextSeed++;
        this.remainingSafeCells = rows * cols - mineCount;
        this.cells = this.createGrid();
    }

    initialize() {
        this.placeMines();
        this.countNeighborMines();
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

    placeMines() {
        // Build a flat list of every cell, shuffle it with Fisher-Yates, then
        // take the first mineCount entries. The first `mineCount` cells of a
        // uniform shuffle are a uniform sample, so this matches the old
        // rejection-sampling distribution without the retry loop.
        const positions = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.cols; j++) {
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
        const cell = this.cells[row][col];

        if (cell.isVisible || cell.isFlagged) {
            return;
        }
        if (cell.isMine) {
            cell.reveal();
            cell.isExploded = true;
            return "gameover";
        }

        if (cell.reveal()) {
            this.remainingSafeCells--;
        }

        if (cell.neighborMines === 0) {
            this.floodFill(row, col);
        }

        if (this.remainingSafeCells === 0) {
            return "win";
        }

        return "playing";
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
                if (n.cell.isMine) continue; // its extra protection but in practice this doesnt really happen since the queue only expands on safe slots anyway

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