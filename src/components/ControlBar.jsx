import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import RefreshIcon from '@mui/icons-material/Refresh';
import { DIFFICULTY_LIST } from '../game/difficulties.js';

/**
 * Header controls: mine counter, difficulty selector, and reset.
 */
export default function ControlBar({ minesRemaining, difficultyKey, onDifficultyChange, onReset }) {
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
            <Typography
                variant="h6"
                component="div"
                aria-label={`${minesRemaining} mines remaining`}
                sx={{ fontVariantNumeric: 'tabular-nums', minWidth: 88 }}
            >
                {String(minesRemaining).padStart(3, '0')}
            </Typography>

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
                    <ToggleButton key={key} value={key} sx={{ textTransform: 'none' }}>
                        {label}
                    </ToggleButton>
                ))}
            </ToggleButtonGroup>

            <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={onReset}
                sx={{ minWidth: 88 }}
            >
                Reset
            </Button>
        </Box>
    );
}
