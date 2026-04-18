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
        <linearGradient id="ucl-shield" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3b6fd6" />
          <stop offset="55%" stopColor="#1d3f8a" />
          <stop offset="100%" stopColor="#0d224d" />
        </linearGradient>
        <linearGradient id="ucl-gold" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffe388" />
          <stop offset="50%" stopColor="#ffd86b" />
          <stop offset="100%" stopColor="#b07d18" />
        </linearGradient>
        <linearGradient id="ucl-page" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#dfe6f4" />
        </linearGradient>
        <filter id="ucl-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer><feFuncA type="linear" slope="0.45" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Heraldic shield silhouette — flat top with chief, pointed base */}
      <path
        d="M14 14
           H86
           V52
           C86 70, 72 84, 50 92
           C28 84, 14 70, 14 52
           Z"
        fill="url(#ucl-shield)"
        stroke="url(#ucl-gold)"
        strokeWidth="3"
        strokeLinejoin="round"
      />

      {/* Inner hairline bevel */}
      <path
        d="M18 18
           H82
           V52
           C82 67, 70 80, 50 87.5
           C30 80, 18 67, 18 52
           Z"
        fill="none"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1"
      />

      {/* Chief band (top stripe) in gold — classic heraldic */}
      <path
        d="M14 14 H86 V26 H14 Z"
        fill="url(#ucl-gold)"
      />
      <path
        d="M14 26 H86"
        stroke="rgba(0,0,0,0.25)"
        strokeWidth="1"
      />

      {/* "EST." style stars on the chief */}
      <g fill="#0d224d">
        <circle cx="30" cy="20" r="1.6" />
        <circle cx="50" cy="20" r="1.6" />
        <circle cx="70" cy="20" r="1.6" />
      </g>

      {/* Open book in lower portion */}
      <g filter="url(#ucl-shadow)">
        {/* Book pages — left and right */}
        <path
          d="M26 64
             Q38 58, 50 62
             L50 78
             Q38 74, 26 80
             Z"
          fill="url(#ucl-page)"
          stroke="#1d3f8a"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        <path
          d="M74 64
             Q62 58, 50 62
             L50 78
             Q62 74, 74 80
             Z"
          fill="url(#ucl-page)"
          stroke="#1d3f8a"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
        {/* Page lines */}
        <line x1="32" y1="66" x2="46" y2="64" stroke="#8aa0c8" strokeWidth="0.6" strokeLinecap="round" />
        <line x1="32" y1="70" x2="46" y2="68" stroke="#8aa0c8" strokeWidth="0.6" strokeLinecap="round" />
        <line x1="32" y1="74" x2="46" y2="72" stroke="#8aa0c8" strokeWidth="0.6" strokeLinecap="round" />
        <line x1="54" y1="64" x2="68" y2="66" stroke="#8aa0c8" strokeWidth="0.6" strokeLinecap="round" />
        <line x1="54" y1="68" x2="68" y2="70" stroke="#8aa0c8" strokeWidth="0.6" strokeLinecap="round" />
        <line x1="54" y1="72" x2="68" y2="74" stroke="#8aa0c8" strokeWidth="0.6" strokeLinecap="round" />
      </g>

      {/* Centered "U" monogram above the book */}
      <text
        x="50"
        y="54"
        textAnchor="middle"
        fontFamily="'Times New Roman', 'Garamond', serif"
        fontSize="28"
        fontWeight="700"
        fill="url(#ucl-gold)"
        filter="url(#ucl-shadow)"
        letterSpacing="-1"
      >
        U
      </text>

      {/* Gold ribbon banner at base point */}
      <path
        d="M34 82 L50 86 L66 82 L62 88 L50 91 L38 88 Z"
        fill="url(#ucl-gold)"
        stroke="#7a5410"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
