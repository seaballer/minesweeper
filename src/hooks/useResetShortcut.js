import { useEffect } from 'react';

/**
 * Resets the board when `r` is pressed anywhere on the page.
 *
 * Ignores the key while focus is in a text field, otherwise typing "r" into
 * the custom board-size inputs would wipe the current game.
 *
 * @param {Function} onReset    callback to run
 * @param {boolean}  suspended  set true to disable, e.g. while a dialog is open
 */
export function useResetShortcut(onReset, suspended = false) {
    useEffect(() => {
        const handler = (event) => {
            if (suspended) {
                return;
            }
            if (event.repeat) {
                return;
            }
            if (event.key !== 'r' && event.key !== 'R') {
                return;
            }
            if (event.metaKey || event.ctrlKey || event.altKey) {
                return;
            }

            const target = event.target;
            const tag = target?.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || target?.isContentEditable) {
                return;
            }

            // Nothing in the app has a native binding for "r", so
            // preventDefault would only swallow the key.
            onReset();
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onReset, suspended]);
}
