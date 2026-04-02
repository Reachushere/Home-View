export function SteppedTabs() {
  const headerBar = '#051729';
  const tabs = [
    { label: 'Wk 11', active: true },
    { label: 'Wk 12', active: false },
    { label: 'Wk 13', active: false },
    { label: 'APRIL', active: false },
    { label: 'S Wk 1', active: false },
    { label: 'S Wk 2', active: false },
    { label: 'S Wk 3', active: false },
    { label: 'S Wk 4', active: false },
    { label: 'S Wk 5', active: false },
    { label: 'AUG-SEPT', active: false },
    { label: 'F 2026', active: false },
    { label: '2027', active: false },
    { label: '2028', active: false },
    { label: '2029', active: false },
  ];

  return (
    <div className="min-h-screen bg-gray-800 flex items-start justify-center p-6">
      <div className="relative" style={{ width: '120px', height: '600px' }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '80px',
          backgroundColor: headerBar,
          borderRadius: '8px 0 0 8px',
          boxShadow: '2px 0 8px rgba(0,0,0,0.3)',
        }} />

        {tabs.map((tab, i) => {
          const tabHeight = 38;
          const gap = 1;
          const top = i * (tabHeight + gap);
          const isActive = tab.active;

          const svgW = isActive ? 52 : 44;
          const svgH = tabHeight;
          const cornerR = 5;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}px`,
                right: '0px',
                width: `${svgW}px`,
                height: `${svgH}px`,
                cursor: 'pointer',
                zIndex: isActive ? 10 : 1,
                transition: 'all 0.2s ease',
              }}
            >
              <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block' }}>
                <defs>
                  <filter id={`shadow-${i}`} x="-20%" y="-10%" width="140%" height="130%">
                    <feDropShadow dx="1" dy="1" stdDeviation="2" floodColor="black" floodOpacity={isActive ? '0.5' : '0.2'} />
                  </filter>
                </defs>
                <path
                  d={`M0 0 L${svgW - cornerR} 0 Q${svgW} 0 ${svgW} ${cornerR} L${svgW} ${svgH - cornerR} Q${svgW} ${svgH} ${svgW - cornerR} ${svgH} L0 ${svgH} Z`}
                  fill={isActive ? '#0d3355' : headerBar}
                  stroke={isActive ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isActive ? 1.5 : 0.5}
                  filter={`url(#shadow-${i})`}
                />
                <text
                  x={svgW / 2}
                  y={svgH / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? '#ffffff' : 'rgba(255,255,255,0.45)'}
                  fontSize="9"
                  fontWeight={isActive ? '600' : '400'}
                  fontFamily="system-ui, sans-serif"
                  letterSpacing="0.3"
                  transform={`rotate(90, ${svgW / 2}, ${svgH / 2})`}
                >
                  {tab.label}
                </text>
              </svg>
            </div>
          );
        })}
      </div>

      <div className="ml-8 text-white/70 text-sm" style={{ maxWidth: '200px' }}>
        <h3 className="text-white font-bold text-lg mb-3">Option B: Angled/Trapezoidal</h3>
        <p className="mb-2">Flat tabs with rounded right corners, like browser tabs rotated 90 degrees. Clean and modern.</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-white/50">
          <li>Tight 1px gap between tabs</li>
          <li>Active tab slightly wider + brighter fill</li>
          <li>Subtle rounded corners on right</li>
          <li>Drop shadow for depth</li>
        </ul>
      </div>
    </div>
  );
}
