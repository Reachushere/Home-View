import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';

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
        transform: 'translate(-50%, -50%)',
        width: '8px',
        height: '8px',
        border: '1px solid rgba(212,175,55,0.5)',
        borderRadius: '1px',
        transform: 'translate(-50%, -50%) rotate(45deg)',
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

function BookPullAnimation({ file, bookColor, onComplete, onClose }: {
  file: FileRecord;
  bookColor: string;
  onComplete: () => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'pull' | 'flip' | 'open' | 'done'>('pull');
  const title = truncateSpineTitle(file.displayName || file.originalName, 60);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('flip'), 700);
    const t2 = setTimeout(() => setPhase('open'), 1400);
    const t3 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100001,
        backgroundColor: phase === 'done' ? 'rgba(0,0,0,0.9)' : 'rgba(0,0,0,0.7)',
        transition: 'background-color 0.5s ease',
        perspective: '1500px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget && phase === 'done') onClose(); }}
    >
      <style>{`
        @keyframes libraryBookPull {
          0% { transform: translateX(-200px) rotateY(90deg) scale(0.6); opacity: 0; }
          40% { transform: translateX(-50px) rotateY(30deg) scale(0.8); opacity: 1; }
          100% { transform: translateX(0) rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes libraryBookFlip {
          0% { transform: rotateY(0deg) scale(1); }
          100% { transform: rotateY(0deg) scale(1.15); }
        }
        @keyframes libraryBookOpen {
          0% { transform: scale(1.15); }
          50% { transform: scale(1.3) rotateY(-10deg); }
          100% { transform: scale(0.9); opacity: 0; }
        }
        @keyframes libraryPagesFan {
          0% { transform: rotateY(0deg); opacity: 1; }
          100% { transform: rotateY(-160deg); opacity: 0.6; }
        }
      `}</style>

      <div style={{
        width: '200px',
        height: '280px',
        transformStyle: 'preserve-3d',
        animation: phase === 'pull' ? 'libraryBookPull 0.7s ease-out forwards'
          : phase === 'flip' ? 'libraryBookFlip 0.7s ease-in-out forwards'
          : phase === 'open' ? 'libraryBookOpen 0.8s ease-in forwards'
          : 'none',
        opacity: phase === 'done' ? 0 : 1,
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: bookColor,
          borderRadius: '4px 10px 10px 4px',
          boxShadow: '0 10px 50px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '25px',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: '8px',
            bottom: '8px',
            width: '14px',
            background: `linear-gradient(90deg, ${bookColor} 0%, rgba(0,0,0,0.4) 50%, ${bookColor} 100%)`,
            borderRadius: '4px 0 0 4px',
          }} />
          <div style={{
            position: 'absolute',
            top: '15px',
            left: '25px',
            right: '25px',
            height: '2px',
            backgroundColor: '#D4AF37',
            opacity: 0.5,
          }} />
          <div style={{
            color: '#D4AF37',
            fontSize: '13px',
            fontWeight: 700,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '1.5px',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            lineHeight: 1.4,
            maxWidth: '150px',
            wordBreak: 'break-word',
          }}>
            {title}
          </div>
          <div style={{
            position: 'absolute',
            bottom: '15px',
            left: '25px',
            right: '25px',
            height: '2px',
            backgroundColor: '#D4AF37',
            opacity: 0.5,
          }} />
        </div>

        {(phase === 'flip' || phase === 'open') && (
          <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                position: 'absolute',
                right: '4px',
                top: '4px',
                bottom: '4px',
                width: '190px',
                backgroundColor: ['#fef3c7', '#fef9c3', '#fffbeb', '#fefce8'][i],
                borderRadius: '0 8px 8px 0',
                transformOrigin: 'left center',
                animation: `libraryPagesFan 0.3s ease-in-out ${i * 0.12}s forwards`,
                boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
              }} />
            ))}
          </div>
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

  const handleAnimationComplete = useCallback(() => {
    if (animatingBook) {
      window.open(`/pdf-viewer/${animatingBook.id}`, '_blank');
      setTimeout(() => setAnimatingBook(null), 300);
    }
  }, [animatingBook]);

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
        <BookPullAnimation
          file={animatingBook}
          bookColor={animatingColor}
          onComplete={handleAnimationComplete}
          onClose={() => setAnimatingBook(null)}
        />
      )}
    </div>,
    document.body
  );
}