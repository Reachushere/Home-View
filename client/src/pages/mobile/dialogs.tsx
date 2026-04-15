import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Upload, Plus, ChevronLeft, ChevronRight } from "lucide-react";
import type { CoursesData } from "./types";

interface DegreeTrackingData {
  coursesData?: CoursesData;
  [key: string]: unknown;
}

export function QuickNotepadDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [group, setGroup] = useState('');
  const [text, setText] = useState('');
  const [images, setImages] = useState<{ file: File; preview: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      let htmlContent = '';
      if (text.trim()) {
        htmlContent += text.trim().split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('');
      }
      for (const img of images) {
        const reader = new FileReader();
        const base64 = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(img.file);
        });
        htmlContent += `<p><img src="${base64}" alt="${img.file.name}" style="max-width:100%;border-radius:8px;margin:8px 0;" /></p>`;
      }
      const resp = await fetch('/api/notepad/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || `Note ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}`,
          content: htmlContent,
          groupName: group.trim() || null,
          sortOrder: 0,
        }),
      });
      if (!resp.ok) throw new Error('Failed to save note');
      toast({ title: "Note saved", description: "Your note has been added to the notepad." });
      images.forEach(img => URL.revokeObjectURL(img.preview));
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes'] });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save note", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      data-testid="mobile-app-notepad-dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '92vw', maxWidth: '440px', maxHeight: '88vh',
          background: 'linear-gradient(180deg, #2a5a8a 0%, #164a72 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(5,23,41,0.8) 100%)',
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '16px 16px 0 0',
        }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>Quick Note</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', padding: '4px' }} data-testid="mobile-app-notepad-close">✕</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", display: 'block', marginBottom: '4px' }}>Title</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '14px', fontFamily: "system-ui, -apple-system, sans-serif", outline: 'none' }} data-testid="mobile-app-notepad-title" />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", display: 'block', marginBottom: '4px' }}>Group (optional)</label>
            <input type="text" value={group} onChange={(e) => setGroup(e.target.value)} placeholder="e.g. School, Personal..." style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '14px', fontFamily: "system-ui, -apple-system, sans-serif", outline: 'none' }} data-testid="mobile-app-notepad-group" />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", display: 'block', marginBottom: '4px' }}>Text</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your note here..." rows={5} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '14px', fontFamily: "system-ui, -apple-system, sans-serif", outline: 'none', resize: 'vertical', minHeight: '100px' }} data-testid="mobile-app-notepad-text" />
          </div>
          <div>
            <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif", display: 'block', marginBottom: '6px' }}>Images</label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', cursor: 'pointer', border: '2px dashed rgba(255,255,255,0.25)', background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontFamily: "system-ui, -apple-system, sans-serif" }} data-testid="mobile-app-notepad-upload-area">
              <Upload style={{ height: '18px', width: '18px' }} />
              <span>Tap to upload images</span>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setImages(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))]);
                e.target.value = '';
              }} data-testid="mobile-app-notepad-file-input" />
            </label>
            {images.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' }}>
                {images.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button onClick={() => { URL.revokeObjectURL(img.preview); setImages(prev => prev.filter((_, i) => i !== idx)); }} style={{ position: 'absolute', top: '2px', right: '2px', width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} data-testid={`mobile-app-notepad-remove-image-${idx}`}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "system-ui, -apple-system, sans-serif" }} data-testid="mobile-app-notepad-cancel">Cancel</button>
          <button
            disabled={saving || (!text.trim() && images.length === 0)}
            onClick={handleSave}
            style={{
              flex: 1, height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
              background: saving || (!text.trim() && images.length === 0) ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
              color: saving || (!text.trim() && images.length === 0) ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: '13px', fontWeight: 600, cursor: saving ? 'wait' : 'pointer', fontFamily: "system-ui, -apple-system, sans-serif",
              boxShadow: saving || (!text.trim() && images.length === 0) ? 'none' : '0 0 6px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.2)',
            }}
            data-testid="mobile-app-notepad-save"
          >{saving ? 'Saving...' : 'Save Note'}</button>
        </div>
      </div>
    </div>
  );
}

const SETTINGS_PAGES = [
  'Colour Settings', 'Layout Settings', 'Week View', 'Blinking & Spacing',
  'Text-to-Speech', 'Data Sync', 'Shift Schedule',
  'Google & Calendars', 'Display Options', 'School Week', 'Semesters', 'Calendar Weeks'
];

interface ColorSettings {
  mainBackground: string;
  mainBackgroundGradientEnd: string;
  headerBar: string;
  [key: string]: string;
}

interface BlinkSettings {
  buttonSpacing: number;
  tallPillButtonSpacing: number;
  [key: string]: number | boolean | string;
}

export function SettingsWizardDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [page, setPage] = useState(0);

  const [colorSettings, setColorSettings] = useState<ColorSettings>(() => {
    try {
      const stored = localStorage.getItem('colorSettings');
      if (stored) return JSON.parse(stored);
    } catch { /* use defaults */ }
    return { mainBackground: '#2a5a8a', mainBackgroundGradientEnd: '#164a72', headerBar: '#1a3a5c' };
  });
  const [originalColorSettings] = useState<ColorSettings>({ ...colorSettings });

  const [blinkSettings, setBlinkSettings] = useState<BlinkSettings>(() => {
    try {
      const stored = localStorage.getItem('blinkSettings');
      if (stored) return JSON.parse(stored);
    } catch { /* use defaults */ }
    return { buttonSpacing: 0, tallPillButtonSpacing: 0 };
  });
  const [originalBlinkSettings] = useState<BlinkSettings>({ ...blinkSettings });

  const handleCancel = () => {
    setColorSettings(originalColorSettings);
    setBlinkSettings(originalBlinkSettings);
    onClose();
  };

  const handleSave = async () => {
    localStorage.setItem('colorSettings', JSON.stringify(colorSettings));
    localStorage.setItem('blinkSettings', JSON.stringify(blinkSettings));
    try {
      await apiRequest('POST', '/api/degree-tracking/save', { key: 'colorSettings', value: colorSettings });
      await apiRequest('POST', '/api/degree-tracking/save', { key: 'blinkSettings', value: blinkSettings });
    } catch { /* server sync optional */ }
    if (page < SETTINGS_PAGES.length - 1) {
      setPage(page + 1);
    } else {
      toast({ title: "Settings saved", description: "Your settings have been applied." });
      onClose();
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
      data-testid="mobile-app-settings-wizard"
    >
      <div
        style={{
          width: '92vw', maxWidth: '440px', maxHeight: '88vh',
          background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, ${colorSettings.mainBackgroundGradientEnd} 100%)`,
          border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`,
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          borderRadius: '16px 16px 0 0',
        }}>
          <span style={{ color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {SETTINGS_PAGES[page] || 'Settings'}
          </span>
          <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {page + 1} / {SETTINGS_PAGES.length}
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '16px', minHeight: '200px', maxHeight: '60vh' }}>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', textAlign: 'center', paddingTop: '40px', fontFamily: "system-ui, -apple-system, sans-serif" }}>
            {SETTINGS_PAGES[page]} settings
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', gap: '10px' }}>
          <button onClick={handleCancel} style={{ flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', fontFamily: "system-ui, -apple-system, sans-serif" }} data-testid="mobile-app-settings-cancel">Cancel</button>
          <button
            onClick={handleSave}
            style={{
              flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer', fontFamily: "system-ui, -apple-system, sans-serif",
              boxShadow: '0 0 6px rgba(255,255,255,0.4), 0 0 12px rgba(255,255,255,0.2)',
            }}
            data-testid="mobile-app-settings-save"
          >{page < SETTINGS_PAGES.length - 1 ? 'Save & Next' : 'Save & Done'}</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '4px', paddingBottom: '10px' }}>
          {SETTINGS_PAGES.map((_, i) => (
            <div key={i} onClick={() => setPage(i)} style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: i === page ? '#ffffff' : 'rgba(255,255,255,0.25)', cursor: 'pointer', transition: 'background-color 0.2s' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PartnerShiftDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [dates, setDates] = useState<string[]>([]);
  const [shiftType, setShiftType] = useState<'day' | 'night'>('day');
  const [submitting, setSubmitting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const monthDays = useMemo(() => {
    const { year, month } = selectedMonth;
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);
    return cells;
  }, [selectedMonth]);

  const handleSubmit = async () => {
    if (dates.length === 0) return;
    setSubmitting(true);
    try {
      for (const date of dates) {
        await apiRequest('POST', '/api/shift-schedule', { date, shiftType });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/shift-schedule'] });
      toast({ title: 'Shifts added', description: `${dates.length} shift(s) created` });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const monthName = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date(selectedMonth.year, selectedMonth.month));

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="mobile-app-shift-dialog"
    >
      <div
        style={{
          width: '92vw', maxWidth: '400px', maxHeight: '88vh',
          background: 'linear-gradient(180deg, #2a5a8a 0%, #164a72 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: 'linear-gradient(180deg, rgba(139,92,246,0.3) 0%, rgba(5,23,41,0.8) 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>Partner Shifts</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', padding: '4px' }} data-testid="mobile-app-shift-close">✕</button>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontFamily: "system-ui, -apple-system, sans-serif", textAlign: 'center' }}>Select shift type</div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                {(['day', 'night'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => { setShiftType(t); setStep(1); }}
                    style={{
                      padding: '14px 24px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.3)',
                      background: shiftType === t ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
                      color: '#fff', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                    data-testid={`mobile-app-shift-type-${t}`}
                  >
                    {t === 'day' ? '☀️ Day' : '🌙 Night'}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <button onClick={() => setSelectedMonth(m => { const d = new Date(m.year, m.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', width: '28px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
                <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{monthName}</span>
                <button onClick={() => setSelectedMonth(m => { const d = new Date(m.year, m.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '4px', width: '28px', height: '26px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '3px' }}>
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
                  <div key={d} style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '10px', fontWeight: 600, padding: '2px 0' }}>{d}</div>
                ))}
                {monthDays.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const dateStr = `${selectedMonth.year}-${String(selectedMonth.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const selected = dates.includes(dateStr);
                  return (
                    <button
                      key={i}
                      onClick={() => setDates(prev => selected ? prev.filter(d => d !== dateStr) : [...prev, dateStr])}
                      style={{
                        textAlign: 'center', padding: '6px 2px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                        background: selected ? (shiftType === 'day' ? 'rgba(234,179,8,0.4)' : 'rgba(99,102,241,0.4)') : 'rgba(255,255,255,0.05)',
                        color: '#fff', fontSize: '13px', fontWeight: selected ? 700 : 400,
                      }}
                    >{day}</button>
                  );
                })}
              </div>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px', textAlign: 'center', marginTop: '8px' }}>
                {dates.length} date{dates.length !== 1 ? 's' : ''} selected
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', gap: '10px' }}>
          {step === 1 && (
            <button onClick={() => setStep(0)} style={{ flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer' }} data-testid="mobile-app-shift-back">Back</button>
          )}
          {step === 0 && (
            <button onClick={onClose} style={{ flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer' }}>Cancel</button>
          )}
          {step === 1 && (
            <button
              disabled={dates.length === 0 || submitting}
              onClick={handleSubmit}
              style={{
                flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
                background: dates.length === 0 ? 'rgba(255,255,255,0.05)' : 'rgba(139,92,246,0.4)',
                color: dates.length === 0 ? 'rgba(255,255,255,0.3)' : '#fff',
                fontSize: '13px', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer',
              }}
              data-testid="mobile-app-shift-submit"
            >{submitting ? 'Saving...' : 'Save Shifts'}</button>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlexaDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await apiRequest('POST', '/api/ha-announce', { message: message.trim() });
      toast({ title: "Sent to Alexa" });
      setMessage('');
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      data-testid="mobile-app-alexa-dialog"
    >
      <div
        style={{
          width: '92vw', maxWidth: '400px',
          background: 'linear-gradient(180deg, #2a5a8a 0%, #164a72 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(5,23,41,0.8) 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <span style={{ color: '#fff', fontSize: '14px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
            <Megaphone style={{ display: 'inline', height: '16px', width: '16px', marginRight: '6px', verticalAlign: 'middle' }} />
            Alexa / Megaphone
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', padding: '4px' }} data-testid="mobile-app-alexa-close">✕</button>
        </div>
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message to speak..." rows={3} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '14px', fontFamily: "system-ui, -apple-system, sans-serif", outline: 'none', resize: 'vertical' }} data-testid="mobile-app-alexa-input" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', gap: '10px' }}>
          <button onClick={onClose} style={{ flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer' }} data-testid="mobile-app-alexa-cancel">Cancel</button>
          <button
            disabled={!message.trim() || sending}
            onClick={handleSend}
            style={{
              flex: 1, height: '36px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
              background: !message.trim() ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
              color: !message.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: '13px', fontWeight: 600, cursor: sending ? 'wait' : 'pointer',
            }}
            data-testid="mobile-app-alexa-send"
          >{sending ? 'Sending...' : 'Send'}</button>
        </div>
      </div>
    </div>
  );
}

const QUICK_ADD_STEPS = [
  { id: 0, label: 'Type', color: 'rgba(120,90,255,0.7)' },
  { id: 1, label: 'Name', color: 'rgba(56,170,255,0.7)' },
  { id: 2, label: 'Course', color: 'rgba(16,200,130,0.7)' },
  { id: 3, label: 'Date', color: 'rgba(255,160,40,0.7)' },
  { id: 4, label: 'Priority', color: 'rgba(255,100,160,0.7)' },
  { id: 5, label: 'Reminders', color: 'rgba(0,190,200,0.7)' },
  { id: 6, label: 'Notes', color: 'rgba(80,180,80,0.7)' },
  { id: 7, label: 'Review', color: 'rgba(160,120,255,0.7)' },
];

const TASK_TYPES = [
  { value: 'assignment', label: 'Assignment', color: 'rgba(56,170,255,0.35)' },
  { value: 'quiz', label: 'Quiz', color: 'rgba(16,200,120,0.35)' },
  { value: 'exam', label: 'Exam', color: 'rgba(220,30,30,0.4)' },
  { value: 'lab', label: 'Lab', color: 'rgba(255,180,30,0.35)' },
  { value: 'project', label: 'Project', color: 'rgba(255,100,50,0.35)' },
  { value: 'reading', label: 'Reading', color: 'rgba(56,130,255,0.35)' },
  { value: 'discussion', label: 'Discussion', color: 'rgba(0,210,240,0.35)' },
  { value: 'essay', label: 'Essay', color: 'rgba(255,180,30,0.35)' },
  { value: 'module', label: 'Module', color: 'rgba(180,120,220,0.35)' },
  { value: 'reminder', label: 'Reminder', color: 'rgba(80,100,220,0.4)' },
  { value: 'meeting', label: 'Meeting', color: 'rgba(202,138,4,0.35)' },
  { value: 'other', label: 'Other', color: 'rgba(180,160,40,0.35)' },
];

const REMINDER_OPTIONS = [
  { value: null, label: 'None' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hr', label: '1 hour before' },
  { value: '2hr', label: '2 hours before' },
  { value: '1day', label: '1 day before' },
  { value: '2day', label: '2 days before' },
  { value: '1week', label: '1 week before' },
];

interface QuickAddData {
  type: string;
  title: string;
  courseName: string;
  dueDate: string;
  dueDateHour: string;
  dueDateMinute: string;
  timezone: string;
  priority: string;
  description: string;
  notes: string;
  referenceLink: string;
  reminder1: string | null;
  reminder2: string | null;
  reminderEmail: boolean;
  reminderAlexa: boolean;
  prepDays: number;
  showCountdownBar: boolean;
  showCountdownBarMain: boolean;
  showCountdownBarSummary: boolean;
  repeatType: string;
}

export function AddTaskDialog({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [hasUnsavedData, setHasUnsavedData] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const [data, setData] = useState<QuickAddData>(() => {
    const d = new Date();
    return {
      type: '',
      title: '',
      courseName: '',
      dueDate: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      dueDateHour: '18',
      dueDateMinute: '00',
      timezone: 'America/Toronto',
      priority: 'medium',
      description: '',
      notes: '',
      referenceLink: '',
      reminder1: '30min',
      reminder2: '2hr',
      reminderEmail: false,
      reminderAlexa: false,
      prepDays: 0,
      showCountdownBar: true,
      showCountdownBarMain: true,
      showCountdownBarSummary: true,
      repeatType: 'none',
    };
  });

  const { data: degreeData } = useQuery<DegreeTrackingData>({
    queryKey: ["/api/degree-tracking"],
    staleTime: 60000,
  });
  const courses = degreeData?.coursesData?.courses || [];

  useEffect(() => {
    const dirty = data.type !== '' || data.title.trim() !== '' || data.courseName !== '' || data.notes.trim() !== '';
    setHasUnsavedData(dirty);
  }, [data]);

  const handleClose = () => {
    if (hasUnsavedData) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const update = (field: keyof QuickAddData, value: string | number | boolean | null) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!data.title.trim()) {
      toast({ title: "Error", description: "Task title is required", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const dueDate = new Date(`${data.dueDate}T${data.dueDateHour}:${data.dueDateMinute}`);
      let startDate: string | null = null;
      if (data.prepDays > 0) {
        const sd = new Date(dueDate);
        sd.setDate(sd.getDate() - data.prepDays);
        startDate = sd.toISOString();
      }
      await apiRequest('POST', '/api/tasks', {
        title: data.title.trim(),
        type: data.type || 'assignment',
        courseName: data.courseName || null,
        dueDate: dueDate.toISOString(),
        startDate,
        priority: data.priority,
        description: data.description || '',
        notes: data.notes || null,
        referenceLink: data.referenceLink || '',
        reminder1: data.reminder1,
        reminder2: data.reminder2,
        reminderEmail: data.reminderEmail,
        reminderAlexa: data.reminderAlexa,
        showCountdownBar: data.showCountdownBar,
        showCountdownBarMain: data.showCountdownBarMain,
        showCountdownBarSummary: data.showCountdownBarSummary,
        repeatType: data.repeatType,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/weeks'] });
      toast({ title: "Task added", description: `${data.title} has been added to your calendar.` });
      onClose();
    } catch (err: unknown) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to add task", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: '8px',
    background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
    color: '#fff', fontSize: '13px', fontFamily: "system-ui, -apple-system, sans-serif",
    outline: 'none',
  };

  const stepTitle = QUICK_ADD_STEPS[step]?.label || 'Add Task';

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Select task type</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {TASK_TYPES.map(t => (
                <button
                  key={t.value}
                  onClick={() => { update('type', t.value); setStep(1); }}
                  style={{
                    padding: '12px', borderRadius: '8px', cursor: 'pointer',
                    background: data.type === t.value ? t.color.replace('0.35', '0.6') : t.color,
                    border: `1px solid ${data.type === t.value ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)'}`,
                    color: '#fff', fontSize: '12px', fontWeight: 600, textAlign: 'left',
                  }}
                  data-testid={`mobile-app-add-task-type-${t.value}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        );
      case 1:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Task Title *</label>
              <input type="text" value={data.title} onChange={(e) => update('title', e.target.value)} placeholder="Enter task name..." style={inputStyle} data-testid="mobile-app-add-task-title" autoFocus />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Description (optional)</label>
              <textarea value={data.description} onChange={(e) => update('description', e.target.value)} placeholder="Add a description..." rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: '60px' }} data-testid="mobile-app-add-task-description" />
            </div>
          </div>
        );
      case 2:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Select course</div>
            <button
              onClick={() => update('courseName', '')}
              style={{
                padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                background: data.courseName === '' ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                border: `1px solid ${data.courseName === '' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
                color: '#fff', fontSize: '12px',
              }}
              data-testid="mobile-app-add-task-no-course"
            >No course</button>
            {courses.map((c) => (
              <button
                key={c.name}
                onClick={() => update('courseName', c.name)}
                style={{
                  padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                  background: data.courseName === c.name ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${data.courseName === c.name ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  color: '#fff', fontSize: '12px',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}
                data-testid={`mobile-app-add-task-course-${c.name}`}
              >
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.color || '#3b82f6', flexShrink: 0 }} />
                {c.name}
              </button>
            ))}
          </div>
        );
      case 3:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Due Date</label>
              <input type="date" value={data.dueDate} onChange={(e) => update('dueDate', e.target.value)} style={inputStyle} data-testid="mobile-app-add-task-date" />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Hour</label>
                <select value={data.dueDateHour} onChange={(e) => update('dueDateHour', e.target.value)} style={{ ...inputStyle, appearance: 'auto' as const }} data-testid="mobile-app-add-task-hour">
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={String(i).padStart(2, '0')} style={{ background: '#1a3a5c' }}>{i === 0 ? '12 AM' : i < 12 ? `${i} AM` : i === 12 ? '12 PM' : `${i - 12} PM`}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Minute</label>
                <select value={data.dueDateMinute} onChange={(e) => update('dueDateMinute', e.target.value)} style={{ ...inputStyle, appearance: 'auto' as const }} data-testid="mobile-app-add-task-minute">
                  {['00', '15', '30', '45'].map(m => (
                    <option key={m} value={m} style={{ background: '#1a3a5c' }}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Prep Days (start early)</label>
              <input type="number" min={0} max={30} value={data.prepDays} onChange={(e) => update('prepDays', parseInt(e.target.value) || 0)} style={inputStyle} data-testid="mobile-app-add-task-prep-days" />
            </div>
          </div>
        );
      case 4:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, marginBottom: '4px' }}>Select priority</div>
            {['low', 'medium', 'high', 'critical'].map(p => {
              const colors: Record<string, string> = { low: 'rgba(130,200,130,0.3)', medium: 'rgba(59,130,246,0.3)', high: 'rgba(234,179,8,0.3)', critical: 'rgba(239,68,68,0.3)' };
              return (
                <button
                  key={p}
                  onClick={() => update('priority', p)}
                  style={{
                    padding: '12px 14px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                    background: data.priority === p ? colors[p]?.replace('0.3', '0.5') || 'rgba(255,255,255,0.15)' : colors[p] || 'rgba(255,255,255,0.06)',
                    border: `1px solid ${data.priority === p ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)'}`,
                    color: '#fff', fontSize: '13px', fontWeight: data.priority === p ? 700 : 500,
                  }}
                  data-testid={`mobile-app-add-task-priority-${p}`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              );
            })}
          </div>
        );
      case 5:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reminder 1</label>
              <select value={data.reminder1 || ''} onChange={(e) => update('reminder1', e.target.value || null)} style={{ ...inputStyle, appearance: 'auto' as const }} data-testid="mobile-app-add-task-reminder1">
                {REMINDER_OPTIONS.map(r => (
                  <option key={r.label} value={r.value || ''} style={{ background: '#1a3a5c' }}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reminder 2</label>
              <select value={data.reminder2 || ''} onChange={(e) => update('reminder2', e.target.value || null)} style={{ ...inputStyle, appearance: 'auto' as const }} data-testid="mobile-app-add-task-reminder2">
                {REMINDER_OPTIONS.map(r => (
                  <option key={r.label} value={r.value || ''} style={{ background: '#1a3a5c' }}>{r.label}</option>
                ))}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.reminderEmail} onChange={(e) => update('reminderEmail', e.target.checked)} data-testid="mobile-app-add-task-reminder-email" />
                Email
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'rgba(255,255,255,0.7)', fontSize: '12px', cursor: 'pointer' }}>
                <input type="checkbox" checked={data.reminderAlexa} onChange={(e) => update('reminderAlexa', e.target.checked)} data-testid="mobile-app-add-task-reminder-alexa" />
                Alexa
              </label>
            </div>
          </div>
        );
      case 6:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Notes</label>
              <textarea value={data.notes} onChange={(e) => update('notes', e.target.value)} placeholder="Add notes..." rows={4} style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }} data-testid="mobile-app-add-task-notes" />
            </div>
            <div>
              <label style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Reference Link</label>
              <input type="url" value={data.referenceLink} onChange={(e) => update('referenceLink', e.target.value)} placeholder="https://..." style={inputStyle} data-testid="mobile-app-add-task-reference-link" />
            </div>
          </div>
        );
      case 7:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>Review Task</div>
            {[
              { label: 'Type', value: data.type || 'Not set' },
              { label: 'Title', value: data.title || 'Not set' },
              { label: 'Course', value: data.courseName || 'None' },
              { label: 'Due', value: data.dueDate ? `${data.dueDate} at ${data.dueDateHour}:${data.dueDateMinute}` : 'Not set' },
              { label: 'Priority', value: data.priority },
              { label: 'Reminder 1', value: REMINDER_OPTIONS.find(r => r.value === data.reminder1)?.label || 'None' },
              { label: 'Reminder 2', value: REMINDER_OPTIONS.find(r => r.value === data.reminder2)?.label || 'None' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{row.label}</span>
                <span style={{ color: '#fff', fontSize: '12px', fontWeight: 500, textAlign: 'right', maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.value}</span>
              </div>
            ))}
            {data.notes && (
              <div style={{ padding: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', marginTop: '4px' }}>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px', fontWeight: 600, marginBottom: '4px' }}>Notes</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', whiteSpace: 'pre-wrap' }}>{data.notes}</div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      data-testid="mobile-app-add-task-dialog"
    >
      <div
        style={{
          width: '92vw', maxWidth: '440px', maxHeight: '88vh',
          background: 'linear-gradient(180deg, #2a5a8a 0%, #164a72 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)', borderRadius: '16px',
          boxShadow: '0 4px 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.2)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.28) 0%, rgba(5,23,41,0.8) 100%)',
          borderRadius: '16px 16px 0 0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus style={{ width: 15, height: 15, color: '#fff' }} />
            <span style={{ color: '#fff', fontSize: '12px', fontWeight: 600, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              {stepTitle}
            </span>
          </div>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '18px', padding: '4px' }} data-testid="mobile-app-add-task-close">✕</button>
        </div>

        {step > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', overflowX: 'auto' }}>
            {QUICK_ADD_STEPS.map((s) => (
              <button
                key={s.id}
                onClick={() => setStep(s.id)}
                style={{
                  padding: '4px 8px', borderRadius: '4px', border: 'none', cursor: 'pointer',
                  background: step === s.id ? s.color : 'transparent',
                  color: step === s.id ? '#fff' : 'rgba(255,255,255,0.4)',
                  fontSize: '10px', fontWeight: step === s.id ? 600 : 400,
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
                data-testid={`mobile-app-add-task-step-${s.id}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
          {renderStepContent()}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.15)', gap: '10px' }}>
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              style={{
                height: '40px', width: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)',
                background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
              data-testid="mobile-app-add-task-prev"
            ><ChevronLeft style={{ width: 18, height: 18 }} /></button>
          )}

          {step === 0 && (
            <button onClick={handleClose} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'rgba(255,255,255,0.7)', fontSize: '13px', cursor: 'pointer' }} data-testid="mobile-app-add-task-cancel">Cancel</button>
          )}

          {step < QUICK_ADD_STEPS.length - 1 && step > 0 && (
            <button
              onClick={() => setStep(s => s + 1)}
              style={{
                flex: 1, height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
                background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
              data-testid="mobile-app-add-task-next"
            >Next <ChevronRight style={{ width: 16, height: 16 }} /></button>
          )}

          {step === QUICK_ADD_STEPS.length - 1 && (
            <button
              disabled={!data.title.trim() || submitting}
              onClick={handleSubmit}
              style={{
                flex: 1, height: '40px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.5)',
                background: !data.title.trim() ? 'rgba(255,255,255,0.05)' : 'rgba(59,130,246,0.4)',
                color: !data.title.trim() ? 'rgba(255,255,255,0.3)' : '#fff',
                fontSize: '13px', fontWeight: 600, cursor: submitting ? 'wait' : 'pointer',
                boxShadow: data.title.trim() ? '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              }}
              data-testid="mobile-app-add-task-submit"
            >
              <Plus style={{ width: 14, height: 14 }} />
              {submitting ? 'Adding...' : 'Add Task'}
            </button>
          )}
        </div>

        {showDiscardConfirm && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', borderRadius: 'inherit' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '24px', borderRadius: '12px', background: 'linear-gradient(135deg, rgba(40,40,50,0.98), rgba(20,20,30,0.99))', border: '1px solid rgba(255,255,255,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
              <p style={{ color: '#fff', fontSize: '12px', textAlign: 'center' }}>You have unsaved changes.<br />Discard this task?</p>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowDiscardConfirm(false)}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
                  data-testid="mobile-app-add-task-cancel-discard"
                >Go Back</button>
                <button
                  onClick={() => { setShowDiscardConfirm(false); onClose(); }}
                  style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '11px', color: '#fff', background: 'rgba(220,38,38,0.8)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer' }}
                  data-testid="mobile-app-add-task-confirm-discard"
                >Discard</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
