import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, Check, ChevronRight, ChevronLeft, FileText, BookOpen, AlertCircle, Loader2, GraduationCap, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CourseInfo {
  name: string;
  color: string;
  colorEnd?: string;
  professor?: string;
}

interface SemesterInfo {
  semKey: string;
  semesterType: string;
  semesterStartDate?: string;
  readingWeekStart?: number;
}

interface HealthCourseData {
  code: string;
  syllabusLinked: boolean;
  totalModules: number;
  totalReadings: number;
  totalTtsReady: number;
  totalTtsNeeded: number;
  moduleWeeks: Record<number, { count: number; ttsReady: number }>;
  readingWeeks: Record<number, { count: number; ttsReady: number }>;
}

interface HealthData {
  healthScore: number;
  numberOfWeeks: number;
  courses: HealthCourseData[];
  issues: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  coursesData: { courses: CourseInfo[] };
  semesters: Record<string, SemesterInfo>;
  semesterKeyOrder: string[];
  healthData?: HealthData | null;
  colorSettings?: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
}

function getSemLabel(key: string) {
  const yr = key.replace(/^[a-z]+/, '');
  if (key.startsWith('w')) return `Winter ${yr}`;
  if (key.startsWith('ss')) return `Spring/Summer ${yr}`;
  if (key.startsWith('f')) return `Fall ${yr}`;
  return key;
}

function getWeekDatesForSemester(startDate: string, weekNum: number, readingWeekStart?: number): { start: Date; end: Date } {
  const base = new Date(startDate);
  const satBefore = new Date(base);
  satBefore.setDate(satBefore.getDate() - ((satBefore.getDay() + 1) % 7));
  const weekStart = new Date(satBefore);
  weekStart.setDate(weekStart.getDate() + (weekNum - 1) * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  return { start: weekStart, end: weekEnd };
}

function formatDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CourseDocumentsWizard({ open, onClose, coursesData, semesters, semesterKeyOrder, healthData, colorSettings }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedSemKey, setSelectedSemKey] = useState('');
  const [syllabusFile, setSyllabusFile] = useState<File | null>(null);
  const [syllabusUploading, setSyllabusUploading] = useState(false);
  const [syllabusUploaded, setSyllabusUploaded] = useState(false);
  const [moduleFiles, setModuleFiles] = useState<Record<number, { file: File | null; uploading: boolean; uploaded: boolean; name: string }>>({});
  const [readingFiles, setReadingFiles] = useState<Record<number, { file: File | null; uploading: boolean; uploaded: boolean; name: string; displayName: string }[]>>({});
  const [renameDialog, setRenameDialog] = useState<{ weekNum: number; readingIdx: number; fileName: string; displayName: string } | null>(null);
  const [addAnotherWeek, setAddAnotherWeek] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const coursesBySemseter = useMemo(() => {
    const groups: Record<string, string[]> = {};
    for (const c of coursesData.courses) {
      const code = c.name?.split(' - ')[0]?.trim() || '';
      if (!code) continue;
      let foundSem = '';
      for (const sk of semesterKeyOrder) {
        const sem = semesters[sk];
        if (!sem) continue;
        foundSem = sk;
        break;
      }
      const activeSems = semesterKeyOrder.filter(sk => {
        const sem = semesters[sk];
        if (!sem) return false;
        const semCourses = (sem as any).courses || [];
        if (Array.isArray(semCourses) && semCourses.some((sc: any) => sc.code === code || sc.name?.includes(code))) return true;
        return false;
      });
      const semKey = activeSems[0] || semesterKeyOrder.find(sk => semesters[sk]) || '';
      if (!semKey) continue;
      if (!groups[semKey]) groups[semKey] = [];
      if (!groups[semKey].includes(c.name)) groups[semKey].push(c.name);
    }
    if (Object.keys(groups).length === 0) {
      const activeSem = semesterKeyOrder.find(sk => semesters[sk]) || semesterKeyOrder[0] || '';
      if (activeSem) {
        groups[activeSem] = coursesData.courses.map(c => c.name).filter(Boolean);
      }
    }
    return groups;
  }, [coursesData, semesters, semesterKeyOrder]);

  const currentSem = semesters[selectedSemKey];
  const courseCode = selectedCourse.split(' - ')[0]?.trim().toUpperCase() || '';
  const courseColor = coursesData.courses.find(c => c.name === selectedCourse)?.color || '#3b82f6';

  const weekCount = 13;

  const handleSyllabusUpload = useCallback(async () => {
    if (!syllabusFile || !courseCode) return;
    setSyllabusUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', syllabusFile);
      const uploadRes = await fetch('/api/uploads/request-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: syllabusFile.name, contentType: syllabusFile.type || 'application/pdf' }),
      });
      const uploadData = await uploadRes.json();

      if (uploadData.uploadUrl) {
        await fetch(uploadData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': syllabusFile.type || 'application/pdf' },
          body: syllabusFile,
        });
      }

      const objectPath = uploadData.objectPath || uploadData.key || `syllabi/${courseCode}_syllabus.pdf`;

      const pathsRes = await fetch('/api/syllabus/paths');
      const existingPaths = await pathsRes.json();
      const updatedPaths = { ...existingPaths, [courseCode]: objectPath };
      await apiRequest('POST', '/api/syllabus/paths', updatedPaths);

      localStorage.setItem('courseSyllabusPaths', JSON.stringify(updatedPaths));
      queryClient.invalidateQueries({ queryKey: ['/api/syllabus/paths'] });

      setSyllabusUploaded(true);
      toast({ title: 'Syllabus Uploaded', description: `${courseCode} syllabus saved and linked.` });
    } catch (err: any) {
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload syllabus.', variant: 'destructive' });
    } finally {
      setSyllabusUploading(false);
    }
  }, [syllabusFile, courseCode, toast]);

  const handleModuleUpload = useCallback(async (weekNum: number, file: File) => {
    if (!currentSem?.semesterStartDate || !courseCode) return;
    setModuleFiles(prev => ({ ...prev, [weekNum]: { ...prev[weekNum], uploading: true } }));
    try {
      const wk = getWeekDatesForSemester(currentSem.semesterStartDate, weekNum, currentSem.readingWeekStart);
      const dateRange = `${formatDate(wk.start)} - ${formatDate(wk.end)}`;

      const semType = currentSem.semesterType || 'winter';
      const yr = selectedSemKey.replace(/^[a-z]+/, '');

      const response = await fetch('/api/course-week-upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/pdf',
          'x-course-code': courseCode,
          'x-course-name': selectedCourse,
          'x-week-num': String(weekNum),
          'x-upload-type': 'module',
          'x-week-date-range': dateRange,
          'x-file-name': file.name,
          'x-semester-year': yr,
          'x-semester-type': semType,
        },
        body: file,
      });

      if (!response.ok) throw new Error(await response.text());

      setModuleFiles(prev => ({ ...prev, [weekNum]: { file, uploading: false, uploaded: true, name: file.name } }));
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({ title: 'Module Uploaded', description: `Week ${weekNum} module saved.` });
    } catch (err: any) {
      setModuleFiles(prev => ({ ...prev, [weekNum]: { ...prev[weekNum], uploading: false } }));
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload module.', variant: 'destructive' });
    }
  }, [currentSem, courseCode, selectedCourse, selectedSemKey, toast]);

  const handleReadingUpload = useCallback(async (weekNum: number, readingIdx: number, file: File, displayName: string) => {
    if (!currentSem?.semesterStartDate || !courseCode) return;
    const key = `${weekNum}-${readingIdx}`;
    setReadingFiles(prev => {
      const arr = [...(prev[weekNum] || [])];
      arr[readingIdx] = { ...arr[readingIdx], uploading: true };
      return { ...prev, [weekNum]: arr };
    });
    try {
      const wk = getWeekDatesForSemester(currentSem.semesterStartDate, weekNum, currentSem.readingWeekStart);
      const dateRange = `${formatDate(wk.start)} - ${formatDate(wk.end)}`;
      const semType = currentSem.semesterType || 'winter';
      const yr = selectedSemKey.replace(/^[a-z]+/, '');

      const finalName = displayName || file.name;

      const response = await fetch('/api/course-week-upload', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/pdf',
          'x-course-code': courseCode,
          'x-course-name': selectedCourse,
          'x-week-num': String(weekNum),
          'x-upload-type': 'reading',
          'x-week-date-range': dateRange,
          'x-file-name': finalName,
          'x-semester-year': yr,
          'x-semester-type': semType,
        },
        body: file,
      });

      if (!response.ok) throw new Error(await response.text());

      setReadingFiles(prev => {
        const arr = [...(prev[weekNum] || [])];
        arr[readingIdx] = { file, uploading: false, uploaded: true, name: file.name, displayName: finalName };
        return { ...prev, [weekNum]: arr };
      });
      queryClient.invalidateQueries({ queryKey: ['/api/files'] });
      toast({ title: 'Reading Uploaded', description: `Week ${weekNum} reading "${finalName.replace(/\.pdf$/i, '')}" saved.` });

      setAddAnotherWeek(weekNum);
    } catch (err: any) {
      setReadingFiles(prev => {
        const arr = [...(prev[weekNum] || [])];
        arr[readingIdx] = { ...arr[readingIdx], uploading: false };
        return { ...prev, [weekNum]: arr };
      });
      toast({ title: 'Upload Failed', description: err.message || 'Failed to upload reading.', variant: 'destructive' });
    }
  }, [currentSem, courseCode, selectedCourse, selectedSemKey, toast]);

  const totalModules = weekCount;
  const uploadedModules = Object.values(moduleFiles).filter(m => m.uploaded).length;
  const totalReadings = Object.values(readingFiles).reduce((s, arr) => s + arr.filter(r => r.uploaded).length, 0);
  const completionPct = Math.round(((syllabusUploaded ? 1 : 0) + uploadedModules + totalReadings) / (1 + totalModules + totalModules) * 100);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[10010] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} data-testid="course-documents-wizard-overlay">
      <div
        className="flex flex-col text-white rounded-xl overflow-hidden"
        style={{
          width: '720px', maxWidth: '95vw', height: '85vh',
          background: colorSettings ? `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)` : 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1.5px solid rgba(255,255,255,0.35)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.4)',
        }}
        data-testid="course-documents-wizard"
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/40 rounded-t-xl" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: colorSettings ? `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)` : 'rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)' }}>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-white" />
            <span className="font-normal text-white uppercase" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>Course Documents</span>
            {selectedCourse && <span className="text-[10px] text-white/50 ml-2">{courseCode}</span>}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[0, 1, 2, 3].map(s => (
                <div key={s} className="rounded-full" style={{
                  width: step === s ? '20px' : '8px', height: '8px',
                  background: step > s ? '#22c55e' : step === s ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.2s',
                }} />
              ))}
            </div>
            <button onClick={onClose} className="p-1 rounded hover:bg-white/10" data-testid="btn-close-doc-wizard">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4" style={{ scrollbarWidth: 'none' }}>
          {step === 0 && (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <GraduationCap className="h-10 w-10 text-blue-400 mx-auto mb-2" />
                <h3 className="text-[14px] font-semibold">Select Course</h3>
                <p className="text-[10px] text-white/50 mt-1">Choose the course to upload documents for</p>
              </div>
              {semesterKeyOrder.filter(sk => {
                const courses = coursesBySemseter[sk];
                return courses && courses.length > 0;
              }).length === 0 && (
                <div className="flex flex-col gap-2">
                  {coursesData.courses.map(c => {
                    const code = c.name?.split(' - ')[0]?.trim() || '';
                    return (
                      <button
                        key={c.name}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                        style={{
                          background: selectedCourse === c.name ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
                          border: selectedCourse === c.name ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
                        }}
                        onClick={() => { setSelectedCourse(c.name); setSelectedSemKey(semesterKeyOrder.find(sk => semesters[sk]) || ''); }}
                        data-testid={`select-course-${code}`}
                      >
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c.color }} />
                        <div className="flex-1">
                          <div className="text-[11px] font-medium flex items-center gap-1.5">
                            {c.name}
                            {healthData && (() => {
                              const hc = healthData.courses.find(h => code && h.code.toLowerCase() === code.toLowerCase());
                              if (hc && (!hc.syllabusLinked || hc.totalModules === 0)) return <span style={{ color: '#f59e0b', fontSize: '12px' }} title="Needs attention">★</span>;
                              return null;
                            })()}
                          </div>
                          {c.professor && <div className="text-[9px] text-white/40">{c.professor}</div>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              {semesterKeyOrder.filter(sk => coursesBySemseter[sk]?.length).map(sk => (
                <div key={sk}>
                  <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">{getSemLabel(sk)}</div>
                  <div className="flex flex-col gap-2">
                    {(coursesBySemseter[sk] || []).map(cName => {
                      const code = cName.split(' - ')[0]?.trim() || '';
                      const c = coursesData.courses.find(cc => cc.name === cName);
                      return (
                        <button
                          key={cName}
                          className="flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                          style={{
                            background: selectedCourse === cName ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.05)',
                            border: selectedCourse === cName ? '1px solid rgba(59,130,246,0.6)' : '1px solid rgba(255,255,255,0.1)',
                          }}
                          onClick={() => { setSelectedCourse(cName); setSelectedSemKey(sk); }}
                          data-testid={`select-course-${code}`}
                        >
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: c?.color || '#6b7280' }} />
                          <div className="flex-1">
                            <div className="text-[11px] font-medium flex items-center gap-1.5">
                              {cName}
                              {healthData && (() => {
                                const hc = healthData.courses.find(h => code && h.code.toLowerCase() === code.toLowerCase());
                                if (hc && (!hc.syllabusLinked || hc.totalModules === 0)) return <span style={{ color: '#f59e0b', fontSize: '12px' }} title="Needs attention">★</span>;
                                return null;
                              })()}
                            </div>
                            {c?.professor && <div className="text-[9px] text-white/40">{c.professor}</div>}
                          </div>
                          {selectedCourse === cName && <Check className="h-4 w-4 text-blue-400 ml-auto" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                <FileText className="h-10 w-10 text-amber-400 mx-auto mb-2" />
                <h3 className="text-[14px] font-semibold">Upload Syllabus</h3>
                <p className="text-[10px] text-white/50 mt-1">Upload the course syllabus PDF for {courseCode}</p>
              </div>
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer"
                style={{
                  borderColor: syllabusUploaded ? 'rgba(34,197,94,0.5)' : syllabusFile ? 'rgba(59,130,246,0.5)' : 'rgba(255,255,255,0.2)',
                  background: syllabusUploaded ? 'rgba(34,197,94,0.08)' : syllabusFile ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)',
                }}
                onClick={() => {
                  if (!syllabusUploaded) {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.pdf';
                    input.onchange = (e) => {
                      const f = (e.target as HTMLInputElement).files?.[0];
                      if (f) setSyllabusFile(f);
                    };
                    input.click();
                  }
                }}
                data-testid="syllabus-drop-zone"
              >
                {syllabusUploaded ? (
                  <>
                    <Check className="h-12 w-12 text-green-400 mx-auto mb-2" />
                    <p className="text-[12px] font-medium text-green-400">Syllabus Uploaded</p>
                    <p className="text-[10px] text-white/40 mt-1">{syllabusFile?.name}</p>
                  </>
                ) : syllabusFile ? (
                  <>
                    <FileText className="h-12 w-12 text-blue-400 mx-auto mb-2" />
                    <p className="text-[12px] font-medium">{syllabusFile.name}</p>
                    <p className="text-[10px] text-white/40 mt-1">{(syllabusFile.size / 1024).toFixed(0)} KB</p>
                    <Button
                      size="sm"
                      className="mt-3 px-4 text-[11px] bg-blue-600 hover:bg-blue-700"
                      onClick={(e) => { e.stopPropagation(); handleSyllabusUpload(); }}
                      disabled={syllabusUploading}
                      data-testid="btn-upload-syllabus"
                    >
                      {syllabusUploading ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Uploading...</> : <><Upload className="h-3 w-3 mr-1" /> Upload & Link</>}
                    </Button>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 text-white/30 mx-auto mb-2" />
                    <p className="text-[12px] text-white/50">Click to select syllabus PDF</p>
                    <p className="text-[9px] text-white/30 mt-1">The syllabus will be linked to the course details page and library</p>
                  </>
                )}
              </div>
              {syllabusUploaded && (
                <div className="text-[10px] text-green-400/70 text-center">
                  Linked to: Course Details page, Library shelf, BookReader toolbar
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-3">
              <div className="text-center mb-1">
                <BookOpen className="h-8 w-8 text-violet-400 mx-auto mb-1" />
                <h3 className="text-[14px] font-semibold">Modules & Readings</h3>
                <p className="text-[10px] text-white/50">Upload module files and readings for each week</p>
              </div>
              <div className="flex flex-col gap-2" style={{ maxHeight: 'calc(85vh - 200px)', overflowY: 'auto', scrollbarWidth: 'thin' }}>
                {Array.from({ length: weekCount }, (_, i) => i + 1).map(weekNum => {
                  const wk = currentSem?.semesterStartDate ? getWeekDatesForSemester(currentSem.semesterStartDate, weekNum, currentSem.readingWeekStart) : null;
                  const mod = moduleFiles[weekNum];
                  const readings = readingFiles[weekNum] || [];
                  const uploadedReadings = readings.filter(r => r.uploaded);
                  return (
                    <div key={weekNum} className="rounded-lg border border-white/10 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-center justify-between px-3 py-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold" style={{ color: courseColor }}>Week {weekNum}</span>
                          {wk && <span className="text-[9px] text-white/40">{formatDate(wk.start)} — {formatDate(wk.end)}</span>}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {mod?.uploaded && <span className="text-[8px] text-green-400 px-1.5 py-0.5 rounded bg-green-400/10">Module ✓</span>}
                          {uploadedReadings.length > 0 && <span className="text-[8px] text-blue-400 px-1.5 py-0.5 rounded bg-blue-400/10">{uploadedReadings.length} Reading{uploadedReadings.length > 1 ? 's' : ''} ✓</span>}
                        </div>
                      </div>
                      <div className="px-3 py-2 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] text-white/50 w-[55px] flex-shrink-0">Module:</span>
                          {mod?.uploaded ? (
                            <div className="flex items-center gap-1.5 flex-1">
                              <Check className="h-3 w-3 text-green-400" />
                              <span className="text-[10px] text-green-400/80 truncate">{mod.name}</span>
                            </div>
                          ) : mod?.uploading ? (
                            <div className="flex items-center gap-1.5">
                              <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                              <span className="text-[10px] text-white/50">Uploading...</span>
                            </div>
                          ) : (
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-white/60 hover:text-white/80 transition-colors">
                              <Upload className="h-3 w-3" />
                              <span>Upload Module PDF</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.pptx"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setModuleFiles(prev => ({ ...prev, [weekNum]: { file: f, uploading: false, uploaded: false, name: f.name } }));
                                    handleModuleUpload(weekNum, f);
                                  }
                                }}
                                data-testid={`input-module-${weekNum}`}
                              />
                            </label>
                          )}
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[9px] text-white/50 w-[55px] flex-shrink-0 mt-0.5">Reading:</span>
                          <div className="flex-1 flex flex-col gap-1">
                            {readings.map((r, ri) => (
                              <div key={ri} className="flex items-center gap-1.5">
                                {r.uploaded ? (
                                  <>
                                    <Check className="h-3 w-3 text-blue-400" />
                                    <span className="text-[10px] text-blue-400/80 truncate">{r.displayName || r.name}</span>
                                  </>
                                ) : r.uploading ? (
                                  <>
                                    <Loader2 className="h-3 w-3 text-blue-400 animate-spin" />
                                    <span className="text-[10px] text-white/50">Uploading...</span>
                                  </>
                                ) : null}
                              </div>
                            ))}
                            <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-white/60 hover:text-white/80 transition-colors">
                              <Upload className="h-3 w-3" />
                              <span>{readings.some(r => r.uploaded) ? 'Add Another Reading' : 'Upload Reading PDF'}</span>
                              <input
                                type="file"
                                accept=".pdf,.docx,.pptx"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    const newIdx = readings.length;
                                    setRenameDialog({ weekNum, readingIdx: newIdx, fileName: f.name, displayName: f.name.replace(/\.[^.]+$/, '') });
                                    setReadingFiles(prev => {
                                      const arr = [...(prev[weekNum] || [])];
                                      arr[newIdx] = { file: f, uploading: false, uploaded: false, name: f.name, displayName: f.name.replace(/\.[^.]+$/, '') };
                                      return { ...prev, [weekNum]: arr };
                                    });
                                  }
                                }}
                                data-testid={`input-reading-${weekNum}`}
                              />
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (() => {
            const hc = healthData?.courses.find(h => h.code.toLowerCase() === courseCode.toLowerCase());
            const ttsOk = hc ? (hc.totalTtsNeeded === 0 || hc.totalTtsReady === hc.totalTtsNeeded) : true;
            const allGood = syllabusUploaded && uploadedModules === totalModules && totalReadings > 0;
            return (
            <div className="flex flex-col gap-4">
              <div className="text-center mb-2">
                {allGood ? <Check className="h-10 w-10 text-green-400 mx-auto mb-2" /> : <AlertCircle className="h-10 w-10 text-amber-400 mx-auto mb-2" />}
                <h3 className="text-[14px] font-semibold">Summary</h3>
                <p className="text-[10px] text-white/50 mt-1">Review status for {courseCode}</p>
              </div>
              <div className="rounded-xl border border-white/15 overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
                <div className="px-4 py-3 border-b border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-medium">Completion</span>
                    <span className="text-[11px] font-bold" style={{ color: completionPct >= 100 ? '#22c55e' : completionPct >= 50 ? '#f59e0b' : '#ef4444' }}>{completionPct}%</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completionPct}%`, background: completionPct >= 100 ? '#22c55e' : completionPct >= 50 ? '#f59e0b' : '#ef4444' }} />
                  </div>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/60">Syllabus</span>
                    {syllabusUploaded ? (
                      <span className="text-[10px] text-green-400 flex items-center gap-1"><Check className="h-3 w-3" /> Linked</span>
                    ) : (
                      <span className="text-[10px] text-red-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Missing</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/60">Modules</span>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: uploadedModules === totalModules ? '#22c55e' : '#f59e0b' }}>
                      {uploadedModules === totalModules ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {uploadedModules}/{totalModules} weeks
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-white/60">Readings</span>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: totalReadings > 0 ? '#22c55e' : '#f59e0b' }}>
                      {totalReadings > 0 ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                      {totalReadings} files
                    </span>
                  </div>
                  {hc && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-white/60">TTS Ready</span>
                      <span className="text-[10px] flex items-center gap-1" style={{ color: ttsOk ? '#22c55e' : '#f59e0b' }}>
                        {ttsOk ? <Check className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                        {hc.totalTtsNeeded > 0 ? `${hc.totalTtsReady}/${hc.totalTtsNeeded}` : 'No files'}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {(uploadedModules < totalModules || !syllabusUploaded || totalReadings === 0) && (
                <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.2)' }}>
                  <div className="px-4 py-2.5 border-b" style={{ borderColor: 'rgba(239,68,68,0.15)' }}>
                    <span className="text-[10px] font-bold text-amber-400">Outstanding Items</span>
                  </div>
                  <div className="px-4 py-2.5 space-y-1">
                    {!syllabusUploaded && (
                      <div className="text-[9px] text-white/50 flex items-center gap-1.5">
                        <span style={{ color: '#f59e0b' }}>★</span> Syllabus PDF not linked
                      </div>
                    )}
                    {Array.from({ length: weekCount }, (_, i) => i + 1).filter(w => !moduleFiles[w]?.uploaded).map(w => (
                      <div key={w} className="text-[9px] text-white/50 flex items-center gap-1.5">
                        <span style={{ color: '#f59e0b' }}>★</span> Week {w} — Module missing
                      </div>
                    ))}
                    {totalReadings === 0 && (
                      <div className="text-[9px] text-white/50 flex items-center gap-1.5">
                        <span style={{ color: '#f59e0b' }}>★</span> No readings uploaded yet
                      </div>
                    )}
                  </div>
                </div>
              )}

              {allGood && (
                <div className="rounded-xl border overflow-hidden" style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.25)' }}>
                  <div className="px-4 py-3 text-center">
                    <span className="text-[10px] text-green-400 font-medium">All documents are in order for {courseCode}</span>
                  </div>
                </div>
              )}
            </div>
            );
          })()}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-white/15" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <Button
            variant="ghost"
            size="sm"
            className="text-[11px] text-white/60 hover:text-white hover:bg-white/10"
            onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            data-testid="btn-doc-wizard-back"
          >
            <ChevronLeft className="h-3 w-3 mr-1" />
            {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            size="sm"
            className="text-[11px] px-4 bg-blue-600 hover:bg-blue-700 text-white"
            disabled={step === 0 && !selectedCourse}
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                onClose();
                toast({ title: 'Course Documents Complete', description: `${courseCode} documents saved. TTS and search indexing will process in the background.` });
              }
            }}
            data-testid="btn-doc-wizard-next"
          >
            {step === 3 ? 'Done' : 'Next'}
            {step < 3 && <ChevronRight className="h-3 w-3 ml-1" />}
          </Button>
        </div>
      </div>

      {renameDialog && (
        <div className="fixed inset-0 z-[10020] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-xl p-5 text-white" style={{ width: '380px', background: 'linear-gradient(180deg, #1e293b, #0f172a)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Pencil className="h-4 w-4 text-blue-400" />
              <h4 className="text-[12px] font-semibold">Rename Reading</h4>
            </div>
            <p className="text-[10px] text-white/50 mb-3">This name will appear on the book spine in the library.</p>
            <input
              type="text"
              value={renameDialog.displayName}
              onChange={(e) => setRenameDialog({ ...renameDialog, displayName: e.target.value })}
              className="w-full h-8 px-3 text-[11px] rounded-lg bg-white/10 border border-white/20 text-white outline-none focus:border-blue-400"
              placeholder="Display name..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const { weekNum, readingIdx, displayName } = renameDialog;
                  const reading = readingFiles[weekNum]?.[readingIdx];
                  if (reading?.file) {
                    const ext = reading.name.match(/\.[^.]+$/)?.[0] || '.pdf';
                    const finalName = displayName.endsWith(ext) ? displayName : displayName + ext;
                    setReadingFiles(prev => {
                      const arr = [...(prev[weekNum] || [])];
                      arr[readingIdx] = { ...arr[readingIdx], displayName: finalName };
                      return { ...prev, [weekNum]: arr };
                    });
                    handleReadingUpload(weekNum, readingIdx, reading.file, finalName);
                  }
                  setRenameDialog(null);
                }
              }}
              data-testid="input-rename-reading"
            />
            <div className="flex items-center justify-end gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] text-white/60 hover:text-white"
                onClick={() => {
                  const { weekNum, readingIdx } = renameDialog;
                  const reading = readingFiles[weekNum]?.[readingIdx];
                  if (reading?.file) {
                    handleReadingUpload(weekNum, readingIdx, reading.file, reading.name);
                  }
                  setRenameDialog(null);
                }}
              >
                Keep Original Name
              </Button>
              <Button
                size="sm"
                className="text-[10px] bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  const { weekNum, readingIdx, displayName } = renameDialog;
                  const reading = readingFiles[weekNum]?.[readingIdx];
                  if (reading?.file) {
                    const ext = reading.name.match(/\.[^.]+$/)?.[0] || '.pdf';
                    const finalName = displayName.endsWith(ext) ? displayName : displayName + ext;
                    handleReadingUpload(weekNum, readingIdx, reading.file, finalName);
                  }
                  setRenameDialog(null);
                }}
                data-testid="btn-confirm-rename"
              >
                Save & Upload
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}

export function CourseDocumentsProgressBar({ courseCode, syllabusUploaded, moduleCount, totalWeeks }: { courseCode: string; syllabusUploaded: boolean; moduleCount: number; totalWeeks: number }) {
  const total = 1 + totalWeeks;
  const done = (syllabusUploaded ? 1 : 0) + moduleCount;
  const pct = Math.round((done / total) * 100);
  if (pct >= 100) return null;
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} data-testid="course-doc-progress">
      <FileText className="h-3 w-3 text-white/40" />
      <div className="flex-1">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.1)' }}>
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 70 ? '#f59e0b' : '#ef4444', transition: 'width 0.3s' }} />
        </div>
      </div>
      <span className="text-[8px] text-white/40">{done}/{total} docs</span>
    </div>
  );
}
