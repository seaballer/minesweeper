import Alert from '@mui/material/Alert';

const MESSAGES = {
    win: 'Cleared — you found every safe square.',
    gameover: 'Boom. Reset and try again.',
};

/**
 * Result banner. Renders nothing until the game is decided.
 */
export default function StatusBanner({ status }) {
    const message = MESSAGES[status];
    if (!message) {
        return null;
    }

    return (
        <Alert severity={status === 'win' ? 'success' : 'error'} sx={{ py: 0 }}>
            {message}
        </Alert>
    );
}
