import React from "react";
import { Square, Calendar, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { getAppTz } from "../../dashboard-utils";

const ALEXA_MAX_CHARS = 250;
const ECHO_SPEAKER_OPTIONS: Record<string, string> = {
  "media_player.cat_wr": "Cat WR",
  "media_player.echo_cat_left_am": "Echo Cat Left",
  "media_player.echo_cat_right_am": "Echo Cat Right",
  "media_player.echo_cat_washroom_middle": "Echo Cat Washroom",
  "media_player.echo_kitchen_studio_black_am": "Echo Kitchen Studio",
};

interface ColorSettings {
  mainBackground: string;
  mainBackgroundGradientEnd: string;
  headerBar: string;
  [k: string]: any;
}

interface Props {
  open: boolean;
  setIsAlexaDialogOpen: (v: boolean) => void;
  colorSettings: ColorSettings;
  stopAllSpeakersMutation: any;
  scheduledAlexaList: any[];
  alexaMessage: string;
  setAlexaMessage: React.Dispatch<React.SetStateAction<string>>;
  alexaCalendarOpen: boolean;
  setAlexaCalendarOpen: (v: boolean) => void;
  alexaDate: string;
  setAlexaDate: (v: string) => void;
  alexaHour: string;
  setAlexaHour: (v: string) => void;
  alexaMinute: string;
  setAlexaMinute: (v: string) => void;
  alexaSpeakers: string;
  setAlexaSpeakers: (v: string) => void;
  alexaVoiceGender: 'male' | 'female';
  setAlexaVoiceGender: React.Dispatch<React.SetStateAction<'male' | 'female'>>;
  alexaRepeatType: string;
  setAlexaRepeatType: (v: string) => void;
  alexaRepeatEndCalendarOpen: boolean;
  setAlexaRepeatEndCalendarOpen: (v: boolean) => void;
  alexaRepeatEndDate: string;
  setAlexaRepeatEndDate: (v: string) => void;
  alexaRepeatInterval: number;
  setAlexaRepeatInterval: (v: number) => void;
  alexaRepeatIntervalUnit: string;
  setAlexaRepeatIntervalUnit: (v: string) => void;
  alexaShiftAdjust: boolean;
  setAlexaShiftAdjust: React.Dispatch<React.SetStateAction<boolean>>;
  createAlexaMutation: any;
  sendAlexaImmediateMutation: any;
  alexaSwipeStates: Record<number, number>;
  setAlexaSwipeStates: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  alexaSwipeStartRef: React.MutableRefObject<{ id: number; x: number } | null>;
  alexaPendingDeleteId: number | null;
  setAlexaPendingDeleteId: (v: number | null) => void;
  toggleAlexaMutation: any;
  sendAlexaNowMutation: any;
  deleteAlexaMutation: any;
}

export function AlexaDialog(p: Props) {
  if (!p.open) return null;
  const {
    setIsAlexaDialogOpen, colorSettings,
    stopAllSpeakersMutation, scheduledAlexaList,
    alexaMessage, setAlexaMessage,
    alexaCalendarOpen, setAlexaCalendarOpen, alexaDate, setAlexaDate,
    alexaHour, setAlexaHour, alexaMinute, setAlexaMinute,
    alexaSpeakers, setAlexaSpeakers,
    alexaVoiceGender, setAlexaVoiceGender,
    alexaRepeatType, setAlexaRepeatType,
    alexaRepeatEndCalendarOpen, setAlexaRepeatEndCalendarOpen,
    alexaRepeatEndDate, setAlexaRepeatEndDate,
    alexaRepeatInterval, setAlexaRepeatInterval,
    alexaRepeatIntervalUnit, setAlexaRepeatIntervalUnit,
    alexaShiftAdjust, setAlexaShiftAdjust,
    createAlexaMutation, sendAlexaImmediateMutation,
    alexaSwipeStates, setAlexaSwipeStates, alexaSwipeStartRef,
    alexaPendingDeleteId, setAlexaPendingDeleteId,
    toggleAlexaMutation, sendAlexaNowMutation, deleteAlexaMutation,
  } = p;
  return (
        <div className="fixed inset-0 flex items-start justify-center pt-[50px]" style={{ zIndex: 10010, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={(e) => { if (e.target === e.currentTarget) setIsAlexaDialogOpen(false); }} data-testid="alexa-dialog-overlay">
          <div className="sm:rounded-lg shadow-2xl w-[520px] max-w-[95vw] max-h-[600px] flex flex-col overflow-hidden" style={{ background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`, border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)' }} data-testid="alexa-dialog">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)' }}>
              <span className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>ALEXA ANNOUNCEMENTS</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => stopAllSpeakersMutation.mutate()}
                  disabled={stopAllSpeakersMutation.isPending}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-all"
                  style={{ background: 'linear-gradient(180deg, #dc2626 0%, #991b1b 100%)', color: 'white', border: '1px solid rgba(255,255,255,0.25)', opacity: stopAllSpeakersMutation.isPending ? 0.6 : 1, boxShadow: '0 2px 6px rgba(220,38,38,0.4)' }}
                  data-testid="button-kill-switch"
                >
                  <Square className="w-3 h-3" fill="white" />
                  {stopAllSpeakersMutation.isPending ? 'STOPPING...' : 'STOP ALL'}
                </button>
                <span className="text-white/40 text-[10px]">{scheduledAlexaList.length} scheduled</span>
              </div>
            </div>

            {/* Compose area */}
            <div className="px-4 py-3 border-b border-white/15 flex-shrink-0">
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <textarea
                    value={alexaMessage}
                    onChange={(e) => { if (e.target.value.length <= ALEXA_MAX_CHARS) setAlexaMessage(e.target.value); }}
                    maxLength={ALEXA_MAX_CHARS}
                    placeholder="Type announcement message..."
                    rows={2}
                    className="w-full text-white text-[12px] px-3 py-2 rounded resize-none focus:outline-none placeholder:text-white/30"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    data-testid="alexa-message-input"
                  />
                  <span className={`absolute bottom-1.5 right-2 text-[9px] ${alexaMessage.length >= ALEXA_MAX_CHARS ? 'text-red-400' : 'text-white/30'}`}>{alexaMessage.length}/{ALEXA_MAX_CHARS}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <Popover open={alexaCalendarOpen} onOpenChange={setAlexaCalendarOpen}>
                    <PopoverTrigger asChild>
                      <button
                        className="flex-1 flex items-center gap-1.5 text-white text-[11px] px-2 py-1.5 rounded focus:outline-none text-left"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                        data-testid="alexa-date-input"
                      >
                        <Calendar className="h-3 w-3 text-white/40 shrink-0" />
                        <span className={alexaDate ? 'text-white' : 'text-white/30'}>
                          {alexaDate ? format(new Date(alexaDate + 'T12:00:00'), 'MMM d, yyyy') : 'Pick a date...'}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 border-0 bg-transparent"
                      style={{ zIndex: 10020, background: 'transparent', backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}
                      align="start"
                    >
                      <div style={{ borderRadius: '8px', padding: '4px' }}>
                        <CalendarPicker
                          mode="single"
                          selected={alexaDate ? new Date(alexaDate + 'T12:00:00') : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, '0');
                              const d = String(date.getDate()).padStart(2, '0');
                              setAlexaDate(`${y}-${m}-${d}`);
                            } else {
                              setAlexaDate('');
                            }
                            setAlexaCalendarOpen(false);
                          }}
                          className="p-0"
                        />
                        {alexaDate && (
                          <div className="pt-2">
                            <button
                              onClick={() => { setAlexaDate(''); setAlexaCalendarOpen(false); }}
                              className="text-[10px] text-black/40 hover:text-black/70 transition-colors"
                            >
                              Clear date
                            </button>
                          </div>
                        )}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <select
                    value={alexaHour}
                    onChange={(e) => setAlexaHour(e.target.value)}
                    className="w-[62px] text-white text-[11px] px-1 py-1.5 rounded focus:outline-none [color-scheme:dark]"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    data-testid="alexa-hour-select"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')} style={{ color: 'black' }}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i-12} PM`}</option>
                    ))}
                  </select>
                  <select
                    value={alexaMinute}
                    onChange={(e) => setAlexaMinute(e.target.value)}
                    className="w-[50px] text-white text-[11px] px-1 py-1.5 rounded focus:outline-none [color-scheme:dark]"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    data-testid="alexa-minute-select"
                  >
                    {Array.from({ length: 60 }, (_, i) => (
                      <option key={i} value={i.toString().padStart(2, '0')} style={{ color: 'black' }}>{i.toString().padStart(2, '0')}</option>
                    ))}
                  </select>
                </div>

                {/* Speaker selector */}
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] w-[42px] shrink-0">Target:</span>
                  <select
                    value={alexaSpeakers}
                    onChange={(e) => setAlexaSpeakers(e.target.value)}
                    className="flex-1 text-white text-[11px] px-2 py-1.5 rounded focus:outline-none [color-scheme:dark]"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    data-testid="alexa-speakers-select"
                  >
                    <option value="all" style={{ color: 'black' }}>Everywhere (All Speakers)</option>
                    {Object.entries(ECHO_SPEAKER_OPTIONS).map(([id, name]) => (
                      <option key={id} value={id} style={{ color: 'black' }}>{name}</option>
                    ))}
                  </select>
                </div>

                {/* Voice gender toggle */}
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] w-[42px] shrink-0">Voice:</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setAlexaVoiceGender(v => v === 'female' ? 'male' : 'female')}
                      className="relative shrink-0"
                      style={{ width: '22px', height: '12px', borderRadius: '6px', background: alexaVoiceGender === 'male' ? 'rgba(59,130,246,0.7)' : 'rgba(236,72,153,0.7)', border: '0.5px solid rgba(255,255,255,0.3)', transition: 'background 0.2s' }}
                      data-testid="alexa-voice-gender-toggle"
                    >
                      <div style={{ width: '9px', height: '9px', borderRadius: '4.5px', background: '#fff', position: 'absolute', top: '1.5px', left: alexaVoiceGender === 'male' ? '11px' : '1.5px', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                    </button>
                    <span className="text-white/60 text-[10px]">{alexaVoiceGender === 'male' ? '♂ Male (Matthew)' : '♀ Female (Default)'}</span>
                  </div>
                </div>

                {/* Repeat dropdown */}
                <div className="flex items-center gap-1.5">
                  <span className="text-white/40 text-[10px] w-[42px] shrink-0">Repeat:</span>
                  <select
                    value={alexaRepeatType}
                    onChange={(e) => setAlexaRepeatType(e.target.value)}
                    className="flex-1 text-white text-[11px] px-2 py-1.5 rounded focus:outline-none [color-scheme:dark]"
                    style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                    data-testid="alexa-repeat-type"
                  >
                    <option value="none" style={{ color: 'black' }}>No repeat</option>
                    <option value="daily" style={{ color: 'black' }}>Daily</option>
                    <option value="weekly" style={{ color: 'black' }}>Weekly</option>
                    <option value="monthly" style={{ color: 'black' }}>Monthly</option>
                    <option value="yearly" style={{ color: 'black' }}>Yearly</option>
                    <option value="custom" style={{ color: 'black' }}>Custom...</option>
                  </select>
                  {alexaRepeatType !== 'none' && (
                    <Popover open={alexaRepeatEndCalendarOpen} onOpenChange={setAlexaRepeatEndCalendarOpen}>
                      <PopoverTrigger asChild>
                        <button
                          className="w-[130px] flex items-center gap-1 text-[10px] px-2 py-1.5 rounded focus:outline-none text-left"
                          style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                          title="Repeat end date (optional)"
                          data-testid="alexa-repeat-end"
                        >
                          <Calendar className="h-2.5 w-2.5 text-white/40 shrink-0" />
                          <span className={alexaRepeatEndDate ? 'text-white' : 'text-white/30'}>
                            {alexaRepeatEndDate ? format(new Date(alexaRepeatEndDate + 'T12:00:00'), 'MMM d, yyyy') : 'End date'}
                          </span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 border-0 bg-transparent"
                        style={{ zIndex: 10020, background: 'transparent', backgroundColor: 'transparent', border: 'none', boxShadow: 'none' }}
                        align="start"
                      >
                        <div style={{ borderRadius: '8px', padding: '4px' }}>
                          <CalendarPicker
                            mode="single"
                            selected={alexaRepeatEndDate ? new Date(alexaRepeatEndDate + 'T12:00:00') : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const y = date.getFullYear();
                                const m = String(date.getMonth() + 1).padStart(2, '0');
                                const d = String(date.getDate()).padStart(2, '0');
                                setAlexaRepeatEndDate(`${y}-${m}-${d}`);
                              } else {
                                setAlexaRepeatEndDate('');
                              }
                              setAlexaRepeatEndCalendarOpen(false);
                            }}
                            className="p-0"
                          />
                          {alexaRepeatEndDate && (
                            <div className="pt-2">
                              <button
                                onClick={() => { setAlexaRepeatEndDate(''); setAlexaRepeatEndCalendarOpen(false); }}
                                className="text-[10px] text-black/40 hover:text-black/70 transition-colors"
                              >
                                Clear end date
                              </button>
                            </div>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
                {alexaRepeatType === 'custom' && (
                  <div className="flex items-center gap-1.5 pl-[42px]">
                    <span className="text-white/40 text-[10px]">Every</span>
                    <input
                      type="number"
                      min={1}
                      value={alexaRepeatInterval}
                      onChange={(e) => setAlexaRepeatInterval(parseInt(e.target.value) || 1)}
                      className="w-[50px] text-white text-[11px] px-2 py-1 rounded focus:outline-none"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      data-testid="alexa-repeat-interval"
                    />
                    <select
                      value={alexaRepeatIntervalUnit}
                      onChange={(e) => setAlexaRepeatIntervalUnit(e.target.value)}
                      className="text-white text-[11px] px-2 py-1.5 rounded focus:outline-none [color-scheme:dark]"
                      style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                      data-testid="alexa-repeat-unit"
                    >
                      <option value="days" style={{ color: 'black' }}>days</option>
                      <option value="weeks" style={{ color: 'black' }}>weeks</option>
                      <option value="months" style={{ color: 'black' }}>months</option>
                      <option value="years" style={{ color: 'black' }}>years</option>
                    </select>
                  </div>
                )}

                {alexaRepeatType !== 'none' && (
                  <div className="flex items-center justify-between pl-[42px]">
                    <div className="flex flex-col">
                      <span className="text-white/60 text-[10px]">Partner shift adjust</span>
                      <span className="text-white/30 text-[8px]">±12h on night-shift days</span>
                    </div>
                    <button
                      onClick={() => setAlexaShiftAdjust(v => !v)}
                      className="relative shrink-0"
                      style={{ width: '22px', height: '12px', borderRadius: '6px', background: alexaShiftAdjust ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.3)', transition: 'background 0.2s' }}
                      data-testid="alexa-shift-adjust"
                    >
                      <div style={{ width: '9px', height: '9px', borderRadius: '4.5px', background: '#fff', position: 'absolute', top: '1.5px', left: alexaShiftAdjust ? '11px' : '1.5px', transition: 'left 0.2s', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
                    </button>
                  </div>
                )}

                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      if (!alexaMessage.trim()) return;
                      if (alexaDate) {
                        createAlexaMutation.mutate({
                          message: alexaMessage.trim(),
                          scheduledAt: new Date(`${alexaDate}T${alexaHour}:${alexaMinute}:00`).toISOString(),
                          repeatType: alexaRepeatType,
                          repeatInterval: alexaRepeatType === 'custom' ? alexaRepeatInterval : null,
                          repeatIntervalUnit: alexaRepeatType === 'custom' ? alexaRepeatIntervalUnit : null,
                          repeatEndDate: alexaRepeatEndDate || null,
                          shiftAdjust: alexaShiftAdjust,
                          speakers: alexaSpeakers,
                          voiceGender: alexaVoiceGender,
                        });
                      } else {
                        sendAlexaImmediateMutation.mutate({ message: alexaMessage.trim(), speakers: alexaSpeakers, voiceGender: alexaVoiceGender });
                        setAlexaMessage('');
                      }
                    }}
                    disabled={!alexaMessage.trim() || createAlexaMutation.isPending || sendAlexaImmediateMutation.isPending}
                    className="flex-1 disabled:opacity-40 text-white text-[11px] font-semibold px-3 py-2 rounded transition-colors hover:brightness-110"
                    style={{ background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 1px 3px rgba(0,0,0,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
                    data-testid="alexa-schedule-button"
                  >
                    {alexaDate ? '+ Schedule' : 'Post Now'}
                  </button>
                </div>
              </div>
            </div>

            {/* Scheduled announcements list with swipe */}
            <div className="flex-1 overflow-y-auto px-4 py-2" style={{ scrollbarWidth: 'thin' }}>
              {scheduledAlexaList.length === 0 ? (
                <div className="text-white/40 text-[12px] text-center py-6">No scheduled announcements</div>
              ) : (
                scheduledAlexaList.map((ann: any) => {
                  const swipeX = alexaSwipeStates[ann.id] || 0;
                  return (
                    <div
                      key={ann.id}
                      className="relative overflow-hidden rounded-lg mb-1.5"
                      data-testid={`alexa-item-${ann.id}`}
                    >
                      {/* Delete background (swipe left) */}
                      {swipeX < 0 && <div className="absolute inset-0 flex items-center justify-end px-4 rounded-lg" style={{ background: 'rgba(239,68,68,0.3)' }}>
                        <div style={{ background: '#dc2626', borderRadius: '4px', padding: '3px 10px' }}>
                          <span className="text-white text-[10px] font-semibold">Delete</span>
                        </div>
                      </div>}
                      {/* Save/keep background (swipe right) */}
                      {swipeX > 0 && <div className="absolute inset-0 flex items-center justify-start px-4 rounded-lg" style={{ background: 'rgba(6,182,212,0.3)' }}>
                        <span className="text-cyan-300 text-[9px] font-semibold">{ann.isEnabled ? 'Hide from HA' : 'Expose to HA'}</span>
                      </div>}
                      {/* Main item */}
                      <div
                        className="relative flex items-start gap-2 px-3 py-2 border border-white/10 rounded-lg transition-transform"
                        style={{
                          background: ann.isEnabled ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                          transform: `translateX(${swipeX}px)`,
                          opacity: ann.isEnabled ? 1 : 0.5,
                        }}
                        onTouchStart={(e) => {
                          alexaSwipeStartRef.current = { id: ann.id, x: e.touches[0].clientX };
                        }}
                        onTouchMove={(e) => {
                          if (!alexaSwipeStartRef.current || alexaSwipeStartRef.current.id !== ann.id) return;
                          const dx = e.touches[0].clientX - alexaSwipeStartRef.current.x;
                          setAlexaSwipeStates(prev => ({ ...prev, [ann.id]: Math.max(-120, Math.min(120, dx)) }));
                        }}
                        onTouchEnd={(e) => {
                          if (!alexaSwipeStartRef.current) return;
                          const lastTouch = e.changedTouches[0];
                          const dx = Math.max(-120, Math.min(120, lastTouch.clientX - alexaSwipeStartRef.current.x));
                          if (dx < -60) {
                            setAlexaPendingDeleteId(ann.id);
                          } else if (dx > 60) {
                            toggleAlexaMutation.mutate({ id: ann.id, isEnabled: !ann.isEnabled });
                          }
                          setAlexaSwipeStates(prev => ({ ...prev, [ann.id]: 0 }));
                          alexaSwipeStartRef.current = null;
                        }}
                        onMouseDown={(e) => {
                          const startX = e.clientX;
                          alexaSwipeStartRef.current = { id: ann.id, x: startX };
                          const onMove = (ev: MouseEvent) => {
                            if (!alexaSwipeStartRef.current || alexaSwipeStartRef.current.id !== ann.id) return;
                            const dx = ev.clientX - alexaSwipeStartRef.current.x;
                            setAlexaSwipeStates(prev => ({ ...prev, [ann.id]: Math.max(-120, Math.min(120, dx)) }));
                          };
                          const onUp = (ev: MouseEvent) => {
                            const dx = Math.max(-120, Math.min(120, ev.clientX - startX));
                            if (dx < -60) {
                              setAlexaPendingDeleteId(ann.id);
                            } else if (dx > 60) {
                              toggleAlexaMutation.mutate({ id: ann.id, isEnabled: !ann.isEnabled });
                            }
                            setAlexaSwipeStates(prev => ({ ...prev, [ann.id]: 0 }));
                            alexaSwipeStartRef.current = null;
                            window.removeEventListener('mousemove', onMove);
                            window.removeEventListener('mouseup', onUp);
                          };
                          window.addEventListener('mousemove', onMove);
                          window.addEventListener('mouseup', onUp);
                        }}
                      >
                        {/* Toggle */}
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleAlexaMutation.mutate({ id: ann.id, isEnabled: !ann.isEnabled }); }}
                          className="mt-0.5 shrink-0"
                          title={ann.isEnabled ? 'Hide from HA' : 'Expose to HA'}
                          data-testid={`alexa-toggle-${ann.id}`}
                        >
                          <div className={`w-[22px] h-[12px] rounded-full relative transition-colors ${ann.isEnabled ? 'bg-cyan-500' : 'bg-white/20'}`}>
                            <div className={`absolute top-[1.5px] w-[9px] h-[9px] rounded-full bg-white shadow transition-all ${ann.isEnabled ? 'left-[11px]' : 'left-[1.5px]'}`} />
                          </div>
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-[10px] leading-tight break-words">{ann.message}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-white/40 text-[8px]">
                              {ann.scheduledAt ? new Date(ann.scheduledAt).toLocaleString('en-US', { timeZone: getAppTz(), month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}
                            </span>
                            {ann.repeatType && ann.repeatType !== 'none' && (
                              <span className="text-cyan-400/60 text-[8px]">
                                {ann.repeatType === 'custom' ? `Every ${ann.repeatInterval || 1} ${ann.repeatIntervalUnit || 'days'}` : ann.repeatType}
                              </span>
                            )}
                            {ann.isSent && <span className="text-cyan-400/50 text-[8px]">sent</span>}
                            {ann.speakers && ann.speakers !== 'all' && (
                              <span className="text-white/30 text-[8px]">{ECHO_SPEAKER_OPTIONS[ann.speakers] || ann.speakers}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center shrink-0" style={{ marginRight: '10px' }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); sendAlexaNowMutation.mutate(ann.id); }}
                            className="text-white/30 hover:text-cyan-400 transition-colors"
                            title="Send now"
                            data-testid={`alexa-send-now-${ann.id}`}
                          >
                            <Megaphone className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {alexaPendingDeleteId !== null && (
              <div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)', borderRadius: '12px' }}>
                <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-lg" style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <p className="text-white text-[12px] text-center">Delete this announcement?</p>
                  <p className="text-white/50 text-[10px] text-center max-w-[200px] break-words">
                    {scheduledAlexaList.find((a: any) => a.id === alexaPendingDeleteId)?.message?.slice(0, 80) || ''}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <button
                      onClick={() => setAlexaPendingDeleteId(null)}
                      className="px-4 py-1.5 rounded text-white/70 text-[11px] hover:text-white transition-colors"
                      style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
                      data-testid="alexa-delete-cancel"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        deleteAlexaMutation.mutate(alexaPendingDeleteId);
                        setAlexaPendingDeleteId(null);
                      }}
                      className="px-4 py-1.5 rounded text-white text-[11px] font-semibold hover:opacity-90 transition-opacity"
                      style={{ background: '#dc2626' }}
                      data-testid="alexa-delete-confirm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.15)' }}>
              <span className="text-white text-[9px]">Swipe left to delete, right to toggle</span>
              <Button
                variant="outline"
                className="border !border-white/30 text-white/70 hover:text-white hover:!border-white/50 hover:bg-transparent transition-opacity duration-200 h-8 w-[80px]"
                style={{ fontSize: '12px' }}
                onClick={() => setIsAlexaDialogOpen(false)}
                data-testid="alexa-dialog-close"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
  );
}
