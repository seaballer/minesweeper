import Box from '@mui/material/Box';
import CellButton from './CellButton.jsx';

/**
 * The board itself: a fixed grid of cells, one click handler per input.
 */
export default function Board({ grid, onReveal, onFlag, disabled }) {
    return (
        <Box
            role="grid"
            aria-label="Minefield"
            sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${grid.cols}, 30px)`,
                gap: '2px',
                p: 1.5,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                width: 'fit-content',
            }}
        >
            {grid.cells.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                    <CellButton
                        key={`${rowIndex}-${colIndex}`}
                        row={rowIndex}
                        col={colIndex}
                        isMine={cell.isMine}
                        isVisible={cell.isVisible}
                        isFlagged={cell.isFlagged}
                        isExploded={cell.isExploded}
                        neighborMines={cell.neighborMines}
                        onReveal={onReveal}
                        onFlag={onFlag}
                        disabled={disabled}
                    />
                ))
            )}
        </Box>
    );
}
