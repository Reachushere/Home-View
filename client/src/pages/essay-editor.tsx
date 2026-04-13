import { useState, useCallback, useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import { apiRequest } from '@/lib/queryClient';
import { Bold, Italic, Underline as UnderlineIcon, Strikethrough, List, ListOrdered, AlignLeft, AlignCenter, AlignRight, Heading1, Heading2, Heading3, Undo, Redo, Download, Upload, ExternalLink, FileText, FolderOpen, ChevronLeft, Save, Loader2, X } from 'lucide-react';

interface OneDriveDoc {
  name: string;
  path: string;
  size: number;
  lastModified: string;
  downloadUrl?: string;
}

export default function EssayEditorPage() {
  const [title, setTitle] = useState('Untitled Essay');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [docs, setDocs] = useState<OneDriveDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');
  const [essayFolder, setEssayFolder] = useState('/School/1. TMU/Essays');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Placeholder.configure({ placeholder: 'Start writing your essay...' }),
    ],
    content: '<p></p>',
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none focus:outline-none min-h-[60vh] px-12 py-8',
        style: 'font-family: "Times New Roman", Georgia, serif; font-size: 16px; line-height: 2; color: #e0e0e0;',
      },
    },
  });

  const loadOneDriveDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const resp = await fetch(`/api/onedrive/documents?path=${encodeURIComponent(essayFolder)}`);
      if (resp.ok) {
        const data = await resp.json();
        setDocs(data);
      }
    } catch (err) {
      console.error('Failed to load docs:', err);
    } finally {
      setLoadingDocs(false);
    }
  }, [essayFolder]);

  useEffect(() => {
    if (showDocs) loadOneDriveDocs();
  }, [showDocs, loadOneDriveDocs]);

  const exportToDocx = useCallback(async (uploadToOneDrive = false) => {
    if (!editor) return;
    setExporting(true);
    setStatusMsg('');
    try {
      const html = editor.getHTML();
      const body: any = { title, htmlContent: html };
      if (uploadToOneDrive) body.onedrivePath = essayFolder;

      const resp = await fetch('/api/essays/export-docx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (uploadToOneDrive) {
        const data = await resp.json();
        if (data.success) {
          setStatusMsg(`Uploaded to OneDrive: ${data.fileName}`);
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        } else {
          setStatusMsg(`Upload failed: ${data.error}`);
        }
      } else {
        const blob = await resp.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'essay'}.docx`;
        a.click();
        URL.revokeObjectURL(url);
        setStatusMsg('Downloaded DOCX file');
      }
    } catch (err: any) {
      setStatusMsg(`Export failed: ${err.message}`);
    } finally {
      setExporting(false);
    }
  }, [editor, title, essayFolder]);

  const openInWordOnline = useCallback(async (docPath: string) => {
    try {
      const resp = await fetch(`/api/onedrive/word-online-url?path=${encodeURIComponent(docPath)}`);
      const data = await resp.json();
      if (data.webUrl) {
        window.open(data.webUrl, '_blank');
      } else {
        setStatusMsg('Could not get Word Online URL');
      }
    } catch (err: any) {
      setStatusMsg(`Failed: ${err.message}`);
    }
  }, []);

  if (!editor) return null;

  const ToolBtn = ({ onClick, active, children, label }: { onClick: () => void; active?: boolean; children: React.ReactNode; label: string }) => (
    <button
      onClick={onClick}
      title={label}
      data-testid={`btn-${label.toLowerCase().replace(/\s/g, '-')}`}
      style={{
        background: active ? 'rgba(218,165,32,0.3)' : 'rgba(255,255,255,0.05)',
        border: active ? '1px solid rgba(218,165,32,0.5)' : '1px solid rgba(255,255,255,0.1)',
        color: active ? '#DAA520' : 'rgba(255,255,255,0.7)',
        borderRadius: '6px',
        padding: '6px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );

  return (
    <div style={{ background: '#0a0604', minHeight: '100vh', color: '#fff' }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(10,6,4,0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
        backdropFilter: 'blur(12px)',
        padding: '8px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <a href="/" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }} data-testid="link-back">
            <ChevronLeft size={16} />
            <span style={{ fontSize: '13px' }}>Back</span>
          </a>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{
              background: 'transparent', border: 'none', color: '#fff',
              fontSize: '18px', fontWeight: 700, outline: 'none', flex: 1,
            }}
            data-testid="input-essay-title"
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => exportToDocx(false)}
              disabled={exporting}
              style={{
                background: 'rgba(33,150,243,0.2)', border: '1px solid rgba(33,150,243,0.4)',
                color: '#64B5F6', borderRadius: '8px', padding: '6px 14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 600,
              }}
              data-testid="btn-download-docx"
            >
              <Download size={14} />
              Download .docx
            </button>
            <button
              onClick={() => exportToDocx(true)}
              disabled={exporting}
              style={{
                background: 'rgba(76,175,80,0.2)', border: '1px solid rgba(76,175,80,0.4)',
                color: '#81C784', borderRadius: '8px', padding: '6px 14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 600,
              }}
              data-testid="btn-upload-onedrive"
            >
              {exporting ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Save to OneDrive
            </button>
            <button
              onClick={() => setShowDocs(!showDocs)}
              style={{
                background: showDocs ? 'rgba(218,165,32,0.2)' : 'rgba(255,255,255,0.05)',
                border: showDocs ? '1px solid rgba(218,165,32,0.4)' : '1px solid rgba(255,255,255,0.1)',
                color: showDocs ? '#DAA520' : 'rgba(255,255,255,0.7)',
                borderRadius: '8px', padding: '6px 14px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                fontSize: '13px', fontWeight: 600,
              }}
              data-testid="btn-toggle-docs"
            >
              <FolderOpen size={14} />
              OneDrive Docs
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <ToolBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} label="Bold"><Bold size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} label="Italic"><Italic size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} label="Underline"><UnderlineIcon size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} label="Strikethrough"><Strikethrough size={14} /></ToolBtn>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} label="Heading 1"><Heading1 size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} label="Heading 2"><Heading2 size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} label="Heading 3"><Heading3 size={14} /></ToolBtn>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <ToolBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} label="Bullet List"><List size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} label="Ordered List"><ListOrdered size={14} /></ToolBtn>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} label="Align Left"><AlignLeft size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} label="Align Center"><AlignCenter size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} label="Align Right"><AlignRight size={14} /></ToolBtn>
          <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />
          <ToolBtn onClick={() => editor.chain().focus().undo().run()} label="Undo"><Undo size={14} /></ToolBtn>
          <ToolBtn onClick={() => editor.chain().focus().redo().run()} label="Redo"><Redo size={14} /></ToolBtn>

          {statusMsg && (
            <span style={{ marginLeft: '12px', fontSize: '12px', color: statusMsg.includes('fail') ? '#ef5350' : '#81C784', fontWeight: 600 }}>
              {statusMsg}
            </span>
          )}
          {saved && <span style={{ marginLeft: '8px', fontSize: '12px', color: '#81C784' }}>Saved!</span>}
        </div>
      </div>

      <div style={{ display: 'flex' }}>
        <div style={{
          flex: 1,
          maxWidth: showDocs ? 'calc(100% - 320px)' : '100%',
          transition: 'max-width 0.2s',
        }}>
          <div style={{
            maxWidth: '816px',
            margin: '40px auto',
            background: 'rgba(20,16,12,0.8)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            minHeight: '80vh',
            boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
          }}>
            <EditorContent editor={editor} />
          </div>
        </div>

        {showDocs && (
          <div style={{
            width: '320px',
            borderLeft: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(10,6,4,0.95)',
            padding: '16px',
            overflowY: 'auto',
            height: 'calc(100vh - 90px)',
            position: 'sticky',
            top: '90px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', margin: 0 }}>OneDrive Documents</h3>
              <button onClick={() => setShowDocs(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.5)' }} data-testid="btn-close-docs">
                <X size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
              <input
                value={essayFolder}
                onChange={e => setEssayFolder(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                  color: '#fff', fontSize: '11px', borderRadius: '6px', padding: '4px 8px', flex: 1,
                }}
                data-testid="input-essay-folder"
              />
              <button
                onClick={loadOneDriveDocs}
                style={{
                  background: 'rgba(33,150,243,0.2)', border: '1px solid rgba(33,150,243,0.3)',
                  color: '#64B5F6', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer',
                  fontSize: '11px',
                }}
                data-testid="btn-refresh-docs"
              >
                Refresh
              </button>
            </div>

            {loadingDocs && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.4)' }}>
                <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto' }} />
                <div style={{ marginTop: '8px', fontSize: '12px' }}>Loading...</div>
              </div>
            )}

            {!loadingDocs && docs.length === 0 && (
              <div style={{ textAlign: 'center', padding: '20px', color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
                No documents found in this folder
              </div>
            )}

            {docs.map((doc, i) => {
              const ext = doc.name.split('.').pop()?.toLowerCase() || '';
              const sizeKB = Math.round((doc.size || 0) / 1024);
              const isWord = ['docx', 'doc'].includes(ext);
              return (
                <div
                  key={i}
                  style={{
                    padding: '10px 12px', borderRadius: '8px', marginBottom: '4px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    transition: 'background 0.12s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.02)')}
                  data-testid={`doc-item-${i}`}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={14} color={isWord ? '#64B5F6' : '#81C784'} />
                    <span style={{ fontSize: '13px', color: '#fff', fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{sizeKB}KB · .{ext}</span>
                    <span style={{ flex: 1 }} />
                    <button
                      onClick={(e) => { e.stopPropagation(); openInWordOnline(doc.path); }}
                      style={{
                        background: 'rgba(33,150,243,0.15)', border: '1px solid rgba(33,150,243,0.3)',
                        color: '#64B5F6', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer',
                        fontSize: '10px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                      data-testid={`btn-open-word-${i}`}
                    >
                      <ExternalLink size={10} />
                      {isWord ? 'Word Online' : 'Open'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .ProseMirror { outline: none; }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: rgba(255,255,255,0.2);
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px; color: #fff; }
        .ProseMirror h2 { font-size: 22px; font-weight: 700; margin: 20px 0 10px; color: #f0f0f0; }
        .ProseMirror h3 { font-size: 18px; font-weight: 700; margin: 16px 0 8px; color: #e0e0e0; }
        .ProseMirror ul, .ProseMirror ol { padding-left: 24px; }
        .ProseMirror li { margin: 4px 0; }
        .ProseMirror blockquote { border-left: 3px solid rgba(218,165,32,0.5); padding-left: 16px; color: rgba(255,255,255,0.6); margin: 12px 0; }
        .ProseMirror hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0; }
        .ProseMirror p { margin: 0 0 12px; }
      `}</style>
    </div>
  );
}
