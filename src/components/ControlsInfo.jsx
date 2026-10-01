import IconButton from '@mui/material/IconButton';

import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

// Mouse only. Every shortcut in here is also reachable by keyboard, so
// hiding it on coarse pointers loses nothing.
const CONTROLS = [
    ['Left click', 'Reveal a cell'],
    ['Right click', 'Flag a cell, or remove a flag'],
    ['Long press', 'Flag a cell, for touch screens'],
    ['Click a number', 'Chord — reveal its neighbors once the flags around it add up'],
    ['Middle click', 'Chord, same as clicking a number'],
];

const KEYS = [
    ['F', 'Flag the focused cell'],
    ['C', 'Chord the focused cell'],
    ['R', 'Reset the board'],
];

const Section = ({ title, rows, mono }) => (
    <Box sx={{ mb: 1.5 }}>
        <Typography
            variant="caption"
            sx={{
                color: 'primary.main',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                fontWeight: 600,
            }}
        >
            {title}
        </Typography>
        <Box component="dl" sx={{ m: 0, mt: 0.75, display: 'grid', gap: 0.5 }}>
            {rows.map(([key, description]) => (
                <Box
                    key={key}
                    sx={{ display: 'grid', gridTemplateColumns: 'minmax(72px, auto) 1fr', gap: 1 }}
                >
                    <Box
                        component="dt"
                        sx={{
                            fontFamily: mono,
                            fontSize: 12,
                            color: 'text.primary',
                            backgroundColor: 'rgba(255,255,255,0.06)',
                            border: '1px solid rgba(255,255,255,0.10)',
                            borderRadius: 0.75,
                            px: 0.75,
                            py: '1px',
                            textAlign: 'center',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        {key}
                    </Box>
                    <Typography
                        component="dd"
                        variant="body2"
                        sx={{ m: 0, color: 'text.secondary', fontSize: 13 }}
                    >
                        {description}
                    </Typography>
                </Box>
            ))}
        </Box>
    </Box>
);

/**
 * The info button, which holds the full control reference in a popover.
 *
 * Replaces an always-visible paragraph: the rules were the loudest thing on
 * the page and most players never need them after the first game.
 */
export default function ControlsInfo({ open, onOpenChange }) {
    const theme = useTheme();
    const [anchor, setAnchor] = useState(null);

    // `anchor` is the single source of truth and `open` is derived from it, so
    // there is no effect syncing one to the other — that caused a cascading
    // render, and could in principle desync the two. The parent only needs to
    // *know* whether the dialog is up, so it is told on each change instead.
    const close = () => {
        setAnchor(null);
        onOpenChange(false);
    };

    return (
        <>
            <IconButton
                aria-label="Show controls and keyboard shortcuts"
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={(event) => {
                    // Toggle. Setting the anchor unconditionally would leave
                    // the popover open on every subsequent click.
                    const next = open ? null : event.currentTarget;
                    setAnchor(next);
                    onOpenChange(next !== null);
                }}
                // A native title rather than MUI's Tooltip, which costs ~31kB
                // for a single string. The aria-label carries the same text.
                title="Controls and keyboard shortcuts"
                size="small"
                sx={{
                    color: 'text.secondary',
                    border: '1px solid rgba(255,255,255,0.10)',
                    borderRadius: '50%',
                    '&:hover': {
                        color: 'primary.main',
                        borderColor: 'primary.main',
                        backgroundColor: 'rgba(74,158,255,0.08)',
                    },
                }}
            >
                <InfoOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>

            <Popover
                open={open}
                anchorEl={anchor}
                onClose={close}
                // MUI's Popover does not set a role, so give it one: this is a
                // dialog, and a screen reader should say so.
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                slotProps={{
                    paper: {
                        // On the paper, not the Popover root: the root is a
                        // full-viewport backdrop, and the paper is the surface
                        // that is actually the focus boundary.
                        role: 'dialog',
                        'aria-modal': true,
                        'aria-label': 'Controls and keyboard shortcuts',
                        sx: {
                            mt: 1,
                            p: 2,
                            maxWidth: 320,
                            backgroundColor: 'background.paper',
                            border: '1px solid rgba(255,255,255,0.10)',
                            boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
                        },
                    },
                }}
            >
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    Controls
                </Typography>
                <Section title="Mouse" rows={CONTROLS} mono={theme.mono} />
                <Divider sx={{ my: 1.5, borderColor: 'divider' }} />
                <Section title="Keyboard" rows={KEYS} mono={theme.mono} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Mines are placed on your first click, so it is always safe — unless you pinned
                    the board with a seed.
                </Typography>
            </Popover>
        </>
    );
}
