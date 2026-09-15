import type { SVGAttributes } from 'react';

/** Minimal stumps + ball mark; uses currentColor for theme-aware branding. */
export default function AppLogoIcon(props: SVGAttributes<SVGElement>) {
    return (
        <svg
            {...props}
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden
        >
            <g stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
                <line x1="8" y1="24" x2="8" y2="11" />
                <line x1="16" y1="24" x2="16" y2="11" />
                <line x1="24" y1="24" x2="24" y2="11" />
                <line x1="6" y1="11" x2="26" y2="11" />
            </g>
            <circle cx="24" cy="8" r="3.25" fill="currentColor" />
        </svg>
    );
}
