import { createTheme } from '@mui/material/styles';

// Minimal, Material-inspired theme. Neutrals with a single blue accent keeps
// the board legible without competing for attention.
const theme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#1976d2' },
        background: { default: '#f5f5f5', paper: '#ffffff' },
    },
    shape: {
        borderRadius: 8,
    },
    typography: {
        fontFamily: [
            '-apple-system',
            'BlinkMacSystemFont',
            '"Segoe UI"',
            'Roboto',
            'Helvetica',
            'Arial',
            'sans-serif',
        ].join(','),
        h5: { fontWeight: 500 },
    },
    components: {
        MuiButton: {
            // Flat, low-emphasis buttons suit the minimalist look.
            styleOverrides: {
                root: { textTransform: 'none' },
            },
        },
    },
});

export default theme;
