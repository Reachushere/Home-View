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

  const tabH = 38;

  return (
    <div className="min-h-screen bg-[#0e1a2b] flex items-start justify-center pt-6 pl-6">
      <div className="relative flex">
        <div style={{
          width: '85px',
          height: `${tabs.length * tabH + 20}px`,
          backgroundColor: headerBar,
          borderRadius: '10px 0 0 10px',
          boxShadow: '4px 0 16px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 5,
        }} />

        <div style={{ position: 'relative', width: '36px', height: `${tabs.length * tabH + 20}px` }}>
          {tabs.map((tab, i) => {
            const isActive = tab.active;
            const top = 10 + i * tabH;
            const w = 32;
            const h = tabH - 2;

            return (
              <div key={i} style={{
                position: 'absolute',
                top: `${top}px`,
                left: 0,
                width: `${w}px`,
                height: `${h}px`,
                cursor: 'pointer',
                zIndex: isActive ? 10 : 2,
                transition: 'all 0.15s ease',
              }}>
                <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible', filter: isActive ? 'drop-shadow(3px 0 6px rgba(0,0,0,0.4))' : 'drop-shadow(1px 0 2px rgba(0,0,0,0.2))' }}>
                  <path
                    d={`M0 0 L0 ${h} L${w - 8} ${h - 3} Q${w} ${h - 5} ${w} ${h - 10} L${w} 10 Q${w} 5 ${w - 8} 3 Z`}
                    fill={isActive ? '#1e4d6e' : '#0b2e4a'}
                    stroke={isActive ? 'rgba(100,180,255,0.35)' : 'rgba(255,255,255,0.06)'}
                    strokeWidth={isActive ? 1 : 0.5}
                  />
                </svg>
                <span style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: `${w}px`,
                  height: `${h}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: '9px',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#b8ddf5' : 'rgba(255,255,255,0.3)',
                  fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif",
                  letterSpacing: '0.8px',
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}>
                  {tab.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="ml-10 text-white/60 text-xs" style={{ maxWidth: '180px', paddingTop: '10px' }}>
          <h3 className="text-white font-semibold text-sm mb-2">B: Tapered Divider</h3>
          <p className="text-white/40 text-[11px] leading-relaxed">Trapezoidal shape that narrows toward the right edge — like a real plastic filing divider that's been cut at an angle. Active tab has blue border glow.</p>
        </div>
      </div>
    </div>
  );
}
