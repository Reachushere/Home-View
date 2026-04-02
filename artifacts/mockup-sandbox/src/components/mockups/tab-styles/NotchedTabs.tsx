export function NotchedTabs() {
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
          const tabW = isActive ? 40 : 32;
          const h = tabH;
          const curveR = 8;

          return (
            <div key={i} style={{
              position: 'absolute', top: `${top}px`, right: '4px',
              width: `${tabW}px`, height: `${h}px`, cursor: 'pointer',
              zIndex: isActive ? 10 : tabs.length - i,
              transition: 'all 0.15s ease',
            }}>
              <svg width={tabW} height={h} viewBox={`0 0 ${tabW} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
                <defs>
                  <filter id={`sh-c-${i}`} x="-30%" y="-10%" width="160%" height="130%">
                    <feDropShadow dx="2" dy="0" stdDeviation="2" floodColor="#000" floodOpacity={isActive ? '0.6' : '0.2'} />
                  </filter>
                </defs>
                <path
                  d={`M0 0 C${curveR} 0 ${curveR} ${curveR} ${curveR} ${curveR} L${curveR} ${h - curveR} C${curveR} ${h} ${curveR} ${h} 0 ${h} L${tabW - 4} ${h} Q${tabW} ${h} ${tabW} ${h - 4} L${tabW} 4 Q${tabW} 0 ${tabW - 4} 0 Z`}
                  fill={isActive ? '#143d5e' : '#0a2640'}
                  stroke={isActive ? 'rgba(120,180,230,0.5)' : 'rgba(255,255,255,0.06)'}
                  strokeWidth={isActive ? 1 : 0.5}
                  filter={`url(#sh-c-${i})`}
                />
                <text
                  x={curveR + (tabW - curveR) / 2} y={h / 2}
                  textAnchor="middle" dominantBaseline="central"
                  fill={isActive ? '#c8e2f8' : 'rgba(255,255,255,0.35)'}
                  fontSize="8" fontWeight={isActive ? '600' : '400'}
                  fontFamily="system-ui, -apple-system, sans-serif" letterSpacing="0.5"
                  transform={`rotate(90, ${curveR + (tabW - curveR) / 2}, ${h / 2})`}
                >{tab.label}</text>
              </svg>
            </div>
          );
        })}
      </div>

      <div className="ml-10 text-white/70 text-sm" style={{ maxWidth: '220px' }}>
        <h3 className="text-white font-semibold text-base mb-3">C: Curved Divider</h3>
        <p className="text-white/50 text-xs">S-curve on the left edge creates a smooth, organic transition from the panel to the tab. Right side has crisp rounded corners. Most polished, modern take on filing dividers.</p>
      </div>
    </div>
  );
}
