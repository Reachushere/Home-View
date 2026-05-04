import { useState, useRef, useEffect, useCallback } from "react";
import { GraduationCap, ChevronRight, ChevronLeft, Check, Cloud, Calendar, Palette, Sparkles, User, BookOpen, Settings, Wifi, X, Plus, Trash2, Upload, ExternalLink, RefreshCw } from "lucide-react";

interface SetupWizardProps {
  open: boolean;
  onClose: () => void;
  onComplete: (data: SetupResult) => void;
  colorSettings: { mainBackground: string; mainBackgroundGradientEnd: string; headerBar: string };
  existingProfile?: { firstName: string; lastName: string };
  existingSchool?: { schoolName: string; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string; lastDayOfSchoolWeek: string; timezone: string };
  existingCourses?: Array<{ name: string; color: string; colorEnd?: string; professor: string; professorEmail?: string }>;
}

interface SetupCourse {
  code: string;
  fullName: string;
  professor: string;
  professorEmail: string;
  color: string;
  colorEnd: string;
  deliveryMode: string;
  classDay: string;
  classTime: string;
  classEndTime: string;
}

interface SetupResult {
  profile: { firstName: string; lastName: string };
  school: { schoolName: string; numberOfWeeks: number; week1StartDate: string; firstDayOfWeek: string; lastDayOfSchoolWeek: string; timezone: string };
  semester: { semesterType: string; semesterYear: string; startDate: string; endDate: string; readingWeekStart: string };
  courses: SetupCourse[];
  oneDriveConnected: boolean;
  foldersCreated: boolean;
}

const STEPS = [
  { id: 'welcome', label: 'Welcome', icon: Sparkles },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'school', label: 'School', icon: GraduationCap },
  { id: 'semester', label: 'Semester', icon: Calendar },
  { id: 'courses', label: 'Courses', icon: BookOpen },
  { id: 'connections', label: 'Connections', icon: Cloud },
  { id: 'theme', label: 'Theme', icon: Palette },
  { id: 'complete', label: 'Complete', icon: Check },
];

const PRESET_COLORS = [
  { color: '#6366f1', colorEnd: '#818cf8', label: 'Indigo' },
  { color: '#ec4899', colorEnd: '#f472b6', label: 'Pink' },
  { color: '#10b981', colorEnd: '#34d399', label: 'Emerald' },
  { color: '#f59e0b', colorEnd: '#fbbf24', label: 'Amber' },
  { color: '#8b5cf6', colorEnd: '#a78bfa', label: 'Violet' },
  { color: '#ef4444', colorEnd: '#f87171', label: 'Red' },
  { color: '#06b6d4', colorEnd: '#22d3ee', label: 'Cyan' },
  { color: '#f97316', colorEnd: '#fb923c', label: 'Orange' },
  { color: '#14b8a6', colorEnd: '#2dd4bf', label: 'Teal' },
];

const THEME_PRESETS = [
  { label: 'Midnight', bg: '#0f0f23', bgEnd: '#1a1a3e', header: '#151530' },
  { label: 'Ocean', bg: '#0c1929', bgEnd: '#162d50', header: '#0f2035' },
  { label: 'Forest', bg: '#0d1f0d', bgEnd: '#1a3a1a', header: '#112211' },
  { label: 'Charcoal', bg: '#1a1a1a', bgEnd: '#2a2a2a', header: '#1e1e1e' },
  { label: 'Royal', bg: '#1a0a2e', bgEnd: '#2d1650', header: '#1e0e35' },
  { label: 'Warm Night', bg: '#1f1410', bgEnd: '#2e201a', header: '#241815' },
];

const DELIVERY_MODES = [
  { value: 'in-person', label: 'In-Person' },
  { value: 'online-sync', label: 'Online (Synchronous)' },
  { value: 'online-async', label: 'Online (Asynchronous)' },
  { value: 'hybrid', label: 'Hybrid' },
];

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function SystemSetupWizard({ open, onClose, onComplete, colorSettings, existingProfile, existingSchool, existingCourses }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [animDir, setAnimDir] = useState<'forward' | 'back'>('forward');

  const [firstName, setFirstName] = useState(existingProfile?.firstName || '');
  const [lastName, setLastName] = useState(existingProfile?.lastName || '');

  const [schoolName, setSchoolName] = useState(existingSchool?.schoolName || 'Toronto Metropolitan University');
  const [numberOfWeeks, setNumberOfWeeks] = useState(existingSchool?.numberOfWeeks || 13);
  const [timezone, setTimezone] = useState(existingSchool?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Toronto');

  const [semType, setSemType] = useState('winter');
  const [semYear, setSemYear] = useState('2026');
  const [semStartDate, setSemStartDate] = useState('2026-01-12');
  const [semEndDate, setSemEndDate] = useState('2026-04-10');
  const [readingWeekStart, setReadingWeekStart] = useState('2026-02-16');

  const [courses, setCourses] = useState<SetupCourse[]>(() => {
    if (existingCourses && existingCourses.length > 0) {
      return existingCourses.map((c, i) => {
        const parts = c.name?.split(' - ') || ['', ''];
        return {
          code: parts[0]?.trim() || '',
          fullName: parts.slice(1).join(' - ')?.trim() || '',
          professor: c.professor || '',
          professorEmail: c.professorEmail || '',
          color: c.color || PRESET_COLORS[i % PRESET_COLORS.length].color,
          colorEnd: c.colorEnd || PRESET_COLORS[i % PRESET_COLORS.length].colorEnd,
          deliveryMode: 'in-person',
          classDay: '',
          classTime: '',
          classEndTime: '',
        };
      });
    }
    return [{ code: '', fullName: '', professor: '', professorEmail: '', color: PRESET_COLORS[0].color, colorEnd: PRESET_COLORS[0].colorEnd, deliveryMode: 'in-person', classDay: '', classTime: '', classEndTime: '' }];
  });

  const [oneDriveStatus, setOneDriveStatus] = useState<'unknown' | 'checking' | 'connected' | 'disconnected'>('unknown');
  const [oneDriveFolders, setOneDriveFolders] = useState(false);
  const [folderCreating, setFolderCreating] = useState(false);
  const [calendarStatus, setCalendarStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [spotifyStatus, setSpotifyStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');

  const [selectedTheme, setSelectedTheme] = useState(0);
  const [customBg, setCustomBg] = useState(colorSettings.mainBackground);
  const [customBgEnd, setCustomBgEnd] = useState(colorSettings.mainBackgroundGradientEnd);
  const [customHeader, setCustomHeader] = useState(colorSettings.headerBar);
  const [useCustomTheme, setUseCustomTheme] = useState(false);

  const [saving, setSaving] = useState(false);

  const checkConnections = useCallback(async () => {
    setOneDriveStatus('checking');
    try {
      const res = await fetch('/api/onedrive/status', { credentials: 'include' });
      const data = await res.json();
      setOneDriveStatus(data.connected ? 'connected' : 'disconnected');
    } catch { setOneDriveStatus('disconnected'); }

    try {
      const res = await fetch('/api/google-calendar/status', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setCalendarStatus(data.connected ? 'connected' : 'disconnected');
      } else { setCalendarStatus('disconnected'); }
    } catch { setCalendarStatus('disconnected'); }

    try {
      const res = await fetch('/api/spotify/playback-state', { credentials: 'include' });
      setSpotifyStatus(res.ok ? 'connected' : 'disconnected');
    } catch { setSpotifyStatus('disconnected'); }
  }, []);

  useEffect(() => {
    if (step === 5 && oneDriveStatus === 'unknown') {
      checkConnections();
    }
  }, [step, oneDriveStatus, checkConnections]);

  const createFolders = async () => {
    setFolderCreating(true);
    try {
      const semLabel = semType === 'winter' ? 'Winter' : semType === 'fall' ? 'Fall' : 'Spring-Summer';
      for (const course of courses) {
        if (!course.code) continue;
        await fetch('/api/onedrive/create-semester-folders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ courseCode: course.code, semesterYear: semYear, semesterType: semLabel, numberOfWeeks }),
        });
      }
      setOneDriveFolders(true);
    } catch (err) {
      console.error('Folder creation error:', err);
    } finally { setFolderCreating(false); }
  };

  const goNext = () => {
    if (step < STEPS.length - 1) {
      setAnimDir('forward');
      setStep(s => s + 1);
    }
  };
  const goBack = () => {
    if (step > 0) {
      setAnimDir('back');
      setStep(s => s - 1);
    }
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 0: return true;
      case 1: return firstName.trim().length > 0;
      case 2: return schoolName.trim().length > 0 && numberOfWeeks > 0;
      case 3: return semStartDate.length > 0;
      case 4: return courses.some(c => c.code.trim().length > 0);
      default: return true;
    }
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      const semKey = (semType === 'winter' ? 'w' : semType === 'fall' ? 'f' : 'ss') + semYear;
      const semLabel = semType === 'winter' ? 'Winter' : semType === 'fall' ? 'Fall' : 'Spring-Summer';

      const profilePayload = { firstName, lastName, birthdate: '', timezone, travelTimezone: null, postalCode: '', location: '', phoneNumber: '', email: '', address: '', country: '', provinceState: '', emergencyContactName: '', emergencyContactPhone: '', allergies: '' };
      localStorage.setItem('profileData', JSON.stringify(profilePayload));

      const schoolPayload = { schoolLogo: null, schoolName, numberOfWeeks, week1StartDate: semStartDate, firstDayOfWeek: 'saturday', lastDayOfSchoolWeek: 'friday', timezone };
      localStorage.setItem('schoolData', JSON.stringify(schoolPayload));

      const coursesPayload = {
        courses: courses.filter(c => c.code.trim()).map(c => ({
          name: `${c.code.trim()} - ${c.fullName.trim()}`,
          color: c.color,
          colorEnd: c.colorEnd,
          professor: c.professor,
          professorEmail: c.professorEmail,
        }))
      };
      localStorage.setItem('coursesData', JSON.stringify(coursesPayload));

      const theme = useCustomTheme ? { mainBackground: customBg, mainBackgroundGradientEnd: customBgEnd, headerBar: customHeader } : THEME_PRESETS[selectedTheme] ? { mainBackground: THEME_PRESETS[selectedTheme].bg, mainBackgroundGradientEnd: THEME_PRESETS[selectedTheme].bgEnd, headerBar: THEME_PRESETS[selectedTheme].header } : null;
      if (theme) {
        const existing = localStorage.getItem('colorSettings');
        const parsed = existing ? JSON.parse(existing) : {};
        localStorage.setItem('colorSettings', JSON.stringify({ ...parsed, ...theme }));
      }

      const semPayload: Record<string, any> = {
        semesterName: `${semLabel} ${semYear} Semester`,
        semesterStartDate: new Date(semStartDate).toISOString(),
        semesterEndDate: semEndDate ? new Date(semEndDate).toISOString() : null,
        semesterType: semType,
        isActive: true,
        semesterKey: semKey,
      };
      if (readingWeekStart) semPayload.readingWeekStart = new Date(readingWeekStart).toISOString();
      const validCourses = courses.filter(c => c.code.trim());
      for (let i = 0; i < 3; i++) {
        const c = validCourses[i];
        const prefix = `course${i + 1}`;
        if (c) {
          semPayload[`${prefix}Code`] = c.code.trim();
          semPayload[`${prefix}Name`] = `${c.code.trim()} - ${c.fullName.trim()}`;
          semPayload[`${prefix}Professor`] = c.professor;
          semPayload[`${prefix}ProfessorEmail`] = c.professorEmail;
          semPayload[`${prefix}Color`] = c.color;
          semPayload[`${prefix}ColorEnd`] = c.colorEnd;
          semPayload[`${prefix}DeliveryMode`] = c.deliveryMode;
          semPayload[`${prefix}ClassDay`] = c.classDay;
          semPayload[`${prefix}ClassTime`] = c.classTime;
          semPayload[`${prefix}ClassEndTime`] = c.classEndTime;
        } else {
          semPayload[`${prefix}Code`] = '';
          semPayload[`${prefix}Name`] = '';
        }
      }

      await fetch('/api/semester', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(semPayload),
      });

      await fetch('/api/degree-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'schoolData', value: schoolPayload }),
      }).catch(() => {});

      await fetch('/api/degree-tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'coursesData', value: coursesPayload }),
      }).catch(() => {});

      localStorage.setItem('unical_setup_complete', 'true');

      onComplete({
        profile: { firstName, lastName },
        school: schoolPayload,
        semester: { semesterType: semType, semesterYear: semYear, startDate: semStartDate, endDate: semEndDate, readingWeekStart },
        courses: validCourses,
        oneDriveConnected: oneDriveStatus === 'connected',
        foldersCreated: oneDriveFolders,
      });
    } catch (err) {
      console.error('Setup error:', err);
    } finally { setSaving(false); }
  };

  const updateCourse = (idx: number, field: keyof SetupCourse, value: string) => {
    setCourses(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c));
  };

  const addCourse = () => {
    if (courses.length >= 3) return;
    const nextColor = PRESET_COLORS[courses.length % PRESET_COLORS.length];
    setCourses(prev => [...prev, { code: '', fullName: '', professor: '', professorEmail: '', color: nextColor.color, colorEnd: nextColor.colorEnd, deliveryMode: 'in-person', classDay: '', classTime: '', classEndTime: '' }]);
  };

  const removeCourse = (idx: number) => {
    if (courses.length <= 1) return;
    setCourses(prev => prev.filter((_, i) => i !== idx));
  };

  if (!open) return null;

  const inputStyle = { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)' };
  const selectStyle = { ...inputStyle, WebkitAppearance: 'none' as const, color: 'white' };

  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="flex flex-col items-center justify-center text-center py-8" data-testid="setup-step-welcome">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-6" style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(236,72,153,0.3))', border: '2px solid rgba(255,255,255,0.2)' }}>
              <GraduationCap className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-[22px] font-bold text-white mb-3">Welcome to UniCal</h2>
            <p className="text-[14px] text-white/70 max-w-sm leading-relaxed mb-6">
              Your academic command center. Let's get everything set up in just a few minutes.
            </p>
            <div className="flex flex-col gap-2 text-left w-full max-w-xs">
              {['Set up your profile & school', 'Configure your semester & courses', 'Connect OneDrive & integrations', 'Choose your theme'].map((item, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: 'rgba(99,102,241,0.3)', border: '1px solid rgba(99,102,241,0.5)' }}>{i + 1}</div>
                  <span className="text-[13px] text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5" data-testid="setup-step-profile">
            <div>
              <h3 className="text-[16px] font-bold text-white mb-1">Your Profile</h3>
              <p className="text-[13px] text-white/60">Tell us who you are.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">First Name *</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-white/30" style={inputStyle} data-testid="input-setup-firstname" />
              </div>
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-white/30" style={inputStyle} data-testid="input-setup-lastname" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Timezone</label>
              <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none" style={selectStyle} data-testid="select-setup-timezone">
                {['America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Vancouver', 'Europe/London', 'Europe/Paris', 'Asia/Tokyo', 'Australia/Sydney'].map(tz => (
                  <option key={tz} value={tz} style={{ color: 'black' }}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5" data-testid="setup-step-school">
            <div>
              <h3 className="text-[16px] font-bold text-white mb-1">School Settings</h3>
              <p className="text-[13px] text-white/60">Configure your institution details.</p>
            </div>
            <div>
              <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">School Name *</label>
              <input value={schoolName} onChange={e => setSchoolName(e.target.value)} placeholder="University name" className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400 placeholder:text-white/30" style={inputStyle} data-testid="input-setup-school" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Weeks per Semester</label>
                <input type="number" value={numberOfWeeks} onChange={e => setNumberOfWeeks(parseInt(e.target.value) || 13)} min={1} max={20} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-400" style={inputStyle} data-testid="input-setup-weeks" />
              </div>
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Timezone</label>
                <select value={timezone} onChange={e => setTimezone(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none" style={selectStyle} data-testid="select-setup-school-tz">
                  {['America/Toronto', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Vancouver', 'Europe/London'].map(tz => (
                    <option key={tz} value={tz} style={{ color: 'black' }}>{tz.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5" data-testid="setup-step-semester">
            <div>
              <h3 className="text-[16px] font-bold text-white mb-1">Semester Configuration</h3>
              <p className="text-[13px] text-white/60">Set up your current or upcoming semester.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Semester Type</label>
                <select value={semType} onChange={e => setSemType(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none" style={selectStyle} data-testid="select-setup-semtype">
                  <option value="winter" style={{ color: 'black' }}>Winter</option>
                  <option value="spring_summer" style={{ color: 'black' }}>Spring-Summer</option>
                  <option value="fall" style={{ color: 'black' }}>Fall</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Year</label>
                <select value={semYear} onChange={e => setSemYear(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none" style={selectStyle} data-testid="select-setup-semyear">
                  {['2025', '2026', '2027', '2028', '2029'].map(y => (
                    <option key={y} value={y} style={{ color: 'black' }}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Semester Start Date *</label>
                <input type="date" value={semStartDate} onChange={e => setSemStartDate(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none [color-scheme:dark]" style={inputStyle} data-testid="input-setup-semstart" />
              </div>
              <div>
                <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Semester End Date</label>
                <input type="date" value={semEndDate} onChange={e => setSemEndDate(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none [color-scheme:dark]" style={inputStyle} data-testid="input-setup-semend" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-white/50 uppercase tracking-wider font-medium mb-1 block">Reading Week Start</label>
              <input type="date" value={readingWeekStart} onChange={e => setReadingWeekStart(e.target.value)} className="w-full text-white text-[14px] px-3 py-2.5 rounded-lg focus:outline-none [color-scheme:dark]" style={inputStyle} data-testid="input-setup-readingweek" />
              <p className="text-[11px] text-white/40 mt-1">The Monday that reading week begins. Leave blank if not applicable.</p>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4" data-testid="setup-step-courses">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-white mb-1">Your Courses</h3>
                <p className="text-[13px] text-white/60">Add up to 3 courses for this semester.</p>
              </div>
              {courses.length < 3 && (
                <button onClick={addCourse} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium text-white/80 hover:text-white transition-colors" style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)' }} data-testid="button-add-course">
                  <Plus className="w-3.5 h-3.5" /> Add Course
                </button>
              )}
            </div>
            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {courses.map((course, idx) => (
                <div key={idx} className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} data-testid={`setup-course-${idx}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full" style={{ background: `linear-gradient(135deg, ${course.color}, ${course.colorEnd})` }} />
                      <span className="text-[13px] font-semibold text-white">Course {idx + 1}</span>
                    </div>
                    {courses.length > 1 && (
                      <button onClick={() => removeCourse(idx)} className="text-white/30 hover:text-red-400 transition-colors" data-testid={`button-remove-course-${idx}`}>
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Course Code *</label>
                      <input value={course.code} onChange={e => updateCourse(idx, 'code', e.target.value.toUpperCase())} placeholder="CPPA 122" className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none placeholder:text-white/25" style={inputStyle} data-testid={`input-course-code-${idx}`} />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Course Name</label>
                      <input value={course.fullName} onChange={e => updateCourse(idx, 'fullName', e.target.value)} placeholder="Intro to Criminal Law" className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none placeholder:text-white/25" style={inputStyle} data-testid={`input-course-name-${idx}`} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Professor</label>
                      <input value={course.professor} onChange={e => updateCourse(idx, 'professor', e.target.value)} placeholder="Professor name" className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none placeholder:text-white/25" style={inputStyle} data-testid={`input-course-prof-${idx}`} />
                    </div>
                    <div>
                      <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Professor Email</label>
                      <input value={course.professorEmail} onChange={e => updateCourse(idx, 'professorEmail', e.target.value)} placeholder="prof@tmu.ca" className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none placeholder:text-white/25" style={inputStyle} data-testid={`input-course-email-${idx}`} />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Delivery Mode</label>
                    <select value={course.deliveryMode} onChange={e => updateCourse(idx, 'deliveryMode', e.target.value)} className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none" style={selectStyle} data-testid={`select-course-delivery-${idx}`}>
                      {DELIVERY_MODES.map(dm => <option key={dm.value} value={dm.value} style={{ color: 'black' }}>{dm.label}</option>)}
                    </select>
                  </div>
                  {course.deliveryMode !== 'online-async' && (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Class Day</label>
                        <select value={course.classDay} onChange={e => updateCourse(idx, 'classDay', e.target.value)} className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none" style={selectStyle} data-testid={`select-course-day-${idx}`}>
                          <option value="" style={{ color: 'black' }}>Select...</option>
                          {DAYS.map(d => <option key={d} value={d.toLowerCase()} style={{ color: 'black' }}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">Start Time</label>
                        <input type="time" value={course.classTime} onChange={e => updateCourse(idx, 'classTime', e.target.value)} className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none [color-scheme:dark]" style={inputStyle} data-testid={`input-course-start-${idx}`} />
                      </div>
                      <div>
                        <label className="text-[10px] text-white/40 uppercase font-medium block mb-0.5">End Time</label>
                        <input type="time" value={course.classEndTime} onChange={e => updateCourse(idx, 'classEndTime', e.target.value)} className="w-full text-white text-[13px] px-2.5 py-2 rounded-lg focus:outline-none [color-scheme:dark]" style={inputStyle} data-testid={`input-course-end-${idx}`} />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-medium block mb-1.5">Color</label>
                    <div className="flex gap-1.5 flex-wrap">
                      {PRESET_COLORS.map((pc, ci) => (
                        <button key={ci} onClick={() => { updateCourse(idx, 'color', pc.color); updateCourse(idx, 'colorEnd', pc.colorEnd); }} className="w-7 h-7 rounded-full transition-transform hover:scale-110" style={{ background: `linear-gradient(135deg, ${pc.color}, ${pc.colorEnd})`, outline: course.color === pc.color ? '2px solid white' : 'none', outlineOffset: '2px' }} title={pc.label} data-testid={`color-${idx}-${ci}`} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-5" data-testid="setup-step-connections">
            <div>
              <h3 className="text-[16px] font-bold text-white mb-1">Connections</h3>
              <p className="text-[13px] text-white/60">Connect your services. You can skip and set these up later.</p>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,120,212,0.2)' }}>
                  <Cloud className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-white">OneDrive</div>
                  <div className="text-[11px] text-white/50">Course materials & file sync</div>
                </div>
                {oneDriveStatus === 'checking' ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : oneDriveStatus === 'connected' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                ) : (
                  <button onClick={() => window.open('/api/onedrive/auth', '_blank')} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white" style={{ background: 'rgba(0,120,212,0.3)', border: '1px solid rgba(0,120,212,0.5)' }} data-testid="button-connect-onedrive">
                    Connect
                  </button>
                )}
              </div>

              {oneDriveStatus === 'connected' && (
                <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(34,197,94,0.15)' }}>
                    <Upload className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-semibold text-white">Create Course Folders</div>
                    <div className="text-[11px] text-white/50">Set up the OneDrive folder structure for all courses</div>
                  </div>
                  {oneDriveFolders ? (
                    <div className="flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span className="text-[11px] text-emerald-400 font-medium">Created</span>
                    </div>
                  ) : (
                    <button onClick={createFolders} disabled={folderCreating} className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white flex items-center gap-1.5" style={{ background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)' }} data-testid="button-create-folders">
                      {folderCreating ? <><div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Creating...</> : 'Create Folders'}
                    </button>
                  )}
                </div>
              )}

              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(66,133,244,0.2)' }}>
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-white">Google Calendar</div>
                  <div className="text-[11px] text-white/50">Sync tasks with your calendar</div>
                </div>
                {calendarStatus === 'connected' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                ) : (
                  <span className="text-[11px] text-white/40">Configure in Settings</span>
                )}
              </div>

              <div className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'rgba(30,215,96,0.2)' }}>
                  <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" /></svg>
                </div>
                <div className="flex-1">
                  <div className="text-[13px] font-semibold text-white">Spotify</div>
                  <div className="text-[11px] text-white/50">Music playback control</div>
                </div>
                {spotifyStatus === 'connected' ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-emerald-400 font-medium">Connected</span>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  </div>
                ) : (
                  <span className="text-[11px] text-white/40">Configure in Settings</span>
                )}
              </div>
            </div>
            <button onClick={checkConnections} className="flex items-center gap-1.5 text-[12px] text-white/50 hover:text-white/80 transition-colors mx-auto" data-testid="button-refresh-connections">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh status
            </button>
          </div>
        );

      case 6:
        return (
          <div className="space-y-5" data-testid="setup-step-theme">
            <div>
              <h3 className="text-[16px] font-bold text-white mb-1">Choose Your Theme</h3>
              <p className="text-[13px] text-white/60">Pick a background theme for your dashboard.</p>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {THEME_PRESETS.map((theme, i) => (
                <button key={i} onClick={() => { setSelectedTheme(i); setUseCustomTheme(false); }} className="rounded-xl overflow-hidden transition-transform hover:scale-105" style={{ outline: !useCustomTheme && selectedTheme === i ? '2px solid rgba(99,102,241,0.8)' : 'none', outlineOffset: '2px' }} data-testid={`theme-preset-${i}`}>
                  <div className="h-16 w-full" style={{ background: `linear-gradient(180deg, ${theme.bg} 0%, ${theme.bgEnd} 100%)` }}>
                    <div className="h-3 w-full" style={{ background: theme.header, opacity: 0.8 }} />
                  </div>
                  <div className="px-2 py-1.5 text-center" style={{ background: theme.bg }}>
                    <span className="text-[10px] text-white/70 font-medium">{theme.label}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="rounded-xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={useCustomTheme} onChange={e => setUseCustomTheme(e.target.checked)} className="w-4 h-4 rounded" data-testid="checkbox-custom-theme" />
                <span className="text-[13px] text-white/80 font-medium">Use custom colors</span>
              </label>
              {useCustomTheme && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-medium block mb-1">Background</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={customBg} onChange={e => setCustomBg(e.target.value)} className="w-8 h-8 rounded cursor-pointer" data-testid="input-custom-bg" />
                      <span className="text-[11px] text-white/50 font-mono">{customBg}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-medium block mb-1">Gradient End</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={customBgEnd} onChange={e => setCustomBgEnd(e.target.value)} className="w-8 h-8 rounded cursor-pointer" data-testid="input-custom-bgend" />
                      <span className="text-[11px] text-white/50 font-mono">{customBgEnd}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-white/40 uppercase font-medium block mb-1">Header</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={customHeader} onChange={e => setCustomHeader(e.target.value)} className="w-8 h-8 rounded cursor-pointer" data-testid="input-custom-header" />
                      <span className="text-[11px] text-white/50 font-mono">{customHeader}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
              <div className="text-[10px] text-white/40 uppercase font-medium px-3 pt-2 pb-1">Preview</div>
              {(() => {
                const t = useCustomTheme ? { bg: customBg, bgEnd: customBgEnd, header: customHeader } : THEME_PRESETS[selectedTheme];
                return (
                  <div className="h-24 mx-3 mb-3 rounded-lg overflow-hidden" style={{ background: `linear-gradient(180deg, ${t.bg} 0%, ${t.bgEnd} 100%)` }}>
                    <div className="h-4" style={{ background: t.header }} />
                    <div className="flex gap-2 p-2">
                      {courses.filter(c => c.code).map((c, i) => (
                        <div key={i} className="flex-1 h-8 rounded" style={{ background: `linear-gradient(135deg, ${c.color}, ${c.colorEnd})`, opacity: 0.6 }} />
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="flex flex-col items-center justify-center text-center py-6" data-testid="setup-step-complete">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5" style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.3), rgba(16,185,129,0.3))', border: '2px solid rgba(34,197,94,0.4)' }}>
              <Check className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-[22px] font-bold text-white mb-2">You're All Set!</h2>
            <p className="text-[14px] text-white/60 max-w-sm leading-relaxed mb-6">
              UniCal is ready to go. Here's a summary of your setup:
            </p>
            <div className="w-full max-w-sm space-y-2 text-left">
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <User className="w-4 h-4 text-white/50" />
                <span className="text-[13px] text-white/80">{firstName} {lastName}</span>
                <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <GraduationCap className="w-4 h-4 text-white/50" />
                <span className="text-[13px] text-white/80">{schoolName}</span>
                <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Calendar className="w-4 h-4 text-white/50" />
                <span className="text-[13px] text-white/80">{semType === 'winter' ? 'Winter' : semType === 'fall' ? 'Fall' : 'Spring-Summer'} {semYear}</span>
                <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <BookOpen className="w-4 h-4 text-white/50" />
                <span className="text-[13px] text-white/80">{courses.filter(c => c.code).length} course{courses.filter(c => c.code).length !== 1 ? 's' : ''} configured</span>
                <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" />
              </div>
              <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <Cloud className="w-4 h-4 text-white/50" />
                <span className="text-[13px] text-white/80">OneDrive {oneDriveStatus === 'connected' ? 'connected' : 'not connected'}</span>
                {oneDriveStatus === 'connected' ? <Check className="w-3.5 h-3.5 text-emerald-400 ml-auto" /> : <span className="text-[11px] text-amber-400 ml-auto">Skip for now</span>}
              </div>
            </div>
          </div>
        );

      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[10020] flex items-center justify-center" data-testid="system-setup-wizard">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-[10021] rounded-2xl overflow-hidden flex flex-col" style={{
        width: '560px', maxWidth: '94%', maxHeight: '85vh',
        background: `linear-gradient(180deg, ${colorSettings.mainBackground} 0%, color-mix(in srgb, ${colorSettings.mainBackgroundGradientEnd} 70%, black) 100%)`,
        border: '1.5px solid rgba(255,255,255,0.25)',
        boxShadow: '0 16px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
      }}>
        <div className="px-5 py-3 border-b border-white/20 flex items-center gap-3" style={{
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          background: `linear-gradient(180deg, rgba(255,255,255,0.2) 0%, ${colorSettings.headerBar}cc 40%, ${colorSettings.headerBar}bb 100%)`,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
        }}>
          <Settings className="w-4 h-4 text-white/70" />
          <span className="text-[12px] font-bold text-white uppercase tracking-wider" style={{ fontFamily: 'Avenir, system-ui, sans-serif' }}>SYSTEM SETUP</span>
          <span className="ml-auto text-[11px] text-white/50">Step {step + 1} of {STEPS.length}</span>
          <button onClick={onClose} className="ml-2 text-white/40 hover:text-white/80 transition-colors" data-testid="button-close-setup">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-white/10">
          <div className="flex gap-1">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <button key={i} onClick={() => { setAnimDir(i > step ? 'forward' : 'back'); setStep(i); }} className="flex-1 flex flex-col items-center gap-1 py-1 rounded-lg transition-all" style={{ opacity: i === step ? 1 : i < step ? 0.7 : 0.35 }} data-testid={`setup-nav-${s.id}`}>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{
                    background: i < step ? 'rgba(34,197,94,0.3)' : i === step ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${i < step ? 'rgba(34,197,94,0.5)' : i === step ? 'rgba(99,102,241,0.5)' : 'rgba(255,255,255,0.1)'}`,
                  }}>
                    {i < step ? <Check className="w-3 h-3 text-emerald-400" /> : <Icon className="w-3 h-3 text-white" />}
                  </div>
                  <span className="text-[9px] text-white/60 font-medium hidden sm:block">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6" style={{ scrollbarWidth: 'thin' }}>
          {renderStep()}
        </div>

        <div className="px-5 py-3 border-t border-white/15 flex items-center justify-between" style={{ background: 'rgba(0,0,0,0.15)' }}>
          {step > 0 ? (
            <button onClick={goBack} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-medium text-white/70 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }} data-testid="button-setup-back">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < STEPS.length - 1 ? (
            <button onClick={goNext} disabled={!canProceed()} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all disabled:opacity-40" style={{
              background: canProceed() ? 'linear-gradient(135deg, rgba(99,102,241,0.5), rgba(139,92,246,0.5))' : 'rgba(255,255,255,0.08)',
              border: `1px solid ${canProceed() ? 'rgba(99,102,241,0.6)' : 'rgba(255,255,255,0.1)'}`,
              boxShadow: canProceed() ? '0 4px 12px rgba(99,102,241,0.2)' : 'none',
            }} data-testid="button-setup-next">
              {step === 0 ? "Let's Go" : 'Continue'} <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button onClick={handleComplete} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all" style={{
              background: 'linear-gradient(135deg, rgba(34,197,94,0.4), rgba(16,185,129,0.4))',
              border: '1px solid rgba(34,197,94,0.5)',
              boxShadow: '0 4px 12px rgba(34,197,94,0.2)',
            }} data-testid="button-setup-finish">
              {saving ? <><div className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" /> Saving...</> : <><Sparkles className="w-4 h-4" /> Launch UniCal</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
