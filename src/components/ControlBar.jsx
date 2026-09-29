import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DIFFICULTY_LIST } from '../game/difficulties.js';

/**
 * Instrument readout: mine counter, difficulty selector, and reset.
 */
export default function ControlBar({ minesRemaining, allMinesFlagged, difficultyKey, onDifficultyChange, onReset }) {
    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 2,
            }}
        >
            <Box
                sx={{
                    minWidth: 96,
                    px: 1.5,
                    py: 0.75,
                    borderRadius: 1.5,
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
                }}
            >
                <Typography
                    component="div"
                    // `role="status"` because aria-label is ignored on a plain
                    // div; the role also announces the count when it changes.
                    role="status"
                    id="mine-counter"
                    aria-label={`${minesRemaining} mines remaining`}
                    sx={{
                        fontFamily: 'mono',
                        fontSize: 22,
                        fontWeight: 600,
                        lineHeight: 1.1,
                        // Green only when the flags actually add up. Coloring
                        // the clamped remainder would show green while the
                        // player has over-flagged and is provably wrong.
                        color: allMinesFlagged ? 'success.main' : 'secondary.main',
                        fontVariantNumeric: 'tabular-nums',
                    }}
                >
                    {String(minesRemaining).padStart(3, '0')}
                </Typography>
            </Box>

            <ToggleButtonGroup
                exclusive
                size="small"
                value={difficultyKey}
                onChange={(_event, value) => {
                    // null arrives when the active button is clicked again.
                    if (value !== null) {
                        onDifficultyChange(value);
                    }
                }}
                aria-label="Difficulty"
            >
                {DIFFICULTY_LIST.map(({ key, label }) => (
                    <ToggleButton key={key} value={key} sx={{ px: 1.75, py: 0.75 }}>
                        {label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                onClick={onReset}
                sx={{
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
        </Box>
    );
}
