import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, BookOpen, ZoomIn, ZoomOut, Search, Bookmark, MessageSquare, Highlighter, Trash2, Download, Save, Check } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { apiRequest, queryClient } from '@/lib/queryClient';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface FileRecord {
  id: number;
  originalName: string;
  displayName: string;
  objectPath: string;
  folder: string | null;
  listened: boolean;
  contentType: string | null;
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
}

const BOOK_COLORS = [
  '#8B4513', '#2F4F4F', '#4A0E0E', '#1a3a5c', '#3d2b1f',
  '#556B2F', '#4B0082', '#8B0000', '#006064', '#37474F',
  '#5D4037', '#1B5E20', '#311B92', '#BF360C', '#01579B',
  '#33691E', '#880E4F', '#004D40', '#E65100', '#1A237E',
];

const SPINE_PATTERNS = [
  'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.08) 100%)',
  'linear-gradient(180deg, transparent 0%, rgba(255,255,255,0.05) 30%, rgba(255,255,255,0.05) 70%, transparent 100%)',
  'linear-gradient(180deg, rgba(0,0,0,0.1) 0%, transparent 15%, transparent 85%, rgba(0,0,0,0.15) 100%)',
];

function getBookColor(index: number, courseCode: string): string {
  const hash = courseCode.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return BOOK_COLORS[(hash + index) % BOOK_COLORS.length];
}

function toTitleCase(str: string): string {
  return str.replace(/\b\w+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function truncateSpineTitle(name: string, maxLen: number = 28): string {
  const cleaned = name
    .replace(/\.(pdf|docx?|pptx?|xlsx?)$/i, '')
    .replace(/^(Module|Reading|Lecture|Chapter|Ch|Chap)\s*[-_]?\s*/i, '')
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

function BookSpine({ file, index, courseCode, bookColor, isSelected, onClick, shelfHeight }: {
  file: FileRecord;
  index: number;
  courseCode: string;
  bookColor: string;
  isSelected: boolean;
  onClick: () => void;
  shelfHeight: number;
}) {
  const seededRand = ((file.id * 2654435761) >>> 0) / 4294967296;
  const spineWidth = 28 + seededRand * 12;
  const bookHeight = shelfHeight - 8 - (index % 3) * 6;
  const title = truncateSpineTitle(file.displayName || file.originalName);
  const weekNum = file.folder?.match(/^week-(\d+)/)?.[1] || '';
  const fileType = getFileType(file.folder);
  const patternIdx = (index + courseCode.charCodeAt(0)) % SPINE_PATTERNS.length;
  const hasTopBand = index % 4 === 1;
  const hasBottomBand = index % 5 === 2;

  return (
    <div
      className="book-spine-item"
      onClick={onClick}
      style={{
        width: `${spineWidth}px`,
        height: `${bookHeight}px`,
        backgroundColor: bookColor,
        backgroundImage: SPINE_PATTERNS[patternIdx],
        borderRadius: '2px 4px 4px 2px',
        cursor: 'pointer',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: isSelected
          ? '0 0 20px rgba(212,175,55,0.6), inset -2px 0 6px rgba(0,0,0,0.3)'
          : 'inset -2px 0 6px rgba(0,0,0,0.3), 1px 0 2px rgba(0,0,0,0.2)',
        transition: 'transform 0.3s ease, box-shadow 0.3s ease',
        transform: isSelected ? 'translateY(-12px) scale(1.03)' : 'translateY(0)',
        zIndex: isSelected ? 10 : 1,
        alignSelf: 'flex-end',
      }}
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
      {fileType && (
        <span style={{
          position: 'absolute',
          top: '6px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '9px',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.85)',
          textShadow: '0 1px 2px rgba(0,0,0,0.7)',
          lineHeight: 1,
        }}>
          {fileType === 'module' ? 'M' : 'R'}
        </span>
      )}
      <span style={{
        writingMode: 'vertical-rl',
        textOrientation: 'mixed',
        transform: 'rotate(180deg)',
        fontSize: '10px',
        fontWeight: 700,
        color: '#ffffff',
        textShadow: '0 1px 3px rgba(0,0,0,0.7)',
        letterSpacing: '0.5px',
        maxHeight: `${bookHeight - 46}px`,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '4px 0',
        lineHeight: 1.2,
      }}>
        {title}
      </span>
      {weekNum && (
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
        bottom: weekNum ? '22px' : '6px',
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

function Bookend({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{
      width: '22px',
      height: '100%',
      background: side === 'left'
        ? 'linear-gradient(90deg, #8D6E63 0%, #6D4C41 15%, #5D4037 40%, #4E342E 70%, #3E2723 100%)'
        : 'linear-gradient(90deg, #3E2723 0%, #4E342E 30%, #5D4037 60%, #6D4C41 85%, #8D6E63 100%)',
      borderRadius: side === 'left' ? '5px 1px 1px 5px' : '1px 5px 5px 1px',
      boxShadow: side === 'left'
        ? 'inset 3px 0 8px rgba(255,255,255,0.15), -4px 0 12px rgba(0,0,0,0.5), inset 0 3px 6px rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.2)'
        : 'inset -3px 0 8px rgba(255,255,255,0.15), 4px 0 12px rgba(0,0,0,0.5), inset 0 3px 6px rgba(255,255,255,0.08), inset 0 -3px 6px rgba(0,0,0,0.2)',
      flexShrink: 0,
      position: 'relative',
      borderTop: '1px solid rgba(255,255,255,0.08)',
      borderBottom: '2px solid rgba(0,0,0,0.4)',
    }}>
      <div style={{
        position: 'absolute',
        top: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '12px',
        height: '3px',
        background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
        opacity: 0.5,
        borderRadius: '1px',
      }} />
      <div style={{
        position: 'absolute',
        top: '12%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '10px',
        height: '76%',
        background: 'linear-gradient(180deg, #D4AF37 0%, #B8860B 20%, #8B6914 40%, #6B4F10 50%, #8B6914 60%, #B8860B 80%, #D4AF37 100%)',
        borderRadius: '2px',
        opacity: 0.4,
        boxShadow: 'inset 0 0 3px rgba(0,0,0,0.3), 0 0 4px rgba(212,175,55,0.2)',
      }} />
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(45deg)',
        width: '8px',
        height: '8px',
        border: '1px solid rgba(212,175,55,0.5)',
        borderRadius: '1px',
        opacity: 0.6,
      }} />
      <div style={{
        position: 'absolute',
        bottom: '8%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '12px',
        height: '3px',
        background: 'linear-gradient(90deg, transparent, #D4AF37, transparent)',
        opacity: 0.5,
        borderRadius: '1px',
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
  background: active ? 'rgba(212,175,55,0.3)' : 'rgba(0,0,0,0.2)',
  border: active ? '1px solid #D4AF37' : '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  padding: '4px 6px',
  cursor: 'pointer',
  color: active ? '#D4AF37' : 'rgba(255,255,255,0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s ease',
});

function BookReader({ file, bookColor, onClose }: {
  file: FileRecord;
  bookColor: string;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'pull' | 'expand' | 'reading'>('pull');
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [zoom, setZoom] = useState(1.0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ page: number; matches: number }[]>([]);
  const [searchCurrentIdx, setSearchCurrentIdx] = useState(0);
  const [commentOpen, setCommentOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [highlightColor, setHighlightColor] = useState(HIGHLIGHT_COLORS[0]);
  const [showAnnotations, setShowAnnotations] = useState(false);
  const [activeToolPanel, setActiveToolPanel] = useState<'none' | 'highlight' | 'comment' | 'bookmark'>('none');
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const title = truncateSpineTitle(file.displayName || file.originalName, 80);

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
    fetch(`/api/files/${file.id}/download`)
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

  useEffect(() => {
    if (!pdfDoc || !canvasRef.current || !containerRef.current || phase !== 'reading') return;
    let cancelled = false;
    pdfDoc.getPage(currentPage).then((page: any) => {
      if (cancelled) return;
      const container = containerRef.current!;
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext('2d')!;
      const containerWidth = container.clientWidth - 40;
      const containerHeight = container.clientHeight - 60;
      const vp = page.getViewport({ scale: 1 });
      const scaleW = containerWidth / vp.width;
      const scaleH = containerHeight / vp.height;
      const baseScale = Math.min(scaleW, scaleH);
      const scale = baseScale * zoom;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      page.render({ canvasContext: ctx, viewport });
    });
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage, phase, zoom]);

  const handleSearch = useCallback(async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    const results: { page: number; matches: number }[] = [];
    const q = searchQuery.toLowerCase();
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const text = textContent.items.map((item: any) => item.str).join(' ').toLowerCase();
      const count = text.split(q).length - 1;
      if (count > 0) results.push({ page: i, matches: count });
    }
    setSearchResults(results);
    setSearchCurrentIdx(0);
    if (results.length > 0) setCurrentPage(results[0].page);
  }, [pdfDoc, searchQuery]);

  const navigateSearch = useCallback((dir: 1 | -1) => {
    if (searchResults.length === 0) return;
    const nextIdx = (searchCurrentIdx + dir + searchResults.length) % searchResults.length;
    setSearchCurrentIdx(nextIdx);
    setCurrentPage(searchResults[nextIdx].page);
  }, [searchResults, searchCurrentIdx]);

  const toggleBookmark = useCallback(async () => {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) {
      await apiRequest('DELETE', `/api/annotations/${existing.id}`);
    } else {
      await apiRequest('POST', `/api/files/${file.id}/annotations`, { page: currentPage, type: 'bookmark' });
    }
    refetchAnnotations();
  }, [bookmarks, currentPage, file.id, refetchAnnotations]);

  const addComment = useCallback(async () => {
    if (!commentText.trim()) return;
    await apiRequest('POST', `/api/files/${file.id}/annotations`, { page: currentPage, type: 'comment', content: commentText.trim() });
    setCommentText('');
    refetchAnnotations();
  }, [commentText, currentPage, file.id, refetchAnnotations]);

  const addHighlight = useCallback(async () => {
    await apiRequest('POST', `/api/files/${file.id}/annotations`, { page: currentPage, type: 'highlight', color: highlightColor, content: `Page ${currentPage} highlight` });
    refetchAnnotations();
  }, [currentPage, file.id, highlightColor, refetchAnnotations]);

  const deleteAnnotation = useCallback(async (id: number) => {
    await apiRequest('DELETE', `/api/annotations/${id}`);
    refetchAnnotations();
  }, [refetchAnnotations]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100001,
        backgroundColor: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        perspective: '1500px',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <style>{`
        @keyframes libBookPull {
          0% { width: 40px; height: 180px; opacity: 0; transform: rotateY(80deg); }
          50% { width: 200px; height: 280px; opacity: 1; transform: rotateY(10deg); }
          100% { width: 200px; height: 280px; opacity: 1; transform: rotateY(0deg); }
        }
      `}</style>

      <div style={{
        width: phase === 'pull' ? '200px' : '85vw',
        height: phase === 'pull' ? '280px' : '88vh',
        backgroundColor: bookColor,
        borderRadius: phase === 'reading' ? '8px 16px 16px 8px' : '4px 12px 12px 4px',
        boxShadow: '0 20px 80px rgba(0,0,0,0.7), inset 0 0 30px rgba(0,0,0,0.2)',
        position: 'relative',
        overflow: 'hidden',
        transition: phase === 'pull' ? 'none' : 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
        animation: phase === 'pull' ? 'libBookPull 0.6s ease-out forwards' : 'none',
        display: 'flex',
        flexDirection: 'column',
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px 6px 32px', borderBottom: '1px solid rgba(255,255,255,0.1)', zIndex: 3, flexShrink: 0, gap: '8px' }}>
              <div style={{ color: '#D4AF37', fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {title}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={toolBtnStyle()} title="Zoom Out" data-testid="btn-zoom-out">
                  <ZoomOut size={14} />
                </button>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', minWidth: '32px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} style={toolBtnStyle()} title="Zoom In" data-testid="btn-zoom-in">
                  <ZoomIn size={14} />
                </button>

                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

                <button onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setActiveToolPanel('none'); }} style={toolBtnStyle(searchOpen)} title="Search" data-testid="btn-search">
                  <Search size={14} />
                </button>
                <button onClick={toggleBookmark} style={toolBtnStyle(pageBookmarked)} title={pageBookmarked ? 'Remove Bookmark' : 'Add Bookmark'} data-testid="btn-bookmark">
                  <Bookmark size={14} fill={pageBookmarked ? '#D4AF37' : 'none'} />
                </button>
                <button onClick={() => setActiveToolPanel(activeToolPanel === 'highlight' ? 'none' : 'highlight')} style={toolBtnStyle(activeToolPanel === 'highlight')} title="Highlight" data-testid="btn-highlight">
                  <Highlighter size={14} />
                </button>
                <button onClick={() => setActiveToolPanel(activeToolPanel === 'comment' ? 'none' : 'comment')} style={toolBtnStyle(activeToolPanel === 'comment')} title="Comment" data-testid="btn-comment">
                  <MessageSquare size={14} />
                </button>
                <button onClick={() => setShowAnnotations(!showAnnotations)} style={toolBtnStyle(showAnnotations)} title="View Annotations" data-testid="btn-annotations">
                  <BookOpen size={14} />
                </button>
                <button onClick={() => { refetchAnnotations().then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }); }} style={toolBtnStyle(saved)} title="Save Changes" data-testid="btn-save-pdf">
                  {saved ? <Check size={14} /> : <Save size={14} />}
                </button>
                <button onClick={() => { const a = document.createElement('a'); a.href = `/api/files/${file.id}/download`; a.download = file.originalName || 'document.pdf'; a.click(); }} style={toolBtnStyle()} title="Download PDF" data-testid="btn-download-pdf">
                  <Download size={14} />
                </button>

                <div style={{ width: '1px', height: '18px', background: 'rgba(255,255,255,0.15)', margin: '0 2px' }} />

                <button onClick={onClose} style={{ ...toolBtnStyle(), borderRadius: '50%', width: '26px', height: '26px', padding: 0 }} data-testid="button-close-book-reader">
                  <X size={14} />
                </button>
              </div>
            </div>

            {searchOpen && (
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
                <button onClick={handleSearch} style={toolBtnStyle()} data-testid="btn-search-go">
                  <Search size={12} />
                </button>
                {searchResults.length > 0 && (
                  <>
                    <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '10px', whiteSpace: 'nowrap' }}>
                      {searchCurrentIdx + 1}/{searchResults.length} pages
                    </span>
                    <button onClick={() => navigateSearch(-1)} style={toolBtnStyle()} data-testid="btn-search-prev">
                      <ChevronLeft size={12} />
                    </button>
                    <button onClick={() => navigateSearch(1)} style={toolBtnStyle()} data-testid="btn-search-next">
                      <ChevronRight size={12} />
                    </button>
                  </>
                )}
                {searchResults.length === 0 && searchQuery && (
                  <span style={{ color: 'rgba(255,100,100,0.8)', fontSize: '10px' }}>No results</span>
                )}
              </div>
            )}

            {activeToolPanel === 'highlight' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 4px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', zIndex: 3, flexShrink: 0 }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '10px' }}>Color:</span>
                {HIGHLIGHT_COLORS.map(c => (
                  <button key={c} onClick={() => setHighlightColor(c)} style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, border: highlightColor === c ? '2px solid #fff' : '2px solid transparent', cursor: 'pointer', transition: 'border 0.15s' }} />
                ))}
                <button onClick={addHighlight} style={{ ...toolBtnStyle(), fontSize: '10px', padding: '3px 8px', color: '#D4AF37', gap: '4px' }} data-testid="btn-add-highlight">
                  <Highlighter size={12} /> Add to page {currentPage}
                </button>
              </div>
            )}

            {activeToolPanel === 'comment' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 12px 4px 32px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(0,0,0,0.15)', zIndex: 3, flexShrink: 0 }}>
                <input
                  type="text"
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
                  placeholder={`Add comment on page ${currentPage}...`}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '12px', outline: 'none' }}
                  data-testid="input-pdf-comment"
                />
                <button onClick={addComment} style={{ ...toolBtnStyle(), fontSize: '10px', padding: '3px 8px', color: '#D4AF37' }} data-testid="btn-add-comment">
                  Add
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              <div
                ref={containerRef}
                style={{ flex: 1, margin: '0 0 0 28px', borderRadius: '4px 0 0 4px', overflow: 'auto', background: '#f5f5f0', display: 'flex', flexDirection: 'column', alignItems: zoom > 1 ? 'flex-start' : 'center', justifyContent: loading || !pdfDoc ? 'center' : 'flex-start', position: 'relative' }}
              >
                <div ref={scrollRef} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px', minWidth: '100%' }}>
                  {loading ? (
                    <div style={{ color: '#666', fontSize: '14px' }}>Loading PDF...</div>
                  ) : !pdfDoc ? (
                    <div style={{ color: '#c62828', fontSize: '14px', textAlign: 'center', padding: '20px' }}>
                      Failed to load PDF{errorMsg ? `: ${errorMsg}` : ''}
                    </div>
                  ) : (
                    <>
                      <div style={{ position: 'relative' }}>
                        <canvas ref={canvasRef} style={{ display: 'block' }} />
                        {pageHighlights.map((h, i) => (
                          <div key={h.id} style={{ position: 'absolute', top: `${10 + i * 24}px`, right: '8px', background: h.color || '#FFEB3B', borderRadius: '3px', padding: '2px 6px', fontSize: '9px', fontWeight: 600, opacity: 0.85, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Highlighter size={10} />
                            <button onClick={() => deleteAnnotation(h.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                              <Trash2 size={10} color="#333" />
                            </button>
                          </div>
                        ))}
                        {pageComments.length > 0 && (
                          <div style={{ position: 'absolute', bottom: '8px', right: '8px', display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '200px' }}>
                            {pageComments.map(c => (
                              <div key={c.id} style={{ background: 'rgba(0,0,0,0.75)', borderRadius: '4px', padding: '4px 8px', fontSize: '10px', color: '#fff', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                                <span style={{ flex: 1 }}>{c.content}</span>
                                <button onClick={() => deleteAnnotation(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0, marginTop: '1px' }}>
                                  <Trash2 size={10} color="rgba(255,255,255,0.5)" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {pageBookmarked && (
                          <div style={{ position: 'absolute', top: 0, right: '16px', width: '20px', height: '32px', background: '#D4AF37', clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 75%, 0 100%)', boxShadow: '0 2px 4px rgba(0,0,0,0.3)' }} />
                        )}
                      </div>
                    </>
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
                        <div key={b.id} onClick={() => setCurrentPage(b.page)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '3px', cursor: 'pointer', background: currentPage === b.page ? 'rgba(212,175,55,0.15)' : 'transparent', marginBottom: '2px' }}>
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
                      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '4px', marginTop: '8px' }}>Highlights</div>
                      {highlights.map(h => (
                        <div key={h.id} onClick={() => setCurrentPage(h.page)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 6px', borderRadius: '3px', cursor: 'pointer', background: currentPage === h.page ? 'rgba(212,175,55,0.15)' : 'transparent', marginBottom: '2px' }}>
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
                        <div key={c.id} onClick={() => setCurrentPage(c.page)} style={{ padding: '4px 6px', borderRadius: '3px', cursor: 'pointer', background: currentPage === c.page ? 'rgba(212,175,55,0.15)' : 'transparent', marginBottom: '2px' }}>
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

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '4px 32px', borderTop: '1px solid rgba(255,255,255,0.1)', zIndex: 3, flexShrink: 0 }}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ ...toolBtnStyle(), padding: '3px 8px', opacity: currentPage <= 1 ? 0.3 : 1, cursor: currentPage <= 1 ? 'not-allowed' : 'pointer' }} data-testid="btn-pdf-prev">
                <ChevronLeft size={14} /> <span style={{ fontSize: '11px' }}>Prev</span>
              </button>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', fontWeight: 500, minWidth: '50px', textAlign: 'center' }}>
                {currentPage} / {totalPages}
              </span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ ...toolBtnStyle(), padding: '3px 8px', opacity: currentPage >= totalPages ? 0.3 : 1, cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer' }} data-testid="btn-pdf-next">
                <span style={{ fontSize: '11px' }}>Next</span> <ChevronRight size={14} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function LibraryView({ isOpen, onClose, semesters: semestersProp, initialSemesterKey }: LibraryViewProps) {
  const [currentSemIdx, setCurrentSemIdx] = useState(0);
  const [selectedBook, setSelectedBook] = useState<FileRecord | null>(null);
  const [selectedBookColor, setSelectedBookColor] = useState('#8B4513');
  const [animatingBook, setAnimatingBook] = useState<FileRecord | null>(null);
  const [animatingColor, setAnimatingColor] = useState('#8B4513');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const { data: allFiles = [] } = useQuery<FileRecord[]>({
    queryKey: ['/api/files'],
    enabled: isOpen,
  });

  const { data: semesterSettings = [] } = useQuery<any[]>({
    queryKey: ['/api/semesters'],
    enabled: isOpen,
  });

  const semesters = useMemo(() => {
    if (semesterSettings.length === 0) return semestersProp;
    return semesterSettings.map((s: any) => {
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
      return { key, label: name, courses };
    });
  }, [semesterSettings, semestersProp]);

  useEffect(() => {
    if (isOpen && initialSemesterKey && semesters.length > 0) {
      const idx = semesters.findIndex(s => s.key === initialSemesterKey);
      if (idx >= 0) setCurrentSemIdx(idx);
    }
  }, [isOpen, initialSemesterKey, semesters]);

  const currentSemester = semesters[currentSemIdx];

  const courseBooks = useMemo(() => {
    if (!currentSemester) return [];
    const moduleReadingFiles = allFiles.filter(f => {
      if (!f.folder) return false;
      const fl = f.folder.toLowerCase();
      return (fl.includes('-module') || fl.includes('-reading')) && fl.startsWith('week-');
    });

    const courseMap = new Map<string, FileRecord[]>();
    moduleReadingFiles.forEach(f => {
      const match = f.folder!.match(/^week-\d+-(.+?)-(module|reading)$/i);
      if (!match) return;
      const code = match[1].toLowerCase();
      if (!courseMap.has(code)) courseMap.set(code, []);
      courseMap.get(code)!.push(f);
    });

    const semCourses = currentSemester.courses;
    const result: { course: { code: string; name: string; color: string }; files: FileRecord[] }[] = [];

    const sortFiles = (files: FileRecord[]) => {
      files.sort((a, b) => {
        const weekA = parseInt(a.folder?.match(/week-(\d+)/)?.[1] || '0');
        const weekB = parseInt(b.folder?.match(/week-(\d+)/)?.[1] || '0');
        if (weekA !== weekB) return weekA - weekB;
        return (a.displayName || a.originalName).localeCompare(b.displayName || b.originalName);
      });
    };

    semCourses.forEach(course => {
      const codeNorm = course.code.replace(/\s/g, '').toLowerCase();
      const files = courseMap.get(codeNorm);
      if (files && files.length > 0) {
        sortFiles(files);
        result.push({ course, files });
      }
    });

    return result;
  }, [currentSemester, allFiles]);

  const handleBookClick = useCallback((file: FileRecord, color: string) => {
    setAnimatingBook(file);
    setAnimatingColor(color);
  }, []);

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
  const shelfHeight = Math.max(110, Math.min(200, Math.floor((window.innerHeight - 130 - (courseCount - 1) * 15) / courseCount) - 40));

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        background: 'linear-gradient(180deg, #1a0e07 0%, #0d0805 30%, #0a0604 60%, #000000 100%)',
        overflow: 'hidden',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
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
        .book-spine-item:hover {
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

      <button
        onClick={onClose}
        style={{
          position: 'absolute',
          top: '16px',
          right: '16px',
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

      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 100002,
      }}>
        <button className="semester-nav-btn" onClick={prevSem} disabled={currentSemIdx === 0} data-testid="btn-library-prev-sem">
          <ChevronLeft size={20} />
        </button>
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
          </div>
        </div>
        <button className="semester-nav-btn" onClick={nextSem} disabled={currentSemIdx === semesters.length - 1} data-testid="btn-library-next-sem">
          <ChevronRight size={20} />
        </button>
      </div>

      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 100002,
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}>
          {semesters.map((sem, idx) => (
            <div
              key={sem.key}
              onClick={() => setCurrentSemIdx(idx)}
              style={{
                width: '8px',
                height: '8px',
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
      </div>

      <div
        ref={scrollRef}
        style={{
          position: 'absolute',
          top: '80px',
          left: 0,
          right: 0,
          bottom: 0,
          overflowY: 'hidden',
          overflowX: 'hidden',
          padding: '0 20px 10px 35px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: courseBooks.length > 0 ? 'space-evenly' : 'center',
        }}
        className="library-scroll"
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
          </div>
        ) : (
          courseBooks.map(({ course, files: courseFiles }, courseIdx) => (
            <div key={course.code} style={{ marginBottom: courseIdx < courseBooks.length - 1 ? '15px' : '0' }}>
              <div style={{
                fontSize: '9px',
                fontWeight: 500,
                color: '#ffffff',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                marginBottom: '6px',
                paddingLeft: '16px',
                fontFamily: "system-ui, -apple-system, sans-serif",
                borderLeft: `3px solid ${course.color || '#ffffff'}`,
              }}>
                {course.code} — {course.name}
              </div>

              <div style={{ position: 'relative', maxWidth: '100%' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: `${shelfHeight}px`,
                  padding: '0 4px 10px',
                  gap: '2px',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  maxWidth: '100%',
                }}
                className="library-scroll"
                >
                  <Bookend side="left" />
                  {courseFiles.map((file, fileIdx) => {
                    const color = getBookColor(fileIdx, course.code);
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
                      />
                    );
                  })}
                  <Bookend side="right" />
                </div>

                <div className="shelf-wood" style={{
                  height: '12px',
                  borderRadius: '0 0 4px 4px',
                  marginTop: '-2px',
                }} />
                <div className="shelf-front" style={{
                  height: '16px',
                  borderRadius: '0 0 6px 6px',
                  marginTop: '-1px',
                }} />

                <div style={{
                  position: 'absolute',
                  bottom: '28px',
                  left: 0,
                  right: 0,
                  height: '6px',
                  background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 100%)',
                  pointerEvents: 'none',
                }} />
              </div>
            </div>
          ))
        )}
      </div>

      {animatingBook && (
        <BookReader
          file={animatingBook}
          bookColor={animatingColor}
          onClose={() => setAnimatingBook(null)}
        />
      )}
    </div>,
    document.body
  );
}