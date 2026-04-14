import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, ChevronDown, BookOpen, ZoomIn, ZoomOut, Search, Bookmark, MessageSquare, Highlighter, Trash2, Download, Save, Check, Share2, Copy, Link2, Printer, Volume2, Square, Pause, Play, RefreshCw, Pencil, FileText, Minus, Loader2, ListOrdered, RotateCcw, StickyNote, Clock, ArrowLeft, Upload } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAccessMode } from '@/components/access-gate';
import shelfBgImage from '@assets/Bookshelf10_1776107329434.jpg';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

const textLayerCSS = `
.textLayer {
  position: absolute;
  text-align: initial;
  inset: 0;
  overflow: hidden;
  opacity: 1;
  line-height: 1.0;
  -webkit-text-size-adjust: none;
  text-size-adjust: none;
  forced-color-adjust: none;
  z-index: 2;
}
.textLayer :is(span, br) {
  color: transparent;
  position: absolute;
  white-space: pre;
  cursor: text;
  transform-origin: 0% 0%;
}
.textLayer span::selection {
  background: rgba(0, 100, 255, 0.3);
}
.textLayer span::-moz-selection {
  background: rgba(0, 100, 255, 0.3);
}
.textLayer span.search-highlight {
  background: rgba(255, 255, 0, 0.45) !important;
  border-radius: 2px;
}
.textLayer span mark.search-mark {
  background: rgba(255, 200, 0, 0.55);
  color: inherit;
  border-radius: 2px;
  padding: 0 1px;
  box-shadow: 0 0 0 1px rgba(255, 200, 0, 0.3);
}
.textLayer .endOfContent {
  display: block;
  position: absolute;
  inset: 100% 0 0;
  z-index: -1;
  cursor: default;
  user-select: none;
}
.book-spread {
  transform-style: preserve-3d;
  transition: none;
}
.book-page {
  background: #fff;
  border-radius: 2px;
}
.book-page-left {
  border-right: none;
  border-radius: 4px 0 0 4px;
}
.book-page-right {
  border-left: none;
  border-radius: 0 4px 4px 0;
}
@keyframes flipForward {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(-15deg); }
  100% { transform: rotateY(0deg); }
}
@keyframes flipBackward {
  0% { transform: rotateY(0deg); }
  50% { transform: rotateY(15deg); }
  100% { transform: rotateY(0deg); }
}
.flip-forward {
  animation: flipForward 0.4s ease-in-out;
}
.flip-backward {
  animation: flipBackward 0.4s ease-in-out;
}
`;

interface FileRecord {
  id: number;
  originalName: string;
  displayName: string;
  objectPath: string;
  folder: string | null;
  listened: boolean;
  contentType: string | null;
  extractedText?: string | null;
}

interface SemesterInfo {
  key: string;
  label: string;
  courses: { code: string; name: string; color: string }[];
}

interface LibraryViewProps {
  isOpen: boolean;
  onClose: () => void;
  semesters: SemesterInfo[];
  initialSemesterKey?: string;
  isSharedView?: boolean;
  onOpenNotepad?: () => void;
  courseDisplayNames?: Record<string, string>;
  initialAiSearch?: boolean;
  initialApaCheck?: boolean;
}

const WEEK_COLOR_PALETTE: Record<number, string> = {
  1: '#1a3a5c', 2: '#5D4037', 3: '#4B0082', 4: '#006064',
  5: '#2F4F4F', 6: '#BF360C', 7: '#33691E', 8: '#880E4F',
  9: '#E65100', 10: '#1A237E', 11: '#004D40', 12: '#311B92',
  13: '#8B0000', 14: '#01579B', 15: '#556B2F',
};

const SPINE_PATTERNS = [
  'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.08) 100%)',
  'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.05) 70%, transparent 100%)',
  'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.15) 100%)',
];

function getBookColor(index: number, courseCode: string, weekNum?: number): string {
  if (weekNum && WEEK_COLOR_PALETTE[weekNum]) return WEEK_COLOR_PALETTE[weekNum];
  const fallback = ['#8B4513', '#2F4F4F', '#4A0E0E', '#1a3a5c', '#3d2b1f', '#556B2F', '#4B0082', '#8B0000'];
  const hash = courseCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return fallback[(hash + index) % fallback.length];
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function truncateSpineTitle(name: string, maxLen: number = 28, isCustomName: boolean = false): string {
  const cleaned = name
    .replace(/\.(pdf|docx?|pptx?|xlsx?)$/i, '')
    .replace(isCustomName || name.trim().toLowerCase() === 'module' ? /(?!)/ : /^(Module|Reading|Lecture|Chapter|Ch|Chap)\s*[-_]?\s*/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  const titled = toTitleCase(cleaned);
  if (titled.length <= maxLen) return titled;
  return titled.substring(0, maxLen - 1) + '…';
}

function getFileType(folder: string | null): 'module' | 'reading' | null {
  if (!folder) return null;
  const fl = folder.toLowerCase();
  if (fl.includes('-module')) return 'module';
  if (fl.includes('-reading')) return 'reading';
  return null;
}

const LIB_NOTE_FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'];
const LIB_NOTE_FONT_COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function LibraryFloatingNote({ onClose }: { onClose: () => void }) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: Math.max(60, window.innerWidth / 2 - 200), y: Math.max(60, window.innerHeight / 2 - 180) });
  const [size, setSize] = useState({ w: 400, h: 360 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontColor, setShowFontColor] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const dragOff = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragOff.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
  }, [pos]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: size.w, h: size.h };
  }, [size]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const onMove = (e: MouseEvent) => {
      if (isDragging) {
        setPos({
          x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOff.current.x)),
          y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOff.current.y)),
        });
      }
      if (isResizing) {
        setSize({
          w: Math.max(280, resizeStart.current.w + (e.clientX - resizeStart.current.x)),
          h: Math.max(200, resizeStart.current.h + (e.clientY - resizeStart.current.y)),
        });
      }
    };
    const onUp = () => { setIsDragging(false); setIsResizing(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, isResizing]);

  const execCmd = useCallback((cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
  }, []);

  const insertCheckbox = useCallback(() => {
    const id = 'cb-' + Date.now();
    document.execCommand('insertHTML', false, `<label style="display:flex;align-items:center;gap:6px;margin:3px 0;cursor:pointer"><input type="checkbox" id="${id}" style="width:14px;height:14px;cursor:pointer;accent-color:#22c55e"><span contenteditable="true" style="flex:1">Task item</span></label>`);
    editorRef.current?.focus();
  }, []);

  const handleSaveToNotepad = useCallback(async () => {
    const content = editorRef.current?.innerHTML || '';
    if (!content.trim() || content === '<br>') return;
    setSaving(true);
    try {
      const res = await fetch('/api/notepad/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Library Note — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`, content, sortOrder: 999, groupName: 'Library Notes' }),
      });
      if (!res.ok) throw new Error('Failed');
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ } finally { setSaving(false); }
  }, []);

  const toolBtnStyle: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '3px 5px', borderRadius: 4,
    color: 'rgba(255,255,255,0.65)', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.15s',
  };

  return createPortal(
    <div
      data-testid="library-floating-note"
      style={{
        position: 'fixed', left: pos.x, top: pos.y, width: size.w, height: minimized ? 'auto' : size.h,
        zIndex: 100010, borderRadius: 12, overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)',
        border: '1.5px solid rgba(255,255,255,0.2)',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(145deg, #1a1208, #2d1f0e)',
        backdropFilter: 'blur(20px)',
        userSelect: isDragging ? 'none' : 'auto',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s',
      }}
    >
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '6px 10px', cursor: isDragging ? 'grabbing' : 'grab',
          background: 'linear-gradient(90deg, rgba(180,140,60,0.3), rgba(120,80,30,0.2))',
          borderBottom: '1px solid rgba(255,255,255,0.12)', flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"><line x1="2" y1="5" x2="14" y2="5"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="11" x2="14" y2="11"/></svg>
          <StickyNote size={13} style={{ color: 'rgba(212,175,55,0.7)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif" }}>Library Note</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }} style={{ ...toolBtnStyle, padding: 2 }} title={minimized ? 'Expand' : 'Minimize'} data-testid="btn-lib-note-minimize">
            <Minus style={{ width: 12, height: 12 }} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ ...toolBtnStyle, padding: 2 }} title="Close" data-testid="btn-lib-note-close">
            <X style={{ width: 12, height: 12 }} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2, padding: '4px 8px', flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', flexShrink: 0,
          }}>
            <button onClick={() => execCmd('bold')} style={toolBtnStyle} title="Bold (Ctrl+B)" data-testid="btn-lib-note-bold"><strong>B</strong></button>
            <button onClick={() => execCmd('italic')} style={toolBtnStyle} title="Italic (Ctrl+I)" data-testid="btn-lib-note-italic"><em>I</em></button>
            <button onClick={() => execCmd('underline')} style={toolBtnStyle} title="Underline (Ctrl+U)" data-testid="btn-lib-note-underline"><span style={{ textDecoration: 'underline' }}>U</span></button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
            <button onClick={() => execCmd('insertUnorderedList')} style={toolBtnStyle} title="Bullet list" data-testid="btn-lib-note-bullets">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="3" cy="4" r="1.2" fill="currentColor"/><line x1="6" y1="4" x2="14" y2="4"/><circle cx="3" cy="8" r="1.2" fill="currentColor"/><line x1="6" y1="8" x2="14" y2="8"/><circle cx="3" cy="12" r="1.2" fill="currentColor"/><line x1="6" y1="12" x2="14" y2="12"/></svg>
            </button>
            <button onClick={insertCheckbox} style={toolBtnStyle} title="Checkbox" data-testid="btn-lib-note-checkbox">
              <Check style={{ width: 13, height: 13 }} />
            </button>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)', margin: '0 2px' }} />
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowFontSize(!showFontSize); setShowFontColor(false); }} style={toolBtnStyle} title="Font size" data-testid="btn-lib-note-fontsize">
                <span style={{ fontSize: 11, fontWeight: 600 }}>A<span style={{ fontSize: 9 }}>a</span></span>
              </button>
              {showFontSize && (
                <div style={{ position: 'absolute', top: '100%', left: 0, background: '#1a1208', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 4, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 55 }}>
                  {LIB_NOTE_FONT_SIZES.map(s => (
                    <button key={s} onClick={() => { execCmd('fontSize', '7'); const els = editorRef.current?.querySelectorAll('font[size="7"]'); els?.forEach(el => { (el as HTMLElement).removeAttribute('size'); (el as HTMLElement).style.fontSize = s; }); setShowFontSize(false); }}
                      style={{ ...toolBtnStyle, fontSize: parseInt(s) > 18 ? 14 : 12, padding: '3px 8px', width: '100%', justifyContent: 'flex-start' }}
                    >{s}</button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ position: 'relative' }}>
              <button onClick={() => { setShowFontColor(!showFontColor); setShowFontSize(false); }} style={toolBtnStyle} title="Font color" data-testid="btn-lib-note-fontcolor">
                <span style={{ fontSize: 12, fontWeight: 700 }}>A</span>
                <div style={{ width: 12, height: 3, background: 'linear-gradient(90deg, #ef4444, #3b82f6, #22c55e)', borderRadius: 1, marginTop: 1 }} />
              </button>
              {showFontColor && (
                <div style={{ position: 'absolute', top: '100%', left: -20, background: '#1a1208', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, padding: 6, zIndex: 10, display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
                  {LIB_NOTE_FONT_COLORS.map(c => (
                    <button key={c} onClick={() => { execCmd('foreColor', c); setShowFontColor(false); }}
                      style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: `2px solid ${c === '#000000' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'}`, cursor: 'pointer' }}
                      data-testid={`btn-lib-note-color-${c.replace('#', '')}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div
            ref={editorRef}
            contentEditable
            data-testid="lib-note-editor"
            suppressContentEditableWarning
            onClick={() => { setShowFontSize(false); setShowFontColor(false); }}
            style={{
              flex: 1, overflow: 'auto', padding: '10px 12px',
              fontSize: 13, color: 'rgba(255,255,255,0.9)', lineHeight: 1.6,
              fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif",
              outline: 'none', minHeight: 80, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}
            onKeyDown={(e) => {
              if (e.key === 'b' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); execCmd('bold'); }
              if (e.key === 'i' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); execCmd('italic'); }
              if (e.key === 'u' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); execCmd('underline'); }
            }}
          />

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6,
            padding: '6px 10px', borderTop: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.12)', flexShrink: 0,
          }}>
            {saved && <span style={{ fontSize: 11, color: 'rgba(100,255,100,0.8)', marginRight: 'auto' }}>Saved to Notepad!</span>}
            <button
              onClick={handleSaveToNotepad}
              disabled={saving}
              data-testid="btn-lib-note-save-to-notepad"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '5px 14px',
                background: 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(180,140,40,0.2))',
                border: '1px solid rgba(212,175,55,0.35)', borderRadius: 6, cursor: 'pointer',
                color: 'rgba(255,235,180,0.9)', fontSize: 11, fontWeight: 600,
                fontFamily: "Avenir, 'Avenir Next', -apple-system, sans-serif",
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.45), rgba(180,140,40,0.35))'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(180,140,40,0.2))'; }}
            >
              <Save style={{ width: 12, height: 12 }} />
              {saving ? 'Saving…' : 'Save to Notepad'}
            </button>
          </div>
        </>
      )}

      {!minimized && (
        <div
          onMouseDown={handleResizeStart}
          style={{ position: 'absolute', right: 0, bottom: 0, width: 18, height: 18, cursor: 'nwse-resize' }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', right: 3, bottom: 3 }}>
            <path d="M9 1L1 9M9 5L5 9" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
}

function BookSpine({ file, index, courseCode, bookColor, isSelected, onClick, shelfHeight, onRename, isGroupHovered, interceptClick, layout = 'vertical', besideHorizontal, extraMarginLeft, widthReduction }: {
  file: FileRecord;
  index: number;
  courseCode: string;
  bookColor: string;
  isSelected: boolean;
  onClick: () => void;
  shelfHeight: number;
  onRename: (file: FileRecord) => void;
  isGroupHovered?: boolean;
  interceptClick?: () => void;
  layout?: 'vertical' | 'horizontal';
  besideHorizontal?: boolean;
  extraMarginLeft?: number;
  widthReduction?: number;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMouseEnter = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  }, []);
  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setIsHovered(false), 80);
  }, []);

  const seededRand = ((file.id * 2654435761) >>> 0) / 4294967296;
  const spineWidth = 28 + seededRand * 12 - (widthReduction || 0);
  const fileType = getFileType(file.folder);
  const bookHeight = fileType === 'module' ? shelfHeight - 24 + 50 : shelfHeight - 24 - (index % 3) * 6 + (besideHorizontal ? 50 : 0);
  const rawFullTitle = fileType === 'module' ? `Module ${weekNum || ''}`.trim() : (file.displayName || file.originalName).replace(/\.pdf$/i, '');
  const fullTitle = rawFullTitle;
  const title = truncateSpineTitle(rawFullTitle, 28, !!file.displayName && file.displayName !== file.originalName);
  const expandedTitle = fullTitle;
  const maxTextHeight = bookHeight - 56;
  const liftedTextHeight = maxTextHeight + 30;
  const expandedFontSize = Math.max(4, Math.min(10, Math.floor(liftedTextHeight / (expandedTitle.length * 0.85))));

  const cleanedExpanded = truncateSpineTitle(fullTitle, 80, !!file.displayName && file.displayName !== file.originalName);
  const singleLineFits = cleanedExpanded.length * 0.85 * 7 <= liftedTextHeight;
  const shouldSplitLines = !singleLineFits && cleanedExpanded.includes(' ') && spineWidth >= 28;
  const splitLines = (() => {
    if (!shouldSplitLines) return null;
    const words = cleanedExpanded.split(' ');
    const mid = Math.ceil(cleanedExpanded.length / 2);
    let bestIdx = 0;
    let bestDist = Infinity;
    let runLen = 0;
    for (let i = 0; i < words.length - 1; i++) {
      runLen += (i > 0 ? 1 : 0) + words[i].length;
      const dist = Math.abs(runLen - mid);
      if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    const line1 = words.slice(0, bestIdx + 1).join(' ');
    const line2 = words.slice(bestIdx + 1).join(' ');
    return [line1, line2] as [string, string];
  })();
  const twoLineFontSize = splitLines
    ? Math.max(5, Math.min(11, Math.floor(liftedTextHeight / (Math.max(splitLines[0].length, splitLines[1].length) * 0.85))))
    : expandedFontSize;
  const weekNum = file.folder?.match(/^week-(\d+)/)?.[1] || '';
  const patternIdx = (index + courseCode.charCodeAt(0)) % SPINE_PATTERNS.length;
  const hasTopBand = index % 4 === 1;
  const hasBottomBand = index % 5 === 2;

  const isLifted = isGroupHovered || false;
  const isHoriz = layout === 'horizontal';
  const horizBookWidth = 140;
  const horizBookHeight = spineWidth - 15;

  if (isHoriz) {
    const horizHandler = interceptClick || onClick;
    return (
      <div
        className={`book-spine-item${isHovered ? ' book-hovered' : ''}`}
        onClick={horizHandler}
        onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); horizHandler(); }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: `${horizBookWidth}px`,
          height: `${horizBookHeight}px`,
          backgroundColor: bookColor,
          backgroundImage: SPINE_PATTERNS[patternIdx],
          borderRadius: '2px 2px 4px 4px',
          cursor: 'pointer',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          flexShrink: 0,
          boxShadow: isSelected
            ? '0 0 20px rgba(212,175,55,0.6), inset 0 -2px 6px rgba(0,0,0,0.3)'
            : 'inset 0 -2px 6px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
          transition: 'box-shadow 0.3s ease',
          overflow: 'hidden',
          paddingLeft: '20px',
          paddingRight: '14px',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
        title={file.displayName || file.originalName}
        data-testid={`book-spine-${file.id}`}
      >
        <div style={{
          position: 'absolute',
          left: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
        }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          }}>R</span>
          <span style={{
            fontSize: '5px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.65)',
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
          }}>Reading</span>
        </div>
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          color: '#ffffff',
          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          flex: 1,
        }}>
          {title}
        </span>
        <div style={{
          position: 'absolute',
          right: '4px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '5px',
          height: '5px',
          backgroundColor: file.listened ? '#4CAF50' : '#e53935',
          borderRadius: '50%',
          boxShadow: file.listened ? '0 0 4px rgba(76,175,80,0.5)' : '0 0 4px rgba(229,57,53,0.5)',
          flexShrink: 0,
        }} />
      </div>
    );
  }

  const vertHandler = interceptClick || onClick;
  return (
    <div
      className={`book-spine-item${isHovered ? ' book-hovered' : ''}`}
      onClick={vertHandler}
      onTouchEnd={(e) => { e.preventDefault(); e.stopPropagation(); vertHandler(); }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        width: `${spineWidth}px`,
        minWidth: '16px',
        height: `${isLifted ? bookHeight + 30 : bookHeight}px`,
        backgroundColor: bookColor,
        backgroundImage: SPINE_PATTERNS[patternIdx],
        borderRadius: '2px 4px 4px 2px',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 1,
        boxShadow: isSelected
          ? '0 0 20px rgba(212,175,55,0.6), inset -2px 0 6px rgba(0,0,0,0.3)'
          : isLifted
          ? '0 8px 24px rgba(0,0,0,0.5), inset -2px 0 6px rgba(0,0,0,0.3), 0 0 12px rgba(212,175,55,0.3)'
          : 'inset -2px 0 6px rgba(0,0,0,0.3), 1px 0 2px rgba(0,0,0,0.2)',
        transition: 'box-shadow 0.3s ease',
        zIndex: isSelected ? 10 : isLifted ? 20 : 1,
        alignSelf: 'flex-end',
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent',
        ...(extraMarginLeft ? { marginLeft: `${extraMarginLeft}px` } : {}),
      }}
      title={file.displayName || file.originalName}
      data-testid={`book-spine-${file.id}`}
    >
      {hasTopBand && (
        <div style={{
          position: 'absolute',
          top: '22px',
          left: '3px',
          right: '3px',
          height: '2px',
          backgroundColor: '#D4AF37',
          opacity: 0.6,
        }} />
      )}
      {hasBottomBand && (
        <div style={{
          position: 'absolute',
          bottom: '24px',
          left: '3px',
          right: '3px',
          height: '2px',
          backgroundColor: '#C0C0C0',
          opacity: 0.5,
        }} />
      )}
      {fileType === 'reading' && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
        }}>
          <span style={{
            fontSize: '9px',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.85)',
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          }}>
            R
          </span>
          <span style={{
            fontSize: '5px',
            fontWeight: 600,
            color: 'rgba(255,255,255,0.65)',
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
          }}>
            Reading
          </span>
        </div>
      )}
      <span
        onClick={(e) => { e.stopPropagation(); onRename(file); }}
        style={{
          position: 'absolute',
          ...(fileType === 'module' ? { bottom: '4px' } : { top: '22px' }),
          left: '50%',
          transform: 'translateX(-50%)',
          cursor: 'pointer',
          fontSize: '8px',
          color: 'rgba(255,255,255,0.7)',
          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          zIndex: 5,
          lineHeight: 1,
        }}
        data-testid={`btn-rename-book-${file.id}`}
      >✎</span>
      {isLifted && splitLines ? (
        <div style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          display: 'flex',
          flexDirection: 'row',
          gap: '1px',
          fontSize: `${twoLineFontSize}px`,
          fontWeight: 600,
          color: '#ffffff',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
          letterSpacing: '0.3px',
          maxHeight: `${liftedTextHeight}px`,
          overflow: 'hidden',
          padding: '4px 0',
          lineHeight: 1.2,
          marginTop: '-7px',
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          transition: 'font-size 0.2s ease',
          pointerEvents: 'none',
        }}>
          <span style={{ whiteSpace: 'nowrap' }}>{splitLines[0]}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{splitLines[1]}</span>
        </div>
      ) : (
        <span style={{
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
          transform: 'rotate(180deg)',
          fontSize: fileType === 'module' ? '13px' : (isLifted ? `${expandedFontSize}px` : '10px'),
          fontWeight: 600,
          color: '#ffffff',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
          letterSpacing: '0.3px',
          maxHeight: fileType === 'module' ? 'none' : `${isLifted ? liftedTextHeight : maxTextHeight}px`,
          overflow: fileType === 'module' ? 'visible' : 'hidden',
          textOverflow: fileType === 'module' ? undefined : (isLifted ? 'clip' : 'ellipsis'),
          display: fileType === 'module' ? 'none' : undefined,
          whiteSpace: 'nowrap',
          padding: '4px 0',
          lineHeight: 1.2,
          marginTop: '-7px',
          fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
          transition: 'font-size 0.2s ease',
          pointerEvents: 'none',
        }}>
          {isLifted ? expandedTitle : title}
        </span>
      )}
      {weekNum && fileType === 'module' && (
        <div style={{
          position: 'absolute',
          top: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          lineHeight: 1,
          gap: '1px',
        }}>
          <span style={{
            fontSize: '18px',
            fontWeight: 800,
            color: 'rgba(255,255,255,0.9)',
            textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}>
            {weekNum}
          </span>
          <span style={{
            fontSize: '5px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.6)',
            textShadow: '0 1px 2px rgba(0,0,0,0.7)',
            letterSpacing: '0.2px',
            whiteSpace: 'nowrap',
            lineHeight: 1,
          }}>
            {courseCode}
          </span>
        </div>
      )}
      {weekNum && fileType !== 'module' && (
        <span style={{
          position: 'absolute',
          bottom: '4px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '14px',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 3px rgba(0,0,0,0.7)',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}>
          {weekNum}
        </span>
      )}
      <div style={{
        position: 'absolute',
        bottom: (weekNum && fileType !== 'module') ? '22px' : '6px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '6px',
        height: '6px',
        backgroundColor: file.listened ? '#4CAF50' : '#e53935',
        borderRadius: '50%',
        boxShadow: file.listened ? '0 0 4px rgba(76,175,80,0.5)' : '0 0 4px rgba(229,57,53,0.5)',
      }} />
    </div>
  );
}

function WeekSeparator({ weekNum }: { weekNum: number }) {
  return (
    <div style={{
      width: '14px',
      height: 'calc(100% + 30px)',
      flexShrink: 0,
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'flex-end',
    }}>
      <div style={{
        width: '6px',
        height: '100%',
        background: 'linear-gradient(90deg, #003670 0%, #004C9B 40%, #005BB5 60%, #004C9B 80%, #003670 100%)',
        borderRadius: '2px',
        position: 'relative',
        boxShadow: 'inset 1px 0 3px rgba(255,255,255,0.15), inset -1px 0 3px rgba(0,0,0,0.3), 0 0 4px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '4px',
          height: '2px',
          background: '#FDDC00',
          opacity: 0.6,
          borderRadius: '1px',
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '5px',
          fontWeight: 700,
          color: '#FDDC00',
          opacity: 0.7,
          letterSpacing: '-0.5px',
          whiteSpace: 'nowrap',
          writingMode: 'vertical-rl',
          textOrientation: 'mixed',
        }}>{weekNum}</div>
        <div style={{
          position: 'absolute',
          bottom: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '4px',
          height: '2px',
          background: '#FDDC00',
          opacity: 0.6,
          borderRadius: '1px',
        }} />
      </div>
    </div>
  );
}

function WeekGroupWrapper({ weekNum, showSeparator, shelfHeight, shelfIndex, totalShelves, children, moduleFile, onOpenModule }: {
  weekNum: number;
  showSeparator: boolean;
  shelfHeight: number;
  shelfIndex: number;
  totalShelves: number;
  children: React.ReactNode;
  moduleFile?: FileRecord | null;
  onOpenModule?: (file: FileRecord) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);

  const isTopShelf = shelfIndex === 0;

  const separateChildren = (childrenToSplit: React.ReactNode) => {
    const modules: React.ReactElement[] = [];
    const readings: React.ReactElement[] = [];
    const others: React.ReactElement[] = [];
    React.Children.forEach(childrenToSplit, child => {
      if (React.isValidElement(child)) {
        const folder = (child.props as any)?.file?.folder || '';
        const fl = folder.toLowerCase();
        if (fl.includes('-reading')) readings.push(child as React.ReactElement);
        else if (fl.includes('-module')) modules.push(child as React.ReactElement);
        else others.push(child as React.ReactElement);
      }
    });
    return { modules, readings, others };
  };

  const cloneWithProps = (child: React.ReactElement, expanded: boolean, layoutOverride?: string) => {
    const origOnClick = (child as React.ReactElement<any>).props.onClick;
    const isReadingFile = layoutOverride === 'horizontal' || ((child.props as any)?.file?.folder || '').toLowerCase().includes('-reading');
    const extraProps: any = {
      isGroupHovered: expanded,
      interceptClick: isReadingFile
        ? () => { if (origOnClick) origOnClick(); if (expanded) setIsExpanded(false); }
        : expanded
          ? () => { if (origOnClick) origOnClick(); setIsExpanded(false); }
          : () => setIsExpanded(true),
    };
    if (layoutOverride) extraProps.layout = layoutOverride;
    return React.cloneElement(child as React.ReactElement<any>, extraProps);
  };

  const renderShelfLayout = (expanded: boolean) => {
    const { modules, readings, others } = separateChildren(children);
    const hasReadings = readings.length > 0;
    const moduleElements = [...modules, ...others].map(c => {
      const el = cloneWithProps(c, expanded);
      if (hasReadings && !expanded) {
        return React.cloneElement(el, { besideHorizontal: true });
      }
      return el;
    });
    const readingElements = readings.map(c => cloneWithProps(c, expanded, 'horizontal'));

    return (
      <>
        {moduleElements}
        {readingElements.length > 0 && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            gap: '2px',
            alignSelf: 'flex-end',
            marginLeft: '1px',
            position: 'relative',
            zIndex: 0,
            flexShrink: 0,
            overflow: 'visible',
          }}>
            {readingElements}
          </div>
        )}
      </>
    );
  };

  const slideDirection = isTopShelf ? 'Down' : 'Up';

  return (
    <>
      <div
        ref={groupRef}
        onClick={() => setIsExpanded(true)}
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '2px',
          flexShrink: 1,
          minWidth: 0,
          position: 'relative',
          cursor: 'pointer',
          ...(isTopShelf ? { marginLeft: '-1px' } : {}),
        }}
      >
        {renderShelfLayout(false)}
      </div>
      {isExpanded && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)',
            animation: 'weekOverlayFadeIn 0.25s ease-out',
            pointerEvents: 'auto',
          }}
          onClick={() => setIsExpanded(false)}
          data-testid={`week-overlay-${weekNum}`}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              animation: `weekBooksSlide${slideDirection} 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
            }}
          >
            <div style={{ marginBottom: '16px' }} />
            <div style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '6px',
              transform: 'scale(2)',
              transformOrigin: 'bottom center',
              padding: '0 20px',
            }}>
              {renderShelfLayout(true)}
            </div>
            <div style={{
              width: '100%',
              maxWidth: '90vw',
              marginTop: '0px',
            }}>
              <div className="shelf-wood" style={{
                height: '14px',
                borderRadius: '0 0 4px 4px',
                width: '100%',
              }} />
              <div className="shelf-front" style={{
                height: '18px',
                borderRadius: '0 0 6px 6px',
                marginTop: '-1px',
                width: '100%',
              }} />
            </div>
            <div style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '20px',
              letterSpacing: '0.5px',
            }}>
              Click a book to open
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function Bookend({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{
      flexShrink: 0,
      alignSelf: 'flex-end',
      position: 'relative',
      width: '18px',
      height: '100%',
    }}>
      <div style={{
        width: '18px',
        height: 'calc(100% + 22px)',
        position: 'absolute',
        bottom: '3px',
        left: 0,
        background: side === 'left'
          ? 'linear-gradient(90deg, #005BB5 0%, #004C9B 15%, #003F87 40%, #003670 70%, #002D5C 100%)'
          : 'linear-gradient(90deg, #002D5C 0%, #003670 30%, #003F87 60%, #004C9B 85%, #005BB5 100%)',
        borderRadius: side === 'left' ? '4px 1px 0 0' : '1px 4px 0 0',
        boxShadow: side === 'left'
          ? 'inset 3px 0 8px rgba(255,255,255,0.15), -3px 0 10px rgba(0,0,0,0.4)'
          : 'inset -3px 0 8px rgba(255,255,255,0.15), 3px 0 10px rgba(0,0,0,0.4)',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        zIndex: 5,
      }}>
        <div style={{
          position: 'absolute',
          top: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '10px',
          height: '2px',
          background: '#FDDC00',
          opacity: 0.5,
          borderRadius: '1px',
        }} />
        <div style={{
          position: 'absolute',
          top: '15%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '8px',
          height: '70%',
          background: 'linear-gradient(180deg, #FDDC00 0%, #C4A800 50%, #FDDC00 100%)',
          borderRadius: '2px',
          opacity: 0.35,
        }} />
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(45deg)',
          width: '7px',
          height: '7px',
          border: '1px solid rgba(253,220,0,0.5)',
          borderRadius: '1px',
          opacity: 0.6,
        }} />
        <div style={{
          position: 'absolute',
          bottom: '10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '10px',
          height: '2px',
          background: '#FDDC00',
          opacity: 0.5,
          borderRadius: '1px',
        }} />
      </div>
      <div style={{
        width: '110px',
        height: '3px',
        background: side === 'left'
          ? 'linear-gradient(90deg, #005BB5, #003F87 40%, #002D5C 80%, transparent)'
          : 'linear-gradient(90deg, transparent, #002D5C 20%, #003F87 60%, #005BB5)',
        position: 'absolute',
        bottom: '0px',
        [side]: 0,
        zIndex: 0,
      }} />
    </div>
  );
}

interface Annotation {
  id: number;
  fileId: number;
  page: number;
  type: string;
  content: string | null;
  color: string | null;
  rects: string | null;
  createdAt: string | null;
}

const HIGHLIGHT_COLORS = ['#FFEB3B', '#4CAF50', '#2196F3', '#FF9800', '#E91E63'];

const toolBtnStyle = (active?: boolean): React.CSSProperties => ({
  background: active ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.12)',
  border: active ? '1px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.25)',
  borderRadius: '4px',
  padding: '4px 6px',
  cursor: 'pointer',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
});

interface ParsedQuery {
  phrases: string[];
  required: string[];
  optional: string[];
  allHighlightTokens: string[];
}

function parseSearchQuery(raw: string): ParsedQuery {
  const phrases: string[] = [];
  const required: string[] = [];
  const optional: string[] = [];

  let remaining = raw;
  const phraseRegex = /"([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = phraseRegex.exec(raw)) !== null) {
    const phrase = m[1].trim().toLowerCase();
    if (phrase.length >= 2) phrases.push(phrase);
  }
  remaining = remaining.replace(/"[^"]*"/g, ' ');

  const parts = remaining.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    if (p.startsWith('+') && p.length > 1) {
      required.push(p.slice(1).toLowerCase());
    } else if (p.length >= 2) {
      optional.push(p.toLowerCase());
    }
  }

  const allHighlightTokens: string[] = [];
  for (const ph of phrases) {
    allHighlightTokens.push(ph);
    ph.split(/\s+/).forEach(w => { if (w.length >= 2 && !allHighlightTokens.includes(w)) allHighlightTokens.push(w); });
  }
  for (const r of required) { if (!allHighlightTokens.includes(r)) allHighlightTokens.push(r); }
  for (const o of optional) { if (!allHighlightTokens.includes(o)) allHighlightTokens.push(o); }

  return { phrases, required, optional, allHighlightTokens };
}

function textMatchesParsedQuery(text: string, pq: ParsedQuery): boolean {
  const lower = text.toLowerCase();
  for (const ph of pq.phrases) {
    if (!lower.includes(ph)) return false;
  }
  for (const r of pq.required) {
    if (!lower.includes(r)) return false;
  }
  if (pq.optional.length > 0 && pq.phrases.length === 0 && pq.required.length === 0) {
    return pq.optional.some(o => lower.includes(o));
  }
  return pq.phrases.length > 0 || pq.required.length > 0 || pq.optional.some(o => lower.includes(o));
}

function BookReader({ file, bookColor, onClose, onMinimize, pdfUrl, moduleFiles, onOpenModuleFile, isSyllabus, onBringToFront, readerIndex, initialSearchQuery, initialPage, onOpenSyllabus, courseCode: readerCourseCode, onBackToSyllabus }: {
  file: FileRecord;
  bookColor: string;
  onClose: () => void;
  onMinimize?: () => void;
  pdfUrl?: string;
  moduleFiles?: { weekNum: number; file: FileRecord; color: string }[];
  onOpenModuleFile?: (file: FileRecord, color: string) => void;
  isSyllabus?: boolean;
  onBringToFront?: () => void;
  readerIndex?: number;
  initialSearchQuery?: string;
  initialPage?: number;
  onOpenSyllabus?: (courseCode: string) => void;
  courseCode?: string;
  onBackToSyllabus?: () => void;
}) {
  const [phase, setPhase] = useState<'pull' | 'expand' | 'reading'>('pull');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [useNativeViewer, setUseNativeViewer] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ page: number; matches: number }[]>([]);
  const [searchCurrentIdx, setSearchCurrentIdx] = useState(0);
  const [searchMatchIdx, setSearchMatchIdx] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<'none' | 'highlight' | 'comment' | 'bookmark'>('none');
  const [saved, setSaved] = useState(false);
  const initialSearchApplied = useRef(false);
  const [textLayerRenderCount, setTextLayerRenderCount] = useState(0);
  const [pendingComment, setPendingComment] = useState<{ x: number; y: number } | null>(null);
  const [pendingCommentText, setPendingCommentText] = useState('');
  const [expandedCommentId, setExpandedCommentId] = useState<number | null>(null);
  const [flipDirection, setFlipDirection] = useState<'none' | 'forward' | 'backward'>('none');
  const [showModuleIndex, setShowModuleIndex] = useState(!!isSyllabus);
  const [ttsPlaying, setTtsPlaying] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const ttsUtterRef = useRef<SpeechSynthesisUtterance | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRightRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const textLayerRightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pendingCommentInputRef = useRef<HTMLInputElement>(null);
  const [readerPos, setReaderPos] = useState<{ x: number; y: number } | null>(null);
  const readerDragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const [readerWidth, setReaderWidth] = useState<number | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number; side: 'left' | 'right'; startPosX: number } | null>(null);
  const rawTitle = (file.displayName || file.originalName).replace(/\.pdf$/i, '');
  const title = truncateSpineTitle(rawTitle, 80, !!file.displayName && file.displayName !== file.originalName);

  const { data: annotations = [], refetch: refetchAnnotations } = useQuery<Annotation[]>({
    queryKey: ['/api/files', file.id, 'annotations'],
    queryFn: () => fetch(`/api/files/${file.id}/annotations`).then(r => r.json()),
    enabled: phase === 'reading',
  });

  const bookmarks = useMemo(() => annotations.filter(a => a.type === 'bookmark'), [annotations]);
  const comments = useMemo(() => annotations.filter(a => a.type === 'comment'), [annotations]);
  const highlights = useMemo(() => annotations.filter(a => a.type === 'highlight'), [annotations]);
  const pageBookmarked = useMemo(() => bookmarks.some(b => b.page === currentPage), [bookmarks, currentPage]);
  const pageComments = useMemo(() => comments.filter(c => c.page === currentPage), [comments, currentPage]);
  const pageHighlights = useMemo(() => highlights.filter(h => h.page === currentPage), [highlights, currentPage]);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('expand'), 600);
    const t2 = setTimeout(() => setPhase('reading'), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchUrl = pdfUrl || `/api/files/${file.id}/download`;
    fetch(fetchUrl)
      .then(r => {
        if (!r.ok) throw new Error(`Server returned ${r.status}`);
        return r.arrayBuffer();
      })
      .then(data => {
        if (cancelled) return;
        if (data.byteLength < 100) throw new Error('File is empty or too small');
        return pdfjsLib.getDocument({ data }).promise;
      })
      .then(doc => {
        if (!cancelled && doc) {
          setPdfDoc(doc);
          setTotalPages(doc.numPages);
          if (initialPage && initialPage > 1 && initialPage <= doc.numPages) {
            const leftPage = initialPage % 2 === 1 ? initialPage : Math.max(1, initialPage - 1);
            setCurrentPage(leftPage);
          }
          setLoading(false);
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('PDF load error:', err);
          setErrorMsg(err?.message || 'Unknown error');
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, [file.id]);

  const rightPage = currentPage + 1 <= totalPages ? currentPage + 1 : null;
  const goToSpread = useCallback((pageNum: number) => {
    const leftPage = pageNum % 2 === 1 ? pageNum : Math.max(1, pageNum - 1);
    setCurrentPage(leftPage);
  }, []);

  const renderPageToCanvas = useCallback(async (pdfDoc: any, pageNum: number, canvas: HTMLCanvasElement, textLayer: HTMLDivElement | null, containerW: number, containerH: number) => {
    const page = await pdfDoc.getPage(pageNum);
    const ctx = canvas.getContext('2d')!;
    const halfW = (containerW / 2) - 30;
    const vp = page.getViewport({ scale: 1 });
    const scaleW = halfW / vp.width;
    const scaleH = containerH / vp.height;
    const baseScale = Math.min(scaleW, scaleH);
    let scale = baseScale * zoom;
    const MAX_CANVAS_DIM = 4096;
    const testVp = page.getViewport({ scale });
    if (testVp.width > MAX_CANVAS_DIM || testVp.height > MAX_CANVAS_DIM) {
      const downscale = Math.min(MAX_CANVAS_DIM / testVp.width, MAX_CANVAS_DIM / testVp.height);
      scale = scale * downscale;
    }
    const viewport = page.getViewport({ scale });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    try {
      await page.render({ canvasContext: ctx, viewport }).promise;
      const sampleSize = Math.min(100, canvas.width, canvas.height);
      if (sampleSize > 0) {
        const pixelData = ctx.getImageData(0, 0, sampleSize, sampleSize).data;
        let allWhite = true;
        for (let i = 0; i < pixelData.length; i += 4) {
          if (pixelData[i] !== 255 || pixelData[i+1] !== 255 || pixelData[i+2] !== 255) {
            allWhite = false;
            break;
          }
        }
        if (allWhite && pageNum === 1) {
          console.warn('[PDF] Page 1 rendered all-white, switching to native viewer');
          setUseNativeViewer(true);
        }
      }
    } catch (renderErr) {
      console.error(`[PDF] Canvas render failed for page ${pageNum}:`, renderErr);
      if (pageNum === 1) setUseNativeViewer(true);
    }
    if (textLayer) {
      textLayer.innerHTML = '';
      textLayer.setAttribute('data-rendered-page', '');
      textLayer.style.width = `${viewport.width}px`;
      textLayer.style.height = `${viewport.height}px`;
      const textContent = await page.getTextContent();
      const measureCanvas = document.createElement('canvas');
      const measureCtx = measureCanvas.getContext('2d')!;
      const frag = document.createDocumentFragment();
      const textItems = textContent.items as any[];
      for (let ti = 0; ti < textItems.length; ti++) {
        const item = textItems[ti];
        if (!item.str || !item.transform) continue;
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontHeight = Math.hypot(tx[2], tx[3]);
        const span = document.createElement('span');
        span.textContent = item.str;
        span.style.fontSize = `${fontHeight}px`;
        span.style.fontFamily = 'sans-serif';
        span.style.left = `${tx[4]}px`;
        span.style.top = `${tx[5] - fontHeight}px`;
        if (item.width > 0 && item.str.length > 0) {
          const scaledWidth = item.width * viewport.scale;
          measureCtx.font = `${fontHeight}px sans-serif`;
          const measuredWidth = measureCtx.measureText(item.str).width;
          if (measuredWidth > 0) {
            span.style.transform = `scaleX(${scaledWidth / measuredWidth})`;
          }
        }
        if (isSyllabus && moduleFiles && moduleFiles.length > 0 && onOpenModuleFile) {
          let weekNum: number | null = null;
          const weekMatch = item.str.match(/(?:week|module)\s*(\d+)/i);
          if (weekMatch) {
            weekNum = parseInt(weekMatch[1], 10);
          } else {
            const bareMatch = item.str.match(/^(module|week)\s*$/i);
            if (bareMatch) {
              for (let nj = ti + 1; nj < textItems.length && nj <= ti + 3; nj++) {
                const nextStr = (textItems[nj]?.str || '').trim();
                const numMatch = nextStr.match(/^(\d+)/);
                if (numMatch) { weekNum = parseInt(numMatch[1], 10); break; }
                if (nextStr.length > 0 && !/^\s+$/.test(nextStr)) break;
              }
            }
          }
          if (weekNum !== null) {
            const mf = moduleFiles.find(m => m.weekNum === weekNum);
            if (mf) {
              span.style.color = '#D4AF37';
              span.style.cursor = 'pointer';
              span.style.textDecoration = 'underline';
              span.style.textDecorationColor = 'rgba(212,175,55,0.5)';
              span.style.backgroundColor = 'rgba(212,175,55,0.12)';
              span.style.borderRadius = '3px';
              span.style.padding = '1px 3px';
              span.title = `Open Module ${weekNum}: ${(mf.file.displayName || mf.file.originalName).replace(/\.pdf$/i, '')}`;
              span.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                onOpenModuleFile(mf.file, mf.color);
              });
            }
          }
        }
        frag.appendChild(span);
      }
      textLayer.appendChild(frag);
      textLayer.setAttribute('data-rendered-page', String(pageNum));
    }
  }, [zoom, moduleFiles, onOpenModuleFile, isSyllabus]);

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current || phase !== 'reading') return;
    let cancelled = false;
    const container = containerRef.current;
    const containerWidth = container.clientWidth - 40;
    const containerHeight = container.clientHeight - 60;
    (async () => {
      if (cancelled) return;
      await renderPageToCanvas(pdfDoc, currentPage, canvasRef.current!, textLayerRef.current, containerWidth, containerHeight);
      if (cancelled) return;
      if (rightPage && canvasRightRef.current) {
        await renderPageToCanvas(pdfDoc, rightPage, canvasRightRef.current, textLayerRightRef.current, containerWidth, containerHeight);
      }
      if (!cancelled) setTextLayerRenderCount(c => c + 1);
    })();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, phase, zoom, rightPage, renderPageToCanvas, readerWidth]);

  const [searching, setSearching] = useState(false);
  const handleSearch = useCallback(async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const results: { page: number; matches: number }[] = [];
      const pq = parseSearchQuery(searchQuery);
      const tokens = pq.allHighlightTokens.filter(t => t.length >= 2);
      if (tokens.length === 0) { setSearchResults([]); setSearching(false); return; }
      const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const pattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
      for (let i = 1; i <= pdfDoc.numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const spans = textContent.items.map((item: any) => {
          let s = item.str || '';
          if (item.hasEOL) s += ' ';
          return s;
        });
        const pageText = spans.join('');
        if (pq.phrases.length > 0 || pq.required.length > 0) {
          if (!textMatchesParsedQuery(pageText, pq)) continue;
        }
        let count = 0;
        for (const spanText of spans) {
          if (!spanText.trim()) continue;
          const matches = spanText.match(pattern);
          if (matches) count += matches.length;
        }
        if (count > 0) results.push({ page: i, matches: count });
      }
      setSearchResults(results);
      setSearchCurrentIdx(0);
      setSearchMatchIdx(0);
      if (results.length > 0) goToSpread(results[0].page);
    } finally {
      setSearching(false);
    }
  }, [pdfDoc, searchQuery]);

  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(() => { handleSearch(); }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const applySearchHighlights = useCallback((layerDiv: HTMLDivElement | null, query: string) => {
    if (!layerDiv) return;
    const spans = layerDiv.querySelectorAll('span');
    if (!query.trim()) {
      spans.forEach(span => {
        const marks = span.querySelectorAll('mark.search-mark');
        if (marks.length > 0) span.textContent = span.textContent || '';
      });
      return;
    }
    const pq = parseSearchQuery(query);
    const tokens = pq.allHighlightTokens.filter(t => t.length >= 2);
    if (tokens.length === 0) return;
    const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const pattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
    spans.forEach(span => {
      if (span.querySelector('mark.search-mark')) return;
      const origText = span.textContent || '';
      if (!origText.trim()) return;
      pattern.lastIndex = 0;
      const html = origText.replace(pattern, '<mark class="search-mark">$1</mark>');
      if (html !== origText) span.innerHTML = html;
    });
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      [textLayerRef.current, textLayerRightRef.current].forEach(layerDiv => {
        if (!layerDiv) return;
        layerDiv.querySelectorAll('span').forEach(span => {
          const marks = span.querySelectorAll('mark.search-mark');
          if (marks.length > 0) span.textContent = span.textContent || '';
        });
      });
      return;
    }
    let cancelled = false;
    const tryApply = (attempt: number) => {
      if (cancelled || attempt > 20) return;
      const leftRenderedPage = textLayerRef.current?.getAttribute('data-rendered-page');
      const leftReady = leftRenderedPage === String(currentPage) && textLayerRef.current!.querySelectorAll('span').length > 0;
      if (!leftReady && attempt < 20) {
        setTimeout(() => tryApply(attempt + 1), 150);
        return;
      }
      applySearchHighlights(textLayerRef.current, searchQuery);
      applySearchHighlights(textLayerRightRef.current, searchQuery);

      if (searchResults.length > 0) {
        const targetPage = searchResults[searchCurrentIdx]?.page;
        const layers = [
          { el: textLayerRef.current, page: currentPage },
          { el: textLayerRightRef.current, page: currentPage + 1 },
        ];
        for (const { el, page } of layers) {
          if (!el || page !== targetPage) continue;
          const marks = el.querySelectorAll('mark.search-mark');
          marks.forEach(m => (m as HTMLElement).style.outline = 'none');
          if (searchMatchIdx < marks.length) {
            (marks[searchMatchIdx] as HTMLElement).style.outline = '2px solid #ff6600';
          }
        }
      }
    };
    tryApply(0);
    return () => { cancelled = true; };
  }, [searchQuery, currentPage, pdfDoc, zoom, applySearchHighlights, searchResults, searchCurrentIdx, searchMatchIdx, textLayerRenderCount]);

  useEffect(() => {
    if (!initialSearchQuery || !pdfDoc || initialSearchApplied.current) return;
    initialSearchApplied.current = true;
    setSearchQuery(initialSearchQuery);
    setSearchOpen(true);
    const runSearch = async () => {
      setSearching(true);
      try {
        const pq = parseSearchQuery(initialSearchQuery);
        const tokens = pq.allHighlightTokens.filter(t => t.length >= 2);
        if (tokens.length === 0) { setSearching(false); return; }
        const escapedTokens = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const pattern = new RegExp(`(${escapedTokens.join('|')})`, 'gi');
        const results: { page: number; matches: number }[] = [];
        for (let i = 1; i <= pdfDoc.numPages; i++) {
          const page = await pdfDoc.getPage(i);
          const textContent = await page.getTextContent();
          const spans = textContent.items.map((item: any) => {
            let s = item.str || '';
            if (item.hasEOL) s += ' ';
            return s;
          });
          const pageText = spans.join('');
          if (pq.phrases.length > 0 || pq.required.length > 0) {
            if (!textMatchesParsedQuery(pageText, pq)) continue;
          }
          let count = 0;
          for (const spanText of spans) {
            if (!spanText.trim()) continue;
            const matches = spanText.match(pattern);
            if (matches) count += matches.length;
          }
          if (count > 0) results.push({ page: i, matches: count });
        }
        setSearchResults(results);
        setSearchCurrentIdx(0);
        setSearchMatchIdx(0);
        if (results.length > 0) goToSpread(results[0].page);
      } finally {
        setSearching(false);
      }
    };
    runSearch();
  }, [pdfDoc, initialSearchQuery]);

  const totalMatchCount = useMemo(() => searchResults.reduce((sum, r) => sum + r.matches, 0), [searchResults]);

  const currentGlobalMatchIdx = useMemo(() => {
    let idx = 0;
    for (let i = 0; i < searchCurrentIdx && i < searchResults.length; i++) {
      idx += searchResults[i].matches;
    }
    return idx + searchMatchIdx;
  }, [searchResults, searchCurrentIdx, searchMatchIdx]);

  const navigateSearch = useCallback((dir: 1 | -1) => {
    if (searchResults.length === 0) return;
    let pageIdx = searchCurrentIdx;
    let matchInPage = searchMatchIdx;

    if (dir === 1) {
      matchInPage++;
      if (matchInPage >= searchResults[pageIdx].matches) {
        pageIdx = (pageIdx + 1) % searchResults.length;
        matchInPage = 0;
      }
    } else {
      matchInPage--;
      if (matchInPage < 0) {
        pageIdx = (pageIdx - 1 + searchResults.length) % searchResults.length;
        matchInPage = searchResults[pageIdx].matches - 1;
      }
    }

    setSearchCurrentIdx(pageIdx);
    setSearchMatchIdx(matchInPage);
    goToSpread(searchResults[pageIdx].page);

    requestAnimationFrame(() => {
      setTimeout(() => {
        const layers = [textLayerRef.current, textLayerRightRef.current];
        for (const layer of layers) {
          if (!layer) continue;
          const marks = layer.querySelectorAll('mark.search-mark');
          marks.forEach(m => (m as HTMLElement).style.outline = 'none');
          if (marks.length > 0) {
            const targetPage = searchResults[pageIdx].page;
            const isLeftPage = layer === textLayerRef.current;
            const layerPage = isLeftPage ? currentPage : currentPage + 1;
            if (layerPage === targetPage && matchInPage < marks.length) {
              const targetMark = marks[matchInPage] as HTMLElement;
              targetMark.style.outline = '2px solid #ff6600';
              targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }
      }, 400);
    });
  }, [searchResults, searchCurrentIdx, searchMatchIdx, currentPage]);

  const toggleBookmark = useCallback(async () => {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      await apiRequest('DELETE', `/api/annotations/${existing.id}`);
    } else {
      await apiRequest('POST', `/api/files/${file.id}/annotations`, { page: currentPage, type: 'bookmark' });
    }
    refetchAnnotations();
  }, [bookmarks, currentPage, file.id, refetchAnnotations]);

  const addComment = useCallback(async (text?: string, pos?: { x: number; y: number }) => {
    const content = (text || commentText).trim();
    if (!content) return;
    const rects = pos || undefined;
    await apiRequest('POST', `/api/files/${file.id}/annotations`, { page: currentPage, type: 'comment', content, rects });
    setCommentText('');
    setPendingComment(null);
    setPendingCommentText('');
    setShowAnnotations(true);
    refetchAnnotations();
  }, [commentText, currentPage, file.id, refetchAnnotations]);

  const addHighlight = useCallback(async (rectData?: any) => {
    await apiRequest('POST', `/api/files/${file.id}/annotations`, { page: currentPage, type: 'highlight', color: highlightColor, rects: rectData ? JSON.stringify(rectData) : undefined });
    refetchAnnotations();
  }, [currentPage, file.id, highlightColor, refetchAnnotations]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (activeToolPanel === 'highlight') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        const pageContainer = (e.currentTarget as HTMLElement);
        const containerRect = pageContainer.getBoundingClientRect();
        const clientRects = range.getClientRects();
        const normalizedRects: { x: number; y: number; w: number; h: number }[] = [];
        for (let i = 0; i < clientRects.length; i++) {
          const cr = clientRects[i];
          if (cr.width < 1 || cr.height < 1) continue;
          normalizedRects.push({
            x: ((cr.left - containerRect.left) / containerRect.width) * 100,
            y: ((cr.top - containerRect.top) / containerRect.height) * 100,
            w: (cr.width / containerRect.width) * 100,
            h: (cr.height / containerRect.height) * 100,
          });
        }
        if (normalizedRects.length > 0) {
          addHighlight({ type: 'rects', rects: normalizedRects });
          sel.removeAllRanges();
        }
      }
      return;
    }
    if (activeToolPanel === 'comment') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      setPendingComment({ x, y });
      setPendingCommentText('');
      setTimeout(() => pendingCommentInputRef.current?.focus(), 50);
    }
  }, [activeToolPanel, addHighlight]);

  const deleteAnnotation = useCallback(async (id: number) => {
    await apiRequest('DELETE', `/api/annotations/${id}`);
    refetchAnnotations();
  }, [refetchAnnotations]);

  const stopTts = useCallback(() => {
    window.speechSynthesis.cancel();
    ttsUtterRef.current = null;
    setTtsPlaying(false);
    setTtsPaused(false);
  }, []);

  const pauseTts = useCallback(() => {
    if (ttsPlaying && !ttsPaused) {
      window.speechSynthesis.pause();
      setTtsPaused(true);
    }
  }, [ttsPlaying, ttsPaused]);

  const resumeTts = useCallback(() => {
    if (ttsPlaying && ttsPaused) {
      window.speechSynthesis.resume();
      setTtsPaused(false);
    }
  }, [ttsPlaying, ttsPaused]);

  const startTts = useCallback(async () => {
    stopTts();
    setTtsLoading(true);
    try {
      const pagesToRead = [currentPage];
      if (rightPage && rightPage <= totalPages) pagesToRead.push(rightPage);
      let fullText = '';
      for (const pn of pagesToRead) {
        const page = await pdfDoc!.getPage(pn);
        const tc = await page.getTextContent();
        const text = tc.items.map((item: any) => {
          let s = item.str || '';
          if (item.hasEOL) s += '\n';
          return s;
        }).join('');
        fullText += text + '\n\n';
      }
      fullText = fullText.replace(/\s+/g, ' ').trim();
      if (!fullText) return;
      const utter = new SpeechSynthesisUtterance(fullText);
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.onend = () => { setTtsPlaying(false); setTtsPaused(false); ttsUtterRef.current = null; };
      utter.onerror = () => { setTtsPlaying(false); setTtsPaused(false); ttsUtterRef.current = null; };
      ttsUtterRef.current = utter;
      setTtsPlaying(true);
      setTtsPaused(false);
      window.speechSynthesis.speak(utter);
    } finally {
      setTtsLoading(false);
    }
  }, [pdfDoc, currentPage, rightPage, totalPages, stopTts]);

  useEffect(() => { return () => { window.speechSynthesis.cancel(); }; }, []);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  const defaultWidth = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.85) : 1200;
  const effectiveWidth = readerWidth || defaultWidth;
  const minReaderWidth = 480;
  const maxReaderWidth = typeof window !== 'undefined' ? window.innerWidth - 40 : 2000;

  const startResize = useCallback((e: React.MouseEvent, side: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = effectiveWidth;
    const bookEl = (e.currentTarget as HTMLElement).closest('[data-book-reader]') as HTMLElement | null;
    const currentLeft = bookEl ? bookEl.getBoundingClientRect().left : (readerPos?.x ?? Math.max(20, (window.innerWidth - effectiveWidth) / 2));
    const currentTop = bookEl ? bookEl.getBoundingClientRect().top : (readerPos?.y ?? 60);
    if (!readerPos) {
      setReaderPos({ x: currentLeft, y: currentTop });
    }
    const startPosX = currentLeft;
    resizeRef.current = { startX, startWidth, side, startPosX };
    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dx = ev.clientX - resizeRef.current.startX;
      let newWidth: number;
      let newPosX = resizeRef.current.startPosX;
      if (resizeRef.current.side === 'right') {
        newWidth = Math.max(minReaderWidth, Math.min(maxReaderWidth, resizeRef.current.startWidth + dx));
      } else {
        newWidth = Math.max(minReaderWidth, Math.min(maxReaderWidth, resizeRef.current.startWidth - dx));
        newPosX = resizeRef.current.startPosX + (resizeRef.current.startWidth - newWidth);
      }
      setReaderWidth(newWidth);
      setReaderPos(prev => prev ? { ...prev, x: newPosX } : { x: newPosX, y: currentTop });
    };
    const onUp = () => { resizeRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [effectiveWidth, readerPos, minReaderWidth, maxReaderWidth]);

  return (
    <>
      <style>{textLayerCSS}</style>
      <style>{`
        @keyframes libBookPull {
          0% { width: 40px; height: 180px; opacity: 0; transform: rotateY(80deg); }
          50% { width: 200px; height: 280px; opacity: 1; transform: rotateY(10deg); }
          100% { width: 200px; height: 280px; opacity: 1; transform: rotateY(0deg); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.5); }
          50% { box-shadow: 0 0 0 6px rgba(59,130,246,0); }
        }
      `}</style>

      <div
        data-book-reader
        onMouseDown={() => onBringToFront?.()}
        style={{
        width: phase === 'pull' ? '200px' : `${effectiveWidth}px`,
        height: phase === 'pull' ? '280px' : '84vh',
        backgroundColor: bookColor,
        borderRadius: phase === 'reading' ? '8px 16px 16px 8px' : '4px 12px 12px 4px',
        boxShadow: '0 20px 80px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,0,0,0.2)',
        position: 'fixed',
        left: readerPos ? `${readerPos.x}px` : phase === 'pull' ? `${Math.max(20, (window.innerWidth - 200) / 2)}px` : `${Math.max(20, (window.innerWidth - effectiveWidth) / 2 + (readerIndex || 0) * 30)}px`,
        top: readerPos ? `${readerPos.y}px` : phase === 'pull' ? `${Math.max(60, (window.innerHeight - 280) / 2)}px` : `${60 + (readerIndex || 0) * 30}px`,
        overflow: 'hidden',
        transition: phase === 'pull' ? 'none' : readerPos ? 'none' : 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1), height 0.6s cubic-bezier(0.4, 0, 0.2, 1), left 0.6s cubic-bezier(0.4, 0, 0.2, 1), top 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: phase === 'pull' ? 'libBookPull 0.6s ease-out forwards' : 'none',
        display: 'flex',
        flexDirection: 'column',
        perspective: '1500px',
      }}>
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: phase === 'reading' ? '24px' : '14px',
          background: `linear-gradient(90deg, ${bookColor} 0%, rgba(0,0,0,0.5) 40%, rgba(0,0,0,0.3) 60%, ${bookColor} 100%)`,
          transition: 'width 0.6s ease',
          zIndex: 2,
        }} />

        {phase !== 'reading' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '30px', zIndex: 1 }}>
            <div style={{ width: '60%', height: '2px', background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)', opacity: 0.5, marginBottom: '20px' }} />
            <div style={{ color: '#D4AF37', fontSize: phase === 'expand' ? '18px' : '13px', fontWeight: 700, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '2px', textShadow: '0 2px 4px rgba(0,0,0,0.5)', lineHeight: 1.4, maxWidth: '80%', wordBreak: 'break-word', transition: 'font-size 0.6s ease' }}>
              {title}
            </div>
            <div style={{ width: '60%', height: '2px', background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)', opacity: 0.5, marginTop: '20px' }} />
          </div>
        )}

        {phase === 'reading' && (
          <>
            <div
              style={{ padding: '8px 12px 4px 32px', zIndex: 3, flexShrink: 0, cursor: 'grab', userSelect: 'none' }}
              onMouseDown={(e) => {
                e.preventDefault();
                const rect = (e.currentTarget.closest('[style]') as HTMLElement)?.getBoundingClientRect();
                if (!rect) return;
                const startPosX = readerPos?.x ?? rect.left;
                const startPosY = readerPos?.y ?? rect.top;
                readerDragRef.current = { startX: e.clientX, startY: e.clientY, startPosX, startPosY };
                const onMove = (ev: MouseEvent) => {
                  if (!readerDragRef.current) return;
                  setReaderPos({
                    x: readerDragRef.current.startPosX + (ev.clientX - readerDragRef.current.startX),
                    y: readerDragRef.current.startPosY + (ev.clientY - readerDragRef.current.startY),
                  });
                };
                const onUp = () => { readerDragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div style={{ color: '#ffffff', fontSize: title.length > 40 ? '10px' : '12px', fontWeight: 700, letterSpacing: title.length > 40 ? '0.5px' : '1px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {title}
              </div>
            </div>
            {useNativeViewer && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '4px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 3, flexShrink: 0, gap: '4px' }}>
                <button onClick={() => { setUseNativeViewer(false); }} style={toolBtnStyle()} title="Switch to standard viewer" data-testid="btn-switch-viewer">
                  <RotateCcw size={14} />
                </button>
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
                {onMinimize && (
                  <button onClick={onMinimize} style={{ ...toolBtnStyle(), borderRadius: '50%', width: '26px', height: '26px', padding: 0 }} title="Minimize" data-testid="button-minimize-book-reader-native">
                    <Minus size={14} />
                  </button>
                )}
                <button onClick={onClose} style={{ ...toolBtnStyle(), borderRadius: '50%', width: '26px', height: '26px', padding: 0 }} title="Close" data-testid="button-close-book-reader-native">
                  <X size={14} />
                </button>
              </div>
            )}
            <div style={{ display: useNativeViewer ? 'none' : 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 12px 6px 12px', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 3, flexShrink: 0, flexWrap: 'wrap', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={toolBtnStyle()} title="Zoom Out" data-testid="btn-zoom-out">
                  <ZoomOut size={14} />
                </button>
                <span style={{ color: '#ffffff', fontSize: '10px', fontWeight: 600, minWidth: '32px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} style={toolBtnStyle()} title="Zoom In" data-testid="btn-zoom-in">
                  <ZoomIn size={14} />
                </button>
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
                <button onClick={() => { refetchAnnotations().then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }); }} style={toolBtnStyle(saved)} title="Save Changes" data-testid="btn-save-pdf">
                  {saved ? <Check size={14} /> : <Save size={14} />}
                </button>
                <button onClick={() => {
                  const printWindow = window.open(`/api/files/${file.id}/download`, '_blank');
                  if (printWindow) {
                    printWindow.addEventListener('load', () => { printWindow.print(); });
                  }
                }} style={toolBtnStyle()} title="Print PDF" data-testid="btn-print-pdf">
                  <Printer size={14} />
                </button>
                <button onClick={() => { const a = document.createElement('a'); a.href = `/api/files/${file.id}/download`; a.download = file.originalName || 'document.pdf'; a.click(); }} style={toolBtnStyle()} title="Download PDF" data-testid="btn-download-pdf">
                  <Download size={14} />
                </button>
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
                <button onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setActiveToolPanel('none'); }} style={toolBtnStyle(searchOpen)} title="Search" data-testid="btn-search">
                  <Search size={14} />
                </button>
              </div>

              {onBackToSyllabus && (
                <button
                  onClick={onBackToSyllabus}
                  style={{
                    ...toolBtnStyle(),
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 10px',
                    fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px',
                    color: '#D4AF37',
                    textTransform: 'uppercase',
                    background: 'rgba(212,175,55,0.15)',
                    border: '1px solid rgba(212,175,55,0.3)',
                  }}
                  title="Back to Syllabus"
                  data-testid="btn-back-to-syllabus"
                >
                  <ArrowLeft size={12} />
                  Syllabus
                </button>
              )}
              {!isSyllabus && !onBackToSyllabus && readerCourseCode && onOpenSyllabus && (
                <button
                  onClick={() => onOpenSyllabus(readerCourseCode)}
                  style={{
                    ...toolBtnStyle(),
                    display: 'flex', alignItems: 'center', gap: '4px',
                    padding: '3px 10px',
                    fontSize: '10px', fontWeight: 600, letterSpacing: '0.3px',
                    color: 'rgba(255,255,255,0.7)',
                    textTransform: 'uppercase',
                  }}
                  title="Open Course Syllabus"
                  data-testid="btn-open-syllabus-from-reader"
                >
                  <FileText size={12} />
                  Syllabus
                </button>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, flexWrap: 'wrap' }}>
                {activeToolPanel === 'highlight' && (
                  <>
                    <button
                      onClick={async () => { for (const h of highlights) { await apiRequest('DELETE', `/api/annotations/${h.id}`); } refetchAnnotations(); }}
                      disabled={highlights.length === 0}
                      style={{ ...toolBtnStyle(), display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 6px', fontSize: '8px', color: highlights.length > 0 ? 'rgba(255,150,150,0.9)' : 'rgba(255,255,255,0.25)', fontWeight: 600, cursor: highlights.length > 0 ? 'pointer' : 'not-allowed' }}
                      title="Clear all highlights"
                      data-testid="btn-clear-all-highlights-toolbar"
                    >
                      <Trash2 size={9} /> {highlights.length}
                    </button>
                    {HIGHLIGHT_COLORS.map(c => (
                      <button key={c} onClick={() => setHighlightColor(c)} style={{ width: '16px', height: '16px', borderRadius: '50%', background: c, border: highlightColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', transition: 'border 0.15s', flexShrink: 0 }} />
                    ))}
                  </>
                )}
                <button onClick={() => setActiveToolPanel(activeToolPanel === 'highlight' ? 'none' : 'highlight')} style={toolBtnStyle(activeToolPanel === 'highlight')} title="Highlight" data-testid="btn-highlight">
                  <Highlighter size={14} />
                </button>
                <button onClick={toggleBookmark} style={toolBtnStyle(pageBookmarked)} title={pageBookmarked ? 'Remove Bookmark' : 'Add Bookmark'} data-testid="btn-bookmark">
                  <Bookmark size={14} fill={pageBookmarked ? '#D4AF37' : 'none'} />
                </button>
                <button onClick={() => setActiveToolPanel(activeToolPanel === 'comment' ? 'none' : 'comment')} style={toolBtnStyle(activeToolPanel === 'comment')} title="Comment" data-testid="btn-comment">
                  <MessageSquare size={14} />
                </button>
                <button onClick={() => setShowAnnotations(!showAnnotations)} style={toolBtnStyle(showAnnotations)} title="View Annotations" data-testid="btn-annotations">
                  <BookOpen size={14} />
                </button>
                {isSyllabus && moduleFiles && moduleFiles.length > 0 && onOpenModuleFile && (
                  <button onClick={() => setShowModuleIndex(!showModuleIndex)} style={toolBtnStyle(showModuleIndex)} title="Module Index" data-testid="btn-module-index">
                    <ListOrdered size={14} />
                  </button>
                )}
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
                {!ttsPlaying ? (
                  <button onClick={startTts} disabled={ttsLoading || !pdfDoc} style={{ ...toolBtnStyle(), opacity: ttsLoading ? 0.5 : 1 }} title="Read aloud (current spread)" data-testid="btn-tts-play">
                    {ttsLoading ? <span style={{ fontSize: '10px' }}>...</span> : <Volume2 size={14} />}
                  </button>
                ) : (
                  <>
                    <button onClick={ttsPaused ? resumeTts : pauseTts} style={toolBtnStyle()} title={ttsPaused ? 'Resume' : 'Pause'} data-testid="btn-tts-pause">
                      {ttsPaused ? <Play size={14} /> : <Pause size={14} />}
                    </button>
                    <button onClick={stopTts} style={toolBtnStyle()} title="Stop reading" data-testid="btn-tts-stop">
                      <Square size={12} />
                    </button>
                  </>
                )}
                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />
                {onMinimize && (
                  <button onClick={onMinimize} style={{ ...toolBtnStyle(), borderRadius: '50%', width: '26px', height: '26px', padding: 0 }} title="Minimize" data-testid="button-minimize-book-reader">
                    <Minus size={14} />
                  </button>
                )}
                <button onClick={onClose} style={{ ...toolBtnStyle(), borderRadius: '50%', width: '26px', height: '26px', padding: 0 }} data-testid="button-close-book-reader">
                  <X size={14} />
                </button>
              </div>
            </div>

            {!useNativeViewer && searchOpen && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 4px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', zIndex: 3, flexShrink: 0 }}>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="Search in PDF..."
                  style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                  data-testid="input-pdf-search"
                />
                <button onClick={handleSearch} disabled={searching} style={{ ...toolBtnStyle(), opacity: searching ? 0.5 : 1 }} data-testid="btn-search-go">
                  {searching ? <span style={{ fontSize: '10px' }}>...</span> : <Search size={12} />}
                </button>
                {searching && (
                  <span style={{ color: '#ffffff', fontSize: '10px', whiteSpace: 'nowrap' }}>Searching...</span>
                )}
                {!searching && searchResults.length > 0 && (
                  <>
                    <span style={{ color: '#ffffff', fontSize: '10px', whiteSpace: 'nowrap', fontWeight: 600 }}>
                      {currentGlobalMatchIdx + 1}/{totalMatchCount}
                    </span>
                    <button onClick={() => navigateSearch(-1)} style={toolBtnStyle()} data-testid="btn-search-prev">
                      <ChevronLeft size={12} />
                    </button>
                    <button onClick={() => navigateSearch(1)} style={toolBtnStyle()} data-testid="btn-search-next">
                      <ChevronRight size={12} />
                    </button>
                  </>
                )}
                {!searching && searchResults.length === 0 && searchQuery && (
                  <span style={{ color: 'rgba(255,100,100,0.8)', fontSize: '10px' }}>No results</span>
                )}
              </div>
            )}

            {activeToolPanel === 'comment' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 4px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', zIndex: 3, flexShrink: 0 }}>
                <MessageSquare size={12} style={{ color: 'rgba(255,255,255,0.5)', flexShrink: 0 }} />
                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px' }}>Click on the page to place a comment</span>
              </div>
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {showModuleIndex && isSyllabus && moduleFiles && moduleFiles.length > 0 && onOpenModuleFile && (
                <div style={{
                  width: '180px',
                  flexShrink: 0,
                  marginLeft: '28px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRight: '1px solid rgba(255,255,255,0.1)',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '8px 0',
                }}>
                  <div style={{ padding: '4px 12px 8px', color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    Modules
                  </div>
                  {Array.from({ length: 13 }, (_, i) => i + 1).map(num => {
                    const mf = moduleFiles.find(m => m.weekNum === num);
                    return (
                      <button
                        key={num}
                        onClick={() => { if (mf) onOpenModuleFile(mf.file, mf.color); }}
                        disabled={!mf}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '6px 12px',
                          background: 'transparent',
                          border: 'none',
                          cursor: mf ? 'pointer' : 'default',
                          color: mf ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.25)',
                          fontSize: '11px',
                          fontWeight: 500,
                          textAlign: 'left',
                          transition: 'background 0.15s',
                          width: '100%',
                        }}
                        onMouseEnter={e => { if (mf) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        data-testid={`btn-module-index-${num}`}
                        title={mf ? (mf.file.displayName || mf.file.originalName).replace(/\.pdf$/i, '') : `Module ${num} — not available`}
                      >
                        <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: mf ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)', color: mf ? '#D4AF37' : 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>
                          {num}
                        </span>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          Module {num}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              <div
                ref={containerRef}
                style={{ flex: 1, margin: showModuleIndex ? '0' : '0 0 0 28px', borderRadius: '4px 0 0 4px', overflow: 'auto', background: '#3a3228', display: 'flex', flexDirection: 'column', alignItems: zoom > 1 ? 'flex-start' : 'center', justifyContent: loading || !pdfDoc ? 'center' : 'center', position: 'relative' }}
              >
                <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: useNativeViewer ? '0' : '10px', minWidth: '100%', height: useNativeViewer ? '100%' : 'auto', flex: useNativeViewer ? 1 : undefined }}>
                  {loading ? (
                    <div style={{ color: '#666', fontSize: '14px' }}>Loading PDF...</div>
                  ) : !pdfDoc ? (
                    <div style={{ color: '#c62828', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                      Failed to load PDF{errorMsg ? `: ${errorMsg}` : ''}
                    </div>
                  ) : useNativeViewer ? (
                    <iframe
                      src={pdfUrl || `/api/files/${file.id}/download`}
                      style={{ width: '100%', height: '100%', border: 'none', flex: 1 }}
                      title={file.displayName || file.originalName}
                    />
                  ) : (
                    <div className={`book-spread ${flipDirection !== 'none' ? `flip-${flipDirection}` : ''}`} style={{ display: 'flex', gap: '0px', perspective: '2000px' }} onAnimationEnd={() => setFlipDirection('none')}>
                      <div
                        className="book-page book-page-left"
                        style={{ position: 'relative', cursor: activeToolPanel === 'highlight' ? 'text' : activeToolPanel === 'comment' ? 'crosshair' : 'text', boxShadow: 'inset -8px 0 16px -6px rgba(0,0,0,0.15), 2px 2px 8px rgba(0,0,0,0.1)' }}
                        onClick={handleCanvasClick}
                        onMouseUp={activeToolPanel === 'highlight' ? handleCanvasClick : undefined}
                      >
                        <canvas ref={canvasRef} style={{ display: 'block', pointerEvents: 'none' }} />
                        <div
                          ref={textLayerRef}
                          style={{
                            pointerEvents: activeToolPanel === 'comment' ? 'none' : 'auto',
                          }}
                          className="textLayer"
                        />
                        {pageHighlights.map((h) => {
                          let parsed: any = null;
                          try { if (h.rects) parsed = JSON.parse(h.rects); } catch {}
                          if (!parsed) return null;
                          const color = h.color || '#FFEB3B';
                          if (parsed.type === 'rects' && Array.isArray(parsed.rects)) {
                            return (
                              <div key={h.id} className="highlight-group" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                {parsed.rects.map((r: { x: number; y: number; w: number; h: number }, i: number) => (
                                  <div key={i} style={{
                                    position: 'absolute',
                                    left: `${r.x}%`, top: `${r.y}%`,
                                    width: `${r.w}%`, height: `${r.h}%`,
                                    background: `${color}44`,
                                    borderRadius: '1px',
                                    pointerEvents: 'auto',
                                    cursor: 'pointer',
                                    mixBlendMode: 'multiply',
                                  }} onClick={(e) => { e.stopPropagation(); deleteAnnotation(h.id); }} title="Click to remove highlight" />
                                ))}
                              </div>
                            );
                          }
                          const pos = parsed as { x: number; y: number };
                          return (
                            <div key={h.id} style={{
                              position: 'absolute',
                              left: `${Math.min(pos.x, 92)}%`,
                              top: `${Math.min(pos.y, 95)}%`,
                              transform: 'translate(-50%, -50%)',
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: `${color}66`,
                              border: `2px solid ${color}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer',
                              boxShadow: `0 0 8px ${color}44`,
                            }}>
                              <Highlighter size={12} color={color} />
                              <button
                                onClick={(e) => { e.stopPropagation(); deleteAnnotation(h.id); }}
                                style={{
                                  position: 'absolute', top: '-6px', right: '-6px',
                                  width: '14px', height: '14px', borderRadius: '50%',
                                  background: 'rgba(0,0,0,0.7)', border: 'none',
                                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  padding: 0,
                                }}
                              >
                                <X size={8} color="#fff" />
                              </button>
                            </div>
                          );
                        })}
                        {pageComments.map((c) => {
                          let pos: { x: number; y: number } | null = null;
                          try { if (c.rects) pos = JSON.parse(c.rects); } catch {}
                          if (!pos) {
                            return (
                              <div key={c.id} style={{ position: 'absolute', bottom: '8px', right: '8px', background: 'rgba(0,0,0,0.8)', borderRadius: '6px', padding: '5px 8px', fontSize: '10px', color: '#fff', maxWidth: '200px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                <span style={{ flex: 1 }}>{c.content}</span>
                                <button onClick={(e) => { e.stopPropagation(); deleteAnnotation(c.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                                  <Trash2 size={10} color="rgba(255,255,255,0.5)" />
                                </button>
                              </div>
                            );
                          }
                          const isExpanded = expandedCommentId === c.id;
                          return (
                            <div key={c.id} style={{ position: 'absolute', left: `${Math.min(pos.x, 92)}%`, top: `${Math.min(pos.y, 95)}%`, transform: 'translate(-50%, -50%)', zIndex: isExpanded ? 5 : 2 }}>
                              <div
                                onClick={(e) => { e.stopPropagation(); setExpandedCommentId(isExpanded ? null : c.id); }}
                                style={{
                                  width: '24px', height: '24px', borderRadius: '50%',
                                  background: 'rgba(59,130,246,0.85)', border: '2px solid rgba(255,255,255,0.8)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                }}
                              >
                                <MessageSquare size={12} color="#fff" />
                              </div>
                              {isExpanded && (
                                <div style={{
                                  position: 'absolute', top: '28px', left: '50%', transform: 'translateX(-50%)',
                                  background: 'rgba(0,0,0,0.9)', borderRadius: '6px', padding: '6px 8px',
                                  minWidth: '140px', maxWidth: '220px', boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
                                  border: '1px solid rgba(255,255,255,0.15)',
                                }}>
                                  <div style={{ fontSize: '10px', color: '#fff', lineHeight: 1.4, wordBreak: 'break-word' }}>{c.content}</div>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteAnnotation(c.id); setExpandedCommentId(null); }}
                                    style={{
                                      marginTop: '4px', background: 'rgba(255,80,80,0.2)', border: '1px solid rgba(255,80,80,0.3)',
                                      borderRadius: '3px', padding: '2px 6px', fontSize: '9px', color: '#ff6b6b',
                                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px',
                                    }}
                                  >
                                    <Trash2 size={9} /> Delete
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {pendingComment && (
                          <div style={{
                            position: 'absolute',
                            left: `${Math.min(pendingComment.x, 92)}%`,
                            top: `${Math.min(pendingComment.y, 95)}%`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10,
                          }}>
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%',
                              background: 'rgba(59,130,246,0.85)', border: '2px solid #fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 0 12px rgba(59,130,246,0.5)',
                              animation: 'pulse 1.5s ease-in-out infinite',
                            }}>
                              <MessageSquare size={12} color="#fff" />
                            </div>
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute', top: '30px', left: '50%', transform: 'translateX(-50%)',
                                background: 'rgba(0,0,0,0.92)', borderRadius: '8px', padding: '8px',
                                minWidth: '200px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                                border: '1px solid rgba(255,255,255,0.2)',
                              }}
                            >
                              <input
                                ref={pendingCommentInputRef}
                                type="text"
                                value={pendingCommentText}
                                onChange={e => setPendingCommentText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && pendingCommentText.trim()) { addComment(pendingCommentText, pendingComment); } if (e.key === 'Escape') { setPendingComment(null); setPendingCommentText(''); } }}
                                placeholder="Type your comment..."
                                style={{
                                  width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                                  borderRadius: '4px', padding: '5px 8px', color: '#fff', fontSize: '11px', outline: 'none',
                                  boxSizing: 'border-box',
                                }}
                                data-testid="input-positioned-comment"
                              />
                              <div style={{ display: 'flex', gap: '4px', marginTop: '6px', justifyContent: 'flex-end' }}>
                                <button
                                  onClick={() => { setPendingComment(null); setPendingCommentText(''); }}
                                  style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer' }}
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={() => { if (pendingCommentText.trim()) addComment(pendingCommentText, pendingComment); }}
                                  style={{ background: 'rgba(59,130,246,0.5)', border: '1px solid rgba(59,130,246,0.7)', borderRadius: '4px', padding: '3px 8px', fontSize: '10px', color: '#fff', cursor: pendingCommentText.trim() ? 'pointer' : 'default', opacity: pendingCommentText.trim() ? 1 : 0.4 }}
                                  data-testid="btn-submit-positioned-comment"
                                >
                                  Add
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {pageBookmarked && (
                          <div style={{ position: 'absolute', top: 0, right: '16px', width: '20px', height: '32px', background: '#D4AF37', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                        )}
                        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: '1px', background: 'rgba(0,0,0,0.12)' }} />
                      </div>
                      {rightPage ? (
                        <div
                          className="book-page book-page-right"
                          style={{ position: 'relative', cursor: activeToolPanel === 'highlight' ? 'text' : 'text', boxShadow: 'inset 8px 0 16px -6px rgba(0,0,0,0.15), -2px 2px 8px rgba(0,0,0,0.1)' }}
                          onMouseUp={activeToolPanel === 'highlight' ? (e) => {
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                              const range = sel.getRangeAt(0);
                              const containerRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                              const clientRects = range.getClientRects();
                              const normalizedRects: { x: number; y: number; w: number; h: number }[] = [];
                              for (let i = 0; i < clientRects.length; i++) {
                                const cr = clientRects[i];
                                if (cr.width < 1 || cr.height < 1) continue;
                                normalizedRects.push({
                                  x: ((cr.left - containerRect.left) / containerRect.width) * 100,
                                  y: ((cr.top - containerRect.top) / containerRect.height) * 100,
                                  w: (cr.width / containerRect.width) * 100,
                                  h: (cr.height / containerRect.height) * 100,
                                });
                              }
                              if (normalizedRects.length > 0) {
                                apiRequest('POST', `/api/files/${file.id}/annotations`, { page: rightPage, type: 'highlight', color: highlightColor, rects: JSON.stringify({ type: 'rects', rects: normalizedRects }) }).then(() => refetchAnnotations());
                                sel.removeAllRanges();
                              }
                            }
                          } : undefined}
                        >
                          <canvas ref={canvasRightRef} style={{ display: 'block', pointerEvents: 'none' }} />
                          <div
                            ref={textLayerRightRef}
                            style={{ pointerEvents: activeToolPanel === 'comment' ? 'none' : 'auto' }}
                            className="textLayer"
                          />
                          {annotations.filter(a => a.page === rightPage && a.type === 'highlight').map((h) => {
                            let parsed: any = null;
                            try { if (h.rects) parsed = JSON.parse(h.rects); } catch {}
                            if (!parsed) return null;
                            const color = h.color || '#FFEB3B';
                            if (parsed.type === 'rects' && Array.isArray(parsed.rects)) {
                              return (
                                <div key={h.id} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                                  {parsed.rects.map((r: { x: number; y: number; w: number; h: number }, i: number) => (
                                    <div key={i} style={{
                                      position: 'absolute', left: `${r.x}%`, top: `${r.y}%`,
                                      width: `${r.w}%`, height: `${r.h}%`,
                                      background: `${color}44`, borderRadius: '1px',
                                      pointerEvents: 'auto', cursor: 'pointer', mixBlendMode: 'multiply',
                                    }} onClick={(e) => { e.stopPropagation(); deleteAnnotation(h.id); }} title="Click to remove highlight" />
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          })}
                          {annotations.filter(a => a.page === rightPage && a.type === 'bookmark').length > 0 && (
                            <div style={{ position: 'absolute', top: 0, right: '16px', width: '20px', height: '32px', background: '#D4AF37', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                          )}
                          <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '1px', background: 'rgba(0,0,0,0.12)' }} />
                        </div>
                      ) : (
                        <div className="book-page book-page-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#e8e4dc', boxShadow: 'inset 8px 0 16px -6px rgba(0,0,0,0.15)', minWidth: '200px', minHeight: '300px' }}>
                          <span style={{ color: '#999', fontSize: '13px', fontStyle: 'italic' }}>End of document</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {showAnnotations && (
                <div style={{ width: '220px', background: 'rgba(0,0,0,0.2)', borderLeft: '1px solid rgba(255,255,255,0.1)', overflow: 'auto', padding: '8px', flexShrink: 0 }}>
                  <div style={{ color: '#D4AF37', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>Annotations</div>

                  {bookmarks.length > 0 && (
                    <>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', marginTop: '4px' }}>Bookmarks</div>
                      {bookmarks.map(b => (
                        <div key={b.id} onClick={() => goToSpread(b.page)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '3px', cursor: 'pointer', background: (currentPage === b.page || rightPage === b.page) ? 'rgba(212,175,55,0.15)' : 'transparent', marginBottom: '2px' }}>
                          <Bookmark size={12} fill="#D4AF37" color="#D4AF37" />
                          <span style={{ color: '#fff', fontSize: '11px' }}>Page {b.page}</span>
                          <button onClick={e => { e.stopPropagation(); deleteAnnotation(b.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <Trash2 size={10} color="rgba(255,255,255,0.4)" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {highlights.length > 0 && (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px', marginBottom: '4px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase' }}>Highlights</div>
                        <button
                          onClick={async () => { for (const h of highlights) { await apiRequest('DELETE', `/api/annotations/${h.id}`); } refetchAnnotations(); }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px', fontSize: '8px', color: 'rgba(255,100,100,0.6)', fontWeight: 600, letterSpacing: '0.5px' }}
                          title="Clear all highlights"
                          data-testid="btn-clear-all-highlights"
                        >CLEAR ALL</button>
                      </div>
                      {highlights.map(h => (
                        <div key={h.id} onClick={() => goToSpread(h.page)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '3px', cursor: 'pointer', background: (currentPage === h.page || rightPage === h.page) ? 'rgba(212,175,55,0.15)' : 'transparent', marginBottom: '2px' }}>
                          <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: h.color || '#FFEB3B', flexShrink: 0 }} />
                          <span style={{ color: '#fff', fontSize: '11px' }}>Page {h.page}</span>
                          <button onClick={e => { e.stopPropagation(); deleteAnnotation(h.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                            <Trash2 size={10} color="rgba(255,255,255,0.4)" />
                          </button>
                        </div>
                      ))}
                    </>
                  )}

                  {comments.length > 0 && (
                    <>
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', marginTop: '8px' }}>Comments</div>
                      {comments.map(c => (
                        <div key={c.id} onClick={() => goToSpread(c.page)} style={{ padding: '4px 6px', borderRadius: '3px', cursor: 'pointer', background: (currentPage === c.page || rightPage === c.page) ? 'rgba(212,175,55,0.15)' : 'transparent', marginBottom: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <MessageSquare size={10} color="rgba(255,255,255,0.5)" />
                            <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px' }}>Page {c.page}</span>
                            <button onClick={e => { e.stopPropagation(); deleteAnnotation(c.id); }} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                              <Trash2 size={10} color="rgba(255,255,255,0.4)" />
                            </button>
                          </div>
                          <div style={{ color: '#fff', fontSize: '10px', marginTop: '2px', wordBreak: 'break-word' }}>{c.content}</div>
                        </div>
                      ))}
                    </>
                  )}

                  {annotations.length === 0 && (
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', textAlign: 'center', marginTop: '20px' }}>No annotations yet</div>
                  )}
                </div>
              )}
            </div>

            {!useNativeViewer && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '4px 32px', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 3, flexShrink: 0 }}>
              <button onClick={() => { stopTts(); setFlipDirection('backward'); setCurrentPage(p => Math.max(1, p - 2)); }} disabled={currentPage <= 1} style={{ ...toolBtnStyle(), padding: '3px 10px', opacity: currentPage <= 1 ? 0.3 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }} data-testid="btn-pdf-prev">
                <ChevronLeft size={14} /> <span style={{ fontSize: '11px', fontWeight: 600 }}>Prev</span>
              </button>
              <span style={{ fontSize: '12px', color: '#ffffff', fontWeight: 700, minWidth: '80px', textAlign: 'center' }}>
                {currentPage}{rightPage ? `–${rightPage}` : ''} / {totalPages}
              </span>
              <button onClick={() => { stopTts(); setFlipDirection('forward'); setCurrentPage(p => Math.min(totalPages, p + 2)); }} disabled={currentPage >= totalPages} style={{ ...toolBtnStyle(), padding: '3px 10px', opacity: currentPage >= totalPages ? 0.3 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }} data-testid="btn-pdf-next">
                <span style={{ fontSize: '11px', fontWeight: 600 }}>Next</span> <ChevronRight size={14} />
              </button>
            </div>
            )}
          </>
        )}

        {phase === 'reading' && (
          <>
            <div
              onMouseDown={(e) => startResize(e, 'left')}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', zIndex: 20 }}
              data-testid="resize-handle-left"
            >
              <div style={{ position: 'absolute', left: '2px', top: '50%', transform: 'translateY(-50%)', width: '2px', height: '40px', borderRadius: '1px', background: 'rgba(255,255,255,0.2)' }} />
            </div>
            <div
              onMouseDown={(e) => startResize(e, 'right')}
              style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'ew-resize', zIndex: 20 }}
              data-testid="resize-handle-right"
            >
              <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', width: '2px', height: '40px', borderRadius: '1px', background: 'rgba(255,255,255,0.2)' }} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function LibraryView({ isOpen, onClose, semesters: semestersProp, initialSemesterKey, isSharedView, onOpenNotepad, courseDisplayNames, initialAiSearch, initialApaCheck }: LibraryViewProps) {
  const { isAdmin: isFullAccess } = useAccessMode();
  const [currentSemIdx, setCurrentSemIdx] = useState(0);
  const [syncingSemKey, setSyncingSemKey] = useState<string | null>(null);
  const [selectedBook, setSelectedBook] = useState<FileRecord | null>(null);
  const [selectedBookColor, setSelectedBookColor] = useState('#8B4513');
  const [openReaders, setOpenReaders] = useState<{ file: FileRecord; color: string; pdfUrl?: string; courseCode?: string; isSyllabus?: boolean; initialSearchQuery?: string; initialPage?: number; openedFromSyllabusCode?: string }[]>([]);
  const [focusedReaderId, setFocusedReaderId] = useState<number | null>(null);
  const [minimizedReaders, setMinimizedReaders] = useState<Set<number>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [showSharePopup, setShowSharePopup] = useState(false);
  const [masterSearch, setMasterSearch] = useState('');
  const [searchHistory, setSearchHistory] = useState<{ query: string; timestamp: number }[]>(() => {
    try {
      const saved = localStorage.getItem('library-search-history');
      if (!saved) return [];
      const parsed: { query: string; timestamp: number }[] = JSON.parse(saved);
      const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      return parsed.filter(h => h.timestamp > oneMonthAgo);
    } catch { return []; }
  });
  const [searchFocused, setSearchFocused] = useState(false);
  const addSearchHistory = useCallback((query: string) => {
    const q = query.trim().toLowerCase();
    if (!q || q.length < 2) return;
    setSearchHistory(prev => {
      const filtered = prev.filter(h => h.query.toLowerCase() !== q);
      const next = [{ query: q, timestamp: Date.now() }, ...filtered].slice(0, 50);
      localStorage.setItem('library-search-history', JSON.stringify(next));
      return next;
    });
  }, []);
  const [showLibraryNote, setShowLibraryNote] = useState(false);
  const [isAiChatOpen, setIsAiChatOpen] = useState(false);
  const [aiChatMessages, setAiChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiChatLoading, setAiChatLoading] = useState(false);
  const [aiChatCourseFilter, setAiChatCourseFilter] = useState('all');
  const aiChatScrollRef = useRef<HTMLDivElement>(null);
  const aiChatInputRef = useRef<HTMLTextAreaElement>(null);
  const sendAiChat = useCallback(async () => {
    const msg = aiChatInput.trim();
    if (!msg || aiChatLoading) return;
    const userMsg = { role: 'user' as const, content: msg };
    setAiChatMessages(prev => [...prev, userMsg]);
    setAiChatInput('');
    setAiChatLoading(true);
    setTimeout(() => aiChatScrollRef.current?.scrollTo({ top: aiChatScrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    try {
      const resp = await fetch('/api/ai/chat-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, courseFilter: aiChatCourseFilter, history: aiChatMessages.slice(-6) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Chat failed');
      setAiChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      setTimeout(() => aiChatScrollRef.current?.scrollTo({ top: aiChatScrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    } catch (err: any) {
      setAiChatMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setAiChatLoading(false);
    }
  }, [aiChatInput, aiChatLoading, aiChatCourseFilter, aiChatMessages]);
  const [masterSemFilter, setMasterSemFilter] = useState('all');
  const [masterCourseFilter, setMasterCourseFilter] = useState('all');
  const [masterWeekFilter, setMasterWeekFilter] = useState('all');
  const [collapsedCourses, setCollapsedCourses] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('library-collapsed-courses');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [masterTypeFilter, setMasterTypeFilter] = useState<'all' | 'module' | 'reading'>('all');
  const [masterFormatFilter, setMasterFormatFilter] = useState('all');
  const [masterSortBy, setMasterSortBy] = useState<'relevance' | 'date_added' | 'name' | 'week'>('relevance');
  const [showFilters, setShowFilters] = useState(false);
  const [fullSearchView, setFullSearchView] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [renamingFile, setRenamingFile] = useState<FileRecord | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameSaving, setRenameSaving] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [ftsResults, setFtsResults] = useState<any[]>([]);
  const [ftsLoading, setFtsLoading] = useState(false);
  useEffect(() => {
    const q = masterSearch.trim();
    if (q.length < 2) { setFtsResults([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setFtsLoading(true);
      try {
        const resp = await fetch(`/api/library/search-fts?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (resp.ok) {
          const data = await resp.json();
          setFtsResults(data.results || []);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error('FTS search error:', err);
      } finally {
        setFtsLoading(false);
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [masterSearch]);

  const [newReadingPrompt, setNewReadingPrompt] = useState<FileRecord | null>(null);
  const [newReadingRenameValue, setNewReadingRenameValue] = useState('');
  const newReadingRenameRef = useRef<HTMLInputElement>(null);
  const newReadingQueueRef = useRef<FileRecord[]>([]);

  const [aiSearchOpen, setAiSearchOpen] = useState(!!initialAiSearch);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPreview, setAiPreview] = useState<any>(null);
  const [aiExecuting, setAiExecuting] = useState(false);
  const [aiResult, setAiResult] = useState<{ result: string; noteId?: number; usage?: any; actualCost?: string } | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiNoteTitle, setAiNoteTitle] = useState('');
  const aiPromptRef = useRef<HTMLTextAreaElement>(null);

  const [apaCheckerOpen, setApaCheckerOpen] = useState(!!initialApaCheck);
  const [apaFile, setApaFile] = useState<File | null>(null);
  const [apaLoading, setApaLoading] = useState(false);
  const [apaResult, setApaResult] = useState<any>(null);
  const [apaError, setApaError] = useState('');
  const apaFileInputRef = useRef<HTMLInputElement>(null);
  const [apaDragOver, setApaDragOver] = useState(false);
  const [apaExpandedCats, setApaExpandedCats] = useState<Set<string>>(new Set());

  const runApaCheck = useCallback(async (file: File) => {
    setApaLoading(true);
    setApaError('');
    setApaResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await fetch('/api/apa-check', { method: 'POST', body: formData });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'APA check failed');
      setApaResult(data);
    } catch (err: any) {
      setApaError(err.message || 'Failed to check document');
    } finally {
      setApaLoading(false);
    }
  }, []);

  const { data: allFiles = [], refetch: refetchFiles } = useQuery<FileRecord[]>({
    queryKey: ['/api/files'],
    enabled: isOpen,
  });

  const [syllabusPaths, setSyllabusPaths] = useState<Record<string, string>>({});
  const syllabusUploadRef = useRef<HTMLInputElement>(null);
  const syllabusUploadCodeRef = useRef<string>('');
  const syllabusUploadColorRef = useRef<string>('#8B6914');
  const handleBookClickRef = useRef<Function>(() => {});

  const handleSyllabusUpload = useCallback(async (file: File, courseCode: string) => {
    try {
      const uploadRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'application/pdf' }),
      });
      const uploadData = await uploadRes.json();
      if (uploadData.uploadUrl) {
        await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/pdf' },
          body: file,
        });
      }
      const objectPath = uploadData.objectPath || uploadData.key || `syllabi/${courseCode}_syllabus.pdf`;
      const pathsRes = await fetch('/api/syllabus/paths');
      const existingPaths = await pathsRes.json();
      const updatedPaths = { ...existingPaths, [courseCode]: objectPath };
      await apiRequest('POST', '/api/syllabus/paths', updatedPaths);
      localStorage.setItem('courseSyllabusPaths', JSON.stringify(updatedPaths));
      setSyllabusPaths(updatedPaths);
      queryClient.invalidateQueries({ queryKey: ['/api/syllabus/paths'] });

      const syllabusFile: any = {
        id: -1 * (courseCode.charCodeAt(0) * 1000 + courseCode.charCodeAt(1)),
        originalName: `${courseCode} Syllabus.pdf`,
        displayName: `${courseCode} Syllabus`,
        objectPath,
        folder: null,
        listened: false,
        contentType: 'application/pdf',
      };
      handleBookClickRef.current(syllabusFile, syllabusUploadColorRef.current, `/api/syllabus/view?path=${encodeURIComponent(objectPath)}`, courseCode.replace(/\s/g, '').toLowerCase(), true);
    } catch (err: any) {
      console.error('[Syllabus Upload] Error:', err);
    }
  }, []);
  useEffect(() => {
    if (!isOpen) return;
    const localPaths: Record<string, string> = {};
    try {
      const saved = localStorage.getItem('courseSyllabusPaths');
      if (saved) Object.assign(localPaths, JSON.parse(saved));
    } catch {}
    fetch('/api/syllabus/paths')
      .then(r => r.json())
      .then(serverPaths => {
        const merged = { ...localPaths, ...(serverPaths && typeof serverPaths === 'object' ? serverPaths : {}) };
        Object.keys(localPaths).forEach(code => {
          if (!serverPaths?.[code] && localPaths[code]) {
            merged[code] = localPaths[code];
            fetch('/api/syllabus/paths', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ courseCode: code, objectPath: localPaths[code] }),
            }).catch(() => {});
          }
        });
        setSyllabusPaths(merged);
      })
      .catch(() => { setSyllabusPaths(localPaths); });
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || allFiles.length === 0 || newReadingPrompt) return;
    try {
      const prompted: string[] = JSON.parse(localStorage.getItem('library-reading-rename-prompted') || '[]');
      const promptedSet = new Set(prompted);
      const newReadings = allFiles.filter(f => {
        if (!f.folder || !f.folder.toLowerCase().includes('-reading')) return false;
        if (promptedSet.has(String(f.id))) return false;
        if (f.displayName && f.displayName !== f.originalName) return false;
        return true;
      });
      if (newReadings.length > 0) {
        newReadingQueueRef.current = newReadings.slice(1);
        const first = newReadings[0];
        setNewReadingRenameValue(first.originalName.replace(/\.(pdf|docx?|pptx?|xlsx?)$/i, ''));
        setNewReadingPrompt(first);
      }
    } catch {}
  }, [isOpen, allFiles, newReadingPrompt]);

  useEffect(() => {
    if (newReadingPrompt && newReadingRenameRef.current) {
      newReadingRenameRef.current.focus();
      newReadingRenameRef.current.select();
    }
  }, [newReadingPrompt]);

  const handleReadingRenameResponse = useCallback(async (file: FileRecord, newName: string | null) => {
    const prompted: string[] = JSON.parse(localStorage.getItem('library-reading-rename-prompted') || '[]');
    prompted.push(String(file.id));
    localStorage.setItem('library-reading-rename-prompted', JSON.stringify(prompted));

    if (newName && newName.trim() && newName.trim() !== file.originalName.replace(/\.(pdf|docx?|pptx?|xlsx?)$/i, '')) {
      try {
        await fetch(`/api/files/${file.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ displayName: newName.trim() }),
        });
        refetchFiles();
      } catch {}
    }

    setNewReadingPrompt(null);
    if (newReadingQueueRef.current.length > 0) {
      const next = newReadingQueueRef.current.shift()!;
      setTimeout(() => {
        setNewReadingRenameValue(next.originalName.replace(/\.(pdf|docx?|pptx?|xlsx?)$/i, ''));
        setNewReadingPrompt(next);
      }, 300);
    }
  }, [refetchFiles]);

  const preExtractTriggered = useRef(false);
  useEffect(() => {
    if (isOpen && allFiles.length > 0 && !preExtractTriggered.current) {
      preExtractTriggered.current = true;
      fetch('/api/files/pre-extract', { method: 'POST' }).catch(() => {});
    }
  }, [isOpen, allFiles]);

  const { data: semesterSettings = [] } = useQuery<any[]>({
    queryKey: ['/api/semesters'],
    enabled: isOpen,
  });

  const librarySyncDoneRef = useRef(false);

  useEffect(() => {
    if (!isOpen || semesterSettings.length === 0 || librarySyncDoneRef.current) return;
    librarySyncDoneRef.current = true;
    const sorted = [...semesterSettings].sort((a: any, b: any) => {
      const aDate = a.semesterStartDate ? new Date(a.semesterStartDate).getTime() : 0;
      const bDate = b.semesterStartDate ? new Date(b.semesterStartDate).getTime() : 0;
      return aDate - bDate;
    });
    const syncAll = async () => {
      for (const s of sorted) {
        const st = s.semesterType || '';
        const name = s.semesterName || '';
        const yearMatch = name.match(/\d{4}/);
        const year = yearMatch ? yearMatch[0] : '';
        const key = st.startsWith('spring_summer') ? `ss${year}` : st === 'fall' ? `f${year}` : st === 'winter' ? `w${year}` : `s${s.id}`;
        try {
          await fetch('/api/library/sync-semester', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ semesterKey: key }) });
        } catch {}
      }
      try {
        await fetch('/api/library/sync-document-dump', { method: 'POST' });
      } catch {}
      setTimeout(() => refetchFiles(), 10000);
      setTimeout(() => refetchFiles(), 30000);
      setTimeout(() => refetchFiles(), 60000);
    };
    syncAll();
  }, [isOpen, semesterSettings]);

  const semesters = useMemo(() => {
    if (semesterSettings.length === 0) return semestersProp;
    const now = new Date().getTime();
    const mapped = [...semesterSettings].map((s: any) => {
      const st = s.semesterType || '';
      const name = s.semesterName || '';
      const yearMatch = name.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : '';
      const key = st.startsWith('spring_summer') ? `ss${year}` : st === 'fall' ? `f${year}` : st === 'winter' ? `w${year}` : `s${s.id}`;
      const courses: { code: string; name: string; color: string }[] = [];
      for (let i = 1; i <= 3; i++) {
        const code = s[`course${i}Code`] || '';
        if (code) {
          courses.push({
            code,
            name: s[`course${i}Name`] || '',
            color: s[`course${i}Color`] || '#3b82f6',
          });
        }
      }
      const startMs = s.semesterStartDate ? new Date(s.semesterStartDate).getTime() : 0;
      const endMs = s.semesterEndDate ? new Date(s.semesterEndDate).getTime() : startMs + 120 * 24 * 60 * 60 * 1000;
      const isCurrent = now >= startMs && now <= endMs;
      const isFuture = now < startMs;
      const isPast = now > endMs;
      return { key, label: name, courses, startMs, isCurrent, isFuture, isPast };
    });
    mapped.sort((a, b) => {
      if (a.isCurrent && !b.isCurrent) return -1;
      if (!a.isCurrent && b.isCurrent) return 1;
      if (a.isFuture && b.isPast) return -1;
      if (a.isPast && b.isFuture) return 1;
      if (a.isFuture && b.isFuture) return a.startMs - b.startMs;
      if (a.isPast && b.isPast) return b.startMs - a.startMs;
      return a.startMs - b.startMs;
    });
    mapped.push({ key: 'docdump', label: 'Document Dump', courses: [{ code: 'DOCS', name: 'Document Dump', color: '#D4AF37' }], startMs: 0, isCurrent: false, isFuture: false, isPast: false });
    return mapped;
  }, [semesterSettings, semestersProp]);

  const initialSemAppliedRef = useRef(false);
  useEffect(() => {
    if (!isOpen) { initialSemAppliedRef.current = false; return; }
    if (initialSemAppliedRef.current) return;
    if (initialSemesterKey && semesters.length > 0) {
      const idx = semesters.findIndex(s => s.key === initialSemesterKey);
      if (idx >= 0) setCurrentSemIdx(idx);
      initialSemAppliedRef.current = true;
    }
  }, [isOpen, initialSemesterKey, semesters]);

  const currentSemester = semesters[currentSemIdx];

  const courseBooks = useMemo(() => {
    if (!currentSemester) return [];

    const sortFiles = (files: FileRecord[]) => {
      const getWeekNum = (f: FileRecord) => parseInt(f.folder?.match(/week-(\d+)/)?.[1] || '0');
      const getType = (f: FileRecord) => f.folder?.toLowerCase().includes('-module') ? 0 : 1;
      files.sort((a, b) => {
        const weekA = getWeekNum(a);
        const weekB = getWeekNum(b);
        if (weekA !== weekB) return weekA - weekB;
        const typeA = getType(a);
        const typeB = getType(b);
        if (typeA !== typeB) return typeA - typeB;
        return (a.displayName || a.originalName).localeCompare(b.displayName || b.originalName);
      });
    };

    if (currentSemester.key === 'docdump') {
      const dumpFiles = allFiles.filter(f => f.folder === 'week-0-documentdump-reading');
      if (dumpFiles.length > 0) {
        sortFiles(dumpFiles);
        return [{ course: { code: 'DOCS', name: 'Document Dump', color: '#D4AF37' }, files: dumpFiles }];
      }
      return [];
    }

    const moduleReadingFiles = allFiles.filter(f => {
      if (!f.folder) return false;
      const fl = f.folder.toLowerCase();
      if (!(fl.includes('-module') || fl.includes('-reading')) || !fl.startsWith('week-')) return false;
      return true;
    });

    const courseMap = new Map<string, FileRecord[]>();
    moduleReadingFiles.forEach(f => {
      const match = f.folder!.match(/^week-(\d+)-(.+?)-(module|reading)$/i);
      if (!match) return;
      const code = match[2].toLowerCase();
      if (!courseMap.has(code)) courseMap.set(code, []);
      courseMap.get(code)!.push(f);
    });

    const semCourses = currentSemester.courses;
    const result: { course: { code: string; name: string; color: string }; files: FileRecord[] }[] = [];

    semCourses.forEach((course, courseIdx) => {
      const codeNorm = course.code.replace(/\s/g, '').toLowerCase();
      let files = [...(courseMap.get(codeNorm) || [])];

      if (files.length === 0) {
        for (const [key, val] of courseMap.entries()) {
          if (key.replace(/[_\s]/g, '') === codeNorm.replace(/[_\s]/g, '')) {
            files = [...files, ...val];
          }
        }
      }

      const slotMatch = codeNorm.match(/^tbd(\d+)$/);
      if (slotMatch) {
        const slotKey = `tbd_slot${slotMatch[1]}`;
        const slotFiles = courseMap.get(slotKey) || [];
        if (slotFiles.length > 0) {
          const existingIds = new Set(files.map(f => f.id));
          files = [...files, ...slotFiles.filter(f => !existingIds.has(f.id))];
        }
      }

      if (files.length === 0 && codeNorm.startsWith('tbd')) {
        const numMatch = codeNorm.match(/\d+/);
        if (numMatch) {
          const num = numMatch[0];
          for (const variant of [`tbd${num}`, `tbd_slot${num}`, `tbd${num}00`]) {
            const variantFiles = courseMap.get(variant) || [];
            if (variantFiles.length > 0) {
              const existingIds = new Set(files.map(f => f.id));
              files = [...files, ...variantFiles.filter(f => !existingIds.has(f.id))];
            }
          }
        }
      }

      if (files && files.length > 0) {
        sortFiles(files);
        result.push({ course, files });
      } else if (syllabusPaths[course.code]) {
        result.push({ course, files: [] });
      }
    });

    if (result.length === 0 && semCourses.length > 0) {
      const usedIds = new Set(result.flatMap(r => r.files.map(f => f.id)));
      const tbdKeys = [...courseMap.keys()].filter(k => k.startsWith('tbd'));
      if (tbdKeys.length > 0) {
        const tbdNums = new Set<string>();
        tbdKeys.forEach(k => {
          const m = k.match(/tbd_?(?:slot)?(\d+)/);
          if (m) tbdNums.add(m[1]);
        });
        const sortedNums = [...tbdNums].sort((a, b) => parseInt(a) - parseInt(b));
        sortedNums.forEach((num, idx) => {
          if (idx >= semCourses.length) return;
          const course = semCourses[idx];
          let files: FileRecord[] = [];
          for (const variant of [`tbd${num}`, `tbd_slot${num}`]) {
            const variantFiles = courseMap.get(variant) || [];
            const existingIds = new Set(files.map(f => f.id));
            files = [...files, ...variantFiles.filter(f => !existingIds.has(f.id) && !usedIds.has(f.id))];
          }
          if (files.length > 0) {
            sortFiles(files);
            result.push({ course: { ...course, name: course.name || `TBD Course ${num}` }, files });
            files.forEach(f => usedIds.add(f.id));
          }
        });
      }
    }

    result.sort((a, b) => {
      const aHasFiles = a.files.length > 0 ? 0 : 1;
      const bHasFiles = b.files.length > 0 ? 0 : 1;
      return aHasFiles - bHasFiles;
    });
    return result;
  }, [currentSemester, allFiles, semesters, syllabusPaths]);

  const courseModuleFilesMap = useMemo(() => {
    const map: Record<string, { weekNum: number; file: FileRecord; color: string }[]> = {};
    allFiles.forEach(f => {
      if (!f.folder) return;
      const match = f.folder.match(/^week-(\d+)-(.+?)-module$/i);
      if (!match) return;
      const weekNum = parseInt(match[1], 10);
      const codeNorm = match[2].toLowerCase();
      if (!map[codeNorm]) map[codeNorm] = [];
      map[codeNorm].push({ weekNum, file: f, color: getBookColor(0, codeNorm, weekNum) });
    });
    return map;
  }, [allFiles]);

  const allCoursesForSearch = useMemo(() => {
    const set = new Set<string>();
    semesters.forEach(s => s.courses.forEach(c => set.add(c.code)));
    const hasDump = allFiles.some(f => f.folder === 'week-0-documentdump-reading');
    if (hasDump) set.add('DOCS');
    return Array.from(set);
  }, [semesters, allFiles]);

  const hasAnyFilter = masterSearch.trim() || masterSemFilter !== 'all' || masterCourseFilter !== 'all' || masterWeekFilter !== 'all' || masterTypeFilter !== 'all' || masterFormatFilter !== 'all';

  const availableWeeks = useMemo(() => {
    const weeks = new Set<number>();
    allFiles.forEach(f => {
      const m = f.folder?.match(/^week-(\d+)/);
      if (m && parseInt(m[1]) > 0) weeks.add(parseInt(m[1]));
    });
    return Array.from(weeks).sort((a, b) => a - b);
  }, [allFiles]);

  const availableFormats = useMemo(() => {
    const fmts = new Set<string>();
    allFiles.forEach(f => {
      const ext = f.originalName.match(/\.(\w+)$/)?.[1]?.toLowerCase();
      if (ext) fmts.add(ext);
    });
    return Array.from(fmts).sort();
  }, [allFiles]);

  type SearchResult = { file: FileRecord; semLabel: string; semKey: string; courseCode: string; courseName: string; weekNum: number; fileType: string; fileFormat: string; contentSnippet?: string; matchedTokenCount?: number; proximitySnippet?: string; ftsPageNum?: number; ftsHeadline?: string; ftsRank?: number };

  const STOP_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'be', 'but', 'by', 'for', 'if', 'in', 'is', 'it', 'no', 'not', 'of', 'on', 'or', 'so', 'the', 'to', 'we']);

  const parsedQuery = useMemo(() => parseSearchQuery(masterSearch), [masterSearch]);

  const combinedSearchResults = useMemo(() => {
    if (!hasAnyFilter) return null;
    const pq = parsedQuery;
    const tokens = pq.allHighlightTokens.filter(t => !STOP_WORDS.has(t));
    const results: SearchResult[] = [];
    const addedFileIds = new Set<number>();

    const resolveFileInfo = (f: FileRecord): { wn: number; fType: string; ext: string } | null => {
      const folder = f.folder?.toLowerCase() || '';
      if (!(folder.includes('-module') || folder.includes('-reading')) || !folder.startsWith('week-')) return null;
      const wn = parseInt(folder.match(/week-(\d+)/)?.[1] || '0');
      const fType = folder.includes('-module') ? 'module' : 'reading';
      const ext = f.originalName.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
      if (masterWeekFilter !== 'all' && wn !== parseInt(masterWeekFilter)) return null;
      if (masterTypeFilter !== 'all' && fType !== masterTypeFilter) return null;
      if (masterFormatFilter !== 'all' && ext !== masterFormatFilter) return null;
      return { wn, fType, ext };
    };

    const getContentSnippet = (f: FileRecord, matchedTokens?: string[]): { snippet: string; matchCount: number; proximitySnippet?: string } | undefined => {
      if (!tokens.length || !f.extractedText) return undefined;
      const text = f.extractedText.toLowerCase();
      const toks = matchedTokens || tokens;
      const matching = toks.filter(t => text.includes(t));
      if (matching.length === 0) return undefined;

      let proximitySnippet: string | undefined;
      if (matching.length >= 2) {
        const PROXIMITY_WINDOW = 300;
        let bestPos = -1;
        let bestSpan = Infinity;
        for (let scan = 0; scan < text.length - 1; scan = text.indexOf(matching[0], scan + 1)) {
          if (scan < 0) break;
          const firstPos = scan;
          for (let ti = 1; ti < matching.length; ti++) {
            const searchStart = Math.max(0, firstPos - PROXIMITY_WINDOW);
            const searchEnd = Math.min(text.length, firstPos + matching[0].length + PROXIMITY_WINDOW);
            const region = text.substring(searchStart, searchEnd);
            const otherIdx = region.indexOf(matching[ti]);
            if (otherIdx >= 0) {
              const absOtherIdx = searchStart + otherIdx;
              const span = Math.abs(absOtherIdx - firstPos);
              if (span < bestSpan) {
                bestSpan = span;
                bestPos = Math.min(firstPos, absOtherIdx);
              }
            }
          }
          if (scan === -1) break;
        }
        if (bestPos >= 0 && bestSpan < PROXIMITY_WINDOW) {
          const pStart = Math.max(0, bestPos - 30);
          const pEnd = Math.min(f.extractedText.length, bestPos + bestSpan + matching[matching.length - 1].length + 60);
          proximitySnippet = (pStart > 0 ? '...' : '') + f.extractedText.substring(pStart, pEnd).replace(/\n/g, ' ').trim() + (pEnd < f.extractedText.length ? '...' : '');
        }
      }

      const snippets: string[] = [];
      const seen = new Set<number>();
      for (const tok of matching) {
        const idx = text.indexOf(tok);
        if (idx < 0) continue;
        const bucket = Math.floor(idx / 120);
        if (seen.has(bucket)) continue;
        seen.add(bucket);
        const start = Math.max(0, idx - 40);
        const end = Math.min(f.extractedText.length, idx + tok.length + 80);
        snippets.push((start > 0 ? '...' : '') + f.extractedText.substring(start, end).replace(/\n/g, ' ').trim() + (end < f.extractedText.length ? '...' : ''));
        if (snippets.length >= 2) break;
      }
      return { snippet: proximitySnippet || snippets.join('  ··  ') || '', matchCount: matching.length, proximitySnippet };
    };

    const moduleReadingFiles = allFiles.filter(f => {
      if (!f.folder) return false;
      const fl = f.folder.toLowerCase();
      return (fl.includes('-module') || fl.includes('-reading')) && fl.startsWith('week-');
    });

    semesters.forEach(sem => {
      if (masterSemFilter !== 'all' && sem.key !== masterSemFilter) return;
      sem.courses.forEach(course => {
        if (masterCourseFilter !== 'all' && course.code !== masterCourseFilter) return;
        const codeNorm = course.code.replace(/\s/g, '').toLowerCase();
        const tbdSlotVariant = codeNorm.match(/^tbd(\d+)$/) ? `tbd_slot${codeNorm.match(/^tbd(\d+)$/)?.[1]}` : '';
        const matched = moduleReadingFiles.filter(f => {
          const match = f.folder!.match(/^week-(\d+)-(.+?)-(module|reading)$/i);
          if (!match) return false;
          const folderCode = match[2].toLowerCase();
          return folderCode === codeNorm || folderCode.replace(/_/g, '') === codeNorm || (tbdSlotVariant && folderCode === tbdSlotVariant);
        });
        matched.forEach(f => {
          const info = resolveFileInfo(f);
          if (!info) return;

          let nameMatch = true;
          let contentSnippet: string | undefined;
          let matchedTokenCount = 0;
          let proximitySnippet: string | undefined;

          if (tokens.length > 0) {
            const name = (f.displayName || f.originalName).toLowerCase();
            const folder = f.folder?.toLowerCase() || '';
            const searchable = [
              name, folder,
              course.code.toLowerCase(), course.name.toLowerCase(),
              sem.label.toLowerCase(), sem.key.toLowerCase(),
              `week ${info.wn}`, `week${info.wn}`, `w${info.wn}`,
              info.fType, info.ext,
            ].join(' ');
            const nameMatchedTokens = tokens.filter(tok => searchable.includes(tok));
            nameMatch = nameMatchedTokens.length > 0;

            const fullContentResult = getContentSnippet(f);
            if (fullContentResult) {
              matchedTokenCount = fullContentResult.matchCount;
              proximitySnippet = fullContentResult.proximitySnippet;
            }

            if (!nameMatch) {
              if (!fullContentResult) return;
              contentSnippet = fullContentResult.snippet;
            } else if (nameMatchedTokens.length < tokens.length) {
              const remainingTokens = tokens.filter(tok => !nameMatchedTokens.includes(tok));
              const extraResult = getContentSnippet(f, remainingTokens);
              if (extraResult) {
                contentSnippet = fullContentResult?.proximitySnippet || extraResult.snippet;
                matchedTokenCount = Math.max(matchedTokenCount, extraResult.matchCount + nameMatchedTokens.length);
              }
            } else if (fullContentResult) {
              matchedTokenCount = fullContentResult.matchCount + nameMatchedTokens.length;
              if (fullContentResult.proximitySnippet) {
                contentSnippet = fullContentResult.proximitySnippet;
              }
            }
          }

          if (pq.phrases.length > 0 || pq.required.length > 0) {
            const fullText = [(f.displayName || f.originalName), f.extractedText || ''].join(' ');
            if (!textMatchesParsedQuery(fullText, pq)) return;
          }

          if (addedFileIds.has(f.id)) return;
          addedFileIds.add(f.id);
          results.push({ file: f, semLabel: sem.label, semKey: sem.key, courseCode: course.code, courseName: course.name, weekNum: info.wn, fileType: info.fType, fileFormat: info.ext, contentSnippet, matchedTokenCount, proximitySnippet });
        });
      });
    });

    if ((masterSemFilter === 'all' || masterSemFilter === 'docdump') && (masterCourseFilter === 'all' || masterCourseFilter === 'DOCS')) {
      const dumpFiles = allFiles.filter(f => f.folder === 'week-0-documentdump-reading');
      dumpFiles.forEach(f => {
        const name = (f.displayName || f.originalName).toLowerCase();
        const ext = f.originalName.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';

        if (masterTypeFilter !== 'all' && masterTypeFilter !== 'reading') return;
        if (masterFormatFilter !== 'all' && ext !== masterFormatFilter) return;

        let contentSnippet: string | undefined;
        let matchedTokenCount = 0;
        let proximitySnippet: string | undefined;
        if (tokens.length > 0) {
          const searchable = [name, 'document dump', 'docs', 'documentdump', ext].join(' ');
          const nameMatchedTokens = tokens.filter(tok => searchable.includes(tok));
          const fullContentResult = getContentSnippet(f);
          if (fullContentResult) {
            matchedTokenCount = fullContentResult.matchCount;
            proximitySnippet = fullContentResult.proximitySnippet;
          }
          if (nameMatchedTokens.length === 0) {
            if (!fullContentResult) return;
            contentSnippet = fullContentResult.snippet;
          } else if (nameMatchedTokens.length < tokens.length) {
            const remainingTokens = tokens.filter(tok => !nameMatchedTokens.includes(tok));
            const extraResult = getContentSnippet(f, remainingTokens);
            if (extraResult) {
              contentSnippet = fullContentResult?.proximitySnippet || extraResult.snippet;
              matchedTokenCount = Math.max(matchedTokenCount, extraResult.matchCount + nameMatchedTokens.length);
            }
          } else if (fullContentResult) {
            matchedTokenCount = fullContentResult.matchCount + nameMatchedTokens.length;
            if (fullContentResult.proximitySnippet) contentSnippet = fullContentResult.proximitySnippet;
          }
        }
        if (pq.phrases.length > 0 || pq.required.length > 0) {
          const fullText = [(f.displayName || f.originalName), f.extractedText || ''].join(' ');
          if (!textMatchesParsedQuery(fullText, pq)) return;
        }
        if (addedFileIds.has(f.id)) return;
        addedFileIds.add(f.id);
        results.push({ file: f, semLabel: 'Document Dump', semKey: 'docdump', courseCode: 'DOCS', courseName: 'Document Dump', weekNum: 0, fileType: 'reading', fileFormat: ext, contentSnippet, matchedTokenCount, proximitySnippet });
      });
    }

    if (masterSortBy === 'name') {
      results.sort((a, b) => (a.file.displayName || a.file.originalName).localeCompare(b.file.displayName || b.file.originalName));
    } else if (masterSortBy === 'week') {
      results.sort((a, b) => a.weekNum - b.weekNum || a.courseCode.localeCompare(b.courseCode));
    } else if (masterSortBy === 'date_added') {
      results.sort((a, b) => (b.file.id || 0) - (a.file.id || 0));
    } else {
      if (tokens.length >= 2) {
        results.sort((a, b) => {
          const aProx = a.proximitySnippet ? 1 : 0;
          const bProx = b.proximitySnippet ? 1 : 0;
          if (aProx !== bProx) return bProx - aProx;
          const aCount = a.matchedTokenCount || 0;
          const bCount = b.matchedTokenCount || 0;
          if (aCount !== bCount) return bCount - aCount;
          const aContent = a.contentSnippet ? 1 : 0;
          const bContent = b.contentSnippet ? 1 : 0;
          if (aContent !== bContent) return aContent - bContent;
          return a.courseCode.localeCompare(b.courseCode) || a.weekNum - b.weekNum;
        });
      } else {
        const nameResults = results.filter(r => !r.contentSnippet);
        const contentResults = results.filter(r => r.contentSnippet);
        nameResults.sort((a, b) => {
          const semCmp = a.semLabel.localeCompare(b.semLabel);
          if (semCmp !== 0) return semCmp;
          const codeCmp = a.courseCode.localeCompare(b.courseCode);
          if (codeCmp !== 0) return codeCmp;
          return a.weekNum - b.weekNum;
        });
        contentResults.sort((a, b) => {
          const semCmp = a.semLabel.localeCompare(b.semLabel);
          if (semCmp !== 0) return semCmp;
          return a.courseCode.localeCompare(b.courseCode);
        });
        results.length = 0;
        results.push(...nameResults, ...contentResults);
      }
    }
    if (ftsResults.length > 0 && masterSearch.trim().length >= 2) {
      for (const fts of ftsResults) {
        if (!fts.file) continue;
        const existing = results.find(r => r.file.id === fts.fileId);
        if (existing) {
          if (!existing.ftsPageNum || (fts.rank > (existing.ftsRank || 0))) {
            existing.ftsPageNum = fts.pageNum;
            existing.ftsRank = fts.rank;
            const hl = (fts.headline || '').replace(/<<([^>]*?)>>/g, '**$1**');
            existing.ftsHeadline = hl;
            if (!existing.contentSnippet) existing.contentSnippet = hl;
          }
        } else {
          const f = fts.file;
          const folder = f.folder?.toLowerCase() || '';
          const fMatch = folder.match(/^week-(\d+)-(.+?)-(module|reading)$/i);
          const wn = fMatch ? parseInt(fMatch[1]) : 0;
          const fType = folder === 'week-0-documentdump-reading' ? 'reading' : (fMatch?.[3]?.toLowerCase() || 'reading');
          const ext = f.originalName?.match(/\.(\w+)$/)?.[1]?.toLowerCase() || '';
          const courseCodeNorm = fMatch ? fMatch[2].toLowerCase() : (folder === 'week-0-documentdump-reading' ? 'DOCS' : folder.replace(/[^a-z0-9]/g, ''));

          let semLabel = '', semKey = '', courseCode = '', courseName = '';
          for (const sem of semesters) {
            for (const course of sem.courses) {
              const cn = course.code.replace(/\s/g, '').toLowerCase();
              if (cn === courseCodeNorm || cn.replace(/_/g, '') === courseCodeNorm) {
                semLabel = sem.label; semKey = sem.key; courseCode = course.code; courseName = course.name;
                break;
              }
            }
            if (courseCode) break;
          }
          if (!courseCode && folder === 'week-0-documentdump-reading') {
            semLabel = 'Document Dump'; semKey = 'docdump'; courseCode = 'DOCS'; courseName = 'Document Dump';
          }
          if (!courseCode) {
            const codeParts = courseCodeNorm.replace(/_/g, '').toUpperCase();
            courseCode = codeParts || 'UNKNOWN';
            courseName = courseCode;
            semLabel = 'Other';
            semKey = 'other';
          }

          if (masterSemFilter !== 'all' && semKey !== masterSemFilter) continue;
          if (masterCourseFilter !== 'all' && courseCode !== masterCourseFilter) continue;
          if (masterWeekFilter !== 'all' && wn !== parseInt(masterWeekFilter)) continue;
          if (masterTypeFilter !== 'all' && fType !== masterTypeFilter) continue;
          if (masterFormatFilter !== 'all' && ext !== masterFormatFilter) continue;

          if (addedFileIds.has(f.id)) continue;
          addedFileIds.add(f.id);

          const hl = (fts.headline || '').replace(/<<([^>]*?)>>/g, '**$1**');
          results.push({
            file: f, semLabel, semKey, courseCode, courseName, weekNum: wn,
            fileType: fType, fileFormat: ext, contentSnippet: hl,
            matchedTokenCount: 1, ftsPageNum: fts.pageNum, ftsHeadline: hl, ftsRank: fts.rank,
          });
        }
      }
      if (masterSortBy === 'relevance') {
        results.sort((a, b) => {
          const aRank = a.ftsRank || 0;
          const bRank = b.ftsRank || 0;
          if (aRank !== bRank) return bRank - aRank;
          return (b.matchedTokenCount || 0) - (a.matchedTokenCount || 0);
        });
      }
    }

    return results;
  }, [masterSearch, masterSemFilter, masterCourseFilter, masterWeekFilter, masterTypeFilter, masterFormatFilter, masterSortBy, allFiles, semesters, hasAnyFilter, ftsResults, parsedQuery]);

  const searchTokens = useMemo(() => {
    const tokens = parsedQuery.allHighlightTokens.filter(t => !STOP_WORDS.has(t));
    return tokens.length > 0 ? tokens : parsedQuery.allHighlightTokens;
  }, [parsedQuery]);

  const highlightTokens = useCallback((text: string, tokens: string[], color?: string): (string | JSX.Element)[] => {
    if (!tokens.length || !text) return [text];
    const escaped = tokens.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => {
      if (regex.test(part)) {
        regex.lastIndex = 0;
        return <mark key={i} style={{ backgroundColor: color || 'rgba(255,220,80,0.35)', color: '#fff', borderRadius: '2px', padding: '0 1px', fontStyle: 'normal' }}>{part}</mark>;
      }
      return part;
    });
  }, []);

  const handleBookClick = useCallback((file: FileRecord, color: string, pdfUrl?: string, courseCode?: string, isSyllabus?: boolean, initialSearchQuery?: string, initialPage?: number, openedFromSyllabusCode?: string) => {
    const cc = courseCode || file.folder?.match(/^week-\d+-(.+?)-(module|reading)$/i)?.[1]?.toLowerCase();
    setOpenReaders(prev => {
      if (prev.some(r => r.file.id === file.id)) return prev;
      return [...prev, { file, color, pdfUrl, courseCode: cc, isSyllabus, initialSearchQuery, initialPage, openedFromSyllabusCode }];
    });
    setFocusedReaderId(file.id);
  }, []);
  handleBookClickRef.current = handleBookClick;

  const handleRenameStart = useCallback((file: FileRecord) => {
    setRenamingFile(file);
    setRenameValue(file.displayName || file.originalName);
    setTimeout(() => renameInputRef.current?.select(), 50);
  }, []);

  const handleRenameSave = useCallback(async () => {
    if (!renamingFile || !renameValue.trim()) return;
    setRenameSaving(true);
    try {
      await apiRequest('PATCH', `/api/files/${renamingFile.id}`, { displayName: renameValue.trim() });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      setRenamingFile(null);
    } catch (err) {
      console.error('Rename failed:', err);
    } finally {
      setRenameSaving(false);
    }
  }, [renamingFile, renameValue]);

  const prevSem = useCallback(() => {
    setCurrentSemIdx(i => Math.max(0, i - 1));
  }, []);

  const nextSem = useCallback(() => {
    setCurrentSemIdx(i => Math.min(semesters.length - 1, i + 1));
  }, [semesters.length]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 60) {
      if (diff > 0) nextSem();
      else prevSem();
    }
    setTouchStart(null);
  }, [touchStart, nextSem, prevSem]);

  if (!isOpen) return null;

  const courseCount = Math.max(courseBooks.length, 1);
  const shelfHeight = Math.max(100, Math.min(170, Math.floor((window.innerHeight - 130 - (courseCount - 1) * 15) / courseCount) - 40));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: '#1a1208',
        backgroundImage: `url(${shelfBgImage})`,
        backgroundSize: '100% 100%',
        backgroundPosition: 'center center',
        backgroundRepeat: 'no-repeat',
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <input
        ref={syllabusUploadRef}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && syllabusUploadCodeRef.current) {
            handleSyllabusUpload(file, syllabusUploadCodeRef.current);
          }
          e.target.value = '';
        }}
      />
      <style>{`
        .library-ambience {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse 600px 400px at 50% 20%, rgba(255,180,80,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 300px 200px at 20% 40%, rgba(255,160,60,0.04) 0%, transparent 60%),
            radial-gradient(ellipse 300px 200px at 80% 40%, rgba(255,160,60,0.04) 0%, transparent 60%);
        }
        .shelf-wood {
          background:
            repeating-linear-gradient(90deg, rgba(0,0,0,0.03) 0px, transparent 3px, transparent 8px, rgba(0,0,0,0.02) 12px),
            linear-gradient(180deg,
              #8D6E50 0%,
              #7B5B3A 6%,
              #6D4C35 14%,
              #5D4037 28%,
              #4E342E 42%,
              #5D4037 58%,
              #6D4C41 72%,
              #7B5B3A 86%,
              #8D6E50 94%,
              #7B5B3A 100%
            );
          box-shadow:
            0 6px 18px rgba(0,0,0,0.65),
            0 2px 6px rgba(0,0,0,0.35),
            inset 0 2px 5px rgba(255,255,255,0.12),
            inset 0 -3px 8px rgba(0,0,0,0.45);
          border-top: 1px solid rgba(255,255,255,0.1);
        }
        .shelf-front {
          background:
            repeating-linear-gradient(90deg, rgba(0,0,0,0.02) 0px, transparent 4px, transparent 10px),
            linear-gradient(180deg,
              #8D6E50 0%,
              #7B5B3A 15%,
              #6D4C41 35%,
              #5D4037 60%,
              #4E342E 100%
            );
          box-shadow:
            0 5px 14px rgba(0,0,0,0.55),
            0 10px 25px rgba(0,0,0,0.35),
            inset 0 1px 4px rgba(255,255,255,0.14);
          border-bottom: 2px solid rgba(30,15,5,0.5);
        }
        .book-spine-item {
          will-change: transform, filter;
          transform: translateY(0);
          filter: brightness(1);
          transition: transform 0.2s ease-out, filter 0.2s ease-out;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .book-spine-item.book-hovered {
          filter: brightness(1.15);
          transform: translateY(-8px) !important;
        }
        .semester-nav-btn {
          background: rgba(93,64,55,0.6);
          border: 1px solid rgba(255,255,255,0.25);
          color: #ffffff;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s ease;
          backdrop-filter: blur(10px);
        }
        .semester-nav-btn:hover {
          background: rgba(93,64,55,0.9);
          border-color: rgba(255,255,255,0.5);
          transform: scale(1.1);
        }
        .semester-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .semester-nav-btn:disabled:hover {
          transform: none;
          background: rgba(93,64,55,0.6);
        }
        .library-scroll::-webkit-scrollbar { height: 4px; }
        .library-scroll::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); border-radius: 2px; }
        .library-scroll::-webkit-scrollbar-thumb { background: rgba(212,175,55,0.3); border-radius: 2px; }
      `}</style>

      <div className="library-ambience" />

      {fullSearchView && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 100006, background: 'rgba(10,8,5,0.98)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }} data-testid="full-search-page">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.12)', flexShrink: 0, background: 'rgba(20,16,10,0.95)' }}>
            <button onClick={() => setFullSearchView(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '4px', display: 'flex' }} data-testid="btn-close-full-search"><ArrowLeft size={20} /></button>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px 14px' }}>
              <Search size={16} color="rgba(255,255,255,0.4)" />
              <input
                type="text"
                value={masterSearch}
                onChange={e => setMasterSearch(e.target.value)}
                placeholder="Search documents..."
                autoFocus
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: '15px', outline: 'none', flex: 1, width: '100%' }}
                data-testid="input-full-search"
              />
              {masterSearch && (
                <button onClick={() => setMasterSearch('')} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', padding: '3px', display: 'flex', borderRadius: '50%' }}>
                  <X size={14} color="rgba(255,255,255,0.5)" />
                </button>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', flexShrink: 0 }}>{combinedSearchResults ? combinedSearchResults.length : 0} results</span>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', padding: '10px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, background: 'rgba(15,12,8,0.9)' }}>
            {(() => {
              const fs: React.CSSProperties = { background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '8px', padding: '6px 10px', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer', minWidth: '120px' };
              const as = (v: string) => v !== 'all' ? { ...fs, border: '1px solid rgba(218,165,32,0.5)', background: 'rgba(218,165,32,0.12)' } : fs;
              return (
                <>
                  <select value={masterSemFilter} onChange={e => setMasterSemFilter(e.target.value)} style={as(masterSemFilter)} data-testid="full-search-sem-filter">
                    <option value="all">All Semesters</option>
                    {semesters.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
                  </select>
                  <select value={masterCourseFilter} onChange={e => setMasterCourseFilter(e.target.value)} style={as(masterCourseFilter)} data-testid="full-search-course-filter">
                    <option value="all">All Courses</option>
                    {allCoursesForSearch.map(c => (<option key={c} value={c}>{courseDisplayNames?.[c] || c}</option>))}
                  </select>
                  <select value={masterWeekFilter} onChange={e => setMasterWeekFilter(e.target.value)} style={as(masterWeekFilter)} data-testid="full-search-week-filter">
                    <option value="all">All Weeks</option>
                    {availableWeeks.map(w => (<option key={w} value={String(w)}>Week {w}</option>))}
                  </select>
                  <select value={masterTypeFilter} onChange={e => setMasterTypeFilter(e.target.value as any)} style={as(masterTypeFilter)} data-testid="full-search-type-filter">
                    <option value="all">All Types</option>
                    <option value="module">Modules</option>
                    <option value="reading">Readings</option>
                  </select>
                  <select value={masterFormatFilter} onChange={e => setMasterFormatFilter(e.target.value)} style={as(masterFormatFilter)} data-testid="full-search-format-filter">
                    <option value="all">All Formats</option>
                    {availableFormats.map(f => (<option key={f} value={f}>.{f.toUpperCase()}</option>))}
                  </select>
                  <select value={masterSortBy} onChange={e => setMasterSortBy(e.target.value as any)} style={{ ...fs, borderColor: masterSortBy !== 'relevance' ? 'rgba(218,165,32,0.5)' : undefined, background: masterSortBy !== 'relevance' ? 'rgba(218,165,32,0.12)' : fs.background }} data-testid="full-search-sort">
                    <option value="relevance">Sort: Relevance</option>
                    <option value="name">Sort: Name</option>
                    <option value="week">Sort: Week</option>
                    <option value="date_added">Sort: Date Added</option>
                  </select>
                  {(masterSemFilter !== 'all' || masterCourseFilter !== 'all' || masterWeekFilter !== 'all' || masterTypeFilter !== 'all' || masterFormatFilter !== 'all' || masterSortBy !== 'relevance') && (
                    <button onClick={() => { setMasterSemFilter('all'); setMasterCourseFilter('all'); setMasterWeekFilter('all'); setMasterTypeFilter('all'); setMasterFormatFilter('all'); setMasterSortBy('relevance'); }} style={{ ...fs, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', minWidth: 'auto' }} data-testid="btn-clear-all-filters">Clear Filters</button>
                  )}
                </>
              );
            })()}
          </div>

          {masterSearch.trim() && (parsedQuery.phrases.length > 0 || parsedQuery.required.length > 0 || parsedQuery.optional.length > 1) && (
            <div style={{ padding: '6px 20px', fontSize: '11px', color: 'rgba(130,200,255,0.6)', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
              Searching: {parsedQuery.phrases.map((ph, i) => <span key={`ph${i}`}>{i > 0 && ' + '}<span style={{ color: 'rgba(255,200,100,0.9)' }}>&quot;{ph}&quot;</span></span>)}
              {parsedQuery.required.length > 0 && <>{parsedQuery.phrases.length > 0 && ' + '}{parsedQuery.required.map((r, i) => <span key={`r${i}`}>{i > 0 && ' + '}<span style={{ color: 'rgba(100,220,100,0.9)' }}>+{r}</span></span>)}</>}
              {parsedQuery.optional.length > 0 && <>{(parsedQuery.phrases.length > 0 || parsedQuery.required.length > 0) ? ', also ' : 'any of: '}{parsedQuery.optional.map((o, i) => <span key={`o${i}`}>{i > 0 && ', '}<span style={{ color: 'rgba(130,200,255,0.9)' }}>{o}</span></span>)}</>}
              {ftsLoading && <span style={{ marginLeft: '10px', color: 'rgba(218,165,32,0.7)' }}>searching content...</span>}
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
            {!combinedSearchResults || !hasAnyFilter ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50%', color: 'rgba(255,255,255,0.3)', gap: '12px' }}>
                <Search size={40} strokeWidth={1} />
                <span style={{ fontSize: '14px' }}>Type a search query or select filters to find documents</span>
                <span style={{ fontSize: '11px', opacity: 0.6 }}>Use &quot;quotes&quot; for exact phrases, +word for required terms</span>
              </div>
            ) : combinedSearchResults.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '40%', color: 'rgba(255,255,255,0.35)', gap: '8px' }}>
                <Search size={32} strokeWidth={1} />
                <span style={{ fontSize: '14px' }}>No documents match your search</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {combinedSearchResults.map(r => {
                  const wColor = getBookColor(0, r.courseCode, r.weekNum);
                  return (
                    <div
                      key={r.file.id}
                      onClick={() => {
                        const sq = masterSearch.trim();
                        if (sq) addSearchHistory(sq);
                        handleBookClick(r.file, wColor, undefined, undefined, undefined, sq || undefined, r.ftsPageNum || undefined);
                        setFullSearchView(false);
                      }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s', border: '1px solid transparent' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
                      data-testid={`full-search-result-${r.file.id}`}
                    >
                      <div style={{ width: '5px', minHeight: '48px', borderRadius: '3px', backgroundColor: wColor, flexShrink: 0, marginTop: '2px' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: r.fileType === 'module' ? 'rgba(76,175,80,0.25)' : 'rgba(33,150,243,0.25)', color: r.fileType === 'module' ? '#81C784' : '#64B5F6', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{r.fileType === 'module' ? 'MOD' : 'READ'}</span>
                          {r.fileFormat && (
                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px', backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>{r.fileFormat}</span>
                          )}
                          <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {searchTokens.length ? highlightTokens((r.file.displayName || r.file.originalName).replace(/\.pdf$/i, ''), searchTokens) : (r.file.displayName || r.file.originalName).replace(/\.pdf$/i, '')}
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span style={{ padding: '1px 6px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', fontSize: '10px', fontWeight: 600 }}>{r.courseCode}</span>
                          <span>{courseDisplayNames?.[r.courseCode] || r.courseName}</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>Week {r.weekNum}</span>
                          <span style={{ opacity: 0.5 }}>·</span>
                          <span>{r.semLabel}</span>
                          {r.ftsPageNum && r.ftsPageNum > 0 && (
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(218,165,32,0.2)', color: '#DAA520', border: '1px solid rgba(218,165,32,0.3)' }}>p.{r.ftsPageNum}</span>
                          )}
                        </div>
                        {r.contentSnippet && (
                          <div style={{ fontSize: '12px', color: r.proximitySnippet ? 'rgba(130,255,130,0.75)' : 'rgba(255,200,100,0.65)', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.5, maxHeight: '3em', overflow: 'hidden' }}>
                            {r.proximitySnippet ? (
                              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(100,255,100,0.15)', color: 'rgba(130,255,130,0.9)', marginRight: '6px', textTransform: 'uppercase', letterSpacing: '0.3px', border: '1px solid rgba(100,255,100,0.2)', fontStyle: 'normal' }}>both found</span>
                            ) : (
                              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,200,100,0.15)', color: 'rgba(255,200,100,0.8)', marginRight: '6px', textTransform: 'uppercase', letterSpacing: '0.3px', fontStyle: 'normal' }}>content match</span>
                            )}
                            {searchTokens.length ? highlightTokens(r.contentSnippet!, searchTokens, r.proximitySnippet ? 'rgba(130,255,130,0.3)' : 'rgba(255,200,100,0.3)') : r.contentSnippet}
                          </div>
                        )}
                        {r.ftsHeadline && !r.contentSnippet && (
                          <div style={{ fontSize: '12px', color: 'rgba(218,165,32,0.7)', marginTop: '6px', fontStyle: 'italic', lineHeight: 1.5, maxHeight: '3em', overflow: 'hidden' }} dangerouslySetInnerHTML={{ __html: r.ftsHeadline.replace(/<<(\w+)>>/g, '<mark style="background:rgba(218,165,32,0.3);color:#fff;border-radius:2px;padding:0 2px">$1</mark>').replace(/<</g, '<mark style="background:rgba(218,165,32,0.3);color:#fff;border-radius:2px;padding:0 2px">').replace(/>>/g, '</mark>') }} />
                        )}
                        {!r.contentSnippet && !r.ftsHeadline && r.matchedTokenCount !== undefined && r.matchedTokenCount >= 2 && searchTokens.length >= 2 && (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(100,200,255,0.15)', color: 'rgba(100,200,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>all terms matched</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '33px',
          right: '28px',
          zIndex: 100002,
          background: 'rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '50%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: 'rgba(255,255,255,0.7)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
        data-testid="button-close-library"
      >
        <X size={18} />
      </button>


      {!isSharedView && isFullAccess && (
        <button
          onClick={() => { setIsAiChatOpen(prev => !prev); setTimeout(() => aiChatInputRef.current?.focus(), 100); }}
          style={{
            position: 'absolute',
            bottom: '12px',
            right: '12px',
            zIndex: 100002,
            background: isAiChatOpen ? 'linear-gradient(135deg, #1565c0 0%, #42a5f5 50%, #90caf9 100%)' : 'linear-gradient(135deg, #0a3d7a 0%, #1565c0 50%, #42a5f5 100%)',
            border: `1.5px solid ${isAiChatOpen ? 'rgba(144,202,249,0.6)' : 'rgba(255,255,255,0.3)'}`,
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: '#fff',
            fontSize: '12px',
            boxShadow: '0 4px 12px rgba(10,61,122,0.4)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(10,61,122,0.55)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,61,122,0.4)'; e.currentTarget.style.transform = 'scale(1)'; }}
          data-testid="button-ai-study-chat"
          title="AI Study Assistant"
        >
          <MessageSquare size={16} />
        </button>
      )}

      {!isSharedView && isFullAccess && (
        <button
          onClick={() => { setApaCheckerOpen(true); setApaResult(null); setApaError(''); setApaFile(null); }}
          style={{
            position: 'absolute',
            top: '33px',
            right: '156px',
            zIndex: 100002,
            background: apaCheckerOpen ? 'rgba(34,197,94,0.3)' : 'rgba(0,0,0,0.5)',
            border: apaCheckerOpen ? '1px solid rgba(34,197,94,0.5)' : '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: apaCheckerOpen ? '#86efac' : 'rgba(255,255,255,0.7)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#86efac'; e.currentTarget.style.borderColor = 'rgba(34,197,94,0.5)'; }}
          onMouseLeave={e => { if (!apaCheckerOpen) { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; } }}
          data-testid="button-apa-checker"
          title="APA 7th Edition Checker"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
        </button>
      )}

      {!isSharedView && (
        <button
          onClick={async () => {
            try {
              const currentSem = semesters[currentSemIdx];
              const resp = await apiRequest('POST', '/api/shared-library/create', { semesterKey: currentSem?.key });
              const data = await resp.json();
              const baseUrl = window.location.hostname === 'localhost' || window.location.hostname.startsWith('127.')
                ? `${window.location.origin}`
                : `http://172.24.1.204:5000`;
              setShareLink(`${baseUrl}/shared-library/${data.token}`);
              setShowSharePopup(true);
              setShareCopied(false);
            } catch (err) {
              console.error('Failed to create share link:', err);
            }
          }}
          style={{
            position: 'absolute',
            top: '33px',
            right: '72px',
            zIndex: 100002,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.7)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.5)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
          data-testid="button-share-library"
          title="Share Library"
        >
          <Share2 size={16} />
        </button>
      )}

      {showSharePopup && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          zIndex: 100008,
          background: 'rgba(0,0,0,0.92)',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '12px',
          padding: '16px',
          width: '340px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Link2 size={14} color="#D4AF37" />
              <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>Share Library</span>
            </div>
            <button
              onClick={() => setShowSharePopup(false)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '2px' }}
            >
              <X size={14} />
            </button>
          </div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '10px' }}>
            Anyone with this link can view the library and make their own local annotations.
          </div>
          <div style={{
            display: 'flex', gap: '6px', alignItems: 'center',
            background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px', padding: '6px 8px',
          }}>
            <input
              type="text"
              readOnly
              value={shareLink}
              style={{
                flex: 1, background: 'transparent', border: 'none', color: '#fff',
                fontSize: '10px', outline: 'none', fontFamily: 'monospace',
              }}
              onClick={e => (e.target as HTMLInputElement).select()}
              data-testid="input-share-link"
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareLink).then(() => {
                  setShareCopied(true);
                  setTimeout(() => setShareCopied(false), 2000);
                });
              }}
              style={{
                background: shareCopied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.12)',
                border: shareCopied ? '1px solid rgba(74,222,128,0.5)' : '1px solid rgba(255,255,255,0.2)',
                borderRadius: '6px', padding: '4px 10px', cursor: 'pointer',
                color: shareCopied ? '#4ade80' : '#fff', fontSize: '10px', fontWeight: 600,
                display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap',
              }}
              data-testid="button-copy-share-link"
            >
              {shareCopied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>
          </div>
        </div>
      )}

      {aiSearchOpen && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          zIndex: 100003,
          background: 'rgba(15,10,25,0.96)',
          border: '1px solid rgba(139,92,246,0.3)',
          borderRadius: '16px',
          padding: '20px',
          width: '500px',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 30px rgba(139,92,246,0.1)',
          backdropFilter: 'blur(20px)',
        }} data-testid="ai-search-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
              <span style={{ color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px' }}>AI Document Search</span>
            </div>
            <button onClick={() => { setAiSearchOpen(false); setAiPreview(null); setAiResult(null); setAiError(''); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '2px' }} data-testid="ai-search-close"><X size={16} /></button>
          </div>

          {!aiPreview && !aiResult && (
            <>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.85)', marginBottom: '12px', lineHeight: '1.5' }}>
                Describe what you want to find. Include course codes (CPPA, CFNF, CASL) and file types (Module, Reading) to narrow the search.
              </div>
              <textarea
                ref={aiPromptRef}
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                placeholder="e.g. Look through all CPPA Module and Reading files and find anything related to municipalities and representative government"
                style={{
                  width: '100%',
                  minHeight: '80px',
                  background: '#ffffff',
                  border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: '10px',
                  color: '#000000',
                  fontSize: '13px',
                  padding: '12px',
                  resize: 'vertical',
                  outline: 'none',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.7)'}
                onBlur={e => e.currentTarget.style.borderColor = 'rgba(139,92,246,0.3)'}
                data-testid="ai-search-prompt"
              />
              {aiError && <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }} data-testid="ai-search-error">{aiError}</div>}
              <button
                onClick={async () => {
                  if (!aiPrompt.trim() || aiLoading) return;
                  setAiLoading(true);
                  setAiError('');
                  try {
                    const resp = await fetch('/api/library/ai-search/preview', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ prompt: aiPrompt }),
                    });
                    const data = await resp.json();
                    if (!resp.ok) {
                      if (data.error?.includes('API key not configured')) {
                        setAiError('NO_KEY');
                      } else {
                        setAiError(data.error || 'Search failed');
                      }
                    } else if (data.matchingFiles?.length === 0) {
                      setAiError(data.message || 'No matching files found.');
                    } else {
                      setAiPreview(data);
                      setAiNoteTitle(aiPrompt.length > 40 ? aiPrompt.substring(0, 37) + '...' : aiPrompt);
                    }
                  } catch (err) {
                    setAiError('Failed to connect to server');
                  }
                  setAiLoading(false);
                }}
                disabled={!aiPrompt.trim() || aiLoading}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: 'none',
                  background: !aiPrompt.trim() || aiLoading ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0.4)',
                  color: !aiPrompt.trim() || aiLoading ? 'rgba(255,255,255,0.3)' : '#fff',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: !aiPrompt.trim() || aiLoading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                }}
                data-testid="ai-search-preview-btn"
              >
                {aiLoading ? <><Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} /> Scanning files...</> : <><Search size={14} /> Find matching documents</>}
              </button>

              {aiError === 'NO_KEY' && (
                <div style={{ marginTop: '16px', padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b', marginBottom: '8px' }}>OpenAI API Key Required</div>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', marginBottom: '10px', lineHeight: '1.5' }}>
                    Paste your API key from platform.openai.com. It will be stored locally on this device and never shared.
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="password"
                      placeholder="sk-proj-..."
                      style={{
                        flex: 1,
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '11px',
                        padding: '8px 10px',
                        outline: 'none',
                        fontFamily: 'monospace',
                      }}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter') {
                          const input = e.currentTarget;
                          const key = input.value.trim();
                          if (!key.startsWith('sk-')) return;
                          try {
                            const resp = await fetch('/api/ai/set-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
                            if (resp.ok) { setAiError(''); input.value = ''; }
                            else { const d = await resp.json(); setAiError(d.error || 'Failed to save key'); }
                          } catch { setAiError('Failed to connect'); }
                        }
                      }}
                      data-testid="ai-key-input"
                    />
                    <button
                      onClick={async (e) => {
                        const input = (e.currentTarget.parentElement?.querySelector('input') as HTMLInputElement);
                        const key = input?.value?.trim();
                        if (!key || !key.startsWith('sk-')) return;
                        try {
                          const resp = await fetch('/api/ai/set-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: key }) });
                          if (resp.ok) { setAiError(''); input.value = ''; }
                          else { const d = await resp.json(); setAiError(d.error || 'Failed to save key'); }
                        } catch { setAiError('Failed to connect'); }
                      }}
                      style={{
                        background: 'rgba(245,158,11,0.2)',
                        border: '1px solid rgba(245,158,11,0.4)',
                        borderRadius: '8px',
                        color: '#f59e0b',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '8px 14px',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                      data-testid="ai-key-save-btn"
                    >Save</button>
                  </div>
                </div>
              )}
            </>
          )}

          {aiPreview && !aiResult && (
            <div data-testid="ai-search-confirm">
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} /> {aiPreview.matchingFiles.length} document{aiPreview.matchingFiles.length !== 1 ? 's' : ''} found
              </div>
              <div style={{ maxHeight: '140px', overflowY: 'auto', marginBottom: '12px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px' }}>
                {aiPreview.matchingFiles.map((f: any) => (
                  <div key={f.id} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={10} style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px', flexShrink: 0 }}>{Math.round(f.textLength / 1000)}k chars</span>
                  </div>
                ))}
              </div>

              <div style={{
                padding: '14px',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '10px',
                marginBottom: '14px',
              }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#f59e0b', marginBottom: '8px' }}>Cost Estimate</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: '11px' }}>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Model:</span>
                  <span style={{ color: '#fff' }}>{aiPreview.model}</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Input tokens:</span>
                  <span style={{ color: '#fff' }}>~{aiPreview.estimatedInputTokens?.toLocaleString()}</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Output tokens:</span>
                  <span style={{ color: '#fff' }}>~{aiPreview.estimatedOutputTokens?.toLocaleString()}</span>
                  <span style={{ color: 'rgba(255,255,255,0.85)' }}>Estimated cost:</span>
                  <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '13px' }}>{aiPreview.estimatedCost}</span>
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.85)', display: 'block', marginBottom: '4px' }}>Note title (saved to Notepad)</label>
                <input
                  type="text"
                  value={aiNoteTitle}
                  onChange={e => setAiNoteTitle(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    padding: '8px 10px',
                    outline: 'none',
                  }}
                  data-testid="ai-note-title-input"
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => { setAiPreview(null); }}
                  style={{
                    flex: 1,
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  data-testid="ai-search-cancel-btn"
                >Cancel</button>
                <button
                  onClick={async () => {
                    if (aiExecuting) return;
                    setAiExecuting(true);
                    setAiError('');
                    try {
                      const resp = await fetch('/api/library/ai-search/execute', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          prompt: aiPrompt,
                          fileIds: aiPreview.matchingFiles.map((f: any) => f.id),
                          createNote: true,
                          noteTitle: aiNoteTitle || 'AI Research',
                        }),
                      });
                      const data = await resp.json();
                      if (!resp.ok) {
                        setAiError(data.error || 'Search failed');
                        setAiPreview(null);
                      } else {
                        setAiResult(data);
                      }
                    } catch {
                      setAiError('Failed to connect');
                      setAiPreview(null);
                    }
                    setAiExecuting(false);
                  }}
                  disabled={aiExecuting}
                  style={{
                    flex: 2,
                    padding: '10px',
                    borderRadius: '10px',
                    border: 'none',
                    background: aiExecuting ? 'rgba(139,92,246,0.2)' : 'linear-gradient(135deg, rgba(139,92,246,0.5), rgba(59,130,246,0.5))',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: aiExecuting ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                  data-testid="ai-search-confirm-btn"
                >
                  {aiExecuting ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Researching...</> : <>Confirm & Run ({aiPreview.estimatedCost})</>}
                </button>
              </div>
            </div>
          )}

          {aiResult && (
            <div data-testid="ai-search-result">
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#22c55e', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Check size={14} /> Research complete
              </div>
              {aiResult.actualCost && (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
                  Actual cost: {aiResult.actualCost} | Tokens used: {aiResult.usage?.totalTokens?.toLocaleString()}
                </div>
              )}
              <div
                style={{
                  maxHeight: '300px',
                  overflowY: 'auto',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '16px',
                  fontSize: '12px',
                  color: 'rgba(255,255,255,0.85)',
                  lineHeight: '1.6',
                }}
                dangerouslySetInnerHTML={{ __html: aiResult.result }}
                data-testid="ai-search-result-content"
              />
              {aiResult.noteId && (
                <div style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(139,92,246,0.8)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={12} /> Saved to Notepad as "{aiNoteTitle || 'AI Research'}"
                </div>
              )}
              <button
                onClick={() => { setAiResult(null); setAiPreview(null); setAiPrompt(''); }}
                style={{
                  width: '100%',
                  marginTop: '12px',
                  padding: '10px',
                  borderRadius: '10px',
                  border: '1px solid rgba(139,92,246,0.3)',
                  background: 'rgba(139,92,246,0.1)',
                  color: '#c4b5fd',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                data-testid="ai-search-new-btn"
              >New Search</button>
            </div>
          )}
        </div>
      )}

      {apaCheckerOpen && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          zIndex: 100004,
          background: 'rgba(10,15,10,0.97)',
          border: '1px solid rgba(34,197,94,0.3)',
          borderRadius: '16px',
          padding: '20px',
          width: '480px',
          maxHeight: 'calc(100vh - 100px)',
          overflowY: 'auto',
          boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 30px rgba(34,197,94,0.08)',
          backdropFilter: 'blur(20px)',
        }} data-testid="apa-checker-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9 15l2 2 4-4"/></svg>
              <span style={{ color: '#fff', fontSize: '15px', fontWeight: 700, letterSpacing: '0.5px' }}>APA 7th Edition Checker</span>
            </div>
            <button onClick={() => setApaCheckerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)', padding: '2px' }} data-testid="apa-checker-close"><X size={16} /></button>
          </div>

          {!apaResult && !apaLoading && (
            <>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '14px', lineHeight: '1.5' }}>
                Upload your essay or paper (.docx or .txt) and get a detailed APA 7th Edition compliance report with specific issues and fixes.
              </div>
              <div
                onDragOver={e => { e.preventDefault(); setApaDragOver(true); }}
                onDragLeave={() => setApaDragOver(false)}
                onDrop={e => { e.preventDefault(); setApaDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setApaFile(f); } }}
                onClick={() => apaFileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${apaDragOver ? 'rgba(34,197,94,0.7)' : apaFile ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.15)'}`,
                  borderRadius: '12px',
                  padding: '32px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: apaDragOver ? 'rgba(34,197,94,0.08)' : apaFile ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                  marginBottom: '16px',
                }}
                data-testid="apa-drop-zone"
              >
                <input
                  ref={apaFileInputRef}
                  type="file"
                  accept=".docx,.txt"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) setApaFile(f); e.target.value = ''; }}
                  data-testid="apa-file-input"
                />
                {apaFile ? (
                  <div>
                    <div style={{ color: '#86efac', fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>{apaFile.name}</div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>{(apaFile.size / 1024).toFixed(1)} KB — Click to change</div>
                  </div>
                ) : (
                  <div>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontWeight: 500 }}>Drop your document here</div>
                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '4px' }}>or click to browse (.docx, .txt)</div>
                  </div>
                )}
              </div>
              {apaError && <div style={{ color: '#ef4444', fontSize: '11px', marginBottom: '12px', padding: '8px', background: 'rgba(239,68,68,0.1)', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }} data-testid="apa-error">{apaError}</div>}
              <button
                onClick={() => { if (apaFile) runApaCheck(apaFile); }}
                disabled={!apaFile}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  background: apaFile ? 'linear-gradient(135deg, #22c55e, #16a34a)' : 'rgba(255,255,255,0.1)',
                  color: apaFile ? '#fff' : 'rgba(255,255,255,0.3)',
                  fontWeight: 700,
                  fontSize: '14px',
                  cursor: apaFile ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  letterSpacing: '0.5px',
                }}
                data-testid="apa-check-btn"
              >
                Check APA Formatting
              </button>
            </>
          )}

          {apaLoading && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{
                width: '40px', height: '40px', border: '3px solid rgba(34,197,94,0.2)', borderTopColor: '#22c55e',
                borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px',
              }} />
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>Analyzing your document...</div>
              <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', marginTop: '6px' }}>Checking citations, formatting, and references</div>
            </div>
          )}

          {apaResult && (
            <div data-testid="apa-result">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '50%',
                  background: `conic-gradient(${apaResult.overallScore >= 80 ? '#22c55e' : apaResult.overallScore >= 50 ? '#f59e0b' : '#ef4444'} ${apaResult.overallScore * 3.6}deg, rgba(255,255,255,0.1) 0deg)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(10,15,10,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: apaResult.overallScore >= 80 ? '#86efac' : apaResult.overallScore >= 50 ? '#fcd34d' : '#fca5a5', fontSize: '16px', fontWeight: 800 }}>{apaResult.overallScore}</span>
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '14px', fontWeight: 700, marginBottom: '2px' }}>{apaResult.fileName}</div>
                  <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '11px' }}>{apaResult.wordCount?.toLocaleString()} words</div>
                </div>
              </div>

              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', marginBottom: '16px', lineHeight: '1.5', padding: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px' }}>
                {apaResult.summary}
              </div>

              {(() => {
                const issues = apaResult.issues || [];
                const errors = issues.filter((i: any) => i.severity === 'error');
                const warnings = issues.filter((i: any) => i.severity === 'warning');
                const suggestions = issues.filter((i: any) => i.severity === 'suggestion');
                return (
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <div style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                      <div style={{ color: '#fca5a5', fontSize: '18px', fontWeight: 800 }}>{errors.length}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Errors</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', textAlign: 'center' }}>
                      <div style={{ color: '#fcd34d', fontSize: '18px', fontWeight: 800 }}>{warnings.length}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Warnings</div>
                    </div>
                    <div style={{ flex: 1, padding: '8px', borderRadius: '8px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', textAlign: 'center' }}>
                      <div style={{ color: '#93c5fd', fontSize: '18px', fontWeight: 800 }}>{suggestions.length}</div>
                      <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tips</div>
                    </div>
                  </div>
                );
              })()}

              {(apaResult.strengths || []).length > 0 && (
                <div style={{ marginBottom: '16px', padding: '10px', background: 'rgba(34,197,94,0.08)', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <div style={{ color: '#86efac', fontSize: '11px', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Strengths</div>
                  {(apaResult.strengths as string[]).map((s: string, i: number) => (
                    <div key={i} style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', lineHeight: '1.5', paddingLeft: '12px', position: 'relative', marginBottom: '3px' }}>
                      <span style={{ position: 'absolute', left: 0, color: '#86efac' }}>✓</span> {s}
                    </div>
                  ))}
                </div>
              )}

              {(() => {
                const issues = apaResult.issues || [];
                const categories = [...new Set(issues.map((i: any) => i.category))];
                return categories.map((cat: string) => {
                  const catIssues = issues.filter((i: any) => i.category === cat);
                  const isExpanded = apaExpandedCats.has(cat);
                  const hasErrors = catIssues.some((i: any) => i.severity === 'error');
                  const hasWarnings = catIssues.some((i: any) => i.severity === 'warning');
                  return (
                    <div key={cat} style={{ marginBottom: '8px', borderRadius: '10px', border: `1px solid ${hasErrors ? 'rgba(239,68,68,0.2)' : hasWarnings ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'}`, overflow: 'hidden' }}>
                      <button
                        onClick={() => setApaExpandedCats(prev => { const next = new Set(prev); if (next.has(cat)) next.delete(cat); else next.add(cat); return next; })}
                        style={{
                          width: '100%', padding: '10px 12px', background: hasErrors ? 'rgba(239,68,68,0.06)' : hasWarnings ? 'rgba(245,158,11,0.06)' : 'rgba(59,130,246,0.06)',
                          border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: '#fff', fontSize: '12px', fontWeight: 600,
                        }}
                        data-testid={`apa-cat-${cat.replace(/\s/g, '-').toLowerCase()}`}
                      >
                        <span>{cat} ({catIssues.length})</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
                      </button>
                      {isExpanded && catIssues.map((issue: any, idx: number) => (
                        <div key={idx} style={{ padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                            <span style={{
                              fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', textTransform: 'uppercase',
                              background: issue.severity === 'error' ? 'rgba(239,68,68,0.2)' : issue.severity === 'warning' ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
                              color: issue.severity === 'error' ? '#fca5a5' : issue.severity === 'warning' ? '#fcd34d' : '#93c5fd',
                            }}>{issue.severity}</span>
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '11px', lineHeight: '1.5', marginBottom: '4px' }}>{issue.description}</div>
                          {issue.location && (
                            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px', fontStyle: 'italic', marginBottom: '4px', padding: '4px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: '4px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                              "{issue.location.length > 100 ? issue.location.slice(0, 100) + '...' : issue.location}"
                            </div>
                          )}
                          <div style={{ color: '#86efac', fontSize: '10px', lineHeight: '1.4' }}>
                            <strong>Fix:</strong> {issue.fix}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                });
              })()}

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                <button
                  onClick={() => { setApaResult(null); setApaFile(null); setApaError(''); setApaExpandedCats(new Set()); }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                  data-testid="apa-new-check-btn"
                >Check Another</button>
                <button
                  onClick={() => {
                    const issues = apaResult.issues || [];
                    let text = `APA 7th Edition Check — ${apaResult.fileName}\nScore: ${apaResult.overallScore}/100\n${apaResult.summary}\n\n`;
                    issues.forEach((i: any) => { text += `[${i.severity.toUpperCase()}] ${i.category}: ${i.description}\n  Fix: ${i.fix}\n\n`; });
                    navigator.clipboard.writeText(text);
                  }}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                  }}
                  data-testid="apa-copy-btn"
                >Copy Report</button>
              </div>
            </div>
          )}
        </div>
      )}

      {isAiChatOpen && (
        <div style={{
          position: 'absolute',
          bottom: '56px',
          right: '12px',
          width: '520px',
          maxWidth: '95vw',
          maxHeight: 'calc(100vh - 100px)',
          background: 'linear-gradient(180deg, #0a2a5e 0%, #0d3a7a 20%, #154B96 50%, #1a5ab0 80%, #ACD6F2 100%)',
          border: '1.5px solid rgba(144,202,249,0.35)',
          borderRadius: '14px',
          zIndex: 100005,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(10,42,94,0.6), 0 4px 12px rgba(0,0,0,0.3)',
        }} data-testid="ai-chat-panel">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} color="#ffffff" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>Study Assistant</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={aiChatCourseFilter}
                onChange={e => setAiChatCourseFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}
                data-testid="select-ai-chat-course"
              >
                <option value="all">All courses</option>
                {['CPPA122','CFNF400','CASL101','CPPA101','CPPA102','CPPA120','CPPA121','CPPA125','CECN210','CPHL110','CHIS105'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <button onClick={() => { setAiChatMessages([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px' }} title="Clear chat" data-testid="button-ai-chat-clear">
                <RotateCcw size={15} />
              </button>
              <button onClick={() => setIsAiChatOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px' }} data-testid="button-ai-chat-close">
                <X size={15} />
              </button>
            </div>
          </div>

          <div ref={aiChatScrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '280px', maxHeight: '500px' }}>
            {aiChatMessages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 14px', color: 'rgba(255,255,255,0.5)' }}>
                <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4, color: '#fff' }} />
                <div style={{ fontSize: '14px', marginBottom: '16px', color: '#fff' }}>Ask questions about your course materials</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  {['Summarize the key concepts from CFNF module 3', 'Generate flashcards for CPPA122 week 5', 'What are the main arguments in the CASL reading?', 'Compare the theories discussed in CPHL110'].map(ex => (
                    <div
                      key={ex}
                      onClick={() => { setAiChatInput(ex); aiChatInputRef.current?.focus(); }}
                      style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', transition: 'all 0.15s', color: '#fff' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>→</span> {ex}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {aiChatMessages.map((msg, i) => (
              <div key={i} style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '90%',
                  padding: '10px 14px',
                  borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: msg.role === 'user' ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.1)',
                  border: `1px solid ${msg.role === 'user' ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.15)'}`,
                  fontSize: '13px',
                  color: '#ffffff',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiChatLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking...
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={aiChatInputRef}
              value={aiChatInput}
              onChange={e => setAiChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiChat(); } }}
              placeholder="Ask about your readings..."
              rows={1}
              style={{
                flex: 1, background: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '12px', padding: '12px 16px', color: '#1a1a2e', fontSize: '14px',
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                minHeight: '44px', maxHeight: '90px',
              }}
              data-testid="input-ai-chat"
            />
            <button
              onClick={sendAiChat}
              disabled={!aiChatInput.trim() || aiChatLoading}
              style={{
                background: aiChatInput.trim() ? 'linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)' : 'rgba(255,255,255,0.15)',
                border: 'none', borderRadius: '12px', padding: '0 16px',
                color: '#fff', cursor: aiChatInput.trim() ? 'pointer' : 'default',
                opacity: aiChatInput.trim() && !aiChatLoading ? 1 : 0.5,
                transition: 'all 0.15s',
                minHeight: '44px',
              }}
              data-testid="button-ai-chat-send"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffffff"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
            </button>
          </div>
        </div>
      )}

      {/* Semester navigation - top right area */}
      <div style={{
        position: 'absolute',
        top: '32px',
        right: '164px',
        zIndex: 100002,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <button
          onClick={prevSem}
          disabled={currentSemIdx === 0}
          data-testid="btn-library-prev-sem"
          style={{
            width: '37px',
            height: '37px',
            borderRadius: '50%',
            background: currentSemIdx === 0 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.5)',
            border: currentSemIdx === 0 ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.2)',
            color: currentSemIdx === 0 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
            cursor: currentSemIdx === 0 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (currentSemIdx > 0) { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = '#fff'; }}}
          onMouseLeave={e => { if (currentSemIdx > 0) { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {semesters.map((sem, idx) => (
            <div
              key={sem.key}
              onClick={() => setCurrentSemIdx(idx)}
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                backgroundColor: idx === currentSemIdx ? '#ffffff' : 'rgba(255,255,255,0.25)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: idx === currentSemIdx ? '0 0 6px rgba(255,255,255,0.5)' : 'none',
              }}
              data-testid={`library-sem-dot-${sem.key}`}
            />
          ))}
        </div>
        <button
          onClick={nextSem}
          disabled={currentSemIdx === semesters.length - 1}
          data-testid="btn-library-next-sem"
          style={{
            width: '37px',
            height: '37px',
            borderRadius: '50%',
            background: currentSemIdx >= semesters.length - 1 ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.5)',
            border: currentSemIdx >= semesters.length - 1 ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.2)',
            color: currentSemIdx >= semesters.length - 1 ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.7)',
            cursor: currentSemIdx >= semesters.length - 1 ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (currentSemIdx < semesters.length - 1) { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = '#fff'; }}}
          onMouseLeave={e => { if (currentSemIdx < semesters.length - 1) { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; }}}
        >
          <ChevronRight size={16} />
        </button>
        <button
          onClick={() => setShowLibraryNote(true)}
          data-testid="btn-library-notepad"
          title="Open Library Note"
          style={{
            width: '37px',
            height: '37px',
            borderRadius: '50%',
            background: showLibraryNote ? 'rgba(212,175,55,0.25)' : 'rgba(0,0,0,0.5)',
            border: showLibraryNote ? '1px solid rgba(212,175,55,0.4)' : '1px solid rgba(255,255,255,0.2)',
            color: showLibraryNote ? 'rgba(212,175,55,0.9)' : 'rgba(255,255,255,0.7)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { if (!showLibraryNote) { e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; e.currentTarget.style.color = '#fff'; } }}
          onMouseLeave={e => { if (!showLibraryNote) { e.currentTarget.style.background = 'rgba(0,0,0,0.5)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; } }}
        >
          <StickyNote size={16} />
        </button>
      </div>

      <div style={{
        position: 'absolute',
        top: '29px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 100002,
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#ffffff',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}>
            Library
          </div>
          <div style={{
            fontSize: '12px',
            color: '#ffffff',
            letterSpacing: '1px',
            marginTop: '2px',
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}>
            {currentSemester?.label || ''}
            {currentSemester && (currentSemester as any).isCurrent && <span style={{ marginLeft: '6px', fontSize: '8px', padding: '1px 5px', borderRadius: '6px', background: 'rgba(76,175,80,0.3)', color: '#81C784', fontFamily: 'sans-serif', letterSpacing: '0.3px', verticalAlign: 'middle' }}>CURRENT</span>}
            {currentSemester && (currentSemester as any).isPast && <span style={{ marginLeft: '6px', fontSize: '8px', padding: '1px 5px', borderRadius: '6px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontFamily: 'sans-serif', letterSpacing: '0.3px', verticalAlign: 'middle' }}>PAST</span>}
            {currentSemester && (currentSemester as any).isFuture && <span style={{ marginLeft: '6px', fontSize: '8px', padding: '1px 5px', borderRadius: '6px', background: 'rgba(33,150,243,0.25)', color: '#64B5F6', fontFamily: 'sans-serif', letterSpacing: '0.3px', verticalAlign: 'middle' }}>UPCOMING</span>}
          </div>
        </div>
        <button
          onClick={async () => {
            const semKey = currentSemester?.key;
            if (!semKey || syncingSemKey) return;
            setSyncingSemKey(semKey);
            try {
              await fetch('/api/library/sync-semester', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ semesterKey: semKey }),
              });
              for (const delay of [5000, 15000, 30000, 60000]) {
                setTimeout(() => refetchFiles(), delay);
              }
              setTimeout(() => setSyncingSemKey(null), 30000);
            } catch {
              setSyncingSemKey(null);
            }
          }}
          disabled={!!syncingSemKey}
          style={{
            background: syncingSemKey === currentSemester?.key ? 'rgba(76,175,80,0.2)' : 'rgba(255,255,255,0.45)',
            border: syncingSemKey === currentSemester?.key ? '1px solid rgba(76,175,80,0.4)' : '1px solid rgba(255,255,255,0.5)',
            borderRadius: '6px',
            padding: '4px 8px',
            color: syncingSemKey === currentSemester?.key ? '#81C784' : '#ffffff',
            fontSize: '9px',
            cursor: syncingSemKey ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
            fontWeight: 600,
            letterSpacing: '0.3px',
          }}
          onMouseEnter={e => { if (!syncingSemKey) { e.currentTarget.style.background = 'rgba(255,255,255,0.55)'; e.currentTarget.style.color = '#fff'; }}}
          onMouseLeave={e => { if (!syncingSemKey) { e.currentTarget.style.background = 'rgba(255,255,255,0.45)'; e.currentTarget.style.color = '#ffffff'; }}}
          title={`Sync all files for ${currentSemester?.label || 'this semester'} from OneDrive`}
          data-testid="btn-library-sync-semester"
        >
          <RefreshCw size={11} style={syncingSemKey === currentSemester?.key ? { animation: 'spin 1s linear infinite' } : {}} />
          {syncingSemKey === currentSemester?.key ? 'Syncing...' : 'Sync'}
        </button>
      </div>

      {/* Search box - top left compact */}
      {isFullAccess ? <div style={{
        position: 'absolute',
        top: '34px',
        left: '28px',
        zIndex: 100008,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: 'rgba(10,6,4,0.92)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            padding: '7px 12px',
            width: '220px',
          }}>
            <Search size={14} color="rgba(255,255,255,0.5)" />
            <input
              type="text"
              value={masterSearch}
              onChange={e => setMasterSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
              placeholder="Search..."
              style={{
                background: 'transparent',
                border: 'none',
                color: '#fff',
                fontSize: '13px',
                outline: 'none',
                flex: 1,
                width: '100%',
              }}
              data-testid="input-master-search"
            />
            {hasAnyFilter && (
              <button
                onClick={() => { setMasterSearch(''); setMasterSemFilter('all'); setMasterCourseFilter('all'); setMasterWeekFilter('all'); setMasterTypeFilter('all'); setMasterFormatFilter('all'); setMasterSortBy('relevance'); }}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', padding: '3px', display: 'flex', borderRadius: '50%', flexShrink: 0 }}
                data-testid="btn-clear-search"
              >
                <X size={12} color="rgba(255,255,255,0.6)" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '10px',
              background: showFilters ? 'rgba(218,165,32,0.2)' : 'rgba(10,6,4,0.92)',
              border: showFilters ? '1px solid rgba(218,165,32,0.5)' : '1px solid rgba(255,255,255,0.15)',
              color: showFilters ? 'rgba(218,165,32,0.9)' : 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s',
              flexShrink: 0,
            }}
            data-testid="btn-toggle-filters"
          >
            <ChevronDown size={16} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
          {!isSharedView && isFullAccess && (
            <button
              onClick={() => { setAiSearchOpen(true); setAiPreview(null); setAiResult(null); setAiError(''); setAiNoteTitle(''); }}
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: aiSearchOpen ? 'rgba(139,92,246,0.3)' : 'rgba(10,6,4,0.92)',
                border: aiSearchOpen ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.15)',
                color: aiSearchOpen ? '#c4b5fd' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#c4b5fd'; e.currentTarget.style.borderColor = 'rgba(139,92,246,0.5)'; }}
              onMouseLeave={e => { if (!aiSearchOpen) { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; } }}
              data-testid="button-ai-search"
              title="AI Document Search"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/></svg>
            </button>
          )}
        </div>

        {showFilters && (
          <div style={{
            marginTop: '6px',
            background: 'rgba(10,6,4,0.95)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            padding: '10px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            width: '260px',
          }}>
            {(() => {
              const filterStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', padding: '5px 10px', color: '#fff', fontSize: '12px', outline: 'none', cursor: 'pointer', width: '100%' };
              const activeStyle = (v: string) => v !== 'all' ? { ...filterStyle, border: '1px solid rgba(218,165,32,0.6)', background: 'rgba(218,165,32,0.15)' } : filterStyle;
              return (
                <>
                  <select value={masterSemFilter} onChange={e => setMasterSemFilter(e.target.value)} style={activeStyle(masterSemFilter)} data-testid="select-master-sem-filter">
                    <option value="all">All Semesters</option>
                    {semesters.map(s => (<option key={s.key} value={s.key}>{s.label}</option>))}
                  </select>
                  <select value={masterCourseFilter} onChange={e => setMasterCourseFilter(e.target.value)} style={activeStyle(masterCourseFilter)} data-testid="select-master-course-filter">
                    <option value="all">All Courses</option>
                    {allCoursesForSearch.map(c => (<option key={c} value={c}>{c}</option>))}
                  </select>
                  <select value={masterWeekFilter} onChange={e => setMasterWeekFilter(e.target.value)} style={activeStyle(masterWeekFilter)} data-testid="select-master-week-filter">
                    <option value="all">All Weeks</option>
                    {availableWeeks.map(w => (<option key={w} value={String(w)}>Week {w}</option>))}
                  </select>
                  <select value={masterTypeFilter} onChange={e => setMasterTypeFilter(e.target.value as any)} style={activeStyle(masterTypeFilter)} data-testid="select-master-type-filter">
                    <option value="all">All Types</option>
                    <option value="module">Module</option>
                    <option value="reading">Reading</option>
                  </select>
                  <select value={masterFormatFilter} onChange={e => setMasterFormatFilter(e.target.value)} style={activeStyle(masterFormatFilter)} data-testid="select-master-format-filter">
                    <option value="all">All Formats</option>
                    {availableFormats.map(f => (<option key={f} value={f}>.{f.toUpperCase()}</option>))}
                  </select>
                  <select value={masterSortBy} onChange={e => setMasterSortBy(e.target.value as any)} style={{ ...filterStyle, borderColor: masterSortBy !== 'relevance' ? 'rgba(218,165,32,0.6)' : undefined, background: masterSortBy !== 'relevance' ? 'rgba(218,165,32,0.15)' : filterStyle.background }} data-testid="select-master-sort">
                    <option value="relevance">Sort: Default</option>
                    <option value="name">Sort: Name</option>
                    <option value="week">Sort: Week</option>
                  </select>
                </>
              );
            })()}
          </div>
        )}

        {searchFocused && (() => {
          const q = masterSearch.toLowerCase().trim();
          const matching = q.length === 0
            ? searchHistory.slice(0, 8)
            : searchHistory.filter(h => h.query.toLowerCase().includes(q) && h.query.toLowerCase() !== q).slice(0, 5);
          if (matching.length === 0) return null;
          return (
            <div style={{
              marginTop: '4px',
              background: 'rgba(10,6,4,0.95)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '6px 8px',
              maxWidth: '375px',
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent</div>
              {matching.map((h, i) => {
                const daysAgo = Math.floor((Date.now() - h.timestamp) / (24 * 60 * 60 * 1000));
                const timeLabel = daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : `${daysAgo}d ago`;
                return (
                  <div
                    key={i}
                    onMouseDown={e => { e.preventDefault(); setMasterSearch(h.query); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '5px 8px', borderRadius: '6px', cursor: 'pointer',
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                    data-testid={`search-history-${i}`}
                  >
                    <Clock size={12} color="rgba(255,255,255,0.3)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', flex: 1 }}>{h.query}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{timeLabel}</span>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {combinedSearchResults && (
          <div style={{
            marginTop: '6px',
            background: 'rgba(10,6,4,0.95)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '10px',
            padding: '10px 12px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            maxWidth: '620px',
          }}>
          <div style={{
            maxHeight: 'calc(100vh - 180px)',
            overflowY: 'auto',
          }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>
              {combinedSearchResults.length} result{combinedSearchResults.length !== 1 ? 's' : ''} found
              {ftsLoading && <span style={{ marginLeft: '8px', fontSize: '10px', color: 'rgba(218,165,32,0.7)' }}>searching content...</span>}
              {masterSearch.trim() && (parsedQuery.phrases.length > 0 || parsedQuery.required.length > 0 || parsedQuery.optional.length > 1) && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: 'rgba(130,200,255,0.6)' }}>
                  ({parsedQuery.phrases.map((ph, i) => <span key={`ph${i}`}>{i > 0 && ' + '}<span style={{ color: 'rgba(255,200,100,0.9)' }}>&quot;{ph}&quot;</span></span>)}
                  {parsedQuery.required.length > 0 && <>{parsedQuery.phrases.length > 0 && ' + '}{parsedQuery.required.map((r, i) => <span key={`r${i}`}>{i > 0 && ' + '}<span style={{ color: 'rgba(100,220,100,0.9)' }}>+{r}</span></span>)}</>}
                  {parsedQuery.optional.length > 0 && <>{(parsedQuery.phrases.length > 0 || parsedQuery.required.length > 0) ? ', also ' : 'matching any: '}{parsedQuery.optional.map((o, i) => <span key={`o${i}`}>{i > 0 && ', '}<span style={{ color: 'rgba(130,200,255,0.9)' }}>{o}</span></span>)}</>})
                </span>
              )}
              {masterSearch.trim() && combinedSearchResults.some(r => r.contentSnippet) && (
                <span style={{ marginLeft: '6px', fontSize: '10px', color: 'rgba(255,200,100,0.6)' }}>
                  ({combinedSearchResults.filter(r => r.contentSnippet).length} from content{combinedSearchResults.some(r => r.proximitySnippet) ? `, ${combinedSearchResults.filter(r => r.proximitySnippet).length} nearby` : ''})
                </span>
              )}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setFullSearchView(true); }}
                style={{ background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: '6px', padding: '3px 8px', cursor: 'pointer', color: '#c4b5fd', fontSize: '10px', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
                data-testid="btn-open-full-search"
              >Full Page</button>
            </div>
            {combinedSearchResults.length === 0 && (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                No documents match your search
              </div>
            )}
            {combinedSearchResults.map(r => {
              const wColor = getBookColor(0, r.courseCode, r.weekNum);
              return (
                <div
                  key={r.file.id}
                  onClick={() => {
                    const sq = masterSearch.trim();
                    if (sq) addSearchHistory(sq);
                    handleBookClick(r.file, wColor, undefined, undefined, undefined, sq || undefined, r.ftsPageNum || undefined);
                    setMasterSearch(''); setMasterSemFilter('all'); setMasterCourseFilter('all'); setMasterWeekFilter('all'); setMasterTypeFilter('all'); setMasterFormatFilter('all'); setMasterSortBy('relevance');
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                    marginBottom: '0px',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    paddingBottom: '10px',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  data-testid={`search-result-${r.file.id}`}
                >
                  <div style={{
                    width: '6px',
                    height: '44px',
                    borderRadius: '3px',
                    backgroundColor: wColor,
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        fontSize: '10px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                        backgroundColor: r.fileType === 'module' ? 'rgba(76,175,80,0.25)' : 'rgba(33,150,243,0.25)',
                        color: r.fileType === 'module' ? '#81C784' : '#64B5F6',
                        flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.5px',
                      }}>{r.fileType === 'module' ? 'MOD' : 'READ'}</span>
                      {r.fileFormat && (
                        <span style={{
                          fontSize: '9px', fontWeight: 700, padding: '2px 5px', borderRadius: '4px',
                          backgroundColor: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)',
                          flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.3px',
                        }}>{r.fileFormat}</span>
                      )}
                      <span style={{ fontSize: '14px', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {searchTokens.length ? highlightTokens((r.file.displayName || r.file.originalName).replace(/\.pdf$/i, ''), searchTokens) : (r.file.displayName || r.file.originalName).replace(/\.pdf$/i, '')}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', marginTop: '3px' }}>
                      {r.courseCode} — {r.courseName} · Week {r.weekNum} · {r.semLabel}
                      {r.ftsPageNum && r.ftsPageNum > 0 && (
                        <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', backgroundColor: 'rgba(218,165,32,0.2)', color: '#DAA520', border: '1px solid rgba(218,165,32,0.3)' }}>
                          p.{r.ftsPageNum}
                        </span>
                      )}
                    </div>
                    {r.contentSnippet && (
                      <div style={{ fontSize: '11px', color: r.proximitySnippet ? 'rgba(130,255,130,0.8)' : 'rgba(255,200,100,0.7)', marginTop: '4px', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {r.proximitySnippet ? (
                          <span data-testid="badge-both-found" style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(100,255,100,0.15)', color: 'rgba(130,255,130,0.9)', marginRight: '6px', textTransform: 'uppercase', letterSpacing: '0.3px', border: '1px solid rgba(100,255,100,0.2)' }}>both found</span>
                        ) : (
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(255,200,100,0.15)', color: 'rgba(255,200,100,0.8)', marginRight: '6px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>content match</span>
                        )}
                        {searchTokens.length ? highlightTokens(r.contentSnippet!, searchTokens, r.proximitySnippet ? 'rgba(130,255,130,0.3)' : 'rgba(255,200,100,0.3)') : r.contentSnippet}
                      </div>
                    )}
                    {!r.contentSnippet && r.matchedTokenCount !== undefined && r.matchedTokenCount >= 2 && searchTokens.length >= 2 && (
                      <div style={{ marginTop: '3px' }}>
                        <span data-testid="badge-all-tokens" style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: 'rgba(100,200,255,0.15)', color: 'rgba(100,200,255,0.9)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>all terms matched</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        )}
      </div> : null}

      <div
        ref={scrollRef}
        style={{
          position: 'absolute',
          top: '90px',
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'hidden',
          overflowX: 'hidden',
          padding: '20px 20px 10px 20px',
          paddingBottom: '80px',
          ...(courseBooks.length > 0
            ? { display: 'grid', gridTemplateRows: `repeat(${Math.max(courseBooks.length, 1)}, 1fr)` }
            : { display: 'flex', flexDirection: 'column' as const, justifyContent: 'center' }),
        }}
      >
        {courseBooks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60%',
            color: 'rgba(255,255,255,0.3)',
            gap: '12px',
          }}>
            <BookOpen size={48} strokeWidth={1} />
            <span style={{ fontSize: '14px', fontFamily: "'Georgia', serif" }}>
              No books found for {currentSemester?.label || 'this semester'}
            </span>
            <span style={{ fontSize: '11px', opacity: 0.6 }}>
              Sync your course modules and readings to populate the library
            </span>
            <button
              data-testid="button-sync-semester-library"
              onClick={async () => {
                if (!currentSemester?.key) return;
                const btn = document.querySelector('[data-testid="button-sync-semester-library"]') as HTMLButtonElement;
                if (btn) { btn.textContent = 'Syncing...'; btn.style.opacity = '0.5'; btn.disabled = true; }
                try {
                  const syncUrl = currentSemester.key === 'docdump' ? '/api/library/sync-document-dump' : '/api/library/sync-semester';
                  const syncBody = currentSemester.key === 'docdump' ? undefined : JSON.stringify({ semesterKey: currentSemester.key });
                  await fetch(syncUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: syncBody });
                  for (const delay of [5000, 15000, 30000, 60000]) {
                    setTimeout(() => refetchFiles(), delay);
                  }
                  if (btn) { btn.textContent = 'Syncing in background...'; }
                  setTimeout(() => { if (btn) { btn.textContent = 'Sync from OneDrive'; btn.style.opacity = '1'; btn.disabled = false; } }, 65000);
                } catch { if (btn) { btn.textContent = 'Sync failed'; btn.style.opacity = '1'; btn.disabled = false; } }
              }}
              style={{
                marginTop: '8px',
                padding: '8px 20px',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '8px',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.15)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.8)'; }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.target as HTMLElement).style.color = 'rgba(255,255,255,0.6)'; }}
            >
              <RefreshCw size={14} />
              Sync from OneDrive
            </button>
          </div>
        ) : (
          courseBooks.map(({ course, files: courseFiles }, courseIdx) => {
            const semKey = semesters[currentSemIdx]?.key || '';
            const collapseKey = `${semKey}::${course.code}`;
            const isCollapsed = collapsedCourses.has(collapseKey);
            const REF_SHELF_HEIGHT = 170;
            const shelfScale = shelfHeight / REF_SHELF_HEIGHT;
            const shelfCalibrationByCode: Record<string, { row: number; label: number; labelRight?: number }> = {
              'CPPA122': { row: 48, label: -4, labelRight: 8 },
              'CFNF400': { row: 103, label: -18, labelRight: 8 },
              'CASL101': { row: 98, label: -18, labelRight: 8 },
            };
            const shelfCalibrationByIndex: { row: number; label: number; labelRight?: number }[] = [
              { row: 48, label: -4, labelRight: 8 },
              { row: 103, label: -18, labelRight: 8 },
              { row: 98, label: -18, labelRight: 8 },
            ];
            const codeKey = course.code.replace(/\s/g, '').toUpperCase();
            const calib = shelfCalibrationByCode[codeKey] || shelfCalibrationByIndex[courseIdx] || shelfCalibrationByIndex[shelfCalibrationByIndex.length - 1] || { row: 0, label: 0 };
            const rowShift = Math.round(calib.row * shelfScale);
            const labelShift = Math.round(calib.label * shelfScale);
            const labelRight = Math.round((calib.labelRight || 0) * shelfScale);
            return (
            <div key={course.code} style={{ position: 'relative', overflow: 'visible', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', transform: `translateY(${rowShift}px)`, zIndex: courseBooks.length - courseIdx }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                paddingLeft: '8px',
                cursor: 'pointer',
                userSelect: 'none',
                position: 'absolute',
                bottom: '4px',
                transform: `translate(${labelRight}px, ${labelShift}px)`,
                zIndex: 50,
                left: 'calc(30% + 141px)',
              }}
              onClick={() => {
                setCollapsedCourses(prev => {
                  const next = new Set(prev);
                  if (next.has(collapseKey)) next.delete(collapseKey);
                  else next.add(collapseKey);
                  localStorage.setItem('library-collapsed-courses', JSON.stringify([...next]));
                  return next;
                });
              }}
              data-testid={`toggle-shelf-${course.code}`}
              >
                {!isCollapsed && (() => {
                  const code = course.code;
                  const hasSyllabus = !!syllabusPaths[code];
                  return (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      if (hasSyllabus) {
                        const path = syllabusPaths[code];
                        const syllabusFile: FileRecord = {
                          id: -1 * (code.charCodeAt(0) * 1000 + code.charCodeAt(1)),
                          originalName: `${code} Syllabus.pdf`,
                          displayName: `${code} Syllabus`,
                          objectPath: path,
                          folder: null,
                          listened: false,
                          contentType: 'application/pdf',
                        };
                        handleBookClick(syllabusFile, course.color || '#8B6914', `/api/syllabus/view?path=${encodeURIComponent(path)}`, code.replace(/\s/g, '').toLowerCase(), true);
                      } else {
                        syllabusUploadCodeRef.current = code;
                        syllabusUploadColorRef.current = course.color || '#8B6914';
                        syllabusUploadRef.current?.click();
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '2px 6px',
                      border: hasSyllabus ? '1px solid rgba(0,0,0,0.4)' : '1px dashed rgba(0,0,0,0.25)',
                      borderRadius: '4px',
                      background: hasSyllabus ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)',
                      color: hasSyllabus ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)',
                      fontSize: '9px',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      cursor: 'pointer',
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      textTransform: 'uppercase',
                      marginRight: '8px',
                      flexShrink: 0,
                      position: 'relative',
                      zIndex: 20,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.background = hasSyllabus ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.55)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = hasSyllabus ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = hasSyllabus ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)'; }}
                    data-testid={`btn-syllabus-${course.code}`}
                    title={hasSyllabus ? `Open ${code} Syllabus` : `Upload ${code} Syllabus`}
                  >
                    {hasSyllabus ? <FileText size={9} /> : <Upload size={9} />}
                    Syllabus
                  </button>
                  );
                })()}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 700,
                    color: (courseIdx === 2 && minimizedReaders.size > 0) ? '#ffffff' : '#000000',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    fontFamily: "system-ui, -apple-system, sans-serif",
                    whiteSpace: 'nowrap',
                  }}>
                    {courseDisplayNames?.[course.code] || `${course.code} — ${course.name.startsWith(course.code) ? course.name.slice(course.code.length).replace(/^\s*[-–—]\s*/, '') : course.name}`}
                  </span>
                  {isCollapsed ? (
                    <ChevronRight size={14} style={{ color: (courseIdx === 2 && minimizedReaders.size > 0) ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', flexShrink: 0 }} />
                  ) : (
                    <ChevronDown size={14} style={{ color: (courseIdx === 2 && minimizedReaders.size > 0) ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)', flexShrink: 0 }} />
                  )}
                </div>
              </div>

              <div style={{
                maxHeight: isCollapsed ? '0px' : '800px',
                opacity: isCollapsed ? 0 : 1,
                overflow: isCollapsed ? 'hidden' : 'visible',
                transition: 'max-height 0.3s ease, opacity 0.25s ease',
              }}>
              <div style={{ position: 'relative', maxWidth: '100%', overflow: 'visible' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: `${courseIdx === 0 ? shelfHeight + 35 : shelfHeight * 2}px`,
                  padding: '0px 4px 28px',
                  gap: '2px',
                  overflow: 'visible',
                  maxWidth: '100%',
                  ...(courseIdx > 0 ? { transform: 'scale(1.5) scaleX(0.84)', transformOrigin: 'bottom left' } : { marginLeft: '-3px', transform: 'scaleX(0.86)', transformOrigin: 'bottom left' }),
                }}
                className="library-scroll"
                >
                  {(() => {
                    const weekGroups: { weekNum: number; files: { file: FileRecord; fileIdx: number }[] }[] = [];
                    let currentGroup: { weekNum: number; files: { file: FileRecord; fileIdx: number }[] } | null = null;
                    courseFiles.forEach((file, fileIdx) => {
                      const weekMatch = file.folder?.match(/week-(\d+)/);
                      const weekNum = weekMatch ? parseInt(weekMatch[1]) : 0;
                      if (!currentGroup || currentGroup.weekNum !== weekNum) {
                        currentGroup = { weekNum, files: [] };
                        weekGroups.push(currentGroup);
                      }
                      currentGroup.files.push({ file, fileIdx });
                    });
                    return weekGroups.map((group, groupIdx) => {
                      const moduleFileForWeek = group.files.find(({ file }) => {
                        const fl = (file.folder || '').toLowerCase();
                        return fl.includes('-module');
                      })?.file || null;
                      return (
                      <WeekGroupWrapper key={`wg-${group.weekNum}-${groupIdx}`} weekNum={group.weekNum} showSeparator={groupIdx > 0} shelfHeight={shelfHeight} shelfIndex={courseIdx} totalShelves={courseBooks.length} moduleFile={moduleFileForWeek} onOpenModule={(mf) => { const color = getBookColor(0, course.code, group.weekNum); handleBookClick(mf, color); }}>
                        {(() => {
                          const seenModuleFolders = new Set<string>();
                          return group.files.filter(({ file }) => {
                            const fl = (file.folder || '').toLowerCase();
                            if (fl.includes('-module')) {
                              if (seenModuleFolders.has(fl)) return false;
                              seenModuleFolders.add(fl);
                            }
                            return true;
                          }).map(({ file, fileIdx }, fileInGroupIdx) => {
                          const color = getBookColor(fileIdx, course.code, group.weekNum);
                          const isVeryFirstBook = courseIdx > 0 && groupIdx === 0 && fileInGroupIdx === 0;
                          const isLastWeekTopShelf = courseIdx === 0 && groupIdx === weekGroups.length - 1;
                          return (
                            <BookSpine
                              key={file.id}
                              file={file}
                              index={fileIdx}
                              courseCode={course.code}
                              bookColor={color}
                              isSelected={selectedBook?.id === file.id}
                              onClick={() => {
                                setSelectedBook(file);
                                setSelectedBookColor(color);
                                handleBookClick(file, color);
                              }}
                              shelfHeight={shelfHeight}
                              onRename={handleRenameStart}
                              extraMarginLeft={isVeryFirstBook ? 2 : undefined}
                              widthReduction={isLastWeekTopShelf ? 6 : undefined}
                            />
                          );
                        })}
                        )()}
                      </WeekGroupWrapper>
                    );});
                  })()}
                </div>

              </div>
              </div>
            </div>
          );})
        )}
      </div>

      {openReaders.map((reader, readerIdx) => {
        const isFocused = focusedReaderId === reader.file.id;
        const baseZ = 100010;
        const zIdx = isFocused ? baseZ + openReaders.length + 1 : baseZ + readerIdx;
        const isMinimized = minimizedReaders.has(reader.file.id);
        if (isMinimized) return null;
        return (
        <div
          key={reader.file.id}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: zIdx,
            pointerEvents: 'none',
          }}
        >
          <div style={{ pointerEvents: 'auto', display: 'contents' }}>
          <BookReader
            file={reader.file}
            bookColor={reader.color}
            onClose={() => {
              setOpenReaders(prev => prev.filter(r => r.file.id !== reader.file.id));
              setMinimizedReaders(prev => { const next = new Set(prev); next.delete(reader.file.id); return next; });
            }}
            onMinimize={() => {
              setMinimizedReaders(prev => { const next = new Set(prev); next.add(reader.file.id); return next; });
            }}
            pdfUrl={reader.pdfUrl}
            moduleFiles={reader.courseCode ? courseModuleFilesMap[reader.courseCode] : undefined}
            onOpenModuleFile={(mf, color) => handleBookClick(mf, color, undefined, reader.courseCode, false, undefined, undefined, reader.isSyllabus ? reader.courseCode : undefined)}
            isSyllabus={reader.isSyllabus}
            onBringToFront={() => setFocusedReaderId(reader.file.id)}
            readerIndex={readerIdx}
            initialSearchQuery={reader.initialSearchQuery}
            initialPage={reader.initialPage}
            courseCode={reader.courseCode}
            onOpenSyllabus={(cc: string) => {
              const sp = syllabusPaths[cc.toUpperCase()] || syllabusPaths[cc];
              if (!sp) return;
              const code = cc.toUpperCase();
              const syllabusFile: FileRecord = {
                id: -1 * (code.charCodeAt(0) * 1000 + code.charCodeAt(1)),
                originalName: `${code} Syllabus.pdf`,
                displayName: `${code} Syllabus`,
                objectPath: sp,
                folder: null,
                listened: false,
                contentType: 'application/pdf',
              };
              handleBookClick(syllabusFile, '#8B6914', `/api/syllabus/view?path=${encodeURIComponent(sp)}`, code.toLowerCase(), true);
            }}
            onBackToSyllabus={reader.openedFromSyllabusCode ? () => {
              const cc = reader.openedFromSyllabusCode!.toUpperCase();
              const sp = syllabusPaths[cc] || syllabusPaths[cc.toLowerCase()];
              if (!sp) return;
              setOpenReaders(prev => prev.filter(r => r.file.id !== reader.file.id));
              setMinimizedReaders(prev => { const next = new Set(prev); next.delete(reader.file.id); return next; });
              const syllabusFile: FileRecord = {
                id: -1 * (cc.charCodeAt(0) * 1000 + cc.charCodeAt(1)),
                originalName: `${cc} Syllabus.pdf`,
                displayName: `${cc} Syllabus`,
                objectPath: sp,
                folder: null,
                listened: false,
                contentType: 'application/pdf',
              };
              const existing = openReaders.find(r => r.isSyllabus && r.courseCode?.toUpperCase() === cc);
              if (existing) {
                setFocusedReaderId(existing.file.id);
              } else {
                handleBookClick(syllabusFile, '#8B6914', `/api/syllabus/view?path=${encodeURIComponent(sp)}`, cc.toLowerCase(), true);
              }
            } : undefined}
          />
          </div>
        </div>
        );
      })}

      {openReaders.filter(r => minimizedReaders.has(r.file.id)).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '5px',
          left: 'calc(50% + 12px)',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: '6px',
          zIndex: 10000,
          pointerEvents: 'auto',
        }}>
          {openReaders.filter(r => minimizedReaders.has(r.file.id)).map(reader => {
            const rawTitle = (reader.file.displayName || reader.file.originalName).replace(/\.pdf$/i, '');
            const shortTitle = rawTitle.length > 25 ? rawTitle.substring(0, 24) + '…' : rawTitle;
            return (
              <div
                key={reader.file.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: reader.color,
                  borderRadius: '8px 8px 0 0',
                  padding: '6px 10px',
                  cursor: 'pointer',
                  boxShadow: '0 -2px 8px rgba(0,0,0,0.3)',
                  maxWidth: '200px',
                }}
                onClick={() => {
                  setMinimizedReaders(prev => { const next = new Set(prev); next.delete(reader.file.id); return next; });
                  setFocusedReaderId(reader.file.id);
                }}
                data-testid={`minimized-tab-${reader.file.id}`}
              >
                <BookOpen size={12} color="#fff" />
                <span style={{ fontSize: '11px', color: '#fff', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortTitle}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenReaders(prev => prev.filter(r => r.file.id !== reader.file.id));
                    setMinimizedReaders(prev => { const next = new Set(prev); next.delete(reader.file.id); return next; });
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 0 2px', display: 'flex', alignItems: 'center' }}
                  data-testid={`close-minimized-${reader.file.id}`}
                >
                  <X size={10} color="rgba(255,255,255,0.7)" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {newReadingPrompt && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.6)',
            zIndex: 100010,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          data-testid="new-reading-rename-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a2e',
              border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: '14px',
              padding: '22px 26px',
              minWidth: '380px',
              maxWidth: '90vw',
              boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 20px rgba(139,92,246,0.1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <BookOpen size={18} color="#c4b5fd" />
              <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '15px', letterSpacing: '0.5px' }}>New Reading Added</span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '6px' }}>
              File: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{newReadingPrompt.originalName}</span>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.45)', marginBottom: '14px' }}>
              Folder: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{newReadingPrompt.folder}</span>
            </div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginBottom: '10px' }}>
              Would you like to give this reading a display name?
            </div>
            <input
              ref={newReadingRenameRef}
              value={newReadingRenameValue}
              onChange={(e) => setNewReadingRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleReadingRenameResponse(newReadingPrompt, newReadingRenameValue);
                if (e.key === 'Escape') handleReadingRenameResponse(newReadingPrompt, null);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(139,92,246,0.3)',
                backgroundColor: '#0d0d1a',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              data-testid="input-new-reading-rename"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => handleReadingRenameResponse(newReadingPrompt, null)}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
                data-testid="btn-skip-reading-rename"
              >
                Keep Original
              </button>
              <button
                onClick={() => handleReadingRenameResponse(newReadingPrompt, newReadingRenameValue)}
                disabled={!newReadingRenameValue.trim()}
                style={{
                  padding: '8px 18px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.6), rgba(99,102,241,0.6))',
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: !newReadingRenameValue.trim() ? 'not-allowed' : 'pointer',
                  opacity: !newReadingRenameValue.trim() ? 0.5 : 1,
                }}
                data-testid="btn-save-reading-rename"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {renamingFile && (
        <div
          onClick={() => setRenamingFile(null)}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          data-testid="rename-overlay"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#1a1a2e',
              border: '1px solid #D4AF37',
              borderRadius: '12px',
              padding: '20px 24px',
              minWidth: '340px',
              maxWidth: '90vw',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Pencil size={16} color="#D4AF37" />
              <span style={{ color: '#D4AF37', fontWeight: 700, fontSize: '15px', letterSpacing: '0.5px' }}>Rename Book</span>
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              Original: {renamingFile.originalName}
            </div>
            <input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameSave();
                if (e.key === 'Escape') setRenamingFile(null);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid rgba(212,175,55,0.3)',
                backgroundColor: '#0d0d1a',
                color: '#fff',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              data-testid="input-rename-book"
            />
            <div style={{ display: 'flex', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setRenamingFile(null)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  backgroundColor: 'transparent',
                  color: '#aaa',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
                data-testid="btn-cancel-rename"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSave}
                disabled={renameSaving || !renameValue.trim()}
                style={{
                  padding: '7px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#D4AF37',
                  color: '#000',
                  fontSize: '13px',
                  fontWeight: 700,
                  cursor: renameSaving ? 'wait' : 'pointer',
                  opacity: renameSaving || !renameValue.trim() ? 0.5 : 1,
                }}
                data-testid="btn-save-rename"
              >
                {renameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
      {showLibraryNote && <LibraryFloatingNote onClose={() => setShowLibraryNote(false)} />}
    </div>,
    document.body
  );
}