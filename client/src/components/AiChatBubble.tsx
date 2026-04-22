import { useState, useRef, useCallback, useEffect } from 'react';
import { MessageSquare, RotateCcw, X, Loader2, Download, Copy, Maximize2, Minimize2, Paperclip, Scissors, BookOpen, FileText, Check, PenLine } from 'lucide-react';

interface AiChatBubbleProps {
  colorSettings: {
    headerBar: string;
    mainBackground: string;
    mainBackgroundGradientEnd: string;
  };
}

type EssayCitation = { fileId: number; fileName: string; page?: number; snippet: string };
type EssayPayload = {
  topic: string;
  wordCount: number;
  citationStyle: string;
  html: string;
  citations: Record<string, EssayCitation>;
  references: string[];
  sourceCount: number;
};
type ChatMessage = { role: 'user' | 'assistant'; content: string; image?: string; essay?: EssayPayload };

function EssayBlock({ essay }: { essay: EssayPayload }) {
  const [activeCid, setActiveCid] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const active = activeCid ? essay.citations[activeCid] : null;

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const t = (e.target as HTMLElement).closest('cite.essay-citation') as HTMLElement | null;
      if (!t) return;
      e.preventDefault();
      const cid = t.getAttribute('data-cid');
      if (cid) setActiveCid(cid);
    };
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, []);

  const openInLibrary = () => {
    if (!active) return;
    try {
      window.dispatchEvent(new CustomEvent('bryn:open-file-citation', {
        detail: { fileId: active.fileId, page: active.page, query: active.snippet.slice(0, 60) },
      }));
    } catch {}
  };

  return (
    <div data-testid="essay-block" style={{ marginTop: '4px' }}>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.55)', marginBottom: '8px' }}>
        Essay · ~{essay.wordCount} words · {essay.sourceCount} source{essay.sourceCount === 1 ? '' : 's'} · {essay.citationStyle}
      </div>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div
          ref={containerRef}
          dangerouslySetInnerHTML={{ __html: essay.html }}
          style={{
            flex: active ? '1 1 60%' : '1 1 100%',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            padding: '14px 16px',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#fff',
            maxHeight: '500px',
            overflowY: 'auto',
          }}
        />
        {active && (
          <div style={{
            flex: '1 1 40%',
            minWidth: '220px',
            background: '#fff8c4',
            color: '#1a1a1a',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            padding: '12px 14px',
            fontSize: '12px',
            lineHeight: 1.55,
            maxHeight: '500px',
            overflowY: 'auto',
            position: 'relative',
          }} data-testid="essay-citation-source">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', borderBottom: '1px solid rgba(0,0,0,0.15)', paddingBottom: '6px' }}>
              <div style={{ fontWeight: 700, fontSize: '11px', color: '#7c2d12' }}>
                {active.fileName}{active.page ? ` · p. ${active.page}` : ''}
              </div>
              <button onClick={() => setActiveCid(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c2d12', padding: 2 }} title="Close source" data-testid="button-close-citation-source">
                <X size={13} />
              </button>
            </div>
            <div style={{ background: '#fde68a', padding: '8px 10px', borderRadius: '4px', whiteSpace: 'pre-wrap' }}>{active.snippet}</div>
            <button
              onClick={openInLibrary}
              style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
              data-testid="button-open-source-in-library"
            >
              <BookOpen size={12} /> Open full source
            </button>
          </div>
        )}
      </div>
      {essay.references.length > 0 && (
        <div style={{ marginTop: '12px', padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#a5b4fc', marginBottom: '6px', letterSpacing: '0.5px' }}>REFERENCES</div>
          <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '11.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
            {essay.references.map((r, i) => <li key={i} style={{ marginBottom: '3px' }}>{r}</li>)}
          </ol>
        </div>
      )}
    </div>
  );
}

function renderAssistantContent(text: string) {
  const parts: React.ReactNode[] = [];
  const fenceRegex = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = fenceRegex.exec(text)) !== null) {
    if (m.index > lastIdx) parts.push(<span key={`t${key++}`}>{text.slice(lastIdx, m.index)}</span>);
    const code = m[2];
    parts.push(<CodeBlock key={`c${key++}`} code={code} lang={m[1] || ''} />);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) parts.push(<span key={`t${key++}`}>{text.slice(lastIdx)}</span>);
  return parts;
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: 'relative', margin: '6px 0', borderRadius: '6px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.12)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{lang || 'code'}</span>
        <button
          onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)', padding: '2px', display: 'flex', alignItems: 'center' }}
          title="Copy code"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
        </button>
      </div>
      <pre style={{ margin: 0, padding: '8px 10px', fontSize: '11px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#e6edf3', overflowX: 'auto', whiteSpace: 'pre' }}>{code}</pre>
    </div>
  );
}

export function AiChatBubble({ colorSettings }: AiChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [panelZ, setPanelZ] = useState(10001);
  const bringPanelToFront = useCallback(() => {
    const w = window as any;
    if (!w.__brynTopZ || w.__brynTopZ < 100100) w.__brynTopZ = 100100;
    setPanelZ(++w.__brynTopZ);
  }, []);
  const [dragPos, setDragPos] = useState<{ x: number; y: number }>(() => {
    try { const s = localStorage.getItem('aiChatBubbleDragPos'); if (s) return JSON.parse(s); } catch {}
    return { x: 0, y: 0 };
  });
  const dragStateRef = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  useEffect(() => { try { localStorage.setItem('aiChatBubbleDragPos', JSON.stringify(dragPos)); } catch {} }, [dragPos]);
  const onDragStart = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, select, input, textarea, a')) return;
    dragStateRef.current = { startX: e.clientX, startY: e.clientY, baseX: dragPos.x, baseY: dragPos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      const dx = ev.clientX - dragStateRef.current.startX;
      const dy = ev.clientY - dragStateRef.current.startY;
      setDragPos({ x: dragStateRef.current.baseX + dx, y: dragStateRef.current.baseY + dy });
    };
    const onUp = () => { dragStateRef.current = null; document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  }, [dragPos]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseFilter, setCourseFilter] = useState('all');
  const [yearLevel, setYearLevel] = useState<number>(() => {
    const saved = parseInt(localStorage.getItem('studyAssistantYearLevel') || '1', 10);
    return Number.isFinite(saved) && saved >= 1 && saved <= 4 ? saved : 1;
  });
  useEffect(() => { localStorage.setItem('studyAssistantYearLevel', String(yearLevel)); }, [yearLevel]);
  const [pastedImage, setPastedImage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [chatSize, setChatSize] = useState<{ w: number; h: number }>(() => {
    try { const s = localStorage.getItem('aiChatBubbleSize'); if (s) return JSON.parse(s); } catch {}
    return { w: 0, h: 0 };
  });
  useEffect(() => { try { localStorage.setItem('aiChatBubbleSize', JSON.stringify(chatSize)); } catch {} }, [chatSize]);
  const resizeStateRef = useRef<{ startX: number; startY: number; baseW: number; baseH: number } | null>(null);
  const onResizeStart = useCallback((axis: 'corner' | 'top' | 'left' | 'right' | 'bottom' | 'topright' | 'bottomleft' | 'bottomright') => (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const panel = (e.currentTarget as HTMLElement).parentElement as HTMLElement;
    const rect = panel.getBoundingClientRect();
    const isTouch = 'touches' in e;
    const startX = isTouch ? (e as React.TouchEvent).touches[0].clientX : (e as React.MouseEvent).clientX;
    const startY = isTouch ? (e as React.TouchEvent).touches[0].clientY : (e as React.MouseEvent).clientY;
    resizeStateRef.current = { startX, startY, baseW: rect.width, baseH: rect.height };
    const affectsW = (a: string) => a === 'corner' || a === 'left' || a === 'right' || a === 'topright' || a === 'bottomleft' || a === 'bottomright';
    const affectsH = (a: string) => a === 'corner' || a === 'top' || a === 'bottom' || a === 'topright' || a === 'bottomleft' || a === 'bottomright';
    // Panel is anchored bottom-right. Sign of growth depends on which edge:
    // - dragging left/up edges OUT (away from anchor) grows; mouse delta is negative.
    // - dragging right/bottom edges OUT shrinks toward anchor; mouse delta is positive but reduces size.
    const wSign = (a: string) => (a === 'right' || a === 'topright' || a === 'bottomright') ? 1 : -1;
    const hSign = (a: string) => (a === 'bottom' || a === 'bottomleft' || a === 'bottomright') ? 1 : -1;
    const move = (cx: number, cy: number) => {
      if (!resizeStateRef.current) return;
      const dx = cx - resizeStateRef.current.startX;
      const dy = cy - resizeStateRef.current.startY;
      const w = affectsW(axis) ? Math.max(320, resizeStateRef.current.baseW + wSign(axis) * dx) : resizeStateRef.current.baseW;
      const h = affectsH(axis) ? Math.max(280, resizeStateRef.current.baseH + hSign(axis) * dy) : resizeStateRef.current.baseH;
      setChatSize({ w, h });
    };
    const onMove = (ev: MouseEvent) => move(ev.clientX, ev.clientY);
    const onTouchMove = (ev: TouchEvent) => { if (ev.touches[0]) move(ev.touches[0].clientX, ev.touches[0].clientY); };
    const onUp = () => {
      resizeStateRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
      document.removeEventListener('touchcancel', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);
    document.addEventListener('touchcancel', onUp);
  }, []);
  const [essayFormOpen, setEssayFormOpen] = useState(false);
  const [essayTopic, setEssayTopic] = useState('');
  const [essayWords, setEssayWords] = useState(1200);
  const [essayPages, setEssayPages] = useState(4);
  const [essayLengthMode, setEssayLengthMode] = useState<'words' | 'pages'>('pages');
  const [essayCourse, setEssayCourse] = useState('all');
  const [essayStyle, setEssayStyle] = useState<'APA'|'MLA'|'Chicago'>('APA');
  const [essayLoading, setEssayLoading] = useState(false);
  const [essayJustDone, setEssayJustDone] = useState(false);

  const generateEssay = useCallback(async (topic: string, opts?: { wordCount?: number; courseCode?: string; citationStyle?: string }) => {
    if (essayLoading) return;
    setEssayLoading(true);
    setEssayFormOpen(false);
    const effectiveWordCount = opts?.wordCount ?? (essayLengthMode === 'pages' ? essayPages * 250 : essayWords);
    const lengthLabel = opts?.wordCount ? `${opts.wordCount}-word` : (essayLengthMode === 'pages' ? `${essayPages}-page (~${effectiveWordCount}-word, TNR 12pt 2x)` : `${effectiveWordCount}-word`);
    const userText = `Write a ${lengthLabel} ${opts?.citationStyle ?? essayStyle} essay on: ${topic}${(opts?.courseCode ?? essayCourse) !== 'all' ? ` (sources: ${opts?.courseCode ?? essayCourse})` : ''}`;
    setMessages(prev => [...prev, { role: 'user', content: userText }]);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    try {
      const resp = await fetch('/api/essays/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          wordCount: effectiveWordCount,
          courseCodes: (opts?.courseCode ?? essayCourse) === 'all' ? undefined : (opts?.courseCode ?? essayCourse),
          citationStyle: opts?.citationStyle ?? essayStyle,
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Drafted a ${data.wordCount}-word essay on "${data.topic}" using ${data.sourceCount} source${data.sourceCount === 1 ? '' : 's'}. Click any citation to see the source passage.`,
        essay: data,
      }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Essay generation failed: ${err.message}` }]);
    } finally {
      setEssayLoading(false);
      setEssayJustDone(true);
      setTimeout(() => setEssayJustDone(false), 8000);
    }
  }, [essayLoading, essayWords, essayPages, essayLengthMode, essayCourse, essayStyle]);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [screenCopied, setScreenCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const flashStatus = (msg: string, ms = 2000) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(null), ms); };

  const sendMessage = useCallback(async () => {
    const msg = input.trim();
    if ((!msg && !pastedImage) || loading) return;
    // Natural-language essay detection
    if (msg && !pastedImage) {
      const essayMatch = msg.match(/^(?:please\s+)?(?:write|draft|generate|compose)\s+(?:me\s+)?(?:an?\s+)?(?:(\d{3,4})[-\s]?word\s+)?(?:(APA|MLA|Chicago)\s+)?essay\s+(?:on|about|regarding)\s+(.+?)(?:\s+(?:using|from|with)\s+([A-Z]{4}\d{3}(?:\s*(?:and|,)\s*[A-Z]{4}\d{3})*)\s*(?:readings|materials|sources)?)?\s*\.?$/i);
      if (essayMatch) {
        const wc = essayMatch[1] ? parseInt(essayMatch[1]) : essayWords;
        const style = essayMatch[2] ? (essayMatch[2].toUpperCase() === 'APA' ? 'APA' : essayMatch[2].toUpperCase() === 'MLA' ? 'MLA' : 'Chicago') : essayStyle;
        const topic = essayMatch[3].trim();
        const courseHint = essayMatch[4]?.match(/[A-Z]{4}\d{3}/)?.[0];
        setInput('');
        await generateEssay(topic, { wordCount: wc, citationStyle: style, courseCode: courseHint || essayCourse });
        return;
      }
    }
    const finalMsg = msg || (pastedImage ? 'Please analyze this image.' : '');
    const userMsg: ChatMessage = { role: 'user', content: finalMsg, image: pastedImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    const sentImage = pastedImage;
    setPastedImage(null);
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    try {
      const resp = await fetch('/api/ai/chat-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: finalMsg, courseFilter, history: messages.slice(-6), imageDataUrl: sentImage || undefined, yearLevel }),
      });
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch { data = { error: `HTTP ${resp.status}: ${text.slice(0, 200)}` }; }
      if (!resp.ok) throw new Error(data.error || `HTTP ${resp.status}`);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, courseFilter, messages, pastedImage, yearLevel]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (!file) continue;
        const reader = new FileReader();
        reader.onload = () => setPastedImage(reader.result as string);
        reader.readAsDataURL(file);
        break;
      }
    }
  }, []);

  const handleFilePick = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => setPastedImage(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const startSnipping = useCallback(async () => {
    try {
      const resp = await fetch('/api/screen-capture');
      if (resp.ok) {
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onload = () => { setPastedImage(reader.result as string); flashStatus('Screen captured'); };
        reader.readAsDataURL(blob);
        return;
      }
    } catch {}
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(document.body, { useCORS: true, allowTaint: true, scale: 1, logging: false });
      setPastedImage(canvas.toDataURL('image/png'));
      flashStatus('Screen captured');
    } catch {
      flashStatus('Capture failed');
    }
  }, []);

  const formatConversation = useCallback((format: 'text' | 'markdown') => {
    const ts = new Date().toLocaleString();
    const header = format === 'markdown'
      ? `# Study Assistant Conversation\n_Exported: ${ts}_\n\n---\n\n`
      : `Study Assistant Conversation\nExported: ${ts}\n${'='.repeat(50)}\n\n`;
    return header + messages.map(m => {
      const role = m.role === 'user' ? 'You' : 'Study Assistant';
      return format === 'markdown' ? `### ${role}\n${m.content}\n` : `[${role}]\n${m.content}\n${'—'.repeat(30)}\n`;
    }).join('\n');
  }, [messages]);

  const exportAsFile = useCallback((format: 'text' | 'markdown') => {
    const content = formatConversation(format);
    const ext = format === 'markdown' ? 'md' : 'txt';
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `study-assistant-${dateStr}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    flashStatus('Downloaded!');
  }, [formatConversation]);

  const saveToNotepad = useCallback(async () => {
    try {
      const resp = await fetch('/api/notepad/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Study Assistant Chat — ${new Date().toLocaleString()}`, content: formatConversation('markdown') }),
      });
      if (!resp.ok) throw new Error('save failed');
      setShowExportMenu(false);
      flashStatus('Saved to Notepad!');
    } catch {
      flashStatus('Save failed');
    }
  }, [formatConversation]);

  const copyConversation = useCallback(() => {
    navigator.clipboard.writeText(formatConversation('text')).then(() => {
      setShowExportMenu(false);
      flashStatus('Copied!');
    });
  }, [formatConversation]);

  const copyScreen = useCallback(() => {
    navigator.clipboard.writeText(formatConversation('text')).then(() => {
      setScreenCopied(true);
      setTimeout(() => setScreenCopied(false), 1500);
    });
  }, [formatConversation]);

  useEffect(() => {
    if (!showExportMenu) return;
    const close = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('[data-testid="ai-chat-export-menu"]') && !t.closest('[data-testid="button-ai-chat-export"]')) {
        setShowExportMenu(false);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
    return () => document.removeEventListener('click', close);
  }, [showExportMenu]);

  const headerIconBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px', display: 'flex', alignItems: 'center', position: 'relative' };
  const inputIconBtnStyle: React.CSSProperties = { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' };

  return (
    <>
      <button
        onClick={() => { setIsOpen(prev => !prev); bringPanelToFront(); setTimeout(() => inputRef.current?.focus(), 100); }}
        style={{
          position: 'fixed', bottom: '12px', right: '12px', zIndex: 200000,
          background: essayLoading
            ? 'linear-gradient(135deg, #b45309 0%, #f59e0b 50%, #fde047 100%)'
            : essayJustDone
              ? 'linear-gradient(135deg, #14532d 0%, #16a34a 50%, #86efac 100%)'
              : isOpen
                ? 'linear-gradient(135deg, #1565c0 0%, #42a5f5 50%, #90caf9 100%)'
                : loading
                  ? 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #c4b5fd 100%)'
                  : 'linear-gradient(135deg, #0a3d7a 0%, #1565c0 50%, #42a5f5 100%)',
          border: `1.5px solid ${essayLoading ? 'rgba(253,224,71,0.8)' : essayJustDone ? 'rgba(134,239,172,0.8)' : isOpen ? 'rgba(144,202,249,0.6)' : 'rgba(255,255,255,0.3)'}`,
          animation: essayLoading ? 'pulse 1.5s ease-in-out infinite' : 'none',
          borderRadius: '50%', width: '44px', height: '44px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#fff',
          boxShadow: '0 4px 12px rgba(10,61,122,0.4)', transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(10,61,122,0.55)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,61,122,0.4)'; e.currentTarget.style.transform = 'scale(1)'; }}
        data-testid="button-ai-chat-bubble-dashboard"
        title="AI Study Assistant"
      >
        <MessageSquare size={16} />
      </button>

      {(
        <div style={{
          position: 'fixed',
          bottom: expanded ? '12px' : '64px',
          right: '12px',
          width: chatSize.w ? `${chatSize.w}px` : (expanded ? 'min(900px, 95vw)' : '520px'),
          maxWidth: '95vw',
          height: chatSize.h ? `${chatSize.h}px` : undefined,
          maxHeight: expanded ? 'calc(100vh - 24px)' : 'calc(100vh - 100px)',
          background: 'linear-gradient(180deg, #0a2a5e 0%, #0d3a7a 20%, #154B96 50%, #1a5ab0 80%, #ACD6F2 100%)',
          border: '1.5px solid rgba(144,202,249,0.35)',
          borderRadius: '14px', zIndex: panelZ,
          display: isOpen ? 'flex' : 'none', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(10,42,94,0.6), 0 4px 12px rgba(0,0,0,0.3)',
          transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
        }} onMouseDownCapture={bringPanelToFront} data-testid="ai-chat-panel-dashboard">
          {/* Top-left corner handle (drag both axes) */}
          <div
            onMouseDown={onResizeStart('corner')}
            onTouchStart={onResizeStart('corner')}
            onDoubleClick={() => setChatSize({ w: 0, h: 0 })}
            title="Drag to resize · double-click to reset"
            data-testid="handle-ai-chat-resize-dashboard"
            style={{
              position: 'absolute', top: 0, left: 0, width: 22, height: 22,
              cursor: 'nwse-resize', background: 'rgba(255,255,255,0.18)',
              borderTop: '2px solid rgba(255,255,255,0.7)', borderLeft: '2px solid rgba(255,255,255,0.7)',
              borderTopLeftRadius: '14px', zIndex: 50, touchAction: 'none',
            }}
          />
          {/* Top edge — height only */}
          <div
            onMouseDown={onResizeStart('top')}
            onTouchStart={onResizeStart('top')}
            title="Drag to resize height"
            data-testid="handle-ai-chat-resize-top"
            style={{
              position: 'absolute', top: 0, left: 22, right: 22, height: 6,
              cursor: 'ns-resize', zIndex: 49, touchAction: 'none',
            }}
          />
          {/* Left edge — width only */}
          <div
            onMouseDown={onResizeStart('left')}
            onTouchStart={onResizeStart('left')}
            title="Drag to resize width"
            data-testid="handle-ai-chat-resize-left"
            style={{
              position: 'absolute', top: 22, bottom: 22, left: 0, width: 6,
              cursor: 'ew-resize', zIndex: 49, touchAction: 'none',
            }}
          />
          {/* Right edge — width only (shrink toward anchor) */}
          <div
            onMouseDown={onResizeStart('right')}
            onTouchStart={onResizeStart('right')}
            title="Drag to resize width"
            data-testid="handle-ai-chat-resize-right"
            style={{
              position: 'absolute', top: 22, bottom: 22, right: 0, width: 6,
              cursor: 'ew-resize', zIndex: 49, touchAction: 'none',
            }}
          />
          {/* Bottom edge — height only */}
          <div
            onMouseDown={onResizeStart('bottom')}
            onTouchStart={onResizeStart('bottom')}
            title="Drag to resize height"
            data-testid="handle-ai-chat-resize-bottom"
            style={{
              position: 'absolute', bottom: 0, left: 22, right: 22, height: 6,
              cursor: 'ns-resize', zIndex: 49, touchAction: 'none',
            }}
          />
          {/* Top-right corner */}
          <div
            onMouseDown={onResizeStart('topright')}
            onTouchStart={onResizeStart('topright')}
            title="Drag to resize"
            data-testid="handle-ai-chat-resize-topright"
            style={{
              position: 'absolute', top: 0, right: 0, width: 18, height: 18,
              cursor: 'nesw-resize', zIndex: 50, touchAction: 'none',
            }}
          />
          {/* Bottom-left corner */}
          <div
            onMouseDown={onResizeStart('bottomleft')}
            onTouchStart={onResizeStart('bottomleft')}
            title="Drag to resize"
            data-testid="handle-ai-chat-resize-bottomleft"
            style={{
              position: 'absolute', bottom: 0, left: 0, width: 18, height: 18,
              cursor: 'nesw-resize', zIndex: 50, touchAction: 'none',
            }}
          />
          {/* Bottom-right corner */}
          <div
            onMouseDown={onResizeStart('bottomright')}
            onTouchStart={onResizeStart('bottomright')}
            title="Drag to resize"
            data-testid="handle-ai-chat-resize-bottomright"
            style={{
              position: 'absolute', bottom: 0, right: 0, width: 18, height: 18,
              cursor: 'nwse-resize', zIndex: 50, touchAction: 'none',
            }}
          />
          <div onMouseDown={onDragStart} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', paddingLeft: '34px', borderBottom: '1px solid rgba(255,255,255,0.15)', cursor: dragStateRef.current ? 'grabbing' : 'grab', userSelect: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} color="#ffffff" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>Study Assistant</span>
              {statusMsg && <span style={{ fontSize: '10px', color: '#a5b4fc', marginLeft: '4px' }}>{statusMsg}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <select
                value={yearLevel}
                onChange={e => setYearLevel(parseInt(e.target.value, 10))}
                style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(165,180,252,0.5)', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '4px 8px', cursor: 'pointer', fontWeight: 600 }}
                title="Writing level used when generating essays and prose"
                data-testid="select-ai-chat-year-level"
              >
                <option value={1} style={{ background: '#0d2548' }}>Year 1</option>
                <option value={2} style={{ background: '#0d2548' }}>Year 2</option>
                <option value={3} style={{ background: '#0d2548' }}>Year 3</option>
                <option value={4} style={{ background: '#0d2548' }}>Year 4</option>
              </select>
              <select
                value={courseFilter}
                onChange={e => setCourseFilter(e.target.value)}
                style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', color: '#fff', fontSize: '11px', padding: '4px 8px', cursor: 'pointer' }}
                data-testid="select-ai-chat-course-dashboard"
              >
                <option value="all">All courses</option>
                {['CPPA122','CFNF400','CASL101','CPPA101','CPPA102','CPPA120','CPPA121','CPPA125','CECN210','CPHL110','CHST501'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowExportMenu(s => !s)}
                  style={headerIconBtnStyle}
                  title="Save / Export"
                  data-testid="button-ai-chat-export"
                >
                  <Download size={15} />
                </button>
                {showExportMenu && (
                  <div
                    data-testid="ai-chat-export-menu"
                    style={{ position: 'absolute', top: '100%', right: 0, marginTop: '6px', background: '#0d2548', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', boxShadow: '0 8px 20px rgba(0,0,0,0.4)', minWidth: '180px', zIndex: 10010, overflow: 'hidden' }}
                  >
                    {[
                      { icon: <Copy size={13} />, label: 'Copy all', action: copyConversation, id: 'copy' },
                      { icon: <BookOpen size={13} />, label: 'Save to Notepad', action: saveToNotepad, id: 'notepad' },
                      { icon: <FileText size={13} />, label: 'Download .txt', action: () => exportAsFile('text'), id: 'txt' },
                      { icon: <FileText size={13} />, label: 'Download .md', action: () => exportAsFile('markdown'), id: 'md' },
                    ].map(item => (
                      <button
                        key={item.id}
                        onClick={item.action}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', background: 'none', border: 'none', color: '#fff', padding: '8px 12px', fontSize: '12px', cursor: 'pointer', textAlign: 'left' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                        data-testid={`ai-chat-export-${item.id}`}
                      >
                        {item.icon} {item.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => setEssayFormOpen(o => !o)}
                style={{ ...headerIconBtnStyle, background: essayFormOpen ? 'rgba(245,158,11,0.4)' : headerIconBtnStyle.background }}
                title="Write Essay"
                data-testid="button-ai-chat-essay"
              >
                <PenLine size={15} />
              </button>
              <button
                onClick={copyScreen}
                style={headerIconBtnStyle}
                title={screenCopied ? 'Copied!' : 'Copy entire chat'}
                data-testid="button-ai-chat-copy-screen"
              >
                {screenCopied ? <Check size={15} /> : <Copy size={15} />}
              </button>
              <button
                onClick={() => setExpanded(e => !e)}
                style={headerIconBtnStyle}
                title={expanded ? 'Minimize' : 'Expand'}
                data-testid="button-ai-chat-expand"
              >
                {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
              </button>
              <button onClick={() => setMessages([])} style={headerIconBtnStyle} title="Clear chat" data-testid="button-ai-chat-clear-dashboard">
                <RotateCcw size={15} />
              </button>
              <button onClick={() => setIsOpen(false)} style={headerIconBtnStyle} title="Close" data-testid="button-ai-chat-close-dashboard">
                <X size={15} />
              </button>
            </div>
          </div>

          {essayFormOpen && (
            <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.15)', background: 'rgba(245,158,11,0.08)' }} data-testid="essay-form-panel">
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#fbbf24', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <PenLine size={13} /> Write Essay
              </div>
              <input
                value={essayTopic}
                onChange={e => setEssayTopic(e.target.value)}
                placeholder="Topic (e.g. The role of social services in housing policy)"
                style={{ width: '100%', padding: '8px 10px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', color: '#fff', fontSize: '12px', marginBottom: '8px' }}
                data-testid="input-essay-topic"
                onKeyDown={e => { if (e.key === 'Enter' && essayTopic.trim()) generateEssay(essayTopic.trim()); }}
              />
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '6px', padding: '3px' }}>
                  <button
                    onClick={() => setEssayLengthMode('words')}
                    style={{ padding: '3px 8px', background: essayLengthMode === 'words' ? 'rgba(245,158,11,0.4)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    data-testid="button-essay-mode-words"
                  >Words</button>
                  <button
                    onClick={() => setEssayLengthMode('pages')}
                    style={{ padding: '3px 8px', background: essayLengthMode === 'pages' ? 'rgba(245,158,11,0.4)' : 'transparent', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
                    data-testid="button-essay-mode-pages"
                  >Pages</button>
                </div>
                {essayLengthMode === 'words' ? (
                  <>
                    <label style={{ fontSize: '11px', color: '#fff' }}>Words:</label>
                    <input type="number" value={essayWords} min={200} max={10000} step={100} onChange={e => setEssayWords(parseInt(e.target.value) || 1200)}
                      style={{ width: '70px', padding: '4px 6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      data-testid="input-essay-words" />
                  </>
                ) : (
                  <label style={{ fontSize: '11px', color: '#fff', display: 'flex', alignItems: 'center', gap: '4px' }} title="Times New Roman 12pt, double-spaced, 1in margins (~250 words/page)">
                    Pages:
                    <select value={essayPages} onChange={e => setEssayPages(parseInt(e.target.value, 10))}
                      style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                      data-testid="select-essay-pages">
                      {[1,2,3,4,5,6,7,8,10,12,15,20,25,30].map(n => (
                        <option key={n} value={n} style={{ background: '#0d2548' }}>{n}</option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={{ fontSize: '11px', color: '#fff' }}>Course:</label>
                <select value={essayCourse} onChange={e => setEssayCourse(e.target.value)}
                  style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', color: '#fff', fontSize: '11px', maxWidth: '220px' }}
                  data-testid="select-essay-course">
                  <option value="all" style={{ background: '#0d2548' }}>All courses</option>
                  {(() => {
                    const fallback = ['CPPA122','CFNF400','CASL101','CPPA101','CPPA102','CPPA120','CPPA121','CPPA125','CECN210','CPHL110','CHST501'];
                    let entries: Array<{ code: string; label: string }> = [];
                    try {
                      const raw = localStorage.getItem('coursesData');
                      if (raw) {
                        const parsed = JSON.parse(raw);
                        const list: Array<{ name?: string }> = parsed?.courses || [];
                        entries = list
                          .map(c => {
                            const full = (c.name || '').trim();
                            if (!full) return null;
                            const parts = full.split(' - ');
                            const code = parts[0]?.trim() || full;
                            const title = parts.slice(1).join(' - ').trim();
                            return { code, label: title ? `${code} — ${title}` : code };
                          })
                          .filter((x): x is { code: string; label: string } => !!x);
                      }
                    } catch {}
                    if (!entries.length) entries = fallback.map(c => ({ code: c, label: c }));
                    return entries.map(e => (
                      <option key={e.code} value={e.code} style={{ background: '#0d2548' }} title={e.label}>{e.label}</option>
                    ));
                  })()}
                </select>
                <label style={{ fontSize: '11px', color: '#fff' }}>Style:</label>
                <select value={essayStyle} onChange={e => setEssayStyle(e.target.value as any)}
                  style={{ padding: '4px 6px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '4px', color: '#fff', fontSize: '11px' }}
                  data-testid="select-essay-style">
                  <option value="APA" style={{ background: '#0d2548' }}>APA 7</option>
                  <option value="MLA" style={{ background: '#0d2548' }}>MLA 9</option>
                  <option value="Chicago" style={{ background: '#0d2548' }}>Chicago</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => essayTopic.trim() && generateEssay(essayTopic.trim())}
                  disabled={!essayTopic.trim() || essayLoading}
                  style={{ padding: '6px 14px', background: essayLoading ? 'rgba(245,158,11,0.4)' : '#f59e0b', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: essayTopic.trim() && !essayLoading ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: '6px' }}
                  data-testid="button-generate-essay"
                >
                  {essayLoading ? <Loader2 size={12} className="animate-spin" /> : <PenLine size={12} />}
                  {essayLoading ? 'Generating…' : 'Generate'}
                </button>
                <button onClick={() => setEssayFormOpen(false)} style={{ padding: '6px 12px', background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }} data-testid="button-cancel-essay-form">Cancel</button>
              </div>
            </div>
          )}
          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '280px', maxHeight: expanded ? 'none' : '500px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 14px', color: 'rgba(255,255,255,0.5)' }}>
                <MessageSquare size={32} style={{ margin: '0 auto 12px', opacity: 0.4, color: '#fff' }} />
                <div style={{ fontSize: '14px', marginBottom: '16px', color: '#fff' }}>Ask questions about your course materials</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', textAlign: 'left' }}>
                  {['Summarize the key concepts from CFNF module 3', 'Generate flashcards for CPPA122 week 5', 'What are the main arguments in the CASL reading?', 'Compare the theories discussed in CPHL110'].map(ex => (
                    <div
                      key={ex}
                      onClick={() => { setInput(ex); inputRef.current?.focus(); }}
                      style={{ fontSize: '12px', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', transition: 'all 0.15s', color: '#fff' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                      data-testid={`ai-chat-example-${ex.slice(0, 20)}`}
                    >
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>→</span> {ex}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
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
                  {msg.image && (
                    <img src={msg.image} alt="attachment" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '6px', display: 'block', marginBottom: msg.content ? '6px' : 0 }} />
                  )}
                  {msg.role === 'assistant' ? renderAssistantContent(msg.content) : msg.content}
                </div>
                {msg.essay && <EssayBlock essay={msg.essay} />}
              </div>
            ))}
            {essayLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: '#fbbf24', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Drafting essay…
              </div>
            )}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking...
              </div>
            )}
          </div>

          {pastedImage && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img src={pastedImage} alt="attached" style={{ height: '40px', width: '40px', objectFit: 'cover', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.25)' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', flex: 1 }}>Image attached</span>
              <button
                onClick={() => setPastedImage(null)}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', borderRadius: '50%', width: '22px', height: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Remove image"
                data-testid="button-ai-chat-clear-image"
              >
                <X size={11} />
              </button>
            </div>
          )}

          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFilePick} data-testid="input-ai-chat-file" />
            <button
              onClick={() => fileInputRef.current?.click()}
              style={inputIconBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              title="Attach image"
              data-testid="button-ai-chat-attach"
            >
              <Paperclip size={14} />
            </button>
            <button
              onClick={startSnipping}
              style={inputIconBtnStyle}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.22)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              title="Screen capture"
              data-testid="button-ai-chat-snip"
            >
              <Scissors size={14} />
            </button>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
              onPaste={handlePaste}
              placeholder="Ask about your readings..."
              rows={1}
              style={{
                flex: 1, background: '#ffffff', border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '12px', padding: '12px 16px', color: '#1a1a2e', fontSize: '14px',
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                minHeight: '44px', maxHeight: '90px',
              }}
              data-testid="input-ai-chat-dashboard"
            />
            <button
              onClick={sendMessage}
              disabled={loading || (!input.trim() && !pastedImage)}
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: loading || (!input.trim() && !pastedImage) ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #1565c0, #42a5f5)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || (!input.trim() && !pastedImage) ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', flexShrink: 0,
              }}
              data-testid="button-ai-chat-send-dashboard"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '16px', height: '16px' }}>
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
