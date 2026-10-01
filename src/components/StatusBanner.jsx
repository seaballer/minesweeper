import Box from '@mui/material/Box';

// Just the outcome. The board itself already shows what happened, and the
// banner only has to say which of the two it was.
const MESSAGES = {
    win: 'Completed',
    gameover: 'Try Again',
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
                // Sized to its words and centered. A `Stack` stretches its
                // children, so without these the result drew a bordered bar
                // right across the viewport for a single short word.
                width: 'fit-content',
                maxWidth: '100%',
                alignSelf: 'center',
                borderRadius: 1.5,
                border: '1px solid',
                // Reserve the space so the board doesn't jump when the result
                // appears; only the colors change.
                borderColor: message
                    ? won
                        ? 'rgba(61,220,132,0.35)'
                        : 'rgba(255,90,82,0.35)'
                    : 'transparent',
                backgroundColor: message
                    ? won
                        ? 'rgba(61,220,132,0.06)'
                        : 'rgba(255,90,82,0.06)'
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
