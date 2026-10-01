// Best times per difficulty, kept in the browser.
//
// Persistence is `localStorage`, not a cookie. There is no server behind this
// app, so a cookie would have nothing to say to; it would also attach a small
// value to every request to wherever this is eventually hosted, in exchange for
// a 4kB cap, a per-domain cookie budget, and a parse/stringify dance. If these
// ever do need to be readable server-side, swap `readTimes` and `writeTimes` for
// a cookie and nothing else in the app has to change.

const STORAGE_KEY = 'minesweeper.best-times.v1';

// How many runs to keep, per difficulty.
export const KEEP = 3;

// Only the presets are ranked. A custom board is whatever size and mine count
// the player typed, so its "best time" is not comparable to another custom
// board, let alone to a preset. It gets no leaderboard at all.
export const RANKED_DIFFICULTIES = ['beginner', 'intermediate', 'expert'];

export function isRanked(difficultyKey) {
    return RANKED_DIFFICULTIES.includes(difficultyKey);
}

export function emptyTimes() {
    return { beginner: [], intermediate: [], expert: [] };
}

/**
 * Adds a finished time and returns the new set, keeping only the KEEP lowest.
 *
 * Times are whole seconds, which is exactly what the on-screen clock read when
 * the game was won. Recording anything finer would let the board and the
 * leaderboard disagree about the same run.
 *
 * Pure: returns a fresh object, and rebuilds from RANKED_DIFFICULTIES so the
 * result can only ever have the three preset keys, each an ascending list of at
 * most KEEP non-negative numbers. That makes it safe to call with anything
 * read back off disk.
 */
export function addTime(times, difficultyKey, seconds) {
    if (!isRanked(difficultyKey)) {
        return times;
    }
    if (!Number.isFinite(seconds) || seconds < 0) {
        return times;
    }

    const next = emptyTimes();
    for (const key of RANKED_DIFFICULTIES) {
        const runs = times?.[key] ?? [];
        next[key] = [...runs, ...(key === difficultyKey ? [seconds] : [])]
            .sort((a, b) => a - b)
            .slice(0, KEEP);
    }
    return next;
}

function sanitize(raw) {
    const next = emptyTimes();
    if (!raw || typeof raw !== 'object') {
        return next;
    }
    for (const key of RANKED_DIFFICULTIES) {
        const runs = raw[key];
        if (!Array.isArray(runs)) {
            continue;
        }
        next[key] = runs
            .filter((n) => Number.isFinite(n) && n >= 0)
            .sort((a, b) => a - b)
            .slice(0, KEEP);
    }
    return next;
}

export function readTimes() {
    try {
        const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
        return raw ? sanitize(JSON.parse(raw)) : emptyTimes();
    } catch {
        // Blocked storage (private browsing, site data settings) throws here,
        // and a value someone hand-edited throws on parse. Neither is a reason
        // to stop the game from running, so a leaderboard that cannot persist
        // degrades to one that does not remember.
        return emptyTimes();
    }
}

export function writeTimes(times) {
    try {
        globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(sanitize(times)));
    } catch {
        // Same reasoning as the read: best times are a nicety, not the game.
    }
}
