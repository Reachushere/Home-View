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
        <linearGradient id="shield-bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(30,60,120,1)" />
          <stop offset="100%" stopColor="rgba(15,35,75,1)" />
        </linearGradient>
        <linearGradient id="gold-accent" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,215,100,1)" />
          <stop offset="100%" stopColor="rgba(200,165,50,1)" />
        </linearGradient>
        <linearGradient id="letter-fill" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,1)" />
          <stop offset="100%" stopColor="rgba(220,225,240,1)" />
        </linearGradient>
      </defs>

      <path
        d="M50 3 L93 20 L93 55 Q93 80 50 97 Q7 80 7 55 L7 20 Z"
        fill="url(#shield-bg)"
        stroke="url(#gold-accent)"
        strokeWidth="3.5"
      />

      <path
        d="M50 8 L88 23 L88 54 Q88 76 50 92 Q12 76 12 54 L12 23 Z"
        fill="none"
        stroke="rgba(255,215,100,0.3)"
        strokeWidth="1"
      />

      <text
        x="50"
        y="68"
        textAnchor="middle"
        fontFamily="'Georgia', 'Times New Roman', serif"
        fontSize="62"
        fontWeight="bold"
        fontStyle="italic"
        fill="url(#letter-fill)"
        stroke="rgba(200,165,50,0.9)"
        strokeWidth="2"
        letterSpacing="-2"
      >
        U
      </text>

      <line x1="20" y1="78" x2="80" y2="78" stroke="url(#gold-accent)" strokeWidth="2" strokeLinecap="round" />
      <line x1="25" y1="83" x2="75" y2="83" stroke="rgba(255,215,100,0.5)" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
