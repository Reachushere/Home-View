export interface StrikethroughLabelProps {
  id: string;
  isDropdownRow: (id: string) => boolean;
  checkedCourses: Record<string, boolean>;
  isSectionFulfilledForCourse: (id: string) => boolean;
  isCourseGreyedOut: (id: string) => boolean;
  isActiveInOtherLevel: (id: string) => boolean;
  inProgressCourses: Record<string, boolean>;
  isL2InProgressFromL1: (id: string) => boolean;
}

export function StrikethroughLabel({
  id,
  isDropdownRow,
  checkedCourses,
  isSectionFulfilledForCourse,
  isCourseGreyedOut,
  isActiveInOtherLevel,
  inProgressCourses,
  isL2InProgressFromL1,
}: StrikethroughLabelProps) {
  if (isDropdownRow(id)) return null;
  if (checkedCourses[id]) return null;
  if (isSectionFulfilledForCourse(id) || isCourseGreyedOut(id)) return <span className="text-[9px]" style={{ textDecoration: 'none', color: '#000000', fontWeight: 'normal' }}> (Requirement Met)</span>;
  if (isActiveInOtherLevel(id)) return <span className="text-[9px]" style={{ textDecoration: 'none', color: '#000000', fontWeight: 'normal' }}> (Prev. Completed)</span>;
  if (inProgressCourses[id] || isL2InProgressFromL1(id)) return null;
  return null;
}
