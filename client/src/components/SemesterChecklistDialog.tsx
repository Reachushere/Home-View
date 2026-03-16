import { useState, memo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

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
}

export const SemesterChecklistDialog = memo(function SemesterChecklistDialog({
  open,
  onOpenChange,
  items,
  onItemsChange,
  semesterSettingsId,
}: SemesterChecklistDialogProps) {
  const { toast } = useToast();
  const [snoozeValue, setSnoozeValue] = useState(30);
  const [snoozeUnit, setSnoozeUnit] = useState<'minutes' | 'hours'>('minutes');

  const grouped: Record<string, ChecklistItem[]> = {};
  items.forEach(item => {
    if (!grouped[item.courseCode]) grouped[item.courseCode] = [];
    grouped[item.courseCode].push(item);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md text-white" data-testid="semester-checklist-dialog">
        <DialogHeader>
          <DialogTitle className="text-white text-lg font-semibold">Hey Bryn, have you...</DialogTitle>
          <DialogDescription className="text-white/60 text-sm">Complete these items to get your semester started right.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-2">
          {Object.entries(grouped).map(([courseCode, courseItems]) => (
            <div key={courseCode} className="flex flex-col gap-2">
              <span className="text-xs font-bold text-white/80 uppercase tracking-wider">{courseCode}</span>
              {courseItems.map(item => {
                const label = item.itemType === 'tasks' ? 'Input all assignments, essays, projects and exams' : item.itemType === 'modules' ? 'Upload the modules' : 'Upload reading materials';
                return (
                  <label key={item.id} className="flex items-center gap-3 cursor-pointer hover:bg-white/5 rounded px-2 py-1.5 transition-colors" data-testid={`checklist-${courseCode}-${item.itemType}`}>
                    <Checkbox
                      className="h-5 w-5 border-2"
                      checked={!!item.isChecked}
                      onCheckedChange={(checked) => {
                        const updated = items.map(i => i.id === item.id ? { ...i, isChecked: !!checked } : i);
                        onItemsChange(updated);
                        fetch('/api/semester-checklist', {
                          method: 'PATCH',
                          headers: { 'Content-Type': 'application/json' },
                          credentials: 'include',
                          body: JSON.stringify({ semesterSettingsId: item.semesterSettingsId, courseCode: item.courseCode, itemType: item.itemType, isChecked: !!checked }),
                        })
                          .then(r => r.json())
                          .then(data => {
                            if (data.allChecked) {
                              toast({ title: "All done!", description: "Semester setup checklist complete." });
                              onOpenChange(false);
                            }
                          })
                          .catch(err => console.error('Error updating checklist:', err));
                      }}
                      data-testid={`checkbox-${courseCode}-${item.itemType}`}
                    />
                    <span className="text-sm text-white/90">{label}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
        <DialogFooter className="mt-4 flex flex-col gap-3 sm:flex-col">
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
