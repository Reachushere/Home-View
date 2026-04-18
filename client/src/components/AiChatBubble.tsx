import { useState, useRef, useCallback, useEffect } from 'react';
import { MessageSquare, RotateCcw, X, Loader2, Download, Copy, Maximize2, Minimize2, Paperclip, Scissors, BookOpen, FileText, Check } from 'lucide-react';

interface AiChatBubbleProps {
  colorSettings: {
    headerBar: string;
    mainBackground: string;
    mainBackgroundGradientEnd: string;
  };
}

type ChatMessage = { role: 'user' | 'assistant'; content: string; image?: string };

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
        onClick={() => { setIsOpen(prev => !prev); setTimeout(() => inputRef.current?.focus(), 100); }}
        style={{
          position: 'fixed', bottom: '12px', right: '12px', zIndex: 10000,
          background: isOpen ? 'linear-gradient(135deg, #1565c0 0%, #42a5f5 50%, #90caf9 100%)' : (loading ? 'linear-gradient(135deg, #6d28d9 0%, #8b5cf6 50%, #c4b5fd 100%)' : 'linear-gradient(135deg, #0a3d7a 0%, #1565c0 50%, #42a5f5 100%)'),
          border: `1.5px solid ${isOpen ? 'rgba(144,202,249,0.6)' : 'rgba(255,255,255,0.3)'}`,
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
          width: expanded ? 'min(900px, 95vw)' : '520px',
          maxWidth: '95vw',
          maxHeight: expanded ? 'calc(100vh - 24px)' : 'calc(100vh - 100px)',
          background: 'linear-gradient(180deg, #0a2a5e 0%, #0d3a7a 20%, #154B96 50%, #1a5ab0 80%, #ACD6F2 100%)',
          border: '1.5px solid rgba(144,202,249,0.35)',
          borderRadius: '14px', zIndex: 10001,
          display: isOpen ? 'flex' : 'none', flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(10,42,94,0.6), 0 4px 12px rgba(0,0,0,0.3)',
          transform: `translate(${dragPos.x}px, ${dragPos.y}px)`,
        }} data-testid="ai-chat-panel-dashboard">
          <div onMouseDown={onDragStart} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.15)', cursor: dragStateRef.current ? 'grabbing' : 'grab', userSelect: 'none' }}>
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
                {['CPPA122','CFNF400','CASL101','CPPA101','CPPA102','CPPA120','CPPA121','CPPA125','CECN210','CPHL110','CHIS105'].map(c => (
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
              </div>
            ))}
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
