import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { useTheme } from '@mui/material/styles';
import { CUSTOM_LIMITS, resolveCustom } from '../game/difficulties.js';

/**
 * Inputs for a custom board size.
 *
 * Built from plain `<input>` elements rather than MUI's `TextField`: TextField
 * drags in the FormControl/InputLabel/FilledInput/OutlinedInput family, which
 * added ~80kB to the bundle for three numeric fields. These inputs are styled
 * by hand to match the rest of the panel.
 *
 * Held as raw strings while editing so a half-typed value like "1" isn't
 * clamped out from under the cursor mid-keystroke. The config only updates on
 * Apply, and `resolveCustom` sanitizes it, so bad input can't reach the grid.
 */
export default function CustomSettings({ value, onApply }) {
    const theme = useTheme();
    const [draft, setDraft] = useState({
        rows: String(value.rows),
        cols: String(value.cols),
        mineCount: String(value.mineCount),
    });

    // Re-sync when the applied config changes from elsewhere (difficulty switch).
    useEffect(() => {
        setDraft({
            rows: String(value.rows),
            cols: String(value.cols),
            mineCount: String(value.mineCount),
        });
    }, [value.rows, value.cols, value.mineCount]);

    const preview = resolveCustom(draft, value);
    const dirty = draft.rows !== String(value.rows)
        || draft.cols !== String(value.cols)
        || draft.mineCount !== String(value.mineCount);

    // A plain object style, so Emotion can't be relied on for vendor or
    // pseudo-element selectors here. `CSS-in-JS-with-@` would allow nesting,
    // but a stylesheet string is simpler for a three-line rule set.
    const inputStyle = {
        width: 84,
        padding: '6px 8px',
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: theme.palette.text.primary,
        fontFamily: theme.mono,
        fontSize: 14,
        outlineOffset: '-1px',
    };

    // Hide the number spinners: they eat width and the typed value is the
    // source of truth, not the arrows.
    const inputCss = `
        .custom-input::-webkit-outer-spin-button,
        .custom-input::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        .custom-input:focus-visible {
            outline: 2px solid ${theme.palette.primary.main};
        }
    `;

    const field = (name, label, min, max) => (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Typography variant="caption" color="text.secondary">{label}</Typography>
            <input
                type="number"
                inputMode="numeric"
                value={draft[name]}
                min={min}
                max={max}
                aria-label={label}
                className="custom-input"
                onChange={(e) => setDraft((d) => ({ ...d, [name]: e.target.value }))}
                style={inputStyle}
            />
        </label>
    );

    const adjusted = preview.mineCount !== Number(draft.mineCount);

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: 1.5,
                flexWrap: 'wrap',
                p: 1.5,
                borderRadius: 1.5,
                backgroundColor: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                // One small stylesheet for the two selectors Emotion can't
                // express in a plain object.
                '& > style': { display: 'none' },
            }}
        >
            <style>{inputCss}</style>
            {field('rows', 'Rows', CUSTOM_LIMITS.minRows, CUSTOM_LIMITS.maxRows)}
            {field('cols', 'Cols', CUSTOM_LIMITS.minCols, CUSTOM_LIMITS.maxCols)}
            {field('mineCount', 'Mines', CUSTOM_LIMITS.minMines, undefined)}

            <Button
                size="small"
                variant="contained"
                disabled={!dirty}
                onClick={() => onApply(preview)}
                sx={{ minWidth: 84, textTransform: 'none' }}
            >
                Apply
            </Button>

            <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', pb: 0.5 }}>
                {preview.rows}×{preview.cols} · {preview.mineCount} mines
                {adjusted && ' (adjusted)'}
            </Typography>
        </Box>
    );
}
