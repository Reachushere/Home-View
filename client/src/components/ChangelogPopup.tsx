import { useState, useEffect } from "react";
import { X, Rocket } from "lucide-react";

interface ChangelogData {
  version: string;
  deployedAt: string | null;
  changes: string[];
}

export function ChangelogPopup() {
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    fetch('/api/changelog')
      .then(r => r.ok ? r.json() : null)
      .then((data: ChangelogData | null) => {
        if (!data || !data.version || data.version === 'dev') return;
        const lastSeen = localStorage.getItem('changelog_last_version');
        if (lastSeen !== data.version && data.changes.length > 0) {
          setChangelog(data);
          setVisible(true);
        }
      })
      .catch(() => {});
  }, []);

  const dismiss = () => {
    if (changelog) localStorage.setItem('changelog_last_version', changelog.version);
    setVisible(false);
  };

  if (!visible || !changelog) return null;

  const deployTime = changelog.deployedAt
    ? new Date(changelog.deployedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })
    : null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={dismiss}
      data-testid="changelog-overlay"
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #0f1f3d 0%, #0a1628 100%)',
          border: '1.5px solid rgba(100,160,255,0.3)',
          borderRadius: '16px',
          padding: '0',
          maxWidth: '440px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
        }}
        onClick={e => e.stopPropagation()}
        data-testid="changelog-popup"
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid rgba(100,160,255,0.15)',
          background: 'rgba(30,60,120,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Rocket size={20} color="#60a5fa" />
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#e0ecff', letterSpacing: '0.3px' }}>
              What's New
            </span>
            <span style={{ fontSize: '12px', color: 'rgba(160,190,255,0.6)', fontFamily: 'monospace' }}>
              {changelog.version}
            </span>
          </div>
          <button
            onClick={dismiss}
            style={{ background: 'none', border: 'none', color: 'rgba(160,190,255,0.6)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex' }}
            data-testid="button-changelog-close"
          >
            <X size={18} />
          </button>
        </div>

        <div style={{
          padding: '16px 20px',
          maxHeight: '50vh',
          overflowY: 'auto',
        }}>
          {deployTime && (
            <div style={{ fontSize: '12px', color: 'rgba(160,190,255,0.5)', marginBottom: '12px' }}>
              Deployed {deployTime}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {changelog.changes.map((change, i) => {
              const lines = change.split('\n');
              const title = lines[0].replace(/:$/, '');
              const details = lines.slice(1).map(l => l.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
              return (
                <div key={i} style={{
                  padding: '10px 12px',
                  background: 'rgba(30,60,120,0.2)',
                  borderRadius: '8px',
                  border: '1px solid rgba(100,160,255,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <span style={{ color: '#60a5fa', fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>•</span>
                    <span style={{ color: 'rgba(220,230,255,0.9)', fontSize: '13px', lineHeight: '1.4', fontWeight: details.length > 0 ? 600 : 400 }}>
                      {title}
                    </span>
                  </div>
                  {details.length > 0 && (
                    <div style={{ marginLeft: '24px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {details.map((d, j) => (
                        <div key={j} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          <span style={{ color: 'rgba(160,190,255,0.4)', fontSize: '10px', flexShrink: 0, marginTop: '3px' }}>▸</span>
                          <span style={{ color: 'rgba(200,215,255,0.7)', fontSize: '12px', lineHeight: '1.4' }}>
                            {d}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid rgba(100,160,255,0.1)',
          display: 'flex',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={dismiss}
            style={{
              background: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 24px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            data-testid="button-changelog-dismiss"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
