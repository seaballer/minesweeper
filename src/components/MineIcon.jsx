/**
 * A small mine glyph for the mine counter.
 *
 * MUI has no `Bomb` icon, so this is drawn here to match the weight of the
 * `Bolt` icon used on revealed mines. It is decorative: the meaning is carried
 * by the counter's own `aria-label`, so it stays out of the a11y tree and
 * inherits its colour from its wrapper.
 */
export default function MineIcon({ size = 18, ...rest }) {
    const color = 'currentColor';

    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            focusable="false"
            {...rest}
        >
            {/* spikes */}
            <g stroke={color} strokeWidth="2" strokeLinecap="round">
                <path d="M12 2v4" />
                <path d="M12 18v4" />
                <path d="M2 12h4" />
                <path d="M18 12h4" />
                <path d="M4.9 4.9l2.9 2.9" />
                <path d="M16.2 16.2l2.9 2.9" />
                <path d="M19.1 4.9l-2.9 2.9" />
                <path d="M7.8 16.2l-2.9 2.9" />
            </g>
            <circle cx="12" cy="12" r="5.2" fill={color} />
        </svg>
    );
}
