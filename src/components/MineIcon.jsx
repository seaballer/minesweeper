/**
 * A mine glyph: a spiked ball.
 *
 * MUI has no `Bomb` icon, so it is drawn here. Used for revealed mines on the
 * board and beside the mine counter, so both read as the same object.
 *
 * `size` accepts any CSS length, including a `calc()` against the board's
 * `--cell` variable, which is how cells scale their mine glyph.
 *
 * Decorative: the meaning is carried by the caller's `aria-label`, so it stays
 * out of the accessibility tree and inherits its colour from its wrapper.
 */
export default function MineIcon({ size = 18, color = 'currentColor', ...rest }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
            style={{ display: 'block', color }}
            {...rest}
        >
            {/* Fuse and spikes, radiating from a solid body. */}
            <g stroke={color} strokeWidth="2" strokeLinecap="round">
                <path d="M12 2.5v3.5" />
                <path d="M12 18v3.5" />
                <path d="M2.5 12H6" />
                <path d="M18 12h3.5" />
                <path d="M5.2 5.2l2.5 2.5" />
                <path d="M16.3 16.3l2.5 2.5" />
                <path d="M18.8 5.2l-2.5 2.5" />
                <path d="M7.7 16.3l-2.5 2.5" />
            </g>
            <circle cx="12" cy="12" r="5" fill={color} />
        </svg>
    );
}
