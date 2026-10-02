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
 *    is not game state and nothing should branch on its value. It IS handed to
 *    `Board`, because `Board` reads the mutating model and a `memo`ized
 *    `Board` needs a prop that actually changes to know to repaint — see the
 *    note there. Everywhere else, just let it invalidate.
 * 2. Components must not take a `Cell` object as a prop. The reference is
 *    identical across renders, so a `memo`ized component would never repaint.
 *    `CellButton` takes flat primitives for this reason.
 */
export function useMinesweeper(initialDifficulty = DEFAULT_DIFFICULTY) {
    const [difficultyKey, setDifficultyKey] = useState(initialDifficulty);
    // Only meaningful for the `custom` difficulty; presets read from DIFFICULTIES.
    // `seed` is undefined for a random board, or free text that pins the layout
    // so it can be shared and replayed.
    const [customSize, setCustomSize] = useState(DEFAULT_CUSTOM);
    const [version, setVersion] = useState(0);
    // Bumped on every new board so the timer knows to zero itself.
    const [gameId, setGameId] = useState(0);

    // One shape for every size, so the presets and the custom panel can't drift
    // apart. The presets carry no `seed`, so destructuring one yields
    // `undefined` — which is exactly what an unpinned board wants, and the same
    // value the old preset branch passed implicitly.
    const grid = useMemo(() => {
        const preset = DIFFICULTIES[difficultyKey];
        const { rows, cols, mineCount, seed } = preset.isCustom ? customSize : preset;
        // The constructor already leaves a complete unplayed board: cells
        // allocated, `flagCount` and `remainingSafeCells` set, `status` 'ready'
        // and no mines placed. Calling `initialize()` on top of that only
        // re-allocates the cells and advances the seed — and for an unpinned
        // preset that just throws away the number the constructor drew.
        return new Grid(rows, cols, mineCount, seed);
    }, [difficultyKey, customSize]);

    const rerender = useCallback(() => setVersion((v) => v + 1), []);

    const isOver = grid.status === 'win' || grid.status === 'gameover';

    // The clock runs from the first reveal — the moment mines are placed and
    // the game genuinely begins — and stops the instant it is decided. A board
    // nobody has clicked yet is not being timed.
    const timerRunning = grid.status !== 'ready' && !isOver;
    const elapsed = useTimer(timerRunning, gameId);

    // No terminal-status guard here on purpose. `Grid` refuses input once the
    // game is decided — `revealCell`, `toggleFlag` and `chord` each check and
    // return the status unchanged — so a decided game is a property of the
    // model, not something the view has to remember. Duplicating the check here
    // is the version that drifts: it only holds until a fourth entry point is
    // added and someone forgets this one.
    //
    // `rerender` still runs, which is harmless and keeps the callbacks uniform:
    // an extra version bump repaints an unchanged board.
    const reveal = useCallback(
        (row, col) => {
            grid.revealCell(row, col);
            rerender();
        },
        [grid, rerender]
    );

    const toggleFlag = useCallback(
        (row, col) => {
            grid.toggleFlag(row, col);
            rerender();
        },
        [grid, rerender]
    );

    const chord = useCallback(
        (row, col) => {
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
            prev.rows === size.rows &&
            prev.cols === size.cols &&
            prev.mineCount === size.mineCount &&
            prev.seed === size.seed
                ? prev
                : size
        );
        setGameId((id) => id + 1);
    }, []);

    // Read straight off the model. This used to be a `useMemo` that rescanned
    // every cell for `isFlagged` on each version bump — an O(n) pass throwing
    // away two throwaway arrays on every single click. `Grid` maintains the
    // tally itself, so this is now a field read that is correct on any render,
    // for any reason, with nothing to recompute or invalidate.
    const flagsPlaced = grid.flagCount;

    const minesRemaining = Math.max(0, grid.mineCount - flagsPlaced);

    // Distinct from minesRemaining === 0: over-flagging also drives the
    // remainder to zero, but that's a wrong answer, not a solved board.
    const allMinesFlagged = flagsPlaced === grid.mineCount;

    return {
        grid,
        // Not state — see the note on `version` at the top of this file. Passed
        // to Board purely so its `memo` has something that changes to compare.
        version,
        difficulty: DIFFICULTIES[difficultyKey],
        customSize,
        // Bumped on every NEW board — reset, difficulty switch, or applied size —
        // which is exactly when the view's focus cursor should go home. It
        // already existed to restart the clock; `Board` reuses it rather than
        // inferring a reset from a grid comparison that reset cannot produce,
        // since a reset keeps the same dimensions.
        boardId: gameId,
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
