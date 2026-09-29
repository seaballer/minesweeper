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
    disabled,
}) {
    const theme = useTheme();

    let content = null;
    if (isVisible) {
        if (isMine) {
            content = <BoltIcon sx={{ fontSize: 17 }} />;
        } else if (neighborMines > 0) {
            content = neighborMines;
        }
    } else if (isFlagged) {
        content = <FlagIcon sx={{ fontSize: 15 }} />;
    }

    const raised = !isVisible;
    // Clicking is meaningless once the board is decided, and revealed cells
    // have nothing left to do.
    const interactive = !disabled && raised;

    const label = [
        `Row ${row + 1} column ${col + 1}`,
        isVisible ? (isMine ? 'mine' : neighborMines ? `${neighborMines} adjacent mines` : 'clear') : 'hidden',
        isFlagged ? 'flagged' : '',
    ].filter(Boolean).join(', ');

    return (
        <Box
            component="button"
            type="button"
            onClick={() => interactive && onReveal(row, col)}
            onContextMenu={(event) => {
                // Only suppress the native menu when we actually act on it.
                if (interactive) {
                    event.preventDefault();
                    onFlag(row, col);
                }
            }}
            onKeyDown={(event) => {
                // 'f' is the keyboard equivalent of right-click, so the game is
                // playable without a mouse.
                if (interactive && (event.key === 'f' || event.key === 'F')) {
                    event.preventDefault();
                    onFlag(row, col);
                }
            }}
            disabled={disabled}
            aria-label={label}
            sx={{
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0,
                border: 'none',
                borderRadius: '5px',
                cursor: interactive ? 'pointer' : 'default',
                fontFamily: theme.mono,
                fontSize: 14,
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
