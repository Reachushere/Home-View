import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Minus, GripHorizontal } from 'lucide-react';

interface FloatingPostItProps {
  id: number;
  title: string;
  content: string;
  x: number;
  y: number;
  width: number;
  height: number;
  onClose: (id: number) => void;
  onDock: (id: number) => void;
  onMove: (id: number, x: number, y: number) => void;
  onResize: (id: number, width: number, height: number) => void;
  colorSettings: { mainBackground: string; headerBar: string };
}

export default function FloatingPostIt({
  id, title, content, x, y, width, height,
  onClose, onDock, onMove, onResize, colorSettings
}: FloatingPostItProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDownDrag = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    dragOffset.current = { x: e.clientX - x, y: e.clientY - y };
  }, [x, y]);

  const handleMouseDownResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStart.current = { x: e.clientX, y: e.clientY, w: width, h: height };
  }, [width, height]);

  useEffect(() => {
    if (!isDragging && !isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.current.x));
        const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragOffset.current.y));
        onMove(id, newX, newY);
      }
      if (isResizing) {
        const dw = e.clientX - resizeStart.current.x;
        const dh = e.clientY - resizeStart.current.y;
        const newW = Math.max(200, resizeStart.current.w + dw);
        const newH = Math.max(120, resizeStart.current.h + dh);
        onResize(id, newW, newH);
      }
    };
    const handleMouseUp = () => { setIsDragging(false); setIsResizing(false); };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [isDragging, isResizing, id, onMove, onResize]);

  const plainText = (() => {
    const div = document.createElement('div');
    div.innerHTML = content;
    return div.textContent || '';
  })();

  return createPortal(
    <div
      ref={containerRef}
      data-testid={`floating-note-${id}`}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        width,
        height: minimized ? 'auto' : height,
        zIndex: 99999,
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.3)',
        border: '1.5px solid rgba(255,255,255,0.25)',
        display: 'flex',
        flexDirection: 'column',
        background: `linear-gradient(145deg, ${colorSettings.mainBackground}, color-mix(in srgb, ${colorSettings.mainBackground} 80%, black))`,
        userSelect: isDragging ? 'none' : 'auto',
        transition: isDragging || isResizing ? 'none' : 'box-shadow 0.2s',
      }}
    >
      <div
        onMouseDown={handleMouseDownDrag}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '5px 8px',
          background: colorSettings.headerBar,
          cursor: isDragging ? 'grabbing' : 'grab',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden' }}>
          <GripHorizontal style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.4)', flexShrink: 0 }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'white',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
          }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(!minimized); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            title={minimized ? 'Expand' : 'Minimize'}
            data-testid={`button-minimize-note-${id}`}
          >
            <Minus style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.5)' }} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDock(id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            title="Dock back to notepad"
            data-testid={`button-dock-note-${id}`}
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <path d="M6 2v12M2 8h4" />
            </svg>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(id); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
            title="Close (discard)"
            data-testid={`button-close-note-${id}`}
          >
            <X style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.5)' }} />
          </button>
        </div>
      </div>
      {!minimized && (
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 10px',
          fontSize: 12,
          color: 'rgba(255,255,255,0.85)',
          lineHeight: 1.5,
          fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif",
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {content ? (
            <div dangerouslySetInnerHTML={{ __html: content }} />
          ) : (
            <span style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>Empty note</span>
          )}
        </div>
      )}
      {!minimized && (
        <div
          onMouseDown={handleMouseDownResize}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 16,
            height: 16,
            cursor: 'nwse-resize',
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ position: 'absolute', right: 3, bottom: 3 }}>
            <path d="M9 1L1 9M9 5L5 9" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>,
    document.body
  );
}
