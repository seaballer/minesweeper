import { useCallback, useMemo, useState } from 'react';
import { Grid } from '../game/Grid.js';
import { DEFAULT_DIFFICULTY, DIFFICULTIES } from '../game/difficulties.js';

/**
 * Owns the game model and exposes the actions the UI needs.
 *
 * Model mutates in place. `Grid` and `Cell` are mutable objects that never get
 * replaced, so React sees no change between renders. Two things work around it:
 *
 * 1. `version` is bumped after every mutation purely to force a re-render. It
 *    is deliberately unused — don't read it, just let it invalidate.
 * 2. Components must not take a `Cell` object as a prop. The reference is
 *    identical across renders, so a `memo`ized component would never repaint.
 *    `CellButton` takes flat primitives for this reason.
 */
export function useMinesweeper(initialDifficulty = DEFAULT_DIFFICULTY) {
    const [difficultyKey, setDifficultyKey] = useState(initialDifficulty);
    const [version, setVersion] = useState(0);

    const grid = useMemo(() => {
        const { rows, cols, mineCount } = DIFFICULTIES[difficultyKey];
        const instance = new Grid(rows, cols, mineCount);
        instance.initialize();
        return instance;
    }, [difficultyKey]);

    const rerender = useCallback(() => setVersion(v => v + 1), []);

    const isOver = grid.status === 'win' || grid.status === 'gameover';

    const reveal = useCallback((row, col) => {
        if (grid.status === 'win' || grid.status === 'gameover') {
            return;
        }
        grid.revealCell(row, col);
        rerender();
    }, [grid, rerender]);

    const toggleFlag = useCallback((row, col) => {
        if (grid.status === 'win' || grid.status === 'gameover') {
            return;
        }
        grid.cells[row][col].toggleFlag();
        rerender();
    }, [grid, rerender]);

    const reset = useCallback(() => {
        grid.initialize();
        rerender();
    }, [grid, rerender]);

    const changeDifficulty = useCallback((key) => {
        // Remounting the grid via difficultyKey gives a fresh board, so this
        // only needs to record the choice.
        setDifficultyKey(key);
    }, []);

    const flagsPlaced = useMemo(
        () => grid.cells.flat().filter(cell => cell.isFlagged).length,
        [grid, version]
    );

    const minesRemaining = Math.max(0, grid.mineCount - flagsPlaced);

    return {
        grid,
        difficulty: DIFFICULTIES[difficultyKey],
        status: grid.status,
        isOver,
        minesRemaining,
        reveal,
        toggleFlag,
        reset,
        changeDifficulty,
    };
}
