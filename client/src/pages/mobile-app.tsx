import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Library, Sparkles, FileCheck, Megaphone, Settings, Calendar, Zap } from "lucide-react";
import LibraryView from "@/components/LibraryView";
import { AiCommandWizard } from "@/components/AiCommandWizard";
import MobileNotesPage from "@/pages/mobile-notes";
import MobileUploadPage from "@/pages/mobile-upload";
import type { MobileTab, SemesterSettings, CoursesData } from "./mobile/types";
import { VALID_PASSWORDS } from "./mobile/types";
import { useIsLandscape, getAvailableTabs } from "./mobile/hooks";
import { PasswordGate } from "./mobile/password-gate";
import { D2LTicker } from "./mobile/d2l-ticker";
import { HomeScreen } from "./mobile/home-screen";
import { CalendarPage } from "./mobile/calendar-page";
import { BottomTabBar } from "./mobile/tab-bar";
import {
  QuickNotepadDialog,
  SettingsWizardDialog,
  PartnerShiftDialog,
  AlexaDialog,
  AddTaskDialog,
} from "./mobile/dialogs";

interface MoreItem {
  label: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
  action: () => void;
  testId: string;
  iconColor?: string;
}

interface ColorSettings {
  mainBackground: string;
  mainBackgroundGradientEnd: string;
  mainBackgroundOverlay?: boolean;
  [key: string]: unknown;
}

function safeHex(val: unknown, fallback: string): string {
  if (typeof val !== 'string' || !val) return fallback;
  const h = val.startsWith('#') ? val : `#${val}`;
  return /^#[0-9a-fA-F]{3,8}$/.test(h) ? h : fallback;
}

export default function MobileApp() {
  const [mobileAuth, setMobileAuth] = useState<string | null>(() => {
    const urlAuth = new URLSearchParams(window.location.search).get('auth');
    if (urlAuth && VALID_PASSWORDS.includes(urlAuth)) {
      localStorage.setItem('mobileAuth', urlAuth);
      return urlAuth;
    }
    const stored = localStorage.getItem('mobileAuth');
    if (stored && VALID_PASSWORDS.includes(stored)) return stored;
    return null;
  });

  const isLandscape = useIsLandscape();
  const [activeTab, setActiveTab] = useState<MobileTab>('home');
  const [showAddTask, setShowAddTask] = useState(false);
  const [showNotepad, setShowNotepad] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showShifts, setShowShifts] = useState(false);
  const [showAlexa, setShowAlexa] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const [libraryAiSearch, setLibraryAiSearch] = useState(false);
  const [libraryApaCheck, setLibraryApaCheck] = useState(false);
  const [showBrynAssist, setShowBrynAssist] = useState(false);

  const { data: colorData } = useQuery<{ value: ColorSettings }>({
    queryKey: ["/api/app-state", "colorSettings"],
    queryFn: () => fetch('/api/app-state/colorSettings').then(r => r.ok ? r.json() : { value: null }),
    staleTime: 60000,
  });
  const bgColor = colorData?.value?.mainBackgroundOverlay !== false
    ? safeHex(colorData?.value?.mainBackground, '#3a8bbf')
    : '#3a8bbf';

  const { data: semesterSettings } = useQuery<SemesterSettings>({
    queryKey: ["/api/semester"],
    staleTime: 60000,
  });

  const { data: degreeData } = useQuery<{ coursesData?: CoursesData }>({
    queryKey: ["/api/degree-tracking"],
    staleTime: 60000,
  });

  const semesters = useMemo(() => {
    if (!semesterSettings) return [];
    const coursesList = degreeData?.coursesData?.courses || [];
    return [{
      key: 'current',
      label: semesterSettings.semesterType || 'Current',
      courses: coursesList.map(c => ({ code: c.name?.split(' - ')[0] || c.name, name: c.name, color: c.color || '#3b82f6' })),
    }];
  }, [semesterSettings, degreeData]);

  if (!mobileAuth) {
    return <PasswordGate onAuth={setMobileAuth} />;
  }

  const isFull = mobileAuth === '5747';
  const availableTabs = getAvailableTabs(mobileAuth);
  const safeTab = availableTabs.find(t => t.id === activeTab) ? activeTab : 'home';

  const moreItems: MoreItem[] = [
    { label: 'Library', icon: Library, action: () => { setLibraryAiSearch(false); setLibraryApaCheck(false); setShowLibrary(true); }, testId: 'mobile-app-more-library' },
    { label: 'Study AI', icon: Sparkles, action: () => { setLibraryAiSearch(true); setShowLibrary(true); }, testId: 'mobile-app-more-study-ai', iconColor: '#a78bfa' },
    { label: 'APA Checker', icon: FileCheck, action: () => { setLibraryApaCheck(true); setShowLibrary(true); }, testId: 'mobile-app-more-apa', iconColor: '#86efac' },
    { label: 'Alexa / Megaphone', icon: Megaphone, action: () => setShowAlexa(true), testId: 'mobile-app-more-alexa' },
    { label: 'Settings', icon: Settings, action: () => setShowSettings(true), testId: 'mobile-app-more-settings' },
    { label: 'Partner Shifts', icon: Calendar, action: () => setShowShifts(true), testId: 'mobile-app-more-shifts' },
  ];

  const renderContent = () => (
    <>
      {safeTab === 'home' && (
        <HomeScreen
          mobileAuth={mobileAuth}
          onOpenAddTask={() => setShowAddTask(true)}
          onOpenNotepad={() => setShowNotepad(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenShifts={() => setShowShifts(true)}
          onOpenAlexa={() => setShowAlexa(true)}
          onNavigate={setActiveTab}
          onOpenLibrary={() => { setLibraryAiSearch(false); setLibraryApaCheck(false); setShowLibrary(true); }}
          onOpenStudyAI={() => { setLibraryAiSearch(true); setLibraryApaCheck(false); setShowLibrary(true); }}
          onOpenAPA={() => { setLibraryAiSearch(false); setLibraryApaCheck(true); setShowLibrary(true); }}
          onOpenBrynAssist={() => setShowBrynAssist(true)}
        />
      )}
      {safeTab === 'calendar' && <CalendarPage mobileAuth={mobileAuth} />}
      {safeTab === 'notes' && isFull && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <MobileNotesPage />
        </div>
      )}
      {safeTab === 'upload' && isFull && (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <MobileUploadPage />
        </div>
      )}
      {safeTab === 'more' && isFull && (
        <div style={{ flex: 1, overflow: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }} data-testid="mobile-app-more">
          <div style={{ color: '#fff', fontSize: '16px', fontWeight: 600, marginBottom: '4px' }}>More Features</div>
          {moreItems.map(item => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                  padding: '14px 16px', borderRadius: '12px',
                  background: 'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0.1) 100%)',
                  backdropFilter: 'blur(20px)',
                  border: '0.5px solid rgba(255,255,255,0.3)',
                  color: '#fff', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                  textAlign: 'left',
                }}
                data-testid={item.testId}
              >
                <Icon style={{ width: 22, height: 22, color: item.iconColor || '#fff', flexShrink: 0 }} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </>
  );

  const renderBrynAssistFab = () => isFull ? (
    <button
      onClick={() => setShowBrynAssist(true)}
      style={{
        position: 'fixed', bottom: isLandscape ? '16px' : '76px', right: '16px',
        width: '52px', height: '52px', borderRadius: '50%',
        background: 'linear-gradient(135deg, rgba(100,160,255,0.4) 0%, rgba(60,100,200,0.6) 100%)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(100,160,255,0.5)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 0 15px rgba(100,160,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 50, color: '#fff',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
      data-testid="mobile-app-bryn-assist-fab"
    >
      <Zap style={{ width: 24, height: 24 }} />
    </button>
  ) : null;

  const renderDialogs = () => (
    <>
      {showAddTask && <AddTaskDialog onClose={() => setShowAddTask(false)} />}
      {showNotepad && <QuickNotepadDialog onClose={() => setShowNotepad(false)} />}
      {showSettings && <SettingsWizardDialog onClose={() => setShowSettings(false)} />}
      {showShifts && <PartnerShiftDialog onClose={() => setShowShifts(false)} />}
      {showAlexa && <AlexaDialog onClose={() => setShowAlexa(false)} />}
      {showLibrary && (
        <LibraryView
          isOpen={showLibrary}
          onClose={() => { setShowLibrary(false); setLibraryAiSearch(false); setLibraryApaCheck(false); }}
          semesters={semesters}
          initialAiSearch={libraryAiSearch}
          initialApaCheck={libraryApaCheck}
        />
      )}
      {showBrynAssist && (
        <AiCommandWizard
          isOpen={showBrynAssist}
          onClose={() => setShowBrynAssist(false)}
        />
      )}
    </>
  );

  if (isLandscape) {
    return (
      <div
        style={{
          width: '100vw', height: '100dvh', overflow: 'hidden',
          backgroundColor: bgColor,
          display: 'flex', flexDirection: 'row',
          position: 'relative',
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
        data-testid="mobile-app-shell"
      >
        <div style={{
          width: '64px', display: 'flex', flexDirection: 'column', alignItems: 'center',
          paddingTop: '12px', gap: '6px', flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0.6) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.15)',
        }} data-testid="mobile-app-sidebar-nav">
          {availableTabs.map(tab => {
            const Icon = tab.icon;
            const active = safeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  background: active ? 'rgba(255,255,255,0.15)' : 'none', border: 'none',
                  color: active ? '#60a5fa' : 'rgba(255,255,255,0.4)',
                  padding: '8px', cursor: 'pointer', borderRadius: '8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                }}
                data-testid={`mobile-app-tab-${tab.id}`}
              >
                <Icon style={{ width: 20, height: 20 }} />
                <span style={{ fontSize: '8px', fontWeight: active ? 600 : 400 }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <D2LTicker mobileAuth={mobileAuth} onClick={() => {}} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {renderContent()}
            </div>
            {safeTab !== 'calendar' && (
              <div style={{
                width: '45%', maxWidth: '320px', overflow: 'auto',
                borderLeft: '1px solid rgba(255,255,255,0.15)',
                background: 'rgba(0,0,0,0.1)',
              }} data-testid="mobile-app-landscape-calendar-panel">
                <CalendarPage mobileAuth={mobileAuth} />
              </div>
            )}
          </div>
        </div>

        {renderBrynAssistFab()}
        {renderDialogs()}
      </div>
    );
  }

  return (
    <div
      style={{
        width: '100vw', height: '100dvh', overflow: 'hidden',
        backgroundColor: bgColor,
        display: 'flex', flexDirection: 'column',
        position: 'relative',
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
      data-testid="mobile-app-shell"
    >
      <D2LTicker mobileAuth={mobileAuth} onClick={() => {}} />

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {renderContent()}
      </div>

      <BottomTabBar activeTab={safeTab} onTabChange={setActiveTab} tabs={availableTabs} />

      {renderBrynAssistFab()}
      {renderDialogs()}
    </div>
  );
}
