import { memo } from 'react';
import Box from '@mui/material/Box';
import CellButton from './CellButton.jsx';

// Spacing constants, named so the sizing math stays readable and the test
// harness can import the same numbers instead of hand-copying them.
const GAP = 3;
const PAD = 16;
const BORDER = 1;
// Board padding (2 * PAD) plus its 1px border on each side.
const BOARD_CHROME = PAD * 2 + BORDER * 2;
// Fixed cell edge length. Constant across every board size on purpose.
const CELL = 30;

export { GAP, BOARD_CHROME, PAD, BORDER, CELL };

/**
 * The board itself: a fixed grid of cells, one click handler per input.
 *
 * Memoized, and that needs care. `grid` is the same object on every render and
 * the cells inside it are mutated in place, so on a click *no* prop here
 * changes — a bare `memo` would compare equal and the board would go dead.
 * `version` is the one prop that does move, and it exists purely to be that
 * signal. Do not memoize this component away from it, and do not use
 * `version` for anything.
 *
 * What it buys: `useTimer` re-renders App four times a second, and without
 * this that rebuilt all 480 cells every quarter second to redraw one clock.
 * Now the tick leaves the board alone and only a real move repaints it.
 */
function Board({ grid, version: _version, onReveal, onFlag, onChord, disabled }) {
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
                // It is a CONSTANT. Cells used to shrink on wider boards so
                // they would fit the container, which meant an Expert cell was
                // visibly smaller than a Beginner one. A constant size keeps
                // the grid readable and the digits the same size on every
                // difficulty; the board grows instead, and the Container is
                // sized in App.jsx to accommodate the widest preset.
                //
                // The wrapper scrolls if a board ever exceeds the available
                // width (phones), rather than shrinking cells below tappable.
                '--cell': `${CELL}px`,
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
                        isWrongFlag={cell.isWrongFlag}
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

// `_version` is bound but never read: it is here so `memo` has a prop whose
// value changes. The rename keeps the linter quiet without an inline disable.
// Renaming the local does not affect this — `memo` compares the props object
// App passed in, where the key is still `version`.
export default memo(Board);
