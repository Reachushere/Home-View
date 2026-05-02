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
    onOpenWizard, onOpenCourseDetails,
    onCourseFolderRenamed, onModuleFolderRenamed, onReadingFolderRenamed,
  } = props;

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
        {/* Row 1: Course Folder (root in OneDrive) */}
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
            onClick={() => onOpenWizard(odLinked ? 'onedrive' : 'onedrive')}
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

        {/* Row 2: Edit Course Details (opens dialog) */}
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

        {/* Row 3: Display Name → Calendar row label */}
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
          {/* central down stub */}
          <div style={{ position: 'absolute', left: '50%', top: 0, width: 2, height: 8, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}`, transform: 'translateX(-1px)' }} />
          {/* horizontal */}
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 8, height: 2, background: STATUS_COLOR[worst(moduleFolderStatus, readingFolderStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(moduleFolderStatus, readingFolderStatus)]}` }} />
          {/* left down */}
          <div style={{ position: 'absolute', left: '20%', top: 8, width: 2, height: 12, background: STATUS_COLOR[moduleFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[moduleFolderStatus]}` }} />
          {/* right down */}
          <div style={{ position: 'absolute', right: '20%', top: 8, width: 2, height: 12, background: STATUS_COLOR[readingFolderStatus], boxShadow: `0 0 6px ${STATUS_GLOW[readingFolderStatus]}` }} />
        </div>

        {/* Row 4: Module Folder + Reading Folder (with pencil rename) */}
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

        {/* Connector lines into calendar boxes */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 calc(6% + 100px)' }}>
          <FlowLine status={worst(moduleFolderStatus, calModuleStatus)} onClick={() => onOpenWizard('sync')} title="Module folder syncs into calendar Module box" />
          <FlowLine status={worst(readingFolderStatus, calReadingStatus)} onClick={() => onOpenWizard('sync')} title="Reading folder syncs into calendar Reading box" />
        </div>

        {/* Row 5: Calendar Module Box + Calendar Reading Box */}
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

        {/* merge back to TTS */}
        <div style={{ position: 'relative', height: 22, margin: '4px 0' }}>
          <div style={{ position: 'absolute', left: '20%', top: 0, width: 2, height: 12, background: STATUS_COLOR[calModuleStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calModuleStatus]}` }} />
          <div style={{ position: 'absolute', right: '20%', top: 0, width: 2, height: 12, background: STATUS_COLOR[calReadingStatus], boxShadow: `0 0 6px ${STATUS_GLOW[calReadingStatus]}` }} />
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: 12, height: 2, background: STATUS_COLOR[worst(calModuleStatus, calReadingStatus)], boxShadow: `0 0 6px ${STATUS_GLOW[worst(calModuleStatus, calReadingStatus)]}` }} />
          <div style={{ position: 'absolute', left: '50%', top: 12, width: 2, height: 10, background: STATUS_COLOR[ttsStatus], boxShadow: `0 0 6px ${STATUS_GLOW[ttsStatus]}`, transform: 'translateX(-1px)' }} />
        </div>

        {/* Row 6: TTS Pipeline (8-step compact strip) */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            onClick={(e) => { e.stopPropagation(); onOpenWizard('tts'); }}
            style={{
              width: '92%',
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
                {ttsReady} / {ttsNeeded} files ready
              </span>
              <span style={{ marginLeft: 'auto', width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[ttsStatus], boxShadow: `0 0 6px ${STATUS_COLOR[ttsStatus]}` }} />
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {['Queue', 'Detect', 'Extract', 'Chunk', 'Synth', 'Stitch', 'Persist', 'Verify'].map((step, i) => {
                // Approximate per-step state: green up to ratio of ready/needed.
                const ratio = ttsNeeded > 0 ? ttsReady / ttsNeeded : 1;
                const filled = ratio >= (i + 1) / 8;
                const partial = !filled && ratio > i / 8;
                const segStatus: Status = filled ? 'ok' : partial ? 'warning' : ttsNeeded === 0 ? 'pending' : 'error';
                return (
                  <div
                    key={step}
                    title={step}
                    style={{
                      flex: 1,
                      height: 6,
                      borderRadius: 3,
                      background: STATUS_COLOR[segStatus],
                      boxShadow: `0 0 4px ${STATUS_GLOW[segStatus]}`,
                      opacity: segStatus === 'pending' ? 0.5 : 1,
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {['Q','D','X','C','S','T','P','V'].map((s, i) => (
                <span key={i} style={{ fontSize: 8, color: 'rgba(255,255,255,0.45)', fontFamily: 'JetBrains Mono, monospace' }}>{s}</span>
              ))}
            </div>
          </div>
        </div>

        {/* Side branch: Syllabus / Assignments / Textbook (small chips, clickable) */}
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
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
