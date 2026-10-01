import { useCallback, useEffect, useState } from 'react';
import { addTime, readTimes, writeTimes } from '../game/bestTimes.js';

/**
 * The player's best times, and a way to bank a finished run.
 *
 * Storage is written from an effect rather than from inside the state updater,
 * because a state updater must stay pure — React is entitled to call it twice,
 * and a side effect there would write twice and desync.
 */
export function useBestTimes() {
    const [times, setTimes] = useState(readTimes);

    const record = useCallback((difficultyKey, seconds) => {
        setTimes((previous) => addTime(previous, difficultyKey, seconds));
    }, []);

    useEffect(() => {
        writeTimes(times);
    }, [times]);

    return { times, record };
}
