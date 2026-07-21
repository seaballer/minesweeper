export class Cell {
    constructor() {
        this.isMine = false;
        this.isFlagged = false;
        this.isVisible = false;
        this.neighborMines = 0;
    }

    reveal() {
        if(this.isVisible) return false;

        this.isVisible = true;
        return true;
    }

    toggleFlag() {
        if (this.isVisible) return;
        this.isFlagged = !this.isFlagged;
    }

    placeMine() {
        this.isMine = true;
    }
}