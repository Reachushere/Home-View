import type { ReactNode } from "react";

export interface CourseNameProps {
  id: string;
  children: ReactNode;
  shouldStrikethrough: (id: string) => boolean;
}

export function CourseName({ id, children, shouldStrikethrough }: CourseNameProps) {
  const strike = shouldStrikethrough(id);
  return strike ? <span style={{ textDecoration: 'line-through' }}>{children}</span> : <>{children}</>;
}
