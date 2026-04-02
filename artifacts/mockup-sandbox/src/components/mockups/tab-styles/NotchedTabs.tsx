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
          const gap = 0;
          const top = i * (tabHeight + gap);
          const isActive = tab.active;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}px`,
                right: '0px',
                width: '40px',
                height: `${tabHeight}px`,
                cursor: 'pointer',
                zIndex: isActive ? 10 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isActive ? '#0d3355' : headerBar,
                borderRight: isActive ? '3px solid #4a9eff' : '3px solid transparent',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                transition: 'all 0.2s ease',
                position: 'absolute' as const,
              }}
            >
              {isActive && (
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '100%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(74,158,255,0.08) 100%)',
                }} />
              )}
              <span style={{
                color: isActive ? '#4a9eff' : 'rgba(255,255,255,0.4)',
                fontSize: '9px',
                fontWeight: isActive ? 700 : 400,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
                position: 'relative',
                zIndex: 2,
              }}>
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="ml-8 text-white/70 text-sm" style={{ maxWidth: '200px' }}>
        <h3 className="text-white font-bold text-lg mb-3">Option C: Notched / Rail Tabs</h3>
        <p className="mb-2">Flush tabs with a colored accent bar on the right edge. Active tab has a blue highlight rail. Minimal, modern look.</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-white/50">
          <li>No protruding shape — flush edge</li>
          <li>Blue accent bar marks active tab</li>
          <li>Active text turns blue</li>
          <li>Subtle background glow on active</li>
          <li>Cleanest, most minimal option</li>
        </ul>
      </div>
    </div>
  );
}
