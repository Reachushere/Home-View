import { useState, useRef, useEffect, memo } from "react";
import newsTickerLabel from "@assets/News_1773894837015.png";
import weatherAlertLogoPath from "@assets/Weather_Alert_1773608511887.png";
import { TICKER_LOGO_MAP, getAppTz } from "./dashboard-utils";

export function NewsTickerPortal({ headlines, onAlertClick }: { headlines: Array<{ title: string; link: string; source: string; publishedAt?: string; alertIndex?: number }>; onAlertClick?: (index: number) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<any>(null);
  const prevHeadlinesKeyRef = useRef<string>('');
  const renderedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) {
      const el = document.createElement('div');
      el.id = 'news-ticker-root';
      el.style.position = 'fixed';
      el.style.bottom = '0';
      el.style.left = '0';
      el.style.right = '0';
      el.style.zIndex = '9998';
      el.style.height = '0';
      el.style.overflow = 'visible';
      document.body.appendChild(el);
      containerRef.current = el;
    }
    return () => {
      if (containerRef.current) {
        containerRef.current.remove();
        containerRef.current = null;
        rootRef.current = null;
        renderedRef.current = false;
      }
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || headlines.length === 0) return;
    const headlinesKey = headlines.map(h => `${h.source}::${h.title}`).join('|');
    if (renderedRef.current && headlinesKey === prevHeadlinesKeyRef.current) return;
    prevHeadlinesKeyRef.current = headlinesKey;
    renderedRef.current = true;
    const hasAlerts = headlines.some(h => h.source === '_ALERT_');
    const html = `<div class="fixed left-0 right-0 z-[9998] overflow-hidden flex" style="bottom:0;height:38px;background:linear-gradient(90deg,#000000 0%,#14141e 50%,#000000 100%);border-top:1px solid rgba(255,255,255,0.15)" data-testid="news-ticker">${hasAlerts ? '<div class="alert-bar-shimmer" style="position:absolute;top:0;left:0;width:calc(50% - 70px - 52px);height:3px;background:#ff0000;z-index:9999"></div><div class="alert-bar-shimmer" style="position:absolute;top:0;left:calc(50% + 63px + 38px);right:0;height:3px;background:#ff0000;z-index:9999;animation-delay:0.3s"></div>' : ''}<div class="flex-shrink-0 flex items-center justify-center" style="height:38px;width:auto"><img src="${newsTickerLabel}" alt="NEWS" style="height:38px;width:auto;object-fit:contain" /></div><div class="flex-1 overflow-hidden relative h-full"><div class="flex items-center h-full whitespace-nowrap news-ticker-scroll" style="position:relative;padding-top:3px"><span style="display:inline-block;width:40px;flex-shrink:0"></span>${headlines.map((item, i) => {
      if (item.source === '_ALERT_') {
        const alertIdx = (item as any).alertIndex ?? '';
        return `<span class="inline-flex items-center gap-1.5" style="animation:tickerAlertBlink 1s ease-in-out infinite;margin-left:16px;margin-right:48px;cursor:pointer" data-testid="weather-alert-${i}" data-alert-index="${alertIdx}"><img src="${weatherAlertLogoPath}" alt="Weather Alert" class="rounded-sm" style="height:28px;width:auto;object-fit:contain" /><span class="text-[13.5px] font-bold" style="color:#ff4444;text-shadow:0 0 6px rgba(255,68,68,0.5)">${item.title}</span><span class="text-white/20 mx-2">|</span></span>`;
      }
      if (item.source === '_FORECAST_' || item.source === '_FORECAST_NOSEP_') {
        const forecastHtml = item.title.replace(/(<b>[^<]*<\/b>:?|(?:Toronto Forecast|3-Day Forecast:|Forecast Brief:|Pollen):?)/, '<span style="color:rgb(0,255,0);text-shadow:0 0 4px rgba(0,255,0,0.3)">$1</span>');
        const sep = item.source === '_FORECAST_' ? '<span class="text-white/20 mx-2">|</span>' : '';
        return `<span class="inline-flex items-center gap-1.5 mx-4" data-testid="weather-forecast-${i}"><span class="text-[16px] text-white/95">${forecastHtml}</span>${sep}</span>`;
      }
      const logoInfo = TICKER_LOGO_MAP[item.source];
      const logoHtml = logoInfo
        ? `<img src="${logoInfo.src}" alt="${item.source}" class="rounded-sm" style="height:${logoInfo.height}px;width:auto;min-width:${logoInfo.height}px;object-fit:contain;vertical-align:middle" />`
        : `<span class="text-[11px] font-bold px-1 py-0 rounded bg-gray-600 text-white">${item.source}</span>`;
      const safeTitle = item.title.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      let timeAgoHtml = '';
      if (item.publishedAt) {
        const diff = Date.now() - new Date(item.publishedAt).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins >= 0 && mins <= 4320) {
          const ago = mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.floor(mins / 60)}h` : `${Math.floor(mins / 1440)}d`;
          timeAgoHtml = `<span class="text-[14px]" style="color:rgba(255,255,255,0.6);margin-left:4px">${ago}</span>`;
        }
      }
      return `<a href="${item.link}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 mx-4 no-underline hover:underline" data-testid="news-headline-${i}">${logoHtml}<span class="text-white/85 mx-1 text-[16px]" style="line-height:1;vertical-align:middle;font-weight:300">|</span><span class="text-[16px] text-white/90">${safeTitle}</span>${timeAgoHtml}</a>`;
    }).join('')}</div></div></div>`;
    containerRef.current.innerHTML = html;
    const tickerEl = containerRef.current;
    const handleAlertClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('[data-alert-index]') as HTMLElement | null;
      if (target && onAlertClick) {
        const idx = parseInt(target.getAttribute('data-alert-index') || '', 10);
        if (!isNaN(idx)) onAlertClick(idx);
      }
    };
    tickerEl.addEventListener('click', handleAlertClick);
    const applyTickerAnimation = () => {
      const scrollEl = containerRef.current?.querySelector('.news-ticker-scroll') as HTMLElement | null;
      if (!scrollEl) return;
      scrollEl.style.animation = 'none';
      scrollEl.style.transform = 'translate3d(0,0,0)';
      void scrollEl.offsetWidth;
      const parentWidth = scrollEl.parentElement?.clientWidth || window.innerWidth;
      let contentWidth = 0;
      const children = scrollEl.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i] as HTMLElement;
        contentWidth += child.offsetWidth + (parseFloat(getComputedStyle(child).marginLeft) || 0) + (parseFloat(getComputedStyle(child).marginRight) || 0);
      }
      contentWidth = Math.max(contentWidth, scrollEl.scrollWidth) + 100;
      const totalTravel = parentWidth + contentWidth;
      const speed = 65;
      const dur = totalTravel / speed;
      scrollEl.style.setProperty('--ticker-start', `${parentWidth}px`);
      scrollEl.style.setProperty('--ticker-end', `-${contentWidth}px`);
      scrollEl.style.animation = `tickerScroll ${dur}s linear infinite`;
    };
    const imgs = containerRef.current.querySelectorAll('img');
    if (imgs.length > 0) {
      let loaded = 0;
      const total = imgs.length;
      const onLoad = () => { loaded++; if (loaded >= total) { requestAnimationFrame(() => requestAnimationFrame(applyTickerAnimation)); } };
      imgs.forEach(img => { if (img.complete) { loaded++; } else { img.addEventListener('load', onLoad); img.addEventListener('error', onLoad); } });
      if (loaded >= total) {
        requestAnimationFrame(() => requestAnimationFrame(applyTickerAnimation));
      }
      setTimeout(applyTickerAnimation, 800);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(applyTickerAnimation));
    }
  }, [headlines]);

  return null;
}

export const PrioritySelect = memo(function PrioritySelect({ priorityKey, initialValue, totalInSem, draftRef, courseCode, usedValues, onPriorityChange, suffix }: { priorityKey: string; initialValue: number; totalInSem: number; draftRef: React.MutableRefObject<Record<string, number>>; courseCode: string; usedValues: number[]; onPriorityChange: (key: string, val: number) => void; suffix?: string }) {
  const hasSuffix = suffix === 'A' || suffix === 'B';
  const clamp = (v: number) => (hasSuffix && v > 2 ? 0 : v);
  const [val, setVal] = useState(clamp(initialValue));
  useEffect(() => {
    const c = clamp(initialValue);
    setVal(c);
    if (c !== initialValue) {
      draftRef.current = { ...draftRef.current, [priorityKey]: c };
      onPriorityChange(priorityKey, c);
    }
  }, [initialValue]);
  return (
    <select
      className="text-[11px] font-semibold bg-white/10 rounded px-1 py-0.5 border border-white/20 focus:outline-none focus:border-white/50 cursor-pointer appearance-none text-center"
      style={{ width: hasSuffix ? '30px' : '22px', minWidth: hasSuffix ? '30px' : '22px', WebkitAppearance: 'none', MozAppearance: 'none', marginLeft: '5px', color: 'inherit' }}
      value={val}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        e.stopPropagation();
        const v = parseInt(e.target.value, 10);
        setVal(v);
        draftRef.current = { ...draftRef.current, [priorityKey]: v };
        onPriorityChange(priorityKey, v);
      }}
      data-testid={`select-priority-${courseCode}${hasSuffix ? `-${suffix}` : ''}`}
    >
      <option value={0}>—</option>
      {Array.from({ length: hasSuffix ? Math.min(totalInSem, 2) : totalInSem }, (_, i) => {
        const n = i + 1;
        const taken = usedValues.includes(n) && val !== n;
        return <option key={n} value={n} disabled={taken} style={taken ? { color: '#555' } : {}}>{hasSuffix ? `${n}${suffix}` : n}</option>;
      })}
    </select>
  );
});

export function PartnerShiftWizard({ partnerWizardStep, setPartnerWizardStep, partnerWizardDates, setPartnerWizardDates, partnerWizardShiftType, setPartnerWizardShiftType, partnerWizardMonth, setPartnerWizardMonth, partnerWizardSubmitting, setPartnerWizardSubmitting, colorSettings, onClose, onDone }: {
  partnerWizardStep: number; setPartnerWizardStep: (s: number) => void;
  partnerWizardDates: string[]; setPartnerWizardDates: (d: string[]) => void;
  partnerWizardShiftType: 'day' | 'night'; setPartnerWizardShiftType: (t: 'day' | 'night') => void;
  partnerWizardMonth: { year: number; month: number }; setPartnerWizardMonth: (m: { year: number; month: number }) => void;
  partnerWizardSubmitting: boolean; setPartnerWizardSubmitting: (b: boolean) => void;
  colorSettings: any; onClose: () => void; onDone: () => void;
}) {
  const [existingShifts, setExistingShifts] = useState<{ date: string; shiftType: string }[]>([]);
  const [removeDates, setRemoveDates] = useState<string[]>([]);
  const [shiftLabel, setShiftLabel] = useState('CRCU');
  const [editingLabel, setEditingLabel] = useState(false);

  useEffect(() => {
    fetch('/api/shift-schedule').then(r => r.json()).then(data => {
      if (Array.isArray(data)) setExistingShifts(data);
    }).catch(() => {});
  }, []);

  const daysInMonth = new Date(partnerWizardMonth.year, partnerWizardMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(partnerWizardMonth.year, partnerWizardMonth.month, 1).getDay();
  const monthName = new Date(partnerWizardMonth.year, partnerWizardMonth.month).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const getExistingShift = (dateStr: string) => existingShifts.find(s => s.date === dateStr);
  const isMarkedForRemoval = (dateStr: string) => removeDates.includes(dateStr);

  const toggleDate = (dateStr: string) => {
    const existing = getExistingShift(dateStr);
    if (existing && !partnerWizardDates.includes(dateStr)) {
      setRemoveDates(prev => prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]);
      return;
    }
    if (existing && partnerWizardDates.includes(dateStr)) {
      setPartnerWizardDates(partnerWizardDates.filter(d => d !== dateStr));
      return;
    }
    setPartnerWizardDates(partnerWizardDates.includes(dateStr) ? partnerWizardDates.filter(d => d !== dateStr) : [...partnerWizardDates, dateStr]);
  };

  const prevMonth = () => {
    const m = partnerWizardMonth.month === 0 ? 11 : partnerWizardMonth.month - 1;
    const y = partnerWizardMonth.month === 0 ? partnerWizardMonth.year - 1 : partnerWizardMonth.year;
    setPartnerWizardMonth({ year: y, month: m });
  };
  const nextMonth = () => {
    const m = partnerWizardMonth.month === 11 ? 0 : partnerWizardMonth.month + 1;
    const y = partnerWizardMonth.month === 11 ? partnerWizardMonth.year + 1 : partnerWizardMonth.year;
    setPartnerWizardMonth({ year: y, month: m });
  };

  const handleSubmit = async () => {
    setPartnerWizardSubmitting(true);
    try {
      if (removeDates.length > 0) {
        const delBulk = removeDates.map(d => ({ date: d, shiftType: 'off' }));
        await fetch('/api/shift-schedule', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bulk: delBulk }),
        }).catch(() => {});
        try {
          const delRes = await fetch('/api/google/third-account/delete-shifts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dates: removeDates }),
          });
          if (!delRes.ok) console.error('[PartnerWizard] Google Calendar delete failed:', await delRes.text());
        } catch (e) { console.error('[PartnerWizard] Google Calendar delete error:', e); }
      }
      if (partnerWizardDates.length > 0) {
        const bulkData = partnerWizardDates.map(d => ({ date: d, shiftType: partnerWizardShiftType }));
        await fetch('/api/shift-schedule', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bulk: bulkData }),
        });
        try {
          const createRes = await fetch('/api/google/third-account/create-shifts', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shifts: partnerWizardDates.map(d => ({ date: d, type: partnerWizardShiftType })), label: shiftLabel }),
          });
          if (!createRes.ok) console.error('[PartnerWizard] Google Calendar create failed:', await createRes.text());
        } catch (e) { console.error('[PartnerWizard] Google Calendar create error:', e); }
      }
      onDone();
    } catch (err) {
      console.error('[PartnerWizard] Submit error:', err);
      onDone();
    } finally { setPartnerWizardSubmitting(false); }
  };

  const hasChanges = partnerWizardDates.length > 0 || removeDates.length > 0;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10015, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', WebkitTransform: 'translateZ(0)' }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '320px', maxWidth: '95vw', maxHeight: '90vh', borderRadius: '16px', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`,
        border: '1px solid rgba(255,255,255,0.25)', boxShadow: '0 10px 40px rgba(0,0,0,0.4)',
      }} onClick={e => e.stopPropagation()} data-testid="partner-shift-wizard">
        <div style={{
          padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editingLabel ? (
              <input
                autoFocus
                value={shiftLabel}
                onChange={e => setShiftLabel(e.target.value)}
                onBlur={() => setEditingLabel(false)}
                onKeyDown={e => { if (e.key === 'Enter') setEditingLabel(false); }}
                style={{ color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '4px', padding: '2px 6px', width: '80px', outline: 'none' }}
                data-testid="partner-wizard-label-input"
              />
            ) : (
              <>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
                  {shiftLabel} {partnerWizardStep === 0 ? 'SHIFTS' : 'SHIFT TYPE'}
                </span>
                <button onClick={() => setEditingLabel(true)} style={{ color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', fontSize: '12px', cursor: 'pointer', padding: '2px' }} data-testid="partner-wizard-edit-label">✏️</button>
              </>
            )}
          </div>
          <button onClick={onClose} style={{ color: 'rgba(255,255,255,0.6)', background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
          {partnerWizardStep === 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <button onClick={prevMonth} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>‹</button>
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>{monthName}</span>
                <button onClick={nextMonth} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}>›</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgb(251,146,60)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}>Day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgb(139,92,246)' }} />
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}>Night</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>✕ = remove</span>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '9px', fontWeight: 600, paddingBottom: '4px' }}>{d}</div>
                ))}
                {Array.from({ length: firstDayOfWeek }).map((_, i) => <div key={`e-${i}`} />)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${partnerWizardMonth.year}-${String(partnerWizardMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isSelected = partnerWizardDates.includes(dateStr);
                  const existing = getExistingShift(dateStr);
                  const markedRemove = isMarkedForRemoval(dateStr);
                  const today = new Date();
                  const isToday = day === today.getDate() && partnerWizardMonth.month === today.getMonth() && partnerWizardMonth.year === today.getFullYear();
                  const existingColor = existing?.shiftType === 'day' ? 'rgb(251,146,60)' : existing?.shiftType === 'night' ? 'rgb(139,92,246)' : '';
                  let bg = 'rgba(255,255,255,0.06)';
                  if (isSelected) bg = 'rgba(139,92,246,0.6)';
                  else if (existing && !markedRemove) bg = existing.shiftType === 'day' ? 'rgba(251,146,60,0.25)' : 'rgba(139,92,246,0.25)';
                  else if (markedRemove) bg = 'rgba(239,68,68,0.25)';
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDate(dateStr)}
                      style={{
                        width: '100%', aspectRatio: '1', borderRadius: '8px',
                        border: isToday ? '1.5px solid rgba(255,255,255,0.6)' : '1px solid transparent',
                        background: bg,
                        color: markedRemove ? 'rgba(239,68,68,0.8)' : isSelected ? '#fff' : existing ? existingColor : 'rgba(255,255,255,0.7)',
                        fontSize: '12px', fontWeight: (isSelected || existing) ? 700 : 400, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        position: 'relative',
                        transition: 'background 0.15s',
                      }}
                      data-testid={`partner-date-${dateStr}`}
                    >
                      {markedRemove ? '✕' : day}
                      {existing && !markedRemove && !isSelected && (
                        <div style={{ position: 'absolute', bottom: '2px', left: '50%', transform: 'translateX(-50%)', width: '5px', height: '5px', borderRadius: '50%', background: existingColor }} />
                      )}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                {partnerWizardDates.length > 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>
                    {partnerWizardDates.length} new date{partnerWizardDates.length !== 1 ? 's' : ''} to add
                  </div>
                )}
                {removeDates.length > 0 && (
                  <div style={{ color: 'rgba(239,68,68,0.7)', fontSize: '10px' }}>
                    {removeDates.length} shift{removeDates.length !== 1 ? 's' : ''} to remove
                  </div>
                )}
              </div>
            </div>
          )}

          {partnerWizardStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingTop: '8px' }}>
              <button
                onClick={() => setPartnerWizardShiftType('day')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 16px', borderRadius: '12px', cursor: 'pointer', border: 'none',
                  background: partnerWizardShiftType === 'day' ? 'rgba(251,146,60,0.35)' : 'rgba(255,255,255,0.06)',
                  outline: partnerWizardShiftType === 'day' ? '2px solid rgba(251,146,60,0.7)' : '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s',
                }}
                data-testid="partner-shift-day"
              >
                <span style={{ fontSize: '28px' }}>☀️</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Daytime</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>7:30 AM – 7:30 PM</div>
                </div>
                <div style={{ marginLeft: 'auto', width: '14px', height: '14px', borderRadius: '3px', background: partnerWizardShiftType === 'day' ? 'rgb(251,146,60)' : 'transparent', border: '2px solid rgba(251,146,60,0.5)' }} />
              </button>
              <button
                onClick={() => setPartnerWizardShiftType('night')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 16px', borderRadius: '12px', cursor: 'pointer', border: 'none',
                  background: partnerWizardShiftType === 'night' ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.06)',
                  outline: partnerWizardShiftType === 'night' ? '2px solid rgba(139,92,246,0.7)' : '1px solid rgba(255,255,255,0.1)',
                  transition: 'all 0.2s',
                }}
                data-testid="partner-shift-night"
              >
                <span style={{ fontSize: '28px' }}>🌙</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>Nighttime</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>7:30 PM – 7:30 AM</div>
                </div>
                <div style={{ marginLeft: 'auto', width: '14px', height: '14px', borderRadius: '3px', background: partnerWizardShiftType === 'night' ? 'rgb(139,92,246)' : 'transparent', border: '2px solid rgba(139,92,246,0.5)' }} />
              </button>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', textAlign: 'center', marginTop: '4px' }}>
                Adding {partnerWizardDates.length} {partnerWizardShiftType === 'day' ? '☀️ day' : '🌙 night'} shift{partnerWizardDates.length !== 1 ? 's' : ''}
                {removeDates.length > 0 && <span style={{ color: 'rgba(239,68,68,0.7)' }}> · Removing {removeDates.length}</span>}
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', gap: '8px' }}>
          {partnerWizardStep === 0 ? (
            <>
              <button onClick={onClose} style={{ flex: 1, height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} data-testid="partner-wizard-cancel">Cancel</button>
              {partnerWizardDates.length > 0 ? (
                <button
                  onClick={() => setPartnerWizardStep(1)}
                  style={{ flex: 1, height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 6px rgba(255,255,255,0.4)' }}
                  data-testid="partner-wizard-next"
                >Next</button>
              ) : removeDates.length > 0 ? (
                <button
                  onClick={handleSubmit}
                  disabled={partnerWizardSubmitting}
                  style={{ flex: 1, height: '38px', borderRadius: '10px', background: 'rgba(239,68,68,0.4)', border: '1px solid rgba(239,68,68,0.6)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 0 8px rgba(239,68,68,0.3)' }}
                  data-testid="partner-wizard-remove"
                >{partnerWizardSubmitting ? 'Removing...' : `Remove ${removeDates.length} Shift${removeDates.length !== 1 ? 's' : ''}`}</button>
              ) : (
                <button
                  disabled
                  style={{ flex: 1, height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.3)', fontSize: '13px', fontWeight: 600, cursor: 'default' }}
                >Next</button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => setPartnerWizardStep(0)} style={{ flex: 1, height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }} data-testid="partner-wizard-back">Back</button>
              <button
                onClick={handleSubmit}
                disabled={partnerWizardSubmitting}
                style={{ flex: 1, height: '38px', borderRadius: '10px', background: partnerWizardShiftType === 'day' ? 'rgba(251,146,60,0.4)' : 'rgba(139,92,246,0.4)', border: `1px solid ${partnerWizardShiftType === 'day' ? 'rgba(251,146,60,0.6)' : 'rgba(139,92,246,0.6)'}`, color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', boxShadow: `0 0 8px ${partnerWizardShiftType === 'day' ? 'rgba(251,146,60,0.4)' : 'rgba(139,92,246,0.4)'}` }}
                data-testid="partner-wizard-done"
              >{partnerWizardSubmitting ? 'Saving...' : 'Done'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export function WeatherMonthGroup({ monthStr, children, defaultOpen }: { monthStr: string; children: React.ReactNode; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 text-white font-semibold text-[13px] py-[6px] px-2 rounded hover:bg-white/10 transition-colors"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.25)' }}
        data-testid={`weather-month-toggle-${monthStr}`}
      >
        <span style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block', fontSize: '11px' }}>&#9654;</span>
        <span>{monthStr}</span>
      </button>
      {isOpen && <div className="mt-1">{children}</div>}
    </div>
  );
}

export function WeatherDateGroup({ dateStr, records, defaultOpen }: { dateStr: string; records: any[]; defaultOpen: boolean }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const sorted = records.sort((a: any, b: any) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime());
  const highTemp = Math.max(...records.map((r: any) => r.temperature));
  const lowTemp = Math.min(...records.map((r: any) => r.temperature));
  return (
    <div className="mb-1">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-white font-semibold text-[12px] py-[6px] px-2 rounded hover:bg-white/10 transition-colors"
        style={{ borderBottom: isOpen ? '1px solid rgba(255,255,255,0.15)' : 'none' }}
        data-testid={`weather-date-toggle-${dateStr}`}
      >
        <div className="flex items-center gap-2">
          <span style={{ transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s', display: 'inline-block', fontSize: '10px' }}>&#9654;</span>
          <span>{dateStr}</span>
          <span className="text-white/40 font-normal text-[10px] ml-1">{records.length} records</span>
        </div>
        <span className="text-[11px] font-normal text-white/60">
          H: <span className="text-orange-300 font-medium">{Math.round(highTemp)}°</span>
          {' '}L: <span className="text-blue-300 font-medium">{Math.round(lowTemp)}°</span>
        </span>
      </button>
      {isOpen && (
        <div className="grid gap-[2px] pt-1 pb-2">
          {sorted.map((r: any) => {
            const t = new Date(r.recordedAt);
            const timeStr = t.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: getAppTz() });
            const tempColor = r.temperature <= 0 ? '#93c5fd' : r.temperature <= 10 ? '#60a5fa' : r.temperature <= 20 ? '#fbbf24' : r.temperature <= 30 ? '#f97316' : '#ef4444';
            return (
              <div key={r.id} className="flex items-center gap-3 text-[11px] py-[3px] px-2 rounded" style={{ background: 'rgba(255,255,255,0.05)' }} data-testid={`weather-record-${r.id}`}>
                <span className="text-white w-[70px] shrink-0">{timeStr}</span>
                <span className="font-bold w-[45px] shrink-0" style={{ color: tempColor }}>{Math.round(r.temperature)}°C</span>
                <span className="text-white w-[55px] shrink-0">{r.feelsLike != null ? `${Math.round(r.feelsLike)}°C` : '--'}</span>
                <span className="text-white w-[100px] shrink-0">{r.condition || '--'}</span>
                <span className="text-white w-[75px] shrink-0">{r.windSpeed != null ? `${Math.round(r.windSpeed)} km/h` : '--'}</span>
                <span className="text-white w-[55px] shrink-0">{r.humidity != null ? `${r.humidity}%` : '--'}</span>
                <span className="text-white w-[50px] shrink-0">{r.precipitation > 0 ? `${r.precipitation}mm` : '--'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

