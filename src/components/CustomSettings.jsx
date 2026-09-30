import { useState } from 'react';
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
 *
 * The parent must pass a `key` derived from the applied config, so switching
 * difficulty or size remounts this with fresh drafts. React's guidance for
 * "adjusting state when a prop changes" is to reset it with a key rather than
 * an effect, which would cause a cascading render on every change.
 */
export default function CustomSettings({ value, onApply }) {
    const theme = useTheme();
    const [draft, setDraft] = useState({
        rows: String(value.rows),
        cols: String(value.cols),
        mineCount: String(value.mineCount),
    });

    const preview = resolveCustom(draft, value);
    // Compare resolved values, not the raw strings: typing "016" against an
    // applied "16" is not a change, and Enter would otherwise re-apply
    // the same board.
    const dirty =
        preview.rows !== value.rows ||
        preview.cols !== value.cols ||
        preview.mineCount !== value.mineCount;

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
            <Typography variant="caption" color="text.secondary">
                {label}
            </Typography>
            <input
                type="number"
                inputMode="numeric"
                value={draft[name]}
                min={min}
                max={max}
                aria-label={label}
                className="custom-input"
                onChange={(e) => {
                    const raw = e.target.value;

                    // Snap to the limit the moment a value is typed past it,
                    // rather than only clamping on Apply. The field can then
                    // never hold a value the board cannot use. An empty or
                    // partially-typed value is left alone so typing still
                    // works; resolveCustom covers the rest.
                    if (raw !== '' && /^\d+$/.test(raw)) {
                        const parsed = Number.parseInt(raw, 10);
                        if (max !== undefined && parsed > max) {
                            setDraft((d) => ({ ...d, [name]: String(max) }));
                            return;
                        }
                        if (min !== undefined && parsed < min) {
                            setDraft((d) => ({ ...d, [name]: String(min) }));
                            return;
                        }
                    }

                    setDraft((d) => ({ ...d, [name]: raw }));
                }}
                // The spinners are hidden, so the wheel is the way to nudge a
                // value. Without this, a focused field swallows the scroll and
                // the page jumps instead.
                onWheel={(e) => {
                    if (e.deltaY === 0) return;
                    // Only when the cursor is actually over the input; a
                    // trackpad flick elsewhere shouldn't edit the value.
                    e.preventDefault();
                    const step = e.deltaY < 0 ? 1 : -1;
                    const current = Number.parseInt(draft[name], 10);
                    const base = Number.isFinite(current) ? current : (min ?? 0);
                    const next = Math.max(
                        min ?? Number.NEGATIVE_INFINITY,
                        Math.min(max ?? Number.POSITIVE_INFINITY, base + step)
                    );
                    setDraft((d) => ({ ...d, [name]: String(next) }));
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        onApply(preview);
                    }
                }}
                style={inputStyle}
            />
        </label>
    );

    const adjusted = preview.mineCount !== Number(draft.mineCount);

    // The mine field's ceiling depends on the current rows/cols, so it has to
    // be computed here rather than read from CUSTOM_LIMITS. A board always
    // needs one safe cell, or the first click can never be safe.
    const maxMines = Math.max(CUSTOM_LIMITS.minMines, preview.rows * preview.cols - 1);

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
            {field('mineCount', 'Mines', CUSTOM_LIMITS.minMines, maxMines)}

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
