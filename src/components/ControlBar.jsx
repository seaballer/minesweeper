import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import MineIcon from './MineIcon.jsx';
import { DIFFICULTY_LIST } from '../game/difficulties.js';

/**
 * Instrument readout: difficulty on the left, mine counter and reset grouped
 * on the right so the number sits next to the control that clears it.
 */
export default function ControlBar({ minesRemaining, allMinesFlagged, difficultyKey, onDifficultyChange, onReset }) {
    const theme = useTheme();

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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                <Box
                    sx={{
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
                            // Green only when the flags actually add up.
                            // Coloring the clamped remainder would show green
                            // while the player has over-flagged and is wrong.
                            // Colour comes from the wrapper so the icon matches.
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
        </Box>
    );
}
