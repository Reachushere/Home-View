import { useState, useMemo } from 'react';
import { X, ChevronUp, ChevronDown, AlertTriangle, AlertCircle, CheckCircle2, Circle, Wrench, ArrowRight, Trash2 } from 'lucide-react';

const TRIGGER_TYPES = [
  { value: 'time', label: 'Time', icon: '🕐', desc: 'At a specific time' },
  { value: 'state', label: 'State Change', icon: '🔄', desc: 'When a device changes' },
  { value: 'sun', label: 'Sun', icon: '☀️', desc: 'At sunrise or sunset' },
  { value: 'interval', label: 'Interval', icon: '⏱️', desc: 'Every X minutes/hours' },
  { value: 'webhook', label: 'Webhook', icon: '🔗', desc: 'External HTTP trigger' },
];
const CONDITION_TYPES = [
  { value: 'state', label: 'State', icon: '🎯', desc: 'Device is in a state' },
  { value: 'time', label: 'Time Window', icon: '⏰', desc: 'Only during time range' },
  { value: 'day', label: 'Day of Week', icon: '📅', desc: 'Only on certain days' },
];
const ACTION_TYPES = [
  { value: 'call_service', label: 'Call Service', icon: '⚡', desc: 'Call a HA service' },
  { value: 'delay', label: 'Delay', icon: '⏳', desc: 'Wait before next action' },
  { value: 'announce', label: 'Announce', icon: '🔊', desc: 'Send Alexa announcement' },
  { value: 'condition_check', label: 'Condition Check', icon: '🔀', desc: 'Continue only if met' },
];
const HA_DOMAINS = ['light', 'switch', 'media_player', 'climate', 'cover', 'fan', 'lock', 'alarm_control_panel', 'automation', 'scene', 'script', 'input_boolean', 'input_number', 'timer', 'counter', 'notify'];
const DAYS = [{ v: 'mon', l: 'Mon' }, { v: 'tue', l: 'Tue' }, { v: 'wed', l: 'Wed' }, { v: 'thu', l: 'Thu' }, { v: 'fri', l: 'Fri' }, { v: 'sat', l: 'Sat' }, { v: 'sun', l: 'Sun' }];

type StepKey = 'name' | 'triggers' | 'conditions' | 'actions' | 'review';
type Severity = 'error' | 'warning';
interface Issue {
  step: StepKey;
  itemIdx?: number;
  field?: string;
  severity: Severity;
  message: string;
  fix?: { label: string; apply: () => void };
}

interface AutomationEditorProps {
  editingId: number | null;
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  triggers: any[];
  setTriggers: (v: any[]) => void;
  conditions: any[];
  setConditions: (v: any[]) => void;
  actions: any[];
  setActions: (v: any[]) => void;
  haEntities: any[];
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  accentColor?: string;
}

export function AutomationEditor(props: AutomationEditorProps) {
  const { editingId, name, setName, description, setDescription, triggers, setTriggers, conditions, setConditions, actions, setActions, haEntities, onSave, onCancel, isSaving, accentColor = '#60a5fa' } = props;
  const [activeStep, setActiveStep] = useState<StepKey>('triggers');
  const [issuesOpen, setIssuesOpen] = useState(false);

  const knownEntityIds = useMemo(() => new Set(haEntities.map((e: any) => e.entityId)), [haEntities]);

  const updateTrigger = (i: number, patch: any) => { const u = [...triggers]; u[i] = { ...u[i], ...patch }; setTriggers(u); };
  const updateCondition = (i: number, patch: any) => { const u = [...conditions]; u[i] = { ...u[i], ...patch }; setConditions(u); };
  const updateAction = (i: number, patch: any) => { const u = [...actions]; u[i] = { ...u[i], ...patch }; setActions(u); };

  const issues: Issue[] = useMemo(() => {
    const out: Issue[] = [];
    if (!name.trim()) out.push({ step: 'name', field: 'name', severity: 'error', message: 'Automation name is required.', fix: { label: 'Use "Untitled Automation"', apply: () => setName('Untitled Automation') } });
    if (name.trim().length > 80) out.push({ step: 'name', field: 'name', severity: 'warning', message: 'Name is unusually long (>80 chars).', fix: { label: 'Truncate to 80', apply: () => setName(name.trim().slice(0, 80)) } });

    if (triggers.length === 0) out.push({ step: 'triggers', severity: 'error', message: 'At least one trigger is required.', fix: { label: 'Add a Sun trigger', apply: () => setTriggers([{ type: 'sun', value: 'sunset' }]) } });

    triggers.forEach((t, i) => {
      if (t.type === 'time' && !t.value) out.push({ step: 'triggers', itemIdx: i, field: 'value', severity: 'error', message: `Trigger ${i + 1}: time value is required.`, fix: { label: 'Set to 09:00', apply: () => updateTrigger(i, { value: '09:00' }) } });
      if (t.type === 'state') {
        if (!t.entityId) out.push({ step: 'triggers', itemIdx: i, field: 'entityId', severity: 'error', message: `Trigger ${i + 1}: select an entity.`, fix: haEntities[0] ? { label: `Use ${haEntities[0].friendlyName}`, apply: () => updateTrigger(i, { entityId: haEntities[0].entityId }) } : undefined });
        else if (!knownEntityIds.has(t.entityId)) out.push({ step: 'triggers', itemIdx: i, field: 'entityId', severity: 'warning', message: `Trigger ${i + 1}: entity "${t.entityId}" not found in Home Assistant.`, fix: { label: 'Clear entity', apply: () => updateTrigger(i, { entityId: '' }) } });
        if (!t.state || !String(t.state).trim()) out.push({ step: 'triggers', itemIdx: i, field: 'state', severity: 'warning', message: `Trigger ${i + 1}: no target state — will fire on ANY change.` });
      }
      if (t.type === 'sun' && !t.value) updateTrigger(i, { value: 'sunrise' });
      if (t.type === 'interval') {
        const n = parseInt(t.value);
        if (!n || n < 1) out.push({ step: 'triggers', itemIdx: i, field: 'value', severity: 'error', message: `Trigger ${i + 1}: interval must be at least 1.`, fix: { label: 'Set to 30', apply: () => updateTrigger(i, { value: 30 }) } });
      }
      if (t.type === 'webhook') {
        if (!t.value || !String(t.value).trim()) out.push({ step: 'triggers', itemIdx: i, field: 'value', severity: 'error', message: `Trigger ${i + 1}: webhook ID is required.` });
        else if (/[\s]/.test(String(t.value))) out.push({ step: 'triggers', itemIdx: i, field: 'value', severity: 'warning', message: `Trigger ${i + 1}: webhook ID contains spaces.`, fix: { label: 'Strip spaces', apply: () => updateTrigger(i, { value: String(t.value).replace(/\s+/g, '_') }) } });
      }
    });

    conditions.forEach((c, i) => {
      if (c.type === 'state') {
        if (!c.entityId) out.push({ step: 'conditions', itemIdx: i, field: 'entityId', severity: 'error', message: `Condition ${i + 1}: select an entity.` });
        else if (!knownEntityIds.has(c.entityId)) out.push({ step: 'conditions', itemIdx: i, field: 'entityId', severity: 'warning', message: `Condition ${i + 1}: entity "${c.entityId}" not found.` });
        if (!c.state) out.push({ step: 'conditions', itemIdx: i, field: 'state', severity: 'error', message: `Condition ${i + 1}: target state is required.` });
      }
      if (c.type === 'time') {
        if (!c.after && !c.before) out.push({ step: 'conditions', itemIdx: i, severity: 'error', message: `Condition ${i + 1}: set "after" or "before" time.` });
      }
      if (c.type === 'day') {
        if (!Array.isArray(c.days) || c.days.length === 0) out.push({ step: 'conditions', itemIdx: i, field: 'days', severity: 'error', message: `Condition ${i + 1}: pick at least one day.`, fix: { label: 'Pick weekdays', apply: () => updateCondition(i, { days: ['mon', 'tue', 'wed', 'thu', 'fri'] }) } });
      }
    });

    if (actions.length === 0) out.push({ step: 'actions', severity: 'error', message: 'At least one action is required.', fix: { label: 'Add an Announce action', apply: () => setActions([{ type: 'announce', message: 'Automation triggered.' }]) } });

    actions.forEach((a, i) => {
      if (a.type === 'call_service') {
        if (!a.domain) out.push({ step: 'actions', itemIdx: i, field: 'domain', severity: 'error', message: `Action ${i + 1}: pick a domain.` });
        if (!a.service || !String(a.service).trim()) out.push({ step: 'actions', itemIdx: i, field: 'service', severity: 'error', message: `Action ${i + 1}: service is required.`, fix: a.domain === 'light' || a.domain === 'switch' ? { label: 'Use "turn_on"', apply: () => updateAction(i, { service: 'turn_on' }) } : undefined });
        if (a.entityId && !knownEntityIds.has(a.entityId)) out.push({ step: 'actions', itemIdx: i, field: 'entityId', severity: 'warning', message: `Action ${i + 1}: entity "${a.entityId}" not found.`, fix: { label: 'Clear entity', apply: () => updateAction(i, { entityId: '' }) } });
      }
      if (a.type === 'delay') {
        const n = parseInt(a.delay);
        if (!n || n < 1) out.push({ step: 'actions', itemIdx: i, field: 'delay', severity: 'error', message: `Action ${i + 1}: delay must be at least 1 second.`, fix: { label: 'Set to 5', apply: () => updateAction(i, { delay: 5 }) } });
        else if (n > 3600) out.push({ step: 'actions', itemIdx: i, field: 'delay', severity: 'warning', message: `Action ${i + 1}: delay over 1 hour (${n}s). Consider a Time trigger instead.` });
      }
      if (a.type === 'announce') {
        if (!a.message || !String(a.message).trim()) out.push({ step: 'actions', itemIdx: i, field: 'message', severity: 'error', message: `Action ${i + 1}: announcement message is required.` });
      }
      if (a.type === 'condition_check') {
        if (!a.entityId) out.push({ step: 'actions', itemIdx: i, field: 'entityId', severity: 'error', message: `Action ${i + 1}: condition entity is required.` });
        if (!a.state) out.push({ step: 'actions', itemIdx: i, field: 'state', severity: 'error', message: `Action ${i + 1}: required state is missing.` });
      }
    });

    if (triggers.some((t: any) => t.type === 'sun') && conditions.length === 0) {
      out.push({ step: 'conditions', severity: 'warning', message: 'Sun triggers often pair with a Day-of-Week condition to limit firing.', fix: { label: 'Add weekdays condition', apply: () => setConditions([...conditions, { type: 'day', days: ['mon', 'tue', 'wed', 'thu', 'fri'] }]) } });
    }
    return out;
  }, [name, triggers, conditions, actions, knownEntityIds, haEntities]);

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const stepStatus = (s: StepKey): 'error' | 'warning' | 'ok' | 'empty' => {
    const list = issues.filter(i => i.step === s);
    if (list.some(i => i.severity === 'error')) return 'error';
    if (list.some(i => i.severity === 'warning')) return 'warning';
    if (s === 'name') return name.trim() ? 'ok' : 'empty';
    if (s === 'triggers') return triggers.length ? 'ok' : 'empty';
    if (s === 'conditions') return conditions.length ? 'ok' : 'empty';
    if (s === 'actions') return actions.length ? 'ok' : 'empty';
    return 'ok';
  };
  const fieldHasError = (step: StepKey, itemIdx: number | undefined, field: string) => issues.some(i => i.step === step && i.itemIdx === itemIdx && i.field === field && i.severity === 'error');
  const fieldHasWarn = (step: StepKey, itemIdx: number | undefined, field: string) => issues.some(i => i.step === step && i.itemIdx === itemIdx && i.field === field && i.severity === 'warning');
  const itemIssues = (step: StepKey, itemIdx: number) => issues.filter(i => i.step === step && i.itemIdx === itemIdx);

  const STEPS: { key: StepKey; label: string; count: number | null }[] = [
    { key: 'name', label: 'Name', count: null },
    { key: 'triggers', label: 'Triggers', count: triggers.length },
    { key: 'conditions', label: 'Conditions', count: conditions.length },
    { key: 'actions', label: 'Actions', count: actions.length },
    { key: 'review', label: 'Review', count: null },
  ];

  const StatusDot = ({ status }: { status: 'error' | 'warning' | 'ok' | 'empty' }) => {
    if (status === 'error') return <AlertCircle className="h-3.5 w-3.5 text-red-400" />;
    if (status === 'warning') return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />;
    if (status === 'ok') return <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />;
    return <Circle className="h-3.5 w-3.5 text-white/25" />;
  };

  const fieldClass = (step: StepKey, itemIdx: number | undefined, field: string) => {
    const err = fieldHasError(step, itemIdx, field);
    const warn = !err && fieldHasWarn(step, itemIdx, field);
    return {
      borderColor: err ? 'rgba(239,68,68,0.65)' : warn ? 'rgba(245,158,11,0.6)' : 'rgba(255,255,255,0.12)',
      boxShadow: err ? '0 0 0 1px rgba(239,68,68,0.3) inset' : warn ? '0 0 0 1px rgba(245,158,11,0.25) inset' : undefined,
    };
  };

  const summaryColor = errorCount > 0 ? '#f87171' : warnCount > 0 ? '#fbbf24' : '#4ade80';
  const summaryBg = errorCount > 0 ? 'rgba(239,68,68,0.12)' : warnCount > 0 ? 'rgba(245,158,11,0.12)' : 'rgba(34,197,94,0.12)';
  const summaryBorder = errorCount > 0 ? 'rgba(239,68,68,0.4)' : warnCount > 0 ? 'rgba(245,158,11,0.4)' : 'rgba(34,197,94,0.4)';

  return (
    <div className="flex-1 overflow-hidden flex flex-col" data-testid="automation-editor">
      {/* Top header bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/20">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white/40 text-[10px] uppercase tracking-wide font-semibold">{editingId ? 'Editing' : 'New Automation'}</span>
          </div>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Automation name…"
            className="w-full text-white text-[15px] font-semibold bg-transparent border-0 outline-0 focus:outline-none placeholder:text-white/25 px-0"
            style={fieldHasError('name', undefined, 'name') ? { textDecoration: 'underline', textDecorationColor: '#f87171', textUnderlineOffset: '4px' } : undefined}
            data-testid="editor-name"
          />
        </div>
        <button
          onClick={() => setIssuesOpen(o => !o)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold transition-all hover:brightness-110"
          style={{ background: summaryBg, border: `1px solid ${summaryBorder}`, color: summaryColor }}
          data-testid="button-toggle-issues"
        >
          {errorCount > 0 ? <AlertCircle className="h-3.5 w-3.5" /> : warnCount > 0 ? <AlertTriangle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {errorCount === 0 && warnCount === 0 ? 'All clear' : `${errorCount} error${errorCount !== 1 ? 's' : ''} · ${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded text-[11px] text-white/60 hover:text-white border border-white/20 hover:border-white/40 transition-colors" data-testid="editor-cancel">Cancel</button>
        <button
          onClick={onSave}
          disabled={errorCount > 0 || isSaving}
          className="px-4 py-1.5 rounded text-[11px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: errorCount > 0 ? 'rgba(255,255,255,0.08)' : 'linear-gradient(180deg, rgba(34,197,94,0.5) 0%, rgba(34,197,94,0.3) 100%)', border: `1px solid ${errorCount > 0 ? 'rgba(255,255,255,0.15)' : 'rgba(34,197,94,0.5)'}`, boxShadow: errorCount > 0 ? undefined : 'inset 0 1px 0 rgba(255,255,255,0.25)' }}
          title={errorCount > 0 ? 'Fix errors before saving' : ''}
          data-testid="editor-save"
        >
          {isSaving ? 'Saving…' : (editingId ? 'Update' : 'Save')}
        </button>
      </div>

      {/* Body: rail + work panel + issues drawer */}
      <div className="flex-1 overflow-hidden flex relative">
        {/* Step rail */}
        <div className="w-[170px] shrink-0 border-r border-white/10 bg-black/15 py-3 overflow-y-auto">
          {STEPS.map((s, idx) => {
            const status = stepStatus(s.key);
            const isActive = activeStep === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setActiveStep(s.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all ${isActive ? 'bg-white/10' : 'hover:bg-white/5'}`}
                style={{ borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent' }}
                data-testid={`rail-step-${s.key}`}
              >
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-white/10 text-[9px] font-bold text-white/70">{idx + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[12px] font-medium ${isActive ? 'text-white' : 'text-white/70'}`}>{s.label}</span>
                    {s.count !== null && s.count > 0 && <span className="text-[9px] text-white/40 px-1.5 py-0.5 rounded bg-white/10">{s.count}</span>}
                  </div>
                </div>
                <StatusDot status={status} />
              </button>
            );
          })}
        </div>

        {/* Work panel */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          <div className="max-w-3xl mx-auto p-5">
            {activeStep === 'name' && (
              <div className="space-y-3">
                <SectionHeader title="Name & Description" subtitle="Give this automation a clear name so you can find it later." />
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Optional description — what does this automation do?"
                  rows={4}
                  className="w-full text-white text-[12px] px-3 py-2.5 rounded resize-none focus:outline-none placeholder:text-white/30"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                  data-testid="editor-description"
                />
              </div>
            )}

            {activeStep === 'triggers' && (
              <div className="space-y-3">
                <SectionHeader title="Triggers" subtitle="When should this automation run? Add one or more triggers — any of them firing will start the automation." />
                <TypeChooser types={TRIGGER_TYPES} cols={5} onAdd={t => setTriggers([...triggers, { type: t, value: '', entityId: '', state: '' }])} testIdPrefix="trigger-add" />
                {triggers.length === 0 && <EmptyHint message="No triggers yet. Pick a type above to add one." severity="error" />}
                {triggers.map((trig, i) => (
                  <ItemCard
                    key={i}
                    icon={TRIGGER_TYPES.find(t => t.value === trig.type)?.icon || '🔧'}
                    title={TRIGGER_TYPES.find(t => t.value === trig.type)?.label || trig.type}
                    onDelete={() => setTriggers(triggers.filter((_, k) => k !== i))}
                    issues={itemIssues('triggers', i)}
                    testId={`trigger-item-${i}`}
                  >
                    {trig.type === 'time' && (
                      <Field label="At time">
                        <input type="time" value={trig.value || ''} onChange={e => updateTrigger(i, { value: e.target.value })} className="text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('triggers', i, 'value') }} data-testid={`trigger-time-${i}`} />
                      </Field>
                    )}
                    {trig.type === 'state' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Entity">
                          <EntitySelect value={trig.entityId} onChange={v => updateTrigger(i, { entityId: v })} entities={haEntities} style={fieldClass('triggers', i, 'entityId')} testId={`trigger-entity-${i}`} />
                        </Field>
                        <Field label="To state">
                          <input type="text" placeholder="e.g. on, playing, home…" value={trig.state || ''} onChange={e => updateTrigger(i, { state: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none placeholder:text-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('triggers', i, 'state') }} data-testid={`trigger-state-${i}`} />
                        </Field>
                      </div>
                    )}
                    {trig.type === 'sun' && (
                      <Field label="Event">
                        <select value={trig.value || 'sunrise'} onChange={e => updateTrigger(i, { value: e.target.value })} className="text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('triggers', i, 'value') }} data-testid={`trigger-sun-${i}`}>
                          <option value="sunrise" style={{ color: 'black' }}>Sunrise</option>
                          <option value="sunset" style={{ color: 'black' }}>Sunset</option>
                        </select>
                      </Field>
                    )}
                    {trig.type === 'interval' && (
                      <Field label="Every">
                        <div className="flex gap-2 items-center">
                          <input type="number" min={1} value={trig.value || 30} onChange={e => updateTrigger(i, { value: e.target.value })} className="w-[90px] text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('triggers', i, 'value') }} data-testid={`trigger-interval-${i}`} />
                          <select value={trig.unit || 'minutes'} onChange={e => updateTrigger(i, { unit: e.target.value })} className="text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}>
                            <option value="minutes" style={{ color: 'black' }}>minutes</option>
                            <option value="hours" style={{ color: 'black' }}>hours</option>
                          </select>
                        </div>
                      </Field>
                    )}
                    {trig.type === 'webhook' && (
                      <Field label="Webhook ID">
                        <input type="text" placeholder="my_webhook_id" value={trig.value || ''} onChange={e => updateTrigger(i, { value: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none placeholder:text-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('triggers', i, 'value') }} data-testid={`trigger-webhook-${i}`} />
                      </Field>
                    )}
                  </ItemCard>
                ))}
              </div>
            )}

            {activeStep === 'conditions' && (
              <div className="space-y-3">
                <SectionHeader title="Conditions" subtitle="Optional. Even when triggered, the automation only runs if every condition is met." />
                <TypeChooser types={CONDITION_TYPES} cols={3} onAdd={t => setConditions([...conditions, { type: t, entityId: '', state: '', after: '', before: '', days: [] }])} testIdPrefix="condition-add" />
                {conditions.length === 0 && <EmptyHint message="No conditions — automation will run every time it triggers." severity="info" />}
                {conditions.map((cond, i) => (
                  <ItemCard
                    key={i}
                    icon={CONDITION_TYPES.find(t => t.value === cond.type)?.icon || '🔧'}
                    title={CONDITION_TYPES.find(t => t.value === cond.type)?.label || cond.type}
                    onDelete={() => setConditions(conditions.filter((_, k) => k !== i))}
                    issues={itemIssues('conditions', i)}
                    testId={`condition-item-${i}`}
                  >
                    {cond.type === 'state' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Entity">
                          <EntitySelect value={cond.entityId} onChange={v => updateCondition(i, { entityId: v })} entities={haEntities} style={fieldClass('conditions', i, 'entityId')} testId={`condition-entity-${i}`} />
                        </Field>
                        <Field label="Must be in state">
                          <input type="text" placeholder="e.g. home, on…" value={cond.state || ''} onChange={e => updateCondition(i, { state: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none placeholder:text-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('conditions', i, 'state') }} />
                        </Field>
                      </div>
                    )}
                    {cond.type === 'time' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="After"><input type="time" value={cond.after || ''} onChange={e => updateCondition(i, { after: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} /></Field>
                        <Field label="Before"><input type="time" value={cond.before || ''} onChange={e => updateCondition(i, { before: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} /></Field>
                      </div>
                    )}
                    {cond.type === 'day' && (
                      <Field label="Days">
                        <div className="flex flex-wrap gap-1.5">
                          {DAYS.map(d => {
                            const active = (cond.days || []).includes(d.v);
                            return (
                              <button key={d.v} onClick={() => { const cur = cond.days || []; const next = active ? cur.filter((x: string) => x !== d.v) : [...cur, d.v]; updateCondition(i, { days: next }); }} className="px-3 py-1 rounded-full text-[11px] transition-colors" style={{ background: active ? 'rgba(96,165,250,0.25)' : 'rgba(255,255,255,0.05)', border: `1px solid ${active ? 'rgba(96,165,250,0.5)' : 'rgba(255,255,255,0.15)'}`, color: active ? '#fff' : 'rgba(255,255,255,0.6)' }}>{d.l}</button>
                            );
                          })}
                        </div>
                      </Field>
                    )}
                  </ItemCard>
                ))}
              </div>
            )}

            {activeStep === 'actions' && (
              <div className="space-y-3">
                <SectionHeader title="Actions" subtitle="What should happen when this automation runs? Actions execute in order, top to bottom." />
                <TypeChooser types={ACTION_TYPES} cols={4} onAdd={t => setActions([...actions, { type: t, domain: '', service: '', entityId: '', serviceData: {}, message: '', delay: 5 }])} testIdPrefix="action-add" />
                {actions.length === 0 && <EmptyHint message="No actions yet. Pick a type above — at least one is required." severity="error" />}
                {actions.map((act, i) => (
                  <ItemCard
                    key={i}
                    icon={ACTION_TYPES.find(t => t.value === act.type)?.icon || '🔧'}
                    title={`${i + 1}. ${ACTION_TYPES.find(t => t.value === act.type)?.label || act.type}`}
                    onDelete={() => setActions(actions.filter((_, k) => k !== i))}
                    onUp={i > 0 ? () => { const u = [...actions]; [u[i - 1], u[i]] = [u[i], u[i - 1]]; setActions(u); } : undefined}
                    onDown={i < actions.length - 1 ? () => { const u = [...actions]; [u[i], u[i + 1]] = [u[i + 1], u[i]]; setActions(u); } : undefined}
                    issues={itemIssues('actions', i)}
                    testId={`action-item-${i}`}
                  >
                    {act.type === 'call_service' && (
                      <div className="space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Domain">
                            <select value={act.domain || ''} onChange={e => updateAction(i, { domain: e.target.value, service: '' })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('actions', i, 'domain') }} data-testid={`action-domain-${i}`}>
                              <option value="" style={{ color: 'black' }}>Pick domain…</option>
                              {HA_DOMAINS.map(d => <option key={d} value={d} style={{ color: 'black' }}>{d}</option>)}
                            </select>
                          </Field>
                          <Field label="Service">
                            <input type="text" placeholder="turn_on, toggle, …" value={act.service || ''} onChange={e => updateAction(i, { service: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none placeholder:text-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('actions', i, 'service') }} data-testid={`action-service-${i}`} />
                          </Field>
                        </div>
                        <Field label="Target entity (optional)">
                          <EntitySelect value={act.entityId} onChange={v => updateAction(i, { entityId: v })} entities={haEntities} style={fieldClass('actions', i, 'entityId')} testId={`action-entity-${i}`} allowEmpty />
                        </Field>
                      </div>
                    )}
                    {act.type === 'delay' && (
                      <Field label="Wait">
                        <div className="flex items-center gap-2">
                          <input type="number" min={1} value={act.delay || 5} onChange={e => updateAction(i, { delay: parseInt(e.target.value) || 5 })} className="w-[90px] text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('actions', i, 'delay') }} data-testid={`action-delay-${i}`} />
                          <span className="text-white/50 text-[12px]">seconds</span>
                        </div>
                      </Field>
                    )}
                    {act.type === 'announce' && (
                      <Field label="Message">
                        <textarea value={act.message || ''} onChange={e => updateAction(i, { message: e.target.value })} placeholder="What Alexa should say…" rows={2} className="w-full text-white text-[12px] px-2.5 py-2 rounded resize-none focus:outline-none placeholder:text-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('actions', i, 'message') }} data-testid={`action-message-${i}`} />
                      </Field>
                    )}
                    {act.type === 'condition_check' && (
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="Entity">
                          <EntitySelect value={act.entityId} onChange={v => updateAction(i, { entityId: v })} entities={haEntities} style={fieldClass('actions', i, 'entityId')} />
                        </Field>
                        <Field label="Required state">
                          <input type="text" placeholder="e.g. home, on…" value={act.state || ''} onChange={e => updateAction(i, { state: e.target.value })} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none placeholder:text-white/30" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...fieldClass('actions', i, 'state') }} />
                        </Field>
                      </div>
                    )}
                  </ItemCard>
                ))}
              </div>
            )}

            {activeStep === 'review' && (
              <div className="space-y-4">
                <SectionHeader title="Review" subtitle={errorCount > 0 ? 'Fix the errors below before saving.' : 'Looks good — review the flow and save.'} />
                <ReviewCard label="Name">{name || <span className="text-white/30">(untitled)</span>}{description && <p className="text-white/50 text-[11px] mt-1">{description}</p>}</ReviewCard>
                <ReviewSection title="When (Triggers)" empty="No triggers configured." emptyError={triggers.length === 0}>
                  {triggers.map((t, i) => <ReviewLine key={i} icon={TRIGGER_TYPES.find(x => x.value === t.type)?.icon} label={TRIGGER_TYPES.find(x => x.value === t.type)?.label} detail={describeTrigger(t)} />)}
                </ReviewSection>
                <ReviewSection title="Only If (Conditions)" empty="No conditions — runs every trigger.">
                  {conditions.map((c, i) => <ReviewLine key={i} icon={CONDITION_TYPES.find(x => x.value === c.type)?.icon} label={CONDITION_TYPES.find(x => x.value === c.type)?.label} detail={describeCondition(c)} />)}
                </ReviewSection>
                <ReviewSection title="Then (Actions)" empty="No actions configured." emptyError={actions.length === 0}>
                  {actions.map((a, i) => <ReviewLine key={i} icon={ACTION_TYPES.find(x => x.value === a.type)?.icon} label={`${i + 1}. ${ACTION_TYPES.find(x => x.value === a.type)?.label}`} detail={describeAction(a)} />)}
                </ReviewSection>
              </div>
            )}
          </div>
        </div>

        {/* Issues drawer */}
        {issuesOpen && (
          <div className="absolute inset-y-0 right-0 w-[340px] bg-black/60 backdrop-blur-md border-l border-white/15 shadow-2xl flex flex-col z-30" data-testid="issues-drawer">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div>
                <p className="text-white text-[13px] font-semibold">Issues</p>
                <p className="text-white/50 text-[10px]">{errorCount} blocking · {warnCount} warning</p>
              </div>
              <button onClick={() => setIssuesOpen(false)} className="text-white/50 hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {issues.length === 0 && (
                <div className="text-center py-10">
                  <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
                  <p className="text-white/70 text-[12px]">No issues — ready to save.</p>
                </div>
              )}
              {issues.map((iss, k) => (
                <div key={k} className="p-2.5 rounded-lg" style={{ background: iss.severity === 'error' ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)', border: `1px solid ${iss.severity === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(245,158,11,0.35)'}` }} data-testid={`issue-${k}`}>
                  <div className="flex items-start gap-2 mb-1.5">
                    {iss.severity === 'error' ? <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />}
                    <p className="text-white text-[11px] leading-snug flex-1">{iss.message}</p>
                  </div>
                  <div className="flex items-center gap-1.5 ml-5">
                    <button onClick={() => { setActiveStep(iss.step); setIssuesOpen(false); }} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-white/70 hover:text-white border border-white/15 hover:border-white/35 transition-colors" data-testid={`issue-jump-${k}`}>
                      <ArrowRight className="h-3 w-3" /> Jump
                    </button>
                    {iss.fix && (
                      <button onClick={() => iss.fix!.apply()} className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-cyan-300 hover:text-cyan-100 border border-cyan-500/30 hover:border-cyan-500/60 transition-colors" data-testid={`issue-fix-${k}`}>
                        <Wrench className="h-3 w-3" /> {iss.fix.label}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============ Sub-components ============

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-white text-[15px] font-semibold mb-0.5">{title}</h3>
      <p className="text-white/50 text-[11px]">{subtitle}</p>
    </div>
  );
}

function TypeChooser({ types, cols, onAdd, testIdPrefix }: { types: any[]; cols: number; onAdd: (v: string) => void; testIdPrefix: string }) {
  return (
    <div className={`grid gap-2`} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
      {types.map(t => (
        <button
          key={t.value}
          onClick={() => onAdd(t.value)}
          className="flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg border border-white/10 hover:border-white/35 hover:bg-white/5 transition-all text-center"
          style={{ background: 'rgba(255,255,255,0.03)' }}
          data-testid={`${testIdPrefix}-${t.value}`}
        >
          <span className="text-base leading-none">{t.icon}</span>
          <span className="text-white text-[11px] font-medium">{t.label}</span>
          <span className="text-white/35 text-[9px] leading-tight">{t.desc}</span>
        </button>
      ))}
    </div>
  );
}

function EmptyHint({ message, severity }: { message: string; severity: 'info' | 'error' }) {
  const c = severity === 'error' ? { bg: 'rgba(239,68,68,0.08)', bd: 'rgba(239,68,68,0.3)', tx: '#fca5a5' } : { bg: 'rgba(96,165,250,0.06)', bd: 'rgba(96,165,250,0.2)', tx: 'rgba(255,255,255,0.55)' };
  return (
    <div className="text-center py-4 rounded-lg text-[11px]" style={{ background: c.bg, border: `1px dashed ${c.bd}`, color: c.tx }}>{message}</div>
  );
}

function ItemCard({ icon, title, children, onDelete, onUp, onDown, issues, testId }: { icon: string; title: string; children: React.ReactNode; onDelete: () => void; onUp?: () => void; onDown?: () => void; issues: Issue[]; testId: string }) {
  const hasErr = issues.some(i => i.severity === 'error');
  const hasWarn = !hasErr && issues.some(i => i.severity === 'warning');
  return (
    <div
      className="rounded-lg p-3"
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid ${hasErr ? 'rgba(239,68,68,0.55)' : hasWarn ? 'rgba(245,158,11,0.5)' : 'rgba(255,255,255,0.1)'}`,
        boxShadow: hasErr ? '0 0 0 1px rgba(239,68,68,0.15)' : hasWarn ? '0 0 0 1px rgba(245,158,11,0.12)' : undefined,
      }}
      data-testid={testId}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-base leading-none mt-0.5">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-white text-[12px] font-semibold">{title}</span>
            {hasErr && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>ERROR</span>}
            {hasWarn && <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(245,158,11,0.2)', color: '#fcd34d' }}>WARNING</span>}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {onUp && <button onClick={onUp} className="text-white/40 hover:text-white p-0.5 transition-colors"><ChevronUp className="h-3.5 w-3.5" /></button>}
          {onDown && <button onClick={onDown} className="text-white/40 hover:text-white p-0.5 transition-colors"><ChevronDown className="h-3.5 w-3.5" /></button>}
          <button onClick={onDelete} className="text-white/40 hover:text-red-400 p-0.5 transition-colors" title="Remove"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      <div className="space-y-2">{children}</div>
      {issues.length > 0 && (
        <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
          {issues.map((iss, k) => (
            <div key={k} className="flex items-start gap-1.5 text-[10.5px]" style={{ color: iss.severity === 'error' ? '#fca5a5' : '#fcd34d' }}>
              {iss.severity === 'error' ? <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /> : <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />}
              <span className="flex-1">{iss.message}</span>
              {iss.fix && (
                <button onClick={() => iss.fix!.apply()} className="px-1.5 py-0.5 rounded text-[9.5px] text-cyan-300 hover:text-cyan-100 border border-cyan-500/30 hover:border-cyan-500/60 shrink-0">{iss.fix.label}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-white/50 text-[10px] uppercase tracking-wide font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

function EntitySelect({ value, onChange, entities, style, testId, allowEmpty }: { value: string; onChange: (v: string) => void; entities: any[]; style?: any; testId?: string; allowEmpty?: boolean }) {
  return (
    <select value={value || ''} onChange={e => onChange(e.target.value)} className="w-full text-white text-[12px] px-2.5 py-1.5 rounded focus:outline-none [color-scheme:dark]" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid', ...style }} data-testid={testId}>
      <option value="" style={{ color: 'black' }}>{allowEmpty ? '— none —' : 'Pick an entity…'}</option>
      {entities.map((e: any) => <option key={e.entityId} value={e.entityId} style={{ color: 'black' }}>{e.friendlyName} ({e.entityId})</option>)}
    </select>
  );
}

function ReviewCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 rounded-lg border border-white/10" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <p className="text-white/40 text-[10px] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-[13px]">{children}</p>
    </div>
  );
}

function ReviewSection({ title, children, empty, emptyError }: { title: string; children: React.ReactNode; empty: string; emptyError?: boolean }) {
  const childArr = Array.isArray(children) ? children : [children];
  const isEmpty = !childArr.flat().filter(Boolean).length;
  return (
    <div>
      <p className="text-white/50 text-[10px] uppercase tracking-wide font-semibold mb-2">{title}</p>
      {isEmpty ? (
        <p className="text-[11px] px-3 py-2 rounded" style={{ background: emptyError ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.04)', color: emptyError ? '#fca5a5' : 'rgba(255,255,255,0.45)', border: emptyError ? '1px dashed rgba(239,68,68,0.3)' : '1px solid rgba(255,255,255,0.08)' }}>{empty}</p>
      ) : (
        <div className="space-y-1">{children}</div>
      )}
    </div>
  );
}

function ReviewLine({ icon, label, detail }: { icon?: string; label?: string; detail?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px]" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <span>{icon}</span>
      <span className="text-white/85 font-medium">{label}</span>
      {detail && <span className="text-white/50">— {detail}</span>}
    </div>
  );
}

function describeTrigger(t: any): string {
  if (t.type === 'time') return t.value || '(no time)';
  if (t.type === 'state') return `${t.entityId || '(no entity)'} → ${t.state || 'any state'}`;
  if (t.type === 'sun') return t.value || 'sunrise';
  if (t.type === 'interval') return `every ${t.value || '?'} ${t.unit || 'minutes'}`;
  if (t.type === 'webhook') return t.value || '(no id)';
  return '';
}
function describeCondition(c: any): string {
  if (c.type === 'state') return `${c.entityId || '?'} = ${c.state || '?'}`;
  if (c.type === 'time') return `${c.after || '...'} – ${c.before || '...'}`;
  if (c.type === 'day') return Array.isArray(c.days) && c.days.length ? c.days.join(', ') : '(no days)';
  return '';
}
function describeAction(a: any): string {
  if (a.type === 'call_service') return `${a.domain || '?'}.${a.service || '?'}${a.entityId ? ` → ${a.entityId}` : ''}`;
  if (a.type === 'delay') return `${a.delay || '?'} seconds`;
  if (a.type === 'announce') return a.message ? `"${String(a.message).slice(0, 60)}${String(a.message).length > 60 ? '…' : ''}"` : '(empty)';
  if (a.type === 'condition_check') return `${a.entityId || '?'} = ${a.state || '?'}`;
  return '';
}
