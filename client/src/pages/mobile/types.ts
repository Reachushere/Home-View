export type MobileTab = "home" | "calendar" | "notes" | "upload" | "more";

export interface TabDef {
  id: MobileTab;
  label: string;
  icon: React.ComponentType<{ style?: React.CSSProperties }>;
}

export interface CourseInfo {
  name: string;
  color: string;
  colorEnd?: string;
  professor?: string;
}

export interface CoursesData {
  courses: CourseInfo[];
}

export interface TaskItem {
  id: number;
  title: string;
  courseName?: string;
  dueDate?: string;
  type?: string;
  priority?: string;
  isCompleted?: boolean;
  description?: string;
}

export interface AnnouncementItem {
  title?: string;
  Title?: string;
  content?: string;
  isTask?: boolean;
  isWeatherAlert?: boolean;
  visibleTo?: string[];
}

export interface ShiftEntry {
  date: string;
  shiftType: string;
}

export interface SemesterSettings {
  semesterType?: string;
  semesterStartDate?: string;
  readingWeekStart?: string | null;
  [key: string]: unknown;
}

export const VALID_PASSWORDS = ["5747", "4201", "1010"];

export const glassBtnStyle = (size: number): React.CSSProperties => ({
  width: `${size}px`, height: `${size}px`, borderRadius: '12px',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 100%)',
  backdropFilter: 'blur(40px)', WebkitBackdropFilter: 'blur(40px)',
  border: '0.5px solid rgba(255,255,255,0.5)', borderTop: '0.5px solid rgba(255,255,255,0.7)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.1)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', padding: 0, color: '#ffffff', flexShrink: 0,
  flexDirection: 'column' as const, gap: '3px',
});
