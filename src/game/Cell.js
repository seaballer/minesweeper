export class Cell {
    constructor() {
        this.isMine = false;
        this.isExploded = false;
        this.isFlagged = false;
        this.isVisible = false;
        // Set at game over when a flag was placed on a safe cell. Purely
        // presentational: it records a mistake, it does not affect play.
        this.isWrongFlag = false;
        this.neighborMines = 0;
    }

    reveal() {
        if (this.isVisible) return false;

        this.isVisible = true;
        return true;
    }

    toggleFlag() {
        if (this.isVisible) return;
        this.isFlagged = !this.isFlagged;
        // Clearing the flag clears the mistake marker too, so it can never
        // outlive the flag that caused it.
        this.isWrongFlag = false;
    }

    placeMine() {
        this.isMine = true;
    }
}
