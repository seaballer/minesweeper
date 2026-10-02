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

/**
 * What a cell will do if it is activated, derived purely from its state.
 *
 * Shared on purpose. `CellButton` uses it for its own gestures and for what it
 * renders; `Board` uses it to work out which action a drag-release should
 * commit. Two independent copies of these three rules is exactly how flag
 * removal broke once — the cell thought it was revealed, the board thought it
 * was flaggable, and the flag was silently discarded.
 *
 * Takes the flags it needs rather than a `Cell`, so it works for the live cell
 * and equally for a plain object read off the model.
 */
export function cellGestures({ disabled = false, isMine, isVisible, isFlagged, neighborMines }) {
    return {
        // An unrevealed, unflagged cell reveals. A revealed one cannot.
        canReveal: !disabled && !isVisible && !isFlagged,
        // A hidden cell can always be flagged OR unflagged, so a misplaced flag
        // is recoverable without reaching for Reset. The model also refuses to
        // flag a visible cell, so this only needs to cover the hidden half.
        canFlag: !disabled && !isVisible,
        // A revealed, safe, numbered cell chords. A zero cell is excluded
        // because flood fill already covered it.
        canChord: !disabled && isVisible && !isMine && neighborMines > 0,
    };
}
