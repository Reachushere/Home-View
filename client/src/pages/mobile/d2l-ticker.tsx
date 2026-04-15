import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { AnnouncementItem, TaskItem } from "./types";
import d2lTickerLabel from "@assets/D2L_1773894837014.png";

interface TickerItem {
  title?: string;
  Title?: string;
  content?: string;
  isTask?: boolean;
  isWeatherAlert?: boolean;
}

export function D2LTicker({ mobileAuth, onClick }: { mobileAuth: string; onClick: () => void }) {
  const { data: announcements = [] } = useQuery<AnnouncementItem[]>({
    queryKey: ["/api/announcements"],
    queryFn: () => fetch('/api/announcements?limit=15').then(r => r.ok ? r.json() : []).catch(() => []),
    staleTime: 30000,
  });

  const { data: tasks = [] } = useQuery<TaskItem[]>({
    queryKey: ["/api/tasks"],
    staleTime: 30000,
  });

  const tickerItems = useMemo<TickerItem[]>(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const todayTasks = tasks.filter((t) => {
      if (!t.dueDate || t.isCompleted) return false;
      const d = new Date(t.dueDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayStr;
    }).map((t) => ({ ...t, isTask: true, title: t.title }));

    const filtered = announcements.filter((a) => {
      if (a.isTask || a.isWeatherAlert) return true;
      const vis = a.visibleTo || ['5747', '4201', '1010'];
      return vis.includes(mobileAuth);
    });
    return [...todayTasks, ...filtered];
  }, [announcements, tasks, mobileAuth]);

  return (
    <div
      onClick={onClick}
      style={{
        width: '100%',
        height: `calc(34px + env(safe-area-inset-top, 0px))`,
        paddingTop: 'env(safe-area-inset-top, 0px)',
        overflow: 'hidden',
        background: 'linear-gradient(90deg, #000000 0%, #14141e 50%, #000000 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center',
        cursor: 'pointer', flexShrink: 0,
        zIndex: 25,
      }}
      data-testid="mobile-app-ticker"
    >
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 6px' }}>
        <img src={d2lTickerLabel} alt="D2L" style={{ height: '26px', width: 'auto', objectFit: 'contain' }} />
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', height: '100%' }}>
        {tickerItems.length > 0 ? (
          <div
            ref={(el) => {
              if (!el) return;
              if ((el as HTMLDivElement & { __ticker?: HTMLDivElement }).__ticker === el) return;
              (el as HTMLDivElement & { __ticker?: HTMLDivElement }).__ticker = el;
              let isFirst = true;
              const go = () => {
                if (!el?.parentElement) return;
                const pw = el.parentElement.clientWidth || 200;
                const cw = el.scrollWidth;
                if (cw <= 0) return;
                const sp = isFirst ? Math.min(pw, 60) : pw;
                isFirst = false;
                const dur = (sp + cw) / 45;
                el.style.setProperty('--ticker-start', `${sp}px`);
                el.style.setProperty('--ticker-end', `-${cw}px`);
                el.style.animation = 'none';
                void el.offsetWidth;
                el.style.animation = `tickerScroll ${dur}s linear 1`;
              };
              const onEnd = () => { el.style.animation = 'none'; requestAnimationFrame(() => requestAnimationFrame(go)); };
              const prev = (el as HTMLDivElement & { __tickerEnd?: () => void }).__tickerEnd;
              if (prev) el.removeEventListener('animationend', prev);
              (el as HTMLDivElement & { __tickerEnd?: () => void }).__tickerEnd = onEnd;
              el.addEventListener('animationend', onEnd);
              requestAnimationFrame(go);
            }}
            className="flex items-center h-full whitespace-nowrap"
            style={{ position: 'relative' }}
          >
            <span style={{ display: 'inline-block', width: '20px', flexShrink: 0 }} />
            {tickerItems.map((a, i) => (
              <span key={i} className="inline-flex items-center" style={{ marginRight: '40px' }}>
                <span style={{ color: a.isTask ? '#60a5fa' : a.isWeatherAlert ? '#ff6b6b' : '#e2e8f0', fontSize: '11px', fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  {a.isTask ? '📋 ' : a.isWeatherAlert ? '⚠️ ' : '📢 '}{a.title || a.Title || a.content}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <div className="flex items-center h-full px-2">
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontFamily: "system-ui, -apple-system, sans-serif" }}>No announcements</span>
          </div>
        )}
      </div>
    </div>
  );
}
