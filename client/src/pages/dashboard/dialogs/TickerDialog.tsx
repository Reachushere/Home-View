import React from "react";
import { GripVertical, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TICKER_TIME_OPTIONS, buildExpiryISO, isoToDateTimeParts } from "../pureHelpers";

interface ColorSettings {
  mainBackground: string;
  mainBackgroundGradientEnd: string;
  headerBar: string;
  [k: string]: any;
}

interface Props {
  open: boolean;
  setTickerDialogOpen: (v: boolean) => void;
  colorSettings: ColorSettings;
  d2lTickerEnabled: boolean;
  setD2lTickerEnabled: (v: boolean) => void;
  todayTaskTickerItems: any[];
  d2lAnnouncements: any[];
  tickerDragIdx: number | null;
  setTickerDragIdx: (v: number | null) => void;
  tickerDragOverIdx: number | null;
  setTickerDragOverIdx: (v: number | null) => void;
  tickerTouchDragRef: React.MutableRefObject<{ startY: number; idx: number; el: HTMLElement } | null>;
  reorderTickerMutation: any;
  deleteTickerMutation: any;
  updateTickerExpiryMutation: any;
  updateTickerVisibilityMutation: any;
  addTickerMutation: any;
  newTickerTag: string;
  setNewTickerTag: (v: string) => void;
  newTickerText: string;
  setNewTickerText: (v: string) => void;
  newTickerVisibleTo: string[];
  setNewTickerVisibleTo: React.Dispatch<React.SetStateAction<string[]>>;
  newTickerExpiryDate: string;
  setNewTickerExpiryDate: (v: string) => void;
  newTickerExpiryTime: string;
  setNewTickerExpiryTime: (v: string) => void;
  customTickerTags: string[];
  setCustomTickerTags: React.Dispatch<React.SetStateAction<string[]>>;
  allSemesterSettingsRef: React.MutableRefObject<any[] | null>;
  semesterSettings: any;
  dismissedTodayTaskIds: Set<string>;
  setDismissedTodayTaskIds: (s: Set<string>) => void;
  toast: (opts: any) => void;
}

export function TickerDialog(props: Props) {
  const {
    open, setTickerDialogOpen, colorSettings,
    d2lTickerEnabled, setD2lTickerEnabled,
    todayTaskTickerItems, d2lAnnouncements,
    tickerDragIdx, setTickerDragIdx, tickerDragOverIdx, setTickerDragOverIdx,
    tickerTouchDragRef,
    reorderTickerMutation, deleteTickerMutation, updateTickerExpiryMutation,
    updateTickerVisibilityMutation, addTickerMutation,
    newTickerTag, setNewTickerTag, newTickerText, setNewTickerText,
    newTickerVisibleTo, setNewTickerVisibleTo,
    newTickerExpiryDate, setNewTickerExpiryDate,
    newTickerExpiryTime, setNewTickerExpiryTime,
    customTickerTags, setCustomTickerTags,
    allSemesterSettingsRef, semesterSettings,
    dismissedTodayTaskIds, setDismissedTodayTaskIds,
    toast,
  } = props;
  if (!open) return null;
  return (
        <div className="fixed inset-0 flex items-start justify-center pt-[50px]" style={{ zIndex: 10010, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) setTickerDialogOpen(false); }} data-testid="ticker-dialog-overlay">
          <div className="sm:rounded-lg shadow-2xl w-[860px] max-w-[97vw] max-h-[80vh] flex flex-col overflow-hidden" style={{ background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`, border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)' }} data-testid="ticker-dialog">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)' }}>
              <div className="flex items-center gap-3">
                <span className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>TICKER ITEMS</span>
                <div className="flex items-center gap-1.5" data-testid="toggle-d2l-ticker">
                  <span className="text-white/60 text-[9px] font-medium">Ticker</span>
                  <input
                    type="checkbox"
                    checked={d2lTickerEnabled}
                    onChange={(e) => {
                      setD2lTickerEnabled(e.target.checked);
                      localStorage.setItem('d2lTickerEnabled', JSON.stringify(e.target.checked));
                    }}
                    className="h-3 w-3 accent-blue-500 cursor-pointer"
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0" style={{ marginRight: '28px' }}>
                {['B', 'Y', 'G'].map(label => (
                  <span key={label} style={{ width: '20px', textAlign: 'center', fontSize: '9px', fontWeight: 700, color: 'rgba(255,255,255,0.6)', fontFamily: "system-ui, -apple-system, sans-serif" }}>{label}</span>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: 'thin' }}>
              {(() => {
                const allDialogItems = [...todayTaskTickerItems.map((t: any) => ({ ...t, _isSynthetic: true })), ...d2lAnnouncements];
                if (allDialogItems.length === 0) return <div className="text-white/40 text-[12px] text-center py-6">No ticker items</div>;
                return allDialogItems.map((a: any, idx: number) => (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => { setTickerDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={(e) => { e.preventDefault(); setTickerDragOverIdx(idx); }}
                    onDragEnd={() => {
                      if (tickerDragIdx !== null && tickerDragOverIdx !== null && tickerDragIdx !== tickerDragOverIdx) {
                        const items = [...d2lAnnouncements];
                        const [moved] = items.splice(tickerDragIdx, 1);
                        items.splice(tickerDragOverIdx, 0, moved);
                        reorderTickerMutation.mutate(items.map((i: any) => i.id));
                      }
                      setTickerDragIdx(null);
                      setTickerDragOverIdx(null);
                    }}
                    onTouchStart={(e) => {
                      const touch = e.touches[0];
                      tickerTouchDragRef.current = { startY: touch.clientY, idx, el: e.currentTarget as HTMLElement };
                    }}
                    onTouchMove={(e) => {
                      if (!tickerTouchDragRef.current) return;
                      const touch = e.touches[0];
                      const container = (e.currentTarget as HTMLElement).parentElement;
                      if (!container) return;
                      const children = Array.from(container.querySelectorAll('[data-ticker-drag-item]'));
                      for (let i = 0; i < children.length; i++) {
                        const rect = children[i].getBoundingClientRect();
                        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
                          setTickerDragOverIdx(i);
                          break;
                        }
                      }
                      setTickerDragIdx(tickerTouchDragRef.current.idx);
                    }}
                    onTouchEnd={() => {
                      if (tickerDragIdx !== null && tickerDragOverIdx !== null && tickerDragIdx !== tickerDragOverIdx) {
                        const items = [...d2lAnnouncements];
                        const [moved] = items.splice(tickerDragIdx, 1);
                        items.splice(tickerDragOverIdx, 0, moved);
                        reorderTickerMutation.mutate(items.map((i: any) => i.id));
                      }
                      setTickerDragIdx(null);
                      setTickerDragOverIdx(null);
                      tickerTouchDragRef.current = null;
                    }}
                    data-ticker-drag-item
                    className="cursor-grab active:cursor-grabbing"
                    style={{
                      opacity: tickerDragIdx === idx ? 0.4 : 1,
                      borderTop: tickerDragOverIdx === idx && tickerDragIdx !== null && tickerDragIdx !== idx ? '2px solid rgba(99,102,241,0.8)' : '2px solid transparent',
                      transition: 'opacity 0.15s',
                    }}
                    data-testid={`ticker-item-${a.id}`}
                  >
                    <div className="flex items-center gap-2.5 py-3">
                      <GripVertical className="h-4 w-4 text-white/40 shrink-0" />
                      <span className="text-[12px] px-2 py-1 rounded font-semibold shrink-0" style={{ minWidth: '72px', textAlign: 'center', backgroundColor: a.courseName === 'Custom' ? 'rgba(255,255,255,0.18)' : a.courseName === 'URGENT' ? 'rgba(239,68,68,0.45)' : a.courseName === 'REMINDER' ? 'rgba(234,179,8,0.4)' : 'rgba(99,102,241,0.38)', color: '#ffffff' }}>
                        {a.courseName === 'Custom' ? '📌' : a.courseName}
                      </span>
                      <span className="text-white text-[14px] flex-1 min-w-0 text-left" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={(a.body || a.snippet || a.subject || '').replace(/^\s*\[[^\]]*\]\s*/g, '')}>{(a.body || a.snippet || a.subject || '').replace(/^\s*\[[^\]]*\]\s*/g, '')}</span>
                      {!a._isSynthetic && (() => {
                        const parts = isoToDateTimeParts(a.expiresAt);
                        return (
                          <div className="flex items-center gap-1 shrink-0 mr-1.5" data-testid={`ticker-expiry-${a.id}`}>
                            <input
                              type="date"
                              value={parts.date}
                              onChange={(e) => {
                                const newDate = e.target.value;
                                if (!newDate) {
                                  updateTickerExpiryMutation.mutate({ id: a.id, expiresAt: null });
                                } else {
                                  const iso = buildExpiryISO(newDate, parts.time || '11:59 PM');
                                  updateTickerExpiryMutation.mutate({ id: a.id, expiresAt: iso });
                                }
                              }}
                              className="text-white text-[12px] px-2 py-1.5 rounded focus:outline-none"
                              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', colorScheme: 'dark', width: '125px' }}
                              title="Expiry date (optional)"
                              data-testid={`input-ticker-expiry-date-${a.id}`}
                            />
                            <select
                              value={parts.time}
                              disabled={!parts.date}
                              onChange={(e) => {
                                if (!parts.date) return;
                                const iso = buildExpiryISO(parts.date, e.target.value);
                                updateTickerExpiryMutation.mutate({ id: a.id, expiresAt: iso });
                              }}
                              className="text-white text-[12px] px-2 py-1.5 rounded focus:outline-none disabled:opacity-30"
                              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                              title="Expiry time (optional)"
                              data-testid={`select-ticker-expiry-time-${a.id}`}
                            >
                              {TICKER_TIME_OPTIONS.map(t => (
                                <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t}</option>
                              ))}
                            </select>
                            {parts.date && (
                              <button
                                onClick={() => updateTickerExpiryMutation.mutate({ id: a.id, expiresAt: null })}
                                className="text-white/70 hover:text-white text-[14px] px-1"
                                title="Clear expiry"
                                data-testid={`button-clear-ticker-expiry-${a.id}`}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        );
                      })()}
                      {!a._isSynthetic && (
                        <div className="flex items-center gap-1 shrink-0">
                          {['5747', '4201', '1010'].map(p => {
                            const vis = a.visibleTo || ['5747', '4201', '1010'];
                            const checked = vis.includes(p);
                            return (
                              <button
                                key={p}
                                onClick={() => {
                                  const curr = a.visibleTo || ['5747', '4201', '1010'];
                                  const next = checked ? curr.filter((v: string) => v !== p) : [...curr, p];
                                  updateTickerVisibilityMutation.mutate({ id: a.id, visibleTo: next });
                                }}
                                style={{
                                  width: '28px', height: '22px', borderRadius: '4px',
                                  fontSize: '10px', fontWeight: 700, color: '#ffffff',
                                  fontFamily: "system-ui, -apple-system, sans-serif",
                                  background: checked ? (p === '5747' ? 'rgba(99,102,241,0.55)' : p === '4201' ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.28)') : 'rgba(255,255,255,0.08)',
                                  border: checked ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                                  cursor: 'pointer',
                                }}
                                data-testid={`ticker-vis-${a.id}-${p}`}
                                title={p === '5747' ? 'Bryn' : p === '4201' ? 'Yasu' : 'Guest'}
                              >{p === '5747' ? 'B' : p === '4201' ? 'Y' : 'G'}</button>
                            );
                          })}
                        </div>
                      )}
                      <button
                        onClick={() => {
                          if (a._isSynthetic) {
                            const newSet = new Set(dismissedTodayTaskIds);
                            newSet.add(a.id);
                            setDismissedTodayTaskIds(newSet);
                            localStorage.setItem('dismissedTodayTaskIds', JSON.stringify([...newSet]));
                          } else {
                            deleteTickerMutation.mutate(a.id);
                          }
                        }}
                        className="shrink-0 text-white/70 hover:text-red-400 transition-colors p-1.5"
                        data-testid={`button-delete-ticker-${a.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {idx < allDialogItems.length - 1 && (
                      <div style={{ marginLeft: '22px', marginRight: '8px', borderBottom: '1px solid rgba(255,255,255,0.12)' }} />
                    )}
                  </div>
                ));
              })()}
            </div>
            <div className="px-4 py-4 flex items-center gap-2.5" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>
              <select
                value={newTickerTag}
                onChange={(e) => setNewTickerTag(e.target.value)}
                className="text-white text-[13px] px-2.5 py-2.5 rounded focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', minWidth: '110px' }}
                data-testid="select-ticker-tag"
              >
                <option value="Custom" style={{ background: '#1a1a2e' }}>📌 Custom</option>
                {(() => {
                  const sems = allSemesterSettingsRef.current || (semesterSettings ? [semesterSettings] : []);
                  const seen = new Set<string>();
                  const codes: string[] = [];
                  for (const sem of sems) {
                    for (let i = 1; i <= 3; i++) {
                      const c = ((sem as any)[`course${i}Code`] || '').trim().replace(/\s/g, '').toUpperCase();
                      if (c && !seen.has(c)) { seen.add(c); codes.push(c); }
                    }
                  }
                  codes.sort();
                  return codes.map(code => <option key={code} value={code} style={{ background: '#1a1a2e' }}>{code}</option>);
                })()}
                <option value="REMINDER" style={{ background: '#1a1a2e' }}>REMINDER</option>
                <option value="URGENT" style={{ background: '#1a1a2e' }}>URGENT</option>
                {customTickerTags.map(tag => (
                  <option key={`ct-${tag}`} value={tag} style={{ background: '#1a1a2e' }}>{tag}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const name = prompt('New category name:')?.trim();
                  if (!name) return;
                  const norm = name.toUpperCase();
                  setCustomTickerTags(prev => {
                    if (prev.includes(norm)) return prev;
                    const next = [...prev, norm];
                    try { localStorage.setItem('customTickerTags', JSON.stringify(next)); } catch {}
                    return next;
                  });
                  setNewTickerTag(norm);
                }}
                className="shrink-0 text-white text-[16px] font-bold px-2.5 py-2.5 rounded hover:brightness-125"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', lineHeight: 1 }}
                title="Add new category"
                data-testid="button-add-ticker-category"
              >
                +
              </button>
              <input
                type="text"
                value={newTickerText}
                onChange={(e) => setNewTickerText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && newTickerText.trim()) { addTickerMutation.mutate({ body: newTickerText.trim(), tag: newTickerTag, visibleTo: newTickerVisibleTo, expiresAt: buildExpiryISO(newTickerExpiryDate, newTickerExpiryTime) }); } }}
                placeholder="Add ticker item..."
                className="flex-1 text-white text-[14px] px-3 py-2.5 rounded focus:outline-none placeholder:text-white/50"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}
                data-testid="input-new-ticker"
              />
              <button
                onClick={() => { if (newTickerText.trim()) addTickerMutation.mutate({ body: newTickerText.trim(), tag: newTickerTag, visibleTo: newTickerVisibleTo, expiresAt: buildExpiryISO(newTickerExpiryDate, newTickerExpiryTime) }); }}
                disabled={!newTickerText.trim() || addTickerMutation.isPending}
                className="shrink-0 disabled:opacity-40 text-white text-[14px] font-semibold px-4 py-2.5 rounded transition-colors hover:brightness-110"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                data-testid="button-add-ticker"
              >
                + Add
              </button>
            </div>
            <div className="flex items-center gap-2 px-4 pb-2 pt-2">
              <span className="text-white text-[12px] mr-1.5 font-medium">Visible to:</span>
              {['5747', '4201', '1010'].map(p => {
                const checked = newTickerVisibleTo.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => setNewTickerVisibleTo(prev => checked ? prev.filter(v => v !== p) : [...prev, p])}
                    style={{
                      width: '30px', height: '24px', borderRadius: '4px', fontSize: '11px', fontWeight: 700,
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      background: checked ? (p === '5747' ? 'rgba(99,102,241,0.55)' : p === '4201' ? 'rgba(139,92,246,0.55)' : 'rgba(255,255,255,0.28)') : 'rgba(255,255,255,0.08)',
                      border: checked ? '1px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.2)',
                      color: '#ffffff',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                    data-testid={`new-ticker-vis-${p}`}
                    title={p === '5747' ? 'Bryn' : p === '4201' ? 'Yasu' : 'Guest'}
                  >
                    {p === '5747' ? 'B' : p === '4201' ? 'Y' : 'G'}
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2 px-4 pb-3 pt-1">
              <span className="text-white text-[12px] mr-1.5 font-medium">Expires:</span>
              <input
                type="date"
                value={newTickerExpiryDate}
                onChange={(e) => setNewTickerExpiryDate(e.target.value)}
                className="text-white text-[12px] px-2 py-1.5 rounded focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', colorScheme: 'dark' }}
                data-testid="input-new-ticker-expiry-date"
              />
              <select
                value={newTickerExpiryTime}
                onChange={(e) => setNewTickerExpiryTime(e.target.value)}
                disabled={!newTickerExpiryDate}
                className="text-white text-[12px] px-2 py-1.5 rounded focus:outline-none disabled:opacity-40"
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}
                data-testid="select-new-ticker-expiry-time"
              >
                {TICKER_TIME_OPTIONS.map(t => (
                  <option key={t} value={t} style={{ background: '#1a1a2e' }}>{t}</option>
                ))}
              </select>
              {newTickerExpiryDate && (
                <button
                  onClick={() => { setNewTickerExpiryDate(''); setNewTickerExpiryTime('11:59 PM'); }}
                  className="text-white/70 hover:text-white text-[14px] px-1.5"
                  data-testid="button-clear-new-ticker-expiry"
                  title="Clear expiry"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <Button
                variant="outline"
                className="border !border-white/30 text-white/70 hover:text-white hover:!border-white/50 hover:bg-transparent transition-opacity duration-200 h-8 w-[110px]"
                style={{ fontSize: '12px' }}
                onClick={() => setTickerDialogOpen(false)}
                data-testid="button-cancel-ticker-dialog"
              >
                Cancel
              </Button>
              <Button
                variant="outline"
                className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-opacity duration-200 h-8 w-[110px]"
                style={{ boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)', fontSize: '12px' }}
                onClick={() => {
                  toast({ title: "Saved", description: "Ticker items saved." });
                  setTickerDialogOpen(false);
                }}
                data-testid="button-save-ticker-dialog"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
  );
}
