import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import MineIcon from './MineIcon.jsx';
import Timer from './Timer.jsx';
import { PAD as BOARD_PADDING, BORDER } from './Board.jsx';

/**
 * The readout row that sits directly above the board: mine count on the left,
 * reset in the middle, timer on the right.
 *
 * The counter and timer keep their own markup and live-region roles; only
 * their position in the layout moved.
 */
export default function ControlBar({
    minesRemaining,
    allMinesFlagged,
    elapsed,
    timerRunning,
    onReset,
}) {
    const theme = useTheme();

    return (
        <Box
            sx={{
                display: 'grid',
                // Equal tracks so the centre control sits on the board's axis
                // regardless of how wide the readouts render.
                gridTemplateColumns: '1fr auto 1fr',
                alignItems: 'center',
                gap: 1.5,
                // Stretch to the shared column, which the board sizes to fit-content.
                // The counter then lines up with the first column of cells and
                // the timer with the last, at every board size.
                width: '100%',
                // Board padding plus its 1px border, so the readouts align to
                // the first and last cell rather than to the bezel edge.
                px: `${BOARD_PADDING + BORDER}px`,
            }}
        >
            <Box
                sx={{
                    justifySelf: 'start',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    py: 0.75,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                    // The icon inherits this, so glyph and digits can never
                    // disagree on colour.
                    color: allMinesFlagged ? 'success.main' : 'secondary.main',
                }}
            >
                <MineIcon size={16} />
                <Typography
                    component="div"
                    // `role="status"` because aria-label is ignored on a
                    // plain div; the role also announces count changes.
                    role="status"
                    id="mine-counter"
                    aria-label={`${minesRemaining} mines remaining`}
                    sx={{
                        fontFamily: theme.mono,
                        fontSize: 20,
                        fontWeight: 600,
                        lineHeight: 1.1,
                        // Green only when the flags actually add up. Coloring
                        // the clamped remainder would show green while the
                        // player has over-flagged and is wrong. Colour comes
                        // from the wrapper so the icon matches.
                        color: 'inherit',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {String(minesRemaining).padStart(3, '0')}
                </Typography>
            </Box>

            <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={onReset}
                aria-keyshortcuts="R"
                sx={{
                    justifySelf: 'center',
                    minWidth: 96,
                    borderColor: 'rgba(255,255,255,0.14)',
                    color: 'text.secondary',
                    '&:hover': {
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        backgroundColor: 'rgba(74,158,255,0.08)',
                    },
                }}
            >
                Reset
            </Button>

            <Box sx={{ justifySelf: 'end' }}>
                <Timer elapsed={elapsed} running={timerRunning} />
            </Box>
        </Box>
    );
}
