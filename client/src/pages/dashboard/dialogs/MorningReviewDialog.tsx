import React from "react";
import { Sun, Loader2, Check, CheckCircle2, CalendarDays, Mail, X } from "lucide-react";

interface ColorSettings {
  mainBackground: string;
  mainBackgroundGradientEnd: string;
  headerBar: string;
  [k: string]: any;
}

interface Props {
  open: boolean;
  desktopIsFull: boolean;
  colorSettings: ColorSettings;
  reviewMode: 'all' | 'individual';
  setReviewMode: (m: 'all' | 'individual') => void;
  setReviewCheckedIds: (s: Set<number>) => void;
  morningReviewItems: any[];
  morningReviewLoading: boolean;
  processingReviewIds: Set<number>;
  reviewHideFromSummary: Set<number>;
  setReviewHideFromSummary: React.Dispatch<React.SetStateAction<Set<number>>>;
  reviewHideFromTimeline: Set<number>;
  setReviewHideFromTimeline: React.Dispatch<React.SetStateAction<Set<number>>>;
  handleSkipAllForToday: () => void;
  handleDismissAllPermanently: () => void;
  handleAcceptAll: () => void;
  handleAcceptReview: (id: number) => void;
  handleRejectReview: (id: number) => void;
}

export function MorningReviewDialog({
  open,
  desktopIsFull,
  colorSettings,
  reviewMode,
  setReviewMode,
  setReviewCheckedIds,
  morningReviewItems,
  morningReviewLoading,
  processingReviewIds,
  reviewHideFromSummary,
  setReviewHideFromSummary,
  reviewHideFromTimeline,
  setReviewHideFromTimeline,
  handleSkipAllForToday,
  handleDismissAllPermanently,
  handleAcceptAll,
  handleAcceptReview,
  handleRejectReview,
}: Props) {
  if (!open || !desktopIsFull) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10010, background: 'rgba(0,0,0,0.6)' }} data-testid="dialog-morning-review">
      <div className="flex flex-col text-white" style={{ width: '86%', maxWidth: '1125px', height: '78vh', maxHeight: '656px', borderRadius: '10px', overflow: 'hidden', background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)', margin: '0', width: '100%' }}>
        <div className="flex items-center gap-2">
          <Sun className="text-yellow-400" style={{ width: '14px', height: '14px' }} />
          <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '11px' }}>MORNING REVIEW</h2>
          <span className="text-[9px] text-white/40 ml-1">Events from your other calendars not yet added here</span>
          <div className="flex ml-2 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.25)' }} data-testid="review-mode-tabs">
            <button
              className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${reviewMode === 'all' ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif", background: reviewMode === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent' }}
              onClick={() => { setReviewMode('all'); setReviewCheckedIds(new Set()); }}
              data-testid="review-tab-all"
            >
              All
            </button>
            <button
              className={`px-2.5 py-0.5 text-[10px] font-medium transition-colors ${reviewMode === 'individual' ? 'text-white' : 'text-white/50 hover:text-white/70'}`}
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif", borderLeft: '1px solid rgba(255,255,255,0.25)', background: reviewMode === 'individual' ? 'rgba(255,255,255,0.15)' : 'transparent' }}
              onClick={() => { setReviewMode('individual'); setReviewCheckedIds(new Set()); }}
              data-testid="review-tab-individual"
            >
              Individual
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {reviewMode === 'all' ? (
            <>
              <button
                className="h-6 px-2.5 text-[10px] font-medium text-white rounded disabled:opacity-40"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}
                onClick={handleSkipAllForToday}
                disabled={morningReviewLoading}
                data-testid="button-dismiss-next-day-review"
              >
                Dismiss to Next Day
              </button>
              <button
                className="h-6 px-2.5 text-[10px] font-medium text-white rounded disabled:opacity-40"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}
                onClick={handleDismissAllPermanently}
                disabled={morningReviewLoading}
                data-testid="button-skip-all-forever-review"
              >
                {morningReviewLoading ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin inline" /> : null}
                Dismiss All Permanently
              </button>
              <button
                className="h-6 px-2.5 text-[10px] font-medium text-white rounded disabled:opacity-40"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}
                onClick={handleAcceptAll}
                disabled={morningReviewLoading}
                data-testid="button-accept-all-review"
              >
                {morningReviewLoading ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin inline" /> : <Check className="h-2.5 w-2.5 mr-0.5 inline" />}
                Accept All
              </button>
            </>
          ) : (
            <>
              <button
                className="h-6 px-2.5 text-[10px] font-medium text-white rounded disabled:opacity-40"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}
                onClick={handleSkipAllForToday}
                disabled={morningReviewLoading}
                data-testid="button-dismiss-next-day-individual"
              >
                Dismiss to Next Day
              </button>
              <button
                className="h-6 px-2.5 text-[10px] font-medium text-white rounded disabled:opacity-40"
                style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)', fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}
                onClick={handleDismissAllPermanently}
                disabled={morningReviewLoading}
                data-testid="button-decline-remaining-individual"
              >
                {morningReviewLoading ? <Loader2 className="h-2.5 w-2.5 mr-0.5 animate-spin inline" /> : null}
                Decline All Remaining
              </button>
            </>
          )}
        </div>
      </div>

      {reviewMode === 'individual' && (
        <div className="px-2.5 py-1 border-b border-white/5 flex-shrink-0">
          <span className="text-[8px] text-white/40">Accept or decline each item individually. Recurring events are grouped — accepting adds all occurrences.</span>
        </div>
      )}

      <div className="flex-1 overflow-hidden px-3 py-1.5">
        {morningReviewItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/50">
            <CheckCircle2 className="h-5 w-5 mb-1 text-green-400" />
            <p className="text-[10px]">All caught up!</p>
          </div>
        ) : (
          <div className="flex gap-2 h-full">
            {['outlook_calendar', 'google_calendar', 'gmail'].filter(source => morningReviewItems.some(i => i.source === source)).map(source => {
              const allSourceItems = morningReviewItems.filter(i => i.source === source).sort((a, b) => {
                const dateA = a.startDate ? new Date(a.startDate).getTime() : a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.startDate ? new Date(b.startDate).getTime() : b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateA - dateB;
              });
              const normalizeTitle = (t: string) => t.toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
              const seenTitles = new Map<string, { item: any; count: number }>();
              for (const item of allSourceItems) {
                const normT = normalizeTitle(item.title || '');
                if (!seenTitles.has(normT)) {
                  seenTitles.set(normT, { item, count: 1 });
                } else {
                  seenTitles.get(normT)!.count++;
                }
              }
              const items = reviewMode === 'individual'
                ? Array.from(seenTitles.values()).map(v => ({ ...v.item, _recurringCount: v.count }))
                : allSourceItems;
              const label = source === 'outlook_calendar' ? 'Outlook Calendar' : source === 'google_calendar' ? 'Google Calendar' : 'Gmail';
              const icon = source === 'outlook_calendar' ? <CalendarDays className="h-3 w-3 text-blue-400" /> : source === 'google_calendar' ? <CalendarDays className="h-3 w-3 text-green-400" /> : <Mail className="h-3 w-3 text-red-400" />;
              const totalCount = allSourceItems.length;
              return (
                <div key={source} className="flex-1 flex flex-col min-w-0" data-testid={`review-group-${source}`}>
                  <div className="flex items-center gap-1.5 pb-1 border-b border-white/15 flex-shrink-0">
                    {icon}
                    <span className="text-[9px] font-semibold uppercase tracking-wider text-white">{label} ({totalCount})</span>
                  </div>
                  <div className="flex-1 overflow-y-auto mt-0.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}>
                    {items.length === 0 ? (
                      <div className="text-[9px] text-white/30 text-center py-2">No items</div>
                    ) : items.map((item, idx) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 px-1.5 border-b border-white/5"
                        style={{ backgroundColor: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent', paddingTop: '3px', paddingBottom: '3px', marginBottom: '0px' }}
                        data-testid={`review-item-${item.id}`}
                      >
                        <div className="flex-1 min-w-0 flex items-center gap-1.5">
                          <span className="text-[10px] font-medium truncate flex-1" style={{ lineHeight: '1.3' }}>
                            {item.title}
                            {item._recurringCount > 1 && (
                              <span className="ml-1 inline-flex items-center px-1 py-0 rounded-full text-[8px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                {item._recurringCount}x
                              </span>
                            )}
                          </span>
                          {item.startDate && (
                            <span className="text-[9px] text-white flex-shrink-0">
                              {new Date(item.startDate).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                            </span>
                          )}
                          {item.eventStartTime && (
                            <span className="text-[9px] text-white flex-shrink-0">
                              {item.eventStartTime}
                            </span>
                          )}
                          <label className="flex items-center gap-0.5 flex-shrink-0 cursor-pointer" title="Hide from summary row" data-testid={`review-hide-summary-${item.id}`}>
                            <input
                              type="checkbox"
                              className="w-2.5 h-2.5 accent-amber-500"
                              checked={reviewHideFromSummary.has(item.id)}
                              onChange={() => setReviewHideFromSummary(prev => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                return next;
                              })}
                            />
                            <span className="text-[8px] text-white/40">No summary</span>
                          </label>
                          <label className="flex items-center gap-0.5 flex-shrink-0 cursor-pointer" title="Hide from side timeline" data-testid={`review-hide-timeline-${item.id}`}>
                            <input
                              type="checkbox"
                              className="w-2.5 h-2.5 accent-amber-500"
                              checked={reviewHideFromTimeline.has(item.id)}
                              onChange={() => setReviewHideFromTimeline(prev => {
                                const next = new Set(prev);
                                if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                                return next;
                              })}
                            />
                            <span className="text-[8px] text-white/40">No timeline</span>
                          </label>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-green-500/40 text-green-400 hover:bg-green-500/25 disabled:opacity-40"
                            disabled={processingReviewIds.has(item.id)}
                            onClick={() => handleAcceptReview(item.id)}
                            data-testid={`button-accept-review-${item.id}`}
                            title={item._recurringCount > 1 ? `Accept all ${item._recurringCount} occurrences` : 'Accept'}
                          >
                            {processingReviewIds.has(item.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            className="w-7 h-7 flex items-center justify-center rounded-full border border-red-500/40 text-red-400 hover:bg-red-500/25 disabled:opacity-40 ml-[4px]"
                            disabled={processingReviewIds.has(item.id)}
                            onClick={() => handleRejectReview(item.id)}
                            data-testid={`button-reject-review-${item.id}`}
                            title={item._recurringCount > 1 ? `Decline all ${item._recurringCount} occurrences` : 'Decline'}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
