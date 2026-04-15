import { Megaphone, Settings, StickyNote, Calendar, Library, Sparkles, FileCheck, Zap } from "lucide-react";
import type { MobileTab } from "./types";
import { glassBtnStyle } from "./types";

interface HomeScreenProps {
  mobileAuth: string;
  onOpenAddTask: () => void;
  onOpenNotepad: () => void;
  onOpenSettings: () => void;
  onOpenShifts: () => void;
  onOpenAlexa: () => void;
  onNavigate: (tab: MobileTab) => void;
  onOpenLibrary: () => void;
  onOpenStudyAI: () => void;
  onOpenAPA: () => void;
  onOpenBrynAssist?: () => void;
}

export function HomeScreen({
  mobileAuth,
  onOpenAddTask,
  onOpenNotepad,
  onOpenSettings,
  onOpenShifts,
  onOpenAlexa,
  onOpenLibrary,
  onOpenStudyAI,
  onOpenAPA,
  onOpenBrynAssist,
}: HomeScreenProps) {
  const isFull = mobileAuth === '5747';
  const hasAddTask = mobileAuth === '5747';
  const hasPartnerWizard = mobileAuth === '5747' || mobileAuth === '4201';
  const btnSize = 64;
  const iconSize = 28;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: '14px', padding: '20px', overflow: 'auto',
    }} data-testid="mobile-app-home">
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '16px',
        maxWidth: '260px',
      }}>
        {hasAddTask && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenAddTask} data-testid="mobile-app-btn-add-task" style={{ ...glassBtnStyle(btnSize), fontSize: '30px', fontWeight: 300, fontFamily: "system-ui, -apple-system, sans-serif" }}>
              +
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Add Task</span>
          </div>
        )}

        {isFull && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenAlexa} data-testid="mobile-app-btn-alexa" style={glassBtnStyle(btnSize)}>
              <Megaphone style={{ height: `${iconSize}px`, width: `${iconSize}px` }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Alexa</span>
          </div>
        )}

        {isFull && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenSettings} data-testid="mobile-app-btn-settings" style={glassBtnStyle(btnSize)}>
              <Settings style={{ height: `${iconSize}px`, width: `${iconSize}px` }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Settings</span>
          </div>
        )}

        {isFull && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenNotepad} data-testid="mobile-app-btn-notepad" style={glassBtnStyle(btnSize)}>
              <StickyNote style={{ height: `${iconSize * 0.7}px`, width: `${iconSize * 0.7}px` }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Notepad</span>
          </div>
        )}

        {hasPartnerWizard && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenShifts} data-testid="mobile-app-btn-shifts" style={glassBtnStyle(btnSize)}>
              <Calendar style={{ height: `${iconSize * 0.7}px`, width: `${iconSize * 0.7}px` }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Shifts</span>
          </div>
        )}

        {isFull && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenLibrary} data-testid="mobile-app-btn-library" style={glassBtnStyle(btnSize)}>
              <Library style={{ height: `${iconSize * 0.7}px`, width: `${iconSize * 0.7}px` }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Library</span>
          </div>
        )}

        {isFull && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenStudyAI} data-testid="mobile-app-btn-study-ai" style={glassBtnStyle(btnSize)}>
              <Sparkles style={{ height: `${iconSize * 0.7}px`, width: `${iconSize * 0.7}px`, color: '#a78bfa' }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>Study AI</span>
          </div>
        )}

        {isFull && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenAPA} data-testid="mobile-app-btn-apa" style={glassBtnStyle(btnSize)}>
              <FileCheck style={{ height: `${iconSize * 0.7}px`, width: `${iconSize * 0.7}px`, color: '#86efac' }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>APA Check</span>
          </div>
        )}

        {isFull && onOpenBrynAssist && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <button onClick={onOpenBrynAssist} data-testid="mobile-app-btn-bryn-assist" style={{ ...glassBtnStyle(btnSize), background: 'linear-gradient(180deg, rgba(100,160,255,0.5) 0%, rgba(60,100,200,0.35) 50%, rgba(40,80,180,0.25) 100%)' }}>
              <Zap style={{ height: `${iconSize * 0.7}px`, width: `${iconSize * 0.7}px`, color: '#93b5ff' }} />
            </button>
            <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '10px', fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif" }}>BrynAssist</span>
          </div>
        )}
      </div>

      {mobileAuth === '4201' && (
        <div style={{
          marginTop: '12px', color: 'rgba(255,255,255,0.5)',
          fontSize: '11px', fontWeight: 500, fontStyle: 'italic',
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: 'center', letterSpacing: '0.3px',
        }} data-testid="text-yasu-message">
          I love you Yasu
        </div>
      )}
    </div>
  );
}
