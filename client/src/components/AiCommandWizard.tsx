import { useState, useRef, useCallback, useEffect } from 'react';
import { Zap, Send, X, Loader2, CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolResults?: any[];
  actionTaken?: boolean;
  pendingConfirmations?: any[];
}

interface AiCommandWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AiCommandWizard({ isOpen, onClose }: AiCommandWizardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<any[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight || 0, behavior: 'smooth' }), 50);
  }, [messages]);

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
    if (!msg || loading) return;
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    if (!overrideMsg) setInput('');
    setLoading(true);

    try {
      const resp = await fetch('/api/ai/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
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

        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

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
                const toolLabel = event.name.replace(/_/g, ' ');
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: streamedContent + `⚙️ ${toolLabel}...`, toolResults, actionTaken };
                  return updated;
                });
              } else if (event.type === 'tool_done') {
                const toolLabel = event.name.replace(/_/g, ' ');
                const icon = event.success ? '✅' : '❌';
                streamedContent += `${icon} ${toolLabel}\n`;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: streamedContent, toolResults, actionTaken };
                  return updated;
                });
              } else if (event.type === 'token') {
                streamedContent += event.content;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: streamedContent, toolResults, actionTaken };
                  return updated;
                });
              } else if (event.type === 'done') {
                if (event.actionTaken) actionTaken = true;
                if (event.reply && !streamedContent.includes(event.reply)) streamedContent = event.reply;
              } else if (event.type === 'error') {
                streamedContent += `\nError: ${event.error}`;
              }
            } catch {}
          }
        }

        if (actionTaken) invalidateAll();

        setMessages(prev => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: 'assistant', content: streamedContent || 'Done!', toolResults, actionTaken };
          return updated;
        });
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
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, invalidateAll]);

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
          headers: { 'Content-Type': 'application/json' },
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

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingConfirm(null);
  }, []);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 10002,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(4px)',
    }} data-testid="ai-command-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: '600px',
        maxWidth: '95vw',
        maxHeight: '80vh',
        background: 'linear-gradient(180deg, #0d1b3e 0%, #0f2347 30%, #132d5a 60%, #162f5e 100%)',
        border: '1.5px solid rgba(100,160,255,0.3)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(50,120,220,0.15)',
        overflow: 'hidden',
      }} data-testid="ai-command-panel">
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid rgba(100,160,255,0.2)',
          background: 'rgba(15,35,71,0.8)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Zap size={18} color="#60a5fa" />
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#e0ecff', letterSpacing: '0.3px' }}>AI Command</span>
            <span style={{ fontSize: '11px', color: 'rgba(160,190,255,0.6)', fontWeight: 400 }}>natural language control</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={clearChat}
              style={{ background: 'none', border: 'none', color: 'rgba(160,190,255,0.6)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              title="Clear chat"
              data-testid="button-ai-command-clear"
            >
              <RotateCcw size={15} />
            </button>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', color: 'rgba(160,190,255,0.6)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              data-testid="button-ai-command-close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Messages */}
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
            <div style={{ textAlign: 'center', padding: '30px 20px', color: 'rgba(160,190,255,0.5)' }}>
              <Zap size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <div style={{ fontSize: '14px', marginBottom: '8px' }}>Type a command to control UniCal</div>
              <div style={{ fontSize: '12px', lineHeight: '1.8', color: 'rgba(160,190,255,0.35)' }}>
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
                  ? 'linear-gradient(135deg, #1d4ed8, #2563eb)'
                  : msg.role === 'system'
                  ? 'rgba(255,200,50,0.15)'
                  : 'rgba(30,50,90,0.7)',
                border: msg.role === 'user'
                  ? '1px solid rgba(96,165,250,0.3)'
                  : msg.role === 'system'
                  ? '1px solid rgba(255,200,50,0.3)'
                  : '1px solid rgba(100,160,255,0.15)',
                color: msg.role === 'system' ? 'rgba(255,220,100,0.9)' : '#dce8ff',
                fontSize: '13px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
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

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '10px 14px',
                borderRadius: '14px 14px 14px 4px',
                background: 'rgba(30,50,90,0.7)',
                border: '1px solid rgba(100,160,255,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                color: 'rgba(160,190,255,0.6)',
                fontSize: '13px',
              }}>
                <Loader2 size={14} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
                Processing...
              </div>
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

        {/* Input */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid rgba(100,160,255,0.2)',
          background: 'rgba(10,20,50,0.5)',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            rows={1}
            style={{
              flex: 1,
              background: 'rgba(20,40,80,0.6)',
              border: '1px solid rgba(100,160,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#dce8ff',
              fontSize: '13px',
              resize: 'none',
              outline: 'none',
              fontFamily: 'inherit',
              maxHeight: '100px',
              overflowY: 'auto',
            }}
            data-testid="input-ai-command"
          />
          <button
            onClick={() => sendMessage()}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? 'rgba(100,160,255,0.15)' : 'linear-gradient(135deg, #1d4ed8, #2563eb)',
              border: '1px solid rgba(96,165,250,0.3)',
              borderRadius: '10px',
              padding: '10px',
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1,
            }}
            data-testid="button-ai-command-send"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
