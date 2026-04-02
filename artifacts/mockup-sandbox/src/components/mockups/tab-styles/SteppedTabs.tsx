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
    { label: 'AUG-SEP', active: false },
    { label: 'F 2026', active: false },
    { label: '2027', active: false },
    { label: '2028', active: false },
    { label: '2029', active: false },
  ];

  const tabH = 36;
  const gap = 1;
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
          const tabW = isActive ? 44 : 36;
          const svgW = tabW;
          const svgH = tabH;
          const r = 5;
          const notch = 8;

          return (
            <div key={i} style={{
              position: 'absolute', top: `${top}px`, right: '4px',
              width: `${svgW}px`, height: `${svgH}px`, cursor: 'pointer',
              zIndex: isActive ? 10 : tabs.length - i,
              transition: 'all 0.15s ease',
            }}>
              <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                  <filter id={`sh-b-${i}`} x="-30%" y="-10%" width="160%" height="130%">
                    <feDropShadow dx="2" dy="0" stdDeviation="2" floodColor="#000" floodOpacity={isActive ? '0.6' : '0.2'} />
                  </filter>
                </defs>
                <path
                  d={`M0 0 L${notch} 0 L${notch} 0 L${svgW - r} 0 Q${svgW} 0 ${svgW} ${r} L${svgW} ${svgH - r} Q${svgW} ${svgH} ${svgW - r} ${svgH} L${notch} ${svgH} L0 ${svgH} L0 ${svgH - notch} L${notch / 2} ${svgH - notch} L${notch / 2} ${notch} L0 ${notch} Z`}
                  fill={isActive ? '#143d5e' : '#0a2640'}
                  stroke={isActive ? 'rgba(120,180,230,0.5)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isActive ? 1 : 0.5}
                  filter={`url(#sh-b-${i})`}
                />
                <text
                  x={notch / 2 + (svgW - notch / 2) / 2} y={svgH / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isActive ? '#c8e2f8' : 'rgba(255,255,255,0.35)'}
                  fontSize="8" fontWeight={isActive ? '600' : '400'}
                  fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.5"
                  transform={`rotate(90, ${notch / 2 + (svgW - notch / 2) / 2}, ${svgH / 2})`}
                >{tab.label}</text>
              </svg>
            </div>
          );
        })}
      </div>

      <div className="ml-10 text-white/70 text-sm" style={{ maxWidth: '220px' }}>
        <h3 className="text-white font-semibold text-base mb-3">B: Stepped Divider</h3>
        <p className="text-white/50 text-xs">Has a narrow spine on the left that connects to the panel, then steps out to a wider tab area with rounded right corners. Like a real plastic tab divider with a visible spine.</p>
      </div>
    </div>
  );
}
