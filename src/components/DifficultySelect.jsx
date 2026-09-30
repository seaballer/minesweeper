import Box from '@mui/material/Box';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { DIFFICULTY_LIST } from '../game/difficulties.js';

/**
 * Difficulty selector. Extracted from ControlBar so the readout row above the
 * board can be mine / reset / timer without the difficulty competing for space.
 */
export default function DifficultySelect({ difficultyKey, onDifficultyChange }) {
    return (
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
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
        </Box>
    );
}
