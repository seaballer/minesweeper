import { memo, useCallback, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
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
    const theme = useTheme();
    const boardRef = useRef(null);

    // Roving tabindex. Exactly one cell is in the page's tab order at a time, so
    // Tab enters the board once, arrows move within it, and Tab then leaves —
    // instead of tabbing through 81 or 480 buttons. Every cell stays focusable
    // programmatically; only one is reachable by Tab.
    const [cursor, setCursor] = useState({ row: 0, col: 0 });

    // A new board is a new set of cells, so the cursor goes home. Keyed on the
    // grid instance, not on `version`: that changes on every move.
    //
    // Clamped at read time rather than reset by an effect: an effect calling
    // setState here would cascade a render, and React's guidance is to adjust
    // state during render instead. Clamping also means a smaller board keeps you
    // near where you were, and — the reason it matters — can never leave the
    // grid with no tabbable cell at all.
    const cursorRow = Math.min(cursor.row, grid.rows - 1);
    const cursorCol = Math.min(cursor.col, grid.cols - 1);

    const focusCell = useCallback(
        (row, col) => {
            const next = {
                row: Math.min(Math.max(row, 0), grid.rows - 1),
                col: Math.min(Math.max(col, 0), grid.cols - 1),
            };
            setCursor(next);
            boardRef.current?.querySelector(`[data-cell="${next.row}-${next.col}"]`)?.focus();
        },
        [grid.rows, grid.cols]
    );

    // Focus can arrive by click or by Tab, not only by arrow, so the cursor
    // follows whatever actually holds focus. React's onFocus bubbles.
    const onFocus = (event) => {
        const where = event.target?.dataset?.cell;
        if (!where) return;
        const [row, col] = where.split('-').map(Number);
        setCursor({ row, col });
    };

    const onKeyDown = (event) => {
        // PageUp/PageDown jump four rows, which is a comfortable sweep on a
        // 30px cell without overshooting a small board.
        const moves = {
            ArrowUp: [-1, 0],
            ArrowDown: [1, 0],
            ArrowLeft: [0, -1],
            ArrowRight: [0, 1],
            PageUp: [-4, 0],
            PageDown: [4, 0],
        };
        const move = moves[event.key];
        if (move) {
            // The board would otherwise scroll the page as the cursor runs off
            // the edge, and the clamped cell would never get the key.
            event.preventDefault();
            focusCell(cursorRow + move[0], cursorCol + move[1]);
            return;
        }
        if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            const last = event.key === 'End';
            const jumpAll = event.ctrlKey || event.metaKey;
            focusCell(jumpAll ? (last ? grid.rows - 1 : 0) : cursorRow, last ? grid.cols - 1 : 0);
            return;
        }
        // Everything else — 'f', 'c', Enter, Space — belongs to the cell itself.
    };

    return (
        <Box
            // A real ARIA grid, which this now is: owned rows and gridcells, and
            // 2-D arrow-key navigation. It was `group` before precisely because
            // that structure was missing, and the roles below were not claimed
            // until it existed.
            id="minefield"
            role="grid"
            aria-label="Minefield"
            aria-rowcount={grid.rows}
            aria-colcount={grid.cols}
            ref={boardRef}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
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
                //
                // Read off the theme object, not as the dotted string
                // 'board.bezel': MUI only resolves the shorthands it knows
                // about, and any other dotted string lands in the stylesheet
                // verbatim as invalid CSS that the browser silently drops.
                backgroundColor: theme.board.bezel,
                borderRadius: 2,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 20px 50px rgba(0,0,0,0.45)',
                border: '1px solid',
                borderColor: theme.board.border,
                width: 'fit-content',
            }}
        >
            {grid.cells.map((row, rowIndex) => (
                // `display: contents` so the row owns the semantics without
                // owning a box — the cells stay direct children of the CSS grid,
                // so the track and gap arithmetic above is untouched.
                <Box key={rowIndex} role="row" sx={{ display: 'contents' }}>
                    {row.map((cell, colIndex) => (
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
                            // Roving tabindex: one cell is tabbable, the rest
                            // are reachable only by arrow keys or script.
                            tabIndex={cursorRow === rowIndex && cursorCol === colIndex ? 0 : -1}
                            cellRef={`${rowIndex}-${colIndex}`}
                        />
                    ))}
                </Box>
            ))}
        </Box>
    );
}

// `_version` is bound but never read: it is here so `memo` has a prop whose
// value changes. The rename keeps the linter quiet without an inline disable.
// Renaming the local does not affect this — `memo` compares the props object
// App passed in, where the key is still `version`.
export default memo(Board);
