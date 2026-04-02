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
          const gap = 2;
          const top = i * (tabHeight + gap);
          const isActive = tab.active;

          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${top}px`,
                right: '0px',
                width: isActive ? '52px' : '44px',
                height: `${tabHeight}px`,
                backgroundColor: isActive ? '#1a3a5c' : `${headerBar}`,
                borderRadius: '0 8px 8px 0',
                border: isActive ? '1.5px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
                borderLeft: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: isActive ? '2px 2px 6px rgba(0,0,0,0.4)' : '1px 1px 3px rgba(0,0,0,0.2)',
                zIndex: isActive ? 10 : 1,
              }}
            >
              <span style={{
                color: isActive ? '#ffffff' : 'rgba(255,255,255,0.5)',
                fontSize: '9px',
                fontWeight: isActive ? 600 : 400,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.3px',
                whiteSpace: 'nowrap',
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                transform: 'rotate(180deg)',
              }}>
                {tab.label}
              </span>
            </div>
          );
        })}
      </div>

      <div className="ml-8 text-white/70 text-sm" style={{ maxWidth: '200px' }}>
        <h3 className="text-white font-bold text-lg mb-3">Option A: Binder Tabs</h3>
        <p className="mb-2">Rounded rectangle tabs that stick out from the right edge, like physical binder dividers.</p>
        <ul className="list-disc pl-4 space-y-1 text-xs text-white/50">
          <li>Active tab extends further right</li>
          <li>Brighter border on active</li>
          <li>Vertical text, bottom-to-top</li>
          <li>Subtle shadow depth</li>
        </ul>
      </div>
    </div>
  );
}
