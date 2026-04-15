import { useState, useRef, useCallback, useEffect } from 'react';
import { Zap, Send, X, Loader2, CheckCircle, XCircle, AlertTriangle, Trash2, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';
import { queryClient } from '@/lib/queryClient';

const thinkingKeyframes = `
@keyframes ai-think-pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1.1); }
}
@keyframes ai-think-glow {
  0%, 100% { box-shadow: 0 0 8px rgba(168,85,247,0.3), 0 0 20px rgba(168,85,247,0.1); }
  50% { box-shadow: 0 0 16px rgba(168,85,247,0.6), 0 0 40px rgba(168,85,247,0.2); }
}
`;

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
  const [expanded, setExpanded] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [thinkingPhase, setThinkingPhase] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight || 0, behavior: 'smooth' }), 50);
  }, [messages]);

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
    background: 'linear-gradient(180deg, #0d1b3e 0%, #0f2347 30%, #132d5a 60%, #162f5e 100%)',
    border: '1.5px solid rgba(100,160,255,0.3)',
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
              onClick={() => { setExpanded(!expanded); if (expanded) setPosition(null); }}
              style={{ background: 'none', border: 'none', color: 'rgba(160,190,255,0.6)', cursor: 'pointer', padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center' }}
              title={expanded ? 'Minimize' : 'Expand'}
              data-testid="button-ai-command-expand"
            >
              {expanded ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
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

          {thinkingPhase && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '12px 18px',
                borderRadius: '14px 14px 14px 4px',
                background: 'linear-gradient(135deg, rgba(88,28,135,0.4), rgba(126,34,206,0.3))',
                border: '1px solid rgba(168,85,247,0.35)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                animation: 'ai-think-glow 2s ease-in-out infinite',
              }}>
                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(192,132,252,0.9)', animation: 'ai-think-pulse 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(168,85,247,0.9)', animation: 'ai-think-pulse 1.4s ease-in-out infinite', animationDelay: '0.2s' }} />
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: 'rgba(139,92,246,0.9)', animation: 'ai-think-pulse 1.4s ease-in-out infinite', animationDelay: '0.4s' }} />
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(216,180,254,0.9)', fontWeight: 500 }}>{thinkingPhase}</span>
              </div>
            </div>
          )}
          {loading && !thinkingPhase && !messages.some(m => m.role === 'assistant' && m.content === '') && (
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
                <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                Connecting...
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
            rows={3}
            style={{
              flex: 1,
              background: 'rgba(20,40,80,0.6)',
              border: '1px solid rgba(100,160,255,0.2)',
              borderRadius: '10px',
              padding: '10px 14px',
              color: '#dce8ff',
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
