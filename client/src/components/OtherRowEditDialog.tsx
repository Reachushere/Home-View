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
  cellBg: 'rgba(107, 114, 128, 0.30)',
  borderColor: 'rgba(107, 114, 128, 0.7)',
  taskBgColor: 'rgba(107, 114, 128, 0.25)',
  courseRowColor: 'rgba(107, 114, 128, 0.30)',
};

interface Props {
  open: boolean;
  onClose: () => void;
  colors: OtherRowColors;
  onSave: (colors: OtherRowColors) => void;
}

export default function OtherRowEditDialog({ open, onClose, colors, onSave }: Props) {
  const [edit, setEdit] = useState<OtherRowColors>(colors);
  const [activeGradientStop, setActiveGradientStop] = useState<'start' | 'end' | number | null>(null);
  const [dialogPos, setDialogPos] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ x: number; y: number; mx: number; my: number } | null>(null);

  useEffect(() => {
    if (open) setEdit(colors);
  }, [open, colors]);

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

  const headerGradient = `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${edit.labelStart}cc 40%, ${edit.labelEnd}bb 100%)`;

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center" onClick={onClose} data-testid="other-row-edit-overlay">
      <div className="absolute inset-0 bg-black/40" />
      <div
        ref={dialogRef}
        className="relative rounded-lg overflow-hidden"
        style={{
          width: '360px',
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
              OTHER Row — Appearance
            </h2>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white" data-testid="button-close-other-edit"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <div className="text-white/60 text-[9px] uppercase tracking-wider mb-2">Label Gradient</div>
            <div className="flex items-end justify-between">
              <div style={{ position: 'relative', width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <button className="text-white/40 hover:text-white text-[9px] flex items-center gap-1" onClick={() => {
                    setEdit({ ...edit, labelStart: edit.labelEnd, labelEnd: edit.labelStart, labelStops: midStops.length ? JSON.stringify(midStops.map(s => ({ ...s, position: 100 - s.position })).reverse()) : '' });
                  }} data-testid="button-reverse-gradient"><RotateCcw className="w-3 h-3" /> Reverse</button>
                  {midStops.length > 0 && (
                    <button className="text-red-400/60 hover:text-red-400 text-[9px]" onClick={() => {
                      setEdit({ ...edit, labelStops: '' });
                      setActiveGradientStop(null);
                    }} data-testid="button-clear-stops">Clear stops</button>
                  )}
                </div>
                <div
                  style={{ height: '16px', borderRadius: '4px', background: gradientCss, cursor: 'pointer', position: 'relative', border: '1px solid rgba(255,255,255,0.2)' }}
                  onDoubleClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    const newStops = [...midStops, { position: pct, color: '#888888' }].sort((a, b) => a.position - b.position);
                    setEdit({ ...edit, labelStops: JSON.stringify(newStops) });
                    setActiveGradientStop(newStops.findIndex(s => s.position === pct));
                  }}
                  data-testid="gradient-bar"
                />
                <div style={{ position: 'absolute', left: '-1px', top: '22px', cursor: 'pointer', zIndex: 10 }} onClick={() => setActiveGradientStop(activeGradientStop === 'start' ? null : 'start')} data-testid="gradient-stop-start">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={edit.labelStart} stroke={activeGradientStop === 'start' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={activeGradientStop === 'start' ? '2' : '1'} /></svg>
                </div>
                {midStops.map((stop, idx) => (
                  <div key={idx} style={{ position: 'absolute', left: `${stop.position}%`, top: '22px', cursor: 'grab', zIndex: 10, transform: 'translateX(-6px)' }}
                    onClick={() => setActiveGradientStop(activeGradientStop === idx ? null : idx)}
                    onPointerDown={(e) => {
                      const el = e.currentTarget;
                      el.setPointerCapture(e.pointerId);
                      const bar = el.parentElement!;
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
                    <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 11,6 6,12 1,6" fill={stop.color} stroke={activeGradientStop === idx ? '#ffffff' : 'rgba(255,255,255,0.5)'} strokeWidth={activeGradientStop === idx ? '2' : '1'} /></svg>
                  </div>
                ))}
                <div style={{ position: 'absolute', right: '0px', top: '22px', cursor: 'pointer', zIndex: 10 }} onClick={() => setActiveGradientStop(activeGradientStop === 'end' ? null : 'end')} data-testid="gradient-stop-end">
                  <svg width="12" height="12" viewBox="0 0 12 12"><polygon points="6,0 12,10 0,10" fill={edit.labelEnd} stroke={activeGradientStop === 'end' ? '#ffffff' : 'rgba(255,255,255,0.4)'} strokeWidth={activeGradientStop === 'end' ? '2' : '1'} /></svg>
                </div>
                {midStops.length > 0 && <span className="text-white text-[9px] absolute" style={{ bottom: '-23px', left: '0px' }}>Double-click bar to add · drag to move</span>}
              </div>
            </div>
            {midStops.length === 0 && <div className="text-white text-[11px] text-left" style={{ marginTop: '7px', marginBottom: '10px' }}>Double-click gradient bar to add a colour stop</div>}
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
                <ColorPicker color={getActiveColor()} onChange={setActiveColor} hexToHue={hexToHue} hueToHex={hueToHex} hexToSvPos={hexToSvPos} svToHex={svToHex} />
              </div>
            )}
          </div>

          <div>
            <div className="text-white/60 text-[9px] uppercase tracking-wider mb-2">Cell Background</div>
            <input type="text" value={edit.cellBg} onChange={e => setEdit({ ...edit, cellBg: e.target.value })} className="w-full bg-white/10 text-white text-[11px] rounded px-2 py-1 border border-white/20 focus:outline-none focus:border-white/40" data-testid="input-cell-bg" />
          </div>

          <div>
            <div className="text-white/60 text-[9px] uppercase tracking-wider mb-2">Border Colour</div>
            <input type="text" value={edit.borderColor} onChange={e => setEdit({ ...edit, borderColor: e.target.value })} className="w-full bg-white/10 text-white text-[11px] rounded px-2 py-1 border border-white/20 focus:outline-none focus:border-white/40" data-testid="input-border-color" />
          </div>

          <div>
            <div className="text-white/60 text-[9px] uppercase tracking-wider mb-2">Task Background</div>
            <input type="text" value={edit.taskBgColor} onChange={e => setEdit({ ...edit, taskBgColor: e.target.value })} className="w-full bg-white/10 text-white text-[11px] rounded px-2 py-1 border border-white/20 focus:outline-none focus:border-white/40" data-testid="input-task-bg" />
          </div>

          <div>
            <div className="text-white/60 text-[9px] uppercase tracking-wider mb-2">Homework Row Colour</div>
            <input type="text" value={edit.courseRowColor} onChange={e => setEdit({ ...edit, courseRowColor: e.target.value })} className="w-full bg-white/10 text-white text-[11px] rounded px-2 py-1 border border-white/20 focus:outline-none focus:border-white/40" data-testid="input-course-row-color" />
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
              <button className="px-3 py-1.5 text-[10px] text-white/70 hover:text-white rounded border border-white/20 hover:border-white/40" onClick={onClose} data-testid="button-cancel-other-edit">Cancel</button>
              <button className="px-3 py-1.5 text-[10px] text-white bg-white/20 hover:bg-white/30 rounded border border-white/30" onClick={() => { onSave(edit); onClose(); }} data-testid="button-save-other-edit">Save</button>
            </div>
          </div>

          <div className="mt-3 rounded overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.15)' }}>
            <div className="text-white/60 text-[9px] uppercase tracking-wider px-2 py-1 bg-white/5">Preview</div>
            <div className="flex" style={{ height: '36px' }}>
              <div className="flex items-center justify-center text-[8px] font-[785] text-white/80" style={{ width: '59px', background: `linear-gradient(180deg, ${allStops.map(s => `${s.color} ${s.position}%`).join(', ')})`, borderBottom: `1px dotted ${edit.borderColor}` }}>OTHER</div>
              <div className="flex-1 flex items-center gap-1 px-2" style={{ background: edit.cellBg, borderBottom: `1.5px dotted ${edit.borderColor}` }}>
                <div className="text-[9px] px-1 py-0.5 rounded border truncate" style={{ background: edit.taskBgColor, borderColor: edit.borderColor }}>Sample task</div>
              </div>
            </div>
            <div className="flex items-center gap-1 px-2" style={{ height: '24px', background: edit.courseRowColor, borderTop: `1.5px dotted ${edit.borderColor}` }}>
              <span className="text-[8px] font-[785] uppercase tracking-wide" style={{ color: '#000' }}>Other</span>
              <span className="text-[8px]" style={{ color: '#000' }}>• Homework row</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColorPicker({ color, onChange, hexToHue, hueToHex, hexToSvPos, svToHex }: {
  color: string;
  onChange: (hex: string) => void;
  hexToHue: (c: string) => number;
  hueToHex: (h: number) => string;
  hexToSvPos: (hex: string) => { x: number; y: number };
  svToHex: (hue: number, sx: number, sy: number) => string;
}) {
  const svRef = useRef<HTMLDivElement>(null);
  const hue = hexToHue(color);
  const svPos = hexToSvPos(color);

  const handleSvDrag = useCallback((e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLDivElement;
    el.setPointerCapture(e.pointerId);
    const update = (ev: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      const sx = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width));
      const sy = Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height));
      onChange(svToHex(hue, sx, sy));
    };
    update(e.nativeEvent);
    const onMove = (ev: PointerEvent) => update(ev);
    const onUp = () => { el.releasePointerCapture(e.pointerId); window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [hue, onChange, svToHex]);

  return (
    <div className="space-y-2">
      <div
        ref={svRef}
        className="relative rounded cursor-crosshair"
        style={{ width: '100%', height: '100px', background: `linear-gradient(to right, #fff, ${hueToHex(hue)})` }}
        onPointerDown={handleSvDrag}
      >
        <div className="absolute inset-0 rounded" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
        <div className="absolute w-3 h-3 border-2 border-white rounded-full" style={{ left: `${svPos.x * 100}%`, top: `${svPos.y * 100}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 2px rgba(0,0,0,0.5)' }} />
      </div>
      <input
        type="range"
        min={0}
        max={360}
        value={hue}
        onChange={(e) => {
          const newHue = Number(e.target.value);
          onChange(svToHex(newHue, svPos.x, svPos.y));
        }}
        className="w-full h-2 rounded appearance-none cursor-pointer"
        style={{ background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)' }}
        data-testid="hue-slider"
      />
      <div className="flex items-center gap-2">
        <input type="text" value={color} onChange={e => { if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value); }} className="bg-white/10 text-white text-[10px] rounded px-2 py-1 border border-white/20 w-20 focus:outline-none" data-testid="hex-input" />
      </div>
    </div>
  );
}
