import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface BookAnimationProps {
  isOpen: boolean;
  onComplete: () => void;
  bookColor?: string;
  title?: string;
  courseCode?: string;
}

export default function BookAnimation({ isOpen, onComplete, bookColor = '#8B4513', title = '', courseCode = '' }: BookAnimationProps) {
  const [phase, setPhase] = useState<'idle' | 'pull' | 'flip' | 'move' | 'pages' | 'open' | 'done'>('idle');

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      return;
    }
    setPhase('pull');
    const t1 = setTimeout(() => setPhase('flip'), 600);
    const t2 = setTimeout(() => setPhase('move'), 1200);
    const t3 = setTimeout(() => setPhase('pages'), 1800);
    const t4 = setTimeout(() => setPhase('open'), 3000);
    const t5 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, 3800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); clearTimeout(t5); };
  }, [isOpen, onComplete]);

  if (!isOpen && phase === 'idle') return null;

  const pageColors = ['#fef3c7', '#fef9c3', '#fffbeb', '#fefce8', '#fef3c7', '#fef9c3'];

  return createPortal(
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 999999,
      backgroundColor: phase === 'open' || phase === 'done' ? 'rgba(0,0,0,0.85)' : 'rgba(0,0,0,0.6)',
      transition: 'background-color 0.5s ease',
      perspective: '1500px',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes bookPullOut {
          0% { transform: translateX(-100%) rotateY(0deg) scale(0.8); opacity: 0; }
          30% { transform: translateX(-60%) rotateY(-5deg) scale(0.85); opacity: 1; }
          100% { transform: translateX(0%) rotateY(0deg) scale(1); opacity: 1; }
        }
        @keyframes bookFlip {
          0% { transform: rotateY(0deg) rotateZ(0deg) scale(1); }
          50% { transform: rotateY(90deg) rotateZ(5deg) scale(1.05); }
          100% { transform: rotateY(180deg) rotateZ(0deg) scale(1); }
        }
        @keyframes bookMoveRight {
          0% { transform: translate(-50%, -50%) rotateY(180deg); }
          100% { transform: translate(30%, -50%) rotateY(180deg); }
        }
        @keyframes pageFlip {
          0% { transform: rotateY(0deg); }
          100% { transform: rotateY(-180deg); }
        }
        @keyframes bookOpen {
          0% { transform: translate(30%, -50%) rotateY(0deg) scale(1); }
          100% { transform: translate(0%, -50%) rotateY(0deg) scale(1.3); }
        }
        @keyframes pageRuffle {
          0%, 100% { transform: rotateY(0deg); }
          50% { transform: rotateY(-12deg); }
        }
        @keyframes shelfSlide {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40px); }
        }
      `}</style>

      {(phase === 'pull' || phase === 'flip') && (
        <div style={{
          position: 'absolute',
          left: '5%',
          top: '50%',
          transform: 'translateY(-50%)',
          display: 'flex',
          gap: '3px',
          alignItems: 'flex-end',
        }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: '20px',
              height: `${100 + i * 15}px`,
              backgroundColor: ['#654321', '#8B6914', '#556B2F', '#4A0E0E', '#2F4F4F'][i],
              borderRadius: '2px 3px 3px 2px',
              boxShadow: 'inset -2px 0 4px rgba(0,0,0,0.3)',
              animation: phase === 'pull' && i === 2 ? 'shelfSlide 0.5s ease-out forwards' : 'none',
              opacity: phase === 'pull' && i === 2 ? 0 : 1,
              transition: 'opacity 0.3s ease 0.2s',
            }} />
          ))}
        </div>
      )}

      <div style={{
        position: 'absolute',
        left: '50%',
        top: '50%',
        width: '180px',
        height: '240px',
        transformStyle: 'preserve-3d',
        ...(phase === 'pull' ? {
          animation: 'bookPullOut 0.6s ease-out forwards',
        } : phase === 'flip' ? {
          animation: 'bookFlip 0.6s ease-in-out forwards',
        } : phase === 'move' ? {
          animation: 'bookMoveRight 0.6s ease-in-out forwards',
        } : phase === 'pages' || phase === 'open' || phase === 'done' ? {
          transform: phase === 'open' || phase === 'done' ? 'translate(0%, -50%) scale(1.3)' : 'translate(30%, -50%) rotateY(180deg)',
          transition: 'transform 0.8s ease',
        } : {
          opacity: 0,
        }),
      }}>
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: bookColor,
          borderRadius: '4px 8px 8px 4px',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), inset 0 0 20px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
          backfaceVisibility: phase === 'flip' ? 'visible' : 'visible',
        }}>
          <div style={{
            position: 'absolute',
            left: 0,
            top: '10px',
            bottom: '10px',
            width: '12px',
            background: `linear-gradient(90deg, ${bookColor} 0%, rgba(0,0,0,0.3) 50%, ${bookColor} 100%)`,
            borderRadius: '4px 0 0 4px',
          }} />

          <div style={{
            color: '#D4AF37',
            fontSize: '14px',
            fontWeight: 700,
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            lineHeight: 1.3,
            maxWidth: '140px',
            wordBreak: 'break-word',
          }}>
            {courseCode || 'Course'}
          </div>
          {title && (
            <div style={{
              color: '#D4AF37',
              fontSize: '9px',
              fontWeight: 400,
              textAlign: 'center',
              marginTop: '8px',
              opacity: 0.8,
              maxWidth: '130px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {title}
            </div>
          )}

          <div style={{
            position: 'absolute',
            bottom: '15px',
            left: '20px',
            right: '20px',
            height: '2px',
            backgroundColor: '#D4AF37',
            opacity: 0.5,
          }} />
          <div style={{
            position: 'absolute',
            top: '15px',
            left: '20px',
            right: '20px',
            height: '2px',
            backgroundColor: '#D4AF37',
            opacity: 0.5,
          }} />
        </div>

        {(phase === 'pages' || phase === 'open') && (
          <div style={{
            position: 'absolute',
            inset: 0,
            transformStyle: 'preserve-3d',
          }}>
            {pageColors.map((color, i) => (
              <div key={i} style={{
                position: 'absolute',
                right: '4px',
                top: '4px',
                bottom: '4px',
                width: '170px',
                backgroundColor: color,
                borderRadius: '0 6px 6px 0',
                transformOrigin: 'left center',
                animation: `pageFlip 0.2s ease-in-out ${i * 0.15}s forwards`,
                boxShadow: '2px 0 4px rgba(0,0,0,0.1)',
                display: 'flex',
                flexDirection: 'column',
                padding: '12px 10px',
                gap: '4px',
              }}>
                {[...Array(12)].map((_, li) => (
                  <div key={li} style={{
                    height: '3px',
                    backgroundColor: 'rgba(0,0,0,0.08)',
                    borderRadius: '1px',
                    width: `${60 + Math.random() * 35}%`,
                  }} />
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {(phase === 'open' || phase === 'done') && (
        <div style={{
          position: 'absolute',
          right: '5%',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '400px',
          height: '500px',
          display: 'flex',
          opacity: phase === 'done' ? 1 : 0,
          transition: 'opacity 0.5s ease 0.3s',
        }}>
          <div style={{
            width: '30px',
            background: `linear-gradient(90deg, ${bookColor} 0%, rgba(0,0,0,0.4) 40%, ${bookColor} 80%, rgba(0,0,0,0.2) 100%)`,
            borderRadius: '4px 0 0 4px',
            boxShadow: 'inset -3px 0 8px rgba(0,0,0,0.3)',
          }} />
          <div style={{
            flex: 1,
            backgroundColor: '#fef3c7',
            borderRadius: '0 8px 8px 0',
            boxShadow: '4px 4px 20px rgba(0,0,0,0.3)',
            padding: '30px 25px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            overflow: 'hidden',
          }}>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px', borderBottom: '1px solid rgba(0,0,0,0.1)', paddingBottom: '8px' }}>
              {courseCode} — {title || 'Reading'}
            </div>
            {[...Array(20)].map((_, i) => (
              <div key={i} style={{
                height: '8px',
                backgroundColor: 'rgba(0,0,0,0.06)',
                borderRadius: '2px',
                width: `${50 + Math.random() * 45}%`,
              }} />
            ))}
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
