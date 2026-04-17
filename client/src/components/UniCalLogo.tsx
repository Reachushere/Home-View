interface UniCalLogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export default function UniCalLogo({ size = 34, className = "", style = {} }: UniCalLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      style={style}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="ucl-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b6fd6" />
          <stop offset="55%" stopColor="#1d3f8a" />
          <stop offset="100%" stopColor="#0d224d" />
        </linearGradient>
        <linearGradient id="ucl-binding" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffd86b" />
          <stop offset="100%" stopColor="#c89623" />
        </linearGradient>
        <linearGradient id="ucl-letter" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#cfd8ec" />
        </linearGradient>
        <filter id="ucl-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer><feFuncA type="linear" slope="0.45" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Rounded-square card */}
      <rect x="6" y="6" width="88" height="88" rx="20" ry="20" fill="url(#ucl-bg)" />

      {/* Inner bevel */}
      <rect x="8" y="8" width="84" height="84" rx="18" ry="18"
        fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" />

      {/* Top binding strip */}
      <rect x="6" y="6" width="88" height="14" rx="20" ry="20"
        fill="url(#ucl-binding)" />
      <rect x="6" y="14" width="88" height="6" fill="url(#ucl-binding)" />
      <rect x="6" y="19" width="88" height="1.5" fill="rgba(0,0,0,0.25)" />

      {/* Two binding rings poking down */}
      <rect x="26" y="2" width="6" height="14" rx="2" ry="2"
        fill="#9a7418" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
      <rect x="68" y="2" width="6" height="14" rx="2" ry="2"
        fill="#9a7418" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />

      {/* The "U" — bold sans-serif, centered in the body */}
      <text
        x="50"
        y="76"
        textAnchor="middle"
        fontFamily="'Inter', 'Helvetica Neue', 'Arial', sans-serif"
        fontSize="58"
        fontWeight="800"
        fill="url(#ucl-letter)"
        filter="url(#ucl-shadow)"
        letterSpacing="-2"
      >
        U
      </text>

      {/* Subtle gold underscore */}
      <line x1="32" y1="84" x2="68" y2="84"
        stroke="url(#ucl-binding)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
