import { useState, useRef, useEffect } from 'react';
import { Pencil, Folder, FileText, BookOpen, Calendar, Cloud, RefreshCw, AlertCircle, CheckCircle2, Loader2, ExternalLink, Library, Settings, Volume2 } from 'lucide-react';
import courseDetailsFolderIcon from '@/assets/course-details-folder.png';

type Status = 'ok' | 'warning' | 'error' | 'pending';

const STATUS_COLOR: Record<Status, string> = {
  ok: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  pending: '#94a3b8',
};

const STATUS_GLOW: Record<Status, string> = {
  ok: 'rgba(16,185,129,0.55)',
  warning: 'rgba(245,158,11,0.55)',
  error: 'rgba(239,68,68,0.55)',
  pending: 'rgba(148,163,184,0.45)',
};

interface NodeBoxProps {
  label: string;
  sublabel?: string;
  Icon?: any;
  // When provided, an <img> at this URL is rendered instead of the Lucide
  // Icon — used for Course Details where the user wants the OS-style
  // yellow folder picture instead of a tinted line icon.
  iconUrl?: string;
  iconSize?: number;
  status?: Status;
  pencil?: boolean;
  pencilTitle?: string;
  onClick?: () => void;
  onPencilClick?: () => void;
  onPencilSubmit?: (newValue: string) => Promise<void> | void;
  pencilInitialValue?: string;
  pencilPlaceholder?: string;
  width?: number;
  background?: string;
  testId?: string;
  // When true, renders a half-height variant used by the TTS strips so they
  // don't visually overpower the folder rows above them.
  slim?: boolean;
}

// One-time keyframes for the orange/red "click me to fix" pulse on dots
// and connecting lines. Mounted once at the bottom of the component tree
// inside <PipelinePulseStyles />.
const PIPELINE_PULSE_STYLE_ID = 'pipeline-pulse-keyframes';
function PipelinePulseStyles() {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById(PIPELINE_PULSE_STYLE_ID)) return;
    const el = document.createElement('style');
    el.id = PIPELINE_PULSE_STYLE_ID;
    el.textContent = `
      @keyframes pipelinePulseDot {
        0%, 100% { box-shadow: 0 0 4px var(--pp-c), 0 0 1px var(--pp-c); transform: scale(1); }
        50%      { box-shadow: 0 0 14px var(--pp-c), 0 0 4px var(--pp-c); transform: scale(1.18); }
      }
      @keyframes pipelinePulseLine {
        0%, 100% { box-shadow: 0 0 4px var(--pp-c); opacity: 0.85; }
        50%      { box-shadow: 0 0 12px var(--pp-c); opacity: 1; }
      }
    `;
    document.head.appendChild(el);
  }, []);
  return null;
}

function NodeBox(props: NodeBoxProps) {
  const {
    label, sublabel, Icon, iconUrl, iconSize = 14, status = 'ok', pencil, pencilTitle, onClick,
    onPencilClick, onPencilSubmit, pencilInitialValue = '', pencilPlaceholder,
    width = 150, background, testId, slim = false,
  } = props;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(pencilInitialValue);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  useEffect(() => { setValue(pencilInitialValue); }, [pencilInitialValue]);

  const dotColor = STATUS_COLOR[status];
  const glow = STATUS_GLOW[status];

  const submit = async () => {
    if (!onPencilSubmit) { setEditing(false); return; }
    if (!value.trim() || value === pencilInitialValue) { setEditing(false); return; }
    try {
      setSaving(true);
      await onPencilSubmit(value.trim());
      setEditing(false);
    } catch (e) {
      // Stay open on error so the user can retry / fix value.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      data-testid={testId}
      onClick={(e) => { if (!editing && onClick) { e.stopPropagation(); onClick(); } }}
      style={{
        position: 'relative',
        width,
        minHeight: slim ? 28 : 50,
        padding: slim ? '3px 10px' : '8px 10px',
        borderRadius: 8,
        background: background || 'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 100%)',
        border: `1.5px solid ${dotColor}66`,
        boxShadow: `0 0 0 1px rgba(255,255,255,0.04) inset, 0 4px 14px rgba(0,0,0,0.3), 0 0 8px ${glow}`,
        cursor: onClick && !editing ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        transition: 'transform 120ms ease, box-shadow 120ms ease',
      }}
      onMouseEnter={(e) => { if (onClick) e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
    >
      <span
        onClick={(e) => { if (onClick && (status === 'warning' || status === 'error')) { e.stopPropagation(); onClick(); } }}
        style={{
          position: 'absolute', top: 5, right: 6, width: 9, height: 9, borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}, 0 0 2px ${dotColor}`,
          cursor: (status === 'warning' || status === 'error') && onClick ? 'pointer' : 'default',
          // Orange/red dots pulse to advertise that they're actionable —
          // clicking them (or the parent box) opens the corresponding wizard.
          animation: (status === 'warning' || status === 'error')
            ? 'pipelinePulseDot 1.4s ease-in-out infinite'
            : undefined,
          ['--pp-c' as any]: dotColor,
        }}
        title={status === 'warning' || status === 'error' ? `${status === 'warning' ? 'Needs attention' : 'Error'} — click to fix` : `Status: ${status}`}
      />
      {iconUrl ? (
        <img
          src={iconUrl}
          alt=""
          style={{ width: iconSize + 6, height: iconSize + 6, flexShrink: 0, objectFit: 'contain', filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.5))' }}
        />
      ) : Icon ? (
        <Icon style={{ width: iconSize, height: iconSize, color: '#e2e8f0', flexShrink: 0 }} />
      ) : null}
      <div style={{ minWidth: 0, flex: 1 }}>
        {!editing ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.15, textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{label}</div>
            {sublabel && (
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.65)', fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sublabel}>{sublabel}</div>
            )}
          </>
        ) : (
          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); submit(); }
              else if (e.key === 'Escape') { e.preventDefault(); setEditing(false); setValue(pencilInitialValue); }
            }}
            placeholder={pencilPlaceholder || ''}
            disabled={saving}
            style={{
              width: '100%', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 4, padding: '3px 6px', fontSize: 11, color: '#fff', outline: 'none',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
            data-testid={testId ? `${testId}-input` : undefined}
          />
        )}
      </div>
      {pencil && !editing && (
        <button
          type="button"
          title={pencilTitle || 'Rename'}
          onClick={(e) => { e.stopPropagation(); onPencilClick ? onPencilClick() : setEditing(true); }}
          style={{
            background: 'transparent', border: 'none', padding: 2, cursor: 'pointer',
            color: 'rgba(255,255,255,0.55)',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = '#fff'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; }}
          data-testid={testId ? `${testId}-pencil` : undefined}
        >
          <Pencil style={{ width: 11, height: 11 }} />
        </button>
      )}
      {editing && saving && <Loader2 style={{ width: 12, height: 12, color: '#fff', animation: 'spin 1s linear infinite' }} />}
    </div>
  );
}

interface FlowLineProps {
  status: Status;
  onClick?: () => void;
  title?: string;
  height?: number;
  testId?: string;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        margin: '14px 0 6px',
        fontSize: 9, fontWeight: 800, letterSpacing: 1.4,
        color: 'rgba(255,255,255,0.55)',
        textTransform: 'uppercase',
        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
      }}
    >
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.18) 100%)' }} />
      <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.6)' }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,0.18) 0%, transparent 100%)' }} />
    </div>
  );
}

function FlowLine({ status, onClick, title, height = 14, testId }: FlowLineProps) {
  const color = STATUS_COLOR[status];
  const isWarn = status === 'warning' || status === 'error';
  return (
    <div
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}
      title={isWarn && onClick ? `${title || 'Issue detected'} — click to fix` : title}
      data-testid={testId}
      style={{
        height, width: isWarn ? 3 : 2, margin: '0 auto', background: color,
        boxShadow: `0 0 6px ${STATUS_GLOW[status]}`,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        // Orange/red lines pulse to mark them as actionable.
        animation: isWarn ? 'pipelinePulseLine 1.4s ease-in-out infinite' : undefined,
        ['--pp-c' as any]: color,
      }}
    >
      {/* widen click target */}
      {onClick && <div style={{ position: 'absolute', inset: '-2px -10px', cursor: 'pointer' }} />}
    </div>
  );
}

interface CourseAutomationPipelineProps {
  course: {
    code: string;
    name?: string;
    fullName?: string;
    color?: string;
    // Used to mirror the actual calendar row label cell's gradient on
    // the pipeline's "Calendar Row" NodeBox.
    colorEnd?: string;
    colorStops?: string;
    courseFontColor?: string;
  };
  courseHealth: any;
  expandedSemKey: string;
  semesterId?: string;
  courseSlot?: number; // 1..N
  oneDrivePath: string;
  displayName: string;
  moduleFolder?: string;
  readingFolder?: string;
  numberOfWeeks: number;
  // Optional course-specific week range. If omitted, falls back to
  // 1..numberOfWeeks. Phil-style half-term courses pass e.g. 1..7.
  firstWeek?: number;
  lastWeek?: number;
  // Per-course colors used for the Module / Reading calendar boxes so they
  // visually match the actual calendar page.
  moduleBoxColor?: string;
  readingBoxColor?: string;
  onOpenWizard: (issueKey: string, opts?: { weekNum?: number; uploadType?: 'module' | 'reading' }) => void;
  onOpenCourseDetails: () => void;
  onCourseFolderRenamed?: () => void;
  onModuleFolderRenamed?: () => void;
  onReadingFolderRenamed?: () => void;
  // Per-week TTS-toggle wiring. When supplied, each week cell in the
  // folder-row orange box becomes the same rich card as the Weekly
  // Content Status panel (TTS dot, FILE dot, "Module"/"Reading" label,
  // USE toggle) instead of a bare file-count chip.
  isTtsCounted?: (week: number, type: 'module' | 'reading') => boolean;
  setTtsCounted?: (week: number, type: 'module' | 'reading', counted: boolean) => void;
  isReadingExempt?: (week: number) => boolean;
}

export function CourseAutomationPipeline(props: CourseAutomationPipelineProps) {
  const {
    course, courseHealth, semesterId, courseSlot, oneDrivePath, displayName,
    moduleFolder, readingFolder, numberOfWeeks,
    firstWeek: propFirstWeek, lastWeek: propLastWeek,
    moduleBoxColor, readingBoxColor,
    onOpenWizard, onOpenCourseDetails,
    onCourseFolderRenamed, onModuleFolderRenamed, onReadingFolderRenamed,
    isTtsCounted, setTtsCounted, isReadingExempt,
  } = props;
  const firstWeek = Math.max(1, propFirstWeek ?? 1);
  const lastWeek = Math.max(firstWeek, Math.min(numberOfWeeks, propLastWeek ?? numberOfWeeks));

  // Actual OneDrive folder name (e.g. "CPHL110 - Philosophy of Religion").
  // Falls back to the course's fullName/code if the health probe didn't
  // surface a matched folder yet.
  const odFolderName: string = courseHealth?.folderName || course.fullName || course.name || course.code;
  const modColor = moduleBoxColor || course.color || '#3b82f6';
  const readColor = readingBoxColor || course.color || '#a855f7';

  // ────────── Derived statuses (mirrors original auto-resolution logic) ──────────
  const odLinked = !!courseHealth?.oneDriveFolderConfigured;
  const totalMod = courseHealth?.totalModules || 0;
  const totalRead = courseHealth?.totalReadings || 0;
  const ttsReady = courseHealth?.totalTtsReady || 0;
  const ttsNeeded = courseHealth?.totalTtsNeeded || 0;
  const sylFolder = !!courseHealth?.syllabusFolderExists;
  const sylLinked = !!courseHealth?.syllabusLinked;
  const asgFolder = !!courseHealth?.assignmentsFolderExists;
  const tbkFolder = !!courseHealth?.textbookFolderExists;

  const courseFolderStatus: Status = odLinked ? 'ok' : 'error';
  const editDetailsStatus: Status = (course.fullName && displayName) ? 'ok' : 'warning';
  const displayNameStatus: Status = displayName ? 'ok' : 'warning';

  const moduleFolderStatus: Status = totalMod > 0 ? 'ok' : odLinked ? 'warning' : 'error';
  const readingFolderStatus: Status = totalRead > 0 ? 'ok' : odLinked ? 'warning' : 'error';
  // Per-kind TTS readiness — drives the colour of the dedicated TTS strip
  // that sits directly beneath each weekly-content folder row. Pending if
  // there are no source files yet (so we don't paint red just because we
  // haven't synced anything); otherwise green when fully ready, orange
  // when partially ready, red when nothing is ready despite files existing.
  // (NOTE: actual ttsReady totals per kind are computed lower down — these
  // declarations are evaluated AFTER that block, see below.)
  const calModuleStatus: Status = totalMod > 0 ? 'ok' : 'warning';
  const calReadingStatus: Status = totalRead > 0 ? 'ok' : 'warning';

  const ttsStatus: Status = ttsNeeded === 0 ? 'pending' : ttsReady === ttsNeeded ? 'ok' : ttsReady > 0 ? 'warning' : 'error';
  const sylStatus: Status = (sylFolder && sylLinked) ? 'ok' : sylFolder ? 'warning' : 'error';
  const asgStatus: Status = asgFolder ? 'ok' : 'warning';
  const tbkStatus: Status = tbkFolder ? 'ok' : 'warning';

  // Newly added section nodes.
  const syncStatus: Status = (totalMod > 0 || totalRead > 0) ? 'ok' : odLinked ? 'warning' : 'error';
  const libraryStatus: Status = (totalMod + totalRead) > 0 ? 'ok' : 'warning';
  const storageStatus: Status = 'ok';

  // Week range used by the orange-box week cells. Per-week TTS readiness
  // is computed inside renderWeekCell directly (formerly the bottom strip).
  const weekRange: number[] = [];
  for (let w = firstWeek; w <= lastWeek; w++) weekRange.push(w);

  // Per-kind file totals + TTS-ready counts so the Calendar Module / Reading
  // boxes can mirror the actual calendar's homework boxes (label + progress
  // ring + file count).
  let modTtsReady = 0;
  let readTtsReady = 0;
  for (const w of weekRange) {
    modTtsReady += courseHealth?.moduleWeeks?.[w]?.ttsReady || 0;
    readTtsReady += courseHealth?.readingWeeks?.[w]?.ttsReady || 0;
  }
  const modulePct = totalMod > 0 ? Math.round((modTtsReady / totalMod) * 100) : 0;
  const readingPct = totalRead > 0 ? Math.round((readTtsReady / totalRead) * 100) : 0;
  const moduleHasFiles = totalMod > 0;
  const readingHasFiles = totalRead > 0;

  // ────────── Per-kind TTS status ──────────
  // Drives the dedicated TTS strip beneath each folder row. We treat
  // "no source files" as pending (grey) instead of error so the strip
  // doesn't scream when the user simply hasn't uploaded anything yet.
  const moduleTtsStatus: Status =
    totalMod === 0 ? 'pending'
    : modTtsReady === totalMod ? 'ok'
    : modTtsReady > 0 ? 'warning'
    : 'error';
  const readingTtsStatus: Status =
    totalRead === 0 ? 'pending'
    : readTtsReady === totalRead ? 'ok'
    : readTtsReady > 0 ? 'warning'
    : 'error';

  // Worst-of helper for connection lines.
  const worst = (...s: Status[]): Status => {
    if (s.includes('error')) return 'error';
    if (s.includes('warning')) return 'warning';
    if (s.includes('pending')) return 'pending';
    return 'ok';
  };

  // ────────── Folder rename handlers (live) ──────────
  const renameCourseFolder = async (newName: string) => {
    const newCode = course.code;
    const r = await fetch('/api/onedrive/rename-course-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        semesterId,
        courseIndex: courseSlot,
        oldCode: course.code,
        oldName: course.fullName || course.name || '',
        newCode,
        newName,
      }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Rename failed: ${txt || r.status}`);
    }
    onCourseFolderRenamed?.();
  };

  // Persist a custom OneDrive path for one of the side-folder cards
  // (Syllabus / Assignments / Textbook). Uses the same per-course-code
  // app_state map the health check honours, so saving here flips the
  // card from red ("No folder") to green on the next health refresh.
  const setSidePath = async (kind: 'syllabus' | 'assignments' | 'textbook', newPath: string) => {
    const url = `/api/${kind}/paths`;
    const body: any = { courseCode: course.code };
    if (kind === 'syllabus') body.objectPath = newPath;
    else body.folderPath = newPath;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Save failed: ${txt || r.status}`);
    }
    onCourseFolderRenamed?.();
  };

  const renameSemFolder = async (key: 'moduleFolder' | 'readingFolder', newPath: string) => {
    if (!semesterId || !courseSlot) throw new Error('Missing semester/course info');
    const field = key === 'moduleFolder' ? `course${courseSlot}ModuleFolder` : `course${courseSlot}ReadingFolder`;
    const r = await fetch(`/api/semesters/${semesterId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ [field]: newPath }),
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => '');
      throw new Error(`Update failed: ${txt || r.status}`);
    }
    if (key === 'moduleFolder') onModuleFolderRenamed?.();
    else onReadingFolderRenamed?.();
  };

  // Header summary chips for top of card.
  const summaryChips = [
    { label: 'OneDrive', s: odLinked ? 'ok' : 'error' as Status, click: () => onOpenWizard('onedrive') },
    { label: 'Sync', s: (totalMod > 0 ? 'ok' : 'error') as Status, click: () => onOpenWizard('sync') },
    { label: 'TTS', s: ttsStatus, click: () => onOpenWizard('tts') },
    { label: 'Storage', s: 'ok' as Status, click: () => onOpenWizard('storage') },
    { label: 'Library', s: ((totalMod + totalRead) > 0 ? 'ok' : 'error') as Status, click: () => onOpenWizard('library') },
    { label: 'Syllabus', s: sylStatus, click: () => onOpenWizard('syllabus_folder') },
    { label: 'Assignments', s: asgStatus, click: () => onOpenWizard('assignments_folder') },
    { label: 'Textbook', s: tbkStatus, click: () => onOpenWizard('textbook_folder') },
  ];

  return (
    <div style={{ position: 'relative' }}>
      <PipelinePulseStyles />
      {/* Status chip strip — single row, click to fix */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
        {summaryChips.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={(e) => { e.stopPropagation(); chip.click(); }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '3px 8px', borderRadius: 999,
              border: `1px solid ${STATUS_COLOR[chip.s]}66`,
              background: `linear-gradient(180deg, ${STATUS_COLOR[chip.s]}22 0%, ${STATUS_COLOR[chip.s]}10 100%)`,
              color: '#fff', fontSize: 10, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              boxShadow: `0 0 6px ${STATUS_GLOW[chip.s]}`,
            }}
            data-testid={`pipeline-chip-${course.code.toLowerCase().replace(/\s/g,'')}-${chip.label.toLowerCase()}`}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: STATUS_COLOR[chip.s], boxShadow: `0 0 4px ${STATUS_COLOR[chip.s]}` }} />
            {chip.label}
          </button>
        ))}
      </div>

      {/* ────────── Pipeline diagram ────────── */}
      <div
        style={{
          position: 'relative',
          padding: 16,
          borderRadius: 12,
          background: 'radial-gradient(ellipse at top, rgba(99,102,241,0.08) 0%, rgba(0,0,0,0.35) 70%)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* ════════ SECTION: ONEDRIVE ════════ */}
        <SectionLabel>OneDrive</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label={odFolderName}
            sublabel={oneDrivePath}
            iconUrl={courseDetailsFolderIcon}
            iconSize={18}
            status={courseFolderStatus}
            pencil
            pencilTitle="Rename this OneDrive folder (renames live; two-way sync)"
            pencilInitialValue={odFolderName}
            pencilPlaceholder="e.g. CPHL110 - Philosophy of Religion"
            onPencilSubmit={renameCourseFolder}
            onClick={() => onOpenWizard('onedrive')}
            width={260}
            testId={`pipeline-course-folder-${course.code.toLowerCase()}`}
          />
        </div>

        <FlowLine
          status={worst(courseFolderStatus, editDetailsStatus)}
          onClick={() => onOpenWizard(courseFolderStatus !== 'ok' ? 'onedrive' : 'sync')}
          title={
            courseFolderStatus !== 'ok'
              ? 'Why orange/red: OneDrive folder for this course is not linked. Click to fix.'
              : editDetailsStatus !== 'ok'
                ? 'Why orange: course full name or display name is missing. Click to fix.'
                : 'Course folder → details linkage'
          }
          testId={`pipeline-line-folder-details-${course.code.toLowerCase()}`}
        />

        {/* ════════ SECTION: COURSE METADATA ════════ */}
        <SectionLabel>Course Metadata</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label="Course Details"
            sublabel={`${course.code}  ·  ${course.fullName || course.name || '—'}  ·  ${displayName || '—'}`}
            Icon={FileText}
            status={editDetailsStatus}
            onClick={onOpenCourseDetails}
            width={300}
            // Match the Course Details dialog's own page gradient so the
            // pipeline's entry-point box visually echoes the page it opens.
            background="linear-gradient(180deg, #3a8bbf 0%, color-mix(in srgb, #164a72 70%, black) 100%)"
            testId={`pipeline-edit-details-${course.code.toLowerCase()}`}
          />
        </div>

        <FlowLine
          status={displayNameStatus}
          onClick={onOpenCourseDetails}
          title={
            displayNameStatus !== 'ok'
              ? 'Why orange: display name is empty, so the calendar row will use the raw course code. Click to set it.'
              : 'Display name flows into the calendar row label'
          }
          testId={`pipeline-line-details-row-${course.code.toLowerCase()}`}
        />

        {/* ════════ SECTION: CALENDAR HEADER ════════
            Background mirrors the gradient that the actual calendar row's
            label cell paints itself with — start color → optional mid stops
            → end color, all vertical. This way the pipeline's Calendar Row
            box is a literal preview of the course's header on the grid. */}
        <SectionLabel>Calendar Header Row</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {(() => {
            const startColor = course.color || '#3b82f6';
            const endColor = course.colorEnd || course.color || '#3b82f6';
            let labelGradient = `linear-gradient(180deg, ${startColor} 0%, ${endColor} 100%)`;
            if (course.colorStops) {
              try {
                const stops: Array<{ position: number; color: string }> = JSON.parse(course.colorStops);
                if (Array.isArray(stops) && stops.length > 0) {
                  const allParts = [
                    `${startColor} 0%`,
                    ...stops.map(s => `${s.color} ${s.position}%`),
                    `${endColor} 100%`,
                  ];
                  labelGradient = `linear-gradient(180deg, ${allParts.join(', ')})`;
                }
              } catch { /* fall through to two-stop gradient */ }
            }
            return (
              <NodeBox
                label={`Calendar Row: ${displayName || course.code}`}
                sublabel="Header label on every weekly calendar row"
                Icon={Calendar}
                status={displayNameStatus}
                onClick={onOpenCourseDetails}
                width={300}
                background={labelGradient}
                testId={`pipeline-calendar-row-${course.code.toLowerCase()}`}
              />
            );
          })()}
        </div>

        {/* ════════ SECTION: WEEKLY CONTENT FOLDERS ════════
            Module + Reading folder boxes are STACKED (module on top with
            chip-on-left, reading below with chip-on-right). The weeks for
            each folder live INSIDE that row's status-colored "orange box"
            because a module/reading folder is only meaningful in the
            context of the per-week files it actually holds.

            Wire routing (per user spec):
              [Calendar Row]
                    |
                ____|____
               |         |   ← right arm continues DOWN past module row
               V         |
              [Mod chip][weeks ───────────]
                                          |
                                   _______|
                                  |       |
                                  V       V
                                 [weeks ──][Read chip]
                                          |
                                          V
                                        [Sync]
        */}
        <SectionLabel>Weekly Content Folders</SectionLabel>
        {(() => {
          // Layout constants used by the wire-routing absolute elements so
          // the right arm always runs cleanly from the top splitter down
          // past the module row to the pre-reading splitter.
          const TOP_SPLIT_H = 18;
          const ROW_MIN_H = 76;
          const ROW_GAP = 10;
          const PRE_READ_SPLIT_H = 18;
          const TOP_BUS_Y = 6;             // y of the top H-bus inside the splitter
          const PRE_READ_BUS_Y = 12;       // y of the H-bus inside the pre-read splitter
          // ────────── TTS strip layout ──────────
          // The TTS strip sits IMMEDIATELY below its folder row (small
          // intra-pair gap), with the same min-height so the per-week
          // cells inside it line up column-for-column with the orange-box
          // weeks above. The right arm has to skip past TWO rows now
          // (folder + TTS) per kind, so ARM_BOTTOM_Y picks up the extra
          // height of one TTS row + intra-pair gap before reaching the
          // pre-read splitter.
          // TTS strips sit IMMEDIATELY below their folder row at HALF
          // height (the user asked for shorter TTS rows, not removal).
          // The right arm has to skip past TWO rows per kind, so
          // ARM_BOTTOM_Y picks up the extra TTS row + intra-pair gap.
          const TTS_ROW_MIN_H = Math.round(ROW_MIN_H / 2);
          const INTRA_PAIR_GAP = 2;
          const ARM_TOP = TOP_BUS_Y;       // wrapper-relative
          // Right arm now lands directly on the Reading Folder NodeBox
          // (right-side chip of the reading row) instead of running past
          // it down into a pre-read splitter. Stops at the TOP of the
          // reading row.
          const ARM_BOTTOM_Y =
            TOP_SPLIT_H + ROW_MIN_H + INTRA_PAIR_GAP + TTS_ROW_MIN_H + ROW_GAP + PRE_READ_SPLIT_H;
          const ARM_HEIGHT = ARM_BOTTOM_Y - ARM_TOP;

          // Each orange-box cell mirrors the Weekly Content Status panel
          // card at the bottom of the dashboard: TTS dot top-left, FILE
          // dot top-right, "Module" / "Reading" centred label, USE toggle
          // bottom-right. Toggling USE off mutes the cell to grey and
          // excludes the slot from the pipeline TTS rollup.
          const RED_GRAD = 'linear-gradient(135deg, #FAB6BE 0%, #C46D75 43%, #8F252E 100%)';
          const cornerDotWithLabel = (corner: 'tl' | 'tr', ok: boolean, label: string, title: string, testId: string) => (
            <span
              title={title}
              style={{
                position: 'absolute', top: 2,
                [corner === 'tl' ? 'left' : 'right']: 2,
                display: 'flex', alignItems: 'center', gap: 2,
                flexDirection: corner === 'tl' ? 'row' : 'row-reverse',
              }}
            >
              <span
                data-testid={testId}
                style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: ok ? '#10b981' : '#ef4444',
                  boxShadow: `0 0 4px ${ok ? '#10b981' : '#ef4444'}, 0 0 2px ${ok ? '#10b981' : '#ef4444'}`,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1, letterSpacing: '0.3px' }}>{label}</span>
            </span>
          );
          const useToggle = (counted: boolean, onToggle: () => void, testId: string) => (
            <span style={{ position: 'absolute', bottom: 2, right: 2, display: 'flex', alignItems: 'center', gap: 2, flexDirection: 'row-reverse' }}>
              <button
                onClick={(e) => { e.stopPropagation(); onToggle(); }}
                data-testid={testId}
                title={counted ? 'Counted toward pipeline TTS — click to exclude' : 'Excluded from pipeline TTS — click to include'}
                style={{
                  width: 16, height: 9, borderRadius: 5,
                  background: counted ? 'rgba(16,185,129,0.9)' : 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(0,0,0,0.4)',
                  cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ display: 'block', width: 6, height: 6, background: 'white', borderRadius: '50%', position: 'absolute', top: 0.5, left: counted ? 8 : 1, transition: 'left 0.15s', boxShadow: '0 1px 1px rgba(0,0,0,0.4)' }} />
              </button>
              <span style={{ fontSize: 7, fontWeight: 700, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1, letterSpacing: '0.3px' }}>USE</span>
            </span>
          );

          const renderWeekCell = (
            w: number,
            slot: { count: number; ttsReady: number } | undefined,
            kind: 'module' | 'reading',
          ) => {
            const count = slot?.count || 0;
            const ttsReadyCnt = slot?.ttsReady || 0;
            const cellColor = kind === 'module' ? modColor : readColor;
            const fileOk = count > 0;
            const ttsOk = fileOk && ttsReadyCnt >= count;
            const counted = isTtsCounted ? isTtsCounted(w, kind) : true;
            const rExempt = kind === 'reading' && isReadingExempt ? isReadingExempt(w) : false;
            return (
              <div
                key={w}
                onClick={(e) => { e.stopPropagation(); onOpenWizard(kind === 'module' ? 'module_folder' : 'reading_folder', { weekNum: w, uploadType: kind }); }}
                title={!counted
                  ? `${kind === 'module' ? 'Module' : 'Reading'} excluded from TTS — toggle on to count`
                  : `Week ${w} · ${kind}: ${fileOk ? `${count} file${count === 1 ? '' : 's'}` : 'no file'} • TTS ${ttsReadyCnt}/${count}`}
                data-testid={`pipeline-week-${kind}-${course.code.toLowerCase()}-${w}`}
                style={{
                  position: 'relative',
                  flex: 1,
                  minWidth: 24,
                  borderRadius: 4,
                  padding: '12px 4px',
                  minHeight: 52,
                  background: !counted ? 'rgba(255,255,255,0.06)' : (fileOk ? cellColor : RED_GRAD),
                  opacity: counted ? 1 : 0.55,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.15), 0 1px 2px rgba(0,0,0,0.25)',
                  border: '1px solid rgba(0,0,0,0.18)',
                  cursor: 'pointer',
                  transition: 'transform 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                {counted && cornerDotWithLabel('tl', ttsOk, 'TTS', `TTS audio ${ttsOk ? 'ready' : `${ttsReadyCnt}/${count}`}`, `dot-tts-${kind}-${course.code.toLowerCase()}-${w}`)}
                {counted && cornerDotWithLabel('tr', fileOk, 'FILE', fileOk ? `${count} file${count === 1 ? '' : 's'} synced` : 'no file in OneDrive', `dot-file-${kind}-${course.code.toLowerCase()}-${w}`)}
                <div style={{ fontSize: 9, fontWeight: 800, color: '#fff', textAlign: 'center', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1, marginTop: 2 }}>
                  {kind === 'module' ? 'Module' : `Reading${rExempt ? '*' : ''}`}
                </div>
                {setTtsCounted && useToggle(counted, () => setTtsCounted(w, kind, !counted), `pipeline-toggle-tts-${kind}-${course.code.toLowerCase()}-${w}`)}
              </div>
            );
          };

          // ────────── Per-week TTS cell ──────────
          // Sits in the dedicated TTS strip below each folder row. Mirrors
          // renderWeekCell geometry so columns line up vertically.
          const renderTtsCell = (
            w: number,
            slot: { count: number; ttsReady: number } | undefined,
            kind: 'module' | 'reading',
          ) => {
            const count = slot?.count || 0;
            const ttsReady = slot?.ttsReady || 0;
            const cellTtsStatus: Status =
              count === 0 ? 'pending'
              : ttsReady === count ? 'ok'
              : ttsReady > 0 ? 'warning'
              : 'error';
            const c = STATUS_COLOR[cellTtsStatus];
            const hasFiles = count > 0;
            return (
              <div
                key={`tts-${w}`}
                onClick={(e) => { e.stopPropagation(); onOpenWizard('tts', { weekNum: w, uploadType: kind }); }}
                title={`Week ${w} · ${kind} TTS: ${hasFiles ? `${ttsReady}/${count} ready` : 'no files yet'}`}
                data-testid={`pipeline-tts-${kind}-${course.code.toLowerCase()}-${w}`}
                style={{
                  flex: 1,
                  minWidth: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  padding: '2px 2px',
                  borderRadius: 5,
                  background: hasFiles ? `${c}33` : 'rgba(255,255,255,0.05)',
                  opacity: hasFiles ? 1 : 0.55,
                  boxShadow: hasFiles
                    ? `inset 0 0 0 1px ${c}66, 0 1px 2px rgba(0,0,0,0.25)`
                    : 'none',
                  border: hasFiles ? `1px solid ${c}aa` : '1px dashed rgba(255,255,255,0.18)',
                  cursor: 'pointer',
                  transition: 'transform 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1 }}>W{w}</span>
                <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1 }}>
                  {hasFiles ? `${ttsReady}/${count}` : '—'}
                </span>
              </div>
            );
          };

          const orangeBoxStyle = (s: Status, slim = false): React.CSSProperties => ({
            flex: 1,
            borderRadius: 8,
            border: `1.5px solid ${STATUS_COLOR[s]}aa`,
            background: `linear-gradient(180deg, ${STATUS_COLOR[s]}1f 0%, ${STATUS_COLOR[s]}08 100%)`,
            boxShadow: `0 0 8px ${STATUS_GLOW[s]}`,
            padding: slim ? '2px 6px' : '6px 8px',
            display: 'flex',
            gap: 3,
            alignItems: 'stretch',
            minHeight: slim ? TTS_ROW_MIN_H : (ROW_MIN_H - 12),
            height: slim ? TTS_ROW_MIN_H : undefined,
          });

          return (
            <div style={{ position: 'relative', padding: '0 4%' }}>
              {/* ───── Top splitter: drops from Calendar Row, splits L+R.
                   Negative horizontal margin lets the right arm sit OUTSIDE
                   the orange-box content area (in the wrapper's padding
                   gutter) so it never cuts through a week cell. ───── */}
              <div style={{ position: 'relative', height: TOP_SPLIT_H, margin: '0 -4%' }}>
                {/* down from Calendar Row */}
                <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: TOP_BUS_Y, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}`, transform: 'translateX(-1px)' }} />
                {/* horizontal bus — extends right to where the arm drops in */}
                <div style={{ position: 'absolute', left: '4%', right: 12, top: TOP_BUS_Y, height: 2, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}` }} />
                {/* drops to Module chip on the LEFT */}
                <div style={{ position: 'absolute', left: '4%', top: TOP_BUS_Y, width: 2, height: TOP_SPLIT_H - TOP_BUS_Y, background: STATUS_COLOR[moduleFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[moduleFolderStatus]}` }} />
              </div>

              {/* ───── Module row: chip on LEFT, weeks orange-box on RIGHT ───── */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', minHeight: ROW_MIN_H }}>
                <NodeBox
                  label="Module Folder"
                  sublabel={moduleFolder || `${oneDrivePath}/Week N/Module/`}
                  Icon={Folder}
                  status={moduleFolderStatus}
                  pencil
                  pencilTitle="Update OneDrive path for weekly module folders"
                  pencilInitialValue={moduleFolder || ''}
                  pencilPlaceholder="/path/to/module/root"
                  onPencilSubmit={(v) => renameSemFolder('moduleFolder', v)}
                  onClick={() => onOpenWizard('module_folder' as any)}
                  width={170}
                  testId={`pipeline-module-folder-${course.code.toLowerCase()}`}
                />
                <div style={orangeBoxStyle(moduleFolderStatus)} data-testid={`pipeline-module-weeks-${course.code.toLowerCase()}`}>
                  {weekRange.map(w => renderWeekCell(w, courseHealth?.moduleWeeks?.[w], 'module'))}
                </div>
              </div>

              {/* tight intra-pair gap between Module Folder row and its TTS strip */}
              <div style={{ height: INTRA_PAIR_GAP }} />

              {/* ───── Module TTS strip (slim row, chip on LEFT). ───── */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: TTS_ROW_MIN_H, height: TTS_ROW_MIN_H }}>
                <NodeBox
                  label="TTS · Modules"
                  sublabel={moduleHasFiles ? `${modTtsReady}/${totalMod} ready (${modulePct}%)` : 'No files yet'}
                  Icon={Volume2}
                  status={moduleTtsStatus}
                  onClick={() => onOpenWizard('tts')}
                  width={170}
                  slim
                  testId={`pipeline-module-tts-${course.code.toLowerCase()}`}
                />
                <div style={orangeBoxStyle(moduleTtsStatus, true)} data-testid={`pipeline-module-tts-weeks-${course.code.toLowerCase()}`}>
                  {weekRange.map(w => renderTtsCell(w, courseHealth?.moduleWeeks?.[w], 'module'))}
                </div>
              </div>

              {/* gap between the module pair and the reading pair */}
              <div style={{ height: ROW_GAP }} />

              {/* Spacer where the pre-reading splitter used to live. The
                   right arm now lands directly on the Reading Folder
                   NodeBox below, so no horizontal bus is needed. */}
              <div style={{ height: PRE_READ_SPLIT_H }} />

              {/* ───── Reading row: weeks orange-box on LEFT, chip on RIGHT ───── */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch', minHeight: ROW_MIN_H }}>
                <div style={orangeBoxStyle(readingFolderStatus)} data-testid={`pipeline-reading-weeks-${course.code.toLowerCase()}`}>
                  {weekRange.map(w => renderWeekCell(w, courseHealth?.readingWeeks?.[w], 'reading'))}
                </div>
                <NodeBox
                  label="Reading Folder"
                  sublabel={readingFolder || `${oneDrivePath}/Week N/Reading/`}
                  Icon={Folder}
                  status={readingFolderStatus}
                  pencil
                  pencilTitle="Update OneDrive path for weekly reading folders"
                  pencilInitialValue={readingFolder || ''}
                  pencilPlaceholder="/path/to/reading/root"
                  onPencilSubmit={(v) => renameSemFolder('readingFolder', v)}
                  onClick={() => onOpenWizard('reading_folder' as any)}
                  width={170}
                  testId={`pipeline-reading-folder-${course.code.toLowerCase()}`}
                />
              </div>

              {/* tight intra-pair gap between Reading Folder row and its TTS strip */}
              <div style={{ height: INTRA_PAIR_GAP }} />

              {/* ───── Reading TTS strip (slim row, chip on RIGHT). ───── */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: TTS_ROW_MIN_H, height: TTS_ROW_MIN_H }}>
                <div style={orangeBoxStyle(readingTtsStatus, true)} data-testid={`pipeline-reading-tts-weeks-${course.code.toLowerCase()}`}>
                  {weekRange.map(w => renderTtsCell(w, courseHealth?.readingWeeks?.[w], 'reading'))}
                </div>
                <NodeBox
                  label="TTS · Readings"
                  sublabel={readingHasFiles ? `${readTtsReady}/${totalRead} ready (${readingPct}%)` : 'No files yet'}
                  Icon={Volume2}
                  status={readingTtsStatus}
                  onClick={() => onOpenWizard('tts')}
                  width={170}
                  slim
                  testId={`pipeline-reading-tts-${course.code.toLowerCase()}`}
                />
              </div>

              {/* ───── Right arm — drops from top H-bus down past the
                   module row + module TTS strip and lands on the TOP of
                   the Reading Folder NodeBox (right side chip of the
                   reading row). Aligned with the NodeBox horizontal
                   centre (170px wide, sitting flush against the wrapper's
                   right content edge). */}
              <div style={{
                position: 'absolute',
                right: 'calc(4% + 85px)',
                top: ARM_TOP,
                width: 2,
                height: ARM_HEIGHT,
                background: STATUS_COLOR[readingFolderStatus],
                boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}`,
                pointerEvents: 'none',
                transform: 'translateX(-1px)',
              }} />
            </div>
          );
        })()}

        {/* Merge into Sync — yellow drop ORIGINATES from the TTS · Readings
            NodeBox (the last stage in the reading pipeline before sync),
            then turns and runs centre-bottom into the Sync engine. */}
        <div style={{ position: 'relative', height: 18, margin: '4px 0' }}>
          {/* drop from TTS · Readings NodeBox bottom edge */}
          <div style={{ position: 'absolute', right: 'calc(4% + 85px)', top: 0, width: 2, height: 8, background: STATUS_COLOR[readingTtsStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingTtsStatus]}`, transform: 'translateX(-1px)' }} />
          {/* horizontal bus into the centre */}
          <div style={{ position: 'absolute', left: '50%', right: 'calc(4% + 85px)', top: 8, height: 2, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}` }} />
          {/* centre vertical into Sync */}
          <div style={{ position: 'absolute', left: '50%', top: 8, width: 2, height: 10, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}`, transform: 'translateX(-1px)' }} />
        </div>

        {/* ════════ SECTION: SYNC ════════ */}
        <SectionLabel>Sync Engine</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label="OneDrive Sync"
            sublabel={`${totalMod + totalRead} file${(totalMod + totalRead) === 1 ? '' : 's'} indexed from OneDrive`}
            Icon={RefreshCw}
            status={syncStatus}
            onClick={() => onOpenWizard('sync')}
            width={260}
            background="linear-gradient(135deg, #06b6d433 0%, #0e749022 100%)"
            testId={`pipeline-sync-${course.code.toLowerCase()}`}
          />
        </div>

        {/* Branch into calendar boxes */}
        <div style={{ position: 'relative', height: 22, margin: '4px 0' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 8, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}`, transform: 'translateX(-1px)' }} />
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 8, height: 2, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}` }} />
          <div style={{ position: 'absolute', left: '20%', top: 8, width: 2, height: 12, background: STATUS_COLOR[calModuleStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calModuleStatus]}` }} />
          <div style={{ position: 'absolute', right: '20%', top: 8, width: 2, height: 12, background: STATUS_COLOR[calReadingStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calReadingStatus]}` }} />
        </div>

        {/* ════════ SECTION: CALENDAR BOXES ════════ */}
        {/* Visual replicas of the actual calendar's Module / Reading boxes:
            square, solid course-Module / Reading color, "Module" / "Reading"
            label at the top, progress ring with TTS percent in the middle,
            file count below. Same info as the homework panel. */}
        <SectionLabel>Calendar Boxes</SectionLabel>
        {/* Module box anchors LEFT under the 20% wire-drop, Reading box
            anchors RIGHT under the 80% wire-drop, so the verticals from
            the merge bus above land on the box centers — instead of the
            two boxes bunching together in the middle of the section.
            Pulled UP 12px so the calendar boxes nestle closer to the
            sync-engine merge bus instead of drifting down. */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 calc(20% - 58px)', marginTop: -12 }}>
          {([
            { kind: 'module' as const, label: 'Module', bg: modColor, status: calModuleStatus, pct: modulePct, hasFiles: moduleHasFiles, total: totalMod, ready: modTtsReady, testId: `pipeline-calendar-module-${course.code.toLowerCase()}` },
            { kind: 'reading' as const, label: 'Reading', bg: readColor, status: calReadingStatus, pct: readingPct, hasFiles: readingHasFiles, total: totalRead, ready: readTtsReady, testId: `pipeline-calendar-reading-${course.code.toLowerCase()}` },
          ]).map(b => {
            // Auto-pick black or white text/ring based on box luminance, the
            // same rule the actual calendar boxes use (YIQ > 165 → black).
            const autoFg = (() => {
              try {
                const c = String(b.bg || '');
                let r = 0, g = 0, bl = 0, ok = false;
                const hm = c.match(/#([0-9a-fA-F]{6})/);
                if (hm) { r = parseInt(hm[1].substring(0, 2), 16); g = parseInt(hm[1].substring(2, 4), 16); bl = parseInt(hm[1].substring(4, 6), 16); ok = true; }
                if (!ok) { const rm = c.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/); if (rm) { r = parseInt(rm[1]); g = parseInt(rm[2]); bl = parseInt(rm[3]); ok = true; } }
                if (ok) return ((r * 299 + g * 587 + bl * 114) / 1000) > 165 ? '#000' : '#fff';
              } catch {}
              return '#fff';
            })();
            const fg = (course as any).courseFontColor || autoFg;
            const isWarn = b.status === 'warning' || b.status === 'error';
            const dotC = STATUS_COLOR[b.status];
            const size = 116;
            const circleSize = 46;
            const stroke = 4;
            const radius = (circleSize - stroke) / 2;
            const circumference = 2 * Math.PI * radius;
            const offset = circumference - (b.pct / 100) * circumference;
            return (
              <div
                key={b.kind}
                onClick={() => onOpenWizard('library')}
                title={isWarn ? `${b.label} — click to fix` : `${b.label} box`}
                data-testid={b.testId}
                style={{
                  position: 'relative',
                  width: size, height: size,
                  background: b.bg,
                  borderRadius: 6,
                  border: `1.5px solid ${dotC}aa`,
                  boxShadow: `0 0 0 1px rgba(255,255,255,0.06) inset, 0 4px 14px rgba(0,0,0,0.35), 0 0 8px ${STATUS_GLOW[b.status]}`,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  padding: '8px 6px',
                  transition: 'transform 120ms ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = ''; }}
              >
                {/* Status dot — pulses + clickable when warning/error */}
                <span
                  onClick={(e) => { if (isWarn) { e.stopPropagation(); onOpenWizard('library'); } }}
                  style={{
                    position: 'absolute', top: 5, right: 6, width: 9, height: 9, borderRadius: '50%',
                    background: dotC, boxShadow: `0 0 6px ${dotC}, 0 0 2px ${dotC}`,
                    cursor: isWarn ? 'pointer' : 'default',
                    animation: isWarn ? 'pipelinePulseDot 1.4s ease-in-out infinite' : undefined,
                    ['--pp-c' as any]: dotC,
                  }}
                  title={isWarn ? `${b.label} needs attention — click to fix` : `Status: ${b.status}`}
                />
                {/* Top label, mirrors the real "Module" / "Reading" caption */}
                <span style={{
                  position: 'absolute', top: 5, left: 0, right: 0,
                  textAlign: 'center', fontSize: 10, fontWeight: 500,
                  color: fg, letterSpacing: '0.5px',
                  fontFamily: "'Raleway', sans-serif",
                  textShadow: fg === '#fff' ? '0 1px 1px rgba(0,0,0,0.4)' : undefined,
                }}>
                  {b.label}
                </span>
                {/* Progress ring with TTS-ready percent inside */}
                <div style={{ position: 'relative', width: circleSize, height: circleSize, marginTop: 12 }}>
                  <svg width={circleSize} height={circleSize} style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none"
                      stroke={fg === '#000' ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.3)'}
                      strokeWidth={stroke}
                    />
                    {b.hasFiles && b.pct > 0 && (
                      <circle
                        cx={circleSize / 2} cy={circleSize / 2} r={radius} fill="none"
                        stroke={fg} strokeWidth={stroke} strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={offset}
                      />
                    )}
                  </svg>
                  <span style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: fg,
                    fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
                    letterSpacing: '-0.3px',
                  }}>
                    {b.hasFiles ? `${b.pct}%` : 'N/A'}
                  </span>
                </div>
                {/* File count caption underneath the ring */}
                <span style={{
                  marginTop: 6, fontSize: 9, fontWeight: 600, color: fg,
                  opacity: 0.9, fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  textShadow: fg === '#fff' ? '0 1px 1px rgba(0,0,0,0.4)' : undefined,
                }}>
                  {b.total} file{b.total === 1 ? '' : 's'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Merge into Library */}
        <div style={{ position: 'relative', height: 22, margin: '4px 0' }}>
          <div style={{ position: 'absolute', left: '20%', top: 0, width: 2, height: 10, background: STATUS_COLOR[calModuleStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calModuleStatus]}` }} />
          <div style={{ position: 'absolute', right: '20%', top: 0, width: 2, height: 10, background: STATUS_COLOR[calReadingStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calReadingStatus]}` }} />
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 10, height: 2, background: STATUS_COLOR[libraryStatus], boxShadow: `0 0 6px ${STATUS_GLOW[libraryStatus]}` }} />
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 2, height: 10, background: STATUS_COLOR[libraryStatus], boxShadow: `0 0 6px ${STATUS_GLOW[libraryStatus]}`, transform: 'translateX(-1px)' }} />
        </div>

        {/* ════════ SECTION: LIBRARY ════════ */}
        <SectionLabel>Library</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label="Library"
            sublabel={`${totalMod + totalRead} file${(totalMod + totalRead) === 1 ? '' : 's'} catalogued for course`}
            Icon={Library}
            status={libraryStatus}
            onClick={() => onOpenWizard('library')}
            width={180}
            background="linear-gradient(135deg, #6366f133 0%, #312e8122 100%)"
            testId={`pipeline-library-${course.code.toLowerCase()}`}
          />
        </div>

        {/* TTS readiness now lives ON each top-row week cell (the small
            colored bar inside the orange boxes), so the standalone TTS
            strip + its two flow lines are removed. Library feeds Storage
            directly. */}
        <FlowLine
          status={worst(libraryStatus, storageStatus)}
          onClick={() => onOpenWizard('storage')}
          title="Library files (with TTS audio) persist to storage"
          testId={`pipeline-line-library-storage-${course.code.toLowerCase()}`}
        />

        {/* ════════ SECTION: STORAGE ════════ */}
        <SectionLabel>Storage</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label="Storage"
            sublabel="Audio cache, TTS chunks, generated PDFs"
            Icon={Cloud}
            status={storageStatus}
            onClick={() => onOpenWizard('storage')}
            width={260}
            background="linear-gradient(135deg, #84cc1633 0%, #3f621222 100%)"
            testId={`pipeline-storage-${course.code.toLowerCase()}`}
          />
        </div>

        {/* ════════ SECTION: COURSE MATERIALS (side branch) ════════ */}
        <SectionLabel>Course Materials</SectionLabel>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {[
            { key: 'syllabus_folder', kind: 'syllabus' as const, label: 'Syllabus', s: sylStatus, Icon: FileText,
              sub: sylLinked ? 'PDF linked' : sylFolder ? 'Folder ok, no PDF' : 'No folder',
              currentPath: courseHealth?.syllabusPath || '',
              placeholder: '/School/1. TMU/Courses/.../Syllabus' },
            { key: 'assignments_folder', kind: 'assignments' as const, label: 'Assignments Folder', s: asgStatus, Icon: Folder,
              sub: asgFolder ? 'OneDrive folder ok' : 'Missing folder',
              currentPath: courseHealth?.assignmentsPath || '',
              placeholder: '/School/1. TMU/Courses/.../Assignments' },
            { key: 'textbook_folder', kind: 'textbook' as const, label: 'Textbook Folder', s: tbkStatus, Icon: BookOpen,
              sub: tbkFolder ? 'OneDrive folder ok' : 'Missing folder',
              currentPath: courseHealth?.textbookPath || '',
              placeholder: '/School/1. TMU/Courses/.../Textbook' },
          ].map(item => (
            <NodeBox
              key={item.label}
              label={item.label}
              sublabel={item.sub}
              Icon={item.Icon}
              status={item.s}
              onClick={() => onOpenWizard(item.key)}
              width={170}
              pencil
              pencilTitle={`Set OneDrive path for ${item.label}`}
              pencilInitialValue={item.currentPath}
              pencilPlaceholder={item.placeholder}
              onPencilSubmit={(v) => setSidePath(item.kind, v)}
              testId={`pipeline-side-${course.code.toLowerCase()}-${item.label.toLowerCase().replace(/\s/g,'-')}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
