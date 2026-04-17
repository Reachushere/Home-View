import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings, Sun as SunIcon, Moon as MoonIcon } from 'lucide-react';
import { WeekVariantsSection } from '@/pages/dashboard-forms';
import { apiRequest } from '@/lib/queryClient';
import { AutomationsContent } from '@/components/AutomationsReference';

interface CalendarSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  colorSettings: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
  shiftScheduleOpen: boolean;
  setShiftScheduleOpen: (v: boolean) => void;
  secondAccountStatus: { connected: boolean; email?: string } | undefined;
  disconnectSecondAccountMutation: { mutate: () => void; isPending: boolean };
  selectedSecondaryCalendar: string;
  setSelectedSecondaryCalendar: (v: string) => void;
  updateSecondaryCalendarMutation: { mutate: (v: string) => void };
  availableCalendars: Array<{ id: string; summary: string; primary?: boolean }> | undefined;
  showAllDayRow: boolean;
  setShowAllDayRow: (v: boolean) => void;
  tabBounceEnabled: boolean;
  setTabBounceEnabled: (v: boolean) => void;
  showCountdownBars: boolean;
  setShowCountdownBars: (v: boolean) => void;
  showHoverBars: boolean;
  setShowHoverBars: (v: boolean) => void;
  schoolData: any;
  setSchoolData: (v: any) => void;
  saveSchool: (v: any) => void;
  localShiftMap: Record<string, string>;
  setLocalShiftMap: (fn: (prev: Record<string, string>) => Record<string, string>) => void;
  shiftDirty: boolean;
  setShiftDirty: (v: boolean) => void;
  shiftScheduleYear: number;
  setShiftScheduleYear: (fn: (y: number) => number) => void;
  saveShiftScheduleMutation: { mutate: (v: any) => void; isPending: boolean };
  shiftScheduleData: any;
  perSemesterSettings: Record<string, any>;
  setPerSemesterSettings: (v: any) => void;
  semesterSettings: any;
  setSemChecklistFlyoutKey: (v: string) => void;
  toast: (v: any) => void;
}

export function CalendarSettingsDialog(props: CalendarSettingsDialogProps) {
  const {
    open, onOpenChange, colorSettings, shiftScheduleOpen, setShiftScheduleOpen,
    secondAccountStatus, disconnectSecondAccountMutation,
    selectedSecondaryCalendar, setSelectedSecondaryCalendar,
    updateSecondaryCalendarMutation, availableCalendars,
    showAllDayRow, setShowAllDayRow, tabBounceEnabled, setTabBounceEnabled,
    showCountdownBars, setShowCountdownBars, showHoverBars, setShowHoverBars,
    schoolData, setSchoolData, saveSchool,
    localShiftMap, setLocalShiftMap, shiftDirty, setShiftDirty,
    shiftScheduleYear, setShiftScheduleYear, saveShiftScheduleMutation, shiftScheduleData,
    perSemesterSettings, setPerSemesterSettings, semesterSettings,
    setSemChecklistFlyoutKey, toast,
  } = props;

  const [semestersOpen, setSemestersOpen] = useState(false);
  const [weekVariantsOpen, setWeekVariantsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${shiftScheduleOpen ? 'max-w-2xl' : 'max-w-md'} text-white [&_*]:text-white [&_p]:!text-white [&_span]:!text-white [&_div]:!text-white [&_label]:!text-white [&_h1]:!text-white [&_h2]:!text-white [&_h3]:!text-white [&_h4]:!text-white [&_input]:text-white [&_select]:text-white [&_textarea]:text-white transition-opacity duration-300 p-0 [&>button.absolute]:hidden overflow-hidden flex flex-col`} style={{ maxHeight: '85vh', background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`, border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)' }}>
          <Settings className="text-white" style={{ width: '15px', height: '15px' }} />
          <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>CALENDAR SETTINGS</h2>
        </div>
        <div className="space-y-4 flex-1 overflow-y-auto px-4 py-3">
          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-[10px] font-medium">Second Google Account</Label>
            {secondAccountStatus?.connected ? (
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                  Connected: {secondAccountStatus.email}
                </span>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => disconnectSecondAccountMutation.mutate()}
                  disabled={disconnectSecondAccountMutation.isPending}
                  data-testid="button-disconnect-second-account"
                >
                  {disconnectSecondAccountMutation.isPending ? "Disconnecting..." : "Disconnect"}
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/google/second-account/auth");
                    const data = await res.json();
                    if (data.authUrl) {
                      window.open(data.authUrl, "_blank", "width=600,height=700");
                    } else {
                      toast({ title: "Error", description: data.error || "Failed to get auth URL", variant: "destructive" });
                    }
                  } catch (err) {
                    toast({ title: "Error", description: "Failed to start OAuth flow", variant: "destructive" });
                  }
                }}
                data-testid="button-connect-second-account"
              >
                Connect Second Google Account
              </Button>
            )}
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-[10px] font-medium">Secondary Calendar</Label>
            <Select
              value={selectedSecondaryCalendar}
              onValueChange={(value) => {
                setSelectedSecondaryCalendar(value);
                updateSecondaryCalendarMutation.mutate(value === "none" ? "" : value);
              }}
            >
              <SelectTrigger data-testid="select-secondary-calendar">
                <SelectValue placeholder="Select a calendar..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No secondary calendar</SelectItem>
                {availableCalendars?.filter(cal => !cal.primary).map(cal => (
                  <SelectItem key={cal.id} value={cal.id}>
                    {cal.summary}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="border rounded-lg p-3 space-y-1">
            <Label className="text-[10px] font-medium">Connection Status</Label>
            <div className="text-[10px] text-white/60 space-y-0.5">
              <p><strong>Primary Account:</strong> {availableCalendars?.find(c => c.primary)?.summary || "Not connected"}</p>
              <p><strong>Secondary Calendar:</strong> {selectedSecondaryCalendar && selectedSecondaryCalendar !== "none" ? availableCalendars?.find(c => c.id === selectedSecondaryCalendar)?.summary || selectedSecondaryCalendar : "None"}</p>
              <p><strong>Second Account:</strong> {secondAccountStatus?.connected ? secondAccountStatus.email : "Not connected"}</p>
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div><Label className="text-[10px] font-medium">All Day Row</Label></div>
              <input type="checkbox" checked={showAllDayRow} onChange={(e) => { setShowAllDayRow(e.target.checked); localStorage.setItem('showAllDayRow', JSON.stringify(e.target.checked)); }} className="h-4 w-4 accent-blue-500" data-testid="toggle-show-allday-row" />
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div><Label className="text-[10px] font-medium">Tab Bounce Animation</Label></div>
              <input type="checkbox" checked={tabBounceEnabled} onChange={(e) => { setTabBounceEnabled(e.target.checked); localStorage.setItem('tabBounceEnabled', JSON.stringify(e.target.checked)); }} className="h-4 w-4 accent-blue-500" data-testid="toggle-tab-bounce" />
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div><Label className="text-[10px] font-medium">Countdown Bars</Label></div>
              <input type="checkbox" checked={showCountdownBars} onChange={(e) => { setShowCountdownBars(e.target.checked); localStorage.setItem('showCountdownBars', JSON.stringify(e.target.checked)); }} className="h-4 w-4 accent-blue-500" data-testid="toggle-countdown-bars" />
            </div>
          </div>

          <div className="border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div><Label className="text-[10px] font-medium">Hover Bars</Label></div>
              <input type="checkbox" checked={showHoverBars} onChange={(e) => { setShowHoverBars(e.target.checked); localStorage.setItem('showHoverBars', JSON.stringify(e.target.checked)); }} className="h-4 w-4 accent-blue-500" data-testid="toggle-hover-bars" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <Label className="text-[10px] font-medium">School Week</Label>
            <div className="flex gap-[6px]">
              <div className="space-y-1 w-1/2">
                <Label className="text-[9px] text-white/60">First Day</Label>
                <select value={schoolData.firstDayOfWeek || 'saturday'} onChange={(e) => { const updated = { ...schoolData, firstDayOfWeek: e.target.value }; setSchoolData(updated); localStorage.setItem('schoolSettings', JSON.stringify(updated)); saveSchool(updated as any); }} className="w-full h-8 px-2 text-[10px] rounded-md bg-white/10 !text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400" data-testid="select-first-day-cal-settings">
                  {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d => (
                    <option key={d} value={d} className="text-black bg-white">{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1 w-1/2">
                <Label className="text-[9px] text-white/60">Last Day</Label>
                <select value={schoolData.lastDayOfSchoolWeek || 'friday'} onChange={(e) => { const updated = { ...schoolData, lastDayOfSchoolWeek: e.target.value }; setSchoolData(updated); localStorage.setItem('schoolSettings', JSON.stringify(updated)); saveSchool(updated as any); }} className="w-full h-8 px-2 text-[10px] rounded-md bg-white/10 !text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400" data-testid="select-last-day-cal-settings">
                  {['sunday','monday','tuesday','wednesday','thursday','friday','saturday'].map(d => (
                    <option key={d} value={d} className="text-black bg-white">{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setSemestersOpen(!semestersOpen)} data-testid="toggle-semesters-flyout">
              <Label className="text-[10px] font-medium cursor-pointer">Semesters</Label>
              <span className="text-xs">{semestersOpen ? '▼' : '▶'}</span>
            </div>
            {semestersOpen && (
              <div className="space-y-1 text-[10px]">
                {[
                  { key: 'ss2025', label: 'Spring/Summer 2025', dates: 'May 5 – Aug 8, 2025', start: '2025-05-05', end: '2025-08-08' },
                  { key: 'f2025', label: 'Fall 2025', dates: 'Sep 8 – Dec 12, 2025', start: '2025-09-08', end: '2025-12-12' },
                  { key: 'w2026', label: 'Winter 2026', dates: 'Jan 12 – Apr 17, 2026', start: '2026-01-12', end: '2026-04-17' },
                  { key: 'ss2026', label: 'Spring/Summer 2026', dates: 'May 4 – Aug 7, 2026', start: '2026-05-04', end: '2026-08-07' },
                  { key: 'f2026', label: 'Fall 2026', dates: 'Sep 7 – Dec 11, 2026', start: '2026-09-14', end: '2026-12-11' },
                  { key: 'w2027', label: 'Winter 2027', dates: 'Jan 11 – Apr 16, 2027', start: '2027-01-11', end: '2027-04-16' },
                  { key: 'ss2027', label: 'Spring/Summer 2027', dates: 'May 3 – Aug 6, 2027', start: '2027-05-03', end: '2027-08-06' },
                  { key: 'f2027', label: 'Fall 2027', dates: 'Sep 13 – Dec 17, 2027', start: '2027-09-13', end: '2027-12-17' },
                  { key: 'w2028', label: 'Winter 2028', dates: 'Jan 10 – Apr 14, 2028', start: '2028-01-10', end: '2028-04-14' },
                  { key: 'ss2028', label: 'Spring/Summer 2028', dates: 'May 1 – Aug 4, 2028', start: '2028-05-01', end: '2028-08-04' },
                  { key: 'f2028', label: 'Fall 2028', dates: 'Sep 11 – Dec 15, 2028', start: '2028-09-11', end: '2028-12-15' },
                  { key: 'w2029', label: 'Winter 2029', dates: 'Jan 15 – Apr 13, 2029', start: '2029-01-15', end: '2029-04-13' },
                ].map(sem => {
                  const now = new Date();
                  const isCurrent = now >= new Date(sem.start) && now <= new Date(sem.end);
                  return (
                    <div key={sem.key} className="flex items-center justify-between py-1 px-1.5 rounded" style={{ background: isCurrent ? 'rgba(255,255,255,0.08)' : 'transparent' }}>
                      <div className="flex items-center gap-1.5">
                        {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                        <span className={`text-white ${isCurrent ? 'font-bold' : 'font-normal'}`}>{sem.label}</span>
                        <svg className="text-white/40 hover:text-white cursor-pointer transition-colors flex-shrink-0" style={{ width: '10px', height: '10px' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" onClick={(e) => { e.stopPropagation(); onOpenChange(false); setTimeout(() => setSemChecklistFlyoutKey(sem.key), 200); }} data-testid={`button-sem-checklist-settings-${sem.key}`} title="Semester Checklist">
                          <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                        </svg>
                      </div>
                      <span className="text-white/50">{sem.dates}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border rounded-lg p-3 space-y-2" data-shift-schedule-section-2="true">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => { const opening = !shiftScheduleOpen; setShiftScheduleOpen(opening); if (opening) { const tryScroll = (attempt: number) => { setTimeout(() => { const section = document.querySelector('[data-shift-schedule-section-2="true"]'); if (section) { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else if (attempt < 3) { tryScroll(attempt + 1); } }, attempt === 0 ? 200 : 400); }; tryScroll(0); } }} data-testid="toggle-shift-schedule">
              <Label className="text-[10px] font-medium cursor-pointer">Partner Shift Schedule</Label>
              <span className="text-xs">{shiftScheduleOpen ? '▼' : '▶'}</span>
            </div>
            {shiftScheduleOpen && (() => {
              const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
              const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
              const cycleShift = (dateStr: string) => {
                const current = localShiftMap[dateStr] || 'off';
                const next = current === 'off' ? 'day' : current === 'day' ? 'night' : 'off';
                setLocalShiftMap(prev => { const updated = { ...prev }; if (next === 'off') delete updated[dateStr]; else updated[dateStr] = next; return updated; });
                setShiftDirty(true);
              };
              const getShiftColor = (type: string | undefined) => {
                if (type === 'day') return { bg: '#fcfdc9', border: 'rgba(200, 200, 100, 0.9)', text: '#000' };
                if (type === 'night') return { bg: 'rgba(139, 92, 246, 0.7)', border: 'rgba(139, 92, 246, 0.9)', text: '#fff' };
                return { bg: 'transparent', border: 'rgba(255,255,255,0.15)', text: 'rgba(255,255,255,0.4)' };
              };
              const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
              const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();
              const dayCounts = { day: 0, night: 0 };
              Object.entries(localShiftMap).forEach(([date, type]) => {
                if (date.startsWith(String(shiftScheduleYear)) && (type === 'day' || type === 'night')) dayCounts[type]++;
              });
              return (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white hover:bg-white/10" onClick={() => setShiftScheduleYear(y => y - 1)} data-testid="button-shift-prev-year">‹</Button>
                      <span className="text-sm font-medium w-12 text-center">{shiftScheduleYear}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-white hover:bg-white/10" onClick={() => setShiftScheduleYear(y => y + 1)} data-testid="button-shift-next-year">›</Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: '#fcfdc9' }}/> Day ({dayCounts.day})</span>
                      <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm" style={{ background: 'rgba(139, 92, 246, 0.7)' }}/> Night ({dayCounts.night})</span>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    Click a day to cycle: off → <span style={{ color: '#b8a800' }}>day</span> → <span style={{ color: 'rgb(139,92,246)' }}>night</span> → off
                  </div>
                  <div className="grid grid-cols-4 gap-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                    {MONTHS.map((monthName, monthIdx) => {
                      const daysInMonth = getDaysInMonth(shiftScheduleYear, monthIdx);
                      const firstDay = getFirstDayOfMonth(shiftScheduleYear, monthIdx);
                      const cells: JSX.Element[] = [];
                      for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} className="w-full" style={{ aspectRatio: '1' }}/>);
                      for (let d = 1; d <= daysInMonth; d++) {
                        const dateStr = `${shiftScheduleYear}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                        const shiftType = localShiftMap[dateStr];
                        const colors = getShiftColor(shiftType);
                        cells.push(
                          <div key={d} onClick={() => cycleShift(dateStr)} className="w-full flex items-center justify-center cursor-pointer rounded-sm text-[9px] font-medium select-none hover:opacity-80 relative overflow-visible" style={{ aspectRatio: '1', background: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }} title={`${monthName} ${d}: ${shiftType || 'off'}`} data-testid={`shift-day-${dateStr}`}>
                            {d}
                            {shiftType === 'day' && <SunIcon className="absolute -top-1 -right-1 h-3 w-3 text-orange-500 drop-shadow-[0_0_2px_rgba(249,115,22,0.8)]" style={{ zIndex: 5 }} fill="currentColor" strokeWidth={1.5} />}
                            {shiftType === 'night' && <MoonIcon className="absolute -top-0.5 -right-0.5 h-2 w-2 text-purple-300" style={{ zIndex: 5 }} fill="currentColor" strokeWidth={1.5} />}
                          </div>
                        );
                      }
                      return (
                        <div key={monthIdx} className="space-y-0.5">
                          <div className="text-[10px] font-semibold text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>{monthName}</div>
                          <div className="grid grid-cols-7 gap-px">
                            {DAY_LABELS.map((dl, i) => (<div key={i} className="text-[7px] text-center" style={{ color: 'rgba(255,255,255,0.35)' }}>{dl}</div>))}
                            {cells}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setLocalShiftMap(prev => { const updated = { ...prev }; Object.keys(updated).forEach(k => { if (k.startsWith(String(shiftScheduleYear))) delete updated[k]; }); return updated; }); setShiftDirty(true); }} data-testid="button-clear-shifts">Clear Year</Button>
                    </div>
                    <Button size="sm" className="h-7 text-xs" disabled={!shiftDirty || saveShiftScheduleMutation.isPending} onClick={() => saveShiftScheduleMutation.mutate({ shiftMap: localShiftMap, previousData: shiftScheduleData })} data-testid="button-save-shifts">
                      {saveShiftScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-white/10">
                    <p><strong>Day shift</strong> (7:30a–7:30p): Quiet hours 10pm–5am</p>
                    <p><strong>Night shift</strong> (7:30p–7:30a): Quiet hours 10am–5pm</p>
                    <p className="italic">Calendar task reminders always announce, even during quiet hours.</p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="border rounded-lg p-3 space-y-2" data-cal-weeks-info="true">
            <Label className="text-[10px] font-medium">Calendar Weeks</Label>
            {(() => {
              const activeSemKey = (() => {
                const now = new Date();
                const semesters = [
                  { key: 'ss2025', start: '2025-05-05', end: '2025-08-08' },
                  { key: 'f2025', start: '2025-09-08', end: '2025-12-12' },
                  { key: 'w2026', start: '2026-01-12', end: '2026-04-17' },
                  { key: 'ss2026', start: '2026-05-04', end: '2026-08-07' },
                  { key: 'f2026', start: '2026-09-14', end: '2026-12-11' },
                  { key: 'w2027', start: '2027-01-11', end: '2027-04-16' },
                ];
                for (const s of semesters) { if (now >= new Date(s.start) && now <= new Date(s.end)) return s.key; }
                return 'w2026';
              })();
              const semData = perSemesterSettings[activeSemKey] || {};
              const w1 = semData.week1StartDate || schoolData.week1StartDate || '';
              const numWeeks = semData.numberOfWeeks || schoolData.numberOfWeeks || 13;
              const rw = semData.readingWeekDate || '';
              const tz = semData.timezone || schoolData.timezone || 'America/Toronto';
              const travelling = semData.isTravelling || false;
              const travelTz = semData.travelTimezone || '';
              const semLabel: Record<string, string> = { 'ss2025': 'Spring/Summer 2025', 'f2025': 'Fall 2025', 'w2026': 'Winter 2026', 'ss2026': 'Spring/Summer 2026', 'f2026': 'Fall 2026', 'w2027': 'Winter 2027' };
              return (
                <div className="space-y-2">
                  <div className="text-[9px] text-white/50">{semLabel[activeSemKey] || activeSemKey}</div>
                  <div className="grid grid-cols-2 gap-[6px]">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-white/60">Week 1, Day 1</Label>
                      <input type="date" value={w1} onChange={(e) => { const val = e.target.value; const updated = { ...perSemesterSettings, [activeSemKey]: { ...(perSemesterSettings[activeSemKey] || {}), week1StartDate: val } }; setPerSemesterSettings(updated as any); localStorage.setItem('perSemesterSettings', JSON.stringify(updated)); if (activeSemKey === 'w2026') saveSchool({ ...schoolData, week1StartDate: val }); }} onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }} className="w-full h-7 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer" style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }} data-testid="input-cal-week1-start" />
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-white/60">School Weeks</Label>
                      <select value={String(numWeeks)} onChange={(e) => { const val = Number(e.target.value); const updated = { ...perSemesterSettings, [activeSemKey]: { ...(perSemesterSettings[activeSemKey] || {}), numberOfWeeks: val } }; setPerSemesterSettings(updated as any); localStorage.setItem('perSemesterSettings', JSON.stringify(updated)); if (activeSemKey === 'w2026') saveSchool({ ...schoolData, numberOfWeeks: val }); }} className="w-full h-7 px-2 text-[10px] rounded-md bg-white/10 !text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400" data-testid="select-cal-num-weeks">
                        {[10, 11, 12, 13, 14, 15, 16].map(w => (<option key={w} value={String(w)} className="text-black bg-white">{w} weeks</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-[6px]">
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-white/60">Reading Week</Label>
                      <div className="flex items-center gap-1">
                        <input type="date" value={rw} onChange={(e) => { const val = e.target.value; const updated = { ...perSemesterSettings, [activeSemKey]: { ...(perSemesterSettings[activeSemKey] || {}), readingWeekDate: val } }; setPerSemesterSettings(updated as any); localStorage.setItem('perSemesterSettings', JSON.stringify(updated)); if (activeSemKey === 'w2026' && val) { apiRequest("PATCH", "/api/semester", { readingWeekStart: new Date(val).toISOString() }); } }} onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }} className="w-full h-7 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer" style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }} data-testid="input-cal-reading-week" />
                        {rw && (
                          <button type="button" onClick={() => { const updated = { ...perSemesterSettings, [activeSemKey]: { ...(perSemesterSettings[activeSemKey] || {}), readingWeekDate: '' } }; setPerSemesterSettings(updated as any); localStorage.setItem('perSemesterSettings', JSON.stringify(updated)); if (activeSemKey === 'w2026') apiRequest("PATCH", "/api/semester", { readingWeekStart: null }); }} className="text-[8px] text-red-300 hover:text-red-200" data-testid="button-cal-clear-reading-week">✕</button>
                        )}
                      </div>
                      {rw && <div className="text-[8px] text-white/40">Skipped in week numbering</div>}
                    </div>
                    <div className="space-y-0.5">
                      <Label className="text-[9px] text-white/60">Time Zone</Label>
                      <select value={tz} onChange={(e) => { const val = e.target.value; const updated = { ...perSemesterSettings, [activeSemKey]: { ...(perSemesterSettings[activeSemKey] || {}), timezone: val } }; setPerSemesterSettings(updated as any); localStorage.setItem('perSemesterSettings', JSON.stringify(updated)); if (activeSemKey === 'w2026') saveSchool({ ...schoolData, timezone: val }); }} className="w-full h-7 px-2 text-[10px] rounded-md bg-white/10 !text-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400" data-testid="select-cal-timezone">
                        {[
                          { value: 'America/Toronto', label: 'Eastern (Toronto)' },
                          { value: 'America/New_York', label: 'Eastern (NY)' },
                          { value: 'America/Chicago', label: 'Central' },
                          { value: 'America/Denver', label: 'Mountain' },
                          { value: 'America/Los_Angeles', label: 'Pacific (LA)' },
                          { value: 'America/Vancouver', label: 'Pacific (Van)' },
                          { value: 'America/Halifax', label: 'Atlantic' },
                          { value: 'America/St_Johns', label: 'Newfoundland' },
                          { value: 'Europe/London', label: 'GMT (London)' },
                          { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
                        ].map(t => (<option key={t.value} value={t.value} className="text-black bg-white">{t.label}</option>))}
                      </select>
                    </div>
                  </div>
                  {travelling && travelTz && (
                    <div className="flex items-center gap-1 text-[9px] text-orange-300">
                      <span>✈</span>
                      <span>Travel mode: {travelTz}</span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          <div className="border rounded-lg p-3 space-y-2" data-automations-section="true">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setAutomationsOpen(!automationsOpen)} data-testid="toggle-automations-flyout">
              <Label className="text-[10px] font-medium cursor-pointer">My Automations</Label>
              <span className="text-xs">{automationsOpen ? '▼' : '▶'}</span>
            </div>
            {automationsOpen && (
              <div className="pt-1"><AutomationsContent /></div>
            )}
          </div>

          <div className="border rounded-lg p-3 space-y-2" data-week-variants-section="true">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => { const opening = !weekVariantsOpen; setWeekVariantsOpen(opening); if (opening) { const tryScroll = (attempt: number) => { setTimeout(() => { const section = document.querySelector('[data-week-variants-section="true"]'); if (section) { section.scrollIntoView({ behavior: 'smooth', block: 'start' }); } else if (attempt < 3) { tryScroll(attempt + 1); } }, attempt === 0 ? 200 : 400); }; tryScroll(0); } }} data-testid="toggle-week-variants">
              <Label className="text-[10px] font-medium cursor-pointer">Course Week Variants</Label>
              <span className="text-xs">{weekVariantsOpen ? '▼' : '▶'}</span>
            </div>
            {weekVariantsOpen && (
              <WeekVariantsSection semesterSettings={semesterSettings} week1StartDate={schoolData.week1StartDate} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
