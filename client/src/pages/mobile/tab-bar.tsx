import type { MobileTab, TabDef } from "./types";

export function BottomTabBar({ activeTab, onTabChange, tabs }: { activeTab: MobileTab; onTabChange: (tab: MobileTab) => void; tabs: TabDef[] }) {
  return (
    <div
      style={{
        display: 'flex',
        borderTop: '1px solid rgba(255,255,255,0.15)',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        flexShrink: 0,
      }}
      data-testid="mobile-app-tab-bar"
    >
      {tabs.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: 1, background: 'none', border: 'none',
              color: active ? '#60a5fa' : 'rgba(255,255,255,0.4)',
              padding: '8px 0 6px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              transition: 'color 0.2s',
            }}
            data-testid={`mobile-app-tab-${tab.id}`}
          >
            <Icon style={{ width: 22, height: 22 }} />
            <span style={{ fontSize: '10px', fontWeight: active ? 600 : 400, fontFamily: "system-ui, -apple-system, sans-serif" }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
