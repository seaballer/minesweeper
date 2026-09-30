import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import FlagIcon from '@mui/icons-material/Flag';
import CloseIcon from '@mui/icons-material/Close';
import MineIcon from './MineIcon.jsx';

// Digit colors tuned for the dark field: light enough to clear AA contrast
// against the revealed-cell backdrop without glowing.
const NUMBER_COLORS = {
    1: '#5aa9ff',
    2: '#3ddc84',
    3: '#ff7b72',
    4: '#b78cff',
    5: '#f0a02a',
    6: '#2fd4c8',
    7: '#e8ecf1',
    8: '#8b96a5',
};

// Long enough not to fire on a tap, short enough not to feel sluggish.
const LONG_PRESS_MS = 450;

// What a held cell looks like: the key sinking into its own face. This is the
// only feedback a touch user gets that a press registered before the
// long-press fires, and it doubles as the mouse `:active` state.
//
// It is a shadow, not a scale or a nudge, on purpose. See the note on
// `transform` in the sx block — a cell that moves or resizes while pressed
// takes clicks away from itself.
const PRESSED_SHADOW = 'inset 0 2px 5px rgba(0,0,0,0.55)';

/**
 * A single board cell.
 *
 * Takes flat primitive props rather than the `Cell` instance on purpose: `Grid`
 * mutates cells in place, so passing the object would give every render the same
 * reference. That defeats `memo` below and stale cells would never repaint.
 */
function CellButton({
    row,
    col,
    isMine,
    isVisible,
    isFlagged,
    isExploded,
    isWrongFlag,
    neighborMines,
    onReveal,
    onFlag,
    onChord,
    disabled,
}) {
    const theme = useTheme();

    let content = null;
    if (isVisible) {
        if (isMine) {
            content = <MineIcon size="calc(var(--cell) * 0.66)" />;
        } else if (isWrongFlag) {
            // A flag that was wrong: show the cross over the flag it replaced,
            // so the mistake is visible rather than silently corrected.
            content = (
                <Box sx={{ position: 'relative', display: 'flex' }}>
                    <FlagIcon sx={{ fontSize: 'calc(var(--cell) * 0.5)' }} />
                    <CloseIcon
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            margin: 'auto',
                            fontSize: 'calc(var(--cell) * 0.62)',
                            color: 'error.main',
                        }}
                    />
                </Box>
            );
        } else if (neighborMines > 0) {
            content = neighborMines;
        }
    } else if (isFlagged) {
        content = <FlagIcon sx={{ fontSize: 'calc(var(--cell) * 0.5)' }} />;
    }

    const raised = !isVisible;

    const label = [
        `Row ${row + 1} column ${col + 1}`,
        isVisible
            ? isMine
                ? 'mine'
                : neighborMines
                  ? `${neighborMines} adjacent mines`
                  : 'clear'
            : 'hidden',
        isFlagged ? 'flagged' : '',
        isWrongFlag ? 'wrong flag, this cell was safe' : '',
    ]
        .filter(Boolean)
        .join(', ');

    // Two independent gestures: an unrevealed cell reveals, a revealed number
    // chords. A zero cell is excluded because flood fill already covered it.
    const canReveal = !disabled && !isVisible && !isFlagged;
    // A hidden cell can always be flagged OR unflagged, so a misplaced flag is
    // recoverable without reaching for Reset. The model also refuses to flag a
    // visible cell, so this only needs to cover the hidden half.
    const canFlag = !disabled && !isVisible;
    const canChord = !disabled && isVisible && !isMine && neighborMines > 0;
    const interactive = canReveal || canChord;

    // Long-press flags on touch, where there is no right click. A press that
    // already flagged must not also fire the click or contextmenu that some
    // browsers send afterwards, or the flag toggles straight back off.
    const longPressTimer = useRef(null);
    const longPressFired = useRef(false);
    const [pressing, setPressing] = useState(false);

    const clearLongPress = useCallback(() => {
        if (longPressTimer.current !== null) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
        }
    }, []);

    // A pending timer must not fire into a cell that has since unmounted.
    useEffect(() => clearLongPress, [clearLongPress]);

    const startLongPress = useCallback(() => {
        if (!canFlag) {
            return;
        }
        longPressFired.current = false;
        setPressing(true);
        longPressTimer.current = setTimeout(() => {
            longPressTimer.current = null;
            longPressFired.current = true;
            setPressing(false);
            onFlag(row, col);
        }, LONG_PRESS_MS);
    }, [canFlag, onFlag, row, col]);

    const endLongPress = useCallback(() => {
        clearLongPress();
        setPressing(false);
    }, [clearLongPress]);

    const consumeLongPress = useCallback(() => {
        if (!longPressFired.current) {
            return false;
        }
        longPressFired.current = false;
        return true;
    }, []);

    const act = () => {
        if (consumeLongPress()) {
            return;
        }
        if (canReveal) {
            onReveal(row, col);
        } else if (canChord) {
            onChord(row, col);
        }
    };

    // Set when a press already acted, so the `click` that the browser sends
    // afterwards does not act a second time. See onPointerDown.
    const actedOnPress = useRef(false);

    // Act on PRESS, not on click.
    //
    // A browser only fires `click` when the mousedown and mouseup targets
    // agree, and when they disagree it sends the click to their nearest common
    // ancestor instead. Play a board the way a fast player does — sweeping the
    // mouse across it and clicking as you go — and the pointer travels several
    // cells between press and release. Every one of those clicks was dispatched
    // to the board, so no cell ever heard about it. Measured on a recording of
    // that: a median 1719 px/sec, about three cells per click, and exactly one
    // cell revealed across six seconds of clicking — the one click where the
    // mouse happened to be still.
    //
    // `pointerdown` fires on the element the press *started* on, however far the
    // pointer travels afterwards, so the cell the user aimed at is the one that
    // acts. It also removes the wait for release, which is what makes the board
    // feel immediate.
    const onPointerDown = (event) => {
        // Touch keeps the long-press path: acting on press would reveal the very
        // cell the long press exists to flag.
        if (event.pointerType === 'touch') {
            return;
        }
        // Only the primary button. Right click flags and middle click chords,
        // both of which are handled by their own handlers below — acting here
        // too would flag a cell and then reveal or chord it.
        if (event.button !== 0) {
            return;
        }
        actedOnPress.current = true;
        act();
    };

    // Keyboard activation and script-driven clicks still arrive here, and so
    // does every touch tap and a click the pointer wandered off of. The ref
    // makes the press-then-click pair act exactly once.
    const onClick = () => {
        if (actedOnPress.current) {
            actedOnPress.current = false;
            return;
        }
        act();
    };

    return (
        <Box
            component="button"
            type="button"
            onPointerDown={onPointerDown}
            onPointerLeave={() => {
                // A press that started here but ended elsewhere gets no click at
                // all. Drop the flag so the next press is not mistaken for one.
                actedOnPress.current = false;
            }}
            onClick={onClick}
            // Middle click is the conventional chord gesture.
            onAuxClick={(event) => {
                // Middle click only means something on a chordable number, but
                // always suppress the default so the gesture doesn't leave the
                // middle-drag autoscroll cursor armed on other cells.
                if (event.button === 1) {
                    event.preventDefault();
                    if (canChord) {
                        onChord(row, col);
                    }
                }
            }}
            onContextMenu={(event) => {
                // A long press already flagged this cell; swallow the
                // contextmenu some mobile browsers fire after one.
                if (consumeLongPress()) {
                    event.preventDefault();
                    return;
                }
                // Right click flags an unflagged cell and removes a flag. On a
                // revealed number it chords, since that is the gesture people
                // already know from Windows Minesweeper.
                if (canFlag) {
                    event.preventDefault();
                    onFlag(row, col);
                } else if (canChord) {
                    event.preventDefault();
                    onChord(row, col);
                }
            }}
            onTouchStart={startLongPress}
            onTouchEnd={endLongPress}
            // Moving the finger means the user is scrolling, not pressing.
            onTouchMove={endLongPress}
            onTouchCancel={endLongPress}
            onKeyDown={(event) => {
                // 'f' is the keyboard equivalent of right-click, and 'c' the
                // equivalent of chording, so the game is playable without a
                // mouse. Enter/Space fall through to onClick, which chords.
                if (!interactive) {
                    return;
                }
                if (event.key === 'f' || event.key === 'F') {
                    if (canFlag) {
                        event.preventDefault();
                        onFlag(row, col);
                    }
                } else if ((event.key === 'c' || event.key === 'C') && canChord) {
                    event.preventDefault();
                    onChord(row, col);
                }
            }}
            disabled={disabled}
            aria-label={canChord ? `${label}, chord when flags match` : label}
            sx={{
                // Driven by the board's --cell so cells stay square and in
                // lockstep with the grid columns at any board size.
                width: 'var(--cell)',
                height: 'var(--cell)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0,
                border: 'none',
                borderRadius: '5px',
                cursor: interactive ? 'pointer' : 'default',
                fontFamily: theme.mono,
                // Scales with the cell so digits never overflow a shrunken one.
                fontSize: 'calc(var(--cell) * 0.47)',
                fontWeight: 600,
                userSelect: 'none',
                // Deliberately NO `transform` anywhere on a cell, in any state.
                //
                // A transform does not just look different, it changes what the
                // browser hit-tests against: a transformed element is hit on its
                // transformed geometry. This cell used to shrink to `scale(0.96)`
                // once revealed and nudge to `translateY(1px)` on `:active`, both
                // transitioned over 90ms. So the cell physically moved and
                // shrank *while the button was being pressed* — and a browser
                // dispatches `click` to the nearest common ancestor of the
                // mousedown and mouseup targets. Move the cell out from under the
                // cursor mid-click and the click lands on the board instead, and
                // the cell never hears about it. A flood fill made it far worse:
                // dozens of cells started shrinking at once, mid-sweep.
                //
                // Every effect here is paint-only (background, shadow, colour),
                // which cannot change a hit box. Reveal feedback is the surface
                // fading and flattening, not the cell resizing.
                transition: 'background-color 140ms ease, box-shadow 120ms ease',
                // Drops the 300ms tap delay without disabling panning, so the
                // board can still be scrolled on a phone.
                touchAction: 'manipulation',
                color:
                    isVisible && !isMine
                        ? (NUMBER_COLORS[neighborMines] ?? 'text.primary')
                        : isFlagged
                          ? 'secondary.main'
                          : 'text.secondary',

                // Raised cells get a real key feel: a top highlight, a
                // gradient face, and a bottom shadow. Revealed cells go flat.
                // NOTE: the gradient must go through `backgroundImage` —
                // `backgroundColor` only accepts a <color> and silently drops
                // a gradient, which leaves the cell fully transparent.
                backgroundColor: isExploded
                    ? 'error.main'
                    : raised
                      ? 'transparent'
                      : isMine
                        ? 'board.mineTint'
                        : isWrongFlag
                          ? 'rgba(255,90,82,0.10)'
                          : 'board.revealed',
                ...(raised && {
                    backgroundImage: `linear-gradient(180deg, ${theme.board.keyTop} 0%, ${theme.board.keyBottom} 100%)`,
                }),
                boxShadow: isExploded
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.25)'
                    : raised
                      ? pressing
                          ? PRESSED_SHADOW
                          : 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 0 rgba(0,0,0,0.35)'
                      : 'none',

                ...(interactive && {
                    '&:hover': {
                        backgroundImage: `linear-gradient(180deg, ${theme.board.keyHoverTop} 0%, ${theme.board.keyHoverBottom} 100%)`,
                    },
                    // Only while the cell is still hidden. The press reveals it,
                    // so by the time the button is released this cell is flat
                    // and numbered — a sunk shadow there would just look wrong.
                    ...(canReveal && {
                        // Paint-only, for the same reason as everything else
                        // here: a held button must never change its hit box.
                        '&:active': { boxShadow: PRESSED_SHADOW },
                    }),
                }),
                '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                },
            }}
        >
            {/* The glyph inherits currentColor, so the detonated mine reads
                white on red and the others read red on the tint. */}
            {isMine && isVisible ? (
                <Box sx={{ color: isExploded ? 'common.white' : 'error.main', display: 'flex' }}>
                    {content}
                </Box>
            ) : (
                content
            )}
        </Box>
    );
}

export default memo(CellButton);
