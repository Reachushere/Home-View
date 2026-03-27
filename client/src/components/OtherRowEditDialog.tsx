import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Trash2, RotateCcw, Layers } from 'lucide-react';

interface OtherRowColors {
  labelStart: string;
  labelEnd: string;
  labelStops: string;
  cellBg: string;
  borderColor: string;
  taskBgColor: string;
  courseRowColor: string;
}

const DEFAULTS: OtherRowColors = {
  labelStart: '#374151',
  labelEnd: '#9ca3af',
  labelStops: '',
  cellBg: '#3a3f4a',
  borderColor: '#5c6370',
  taskBgColor: '#363b44',
  courseRowColor: '#3a3f4a',
};

interface Props {
  open: boolean;
  onClose: () => void;
  colors: OtherRowColors;
  onSave: (colors: OtherRowColors) => void;
  onPreview?: (colors: OtherRowColors) => void;
  headerBarColor?: string;
}

export default function OtherRowEditDialog({ open, onClose, colors, onSave, onPreview, headerBarColor = '#051729' }: Props) {
  const [edit, setEdit] = useState<OtherRowColors>(colors);
  const [activeGradientStop, setActiveGradientStop] = useState<'start' | 'end' | number | null>(null);
  const [activeSwatchPicker, setActiveSwatchPicker] = useState<'border' | 'rowBg' | 'taskBg' | null>(null);
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const gradBarRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; mx: number; my: number } | null>(null);
  const originalColorsRef = useRef<OtherRowColors>(colors);

  useEffect(() => {
    if (open) {
      setEdit(colors);
      originalColorsRef.current = colors;
    }
  }, [open, colors]);

  useEffect(() => {
    if (open && onPreview) onPreview(edit);
  }, [edit, open]);

  const handleDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const pt = 'touches' in e ? e.touches[0] : e;
    dragStart.current = { x: dialogPos.x, y: dialogPos.y, mx: pt.clientX, my: pt.clientY };
    const onMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragStart.current) return;
      const p = 'touches' in ev ? (ev as TouchEvent).touches[0] : (ev as MouseEvent);
      setDialogPos({
        x: dragStart.current.x + p.clientX - dragStart.current.mx,
        y: dragStart.current.y + p.clientY - dragStart.current.my,
      });
    };
    const onUp = () => { dragStart.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); window.removeEventListener('touchmove', onMove); window.removeEventListener('touchend', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  }, [dialogPos]);

  if (!open) return null;

  const midStops: Array<{ position: number; color: string }> = edit.labelStops ? (() => { try { return JSON.parse(edit.labelStops); } catch { return []; } })() : [];
  const allStops = [
    { position: 0, color: edit.labelStart, key: 'start' as const },
    ...midStops.map((s, i) => ({ position: s.position, color: s.color, key: i as number })),
    { position: 100, color: edit.labelEnd, key: 'end' as const },
  ].sort((a, b) => a.position - b.position);
  const gradientCss = `linear-gradient(to right, ${allStops.map(s => `${s.color} ${s.position}%`).join(', ')})`;

  const getActiveColor = (): string => {
    if (activeGradientStop === 'start') return edit.labelStart;
    if (activeGradientStop === 'end') return edit.labelEnd;
    if (typeof activeGradientStop === 'number' && midStops[activeGradientStop]) return midStops[activeGradientStop].color;
    return '#000000';
  };

  const setActiveColor = (hex: string) => {
    if (activeGradientStop === 'start') setEdit({ ...edit, labelStart: hex });
    else if (activeGradientStop === 'end') setEdit({ ...edit, labelEnd: hex });
    else if (typeof activeGradientStop === 'number') {
      const updated = [...midStops];
      updated[activeGradientStop] = { ...updated[activeGradientStop], color: hex };
      setEdit({ ...edit, labelStops: JSON.stringify(updated) });
    }
  };

  const hexToHue = (c: string) => {
    const r = parseInt(c.slice(1, 3), 16) / 255, g = parseInt(c.slice(3, 5), 16) / 255, b = parseInt(c.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    if (max === min) return 0;
    let h = 0;
    if (max === r) h = ((g - b) / (max - min)) % 6;
    else if (max === g) h = (b - r) / (max - min) + 2;
    else h = (r - g) / (max - min) + 4;
    h = Math.round(h * 60);
    return h < 0 ? h + 360 : h;
  };

  const hueToHex = (hue: number) => `#${[0, 8, 4].map(n => {
    const k = (n + hue / 30) % 12;
    const c2 = 0.5 - 0.5 * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * Math.max(0, Math.min(1, c2))).toString(16).padStart(2, '0');
  }).join('')}`;

  const hexToSvPos = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const v = max;
    const s = max === 0 ? 0 : (max - min) / max;
    return { x: s, y: 1 - v };
  };

  const svToHex = (hue: number, sx: number, sy: number) => {
    const s = sx, v = 1 - sy;
    const c = v * s, x2 = c * (1 - Math.abs((hue / 60) % 2 - 1)), m = v - c;
    let r1 = 0, g1 = 0, b1 = 0;
    if (hue < 60) { r1 = c; g1 = x2; } else if (hue < 120) { r1 = x2; g1 = c; } else if (hue < 180) { g1 = c; b1 = x2; } else if (hue < 240) { g1 = x2; b1 = c; } else if (hue < 300) { r1 = x2; b1 = c; } else { r1 = c; b1 = x2; }
    const f = (ch: number) => Math.round(255 * Math.max(0, Math.min(1, ch + m))).toString(16).padStart(2, '0');
    return `#${f(r1)}${f(g1)}${f(b1)}`;
  };

  const headerGradient = `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${headerBarColor}cc 40%, ${headerBarColor}bb 100%)`;

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center" onClick={() => { if (onPreview) onPreview(originalColorsRef.current); onClose(); }} data-testid="other-row-edit-overlay">
      <div className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        className="relative rounded-lg overflow-hidden"
        style={{
          width: '420px',
          maxHeight: '520px',
          overflowY: 'auto',
          scrollbarWidth: 'thin',
          background: 'linear-gradient(180deg, #3a8bbf 0%, color-mix(in srgb, #164a72 70%, black) 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.05)',
          transform: `translate(${dialogPos.x}px, ${dialogPos.y}px)`,
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="other-row-edit-dialog"
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
          style={{
            cursor: 'grab',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            background: headerGradient,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            <Layers className="text-white flex-shrink-0" style={{ width: '15px', height: '15px' }} />
            <h2
              className="font-normal text-white truncate"
              style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}
              data-testid="text-other-row-title"
            >
              OTHER Row Appearance
            </h2>
          </div>
          <button onClick={() => { if (onPreview) onPreview(originalColorsRef.current); onClose(); }} className="text-white/70 hover:text-white" data-testid="button-close-other-edit"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="flex items-start gap-3">
            <div style={{ width: '200px' }}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white text-[9px]">Label Gradient</label>
                <button className="text-white hover:text-white/80 text-[8px] flex items-center gap-0.5" onClick={() => {
                  setEdit({ ...edit, labelStart: edit.labelEnd, labelEnd: edit.labelStart, labelStops: midStops.length ? JSON.stringify(midStops.map(s => ({ ...s, position: 100 - s.position })).reverse()) : '' });
                }} data-testid="button-reverse-gradient"><svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 4h14M11 1l3 3-3 3M15 12H1M5 9l-3 3 3 3"/></svg><span>Reverse</span></button>
              </div>
              <div ref={gradBarRef} className="rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', padding: '1px', background: 'rgba(0,0,0,0.2)', cursor: 'copy' }}
                onDoubleClick={(e) => {
                  const bar = gradBarRef.current;
                  if (!bar) return;
                  const rect = bar.getBoundingClientRect();
                  const pct = Math.round(Math.max(5, Math.min(95, ((e.clientX - rect.left - 3) / (rect.width - 6)) * 100)));
                  const leftStop = allStops.filter(s => s.position <= pct).pop()!;
                  const rightStop = allStops.find(s => s.position >= pct)!;
                  const t = rightStop.position === leftStop.position ? 0 : (pct - leftStop.position) / (rightStop.position - leftStop.position);
                  const lR = parseInt(leftStop.color.slice(1,3),16), lG = parseInt(leftStop.color.slice(3,5),16), lB = parseInt(leftStop.color.slice(5,7),16);
                  const rR = parseInt(rightStop.color.slice(1,3),16), rG = parseInt(rightStop.color.slice(3,5),16), rB = parseInt(rightStop.color.slice(5,7),16);
                  const mR = Math.round(lR + (rR-lR)*t), mG = Math.round(lG + (rG-lG)*t), mB = Math.round(lB + (rB-lB)*t);
                  const newColor = `#${mR.toString(16).padStart(2,'0')}${mG.toString(16).padStart(2,'0')}${mB.toString(16).padStart(2,'0')}`;
                  const newMid = [...midStops, { position: pct, color: newColor }].sort((a, b) => a.position - b.position);
                  const newIdx = newMid.findIndex(s => s.position === pct && s.color === newColor);
                  setEdit({ ...edit, labelStops: JSON.stringify(newMid) });
                  setActiveGradientStop(newIdx);
                }}
                data-testid="gradient-bar">
                <div style={{ height: '18px', borderRadius: '3px', background: gradientCss }} data-testid="gradient-preview-bar" />
              </div>
              <div className="relative" style={{ height: '16px', marginTop: '1px' }}>
                <div style={{ position: 'absolute', left: '0px', top: 0, cursor: 'pointer', zIndex: 10 }} onClick={() => { setActiveGradientStop(activeGradientStop === 'start' ? null : 'start'); setActiveSwatchPicker(null); }} data-testid="gradient-stop-start">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={edit.labelStart} stroke={activeGradientStop === 'start' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={activeGradientStop === 'start' ? '2' : '1'}/></svg>
                </div>
                {midStops.map((stop, idx) => (
                  <div key={idx} style={{ position: 'absolute', left: `calc(${stop.position}% - 6px)`, top: 0, cursor: 'pointer', touchAction: 'none', zIndex: activeGradientStop === idx ? 20 : 5 }}
                    onClick={() => { setActiveGradientStop(activeGradientStop === idx ? null : idx); setActiveSwatchPicker(null); }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const el = e.currentTarget as HTMLElement;
                      el.setPointerCapture(e.pointerId);
                      const bar = gradBarRef.current;
                      if (!bar) return;
                      const barRect = bar.getBoundingClientRect();
                      const barW = barRect.width;
                      const onMove = (ev: PointerEvent) => {
                        const pct = Math.round(Math.max(1, Math.min(99, ((ev.clientX - barRect.left) / barW) * 100)));
                        const updated = [...midStops];
                        updated[idx] = { ...updated[idx], position: pct };
                        setEdit(prev => ({ ...prev, labelStops: JSON.stringify(updated.sort((a, b) => a.position - b.position)) }));
                      };
                      const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}
                    data-testid={`gradient-stop-mid-${idx}`}>
                    <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 11,6 6,12 1,6" fill={stop.color} stroke={activeGradientStop === idx ? '#ffffff' : 'rgba(255,255,255,0.5)'} strokeWidth={activeGradientStop === idx ? '2' : '1'}/></svg>
                  </div>
                ))}
                <div style={{ position: 'absolute', right: '0px', top: 0, cursor: 'pointer', zIndex: 10 }} onClick={() => { setActiveGradientStop(activeGradientStop === 'end' ? null : 'end'); setActiveSwatchPicker(null); }} data-testid="gradient-stop-end">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={edit.labelEnd} stroke={activeGradientStop === 'end' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={activeGradientStop === 'end' ? '2' : '1'}/></svg>
                </div>
                {midStops.length > 0 && <span className="text-white text-[9px] absolute" style={{ bottom: '-23px', left: '0px' }}>Double-click bar to add · drag to move</span>}
              </div>
              {midStops.length === 0 && <div className="text-white text-[9px] text-left" style={{ marginTop: '7px', marginBottom: '10px' }}>Double-click gradient bar to add a colour stop</div>}
              {midStops.length > 0 && <div style={{ height: '24px' }} />}
              {activeGradientStop != null && (
                <div className="mt-1 rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', padding: '6px' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <div className="w-5 h-5 rounded border border-white/30 shrink-0" style={{ backgroundColor: getActiveColor() }} />
                    <span className="text-white/60 text-[8px] uppercase tracking-wider">{activeGradientStop === 'start' ? 'Start' : activeGradientStop === 'end' ? 'End' : `Stop ${(activeGradientStop as number) + 1}`} Colour</span>
                    {typeof activeGradientStop === 'number' && (
                      <button className="text-red-400/70 hover:text-red-400 text-[8px] ml-auto mr-1" onClick={() => {
                        const updated = midStops.filter((_, i) => i !== activeGradientStop);
                        setEdit({ ...edit, labelStops: updated.length ? JSON.stringify(updated) : '' });
                        setActiveGradientStop(null);
                      }} data-testid="button-delete-stop"><Trash2 className="w-3 h-3" /></button>
                    )}
                    <button className={`${typeof activeGradientStop === 'number' ? '' : 'ml-auto '}text-white/40 hover:text-white`} onClick={() => setActiveGradientStop(null)} data-testid="button-close-color-picker"><X className="w-3 h-3" /></button>
                  </div>
                  {typeof activeGradientStop === 'number' && (
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-white/50 text-[8px]">Position</span>
                      <input type="range" min={1} max={99} value={midStops[activeGradientStop]?.position || 50} onChange={(e) => {
                        const updated = [...midStops];
                        updated[activeGradientStop as number] = { ...updated[activeGradientStop as number], position: parseInt(e.target.value) };
                        setEdit({ ...edit, labelStops: JSON.stringify(updated.sort((a, b) => a.position - b.position)) });
                      }} className="flex-1" style={{ height: '6px', accentColor: getActiveColor() }} data-testid="slider-stop-position" />
                      <span className="text-white/50 text-[8px] w-6 text-right">{midStops[activeGradientStop]?.position}%</span>
                    </div>
                  )}
                  <div className="relative rounded overflow-hidden cursor-crosshair" style={{ height: '80px', touchAction: 'none' }} data-testid={`color-area-${activeGradientStop}`}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const el = e.currentTarget;
                      el.setPointerCapture(e.pointerId);
                      const rect = el.getBoundingClientRect();
                      const hue = hexToHue(getActiveColor());
                      const update = (ev: PointerEvent) => {
                        const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                        const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
                        setActiveColor(svToHex(hue, x, y));
                      };
                      update(e.nativeEvent);
                      const onMove = (ev: PointerEvent) => update(ev);
                      const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}>
                    <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, white, hsl(${hexToHue(getActiveColor())}, 100%, 50%))` }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, black)' }} />
                    {(() => {
                      const pos = hexToSvPos(getActiveColor());
                      return (
                        <div style={{ position: 'absolute', left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: 'translate(-50%, -50%)', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.5), inset 0 0 1px rgba(0,0,0,0.3)', pointerEvents: 'none', backgroundColor: getActiveColor() }} />
                      );
                    })()}
                  </div>
                  <div className="relative mt-1.5 rounded cursor-pointer" style={{ height: '14px', touchAction: 'none' }} data-testid={`hue-slider-${activeGradientStop}`}
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                      setActiveColor(hueToHex(Math.round(x * 360)));
                    }}
                    onPointerDown={(e) => {
                      e.preventDefault();
                      const el = e.currentTarget;
                      el.setPointerCapture(e.pointerId);
                      const rect = el.getBoundingClientRect();
                      const update = (ev: PointerEvent) => {
                        const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                        setActiveColor(hueToHex(Math.round(x * 360)));
                      };
                      update(e.nativeEvent);
                      const onMove = (ev: PointerEvent) => update(ev);
                      const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                      window.addEventListener('pointermove', onMove);
                      window.addEventListener('pointerup', onUp);
                    }}>
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)', borderRadius: '3px' }} />
                    <div style={{ position: 'absolute', top: '-1px', left: `${(hexToHue(getActiveColor()) / 360) * 100}%`, transform: 'translateX(-50%)', width: '4px', height: '16px', background: 'white', borderRadius: '2px', boxShadow: '0 0 3px rgba(0,0,0,0.5)', border: '1px solid rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <input type="color" value={getActiveColor()} onChange={(e) => setActiveColor(e.target.value)} className="w-5 h-5 rounded border border-white/30 cursor-pointer shrink-0" style={{ padding: 0, background: 'transparent', WebkitAppearance: 'none', appearance: 'none' }} data-testid={`input-edit-color-${activeGradientStop}`} />
                    <input type="text" value={getActiveColor().toUpperCase()} onChange={(e) => { let v = e.target.value; if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setActiveColor(v); }} className="flex-1 bg-black/40 border border-white/20 rounded text-white text-[9px] px-1.5 py-0.5 font-mono" style={{ minWidth: 0 }} data-testid={`input-hex-${activeGradientStop}`} />
                  </div>
                </div>
              )}
            </div>
            <div style={{ marginLeft: '12px', display: 'flex', gap: '6px', alignItems: 'flex-start', marginTop: '2px' }}>
              {([
                { key: 'border' as const, label: 'Border', field: 'borderColor' as const },
                { key: 'rowBg' as const, label: 'Row BG', field: 'courseRowColor' as const },
                { key: 'taskBg' as const, label: 'Task BG', field: 'taskBgColor' as const },
              ]).map(({ key, label, field }) => {
                const val = edit[field] || edit.labelStart;
                const hexVal = (() => { const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) return `#${parseInt(m[1]).toString(16).padStart(2,'0')}${parseInt(m[2]).toString(16).padStart(2,'0')}${parseInt(m[3]).toString(16).padStart(2,'0')}`; return val.startsWith('#') ? val : '#6b7280'; })();
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <label className="text-white text-[9px] mb-1">{label}</label>
                    <div
                      className="rounded-sm border cursor-pointer"
                      style={{ width: '20px', height: '20px', backgroundColor: hexVal, borderColor: activeSwatchPicker === key ? '#ffffff' : 'rgba(255,255,255,0.3)', borderWidth: activeSwatchPicker === key ? '2px' : '1px' }}
                      onClick={() => { setActiveSwatchPicker(activeSwatchPicker === key ? null : key); setActiveGradientStop(null); }}
                      data-testid={`input-${field}-swatch`}
                    />
                    <input type="text" value={edit[field]} onChange={e => setEdit({ ...edit, [field]: e.target.value })} className="bg-black/40 border border-white/20 rounded text-white text-[8px] px-1 py-0.5 font-mono mt-1 text-center" style={{ width: '56px' }} data-testid={`input-${field}`} />
                  </div>
                );
              })}
            </div>
            </div>
          </div>
          {activeSwatchPicker && (() => {
            const fieldMap = { border: 'borderColor' as const, rowBg: 'courseRowColor' as const, taskBg: 'taskBgColor' as const };
            const labelMap = { border: 'Border', rowBg: 'Row BG', taskBg: 'Task BG' };
            const field = fieldMap[activeSwatchPicker];
            const val = edit[field] || edit.labelStart;
            const hexVal = (() => { const m = val.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/); if (m) return `#${parseInt(m[1]).toString(16).padStart(2,'0')}${parseInt(m[2]).toString(16).padStart(2,'0')}${parseInt(m[3]).toString(16).padStart(2,'0')}`; return val.startsWith('#') ? val : '#6b7280'; })();
            const setSwatchColor = (hex: string) => setEdit({ ...edit, [field]: hex });
            return (
              <div className="rounded" style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(0,0,0,0.4)', padding: '6px' }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded border border-white/30 shrink-0" style={{ backgroundColor: hexVal }} />
                  <span className="text-white/60 text-[8px] uppercase tracking-wider">{labelMap[activeSwatchPicker]} Colour</span>
                  <button className="ml-auto text-white/40 hover:text-white" onClick={() => setActiveSwatchPicker(null)} data-testid="button-close-swatch-picker"><X className="w-3 h-3" /></button>
                </div>
                <div className="relative rounded overflow-hidden cursor-crosshair" style={{ height: '80px', touchAction: 'none' }} data-testid={`swatch-color-area-${activeSwatchPicker}`}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const el = e.currentTarget;
                    el.setPointerCapture(e.pointerId);
                    const rect = el.getBoundingClientRect();
                    const hue = hexToHue(hexVal);
                    const update = (ev: PointerEvent) => {
                      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                      const y = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
                      setSwatchColor(svToHex(hue, x, y));
                    };
                    update(e.nativeEvent);
                    const onMove = (ev: PointerEvent) => update(ev);
                    const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  }}>
                  <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(to right, white, hsl(${hexToHue(hexVal)}, 100%, 50%))` }} />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent, black)' }} />
                  {(() => {
                    const pos = hexToSvPos(hexVal);
                    return (
                      <div style={{ position: 'absolute', left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, transform: 'translate(-50%, -50%)', width: '12px', height: '12px', borderRadius: '50%', border: '2px solid white', boxShadow: '0 0 3px rgba(0,0,0,0.5), inset 0 0 1px rgba(0,0,0,0.3)', pointerEvents: 'none', backgroundColor: hexVal }} />
                    );
                  })()}
                </div>
                <div className="relative mt-1.5 rounded cursor-pointer" style={{ height: '14px', touchAction: 'none' }} data-testid={`swatch-hue-slider-${activeSwatchPicker}`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                    setSwatchColor(hueToHex(Math.round(x * 360)));
                  }}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    const el = e.currentTarget;
                    el.setPointerCapture(e.pointerId);
                    const rect = el.getBoundingClientRect();
                    const onMove = (ev: PointerEvent) => {
                      const x = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
                      setSwatchColor(hueToHex(Math.round(x * 360)));
                    };
                    onMove(e.nativeEvent);
                    const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
                    window.addEventListener('pointermove', onMove);
                    window.addEventListener('pointerup', onUp);
                  }}>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)', borderRadius: '3px' }} />
                  <div style={{ position: 'absolute', top: '-1px', left: `${(hexToHue(hexVal) / 360) * 100}%`, transform: 'translateX(-50%)', width: '4px', height: '16px', background: 'white', borderRadius: '2px', boxShadow: '0 0 3px rgba(0,0,0,0.5)', border: '1px solid rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <input type="text" value={hexVal.toUpperCase()} onChange={(e) => { let v = e.target.value; if (!v.startsWith('#')) v = '#' + v; if (/^#[0-9A-Fa-f]{6}$/.test(v)) setSwatchColor(v); }} className="flex-1 bg-black/40 border border-white/20 rounded text-white text-[9px] px-1.5 py-0.5 font-mono" style={{ minWidth: 0 }} data-testid={`swatch-hex-${activeSwatchPicker}`} />
                </div>
              </div>
            );
          })()}

          <div>
            <div className="text-white/60 text-[9px] uppercase tracking-wider mb-2">Cell Background</div>
            <input type="text" value={edit.cellBg} onChange={e => setEdit({ ...edit, cellBg: e.target.value })} className="w-full bg-black/40 text-white text-[11px] rounded px-2 py-1 border border-white/20 focus:outline-none focus:border-white/40 font-mono" data-testid="input-cell-bg" />
          </div>

          <div className="flex items-center justify-between gap-2 pt-2">
            <button
              className="text-white/50 hover:text-white text-[10px] flex items-center gap-1"
              onClick={() => { setEdit(DEFAULTS); setActiveGradientStop(null); }}
              data-testid="button-reset-defaults"
            >
              <RotateCcw className="w-3 h-3" /> Reset to defaults
            </button>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 text-[10px] text-white/70 hover:text-white rounded border border-white/20 hover:border-white/40" onClick={() => { if (onPreview) onPreview(originalColorsRef.current); onClose(); }} data-testid="button-cancel-other-edit">Cancel</button>
              <button className="px-3 py-1.5 text-[10px] text-white bg-white/20 hover:bg-white/30 rounded border border-white/30" onClick={() => { onSave(edit); onClose(); }} data-testid="button-save-other-edit">Save</button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

