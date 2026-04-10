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

function truncateSpineTitle(name: string, maxLen: number = 28): string {
  const cleaned = name
    .replace(/\.(pdf|docx?|pptx?|xlsx?)$/i, '')
    .replace(/^(Module|Reading|Lecture|Chapter|Ch|Chap)\s*[-_]?\s*/i, '')
    .replace(/[-_]+/g, ' ')
    .trim();
  if (cleaned.length <= maxLen) return cleaned;
  return cleaned.substring(0, maxLen - 1) + '…';
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
  const patternIdx = (index + courseCode.charCodeAt(0)) % SPINE_PATTERNS.length;
  const hasGoldAccent = index % 3 === 0;
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
          top: '12px',
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
          bottom: '12px',
          left: '3px',
          right: '3px',
          height: '2px',
          backgroundColor: '#C0C0C0',
          opacity: 0.5,
        }} />
      )}
      {hasGoldAccent && (
        <div style={{
          position: 'absolute',
          top: '8px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '10px',
          height: '10px',
          border: '1px solid #D4AF37',
          borderRadius: '50%',
          opacity: 0.7,
        }} />
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
        maxHeight: `${bookHeight - 30}px`,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        padding: '4px 0',
        lineHeight: 1.2,
      }}>
        {title}
      </span>
      {file.listened && (
        <div style={{
          position: 'absolute',
          bottom: '6px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '6px',
          height: '6px',
          backgroundColor: '#4CAF50',
          borderRadius: '50%',
          boxShadow: '0 0 4px rgba(76,175,80,0.5)',
        }} />
      )}
    </div>
  );
}

function Bookend({ side }: { side: 'left' | 'right' }) {
  return (
    <div style={{
      width: '14px',
      height: '100%',
      background: 'linear-gradient(90deg, #5D4037 0%, #3E2723 40%, #4E342E 70%, #3E2723 100%)',
      borderRadius: side === 'left' ? '3px 1px 1px 3px' : '1px 3px 3px 1px',
      boxShadow: side === 'left'
        ? 'inset 2px 0 4px rgba(255,255,255,0.1), -2px 0 6px rgba(0,0,0,0.3)'
        : 'inset -2px 0 4px rgba(255,255,255,0.1), 2px 0 6px rgba(0,0,0,0.3)',
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '6px',
        height: '20px',
        background: 'linear-gradient(180deg, #D4AF37 0%, #B8860B 50%, #D4AF37 100%)',
        borderRadius: '2px',
        opacity: 0.6,
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

export default function LibraryView({ isOpen, onClose, semesters, initialSemesterKey }: LibraryViewProps) {
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

    const matchedCodes = new Set<string>();
    semCourses.forEach(course => {
      const codeNorm = course.code.replace(/\s/g, '').toLowerCase();
      const files = courseMap.get(codeNorm);
      if (files && files.length > 0) {
        matchedCodes.add(codeNorm);
        files.sort((a, b) => {
          const weekA = parseInt(a.folder?.match(/week-(\d+)/)?.[1] || '0');
          const weekB = parseInt(b.folder?.match(/week-(\d+)/)?.[1] || '0');
          if (weekA !== weekB) return weekA - weekB;
          return (a.displayName || a.originalName).localeCompare(b.displayName || b.originalName);
        });
        result.push({ course, files });
      }
    });

    courseMap.forEach((files, code) => {
      if (matchedCodes.has(code)) return;
      files.sort((a, b) => {
        const weekA = parseInt(a.folder?.match(/week-(\d+)/)?.[1] || '0');
        const weekB = parseInt(b.folder?.match(/week-(\d+)/)?.[1] || '0');
        if (weekA !== weekB) return weekA - weekB;
        return (a.displayName || a.originalName).localeCompare(b.displayName || b.originalName);
      });
      result.push({ course: { code: code.toUpperCase(), name: '', color: BOOK_COLORS[result.length % BOOK_COLORS.length] }, files });
    });

    return result;
  }, [currentSemester, allFiles]);

  const handleBookClick = useCallback((file: FileRecord, color: string) => {
    setAnimatingBook(file);
    setAnimatingColor(color);
  }, []);

  const handleAnimationComplete = useCallback(() => {
    if (animatingBook) {
      window.open(`/pdf-reader/${animatingBook.id}`, '_blank');
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

  const shelfHeight = 220;

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
          background: linear-gradient(180deg,
            #5D4037 0%,
            #4E342E 15%,
            #3E2723 30%,
            #4E342E 50%,
            #5D4037 70%,
            #6D4C41 85%,
            #5D4037 100%
          );
          box-shadow:
            0 4px 12px rgba(0,0,0,0.5),
            inset 0 2px 4px rgba(255,255,255,0.08),
            inset 0 -2px 4px rgba(0,0,0,0.3);
        }
        .shelf-front {
          background: linear-gradient(180deg,
            #6D4C41 0%,
            #5D4037 30%,
            #4E342E 100%
          );
          box-shadow:
            0 3px 8px rgba(0,0,0,0.4),
            inset 0 1px 2px rgba(255,255,255,0.1);
        }
        .book-spine-item:hover {
          filter: brightness(1.15);
          transform: translateY(-8px) !important;
        }
        .semester-nav-btn {
          background: rgba(93,64,55,0.6);
          border: 1px solid rgba(212,175,55,0.3);
          color: #D4AF37;
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
          border-color: rgba(212,175,55,0.6);
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
            color: '#D4AF37',
            textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            fontFamily: "'Georgia', 'Times New Roman', serif",
          }}>
            Library
          </div>
          <div style={{
            fontSize: '12px',
            color: 'rgba(212,175,55,0.7)',
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
                backgroundColor: idx === currentSemIdx ? '#D4AF37' : 'rgba(255,255,255,0.2)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: idx === currentSemIdx ? '0 0 6px rgba(212,175,55,0.5)' : 'none',
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
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 30px 40px',
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
            <div key={course.code} style={{ marginBottom: '40px' }}>
              <div style={{
                fontSize: '13px',
                fontWeight: 600,
                color: 'rgba(212,175,55,0.8)',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                marginBottom: '12px',
                paddingLeft: '16px',
                fontFamily: "'Georgia', 'Times New Roman', serif",
                borderLeft: `3px solid ${course.color || '#D4AF37'}`,
              }}>
                {course.code} — {course.name}
              </div>

              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  height: `${shelfHeight}px`,
                  padding: '0 4px 10px',
                  gap: '2px',
                  overflowX: 'auto',
                  overflowY: 'hidden',
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