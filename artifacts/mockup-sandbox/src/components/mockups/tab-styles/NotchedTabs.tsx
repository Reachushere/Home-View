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

        <div style={{
          position: 'relative',
          width: '6px',
          height: `${tabs.length * tabH + 20}px`,
          backgroundColor: '#0a2640',
          zIndex: 3,
        }}>
          {tabs.map((tab, i) => {
            const isActive = tab.active;
            const top = 10 + i * tabH;
            const h = tabH - 2;

            return (
              <div key={i} style={{
                position: 'absolute',
                top: `${top}px`,
                left: 0,
                right: 0,
                height: `${h}px`,
                backgroundColor: isActive ? '#4a9eff' : 'transparent',
                borderRadius: '0 2px 2px 0',
                transition: 'background-color 0.15s ease',
              }} />
            );
          })}
        </div>

        <div style={{ position: 'relative', width: '30px', height: `${tabs.length * tabH + 20}px` }}>
          {tabs.map((tab, i) => {
            const isActive = tab.active;
            const top = 10 + i * tabH;
            const h = tabH - 2;

            return (
              <div key={i} style={{
                position: 'absolute',
                top: `${top}px`,
                left: 0,
                width: '30px',
                height: `${h}px`,
                backgroundColor: isActive ? 'rgba(74,158,255,0.12)' : 'transparent',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background-color 0.15s ease',
                borderRadius: '0 4px 4px 0',
              }}>
                <span style={{
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                  fontSize: '9px',
                  fontWeight: isActive ? 700 : 400,
                  color: isActive ? '#4a9eff' : 'rgba(255,255,255,0.3)',
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
          <h3 className="text-white font-semibold text-sm mb-2">C: Rail Indicator</h3>
          <p className="text-white/40 text-[11px] leading-relaxed">Flat text with a colored accent rail on the left edge — like Notion's sidebar or Figma's panel tabs. Most minimal. Active tab has blue rail + blue text + subtle background.</p>
        </div>
      </div>
    </div>
  );
}
