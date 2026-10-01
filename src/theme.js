import { createTheme } from '@mui/material/styles';

// Industrial instrument-panel direction: a dark field, cool blue as the only
// structural accent, amber/red reserved for mines and loss. One dominant
// surface with selective highlights rather than an evenly weighted palette.
const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#4a9eff' },
        secondary: { main: '#f0a02a' },
        error: { main: '#ff5a52' },
        success: { main: '#3ddc84' },
        background: { default: '#0b0d10', paper: '#14181d' },
        text: { primary: '#e8ecf1', secondary: '#8b96a5' },
        divider: 'rgba(255,255,255,0.08)',
    },
    shape: { borderRadius: 6 },
    // Board-specific surfaces. These live here so components reference tokens
    // instead of repeating hex values that drift apart.
    board: {
        // Recessed bezel behind the cells.
        bezel: '#0f1317',
        // Raised (hidden) cell gradient stops.
        keyTop: '#232a33',
        keyBottom: '#1a1f26',
        // A hidden key is a raised surface, so its hover just lightens that
        // gradient. Only ever applied to `raised` cells.
        keyHoverTop: '#2b333d',
        keyHoverBottom: '#20262e',
        // Revealed cell wash, layered over the bezel.
        revealed: 'rgba(255,255,255,0.035)',
        // Hover for a revealed cell. The only interactive revealed cells are
        // the numbers you can chord, and those are flat — so they lift with a
        // heavier version of their own wash rather than the raised-key
        // gradient, which made a revealed number look like a hidden key all
        // over again. Must stay clearly lighter than `revealed` to read as a
        // hover at all.
        revealedHover: 'rgba(255,255,255,0.10)',
        // Mine tint on a revealed cell.
        mineTint: 'rgba(255,90,82,0.14)',
        border: 'rgba(255,255,255,0.07)',
    },
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
    // Gradient stops for the MINESWEEPER wordmark. `top` doubles as the
    // fallback text colour when background-clip: text is unsupported.
    wordmark: {
        top: '#ffffff',
        mid: '#cfe0f5',
        bottom: '#7d9cc4',
    },
    typography: {
        fontFamily: '"Space Grotesk", system-ui, -apple-system, sans-serif',
        // Tabular figures keep the mine counter and revealed numbers from
        // shifting width as they change.
        h5: { fontWeight: 600, letterSpacing: '-0.02em' },
        h6: { fontWeight: 600 },
        body2: { color: '#8b96a5' },
        button: { fontWeight: 500, letterSpacing: '0.01em' },
    },
    components: {
        MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: {
                root: { textTransform: 'none' },
            },
        },
        MuiToggleButton: {
            styleOverrides: {
                root: {
                    textTransform: 'none',
                    borderColor: 'rgba(255,255,255,0.10)',
                    color: '#8b96a5',
                    '&.Mui-selected': {
                        backgroundColor: 'rgba(74,158,255,0.16)',
                        color: '#4a9eff',
                    },
                    '&.Mui-selected:hover': {
                        backgroundColor: 'rgba(74,158,255,0.24)',
                    },
                },
            },
        },
        MuiToggleButtonGroup: {
            styleOverrides: {
                root: { backgroundColor: 'rgba(255,255,255,0.03)' },
            },
        },
    },
});

export default theme;
