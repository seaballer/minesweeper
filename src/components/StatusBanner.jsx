import Box from '@mui/material/Box';

const MESSAGES = {
    win: 'Field clear. Every safe square found.',
    gameover: 'Detonated. Reset and try again.',
};

/**
 * Result banner.
 *
 * The live region is always present and only its text changes. Mounting the
 * region and its content in the same commit would leave most screen readers
 * silent, since a live region has to exist before its content changes.
 */
export default function StatusBanner({ status }) {
    const message = MESSAGES[status] ?? '';
    const won = status === 'win';

    return (
        <Box
            role="status"
            aria-live="polite"
            sx={{
                minHeight: 40,
                display: 'flex',
                alignItems: 'center',
                px: 1.5,
                borderRadius: 1.5,
                border: '1px solid',
                // Reserve the space so the board doesn't jump when the result
                // appears; only the colors change.
                borderColor: message ? (won ? 'rgba(61,220,132,0.35)' : 'rgba(255,90,82,0.35)') : 'transparent',
                backgroundColor: message
                    ? (won ? 'rgba(61,220,132,0.06)' : 'rgba(255,90,82,0.06)')
                    : 'transparent',
                color: won ? 'success.main' : 'error.main',
                fontSize: 14,
                fontWeight: 500,
                transition: 'background-color 160ms ease, border-color 160ms ease',
            }}
        >
            {message}
        </Box>
    );
}
