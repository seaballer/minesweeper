import IconButton from '@mui/material/IconButton';
import Popover from '@mui/material/Popover';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useState } from 'react';
import { useTheme } from '@mui/material/styles';
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined';
import { formatTime } from '../hooks/useTimer.js';
import { KEEP } from '../game/bestTimes.js';

/**
 * The trophy button, holding the three best times for the current difficulty.
 *
 * Mirrors `ControlsInfo` deliberately: same icon treatment, same
 * anchor-is-the-source-of-truth popover, and the parent is told when it opens
 * so it can stand the reset shortcut down.
 *
 * Not rendered at all on a custom board — see `isRanked` for why those times
 * would mean nothing.
 */
export default function BestTimes({ times, difficultyLabel, open, onOpenChange }) {
    const theme = useTheme();
    const [anchor, setAnchor] = useState(null);

    // Same reasoning as ControlsInfo: one piece of state, `open` derived from
    // it, and no effect syncing the two.
    const close = () => {
        setAnchor(null);
        onOpenChange(false);
    };

    const best = times ?? [];

    return (
        <>
            <IconButton
                aria-label={`Best times for ${difficultyLabel}`}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={(event) => {
                    const next = open ? null : event.currentTarget;
                    setAnchor(next);
                    onOpenChange(next !== null);
                }}
                title={`Best times for ${difficultyLabel}`}
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
                <EmojiEventsOutlinedIcon sx={{ fontSize: 18 }} />
            </IconButton>

            <Popover
                open={open}
                anchorEl={anchor}
                onClose={close}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                slotProps={{
                    paper: {
                        // On the paper, not the Popover root: the root is a
                        // full-viewport backdrop, the paper is the surface that
                        // is actually the focus boundary.
                        role: 'dialog',
                        'aria-modal': true,
                        'aria-label': `Best times for ${difficultyLabel}`,
                        sx: {
                            mt: 1,
                            p: 2,
                            minWidth: 180,
                            backgroundColor: 'background.paper',
                            border: '1px solid rgba(255,255,255,0.10)',
                            boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
                        },
                    },
                }}
            >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                    {difficultyLabel}
                </Typography>

                {best.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                        No times yet
                    </Typography>
                ) : (
                    <Box
                        component="ol"
                        sx={{ m: 0, p: 0, listStyle: 'none', display: 'grid', gap: 0.5 }}
                    >
                        {best.map((seconds, index) => (
                            <Box
                                component="li"
                                key={`${seconds}-${index}`}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'baseline',
                                    gap: 1,
                                    fontFamily: theme.mono,
                                    fontSize: 14,
                                    color: 'text.primary',
                                }}
                            >
                                {/* Repeats are genuine separate runs at the same
                                    whole second, so they are listed rather than
                                    collapsed. */}
                                <Typography
                                    component="span"
                                    variant="caption"
                                    sx={{ color: 'text.secondary', width: 12 }}
                                >
                                    {index + 1}
                                </Typography>
                                <span>{formatTime(seconds)}</span>
                            </Box>
                        ))}
                    </Box>
                )}

                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: 'block', mt: 1.5 }}
                >
                    {`Best ${KEEP}`}
                </Typography>
            </Popover>
        </>
    );
}
