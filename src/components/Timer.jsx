import TimerIcon from '@mui/icons-material/TimerOutlined';
import Box from '@mui/material/Box';
import { useTheme } from '@mui/material/styles';
import { formatTime } from '../hooks/useTimer.js';

/**
 * Elapsed-time readout.
 *
 * `role="timer"` (implicit `aria-live="off"`) is deliberate: a clock that
 * changes every second should not interrupt whatever the screen reader is
 * saying. The current time is still exposed through `aria-label`, so it is
 * available on demand.
 */
export default function Timer({ elapsed, running }) {
    const theme = useTheme();

    return (
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
                color: running ? 'primary.main' : 'text.secondary',
            }}
        >
            <TimerIcon sx={{ fontSize: 16 }} />
            <Box
                component="div"
                role="timer"
                aria-live="off"
                aria-label={`Elapsed time ${formatTime(elapsed)}`}
                sx={{
                    fontFamily: theme.mono,
                    fontSize: 20,
                    fontWeight: 600,
                    lineHeight: 1.1,
                    fontVariantNumeric: 'tabular-nums',
                }}
            >
                {formatTime(elapsed)}
            </Box>
        </Box>
    );
}
