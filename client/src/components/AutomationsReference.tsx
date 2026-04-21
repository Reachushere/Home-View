import { useState } from "react";
import { createPortal } from "react-dom";
import {
  Zap,
  Bell,
  Clock,
  Mail,
  Volume2,
  Calendar,
  Cloud,
  Brain,
  Home,
  RefreshCw,
  Shield,
  ChevronDown,
  ChevronRight,
  Newspaper,
  X,
  FileText,
  Loader2,
  ClipboardCheck,
} from "lucide-react";
import bgBack from "@assets/Back_1776566950517.png";
import boxBlue from "@assets/Blue_Box_1776566950518.png";
import boxGreen from "@assets/Green2_1776566950518.png";
import oneDriveBox from "@assets/OneDrive_1776567093048.png";
import boxGrey from "@assets/Grey_Box_1776566950519.png";
import boxRed from "@assets/Red_Box_1776566950520.png";
import boxYellow from "@assets/Yellow_Box_1776566950520.png";
import headerImg from "@assets/Header_1776566950519.png";

// Maps each category id to one of the bordered "box" PNGs supplied by Bryn.
// Keeps the visual pipeline consistent: blue=sync, green=onedrive/auto-tasks,
// red=alerts/AI, yellow=background data, grey=popups & HA.
const CATEGORY_BG: Record<string, string> = {
  popups: boxGrey,
  reminders: boxRed,
  'calendar-sync': boxBlue,
  'auto-tasks': boxGreen,
  brynassist: boxRed,
  ha: boxGrey,
  data: boxYellow,
};

interface AutomationItem {
  icon: typeof Zap;
  title: string;
  description: string;
  when: string;
  canDisable?: string;
}

interface AutomationCategory {
  id: string;
  icon: typeof Zap;
  title: string;
  color: string;
  items: AutomationItem[];
}

const AUTOMATION_CATEGORIES: AutomationCategory[] = [
  {
    id: "popups",
    icon: Shield,
    title: "Automatic Popups",
    color: "#a78bfa",
    items: [
      {
        icon: Shield,
        title: "System Setup Wizard",
        description: "Guides you through initial app setup (name, email, semester, courses).",
        when: "Opens once on first visit — never again after completed.",
        canDisable: "Resets if you clear browser data.",
      },
      {
        icon: Bell,
        title: "Changelog / What's New",
        description: "Shows new features and fixes after an update.",
        when: "Opens once per new version — auto-dismissed after you close it.",
      },
      {
        icon: Zap,
        title: "OpenAI Charge Approval",
        description: "Asks for permission before BrynAssist spends money on an AI action.",
        when: "Pops up whenever an AI action costs money (polls every 3 seconds).",
      },
      {
        icon: Calendar,
        title: "Semester Checklist",
        description: "Prompts you to confirm courses, dates, and settings for an upcoming semester.",
        when: "Appears when a new semester is approaching and hasn't been set up yet.",
      },
      {
        icon: Shield,
        title: "Access Gate / Login",
        description: "Blocks the dashboard until you authenticate with the site password.",
        when: "Every visit if not already logged in.",
      },
    ],
  },
  {
    id: "reminders",
    icon: Bell,
    title: "Task Reminders & Notifications",
    color: "#f97316",
    items: [
      {
        icon: Bell,
        title: "Task Due Reminders",
        description: "Sends notifications at 4 intervals before a task is due (e.g. 30 min, 2 hours, 1 day, 2 days).",
        when: "Checked every 60 seconds. Sends via Email, Home Assistant push, and Echo voice.",
        canDisable: "Per-task: toggle reminder checkboxes when editing a task.",
      },
      {
        icon: Volume2,
        title: "Echo / Alexa Voice Announcements",
        description: "Speaks task reminders aloud on your Echo speakers (rate-limited to 3 per cycle, 10s gap).",
        when: "Same schedule as reminders. Suppressed when Travelling Mode is active.",
        canDisable: "Enable Travelling Mode to silence, or turn off individual task reminders.",
      },
      {
        icon: Mail,
        title: "Daily Digest Email",
        description: "Sends a summary of all tasks due in the next 3 days to your email.",
        when: "Every day at 7:00 AM ET.",
      },
      {
        icon: Volume2,
        title: "Daily Digest Voice Briefing",
        description: "\"Good morning, you have 3 tasks due tomorrow...\" spoken on your Echo.",
        when: "Every day at 7:00 AM ET (after the email digest).",
      },
    ],
  },
  {
    id: "calendar-sync",
    icon: RefreshCw,
    title: "Calendar & Cloud Sync",
    color: "#3b82f6",
    items: [
      {
        icon: Cloud,
        title: "Outlook Calendar Sync",
        description: "Imports new events from your Outlook calendar into the review queue.",
        when: "Runs automatically once per day at 8:00 AM ET.",
      },
      {
        icon: Calendar,
        title: "Google Calendar Sync",
        description: "When you create tasks with calendar sync enabled, they're pushed to Google Calendar.",
        when: "On task creation/update if the task has Google Calendar sync turned on.",
      },
      {
        icon: Cloud,
        title: "OneDrive Folder Sync",
        description: "Pulls course module and reading files from your OneDrive folder structure.",
        when: "Manually triggered per-course, or via semester health check wizard.",
      },
    ],
  },
  {
    id: "auto-tasks",
    icon: Zap,
    title: "Automatic Task Creation",
    color: "#22c55e",
    items: [
      {
        icon: Calendar,
        title: "Scholarship Date Tasks",
        description: "When you add a scholarship with dates (deadline, documents, interview, winners), a task is automatically created for each date.",
        when: "When saving a scholarship in the Scholarships wizard.",
      },
      {
        icon: RefreshCw,
        title: "Recurring Tasks",
        description: "Tasks with repeat (daily, weekly, monthly, yearly, custom) automatically generate future instances.",
        when: "On task creation/update — calculates up to 200 future occurrences.",
      },
      {
        icon: Calendar,
        title: "PREP Events",
        description: "Optionally creates a \"PREP\" calendar event between a task's start date and due date.",
        when: "When you create a task with both start and due dates and enable prep.",
      },
    ],
  },
  {
    id: "brynassist",
    icon: Brain,
    title: "BrynAssist AI Actions",
    color: "#ec4899",
    items: [
      {
        icon: Brain,
        title: "Natural Language Task Management",
        description: "\"Add a quiz for CPPA122 next Friday\" — BrynAssist finds the course, calculates the date, creates the task.",
        when: "When you ask BrynAssist to create, edit, complete, or search tasks.",
      },
      {
        icon: Home,
        title: "Smart Home Control",
        description: "Control lights, speakers, media players, and automations via voice commands to BrynAssist.",
        when: "When you ask BrynAssist to control a Home Assistant device.",
      },
      {
        icon: Volume2,
        title: "Alexa Announcements via AI",
        description: "BrynAssist can make announcements on your Echo speakers.",
        when: "When you ask BrynAssist to announce something.",
      },
      {
        icon: Mail,
        title: "Email via AI",
        description: "BrynAssist can send emails from homeworkbryn@gmail.com to your Outlook.",
        when: "When you ask BrynAssist to send a reminder email.",
      },
      {
        icon: Zap,
        title: "Spotify Control",
        description: "Play, pause, search, and queue music through BrynAssist.",
        when: "When you ask BrynAssist to play music.",
      },
    ],
  },
  {
    id: "ha",
    icon: Home,
    title: "Home Assistant Integrations",
    color: "#06b6d4",
    items: [
      {
        icon: Home,
        title: "HA Command Queue",
        description: "If a Home Assistant command fails (network issue), it's queued and automatically retried when connectivity returns.",
        when: "Whenever an HA service call fails.",
      },
      {
        icon: Home,
        title: "Travelling Mode Suppression",
        description: "When Travelling Mode is active, all Echo voice announcements are automatically silenced.",
        when: "During your travel date range (start → end).",
      },
      {
        icon: Bell,
        title: "HA Push Notifications",
        description: "Task reminders are pushed to the Home Assistant mobile app.",
        when: "Same schedule as task reminders (every 60 seconds check).",
      },
    ],
  },
  {
    id: "data",
    icon: RefreshCw,
    title: "Background Data Refresh",
    color: "#eab308",
    items: [
      {
        icon: Clock,
        title: "Weather & Pollen Updates",
        description: "Dashboard weather data and pollen counts refresh automatically.",
        when: "Weather every ~15 min, pollen every ~30 min.",
      },
      {
        icon: Newspaper,
        title: "News Ticker",
        description: "Scrolling headlines on the dashboard refresh periodically.",
        when: "Every ~10 minutes.",
      },
      {
        icon: RefreshCw,
        title: "Task Data Polling",
        description: "The dashboard keeps task lists fresh using background data fetching.",
        when: "Varies by query — typically every 30 seconds to a few minutes.",
      },
    ],
  },
];

interface AutomationsReferenceProps {
  open: boolean;
  onClose: () => void;
  colorSettings: {
    mainBackground: string;
    mainBackgroundGradientEnd: string;
    headerBar: string;
  };
}

export default function AutomationsReference({ open, onClose, colorSettings }: AutomationsReferenceProps) {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    AUTOMATION_CATEGORIES.forEach(c => { initial[c.id] = true; });
    return initial;
  });

  if (!open) return null;

  const toggleCategory = (id: string) => {
    setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const totalItems = AUTOMATION_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[10010] flex items-center justify-center"
      onClick={onClose}
      data-testid="automations-reference-overlay"
    >
      <div className="fixed inset-0 bg-black/60" />
      <div
        className="relative z-[10011] overflow-hidden rounded-xl flex flex-col"
        style={{
          width: 'min(600px, calc(100% - 40px))',
          maxHeight: 'calc(100% - 60px)',
          backgroundImage: `url(${bgBack})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#0b1530',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 8px 48px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="automations-reference-panel"
      >
        <div
          className="relative flex items-center justify-center flex-shrink-0"
          style={{
            // CSS gradient (palette from supplied SVG: dark navy
            // #131A2B -> #1F2A40 -> #293249) so the header stretches
            // crisply at any width and stays sharp on hi-dpi screens.
            background: 'linear-gradient(135deg, #293249 0%, #1F2A40 43%, #131A2B 100%)',
            boxShadow: 'inset 0 1px 0 rgba(173,192,226,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
            height: '44px',
            paddingLeft: '12px',
            paddingRight: '12px',
          }}
        >
          <span className="text-[9px] text-white/60 absolute" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}>
            {totalItems} items
          </span>
          <button
            className="absolute text-white/70 hover:text-white transition-colors"
            style={{ right: '12px', top: '50%', transform: 'translateY(-50%)' }}
            onClick={onClose}
            data-testid="button-close-automations"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-4 py-3"
          style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.2) transparent' }}
        >
          <p className="text-[10px] text-white/50 mb-3 leading-relaxed">
            Everything UniCal does automatically — popups, reminders, syncs, AI actions, and background updates.
          </p>

          <div className="space-y-2">
            {AUTOMATION_CATEGORIES.map((category) => {
              const isExpanded = expandedCategories[category.id];
              const CategoryIcon = category.icon;
              const catBg = CATEGORY_BG[category.id] || boxGrey;

              const isCalSync = category.id === 'calendar-sync';
              const isAutoTasks = category.id === 'auto-tasks';
              const isGreyCat = category.id === 'popups' || category.id === 'ha';
              const useCssGradient = isCalSync || isAutoTasks || isGreyCat;
              const cssGradient = isCalSync
                ? 'linear-gradient(135deg, #48AAE8 0%, #2D6CA7 43%, #122E66 100%)'
                : isAutoTasks
                  ? 'linear-gradient(135deg, #64BA4D 0%, #428046 43%, #20453F 100%)'
                  : 'linear-gradient(135deg, #A7AFBB 0%, #687382 43%, #293649 100%)';
              return (
                <div
                  key={category.id}
                  className="rounded-lg overflow-hidden"
                  style={{
                    border: '1px solid rgba(255,255,255,0.18)',
                    // Calendar-sync and auto-tasks use CSS gradients (from the supplied
                    // SVG palettes) so they stretch cleanly at any size — no PNG corner
                    // distortion.
                    backgroundImage: useCssGradient ? cssGradient : `url(${catBg})`,
                    backgroundSize: useCssGradient ? undefined : '100% 100%',
                    backgroundRepeat: useCssGradient ? undefined : 'no-repeat',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
                  }}
                  data-testid={`automation-category-${category.id}`}
                >
                  <button
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors"
                    onClick={() => toggleCategory(category.id)}
                    style={{ background: 'rgba(0,0,0,0.18)' }}
                    data-testid={`button-toggle-${category.id}`}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3 w-3 text-white flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-white flex-shrink-0" />
                    )}
                    <CategoryIcon className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                    <span className="text-[11px] font-semibold text-white flex-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                      {category.title}
                    </span>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full text-white"
                      style={{
                        background: 'rgba(0,0,0,0.35)',
                        border: '1px solid rgba(255,255,255,0.4)',
                      }}
                    >
                      {category.items.length}
                    </span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-2 pt-1.5 space-y-1.5">
                      {category.items.map((item, idx) => {
                        const ItemIcon = item.icon;
                        const isOneDrive = /onedrive/i.test(item.title);
                        const itemBgImg = isOneDrive ? oneDriveBox : null;
                        return (
                          <div
                            key={idx}
                            className="rounded-md px-3 py-2"
                            style={{
                              backgroundImage: itemBgImg ? `url(${itemBgImg})` : undefined,
                              backgroundSize: itemBgImg ? '100% 100%' : undefined,
                              backgroundRepeat: itemBgImg ? 'no-repeat' : undefined,
                              background: itemBgImg ? undefined : 'rgba(0,0,0,0.28)',
                              border: '1px solid rgba(255,255,255,0.18)',
                              minHeight: isOneDrive ? '110px' : undefined,
                            }}
                            data-testid={`automation-item-${category.id}-${idx}`}
                          >
                            <div className="flex items-start gap-2">
                              {!isOneDrive && <ItemIcon className="h-3 w-3 flex-shrink-0 mt-0.5 text-white" />}
                              <div className="flex-1 min-w-0">
                                <div className="text-[10px] font-semibold text-white leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                                  {item.title}
                                </div>
                                <div className="text-[9px] text-white/85 mt-0.5 leading-relaxed">
                                  {item.description}
                                </div>
                                <div className="flex items-center gap-1 mt-1">
                                  <Clock className="h-2.5 w-2.5 text-white/70 flex-shrink-0" />
                                  <span className="text-[8px] text-white/75 leading-relaxed">
                                    {item.when}
                                  </span>
                                </div>
                                {item.canDisable && (
                                  <div className="text-[8px] text-amber-200 mt-0.5 italic">
                                    💡 {item.canDisable}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div
          className="flex justify-end gap-3 border-t border-white/10 px-4 py-2"
          style={{ flexShrink: 0 }}
        >
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md px-4 py-1.5 text-white transition-opacity duration-200"
            style={{
              fontSize: '11px',
              border: '1.5px solid rgba(255,255,255,0.6)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.06) 52%, rgba(255,255,255,0.22) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0.1) 52%, rgba(255,255,255,0.3) 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.06) 52%, rgba(255,255,255,0.22) 100%)';
            }}
            onClick={onClose}
            data-testid="button-close-automations-footer"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AutomationsContent() {
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const toggleCategory = (id: string) => setExpandedCategories(prev => ({ ...prev, [id]: !prev[id] }));
  const totalItems = AUTOMATION_CATEGORIES.reduce((sum, c) => sum + c.items.length, 0);

  const [auditState, setAuditState] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [auditMsg, setAuditMsg] = useState<string>('');

  const runAudit = async () => {
    if (auditState === 'running') return;
    setAuditState('running');
    setAuditMsg('Reading semesters…');
    try {
      const semsRes = await fetch('/api/semesters', { credentials: 'include' });
      if (!semsRes.ok) throw new Error('Could not load semesters');
      const allSems: any[] = await semsRes.json();
      const today = new Date(); today.setHours(0,0,0,0);
      const typePrefix: Record<string, string> = { winter: 'w', fall: 'f', spring_summer: 'ss' };
      const currentFuture = allSems.filter(s => {
        if (!s?.semesterEndDate) return true;
        const end = new Date(s.semesterEndDate);
        return end >= today;
      });
      const semKeys = currentFuture.map(s => {
        const yr = new Date(s.semesterStartDate).getFullYear();
        const t = (s.semesterType || 'winter').toLowerCase();
        const prefix = typePrefix[t] || t.charAt(0) || 'w';
        return `${prefix}${yr}`;
      });
      const reports: any[] = [];
      for (let i = 0; i < semKeys.length; i++) {
        setAuditMsg(`Checking ${semKeys[i]} (${i + 1}/${semKeys.length})…`);
        try {
          const r = await fetch(`/api/semester-health-check/${semKeys[i]}`, { credentials: 'include' });
          if (r.ok) reports.push(await r.json());
        } catch {}
      }
      setAuditMsg('Compiling PDF…');
      // Strip non-serializable icon components from automation list
      const automations = AUTOMATION_CATEGORIES.map(c => ({
        title: c.title,
        items: c.items.map(it => ({ title: it.title, description: it.description, when: it.when, canDisable: it.canDisable })),
      }));
      const pdfRes = await fetch('/api/audit/generate-pdf', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semesterReports: reports, automations, generatedAt: new Date().toISOString() }),
      });
      if (!pdfRes.ok) throw new Error('PDF endpoint failed');
      const blob = await pdfRes.blob();
      const url = URL.createObjectURL(blob);
      window.dispatchEvent(new CustomEvent('unical:audit-pdf-ready', { detail: { url, name: `unical-audit-${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}.pdf` } }));
      setAuditState('done');
      setAuditMsg('Done — see PDF tab at bottom of screen.');
      setTimeout(() => { setAuditState('idle'); setAuditMsg(''); }, 6000);
    } catch (e: any) {
      console.error('[Audit] failed', e);
      setAuditState('error');
      setAuditMsg(e?.message || 'Audit failed');
      setTimeout(() => { setAuditState('idle'); setAuditMsg(''); }, 6000);
    }
  };

  return (
    <div>
      <p className="text-[10px] text-white/50 mb-2 leading-relaxed">
        Everything UniCal does automatically — popups, reminders, syncs, AI actions, and background updates. ({totalItems} items)
      </p>
      <div className="mb-2 flex items-center gap-2">
        <button
          type="button"
          onClick={runAudit}
          disabled={auditState === 'running'}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold text-white border border-white/30 hover:bg-white/15 disabled:opacity-60 disabled:cursor-wait"
          style={{ background: 'rgba(59,130,246,0.35)' }}
          data-testid="button-run-audit"
          title="Audit all current/future semesters, every course, every component, plus all My Automations items, and compile a PDF report."
        >
          {auditState === 'running' ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <ClipboardCheck className="h-3 w-3" />
          )}
          <span>{auditState === 'running' ? 'Running audit…' : 'Run Audit'}</span>
        </button>
        {auditMsg && (
          <span
            className={`text-[9px] ${auditState === 'error' ? 'text-red-300' : 'text-white/70'}`}
            data-testid="text-audit-status"
          >
            {auditMsg}
          </span>
        )}
      </div>
      <div
        className="rounded-lg overflow-hidden mb-3"
        style={{
          background: 'linear-gradient(135deg, #293249 0%, #1F2A40 43%, #131A2B 100%)',
          boxShadow: 'inset 0 1px 0 rgba(173,192,226,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
          height: '38px',
        }}
      />
      <div
        className="rounded-lg p-3"
        style={{
          backgroundImage: `url(${bgBack})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundColor: '#0b1530',
        }}
      >
      <div className="space-y-2">
        {AUTOMATION_CATEGORIES.map((category) => {
          const isExpanded = expandedCategories[category.id];
          const CategoryIcon = category.icon;
          const catBg = CATEGORY_BG[category.id] || boxGrey;
          return (
            <div key={category.id} className="rounded-lg overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.18)', backgroundImage: category.id === 'calendar-sync' ? 'linear-gradient(135deg, #48AAE8 0%, #2D6CA7 43%, #122E66 100%)' : category.id === 'auto-tasks' ? 'linear-gradient(135deg, #64BA4D 0%, #428046 43%, #20453F 100%)' : (category.id === 'popups' || category.id === 'ha') ? 'linear-gradient(135deg, #A7AFBB 0%, #687382 43%, #293649 100%)' : `url(${catBg})`, backgroundSize: (category.id === 'calendar-sync' || category.id === 'auto-tasks' || category.id === 'popups' || category.id === 'ha') ? undefined : '100% 100%', backgroundRepeat: (category.id === 'calendar-sync' || category.id === 'auto-tasks' || category.id === 'popups' || category.id === 'ha') ? undefined : 'no-repeat', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' }} data-testid={`automation-category-${category.id}`}>
              <button className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors" onClick={() => toggleCategory(category.id)} style={{ background: 'rgba(0,0,0,0.18)' }} data-testid={`button-toggle-${category.id}`} type="button">
                {isExpanded ? <ChevronDown className="h-3 w-3 text-white flex-shrink-0" /> : <ChevronRight className="h-3 w-3 text-white flex-shrink-0" />}
                <CategoryIcon className="h-3.5 w-3.5 flex-shrink-0 text-white" />
                <span className="text-[11px] font-semibold text-white flex-1" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{category.title}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.4)' }}>{category.items.length}</span>
              </button>
              {isExpanded && (
                <div className="px-3 pb-2 space-y-1.5 pt-1.5">
                  {category.items.map((item, idx) => {
                    const ItemIcon = item.icon;
                    const isOneDrive = /onedrive/i.test(item.title);
                    const itemBgImg = isOneDrive ? oneDriveBox : null;
                    return (
                      <div key={idx} className="rounded-md px-3 py-2" style={{ backgroundImage: itemBgImg ? `url(${itemBgImg})` : undefined, backgroundSize: itemBgImg ? '100% 100%' : undefined, backgroundRepeat: itemBgImg ? 'no-repeat' : undefined, background: itemBgImg ? undefined : 'rgba(0,0,0,0.28)', border: '1px solid rgba(255,255,255,0.18)', minHeight: isOneDrive ? '110px' : undefined }} data-testid={`automation-item-${category.id}-${idx}`}>
                        <div className="flex items-start gap-2">
                          {!isOneDrive && <ItemIcon className="h-3 w-3 flex-shrink-0 mt-0.5 text-white" />}
                          <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-semibold text-white leading-tight" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>{item.title}</div>
                            <div className="text-[9px] text-white/85 mt-0.5 leading-relaxed">{item.description}</div>
                            <div className="flex items-center gap-1 mt-1">
                              <Clock className="h-2.5 w-2.5 text-white/70 flex-shrink-0" />
                              <span className="text-[8px] text-white/75 leading-relaxed">{item.when}</span>
                            </div>
                            {item.canDisable && (<div className="text-[8px] text-amber-200 mt-0.5 italic">💡 {item.canDisable}</div>)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
