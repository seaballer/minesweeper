import { Cell } from './Cell.js';

export class Grid {
    constructor(rows, cols, mineCount) {
        this.rows = rows;
        this.cols = cols;
        this.mineCount = mineCount;
        this.remainingCells = rows * cols - mineCount;
        this.cells = this.createGrid();
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

    placeMines() { // could redo with shuffle method later
        let placedMines = 0;

        while (placedMines < this.mineCount) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);

            if (!this.cells[row][col].isMine) {
                this.cells[row][col].placeMine();
                placedMines++;
            }
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
            return "gameover";
        }

        if (cell.reveal()) {
            this.remainingCells--;
        }

        if (cell.neighborMines === 0) {
            this.floodFill(row, col);
        }

        if (this.remainingCells === 0) {
            return "win";
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
                //if (n.cell.isMine) continue; -- unnecessary protection

                if (n.cell.reveal()) {
                    this.remainingCells--;
                }

                if (n.cell.neighborMines === 0) {
                    queue.push([n.row, n.col]);
                }
            }
        }
    }
}