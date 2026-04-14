import { useState, useEffect, useRef, memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check } from "lucide-react";

type ChecklistItem = {
  id: number;
  semesterSettingsId: number;
  courseCode: string;
  itemType: string;
  isChecked: boolean | null;
  checkedAt: string | null;
};

interface SemesterChecklistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: ChecklistItem[];
  onItemsChange: (items: ChecklistItem[]) => void;
  semesterSettingsId?: number;
  colorSettings?: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
}

export const SemesterChecklistDialog = memo(function SemesterChecklistDialog({
  open,
  onOpenChange,
  items,
  onItemsChange,
  semesterSettingsId,
  colorSettings = { mainBackground: '#1a1a2e', mainBackgroundGradientEnd: '#16213e', headerBar: '#1a1a2e' },
}: SemesterChecklistDialogProps) {
  const { toast } = useToast();
  const [snoozeValue, setSnoozeValue] = useState(30);
  const [snoozeUnit, setSnoozeUnit] = useState<'minutes' | 'hours'>('minutes');
  const [localChecked, setLocalChecked] = useState<Record<number, boolean>>({});
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onItemsChangeRef = useRef(onItemsChange);
  onItemsChangeRef.current = onItemsChange;
  const onOpenChangeRef = useRef(onOpenChange);
  onOpenChangeRef.current = onOpenChange;
  const pendingRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const map: Record<number, boolean> = {};
    items.forEach(i => { map[i.id] = !!i.isChecked; });
    setLocalChecked(map);
  }, [items]);

  const handleCheck = (item: ChecklistItem) => {
    if (pendingRef.current.has(item.id)) return;
    const newChecked = !localChecked[item.id];
    setLocalChecked(prev => ({ ...prev, [item.id]: newChecked }));
    pendingRef.current.add(item.id);

    fetch('/api/semester-checklist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ semesterSettingsId: item.semesterSettingsId, courseCode: item.courseCode, itemType: item.itemType, isChecked: newChecked }),
    })
      .then(r => r.json())
      .then(data => {
        pendingRef.current.delete(item.id);
        const updated = itemsRef.current.map(i => i.id === item.id ? { ...i, isChecked: newChecked } : i);
        onItemsChangeRef.current(updated);
        if (data.allChecked) {
          toast({ title: "All done!", description: "Semester setup checklist complete." });
          if (semesterSettingsId) {
            localStorage.setItem(`semChecklist_allDone_${semesterSettingsId}`, 'true');
          }
          setTimeout(() => onOpenChangeRef.current(false), 600);
        }
      })
      .catch(err => {
        pendingRef.current.delete(item.id);
        console.error('Error updating checklist:', err);
      });
  };

  const grouped: Record<string, ChecklistItem[]> = {};
  items.forEach(item => {
    if (!grouped[item.courseCode]) grouped[item.courseCode] = [];
    grouped[item.courseCode].push(item);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-white [&_*]:text-white p-0 [&>button.absolute]:hidden overflow-hidden" data-testid="semester-checklist-dialog" style={{ background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`, border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 4px 24px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)' }}>
          <Check className="text-white" style={{ width: '15px', height: '15px' }} />
          <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>HEY BRYN, HAVE YOU...</h2>
        </div>
        <div className="px-4 py-1.5 text-white/60 text-xs">Complete these items to get your semester started right.</div>
        <div className="flex flex-col gap-4 px-4 py-2">
          {Object.entries(grouped).map(([courseCode, courseItems]) => (
            <div key={courseCode} className="flex flex-col gap-1">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{courseCode}</span>
              {courseItems.map(item => {
                const label = item.itemType === 'tasks' ? 'Input all assignments, essays, projects and exams' : item.itemType === 'modules' ? 'Upload the modules' : 'Upload reading materials';
                const checked = !!localChecked[item.id];
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded px-2 py-2.5 active:bg-white/10 select-none"
                    style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation', cursor: 'pointer', minHeight: '44px' }}
                    onClick={() => handleCheck(item)}
                    data-testid={`checklist-${courseCode}-${item.itemType}`}
                  >
                    <div
                      className="shrink-0 flex items-center justify-center rounded border-2 transition-colors"
                      style={{
                        width: '28px',
                        height: '28px',
                        backgroundColor: checked ? '#22c55e' : 'transparent',
                        borderColor: checked ? '#22c55e' : 'rgba(255,255,255,0.5)',
                      }}
                      data-testid={`checkbox-${courseCode}-${item.itemType}`}
                    >
                      {checked && <Check className="h-5 w-5 text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-sm ${checked ? 'text-white/50 line-through' : 'text-white/90'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <DialogFooter className="flex flex-col gap-3 sm:flex-col px-4 py-3 border-t border-white/20">
          <div className="flex items-center gap-2 w-full" data-testid="checklist-snooze-section">
            <button
              className="px-4 py-2 text-sm font-medium bg-amber-600 hover:bg-amber-500 text-white rounded transition-colors whitespace-nowrap"
              onClick={() => {
                const ms = snoozeUnit === 'hours' ? snoozeValue * 60 * 60 * 1000 : snoozeValue * 60 * 1000;
                const until = Date.now() + ms;
                if (semesterSettingsId) {
                  localStorage.setItem(`semChecklist_snoozeUntil_${semesterSettingsId}`, String(until));
                }
                onOpenChange(false);
                toast({ title: "Snoozed", description: `Checklist snoozed for ${snoozeValue} ${snoozeUnit}.` });
              }}
              data-testid="button-snooze-checklist"
            >
              Snooze
            </button>
            <select
              value={snoozeValue}
              onChange={e => setSnoozeValue(parseInt(e.target.value, 10))}
              className="border border-white/30 rounded px-2 py-2 text-sm w-16 text-center"
              style={{ backgroundColor: '#2a2a2a', color: '#ffffff', WebkitTextFillColor: '#ffffff', opacity: 1, WebkitAppearance: 'none' as any }}
              data-testid="select-snooze-value"
              size={1}
            >
              {snoozeUnit === 'minutes'
                ? Array.from({ length: 60 }, (_, i) => i + 1).map(v => <option key={v} value={v} style={{ backgroundColor: '#2a2a2a', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>{v}</option>)
                : [1, 2, 3, 4, 6, 8, 12, 24].map(v => <option key={v} value={v} style={{ backgroundColor: '#2a2a2a', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>{v}</option>)
              }
            </select>
            <select
              value={snoozeUnit}
              onChange={e => {
                const unit = e.target.value as 'minutes' | 'hours';
                setSnoozeUnit(unit);
                setSnoozeValue(unit === 'minutes' ? 30 : 1);
              }}
              className="border border-white/30 rounded px-2 py-2 text-sm"
              style={{ backgroundColor: '#2a2a2a', color: '#ffffff', WebkitTextFillColor: '#ffffff', opacity: 1, WebkitAppearance: 'none' as any }}
              data-testid="select-snooze-unit"
            >
              <option value="minutes" style={{ backgroundColor: '#2a2a2a', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>minutes</option>
              <option value="hours" style={{ backgroundColor: '#2a2a2a', color: '#ffffff', WebkitTextFillColor: '#ffffff' }}>hours</option>
            </select>
          </div>
          <button
            className="px-4 py-2 text-sm font-medium text-white/50 hover:text-white/80 transition-colors self-start"
            onClick={() => onOpenChange(false)}
            data-testid="button-dismiss-checklist"
          >
            Dismiss for now
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
});
