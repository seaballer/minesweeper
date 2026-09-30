import Box from '@mui/material/Box';
import CellButton from './CellButton.jsx';

// Spacing constants, named so the sizing math below stays readable and the
// test harness can import the same numbers instead of hand-copying them.
const GAP = 3;
const PAD = 16;
// Board padding (2 * PAD) plus its 1px border on each side.
const BOARD_CHROME = PAD * 2 + 2;

export { GAP, BOARD_CHROME };

/**
 * The board itself: a fixed grid of cells, one click handler per input.
 */
export default function Board({ grid, onReveal, onFlag, onChord, disabled }) {
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
                // `--cell` is the single source of truth for cell size, read by
                // both the grid tracks and the cells so they cannot disagree.
                //
                // It must size against the CONTAINER, not the viewport: the
                // board sits inside a capped Container, so `100vw` over-reports
                // the space available and expert overflows on wide screens.
                // `cqi` measures the nearest `container-type: inline-size`
                // ancestor (set on the scroll wrapper in App.jsx) and is
                // immune to scrollbar width and Container caps.
                //
                // The 18px floor keeps cells tappable. A 30-wide Expert board
                // on a phone cannot fit below that, so it scrolls there rather
                // than shrinking into nothing.
                '--cell': `clamp(18px, min(30px, calc((100cqi - ${BOARD_CHROME}px - ${(grid.cols - 1) * GAP}px) / ${grid.cols})), 30px)`,
                gridTemplateColumns: `repeat(${grid.cols}, var(--cell))`,
                gap: `${GAP}px`,
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
                        onChord={onChord}
                        disabled={disabled}
                    />
                ))
            )}
        </Box>
    );
}
