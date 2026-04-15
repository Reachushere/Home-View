import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Zap, Send, X, Loader2, CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw, Maximize2, Minimize2, Pencil, Circle, ArrowRight, Undo2, Check, Scissors } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

type MarkupTool = 'draw' | 'circle' | 'arrow';
interface MarkupStroke {
  tool: MarkupTool;
  color: string;
  width: number;
  points?: { x: number; y: number }[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
}

function ImageMarkup({ imageSrc, onDone, onCancel }: { imageSrc: string; onDone: (annotated: string) => void; onCancel: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<MarkupTool>('draw');
  const [color, setColor] = useState('#ff3333');
  const [strokeWidth] = useState(3);
  const [strokes, setStrokes] = useState<MarkupStroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<MarkupStroke | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ w: 0, h: 0, scale: 1 });
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const maxW = Math.min(window.innerWidth * 0.85, 800);
      const maxH = window.innerHeight * 0.65;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      setImgDimensions({ w: img.width * scale, h: img.height * scale, scale });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgDimensions.w) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    canvas.width = imgDimensions.w;
    canvas.height = imgDimensions.h;
    ctx.drawImage(img, 0, 0, imgDimensions.w, imgDimensions.h);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;
    for (const s of allStrokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (s.tool === 'draw' && s.points && s.points.length > 1) {
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x, s.points[i].y);
        }
        ctx.stroke();
      } else if (s.tool === 'circle' && s.start && s.end) {
        const cx = (s.start.x + s.end.x) / 2;
        const cy = (s.start.y + s.end.y) / 2;
        const rx = Math.abs(s.end.x - s.start.x) / 2;
        const ry = Math.abs(s.end.y - s.start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (s.tool === 'arrow' && s.start && s.end) {
        const dx = s.end.x - s.start.x;
        const dy = s.end.y - s.start.y;
        const angle = Math.atan2(dy, dx);
        const headLen = 14;
        ctx.beginPath();
        ctx.moveTo(s.start.x, s.start.y);
        ctx.lineTo(s.end.x, s.end.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(s.end.x, s.end.y);
        ctx.lineTo(s.end.x - headLen * Math.cos(angle - Math.PI / 6), s.end.y - headLen * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(s.end.x, s.end.y);
        ctx.lineTo(s.end.x - headLen * Math.cos(angle + Math.PI / 6), s.end.y - headLen * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      }
    }
  }, [strokes, currentStroke, imgDimensions]);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    setIsDrawing(true);
    if (tool === 'draw') {
      setCurrentStroke({ tool, color, width: strokeWidth, points: [pos] });
    } else {
      setCurrentStroke({ tool, color, width: strokeWidth, start: pos, end: pos });
    }
  };

  const moveDraw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !currentStroke) return;
    e.preventDefault();
    const pos = getPos(e);
    if (tool === 'draw') {
      setCurrentStroke(prev => prev ? { ...prev, points: [...(prev.points || []), pos] } : null);
    } else {
      setCurrentStroke(prev => prev ? { ...prev, end: pos } : null);
    }
  };

  const endDraw = () => {
    if (!isDrawing || !currentStroke) return;
    setIsDrawing(false);
    setStrokes(prev => [...prev, currentStroke]);
    setCurrentStroke(null);
  };

  const undo = () => setStrokes(prev => prev.slice(0, -1));

  const finish = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onDone(canvas.toDataURL('image/png'));
  };

  if (!imgDimensions.w) return null;

  const btnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)',
    border: active ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    padding: '6px 10px',
    cursor: 'pointer',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '12px',
  });

  const colorBtnStyle = (c: string): React.CSSProperties => ({
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    background: c,
    border: color === c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.2)',
    cursor: 'pointer',
    padding: 0,
  });

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 10010, background: 'rgba(0,0,0,0.85)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '10px',
    }} data-testid="markup-overlay">
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => setTool('draw')} style={btnStyle(tool === 'draw')} data-testid="button-markup-draw"><Pencil size={14} /> Draw</button>
        <button onClick={() => setTool('circle')} style={btnStyle(tool === 'circle')} data-testid="button-markup-circle"><Circle size={14} /> Circle</button>
        <button onClick={() => setTool('arrow')} style={btnStyle(tool === 'arrow')} data-testid="button-markup-arrow"><ArrowRight size={14} /> Arrow</button>
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />
        <button onClick={() => setColor('#ff3333')} style={colorBtnStyle('#ff3333')} data-testid="button-markup-red" />
        <button onClick={() => setColor('#33ff33')} style={colorBtnStyle('#33ff33')} data-testid="button-markup-green" />
        <button onClick={() => setColor('#ffff33')} style={colorBtnStyle('#ffff33')} data-testid="button-markup-yellow" />
        <button onClick={() => setColor('#3399ff')} style={colorBtnStyle('#3399ff')} data-testid="button-markup-blue" />
        <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }} />
        <button onClick={undo} disabled={strokes.length === 0} style={{ ...btnStyle(false), opacity: strokes.length === 0 ? 0.4 : 1 }} data-testid="button-markup-undo"><Undo2 size={14} /> Undo</button>
      </div>
      <canvas
        ref={canvasRef}
        style={{ borderRadius: '8px', cursor: 'crosshair', touchAction: 'none', border: '1px solid rgba(255,255,255,0.2)' }}
        onMouseDown={startDraw}
        onMouseMove={moveDraw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={moveDraw}
        onTouchEnd={endDraw}
        data-testid="canvas-markup"
      />
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={onCancel} style={{ ...btnStyle(false), padding: '8px 20px', fontSize: '13px' }} data-testid="button-markup-cancel"><X size={14} /> Cancel</button>
        <button onClick={finish} style={{ ...btnStyle(false), padding: '8px 20px', fontSize: '13px', background: 'linear-gradient(135deg, #1d4ed8, #2563eb)' }} data-testid="button-markup-done"><Check size={14} /> Send</button>
      </div>
    </div>
  );
}

const thinkingKeyframes = `
@keyframes ai-dot-bounce {
  0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
  40% { transform: translateY(-6px); opacity: 1; }
}
@keyframes ai-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
`;

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: string;
  toolResults?: any[];
  actionTaken?: boolean;
  pendingConfirmations?: any[];
}

interface AiCommandWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const sessionId = `bryn-${Date.now().toString(36)}`;

interface WizardStyle {
  wizardBackground?: string;
  wizardBorder?: string;
  wizardHeaderBg?: string;
  wizardInputBg?: string;
  wizardUserBubble?: string;
  wizardAssistantBubble?: string;
  wizardTextColor?: string;
  wizardBodyTextColor?: string;
}

function isLightBg(bg: string | undefined): boolean {
  if (!bg) return false;
  const l = bg.toLowerCase().replace(/\s/g, '');
  if (l.includes('white') || l === '#fff' || l === '#ffffff') return true;
  const rgb = l.match(/rgba?\((\d+),(\d+),(\d+)/);
  if (rgb) return (+rgb[1] * 0.299 + +rgb[2] * 0.587 + +rgb[3] * 0.114) > 160;
  const hex = l.match(/^#([0-9a-f]{6})$/);
  if (hex) { const r = parseInt(hex[1].slice(0,2),16), g = parseInt(hex[1].slice(2,4),16), b = parseInt(hex[1].slice(4,6),16); return (r*0.299+g*0.587+b*0.114) > 160; }
  return false;
}

const defaultWizardStyle: WizardStyle = {
  wizardBackground: 'linear-gradient(180deg, #0d1b3e 0%, #0f2347 30%, #132d5a 60%, #162f5e 100%)',
  wizardBorder: '1.5px solid rgba(100,160,255,0.3)',
  wizardHeaderBg: 'rgba(10,20,50,0.8)',
  wizardInputBg: 'rgba(10,20,50,0.5)',
  wizardUserBubble: 'linear-gradient(135deg, #1d4ed8, #2563eb)',
  wizardAssistantBubble: 'rgba(30,50,90,0.7)',
};

export function AiCommandWizard({ isOpen, onClose }: AiCommandWizardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<any[] | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [thinkingPhase, setThinkingPhase] = useState<string | null>(null);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [markupImage, setMarkupImage] = useState<string | null>(null);
  const [wizStyle, setWizStyle] = useState<WizardStyle>(defaultWizardStyle);
  const [snipping, setSnipping] = useState(false);
  const [snippingStart, setSnippingStart] = useState<{ x: number; y: number } | null>(null);
  const [snippingEnd, setSnippingEnd] = useState<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const snippingCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    fetch('/api/app-state/ui_wizardStyle')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.value) {
          try {
            const parsed = JSON.parse(data.value);
            setWizStyle(prev => ({ ...prev, ...parsed }));
          } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const conversationLoaded = useRef(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/app-state/ui_wizardStyle')
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.value) {
            try {
              const parsed = JSON.parse(data.value);
              setWizStyle(prev => ({ ...prev, ...parsed }));
            } catch {}
          }
        })
        .catch(() => {});
      if (!conversationLoaded.current) {
        fetch('/api/ai/conversation')
          .then(r => r.ok ? r.json() : null)
          .then(data => {
            if (data?.messages?.length > 0) setMessages(data.messages);
          })
          .catch(() => {});
        conversationLoaded.current = true;
      }
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scroll = () => el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    scroll();
    const t1 = setTimeout(scroll, 50);
    const t2 = setTimeout(scroll, 150);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [messages]);

  useEffect(() => {
    if (!loading) return;
    const el = scrollRef.current;
    if (!el) return;
    const iv = setInterval(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }, 300);
    return () => clearInterval(iv);
  }, [loading]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    setIsDragging(true);
    const panel = panelRef.current;
    if (panel) {
      const rect = panel.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      if (!position) {
        setPosition({ x: rect.left, y: rect.top });
      }
    }
  }, [position]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 100, e.clientY - dragOffset.y)),
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, dragOffset]);

  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notepad'] });
    queryClient.invalidateQueries({ queryKey: ['/api/semester'] });
    queryClient.invalidateQueries({ queryKey: ['/api/semesters'] });
    queryClient.invalidateQueries({ queryKey: ['/api/sticky-notes'] });
    queryClient.invalidateQueries({ queryKey: ['/api/calendar'] });
    queryClient.invalidateQueries({ queryKey: ['/api/ui-settings'] });
    queryClient.invalidateQueries({ queryKey: ['/api/degree-tracking'] });
  }, []);

  const sendMessage = useCallback(async (overrideMsg?: string) => {
    const msg = overrideMsg || input.trim();
    if ((!msg && !pastedImage) || loading) return;
    const finalMsg = msg || (pastedImage ? 'What do you see in this screenshot?' : '');
    if (!finalMsg) return;
    const currentImage = pastedImage;
    const userMsg: Message = { role: 'user', content: finalMsg, image: currentImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideMsg) { setInput(''); setPastedImage(null); }
    setLoading(true);

    try {
      const resp = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-AI-Session': sessionId },
        body: JSON.stringify({
          message: finalMsg,
          image: currentImage || undefined,
          history: messages.slice(-20).map(m => ({ role: m.role, content: m.content })),
          stream: true,
        }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Command failed');
      }

      const contentType = resp.headers.get('content-type') || '';
      if (contentType.includes('text/event-stream') && resp.body) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let streamedContent = '';
        let toolResults: any[] | undefined;
        let actionTaken = false;
        let pendingConfs: any[] | undefined;

        setThinkingPhase('Thinking...');

        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6));
              if (event.type === 'meta') {
                toolResults = event.toolResults;
                actionTaken = event.actionTaken || false;
              } else if (event.type === 'tool_start') {
                const friendlyNames: Record<string, string> = {
                  read_file: 'Reading files', list_files: 'Browsing files', search_code: 'Searching code',
                  write_file: 'Writing code', edit_file: 'Editing code', run_sql: 'Querying database',
                  memory_read: 'Checking memory', memory_write: 'Saving to memory',
                  create_task: 'Creating task', update_task: 'Updating task', delete_task: 'Deleting task',
                  get_tasks: 'Looking up tasks', run_shell_command: 'Running command',
                  restart_application: 'Restarting app', git_commit_and_push: 'Deploying changes',
                  conversation_history: 'Checking history', health_check: 'Checking health',
                  ha_control: 'Controlling devices', get_calendar: 'Checking calendar',
                };
                const label = friendlyNames[event.name] || event.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                setThinkingPhase(label + '...');
              } else if (event.type === 'tool_done') {
                if (!event.success) {
                  const toolLabel = event.name.replace(/_/g, ' ');
                  streamedContent += `Failed: ${toolLabel}\n`;
                }
              } else if (event.type === 'token') {
                if (thinkingPhase) setThinkingPhase(null);
                streamedContent += event.content;
                setMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last && last.role === 'assistant') {
                    const updated = [...prev];
                    updated[updated.length - 1] = { role: 'assistant', content: streamedContent, toolResults, actionTaken };
                    return updated;
                  }
                  return [...prev, { role: 'assistant', content: streamedContent, toolResults, actionTaken }];
                });
              } else if (event.type === 'confirm') {
                if (event.pendingConfirmations) {
                  setThinkingPhase(null);
                  setPendingConfirm(event.pendingConfirmations);
                }
              } else if (event.type === 'done') {
                if (event.actionTaken) actionTaken = true;
                if (event.reply && !streamedContent.includes(event.reply)) streamedContent = event.reply;
              } else if (event.type === 'error') {
                streamedContent += `\nError: ${event.error}`;
              }
            } catch {}
          }
        }

        setThinkingPhase(null);
        if (actionTaken) invalidateAll();

        if (streamedContent.trim()) {
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.role === 'assistant') {
              const updated = [...prev];
              updated[updated.length - 1] = { role: 'assistant', content: streamedContent, toolResults, actionTaken };
              return updated;
            }
            return [...prev, { role: 'assistant', content: streamedContent, toolResults, actionTaken }];
          });
        } else {
          setMessages(prev => [...prev, { role: 'assistant', content: 'Done!', toolResults, actionTaken }]);
        }
      } else {
        const data = await resp.json();

        if (data.pendingConfirmations && data.pendingConfirmations.length > 0) {
          setPendingConfirm(data.pendingConfirmations);
        }

        if (data.actionTaken) {
          invalidateAll();
        }

        setMessages(prev => [...prev, {
          role: 'assistant',
          content: data.reply,
          toolResults: data.toolResults,
          actionTaken: data.actionTaken,
          pendingConfirmations: data.pendingConfirmations,
        }]);
      }
    } catch (err: any) {
      setThinkingPhase(null);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
      setThinkingPhase(null);
      setTimeout(() => {
        setMessages(curr => {
          const saveable = curr.map(m => ({ role: m.role, content: m.content }));
          fetch('/api/ai/conversation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: saveable }),
          }).catch(() => {});
          return curr;
        });
      }, 100);
    }
  }, [input, loading, messages, invalidateAll, pastedImage]);

  const handleConfirm = useCallback(async (confirm: boolean) => {
    if (!pendingConfirm) return;
    setPendingConfirm(null);

    if (!confirm) {
      setMessages(prev => [...prev, { role: 'system', content: 'Action cancelled.' }]);
      return;
    }

    setLoading(true);
    try {
      for (const pc of pendingConfirm) {
        const resp = await fetch('/api/ai/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-AI-Session': sessionId },
          body: JSON.stringify({
            message: 'confirmed',
            confirmToolCall: { token: pc.token },
          }),
        });
        const data = await resp.json();
        if (!resp.ok) {
          setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${data.error || 'Confirmation failed'}` }]);
        } else {
          setMessages(prev => [...prev, {
            role: 'assistant',
            content: data.reply,
            toolResults: data.toolResults,
            actionTaken: data.actionTaken,
          }]);
        }
      }
      invalidateAll();
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [pendingConfirm, invalidateAll]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result as string;
          setMarkupImage(base64);
        };
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingConfirm(null);
    fetch('/api/ai/conversation', { method: 'DELETE' }).catch(() => {});
  }, []);

  const startSnipping = useCallback(async () => {
    setSnippingStart(null);
    setSnippingEnd(null);
    const overlay = document.querySelector('[data-testid="ai-command-overlay"]') as HTMLElement | null;
    if (overlay) overlay.style.visibility = 'hidden';
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 50))));
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(document.body, { useCORS: true, scale: window.devicePixelRatio || 1, logging: false });
      snippingCanvasRef.current = canvas;
    } catch {
      const canvas = document.createElement('canvas');
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      snippingCanvasRef.current = canvas;
    }
    setSnipping(true);
  }, []);

  const restoreOverlay = useCallback(() => {
    const overlay = document.querySelector('[data-testid="ai-command-overlay"]') as HTMLElement | null;
    if (overlay) overlay.style.visibility = '';
  }, []);

  const finishSnipping = useCallback(() => {
    if (!snippingStart || !snippingEnd || !snippingCanvasRef.current) {
      setSnipping(false);
      setSnippingStart(null);
      setSnippingEnd(null);
      restoreOverlay();
      return;
    }
    const srcCanvas = snippingCanvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const x = Math.min(snippingStart.x, snippingEnd.x) * dpr;
    const y = Math.min(snippingStart.y, snippingEnd.y) * dpr;
    const w = Math.abs(snippingEnd.x - snippingStart.x) * dpr;
    const h = Math.abs(snippingEnd.y - snippingStart.y) * dpr;
    if (w < 10 || h < 10) {
      setSnipping(false);
      setSnippingStart(null);
      setSnippingEnd(null);
      restoreOverlay();
      return;
    }
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(srcCanvas, x, y, w, h, 0, 0, w, h);
      const dataUrl = cropCanvas.toDataURL('image/png');
      setPastedImage(dataUrl);
    }
    setSnipping(false);
    setSnippingStart(null);
    setSnippingEnd(null);
    restoreOverlay();
  }, [snippingStart, snippingEnd, restoreOverlay]);

  useEffect(() => {
    if (!snipping) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSnipping(false);
        setSnippingStart(null);
        setSnippingEnd(null);
        restoreOverlay();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [snipping]);

  useEffect(() => {
    const styleId = 'ai-thinking-keyframes';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = thinkingKeyframes;
      document.head.appendChild(style);
    }
  }, []);

  if (!isOpen) return null;

  const panelWidth = expanded ? '90vw' : '600px';
  const panelMaxHeight = expanded ? '90vh' : '80vh';
  const panelStyle: React.CSSProperties = {
    width: panelWidth,
    maxWidth: expanded ? '1200px' : '95vw',
    maxHeight: panelMaxHeight,
    height: expanded ? '90vh' : undefined,
    background: wizStyle.wizardBackground || defaultWizardStyle.wizardBackground,
    border: wizStyle.wizardBorder || defaultWizardStyle.wizardBorder,
    borderRadius: '16px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(50,120,220,0.15)',
    overflow: 'hidden',
    ...(position ? {
      position: 'fixed' as const,
      left: position.x,
      top: position.y,
    } : {}),
    transition: isDragging ? 'none' : 'width 0.2s, max-height 0.2s, height 0.2s',
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10002,
      display: 'flex',
      alignItems: position ? 'flex-start' : 'center',
      justifyContent: position ? 'flex-start' : 'center',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
    }} data-testid="ai-command-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panelRef} style={panelStyle} data-testid="ai-command-panel">
        <div
          onMouseDown={handleMouseDown}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid rgba(100,160,255,0.2)',
            background: 'rgba(15,35,71,0.8)',
            cursor: 'grab',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="#ffffff" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.3px' }}>BrynAssist</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={clearChat}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              title="Clear chat"
              data-testid="button-ai-command-clear"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={() => { setExpanded(!expanded); if (expanded) setPosition(null); }}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              title={expanded ? 'Minimize' : 'Expand'}
              data-testid="button-ai-command-expand"
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              data-testid="button-ai-command-close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div ref={scrollRef} style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          minHeight: '200px',
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px 20px', color: wizStyle.wizardBodyTextColor || '#ffffff' }}>
              <Zap size={32} color={wizStyle.wizardBodyTextColor || '#ffffff'} style={{ margin: '0 auto 12px', opacity: 0.7 }} />
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>What can I help with?</div>
              <div style={{ fontSize: '12px', lineHeight: '1.8', opacity: 0.6 }}>
                "Add a quiz for CPPA122 next Friday"<br />
                "What's due this week?"<br />
                "Turn on the cat lights"<br />
                "Mark my CFNF400 reading as done"<br />
                "Announce dinner is ready"
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              ...(msg.role === 'system' ? { justifyContent: 'center' } : {}),
            }}>
              <div style={{
                maxWidth: msg.role === 'system' ? '100%' : '85%',
                padding: msg.role === 'system' ? '6px 14px' : '10px 14px',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: msg.role === 'user'
                  ? (wizStyle.wizardUserBubble || defaultWizardStyle.wizardUserBubble)
                  : msg.role === 'system'
                  ? 'rgba(255,200,50,0.15)'
                  : (wizStyle.wizardAssistantBubble || defaultWizardStyle.wizardAssistantBubble),
                border: msg.role === 'user'
                  ? '1px solid rgba(96,165,250,0.3)'
                  : msg.role === 'system'
                  ? '1px solid rgba(255,200,50,0.3)'
                  : '1px solid rgba(100,160,255,0.15)',
                color: msg.role === 'system' ? 'rgba(255,220,100,0.9)'
                  : wizStyle.wizardTextColor
                  ? wizStyle.wizardTextColor
                  : msg.role === 'user'
                  ? (isLightBg(wizStyle.wizardUserBubble) ? '#1a1a2e' : '#ffffff')
                  : (isLightBg(wizStyle.wizardAssistantBubble) ? '#1a1a2e' : '#ffffff'),
                textShadow: msg.role !== 'system'
                  ? (isLightBg(msg.role === 'user' ? wizStyle.wizardUserBubble : wizStyle.wizardAssistantBubble) ? 'none' : '0 1px 2px rgba(0,0,0,0.3)')
                  : undefined,
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {msg.image && (
                  <img src={msg.image} alt="Screenshot" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: '6px', marginBottom: '6px', border: '1px solid rgba(100,160,255,0.2)' }} />
                )}
                {msg.content}
                {msg.actionTaken && msg.toolResults && msg.toolResults.length > 0 && (
                  <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {msg.toolResults.map((tr: any, j: number) => (
                      <div key={j} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '11px',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        background: tr.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                        border: `1px solid ${tr.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        color: tr.success ? '#86efac' : '#fca5a5',
                      }}>
                        {tr.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                        <span>{tr.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {(thinkingPhase || (loading && !messages.some(m => m.role === 'assistant' && m.content))) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '10px 14px',
              borderRadius: '14px 14px 14px 4px',
              background: 'rgba(30,50,90,0.7)',
              border: '1px solid rgba(100,160,255,0.15)',
            }}>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#60a5fa', animation: 'ai-dot-bounce 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#818cf8', animation: 'ai-dot-bounce 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
                <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#a78bfa', animation: 'ai-dot-bounce 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
              </div>
              <span style={{
                fontSize: '13px',
                fontWeight: 500,
                background: 'linear-gradient(90deg, rgba(160,180,255,0.9), rgba(200,180,255,0.6), rgba(160,180,255,0.9))',
                backgroundSize: '200% auto',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                animation: 'ai-shimmer 2s linear infinite',
              }}>
                {thinkingPhase || 'Thinking...'}
              </span>
            </div>
          )}

          {pendingConfirm && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '12px',
              background: 'rgba(234,179,8,0.1)',
              border: '1px solid rgba(234,179,8,0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fbbf24', fontSize: '13px', fontWeight: 600 }}>
                <AlertTriangle size={16} />
                Confirmation Required
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => handleConfirm(true)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    background: 'rgba(34,197,94,0.2)',
                    border: '1px solid rgba(34,197,94,0.4)',
                    color: '#86efac',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  data-testid="button-ai-command-confirm-yes"
                >
                  Yes, do it
                </button>
                <button
                  onClick={() => handleConfirm(false)}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '8px',
                    background: 'rgba(239,68,68,0.2)',
                    border: '1px solid rgba(239,68,68,0.4)',
                    color: '#fca5a5',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  data-testid="button-ai-command-confirm-no"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(100,160,255,0.2)',
          background: 'rgba(10,20,50,0.5)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {pastedImage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: 'fit-content' }}>
                <img src={pastedImage} alt="Pasted" style={{ maxWidth: '120px', maxHeight: '80px', borderRadius: '8px', border: '1px solid rgba(100,160,255,0.3)' }} />
                <button
                  onClick={() => setPastedImage(null)}
                  style={{ position: 'absolute', top: '-6px', right: '-6px', background: 'rgba(220,50,50,0.9)', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: '11px', lineHeight: 1, padding: 0 }}
                  data-testid="button-remove-pasted-image"
                >x</button>
              </div>
              <button
                onClick={() => setMarkupImage(pastedImage)}
                style={{ background: 'rgba(100,160,255,0.15)', border: '1px solid rgba(100,160,255,0.3)', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer', color: '#93b5ff', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                data-testid="button-edit-markup"
              ><Pencil size={12} /> Markup</button>
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={pastedImage ? "Describe what to do with this screenshot..." : "Type a command..."}
            rows={3}
            style={{
              flex: 1,
              background: '#ffffff',
              border: '1px solid rgba(100,160,255,0.3)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#000000',
              fontSize: '13px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'inherit',
              minHeight: '60px',
              maxHeight: '200px',
              overflowY: 'auto',
            }}
            data-testid="input-ai-command"
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={startSnipping}
              disabled={loading}
              style={{
                background: 'rgba(100,160,255,0.15)',
                border: '1px solid rgba(96,165,250,0.3)',
                borderRadius: '10px',
                padding: '10px',
                cursor: loading ? 'not-allowed' : 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading ? 0.5 : 1,
              }}
              title="Screen capture"
              data-testid="button-ai-snip"
            >
              <Scissors size={16} />
            </button>
            <button
              onClick={() => sendMessage()}
              disabled={loading || (!input.trim() && !pastedImage)}
              style={{
                background: loading || (!input.trim() && !pastedImage) ? 'rgba(100,160,255,0.15)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
                border: '1px solid rgba(96,165,250,0.3)',
                borderRadius: '10px',
                padding: '10px',
                cursor: loading || (!input.trim() && !pastedImage) ? 'not-allowed' : 'pointer',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: loading || (!input.trim() && !pastedImage) ? 0.5 : 1,
              }}
              data-testid="button-ai-command-send"
            >
              <Send size={16} />
            </button>
          </div>
          </div>
        </div>
      </div>
      {markupImage && (
        <ImageMarkup
          imageSrc={markupImage}
          onDone={(annotated) => {
            setPastedImage(annotated);
            setMarkupImage(null);
          }}
          onCancel={() => setMarkupImage(null)}
        />
      )}
      {snipping && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 999999,
            cursor: 'crosshair',
            background: 'rgba(0,0,0,0.15)',
          }}
          onMouseDown={e => {
            e.preventDefault();
            setSnippingStart({ x: e.clientX, y: e.clientY });
            setSnippingEnd({ x: e.clientX, y: e.clientY });
          }}
          onMouseMove={e => {
            if (snippingStart) setSnippingEnd({ x: e.clientX, y: e.clientY });
          }}
          onMouseUp={() => {
            if (snippingStart && snippingEnd) finishSnipping();
          }}
          onTouchStart={e => {
            e.preventDefault();
            const t = e.touches[0];
            setSnippingStart({ x: t.clientX, y: t.clientY });
            setSnippingEnd({ x: t.clientX, y: t.clientY });
          }}
          onTouchMove={e => {
            const t = e.touches[0];
            if (snippingStart) setSnippingEnd({ x: t.clientX, y: t.clientY });
          }}
          onTouchEnd={() => {
            if (snippingStart && snippingEnd) finishSnipping();
          }}
          data-testid="snipping-overlay"
        >
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            padding: '8px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            pointerEvents: 'none',
          }}>
            Drag to select area — ESC to cancel
          </div>
          {snippingStart && snippingEnd && (
            <div style={{
              position: 'absolute',
              left: `${Math.min(snippingStart.x, snippingEnd.x)}px`,
              top: `${Math.min(snippingStart.y, snippingEnd.y)}px`,
              width: `${Math.abs(snippingEnd.x - snippingStart.x)}px`,
              height: `${Math.abs(snippingEnd.y - snippingStart.y)}px`,
              border: '2px solid #60a5fa',
              background: 'rgba(96,165,250,0.1)',
              pointerEvents: 'none',
            }} />
          )}
          <button
            onClick={() => { setSnipping(false); setSnippingStart(null); setSnippingEnd(null); restoreOverlay(); }}
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              background: 'rgba(220,50,50,0.8)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 16px',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
            }}
            data-testid="button-snip-cancel"
          >
            Cancel
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
