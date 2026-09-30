import { useEffect, useRef, useState } from 'react';

/**
 * Counts seconds while `running` is true, zeroing whenever `resetKey` changes.
 *
 * Timing is derived from a start timestamp rather than by incrementing a
 * counter on an interval, so a throttled background tab can't make the clock
 * drift or stall. The interval only exists to force a repaint.
 *
 * @param {boolean} running  whether the clock should be counting
 * @param {number}  resetKey change this to zero the clock (e.g. on a new game)
 * @returns {number} elapsed whole seconds
 */
export function useTimer(running, resetKey) {
    const [elapsed, setElapsed] = useState(0);
    const startedAt = useRef(null);
    // Tracks the key the current elapsed value belongs to, so a new game can
    // be detected without relying on `elapsed` being read out of state.
    const lastKey = useRef(resetKey);

    useEffect(() => {
        const isNewGame = resetKey !== lastKey.current;
        lastKey.current = resetKey;

        if (isNewGame) {
            setElapsed(0);
            startedAt.current = running ? Date.now() : null;
            return;
        }

        // Resume an existing clock (e.g. the board is un-decided) without
        // discarding the time already counted.
        startedAt.current = running ? Date.now() - elapsed * 1000 : null;
        // `elapsed` is intentionally not a dependency: including it would
        // re-anchor the baseline on every tick and freeze the clock.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [running, resetKey]);

    useEffect(() => {
        if (!running) {
            return undefined;
        }

        const tick = () => {
            if (startedAt.current !== null) {
                setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
            }
        };

        tick();
        const id = setInterval(tick, 250);
        return () => clearInterval(id);
    }, [running, resetKey]);

    return elapsed;
}

/** Formats seconds as m:ss, the way a game clock is normally shown. */
export function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainder = seconds % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
}
