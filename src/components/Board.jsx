import Box from '@mui/material/Box';
import CellButton from './CellButton.jsx';

/**
 * The board itself: a fixed grid of cells, one click handler per input.
 */
export default function Board({ grid, onReveal, onFlag, disabled }) {
    return (
        <Box
            // `group`, not `grid`: a real ARIA grid requires owned row/gridcell
            // elements and 2-D arrow-key navigation, which this doesn't
            // implement. `group` labels the set without promising a structure
            // that isn't there.
            id="minefield"
            role="group"
            aria-label="Minefield"
            sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${grid.cols}, 30px)`,
                gap: '3px',
                p: 2,
                // Recessed bezel: the board reads as a panel sunk into the
                // page rather than a card sitting on top of it.
                backgroundColor: 'board.bezel',
                borderRadius: 2,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.45)',
                border: '1px solid',
                borderColor: 'board.border',
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
