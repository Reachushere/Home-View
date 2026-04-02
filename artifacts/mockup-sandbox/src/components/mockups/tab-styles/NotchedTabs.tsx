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

  const tabH = 38;
  const tabW = 32;
  const railW = 3;
  const gap = 2;

  return (
    <div className="min-h-screen bg-[#0e1a2b] flex items-start justify-center pt-6 pl-6">
      <div className="relative flex">
        <div style={{
          width: '85px',
          height: `${tabs.length * (tabH + gap) + 20}px`,
          backgroundColor: headerBar,
          borderRadius: '10px 0 0 10px',
          boxShadow: '4px 0 16px rgba(0,0,0,0.5)',
          position: 'relative',
          zIndex: 5,
        }} />

        <div style={{ position: 'relative', width: `${tabW + railW}px`, height: `${tabs.length * (tabH + gap) + 20}px` }}>
          {tabs.map((tab, i) => {
            const isActive = tab.active;
            const top = 10 + i * (tabH + gap);
            const h = tabH;
            const w = isActive ? tabW + 4 : tabW;
            const r = 6;

            return (
              <div key={i} style={{
                position: 'absolute',
                top: `${top}px`,
                left: 0,
                width: `${w + railW}px`,
                height: `${h}px`,
                cursor: 'pointer',
                zIndex: isActive ? 10 : 2,
                transition: 'all 0.15s ease',
              }}>
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: '2px',
                  bottom: '2px',
                  width: `${railW}px`,
                  backgroundColor: isActive ? '#4a9eff' : 'rgba(255,255,255,0.06)',
                  borderRadius: '0 2px 2px 0',
                  transition: 'background-color 0.15s ease',
                  zIndex: 3,
                }} />

                <div style={{
                  position: 'absolute',
                  left: `${railW}px`,
                  top: 0,
                  width: `${w}px`,
                  height: `${h}px`,
                  backgroundColor: isActive ? '#0f3854' : '#0a2640',
                  borderRadius: `0 ${r}px ${r}px 0`,
                  border: `1px solid ${isActive ? 'rgba(74,158,255,0.25)' : 'rgba(255,255,255,0.05)'}`,
                  borderLeft: 'none',
                  boxShadow: isActive
                    ? '3px 0 8px rgba(0,0,0,0.35)'
                    : '1px 0 3px rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}>
                  <span style={{
                    writingMode: 'vertical-rl',
                    transform: 'rotate(180deg)',
                    fontSize: '9px',
                    fontWeight: isActive ? 700 : 400,
                    color: isActive ? '#7fbfff' : 'rgba(255,255,255,0.3)',
                    fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif",
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                  }}>
                    {tab.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="ml-10 text-white/60 text-xs" style={{ maxWidth: '180px', paddingTop: '10px' }}>
          <h3 className="text-white font-semibold text-sm mb-2">C: Rail + Tab</h3>
          <p className="text-white/40 text-[11px] leading-relaxed">Rounded tab shapes that protrude from the panel edge, with a colored accent rail on the left of the active tab. Active tab is wider, has blue rail, blue text, subtle border glow, and shadow depth.</p>
        </div>
      </div>
    </div>
  );
}
