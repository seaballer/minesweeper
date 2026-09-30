// Board sizes offered in the difficulty selector. `key` is a stable id used as
// the React key and for lookup; `label` is what the user sees.
//
// `custom` is special: its dimensions come from the player's input rather than
// these presets, so it carries no rows/cols/mineCount of its own.
export const DIFFICULTIES = {
    beginner: { key: 'beginner', label: 'Beginner', rows: 9, cols: 9, mineCount: 10 },
    intermediate: { key: 'intermediate', label: 'Intermediate', rows: 16, cols: 16, mineCount: 40 },
    expert: { key: 'expert', label: 'Expert', rows: 16, cols: 30, mineCount: 99 },
    custom: { key: 'custom', label: 'Custom', isCustom: true },
};

export const DEFAULT_DIFFICULTY = 'beginner';

export const DIFFICULTY_LIST = Object.values(DIFFICULTIES);

export const CUSTOM_KEY = 'custom';

// Bounds for the custom board. The upper end is what stays legible on screen.
// The minimum is 2 because a 1-cell board with 1 mine has no safe first click
// and is therefore unwinnable, whatever the mine count.
export const CUSTOM_LIMITS = {
    minRows: 2,
    maxRows: 30,
    minCols: 2,
    maxCols: 30,
    minMines: 1,
    // Seeds are pinned through mulberry32, which coerces to uint32, so any
    // non-negative integer up to 2^32-1 is meaningful and reproducible.
    minSeed: 0,
    maxSeed: 4294967295,
};

export const DEFAULT_CUSTOM = { rows: 12, cols: 14, mineCount: 25 };

/**
 * Validates custom board input and returns a usable config.
 *
 * Never throws: invalid input falls back to the previous/default value, so a
 * half-typed number in the field can never produce an unplayable board.
 */
export function resolveCustom(input, previous = DEFAULT_CUSTOM) {
    const clampInt = (value, min, max, fallback) => {
        const bound = (n) => Math.min(max, Math.max(min, n));
        const parsed = Number.parseInt(value, 10);
        // The fallback must be clamped too, not returned verbatim: it can come
        // from a previous board that was much larger, which would otherwise
        // allow more mines than the new board has safe cells.
        return Number.isFinite(parsed) ? bound(parsed) : bound(fallback);
    };

    const rows = clampInt(input.rows, CUSTOM_LIMITS.minRows, CUSTOM_LIMITS.maxRows, previous.rows);
    const cols = clampInt(input.cols, CUSTOM_LIMITS.minCols, CUSTOM_LIMITS.maxCols, previous.cols);

    // A board needs at least one safe cell, or the first click can never be
    // safe and the game is unwinnable.
    const maxMines = rows * cols - 1;
    const mineCount = clampInt(
        input.mineCount,
        CUSTOM_LIMITS.minMines,
        Math.max(CUSTOM_LIMITS.minMines, maxMines),
        previous.mineCount
    );

    return { rows, cols, mineCount };
}
