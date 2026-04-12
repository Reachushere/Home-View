import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Bold, Italic, List, Type, Palette, Upload, Download, FileText, Image, File, Loader2, Pencil, Check, FolderPlus, ChevronDown, ChevronRight, Eraser, Search, ArrowUp, ArrowDown, CheckSquare2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('script, iframe, object, embed, link, style').forEach(el => el.remove());
  div.querySelectorAll('*').forEach(el => {
    for (const attr of Array.from(el.attributes)) {
      if (attr.name.startsWith('on') || attr.value.toLowerCase().includes('javascript:')) {
        el.removeAttribute(attr.name);
      }
    }
  });
  return div.innerHTML;
}

interface NotepadNote {
  id: number;
  title: string;
  content: string;
  sortOrder: number;
  groupName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface NotepadAttachment {
  id: number;
  noteId: number;
  fileName: string;
  fileType: string;
  oneDrivePath: string;
  oneDriveWebUrl: string | null;
  thumbnailUrl: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface NotepadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  colorSettings: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
  onUndockNote?: (note: NotepadNote) => void;
  undockedNoteIds?: Set<number>;
}

const FONT_SIZES = ['12px', '14px', '16px', '18px', '24px', '32px'];
const FONT_COLORS = ['#ffffff', '#000000', '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (fileType === 'application/pdf') return <FileText className="h-4 w-4 text-red-400" />;
  if (fileType.includes('word') || fileType.includes('document')) return <FileText className="h-4 w-4 text-blue-400" />;
  return <File className="h-4 w-4" />;
}

export default function NotepadDialog({ isOpen, onClose, colorSettings, onUndockNote, undockedNoteIds }: NotepadDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeNoteId, setActiveNoteId] = useState<number | null>(null);
  const [editingTabId, setEditingTabId] = useState<number | null>(null);
  const [editingTabTitle, setEditingTabTitle] = useState('');
  const [showFontSize, setShowFontSize] = useState(false);
  const [showFontColor, setShowFontColor] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDownloads, setSelectedDownloads] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [showGroupAssign, setShowGroupAssign] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ noteId: number; noteTitle: string; snippets: string[] }[]>([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightMarkIdRef = useRef(0);

  const { data: notes = [], isLoading } = useQuery<NotepadNote[]>({
    queryKey: ['/api/notepad/notes'],
    enabled: isOpen,
  });

  const { data: attachments = [] } = useQuery<NotepadAttachment[]>({
    queryKey: ['/api/notepad/notes', activeNoteId, 'attachments'],
    queryFn: async () => {
      if (!activeNoteId) return [];
      const res = await fetch(`/api/notepad/notes/${activeNoteId}/attachments`);
      return res.json();
    },
    enabled: isOpen && !!activeNoteId,
  });

  useEffect(() => {
    if (notes.length > 0 && activeNoteId === null) {
      setActiveNoteId(notes[0].id);
    }
  }, [notes, activeNoteId]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  useEffect(() => {
    if (activeNote && editorRef.current) {
      const sanitized = sanitizeHtml(activeNote.content || '');
      if (editorRef.current.innerHTML !== sanitized) {
        editorRef.current.innerHTML = sanitized;
        lastSavedContentRef.current = sanitized;
      }
    }
  }, [activeNote?.id]);

  const createNoteMutation = useMutation({
    mutationFn: async (groupName?: string) => {
      const res = await fetch('/api/notepad/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: `Note ${notes.length + 1}`, content: '', sortOrder: notes.length, groupName: groupName || null }),
      });
      if (!res.ok) throw new Error('Failed to create note');
      return res.json();
    },
    onSuccess: (note: NotepadNote) => {
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes'] });
      setActiveNoteId(note.id);
    },
  });

  const saveNote = useCallback(async (noteId: number, content: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/notepad/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: sanitizeHtml(content) }),
      });
      if (!res.ok) throw new Error('Save failed');
      lastSavedContentRef.current = content;
    } catch {
      toast({ title: 'Error', description: 'Failed to save note', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [toast]);

  const handleEditorInput = useCallback(() => {
    if (!editorRef.current || !activeNoteId) return;
    const content = editorRef.current.innerHTML;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (content !== lastSavedContentRef.current) {
        saveNote(activeNoteId, content);
      }
    }, 1500);
  }, [activeNoteId, saveNote]);

  const handleManualSave = useCallback(async () => {
    if (!editorRef.current || !activeNoteId) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    await saveNote(activeNoteId, editorRef.current.innerHTML);
    toast({ title: 'Saved', description: 'Note saved successfully.' });
  }, [activeNoteId, saveNote, toast]);

  const deleteNoteMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notepad/notes/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes'] });
      setActiveNoteId(null);
    },
  });

  const renameNoteMutation = useMutation({
    mutationFn: async ({ id, title }: { id: number; title: string }) => {
      const res = await fetch(`/api/notepad/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Rename failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes'] });
      setEditingTabId(null);
    },
  });

  const assignGroupMutation = useMutation({
    mutationFn: async ({ id, groupName }: { id: number; groupName: string | null }) => {
      const res = await fetch(`/api/notepad/notes/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupName }),
      });
      if (!res.ok) throw new Error('Group assign failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes'] });
      setShowGroupAssign(null);
    },
  });

  const execCommand = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    handleEditorInput();
  };

  const insertCheckbox = useCallback(() => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    const checkboxHtml = `<div class="np-checkbox-item" data-checked="false" style="display:flex;align-items:flex-start;gap:6px;padding:2px 0;cursor:default;"><span class="np-cb-box" contenteditable="false" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;min-width:16px;border:2px solid #999;border-radius:3px;cursor:pointer;margin-top:3px;flex-shrink:0;background:transparent;font-size:11px;line-height:1;color:transparent;user-select:none;">✓</span><span class="np-cb-text" style="flex:1;outline:none;">New item</span></div>`;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      const temp = document.createElement('div');
      temp.innerHTML = checkboxHtml;
      const node = temp.firstChild!;
      range.insertNode(node);
      const textSpan = (node as HTMLElement).querySelector('.np-cb-text');
      if (textSpan) {
        const newRange = document.createRange();
        newRange.selectNodeContents(textSpan);
        sel.removeAllRanges();
        sel.addRange(newRange);
      }
    } else {
      editorRef.current.insertAdjacentHTML('beforeend', checkboxHtml);
    }
    editorRef.current.focus();
    handleEditorInput();
  }, [handleEditorInput]);

  const handleEditorClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.classList.contains('np-cb-box')) return;
    e.preventDefault();
    e.stopPropagation();
    const item = target.closest('.np-checkbox-item') as HTMLElement;
    if (!item || !editorRef.current) return;
    const isChecked = item.getAttribute('data-checked') === 'true';
    const textSpan = item.querySelector('.np-cb-text') as HTMLElement;
    if (isChecked) {
      item.setAttribute('data-checked', 'false');
      target.style.background = 'transparent';
      target.style.borderColor = '#999';
      target.style.color = 'transparent';
      if (textSpan) {
        textSpan.style.textDecoration = 'none';
        textSpan.style.opacity = '1';
      }
    } else {
      item.setAttribute('data-checked', 'true');
      target.style.background = '#22c55e';
      target.style.borderColor = '#22c55e';
      target.style.color = '#fff';
      if (textSpan) {
        textSpan.style.textDecoration = 'line-through';
        textSpan.style.opacity = '0.5';
      }
      editorRef.current.appendChild(item);
    }
    handleEditorInput();
  }, [handleEditorInput]);

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || !activeNoteId) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const reader = new FileReader();
        const fileData = await new Promise<string>((resolve, reject) => {
          reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const uploadRes = await fetch(`/api/notepad/notes/${activeNoteId}/attachments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fileName: file.name, fileData, fileType: file.type }),
        });
        if (!uploadRes.ok) { const err = await uploadRes.json().catch(() => ({})); throw new Error(err.error || 'Upload failed'); }
      }
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes', activeNoteId, 'attachments'] });
      toast({ title: 'Uploaded', description: `${files.length} file(s) uploaded to OneDrive` });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSelected = async () => {
    for (const attachId of selectedDownloads) {
      try {
        const res = await fetch(`/api/notepad/attachments/${attachId}/download`);
        const data = await res.json();
        if (data.redirectUrl) {
          window.open(data.redirectUrl, '_blank');
        }
      } catch {
        toast({ title: 'Download failed', variant: 'destructive' });
      }
    }
    setSelectedDownloads(new Set());
  };

  const handleDownloadAll = async () => {
    for (const att of attachments) {
      try {
        const res = await fetch(`/api/notepad/attachments/${att.id}/download`);
        const data = await res.json();
        if (data.redirectUrl) {
          window.open(data.redirectUrl, '_blank');
        }
      } catch {
        toast({ title: 'Download failed', variant: 'destructive' });
      }
    }
  };

  const handleClearNote = async () => {
    if (!activeNoteId || !editorRef.current) return;
    if (!confirm('Clear all text in this note?')) return;
    editorRef.current.innerHTML = '';
    lastSavedContentRef.current = '';
    await saveNote(activeNoteId, '');
    toast({ title: 'Cleared', description: 'Note content has been cleared.' });
  };

  const deleteAttachmentMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/notepad/attachments/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notepad/notes', activeNoteId, 'attachments'] });
    },
  });

  const clearSearchHighlights = useCallback(() => {
    if (!editorRef.current) return;
    const marks = editorRef.current.querySelectorAll('mark[data-search-highlight]');
    marks.forEach(mark => {
      const parent = mark.parentNode;
      if (parent) {
        const text = document.createTextNode(mark.textContent || '');
        parent.replaceChild(text, mark);
        parent.normalize();
      }
    });
  }, []);

  const performSearchInEditor = useCallback((query: string) => {
    clearSearchHighlights();
    if (!query.trim() || !editorRef.current) {
      setTotalMatches(0);
      setCurrentMatchIndex(0);
      return;
    }
    const walker = document.createTreeWalker(editorRef.current, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
    const lowerQuery = query.toLowerCase();
    let matchCount = 0;
    highlightMarkIdRef.current++;
    const batchId = highlightMarkIdRef.current;
    textNodes.forEach(node => {
      const text = node.textContent || '';
      const lowerText = text.toLowerCase();
      let idx = lowerText.indexOf(lowerQuery);
      if (idx === -1) return;
      const frag = document.createDocumentFragment();
      let lastIdx = 0;
      while (idx !== -1) {
        if (idx > lastIdx) frag.appendChild(document.createTextNode(text.slice(lastIdx, idx)));
        const mark = document.createElement('mark');
        mark.setAttribute('data-search-highlight', String(batchId));
        mark.setAttribute('data-match-index', String(matchCount));
        mark.style.backgroundColor = matchCount === 0 ? '#f59e0b' : '#fde68a';
        mark.style.color = '#000';
        mark.style.borderRadius = '2px';
        mark.style.padding = '0 1px';
        mark.textContent = text.slice(idx, idx + query.length);
        frag.appendChild(mark);
        matchCount++;
        lastIdx = idx + query.length;
        idx = lowerText.indexOf(lowerQuery, lastIdx);
      }
      if (lastIdx < text.length) frag.appendChild(document.createTextNode(text.slice(lastIdx)));
      node.parentNode?.replaceChild(frag, node);
    });
    setTotalMatches(matchCount);
    setCurrentMatchIndex(matchCount > 0 ? 0 : 0);
    if (matchCount > 0) {
      const first = editorRef.current.querySelector('mark[data-match-index="0"]');
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [clearSearchHighlights]);

  const navigateMatch = useCallback((direction: 'next' | 'prev') => {
    if (totalMatches === 0 || !editorRef.current) return;
    const newIdx = direction === 'next'
      ? (currentMatchIndex + 1) % totalMatches
      : (currentMatchIndex - 1 + totalMatches) % totalMatches;
    setCurrentMatchIndex(newIdx);
    const marks = editorRef.current.querySelectorAll('mark[data-search-highlight]');
    marks.forEach((m, i) => {
      (m as HTMLElement).style.backgroundColor = i === newIdx ? '#f59e0b' : '#fde68a';
    });
    const target = editorRef.current.querySelector(`mark[data-match-index="${newIdx}"]`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentMatchIndex, totalMatches]);

  const searchAllNotes = useCallback((query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    const lowerQ = query.toLowerCase();
    const results: { noteId: number; noteTitle: string; snippets: string[] }[] = [];
    notes.forEach(note => {
      const div = document.createElement('div');
      div.innerHTML = note.content || '';
      const plainText = div.textContent || '';
      const lowerPlain = plainText.toLowerCase();
      const snippets: string[] = [];
      let sIdx = lowerPlain.indexOf(lowerQ);
      while (sIdx !== -1 && snippets.length < 3) {
        const start = Math.max(0, sIdx - 30);
        const end = Math.min(plainText.length, sIdx + query.length + 30);
        snippets.push((start > 0 ? '...' : '') + plainText.slice(start, end) + (end < plainText.length ? '...' : ''));
        sIdx = lowerPlain.indexOf(lowerQ, sIdx + query.length);
      }
      if (snippets.length > 0) results.push({ noteId: note.id, noteTitle: note.title, snippets });
    });
    setSearchResults(results);
  }, [notes]);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    performSearchInEditor(query);
    searchAllNotes(query);
  }, [performSearchInEditor, searchAllNotes]);

  const closeSearch = useCallback(() => {
    clearSearchHighlights();
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setTotalMatches(0);
    setCurrentMatchIndex(0);
  }, [clearSearchHighlights]);

  useEffect(() => {
    if (searchOpen && searchQuery) {
      performSearchInEditor(searchQuery);
    }
  }, [activeNoteId]);

  const existingGroups = Array.from(new Set(notes.map(n => n.groupName).filter(Boolean))) as string[];
  const ungroupedNotes = notes.filter(n => !n.groupName);
  const groupedNotesMap: Record<string, NotepadNote[]> = {};
  notes.forEach(n => {
    if (n.groupName) {
      if (!groupedNotesMap[n.groupName]) groupedNotesMap[n.groupName] = [];
      groupedNotesMap[n.groupName].push(n);
    }
  });

  const toggleGroupCollapse = (group: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      return next;
    });
  };

  const renderNoteTab = (note: NotepadNote) => (
    <div
      key={note.id}
      className={`flex items-center gap-1 px-2 py-1 rounded cursor-pointer text-[11px] flex-shrink-0 group relative ${activeNoteId === note.id ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80 hover:bg-white/5'}`}
      onClick={() => {
        if (editorRef.current && activeNoteId && activeNoteId !== note.id) {
          const content = editorRef.current.innerHTML;
          if (content !== lastSavedContentRef.current) {
            saveNote(activeNoteId, content);
          }
        }
        setActiveNoteId(note.id);
      }}
      data-testid={`tab-note-${note.id}`}
    >
      {editingTabId === note.id ? (
        <div className="flex items-center gap-1">
          <input
            className="bg-white/10 border border-white/30 rounded px-1 text-[11px] text-white w-[80px] outline-none"
            value={editingTabTitle}
            onChange={e => setEditingTabTitle(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') renameNoteMutation.mutate({ id: note.id, title: editingTabTitle }); if (e.key === 'Escape') setEditingTabId(null); }}
            autoFocus
            onClick={e => e.stopPropagation()}
            data-testid={`input-rename-tab-${note.id}`}
          />
          <button onClick={(e) => { e.stopPropagation(); renameNoteMutation.mutate({ id: note.id, title: editingTabTitle }); }} className="text-green-400 hover:text-green-300"><Check className="h-3 w-3" /></button>
        </div>
      ) : (
        <>
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditingTabId(note.id); setEditingTabTitle(note.title); }}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData('application/x-notepad-undock', JSON.stringify({ id: note.id, title: note.title }));
              e.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={(e) => {
              const dialog = (e.target as HTMLElement).closest('[data-notepad-dialog]');
              if (dialog) {
                const rect = dialog.getBoundingClientRect();
                const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
                if (outside && onUndockNote) onUndockNote(note);
              }
            }}
            style={{ cursor: 'grab' }}
            title="Drag to pop out as floating note"
          >{note.title}</span>
          <button
            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white/60 ml-0.5"
            onClick={(e) => { e.stopPropagation(); setEditingTabId(note.id); setEditingTabTitle(note.title); }}
            data-testid={`button-rename-tab-${note.id}`}
          ><Pencil className="h-2.5 w-2.5" /></button>
          {onUndockNote && (
            <button
              className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-yellow-400 ml-0.5"
              onClick={(e) => { e.stopPropagation(); onUndockNote(note); }}
              title="Pop out as floating note"
              data-testid={`button-undock-tab-${note.id}`}
            ><ExternalLink className="h-2.5 w-2.5" /></button>
          )}
          <button
            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-blue-400 ml-0.5"
            onClick={(e) => { e.stopPropagation(); setShowGroupAssign(showGroupAssign === note.id ? null : note.id); }}
            title="Assign to group"
            data-testid={`button-group-tab-${note.id}`}
          ><FolderPlus className="h-2.5 w-2.5" /></button>
          {notes.length > 1 && (
            <button
              className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 ml-0.5"
              onClick={(e) => { e.stopPropagation(); if (confirm('Delete this note?')) deleteNoteMutation.mutate(note.id); }}
              data-testid={`button-delete-tab-${note.id}`}
            ><X className="h-2.5 w-2.5" /></button>
          )}
        </>
      )}
      {showGroupAssign === note.id && (
        <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/20 rounded shadow-xl z-50 py-1 min-w-[140px]" onClick={e => e.stopPropagation()} data-testid={`group-assign-dropdown-${note.id}`}>
          <button className="block w-full text-left px-3 py-1 text-white/60 hover:bg-white/10 text-[10px]" onClick={() => assignGroupMutation.mutate({ id: note.id, groupName: null })}>
            No Group
          </button>
          {existingGroups.map(g => (
            <button key={g} className={`block w-full text-left px-3 py-1 hover:bg-white/10 text-[10px] ${note.groupName === g ? 'text-blue-400' : 'text-white/60'}`} onClick={() => assignGroupMutation.mutate({ id: note.id, groupName: g })}>
              {g}
            </button>
          ))}
          <div className="border-t border-white/10 mt-1 pt-1 px-2">
            {showNewGroupInput ? (
              <div className="flex items-center gap-1">
                <input
                  className="bg-white/10 border border-white/30 rounded px-1 text-[10px] text-white w-[90px] outline-none py-0.5"
                  value={newGroupName}
                  onChange={e => setNewGroupName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && newGroupName.trim()) {
                      assignGroupMutation.mutate({ id: note.id, groupName: newGroupName.trim() });
                      setNewGroupName('');
                      setShowNewGroupInput(false);
                    }
                    if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); }
                  }}
                  autoFocus
                  placeholder="Group name"
                  data-testid="input-new-group-name"
                />
                <button className="text-green-400 hover:text-green-300" onClick={() => { if (newGroupName.trim()) { assignGroupMutation.mutate({ id: note.id, groupName: newGroupName.trim() }); setNewGroupName(''); setShowNewGroupInput(false); } }}><Check className="h-3 w-3" /></button>
              </div>
            ) : (
              <button className="text-[10px] text-green-400 hover:text-green-300 flex items-center gap-1 py-0.5" onClick={() => setShowNewGroupInput(true)} data-testid="button-create-new-group">
                <Plus className="h-2.5 w-2.5" /> New Group
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (!isOpen) return null;

  return (
    <div>
      <div className="fixed inset-0 z-[10003] bg-black/60" onClick={onClose} />
      <div
        className="fixed left-[50%] top-[45%] translate-x-[-50%] translate-y-[-50%] z-[10003] rounded-lg overflow-hidden flex flex-col"
        style={{
          width: '860px', maxWidth: '95vw', height: '560px', maxHeight: '90vh',
          background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`,
          border: '1.5px solid rgba(255,255,255,0.35)',
        }}
        data-testid="notepad-dialog"
        data-notepad-dialog
      >
        <div
          className="flex items-center justify-between px-4 py-2 border-b border-white/40 flex-shrink-0 rounded-t-lg"
          style={{
            backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
            background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 16 16" fill="none" style={{ height: '14px', width: '14px' }}>
              <rect x="3" y="1" width="10" height="14" rx="1" fill="#4a90d9" stroke="white" strokeWidth="0.5"/>
              <rect x="4.5" y="2.5" width="7" height="11" rx="0.5" fill="white"/>
              <line x1="5.5" y1="5" x2="10.5" y2="5" stroke="#4a90d9" strokeWidth="0.5"/>
              <line x1="5.5" y1="7" x2="10.5" y2="7" stroke="#4a90d9" strokeWidth="0.5"/>
              <line x1="5.5" y1="9" x2="10.5" y2="9" stroke="#4a90d9" strokeWidth="0.5"/>
              <line x1="5.5" y1="11" x2="8.5" y2="11" stroke="#4a90d9" strokeWidth="0.5"/>
              <rect x="2" y="3" width="1.5" height="1" rx="0.3" fill="#ffd700"/>
              <rect x="2" y="5.5" width="1.5" height="1" rx="0.3" fill="#ffd700"/>
              <rect x="2" y="8" width="1.5" height="1" rx="0.3" fill="#ffd700"/>
              <rect x="2" y="10.5" width="1.5" height="1" rx="0.3" fill="#ffd700"/>
            </svg>
            <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>NOTEPAD</h2>
          </div>
          <div className="flex items-center gap-2">
            {saving && <span className="text-[10px] text-white/50 flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving...</span>}
            <button onClick={onClose} className="text-white hover:text-white/80 transition-colors p-1" data-testid="button-close-notepad"><X className="h-4 w-4" /></button>
          </div>
        </div>

        <div className="flex flex-col gap-0.5 px-2 py-1.5 border-b border-white/20 flex-shrink-0 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.2)', maxHeight: '140px' }}>
          {Object.entries(groupedNotesMap).map(([group, groupNotes]) => (
            <div key={group}>
              <div
                className="flex items-center gap-1 px-1 py-0.5 cursor-pointer text-[10px] text-white/40 hover:text-white/60 uppercase tracking-wider font-semibold"
                onClick={() => toggleGroupCollapse(group)}
                data-testid={`group-header-${group}`}
              >
                {collapsedGroups.has(group) ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />}
                <span>{group}</span>
                <span className="text-[9px] font-normal">({groupNotes.length})</span>
              </div>
              {!collapsedGroups.has(group) && (
                <div className="flex items-center gap-1 pl-3 flex-wrap">
                  {groupNotes.map(note => renderNoteTab(note))}
                </div>
              )}
            </div>
          ))}
          {ungroupedNotes.length > 0 && Object.keys(groupedNotesMap).length > 0 && (
            <div className="flex items-center gap-1 px-1 py-0.5 text-[10px] text-white/30 uppercase tracking-wider font-semibold">
              <span>Ungrouped</span>
            </div>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            {ungroupedNotes.map(note => renderNoteTab(note))}
            <button
              className="flex items-center justify-center h-6 w-6 rounded text-white/40 hover:text-white/80 hover:bg-white/10 flex-shrink-0"
              onClick={() => createNoteMutation.mutate(undefined)}
              data-testid="button-add-note-tab"
            ><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        {activeNote && (
          <div className="flex items-center gap-1 px-3 py-1.5 border-b border-white/15 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
            <button onClick={() => execCommand('bold')} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Bold" data-testid="format-bold"><Bold className="h-3.5 w-3.5" /></button>
            <button onClick={() => execCommand('italic')} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Italic" data-testid="format-italic"><Italic className="h-3.5 w-3.5" /></button>
            <button onClick={() => execCommand('insertUnorderedList')} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Bullet List" data-testid="format-list"><List className="h-3.5 w-3.5" /></button>
            <button onClick={insertCheckbox} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white" title="Checkbox" data-testid="format-checkbox"><CheckSquare2 className="h-3.5 w-3.5" /></button>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <div className="relative">
              <button onClick={() => { setShowFontSize(!showFontSize); setShowFontColor(false); }} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white flex items-center gap-0.5" title="Font Size" data-testid="format-font-size"><Type className="h-3.5 w-3.5" /><span className="text-[9px]">▼</span></button>
              {showFontSize && (
                <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/20 rounded shadow-xl z-50 py-1" data-testid="font-size-dropdown">
                  {FONT_SIZES.map(size => (
                    <button key={size} className="block w-full text-left px-3 py-1 text-white/80 hover:bg-white/10 text-[11px]" onClick={() => { execCommand('fontSize', '7'); const sel = window.getSelection(); if (sel && sel.rangeCount > 0) { const spans = editorRef.current?.querySelectorAll('font[size="7"]'); spans?.forEach(s => { const span = document.createElement('span'); span.style.fontSize = size; span.innerHTML = s.innerHTML; s.replaceWith(span); }); } setShowFontSize(false); }} data-testid={`font-size-${size}`}>{size}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setShowFontColor(!showFontColor); setShowFontSize(false); }} className="p-1 rounded hover:bg-white/10 text-white/70 hover:text-white flex items-center gap-0.5" title="Font Color" data-testid="format-font-color"><Palette className="h-3.5 w-3.5" /><span className="text-[9px]">▼</span></button>
              {showFontColor && (
                <div className="absolute top-full left-0 mt-1 bg-gray-900 border border-white/20 rounded shadow-xl z-50 p-2 flex flex-wrap gap-1" style={{ width: '120px' }} data-testid="font-color-dropdown">
                  {FONT_COLORS.map(color => (
                    <button key={color} className="w-5 h-5 rounded border border-white/20 hover:scale-110 transition-transform" style={{ background: color }} onClick={() => { execCommand('foreColor', color); setShowFontColor(false); }} data-testid={`font-color-${color}`} />
                  ))}
                </div>
              )}
            </div>
            <div className="w-px h-4 bg-white/20 mx-1" />
            <button
              onClick={() => { if (searchOpen) { closeSearch(); } else { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); } }}
              className={`p-1 rounded hover:bg-white/10 ${searchOpen ? 'text-yellow-400' : 'text-white/70 hover:text-white'}`}
              title="Search (Ctrl+F)"
              data-testid="button-search-notepad"
            >
              <Search className="h-3.5 w-3.5" />
            </button>
            <div className="flex-1" />
            <Button
              size="sm"
              className="h-6 px-3 text-[10px]"
              style={{ background: 'linear-gradient(180deg, rgba(34,197,94,0.4) 0%, rgba(34,197,94,0.2) 100%)', border: '1px solid rgba(34,197,94,0.5)', color: '#4ade80' }}
              onClick={handleManualSave}
              disabled={saving}
              data-testid="button-save-notepad"
            >
              {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Save
            </Button>
          </div>
        )}

        {searchOpen && (
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/15 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }} data-testid="search-bar">
            <Search className="h-3.5 w-3.5 text-white/40 flex-shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); navigateMatch(e.shiftKey ? 'prev' : 'next'); }
                if (e.key === 'Escape') { e.preventDefault(); closeSearch(); }
              }}
              className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-0.5 text-[11px] text-white outline-none focus:border-white/40 placeholder:text-white/30"
              placeholder="Search all notes..."
              data-testid="input-search-notepad"
            />
            {searchQuery && (
              <span className="text-[10px] text-white/50 flex-shrink-0">
                {totalMatches > 0 ? `${currentMatchIndex + 1}/${totalMatches}` : 'No matches'}
              </span>
            )}
            <button onClick={() => navigateMatch('prev')} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-30" disabled={totalMatches === 0} data-testid="button-search-prev"><ArrowUp className="h-3 w-3" /></button>
            <button onClick={() => navigateMatch('next')} className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white disabled:opacity-30" disabled={totalMatches === 0} data-testid="button-search-next"><ArrowDown className="h-3 w-3" /></button>
            <button onClick={closeSearch} className="p-0.5 rounded hover:bg-white/10 text-white/40 hover:text-white" data-testid="button-search-close"><X className="h-3 w-3" /></button>
          </div>
        )}

        {searchOpen && searchQuery && searchResults.length > 0 && searchResults.some(r => r.noteId !== activeNoteId) && (
          <div className="border-b border-white/15 flex-shrink-0 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.2)', maxHeight: '100px' }} data-testid="search-results-panel">
            <div className="px-3 py-1">
              <span className="text-[9px] text-white/40 uppercase tracking-wider">Results in other notes</span>
            </div>
            {searchResults.filter(r => r.noteId !== activeNoteId).map(r => (
              <div
                key={r.noteId}
                className="px-3 py-1 cursor-pointer hover:bg-white/10 transition-colors"
                onClick={() => { setActiveNoteId(r.noteId); }}
                data-testid={`search-result-note-${r.noteId}`}
              >
                <div className="text-[10px] text-white/80 font-medium">{r.noteTitle}</div>
                {r.snippets.map((s, i) => (
                  <div key={i} className="text-[9px] text-white/40 truncate">{s}</div>
                ))}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden" style={{ borderRight: '1px solid rgba(255,255,255,0.15)' }}>
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center text-white/40"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : !activeNote ? (
              <div className="flex-1 flex flex-col items-center justify-center text-white/40 gap-3">
                <p className="text-[13px]">No notes yet</p>
                <Button size="sm" className="text-[11px]" onClick={() => createNoteMutation.mutate(undefined)} data-testid="button-create-first-note">Create a Note</Button>
              </div>
            ) : (
              <>
                <div
                  ref={editorRef}
                  contentEditable
                  className="flex-1 p-3 text-[13px] overflow-y-auto focus:outline-none notepad-editor-content"
                  style={{
                    fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
                    lineHeight: 1.6,
                    minHeight: 0,
                    background: '#ffffff',
                    color: '#1a1a1a',
                    borderRadius: '0',
                  }}
                  onInput={handleEditorInput}
                  onClick={handleEditorClick}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const sel = window.getSelection();
                      if (sel && sel.rangeCount > 0) {
                        const node = sel.anchorNode;
                        const cbItem = (node instanceof HTMLElement ? node : node?.parentElement)?.closest('.np-checkbox-item');
                        if (cbItem) {
                          e.preventDefault();
                          const newItem = document.createElement('div');
                          newItem.className = 'np-checkbox-item';
                          newItem.setAttribute('data-checked', 'false');
                          newItem.setAttribute('style', 'display:flex;align-items:flex-start;gap:6px;padding:2px 0;cursor:default;');
                          newItem.innerHTML = `<span class="np-cb-box" contenteditable="false" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;min-width:16px;border:2px solid #999;border-radius:3px;cursor:pointer;margin-top:3px;flex-shrink:0;background:transparent;font-size:11px;line-height:1;color:transparent;user-select:none;">✓</span><span class="np-cb-text" style="flex:1;outline:none;"></span>`;
                          cbItem.after(newItem);
                          const textSpan = newItem.querySelector('.np-cb-text');
                          if (textSpan) {
                            const range = document.createRange();
                            range.setStart(textSpan, 0);
                            range.collapse(true);
                            sel.removeAllRanges();
                            sel.addRange(range);
                          }
                          handleEditorInput();
                        }
                      }
                    }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); execCommand('bold'); }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); execCommand('italic'); }
                    if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); handleManualSave(); }
                    if ((e.metaKey || e.ctrlKey) && e.key === 'f') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 50); }
                  }}
                  data-testid="input-notepad"
                />
                <div className="flex items-center justify-end px-3 py-1.5 border-t border-white/15 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
                  <Button
                    size="sm"
                    className="h-6 px-3 text-[10px] flex items-center gap-1"
                    style={{ background: 'linear-gradient(180deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.15) 100%)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}
                    onClick={handleClearNote}
                    data-testid="button-clear-note"
                  >
                    <Eraser className="h-3 w-3" />
                    Clear
                  </Button>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col" style={{ width: '240px', flexShrink: 0 }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-white/15">
              <span className="text-[11px] text-white/60 font-medium">Attachments</span>
              <div className="flex items-center gap-1">
                {selectedDownloads.size > 0 && (
                  <button onClick={handleDownloadSelected} className="text-[9px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5" data-testid="button-download-selected">
                    <Download className="h-3 w-3" /> ({selectedDownloads.size})
                  </button>
                )}
                {attachments.length > 0 && (
                  <button
                    onClick={handleDownloadAll}
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
                    title="Download all attachments"
                    data-testid="button-download-all"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/70"
                  disabled={!activeNoteId || uploading}
                  data-testid="button-upload-attachment"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt"
              onChange={(e) => handleFileUpload(e.target.files)}
              data-testid="input-file-upload"
            />
            <div className="flex-1 overflow-y-auto p-2">
              {attachments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-white/30 text-[11px] gap-2">
                  <Upload className="h-6 w-6" />
                  <p>No attachments</p>
                  <p className="text-[9px] text-white/20 text-center">Upload images, PDFs, or docs</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {attachments.map(att => (
                    <div key={att.id} className="relative group rounded border border-white/10 overflow-hidden bg-white/5 hover:bg-white/10 transition-colors" data-testid={`attachment-${att.id}`}>
                      <div className="aspect-square flex items-center justify-center p-2">
                        {att.fileType.startsWith('image/') ? (
                          <div className="w-full h-full flex items-center justify-center bg-black/20 rounded overflow-hidden">
                            {att.oneDriveWebUrl ? (
                              <img src={att.oneDriveWebUrl} alt={att.fileName} className="max-w-full max-h-full object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).parentElement!.innerHTML = '<div class="text-white/30 text-[10px]">Preview N/A</div>'; }} />
                            ) : (
                              <Image className="h-8 w-8 text-white/30" />
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-1">
                            {getFileIcon(att.fileType)}
                            <span className="text-[8px] text-white/40 uppercase">{att.fileName.split('.').pop()}</span>
                          </div>
                        )}
                      </div>
                      <div className="px-1.5 pb-1.5">
                        <p className="text-[9px] text-white/60 truncate" title={att.fileName}>{att.fileName}</p>
                        <p className="text-[8px] text-white/30">{formatFileSize(att.fileSize)}</p>
                      </div>
                      <div className="flex items-center justify-between px-1.5 pb-1">
                        <label className="flex items-center gap-1 cursor-pointer">
                          <input
                            type="checkbox"
                            className="w-3 h-3 rounded"
                            checked={selectedDownloads.has(att.id)}
                            onChange={(e) => {
                              const next = new Set(selectedDownloads);
                              if (e.target.checked) next.add(att.id); else next.delete(att.id);
                              setSelectedDownloads(next);
                            }}
                            data-testid={`checkbox-download-${att.id}`}
                          />
                          <span className="text-[8px] text-white/40">Select</span>
                        </label>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={async () => {
                              try {
                                const res = await fetch(`/api/notepad/attachments/${att.id}/download`);
                                const data = await res.json();
                                if (data.redirectUrl) window.open(data.redirectUrl, '_blank');
                              } catch { toast({ title: 'Download failed', variant: 'destructive' }); }
                            }}
                            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-blue-400"
                            title="Download"
                            data-testid={`button-download-attachment-${att.id}`}
                          ><Download className="h-3 w-3" /></button>
                          <button
                            onClick={() => { if (confirm('Remove attachment?')) deleteAttachmentMutation.mutate(att.id); }}
                            className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400"
                            data-testid={`button-delete-attachment-${att.id}`}
                          ><Trash2 className="h-3 w-3" /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
