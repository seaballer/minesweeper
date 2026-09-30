import { memo } from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import FlagIcon from '@mui/icons-material/Flag';
import BoltIcon from '@mui/icons-material/Bolt';

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
            content = <BoltIcon sx={{ fontSize: 'calc(var(--cell) * 0.57)' }} />;
        } else if (neighborMines > 0) {
            content = neighborMines;
        }
    } else if (isFlagged) {
        content = <FlagIcon sx={{ fontSize: 'calc(var(--cell) * 0.5)' }} />;
    }

    const raised = !isVisible;

    const label = [
        `Row ${row + 1} column ${col + 1}`,
        isVisible ? (isMine ? 'mine' : neighborMines ? `${neighborMines} adjacent mines` : 'clear') : 'hidden',
        isFlagged ? 'flagged' : '',
    ].filter(Boolean).join(', ');

    // Two independent gestures: an unrevealed cell reveals, a revealed number
    // chords. A zero cell is excluded because flood fill already covered it.
    const canReveal = !disabled && !isVisible && !isFlagged;
    // A hidden cell can always be flagged OR unflagged, so a misplaced flag is
    // recoverable without reaching for Reset. The model also refuses to flag a
    // visible cell, so this only needs to cover the hidden half.
    const canFlag = !disabled && !isVisible;
    const canChord = !disabled && isVisible && !isMine && neighborMines > 0;
    const interactive = canReveal || canChord;

    const act = () => {
        if (canReveal) {
            onReveal(row, col);
        } else if (canChord) {
            onChord(row, col);
        }
    };

    return (
        <Box
            component="button"
            type="button"
            onClick={act}
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
                // A short pop is the one moment of motion worth having: it
                // makes a cascade of revealed cells read as a sequence.
                transition: 'transform 90ms ease-out, background-color 140ms ease',
                transform: raised ? 'none' : 'scale(0.96)',
                color: isVisible && !isMine
                    ? NUMBER_COLORS[neighborMines] ?? 'text.primary'
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
                            : 'board.revealed',
                ...(raised && {
                    backgroundImage: `linear-gradient(180deg, ${theme.board.keyTop} 0%, ${theme.board.keyBottom} 100%)`,
                }),
                boxShadow: isExploded
                    ? 'inset 0 0 0 1px rgba(255,255,255,0.25)'
                    : raised
                        ? 'inset 0 1px 0 rgba(255,255,255,0.07), 0 2px 0 rgba(0,0,0,0.35)'
                        : 'none',

                ...(interactive && {
                    '&:hover': {
                        backgroundImage: `linear-gradient(180deg, ${theme.board.keyHoverTop} 0%, ${theme.board.keyHoverBottom} 100%)`,
                    },
                }),
                '&:active': interactive ? { transform: 'translateY(1px)' } : {},
                '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '2px',
                },
            }}
        >
            {isMine && isVisible ? (
                <Box sx={{ color: isExploded ? '#fff' : 'error.main', display: 'flex' }}>
                    {content}
                </Box>
            ) : content}
        </Box>
    );
}

export default memo(CellButton);
