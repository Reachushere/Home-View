import { useState, useRef, useCallback } from 'react';
import { MessageSquare, RotateCcw, X, Loader2 } from 'lucide-react';

interface AiChatBubbleProps {
  colorSettings: {
    headerBar: string;
    mainBackground: string;
    mainBackgroundGradientEnd: string;
  };
}

export function AiChatBubble({ colorSettings }: AiChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [courseFilter, setCourseFilter] = useState('all');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;
    const userMsg = { role: 'user' as const, content: msg };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    try {
      const resp = await fetch('/api/ai/chat-materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, courseFilter, history: messages.slice(-6) }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Chat failed');
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }), 50);
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, courseFilter, messages]);

  return (
    <>
      <button
        onClick={() => { setIsOpen(prev => !prev); setTimeout(() => inputRef.current?.focus(), 100); }}
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '12px',
          zIndex: 10000,
          background: isOpen ? 'linear-gradient(135deg, #1565c0 0%, #42a5f5 50%, #90caf9 100%)' : 'linear-gradient(135deg, #0a3d7a 0%, #1565c0 50%, #42a5f5 100%)',
          border: `1.5px solid ${isOpen ? 'rgba(144,202,249,0.6)' : 'rgba(255,255,255,0.3)'}`,
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: '#fff',
          boxShadow: '0 4px 12px rgba(10,61,122,0.4)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 18px rgba(10,61,122,0.55)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(10,61,122,0.4)'; e.currentTarget.style.transform = 'scale(1)'; }}
        data-testid="button-ai-chat-bubble-dashboard"
        title="AI Study Assistant"
      >
        <MessageSquare size={16} />
      </button>

      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '64px',
          right: '12px',
          width: '520px',
          maxWidth: '95vw',
          maxHeight: 'calc(100vh - 100px)',
          background: 'linear-gradient(180deg, #0a2a5e 0%, #0d3a7a 20%, #154B96 50%, #1a5ab0 80%, #ACD6F2 100%)',
          border: '1.5px solid rgba(144,202,249,0.35)',
          borderRadius: '14px',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 12px 40px rgba(10,42,94,0.6), 0 4px 12px rgba(0,0,0,0.3)',
        }} data-testid="ai-chat-panel-dashboard">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MessageSquare size={18} color="#ffffff" />
              <span style={{ fontSize: '15px', fontWeight: 700, color: '#fff', letterSpacing: '0.3px' }}>Study Assistant</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
              <button onClick={() => setMessages([])} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px' }} title="Clear chat" data-testid="button-ai-chat-clear-dashboard">
                <RotateCcw size={15} />
              </button>
              <button onClick={() => setIsOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ffffff', padding: '2px' }} data-testid="button-ai-chat-close-dashboard">
                <X size={15} />
              </button>
            </div>
          </div>

          <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', minHeight: '280px', maxHeight: '500px' }}>
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
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Thinking...
              </div>
            )}
          </div>

          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
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
              disabled={loading || !input.trim()}
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: loading || !input.trim() ? 'rgba(255,255,255,0.1)' : 'linear-gradient(135deg, #1565c0, #42a5f5)',
                border: '1px solid rgba(255,255,255,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
                flexShrink: 0,
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
