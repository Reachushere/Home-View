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
            const w = isActive ? 36 : 28;
            const h = tabH - 2;

            return (
              <div key={i} style={{
                position: 'absolute',
                top: `${top}px`,
                left: 0,
                width: `${w}px`,
                height: `${h}px`,
                backgroundColor: isActive ? '#1e4d6e' : '#0b2e4a',
                borderRadius: '0 6px 6px 0',
                border: `1px solid ${isActive ? 'rgba(100,180,255,0.4)' : 'rgba(255,255,255,0.07)'}`,
                borderLeft: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: isActive ? 10 : 2,
                boxShadow: isActive
                  ? '3px 0 10px rgba(0,0,0,0.4), inset 0 0 12px rgba(100,180,255,0.08)'
                  : '2px 0 4px rgba(0,0,0,0.2)',
                transition: 'all 0.15s ease',
              }}>
                <span style={{
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
          <h3 className="text-white font-semibold text-sm mb-2">A: Clean Pill Tabs</h3>
          <p className="text-white/40 text-[11px] leading-relaxed">Simple rounded-right rectangles. Active tab wider with a subtle blue glow. Like VS Code's activity bar tabs. Cleanest option.</p>
        </div>
      </div>
    </div>
  );
}
