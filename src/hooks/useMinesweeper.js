import { useCallback, useMemo, useState } from 'react';
import { Grid } from '../game/Grid.js';
import { DEFAULT_CUSTOM, DEFAULT_DIFFICULTY, DIFFICULTIES } from '../game/difficulties.js';
import { useTimer } from './useTimer.js';

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
    // Only meaningful for the `custom` difficulty; presets read from DIFFICULTIES.
    const [customSize, setCustomSize] = useState(DEFAULT_CUSTOM);
    const [version, setVersion] = useState(0);
    // Bumped on every new board so the timer knows to zero itself.
    const [gameId, setGameId] = useState(0);

    const grid = useMemo(() => {
        const preset = DIFFICULTIES[difficultyKey];
        const { rows, cols, mineCount } = preset.isCustom ? customSize : preset;
        const instance = new Grid(rows, cols, mineCount);
        instance.initialize();
        return instance;
    }, [difficultyKey, customSize]);

    // The size actually in play. `difficulty` alone is not enough: the `custom`
    // preset carries no dimensions, so reading rows/cols off it would render
    // an empty caption.
    const boardSize = useMemo(
        () => ({ rows: grid.rows, cols: grid.cols, mineCount: grid.mineCount }),
        [grid]
    );

    const rerender = useCallback(() => setVersion((v) => v + 1), []);

    const isOver = grid.status === 'win' || grid.status === 'gameover';

    // The clock runs from the first reveal — the moment mines are placed and
    // the game genuinely begins — and stops the instant it is decided. A board
    // nobody has clicked yet is not being timed.
    const timerRunning = grid.status !== 'ready' && !isOver;
    const elapsed = useTimer(timerRunning, gameId);

    const reveal = useCallback(
        (row, col) => {
            if (grid.status === 'win' || grid.status === 'gameover') {
                return;
            }
            grid.revealCell(row, col);
            rerender();
        },
        [grid, rerender]
    );

    const toggleFlag = useCallback(
        (row, col) => {
            if (grid.status === 'win' || grid.status === 'gameover') {
                return;
            }
            grid.cells[row][col].toggleFlag();
            rerender();
        },
        [grid, rerender]
    );

    const chord = useCallback(
        (row, col) => {
            if (grid.status === 'win' || grid.status === 'gameover') {
                return;
            }
            grid.chord(row, col);
            rerender();
        },
        [grid, rerender]
    );

    const reset = useCallback(() => {
        grid.initialize();
        setGameId((id) => id + 1);
        rerender();
    }, [grid, rerender]);

    const changeDifficulty = useCallback((key) => {
        // Remounting the grid via difficultyKey gives a fresh board, so this
        // only needs to record the choice. The gameId bump restarts the clock.
        setDifficultyKey(key);
        setGameId((id) => id + 1);
    }, []);

    const applyCustomSize = useCallback((size) => {
        // Applying an identical config must not discard a live board: `grid`
        // is memoized on `customSize` by reference, so a fresh object for an
        // unchanged size would rebuild the grid and reset the game.
        setCustomSize((prev) =>
            prev.rows === size.rows && prev.cols === size.cols && prev.mineCount === size.mineCount
                ? prev
                : size
        );
        setGameId((id) => id + 1);
    }, []);

    // `version` is an invalidation token, not a value the memo reads: the
    // model mutates in place, so without it this would never recompute. The
    // linter flags it as an unnecessary dependency, which is exactly the
    // "adjust state when something external changes" case its docs describe.
    //
    // Recounting beats keeping a counter in state here: the scan is
    // self-healing if the model is mutated by a path that forgets to bump the
    // counter, and at 480 cells the cost is negligible next to a click.
    const flagsPlaced = useMemo(
        () => grid.cells.flat().filter((cell) => cell.isFlagged).length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [grid, version]
    );

    const minesRemaining = Math.max(0, grid.mineCount - flagsPlaced);

    // Distinct from minesRemaining === 0: over-flagging also drives the
    // remainder to zero, but that's a wrong answer, not a solved board.
    const allMinesFlagged = flagsPlaced === grid.mineCount;

    return {
        grid,
        difficulty: DIFFICULTIES[difficultyKey],
        boardSize,
        customSize,
        status: grid.status,
        isOver,
        minesRemaining,
        allMinesFlagged,
        elapsed,
        timerRunning,
        reveal,
        toggleFlag,
        chord,
        reset,
        changeDifficulty,
        applyCustomSize,
    };
}
