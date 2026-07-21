export class Cell {
    constructor() {
        this.isMine = false;
        this.isFlagged = false;
        this.isVisible = false;
        this.neighborMines = 0;
    }

    reveal() {
        this.isVisible = true;
    }

    toggleFlag() {
        this.isFlagged = !this.isFlagged;
    }

    placeMine() {
        this.isMine = true;
    }
}