import { useState, useRef, useEffect } from 'react';
import { Pencil, Folder, FileText, BookOpen, Volume2, Calendar, Cloud, RefreshCw, AlertCircle, CheckCircle2, Loader2, ExternalLink, Library, Settings } from 'lucide-react';
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
}

function NodeBox(props: NodeBoxProps) {
  const {
    label, sublabel, Icon, iconUrl, iconSize = 14, status = 'ok', pencil, pencilTitle, onClick,
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
  // Per-course colors used for the Module / Reading calendar boxes so they
  // visually match the actual calendar page.
  moduleBoxColor?: string;
  readingBoxColor?: string;
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
    moduleBoxColor, readingBoxColor,
    onOpenWizard, onOpenCourseDetails,
    onCourseFolderRenamed, onModuleFolderRenamed, onReadingFolderRenamed,
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
            label={odFolderName}
            sublabel={oneDrivePath}
            Icon={Folder}
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
            iconUrl={courseDetailsFolderIcon}
            iconSize={18}
            status={editDetailsStatus}
            onClick={onOpenCourseDetails}
            width={300}
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
          const ROW_MIN_H = 60;
          const ROW_GAP = 10;
          const PRE_READ_SPLIT_H = 18;
          const TOP_BUS_Y = 6;             // y of the top H-bus inside the splitter
          const PRE_READ_BUS_Y = 12;       // y of the H-bus inside the pre-read splitter
          const ARM_TOP = TOP_BUS_Y;       // wrapper-relative
          const ARM_BOTTOM_Y = TOP_SPLIT_H + ROW_MIN_H + ROW_GAP + PRE_READ_BUS_Y;
          const ARM_HEIGHT = ARM_BOTTOM_Y - ARM_TOP;

          // Builds a single week cell that lives inside one of the orange boxes.
          // Status comes from per-week count (file present?) and the cell is
          // tinted with the course's Module or Reading color when populated.
          const renderWeekCell = (
            w: number,
            slot: { count: number; ttsReady: number } | undefined,
            kind: 'module' | 'reading',
          ) => {
            const count = slot?.count || 0;
            const ttsReady = slot?.ttsReady || 0;
            const cellColor = kind === 'module' ? modColor : readColor;
            const ok = count > 0;
            return (
              <div
                key={w}
                onClick={(e) => { e.stopPropagation(); onOpenWizard(kind === 'module' ? 'module_folder' : 'reading_folder', { weekNum: w, uploadType: kind }); }}
                title={`Week ${w} · ${kind}: ${count} file${count === 1 ? '' : 's'} indexed${count > 0 ? ` · TTS ${ttsReady}/${count}` : ''}`}
                data-testid={`pipeline-week-${kind}-${course.code.toLowerCase()}-${w}`}
                style={{
                  flex: 1,
                  minWidth: 24,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  padding: '4px 2px',
                  borderRadius: 5,
                  background: ok ? cellColor : 'rgba(255,255,255,0.05)',
                  opacity: ok ? 1 : 0.55,
                  boxShadow: ok
                    ? 'inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.18), 0 1px 2px rgba(0,0,0,0.25)'
                    : 'none',
                  border: ok ? '1px solid rgba(0,0,0,0.18)' : '1px dashed rgba(255,255,255,0.18)',
                  cursor: 'pointer',
                  transition: 'transform 120ms ease',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
              >
                <span style={{ fontSize: 8, fontWeight: 700, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1 }}>W{w}</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.7)', lineHeight: 1 }}>{count}</span>
                {ok && ttsReady === count && (
                  <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 3px #10b981' }} title="TTS ready" />
                )}
              </div>
            );
          };

          const orangeBoxStyle = (s: Status): React.CSSProperties => ({
            flex: 1,
            borderRadius: 8,
            border: `1.5px solid ${STATUS_COLOR[s]}aa`,
            background: `linear-gradient(180deg, ${STATUS_COLOR[s]}1f 0%, ${STATUS_COLOR[s]}08 100%)`,
            boxShadow: `0 0 8px ${STATUS_GLOW[s]}`,
            padding: '6px 8px',
            display: 'flex',
            gap: 3,
            alignItems: 'stretch',
            minHeight: ROW_MIN_H - 12,
          });

          return (
            <div style={{ position: 'relative', padding: '0 4%' }}>
              {/* ───── Top splitter: drops from Calendar Row, splits L+R ───── */}
              <div style={{ position: 'relative', height: TOP_SPLIT_H }}>
                {/* down from Calendar Row */}
                <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: TOP_BUS_Y, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}`, transform: 'translateX(-1px)' }} />
                {/* horizontal bus */}
                <div style={{ position: 'absolute', left: '4%', right: '4%', top: TOP_BUS_Y, height: 2, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}` }} />
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

              {/* gap between the two rows */}
              <div style={{ height: ROW_GAP }} />

              {/* ───── Pre-reading splitter: H-bus + drop into Reading chip ───── */}
              <div style={{ position: 'relative', height: PRE_READ_SPLIT_H }}>
                {/* horizontal bus */}
                <div style={{ position: 'absolute', left: '4%', right: '4%', top: PRE_READ_BUS_Y, height: 2, background: STATUS_COLOR[readingFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}` }} />
                {/* drops to Reading chip on the RIGHT */}
                <div style={{ position: 'absolute', right: '4%', top: PRE_READ_BUS_Y, width: 2, height: PRE_READ_SPLIT_H - PRE_READ_BUS_Y, background: STATUS_COLOR[readingFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}` }} />
              </div>

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

              {/* ───── Right arm — runs from top splitter H-bus all the way
                   down past the module row into the pre-reading H-bus,
                   delivering the "right-turn" branch to the reading row. */}
              <div style={{
                position: 'absolute',
                right: 'calc(4% + 4%)',  // matches the H-bus right endpoint inside the wrapper's 4% padding
                top: ARM_TOP,
                width: 2,
                height: ARM_HEIGHT,
                background: STATUS_COLOR[readingFolderStatus],
                boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}`,
                pointerEvents: 'none',
              }} />
            </div>
          );
        })()}

        {/* Merge into Sync — short vertical from reading row down to Sync */}
        <div style={{ position: 'relative', height: 18, margin: '4px 0' }}>
          <div style={{ position: 'absolute', right: 'calc(4% + 4%)', top: 0, width: 2, height: 8, background: STATUS_COLOR[readingFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}` }} />
          <div style={{ position: 'absolute', left: 'calc(4% + 4%)', right: 'calc(4% + 4%)', top: 8, height: 2, background: STATUS_COLOR[syncStatus], boxShadow: `0 0 6px ${STATUS_GLOW[syncStatus]}` }} />
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
        {/* Mirror the actual calendar page: solid course-Module / Reading
            color, soft inner highlight + outer shadow, FILE-style label. */}
        <SectionLabel>Calendar Boxes</SectionLabel>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '0 6%' }}>
          <NodeBox
            label="Calendar Module Box"
            sublabel={`${totalMod} module file${totalMod === 1 ? '' : 's'} on calendar`}
            Icon={FileText}
            status={calModuleStatus}
            onClick={() => onOpenWizard('library')}
            width={210}
            background={`linear-gradient(180deg, ${modColor} 0%, ${modColor}cc 100%)`}
            testId={`pipeline-calendar-module-${course.code.toLowerCase()}`}
          />
          <NodeBox
            label="Calendar Reading Box"
            sublabel={`${totalRead} reading file${totalRead === 1 ? '' : 's'} on calendar`}
            Icon={BookOpen}
            status={calReadingStatus}
            onClick={() => onOpenWizard('library')}
            width={210}
            background={`linear-gradient(180deg, ${readColor} 0%, ${readColor}cc 100%)`}
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
              width: '92%',
              margin: '0 auto',
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
