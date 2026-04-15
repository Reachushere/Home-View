import { useState, useEffect } from "react";
import { Home, Calendar, StickyNote, Upload, MoreHorizontal } from "lucide-react";
import type { MobileTab, TabDef } from "./types";

export function useIsLandscape() {
  const [isLandscape, setIsLandscape] = useState(() => {
    const ot = screen?.orientation?.type || '';
    return ot.includes('landscape') || (window.innerWidth > window.innerHeight);
  });
  useEffect(() => {
    const check = () => {
      const ot = screen?.orientation?.type || '';
      setIsLandscape(ot.includes('landscape') || (window.innerWidth > window.innerHeight));
    };
    const delayedCheck = () => setTimeout(check, 150);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', delayedCheck);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', delayedCheck);
    };
  }, []);
  return isLandscape;
}

export function getAvailableTabs(mobileAuth: string): TabDef[] {
  if (mobileAuth === '1010') {
    return [{ id: 'home', label: 'Home', icon: Home }];
  }
  const tabs: TabDef[] = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'calendar', label: 'Calendar', icon: Calendar },
  ];
  if (mobileAuth === '5747') {
    tabs.push({ id: 'notes', label: 'Notes', icon: StickyNote });
    tabs.push({ id: 'upload', label: 'Share', icon: Upload });
    tabs.push({ id: 'more', label: 'More', icon: MoreHorizontal });
  }
  return tabs;
}
