import { memo } from 'react';
import Box from '@mui/material/Box';
import FlagIcon from '@mui/icons-material/Flag';
import BoltIcon from '@mui/icons-material/Bolt';

// Standard Minesweeper digit colors, kept for familiarity.
const NUMBER_COLORS = {
    1: '#1976d2',
    2: '#2e7d32',
    3: '#d32f2f',
    4: '#6a1b9a',
    5: '#8d6e63',
    6: '#00838f',
    7: '#455a64',
    8: '#9e9e9e',
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
    let content = null;
    if (isVisible) {
        if (isMine) {
            content = <BoltIcon sx={{ fontSize: 18 }} color={isExploded ? 'error' : 'inherit'} />;
        } else if (neighborMines > 0) {
            content = neighborMines;
        }
    } else if (isFlagged) {
        content = <FlagIcon sx={{ fontSize: 16 }} color="error" />;
    }

    // Unrevealed and flagged cells stay raised; everything else is flat.
    const raised = !isVisible;

    return (
        <Box
            component="button"
            type="button"
            onClick={() => onReveal(row, col)}
            onContextMenu={(event) => {
                // Right click flags, and the browser menu would otherwise show.
                event.preventDefault();
                onFlag(row, col);
            }}
            disabled={disabled}
            aria-label={`Row ${row + 1} column ${col + 1}${isMine ? ', mine' : ''}${isFlagged ? ', flagged' : ''}`}
            sx={{
                width: 30,
                height: 30,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                p: 0,
                border: '1px solid',
                borderColor: raised ? 'divider' : 'transparent',
                borderRadius: '4px',
                cursor: disabled ? 'default' : 'pointer',
                fontSize: 14,
                fontWeight: 700,
                userSelect: 'none',
                color: isVisible && !isMine
                    ? NUMBER_COLORS[neighborMines] ?? 'text.primary'
                    : 'text.primary',
                backgroundColor: isExploded
                    ? 'error.main'
                    : isMine && isVisible
                        ? 'grey.300'
                        : raised
                            ? 'grey.100'
                            : 'transparent',
                '&:hover': {
                    backgroundColor: disabled || !raised ? undefined : 'grey.200',
                },
                '&:focus-visible': {
                    outline: '2px solid',
                    outlineColor: 'primary.main',
                    outlineOffset: '-2px',
                },
            }}
        >
            {content}
        </Box>
    );
}

export default memo(CellButton);