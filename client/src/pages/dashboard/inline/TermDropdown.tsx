import { shortTermLabel } from "../pureHelpers";

export interface TermDropdownProps {
  id: string;
  code: string;
  isPrevCompleted?: boolean;
  getEffectiveTerm: (id: string, code: string) => string;
  setTermOverride: (id: string, value: string) => void;
  termLabelOptions: string[];
}

export function TermDropdown({ id, code, isPrevCompleted, getEffectiveTerm, setTermOverride, termLabelOptions }: TermDropdownProps) {
  const val = getEffectiveTerm(id, code);
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <select
        value={val}
        onChange={(e) => setTermOverride(id, e.target.value)}
        className="no-dim text-[7px]"
        style={{ background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', cursor: 'pointer', padding: '0 6px 0 0', width: '100%', appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none' as any, color: '#000000' }}
        data-testid={`term-select-${id}`}
      >
        <option value="">—</option>
        {termLabelOptions.map(opt => (
          <option key={opt} value={opt}>{shortTermLabel(opt)}</option>
        ))}
      </select>
      <div style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', fontSize: '6px', lineHeight: 1, color: '#666' }}>▼</div>
      {isPrevCompleted && (
        <div style={{ position: 'absolute', top: '50%', left: '2px', right: '2px', height: '1.5px', backgroundColor: '#cc0000', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      )}
    </div>
  );
}
