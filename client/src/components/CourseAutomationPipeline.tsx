import { useState, useRef, useEffect } from 'react';
import { Pencil, Folder, FileText, BookOpen, Volume2, Calendar, Cloud, RefreshCw, AlertCircle, CheckCircle2, Loader2, ExternalLink } from 'lucide-react';

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
}

function NodeBox(props: NodeBoxProps) {
  const {
    label, sublabel, Icon, status = 'ok', pencil, pencilTitle, onClick,
    onPencilClick, onPencilSubmit, pencilInitialValue = '', pencilPlaceholder,
    width = 150, background, testId,
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
        minHeight: 50,
        padding: '8px 10px',
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
        style={{
          position: 'absolute', top: 5, right: 6, width: 8, height: 8, borderRadius: '50%',
          background: dotColor, boxShadow: `0 0 6px ${dotColor}, 0 0 2px ${dotColor}`,
        }}
        title={`Status: ${status}`}
      />
      {Icon && <Icon style={{ width: 14, height: 14, color: '#e2e8f0', flexShrink: 0 }} />}
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
  return (
    <div
      onClick={(e) => { if (onClick) { e.stopPropagation(); onClick(); } }}
      title={title}
      data-testid={testId}
      style={{
        height, width: 2, margin: '0 auto', background: color,
        boxShadow: `0 0 6px ${STATUS_GLOW[status]}`,
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
      }}
    >
      {/* widen click target */}
      {onClick && <div style={{ position: 'absolute', inset: '-2px -8px', cursor: 'pointer' }} />}
    </div>
  );
}

interface CourseAutomationPipelineProps {
  course: { code: string; name?: string; fullName?: string; color?: string };
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
  onOpenWizard: (issueKey: string, opts?: { weekNum?: number; uploadType?: 'module' | 'reading' }) => void;
  onOpenCourseDetails: () => void;
  onCourseFolderRenamed?: () => void;
  onModuleFolderRenamed?: () => void;
  onReadingFolderRenamed?: () => void;
}

export function CourseAutomationPipeline(props: CourseAutomationPipelineProps) {
  const {
    course, courseHealth, semesterId, courseSlot, oneDrivePath, displayName,
    moduleFolder, readingFolder, numberOfWeeks,
    firstWeek: propFirstWeek, lastWeek: propLastWeek,
    onOpenWizard, onOpenCourseDetails,
    onCourseFolderRenamed, onModuleFolderRenamed, onReadingFolderRenamed,
  } = props;
  const firstWeek = Math.max(1, propFirstWeek ?? 1);
  const lastWeek = Math.max(firstWeek, Math.min(numberOfWeeks, propLastWeek ?? numberOfWeeks));

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

  // Per-week TTS data (Module + Reading combined per week).
  const weekRange: number[] = [];
  for (let w = firstWeek; w <= lastWeek; w++) weekRange.push(w);
  const weekTts = weekRange.map(w => {
    const mw = courseHealth?.moduleWeeks?.[w] || { count: 0, ttsReady: 0 };
    const rw = courseHealth?.readingWeeks?.[w] || { count: 0, ttsReady: 0 };
    const count = (mw.count || 0) + (rw.count || 0);
    const ready = (mw.ttsReady || 0) + (rw.ttsReady || 0);
    let s: Status;
    if (count === 0) s = 'pending';
    else if (ready === count) s = 'ok';
    else if (ready > 0) s = 'warning';
    else s = 'error';
    return { week: w, count, ready, s };
  });

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
    { label: 'Syllabus', s: sylStatus, click: () => onOpenWizard(sylFolder ? 'syllabus' : 'syllabus_folder') },
    { label: 'Assignments', s: asgStatus, click: () => onOpenWizard('assignments') },
    { label: 'Textbook', s: tbkStatus, click: () => onOpenWizard('textbook') },
  ];

  return (
    <div style={{ position: 'relative' }}>
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
            label="Course Folder"
            sublabel={oneDrivePath}
            Icon={Folder}
            status={courseFolderStatus}
            pencil
            pencilTitle="Rename course folder in OneDrive"
            pencilInitialValue={course.fullName || course.name || ''}
            pencilPlaceholder="e.g. CPPA122 - Politics"
            onPencilSubmit={renameCourseFolder}
            onClick={() => onOpenWizard('onedrive')}
            width={260}
            testId={`pipeline-course-folder-${course.code.toLowerCase()}`}
          />
        </div>

        <FlowLine
          status={worst(courseFolderStatus, editDetailsStatus)}
          onClick={() => onOpenWizard('onedrive')}
          title="Course folder → details linkage"
          testId={`pipeline-line-folder-details-${course.code.toLowerCase()}`}
        />

        {/* ════════ SECTION: COURSE METADATA ════════ */}
        <SectionLabel>Course Metadata</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label="Edit Course Details"
            sublabel="Name, professor, color, ranks"
            Icon={ExternalLink}
            status={editDetailsStatus}
            onClick={onOpenCourseDetails}
            width={260}
            testId={`pipeline-edit-details-${course.code.toLowerCase()}`}
          />
        </div>

        <FlowLine
          status={displayNameStatus}
          onClick={onOpenCourseDetails}
          title="Display name flows into the calendar row label"
          testId={`pipeline-line-details-row-${course.code.toLowerCase()}`}
        />

        {/* ════════ SECTION: CALENDAR HEADER ════════ */}
        <SectionLabel>Calendar Header Row</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label={`Calendar Row: ${displayName || course.code}`}
            sublabel="Header label on every weekly calendar row"
            Icon={Calendar}
            status={displayNameStatus}
            onClick={onOpenCourseDetails}
            width={300}
            background={`linear-gradient(180deg, ${course.color || '#3b82f6'}33 0%, ${course.color || '#3b82f6'}11 100%)`}
            testId={`pipeline-calendar-row-${course.code.toLowerCase()}`}
          />
        </div>

        {/* Branch into Module & Reading paths */}
        <div style={{ position: 'relative', height: 22, margin: '4px 0' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 8, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}`, transform: 'translateX(-1px)' }} />
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 8, height: 2, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}` }} />
          <div style={{ position: 'absolute', left: '20%', top: 8, width: 2, height: 12, background: STATUS_COLOR[moduleFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[moduleFolderStatus]}` }} />
          <div style={{ position: 'absolute', right: '20%', top: 8, width: 2, height: 12, background: STATUS_COLOR[readingFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}` }} />
        </div>

        {/* ════════ SECTION: WEEKLY CONTENT FOLDERS ════════ */}
        <SectionLabel>Weekly Content Folders</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0 6%' }}>
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
            width={210}
            testId={`pipeline-module-folder-${course.code.toLowerCase()}`}
          />
          <NodeBox
            label="Reading Folder"
            sublabel={readingFolder || `${oneDrivePath}/Week N/Reading/`}
            Icon={BookOpen}
            status={readingFolderStatus}
            pencil
            pencilTitle="Update OneDrive path for weekly reading folders"
            pencilInitialValue={readingFolder || ''}
            pencilPlaceholder="/path/to/reading/root"
            onPencilSubmit={(v) => renameSemFolder('readingFolder', v)}
            onClick={() => onOpenWizard('reading_folder' as any)}
            width={210}
            testId={`pipeline-reading-folder-${course.code.toLowerCase()}`}
          />
        </div>

        {/* Merge into Sync */}
        <div style={{ position: 'relative', height: 22, margin: '4px 0' }}>
          <div style={{ position: 'absolute', left: '20%', top: 0, width: 2, height: 10, background: STATUS_COLOR[moduleFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[moduleFolderStatus]}` }} />
          <div style={{ position: 'absolute', right: '20%', top: 0, width: 2, height: 10, background: STATUS_COLOR[readingFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}` }} />
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 10, height: 2, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}` }} />
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 2, height: 10, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}`, transform: 'translateX(-1px)' }} />
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
        <SectionLabel>Calendar Boxes</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0 6%' }}>
          <NodeBox
            label="Calendar Module Box"
            sublabel={`${totalMod} module file${totalMod === 1 ? '' : 's'} indexed`}
            Icon={FileText}
            status={calModuleStatus}
            onClick={() => onOpenWizard('library')}
            width={210}
            background="linear-gradient(135deg, #3b82f633 0%, #1e3a8a22 100%)"
            testId={`pipeline-calendar-module-${course.code.toLowerCase()}`}
          />
          <NodeBox
            label="Calendar Reading Box"
            sublabel={`${totalRead} reading file${totalRead === 1 ? '' : 's'} indexed`}
            Icon={BookOpen}
            status={calReadingStatus}
            onClick={() => onOpenWizard('library')}
            width={210}
            background="linear-gradient(135deg, #a855f733 0%, #581c8722 100%)"
            testId={`pipeline-calendar-reading-${course.code.toLowerCase()}`}
          />
        </div>

        {/* Merge into Library */}
        <div style={{ position: 'relative', height: 22, margin: '4px 0' }}>
          <div style={{ position: 'absolute', left: '20%', top: 0, width: 2, height: 10, background: STATUS_COLOR[calModuleStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calModuleStatus]}` }} />
          <div style={{ position: 'absolute', right: '20%', top: 0, width: 2, height: 10, background: STATUS_COLOR[calReadingStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calReadingStatus]}` }} />
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 10, height: 2, background: STATUS_COLOR[libraryStatus], boxShadow: `0 0 6px ${STATUS_GLOW[libraryStatus]}` }} />
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 2, height: 10, background: STATUS_COLOR[libraryStatus], boxShadow: `0 0 6px ${STATUS_GLOW[libraryStatus]}`, transform: 'translateX(-1px)' }} />
        </div>

        {/* ════════ SECTION: FILE LIBRARY ════════ */}
        <SectionLabel>File Library</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <NodeBox
            label="File Library"
            sublabel={`${totalMod + totalRead} file${(totalMod + totalRead) === 1 ? '' : 's'} catalogued for course`}
            Icon={FileText}
            status={libraryStatus}
            onClick={() => onOpenWizard('library')}
            width={260}
            background="linear-gradient(135deg, #6366f133 0%, #312e8122 100%)"
            testId={`pipeline-library-${course.code.toLowerCase()}`}
          />
        </div>

        <FlowLine
          status={worst(libraryStatus, ttsStatus)}
          onClick={() => onOpenWizard('tts')}
          title="Library files feed the TTS pipeline"
          testId={`pipeline-line-library-tts-${course.code.toLowerCase()}`}
        />

        {/* ════════ SECTION: TTS PIPELINE (per week) ════════ */}
        <SectionLabel>{`TTS Pipeline · W${firstWeek}–W${lastWeek}`}</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            onClick={(e) => { e.stopPropagation(); onOpenWizard('tts'); }}
            style={{
              width: '96%',
              padding: '8px 10px',
              borderRadius: 10,
              background: 'linear-gradient(180deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.25) 100%)',
              border: `1.5px solid ${STATUS_COLOR[ttsStatus]}66`,
              boxShadow: `0 0 10px ${STATUS_GLOW[ttsStatus]}`,
              cursor: 'pointer',
            }}
            data-testid={`pipeline-tts-strip-${course.code.toLowerCase()}`}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Volume2 style={{ width: 13, height: 13, color: '#fff' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>TTS Pipeline</span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', fontFamily: 'JetBrains Mono, monospace' }}>
                {ttsReady} / {ttsNeeded} files ready · {weekRange.length} week{weekRange.length === 1 ? '' : 's'}
              </span>
              <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[ttsStatus], boxShadow: `0 0 6px ${STATUS_COLOR[ttsStatus]}` }} />
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {weekTts.map(({ week, count, ready, s }) => (
                <div
                  key={week}
                  title={`Week ${week}: ${ready}/${count} ready`}
                  onClick={(e) => { e.stopPropagation(); onOpenWizard('tts', { weekNum: week }); }}
                  style={{
                    flex: 1,
                    height: 10,
                    borderRadius: 3,
                    background: STATUS_COLOR[s],
                    boxShadow: `0 0 4px ${STATUS_GLOW[s]}`,
                    opacity: s === 'pending' ? 0.45 : 1,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
              {weekTts.map(({ week }) => (
                <span
                  key={week}
                  style={{
                    flex: 1,
                    textAlign: 'center',
                    fontSize: 8,
                    color: 'rgba(255,255,255,0.55)',
                    fontFamily: 'JetBrains Mono, monospace',
                  }}
                >
                  W{week}
                </span>
              ))}
            </div>
          </div>
        </div>

        <FlowLine
          status={ttsStatus}
          onClick={() => onOpenWizard('storage')}
          title="TTS audio + cached files persist to storage"
          testId={`pipeline-line-tts-storage-${course.code.toLowerCase()}`}
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
            { key: sylFolder ? 'syllabus' : 'syllabus_folder', label: 'Syllabus', s: sylStatus, Icon: FileText, sub: sylLinked ? 'PDF linked' : sylFolder ? 'Folder ok, no PDF' : 'No folder' },
            { key: 'assignments', label: 'Assignments Folder', s: asgStatus, Icon: Folder, sub: asgFolder ? 'OneDrive folder ok' : 'Missing folder' },
            { key: 'textbook', label: 'Textbook Folder', s: tbkStatus, Icon: BookOpen, sub: tbkFolder ? 'OneDrive folder ok' : 'Missing folder' },
          ].map(item => (
            <NodeBox
              key={item.label}
              label={item.label}
              sublabel={item.sub}
              Icon={item.Icon}
              status={item.s}
              onClick={() => onOpenWizard(item.key)}
              width={170}
              testId={`pipeline-side-${course.code.toLowerCase()}-${item.label.toLowerCase().replace(/\s/g,'-')}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
