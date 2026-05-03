import React from "react";
import { Tag, X } from "lucide-react";
import { format } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getAppTz } from "../../dashboard-utils";

interface ColorSettings {
  mainBackground: string;
  mainBackgroundGradientEnd: string;
  headerBar: string;
  [k: string]: any;
}

interface Props {
  open: boolean;
  desktopIsFull: boolean;
  allTasksRaw: any[] | undefined;
  greyClassifySelections: Record<number, string>;
  setGreyClassifySelections: React.Dispatch<React.SetStateAction<Record<number, string>>>;
  setGreyClassifyOpen: (v: boolean) => void;
  dismissDialog: (key: string) => void;
  colorSettings: ColorSettings;
}

export function GreyClassifyDialog({
  open,
  desktopIsFull,
  allTasksRaw,
  greyClassifySelections,
  setGreyClassifySelections,
  setGreyClassifyOpen,
  dismissDialog,
  colorSettings,
}: Props) {
  if (!open || !desktopIsFull) return null;
  const now = new Date();
  const etStr = now.toLocaleString('en-US', { timeZone: getAppTz() });
  const et = new Date(etStr);
  const todayStr = `${et.getFullYear()}-${String(et.getMonth()+1).padStart(2,'0')}-${String(et.getDate()).padStart(2,'0')}`;
  const todayStart = new Date(`${todayStr}T00:00:00`);
  const greyTasks = (allTasksRaw || [])
    .filter((t: any) => t.type === 'other' && !t.isCompleted && new Date(t.dueDate) >= todayStart)
    .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const typeOptions = ["module", "reading", "essay", "discussion", "poll", "quiz", "exam", "project", "reminder", "meeting", "other"] as const;
  const typeColorMap: Record<string, string> = { module: 'rgba(16,200,120,0.35)', reading: 'rgba(56,130,255,0.35)', essay: 'rgba(255,180,30,0.35)', discussion: 'rgba(180,120,220,0.35)', poll: 'rgba(255,70,160,0.35)', quiz: 'rgba(180,160,40,0.35)', exam: 'rgba(220,30,30,0.4)', project: 'rgba(255,100,50,0.35)', reminder: 'rgba(0,210,240,0.35)', meeting: 'rgba(50,50,180,0.35)', school: 'rgba(0,76,156,0.35)', household: 'rgba(245,158,11,0.35)', financial: 'rgba(16,185,129,0.35)', personal: 'rgba(139,92,246,0.35)', outside: 'rgba(34,197,94,0.35)', other: 'rgba(160,170,180,0.25)' };
  const persistDismiss = () => {
    const stored = localStorage.getItem('grey_classify_prompts');
    const promptData: { dates: string[] } = stored ? (() => { try { return JSON.parse(stored); } catch { return { dates: [] }; } })() : { dates: [] };
    if (!promptData.dates.includes(todayStr)) promptData.dates.push(todayStr);
    localStorage.setItem('grey_classify_prompts', JSON.stringify(promptData));
    dismissDialog(`grey_classify_${todayStr}`);
    setGreyClassifySelections({});
    setGreyClassifyOpen(false);
  };
  const handleSaveClassify = async () => {
    const entries = Object.entries(greyClassifySelections);
    for (const [idStr, newType] of entries) {
      const id = Number(idStr);
      if (newType && newType !== 'other') {
        try { await apiRequest("PATCH", `/api/tasks/${id}`, { type: newType }); } catch (e) { console.error('Failed to update task type:', e); }
      }
    }
    queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    persistDismiss();
  };
  const handleDismissClassify = () => persistDismiss();
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: 10010, background: 'rgba(0,0,0,0.6)' }} data-testid="dialog-grey-classify">
      <div className="flex flex-col text-white" style={{ width: '72%', maxWidth: '940px', height: '70vh', maxHeight: '580px', borderRadius: '10px', overflow: 'hidden', background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)', margin: '0', width: '100%' }}>
          <div className="flex items-center gap-1.5">
            <Tag className="text-orange-400" style={{ width: '11px', height: '11px' }} />
            <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '9px' }}>CLASSIFY GREY TASKS</h2>
            <span className="text-[7px] text-white/40 ml-1">Select a type for each uncategorized task</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={handleSaveClassify} className="text-[8px] px-2 py-0.5 rounded hover:bg-white/20 text-green-400 font-medium" data-testid="grey-classify-save">Save</button>
            <button onClick={handleDismissClassify} className="text-[8px] px-2 py-0.5 rounded hover:bg-white/20 text-white/60" data-testid="grey-classify-dismiss">Skip</button>
            <button onClick={handleDismissClassify} className="text-white/60 hover:text-white/80" data-testid="grey-classify-close"><X style={{ width: '12px', height: '12px' }} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', padding: '6px 10px' }}>
          {greyTasks.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <span className="text-[10px] text-white/50 italic">No grey tasks from today forward</span>
            </div>
          ) : greyTasks.map((task: any) => {
            const dueDate = new Date(task.dueDate);
            const dueFmt = format(dueDate, "MMM d");
            const selected = greyClassifySelections[task.id] || '';
            const coursePart = task.courseName ? task.courseName.split(' - ')[0]?.trim() : '';
            return (
              <div key={task.id} className="flex items-center gap-2 py-1.5 border-b border-white/10" data-testid={`grey-classify-row-${task.id}`}>
                <div className="flex-shrink-0 text-[8px] text-white/40 w-[42px] text-right">{dueFmt}</div>
                {coursePart && <div className="flex-shrink-0 text-[7px] font-bold px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.1)' }}>{coursePart}</div>}
                <div className="flex-1 text-[9px] text-white/90 truncate min-w-0" title={task.title}>{(task.title || '').replace(/^\s*\[[^\]]*\]\s*/g, '')}</div>
                <div className="flex-shrink-0 flex gap-0.5 flex-wrap justify-end" style={{ maxWidth: '320px' }}>
                  {typeOptions.map(type => {
                    const isSelected = selected === type;
                    return (
                      <button
                        key={type}
                        className="text-[7px] px-1.5 py-0.5 rounded transition-all"
                        style={{
                          background: isSelected ? typeColorMap[type] : 'rgba(255,255,255,0.05)',
                          border: isSelected ? '1px solid rgba(255,255,255,0.4)' : '1px solid rgba(255,255,255,0.12)',
                          color: isSelected ? 'white' : 'rgba(255,255,255,0.5)',
                          fontWeight: isSelected ? 600 : 400,
                        }}
                        onClick={() => setGreyClassifySelections(p => ({ ...p, [task.id]: type }))}
                        data-testid={`grey-classify-type-${task.id}-${type}`}
                      >
                        {type}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between px-3 py-1 border-t border-white/15 flex-shrink-0" style={{ background: 'rgba(0,0,0,0.15)' }}>
          <span className="text-[7px] text-white/30">{greyTasks.length} task{greyTasks.length !== 1 ? 's' : ''} to classify</span>
          <span className="text-[7px] text-white/30">{Object.keys(greyClassifySelections).filter(k => greyClassifySelections[Number(k)] && greyClassifySelections[Number(k)] !== 'other').length} changed</span>
        </div>
      </div>
    </div>
  );
}
