export function BinderTabs() {
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
    { label: 'AUG-SEP', active: false },
    { label: 'F 2026', active: false },
    { label: '2027', active: false },
    { label: '2028', active: false },
    { label: '2029', active: false },
  ];

  const tabH = 36;
  const gap = 0;
  const panelW = 80;

  return (
    <div className="min-h-screen bg-[#1a2332] flex items-start justify-center p-8">
      <div className="relative" style={{ width: '160px', height: '560px' }}>
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${panelW}px`,
          backgroundColor: headerBar, borderRadius: '10px 0 0 10px',
          boxShadow: '3px 0 12px rgba(0,0,0,0.4)',
        }} />

        {tabs.map((tab, i) => {
          const top = i * (tabH + gap);
          const isActive = tab.active;
          const tabW = isActive ? 42 : 34;
          const svgW = tabW;
          const svgH = tabH;
          const slopeIn = 5;

          return (
            <div key={i} style={{
              position: 'absolute', top: `${top}px`, right: '4px',
              width: `${svgW}px`, height: `${svgH}px`, cursor: 'pointer',
              zIndex: isActive ? 10 : tabs.length - i,
              transition: 'all 0.15s ease',
            }}>
              <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                  <filter id={`sh-a-${i}`} x="-30%" y="-10%" width="160%" height="130%">
                    <feDropShadow dx="2" dy="0" stdDeviation="2" floodColor="#000" floodOpacity={isActive ? '0.6' : '0.2'} />
                  </filter>
                </defs>
                <path
                  d={`M0 ${slopeIn} L${slopeIn} 0 L${svgW - 4} 0 Q${svgW} 0 ${svgW} 4 L${svgW} ${svgH - 4} Q${svgW} ${svgH} ${svgW - 4} ${svgH} L${slopeIn} ${svgH} L0 ${svgH - slopeIn} Z`}
                  fill={isActive ? '#143d5e' : '#0a2640'}
                  stroke={isActive ? 'rgba(120,180,230,0.6)' : 'rgba(255,255,255,0.08)'}
                  strokeWidth={isActive ? 1 : 0.5}
                  filter={`url(#sh-a-${i})`}
                />
                {isActive && (
                  <rect x={svgW - 2.5} y={4} width={2.5} height={svgH - 8} rx={1} fill="rgba(120,180,230,0.7)" />
                )}
                <text
                  x={svgW / 2 + 1} y={svgH / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isActive ? '#c8e2f8' : 'rgba(255,255,255,0.35)'}
                  fontSize="8" fontWeight={isActive ? '600' : '400'}
                  fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.5"
                  transform={`rotate(90, ${svgW / 2 + 1}, ${svgH / 2})`}
                >{tab.label}</text>
              </svg>
            </div>
          );
        })}
      </div>

      <div className="ml-10 text-white/70 text-sm" style={{ maxWidth: '220px' }}>
        <h3 className="text-white font-semibold text-base mb-3">A: Angled Divider</h3>
        <p className="text-white/50 text-xs">Trapezoidal cut with angled top-left and bottom-left corners — like a real plastic filing divider. Active tab has a subtle blue accent rail on the right edge.</p>
      </div>
    </div>
  );
}
