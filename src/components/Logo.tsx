import { useId } from 'react';

/**
 * Le logo de Poche, inline pour pouvoir n'animer qu'au survol ou au focus :
 * la carte tombe dans la poche, la coche se dessine. Immobile au repos et sous
 * `prefers-reduced-motion` (voir index.css). Le même dessin existe en fichier :
 * `public/logo.svg` (statique) et `public/logo-animated.svg` (en boucle).
 */
export function Logo({ size = 32, title }: { size?: number; title?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className="poche-logo shrink-0"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="1" stopColor="#4338ca" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="112" fill={`url(#${id}-bg)`} />
      <g className="poche-logo-card">
        <rect x="176" y="92" width="160" height="196" rx="20" fill="#fef3c7" />
        <path
          className="poche-logo-check"
          d="M206 170l30 30 60-64"
          fill="none"
          stroke="#4338ca"
          strokeWidth="26"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g className="poche-logo-pocket">
        <path d="M112 216h288v96c0 79.5-64.5 144-144 144s-144-64.5-144-144z" fill="#f8fafc" />
        <path
          d="M152 256h208"
          stroke="#c7d2fe"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray="4 26"
        />
      </g>
    </svg>
  );
}
