import cnnLogoPath from "@assets/CNN_1773536484180.png";
import cbcLogoPath from "@assets/cbc-news-logo-black-and-white_1773536865600.png";
import ctvLogoPath from "@assets/CTV2_1773545440801.png";
import globalLogoPath from "@assets/Global_White_1773536754594.png";
import msnbcLogoPath from "@assets/MSNBC_1773536950584.png";
import politicoLogoPath from "@assets/Politico_1773537080711.png";
import rawStoryLogoPath from "@assets/Raw_Story_1773607642361.png";
import abcNewsLogoPath from "@assets/ABC_1773609250051.png";
import bbcNewsLogoPath from "@assets/BBC_1773609711103.png";
import foxNewsLogoPath from "@assets/Fox_News_1773610204651.png";
import { defaultCourseDisplayNames } from "./dashboard-constants";

let _appTimezoneOverride: string | null = null;
export function getAppTz(): string { return _appTimezoneOverride || 'America/Toronto'; }
export function setAppTimezoneOverride(tz: string | null) { _appTimezoneOverride = tz; }

let _courseDisplayNames: Record<string, string> = { ...defaultCourseDisplayNames };
export const getCourseRowDisplayName = (courseName: string): string => {
  const courseCode = courseName.split(' - ')[0];
  if (_courseDisplayNames[courseCode]) {
    return _courseDisplayNames[courseCode];
  }
  return courseName;
};
export function setCourseDisplayNames(names: Record<string, string>) {
  _courseDisplayNames = names;
}
export function getCourseDisplayNames() {
  return _courseDisplayNames;
}

export const SIDEBAR_COURSES = [
  { id: "cppa122", name: "CPPA122", color: "text-green-400", hoverBg: "hover:bg-green-400/20" },
  { id: "cfnf400", name: "CFNF400", color: "text-pink-400", hoverBg: "hover:bg-pink-400/20" },
  { id: "casl101", name: "CASL101", color: "text-indigo-400", hoverBg: "hover:bg-indigo-400/20" },
];

export const FOLDER_TYPES = [
  { id: "module", name: "Module" },
  { id: "reading", name: "Reading" },
];

export const formatTimeTo12Hour = (time24: string): string => {
  let [hours, minutes] = time24.split(':').map(Number);
  if (minutes === 59) {
    minutes = 0;
    hours = hours + 1;
  }
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export const SPEAKERS = [
  { id: "browser_tts", name: "Bluetooth" },
  { id: "media_player.byhome", name: "Apartment" },
  { id: "media_player.cat_wash", name: "Cat Wash" },
  { id: "media_player.cat_wr", name: "Cat Washroom Speakers" },
  { id: "media_player.bathroom_speaker", name: "Nest (Cat Washroom)" },
  { id: "media_player.echo_cat_left_am", name: "Cat Washroom Left" },
  { id: "media_player.echo_cat_right_am", name: "Cat Washroom Right" },
  { id: "media_player.echo_cat_washroom_middle", name: "Cat Washroom Middle" },
  { id: "media_player.echo_closet_am", name: "Closet" },
  { id: "media_player.echo_lr_couch_r_am", name: "Echo Corner" },
  { id: "media_player.echo_hallway_entrance_am", name: "Hallway Entrance" },
  { id: "media_player.echo_king_l_am", name: "King Left" },
  { id: "media_player.echo_king_r_am", name: "King Right" },
  { id: "media_player.echo_king_tv_am", name: "King TV" },
  { id: "media_player.echo_kitchen_cupboards_left_am", name: "Kitchen Cupboards Left" },
  { id: "media_player.echo_kitchen_cupboards_r_am", name: "Kitchen Cupboards Right" },
  { id: "media_player.echo_kitchen_fridge_am", name: "Kitchen Fridge" },
  { id: "media_player.echo_kitchen_hutch_am", name: "Kitchen Hutch" },
  { id: "media_player.echo_kitchen_island_corner_am", name: "Kitchen Island Corner" },
  { id: "media_player.echo_kitchen_studio_black_am", name: "Kitchen Studio Black" },
  { id: "media_player.echo_lr_couch_l_am", name: "Living Room Couch Left" },
  { id: "media_player.echo_lr_hub_am", name: "Living Room Hub" },
  { id: "media_player.echo_lr_studio_white_am", name: "Living Room Studio White" },
  { id: "media_player.echo_lr_tv_shelf_am", name: "Living Room TV Shelf" },
  { id: "media_player.echo_queen_balcony_am", name: "Queen Balcony" },
  { id: "media_player.echo_queen_bed_l_am", name: "Queen Bed Left" },
  { id: "media_player.echo_queen_bed_r_am", name: "Queen Bed Right" },
  { id: "media_player.echo_show_pug_am", name: "Echo Show Pug" },
  { id: "media_player.everywhere_2", name: "Everywhere" },
  { id: "media_player.hallway", name: "Hallway" },
  { id: "media_player.king_bedroom", name: "King Bedroom" },
  { id: "media_player.queen_bedroom", name: "Queen Bedroom" },
];

export interface WeekInfo {
  weekNumber: number;
  startDate: string;
  endDate: string;
  taskCount: number;
}

export function getPointerXY(e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent): { clientX: number; clientY: number } {
  if ('touches' in e) {
    const t = e.touches[0] || (e as TouchEvent).changedTouches?.[0];
    return t ? { clientX: t.clientX, clientY: t.clientY } : { clientX: 0, clientY: 0 };
  }
  return { clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY };
}

const _etDateKeyCache = new Map<number, string>();
export function _etDateKey(date: Date): string {
  const ms = date.getTime();
  const cached = _etDateKeyCache.get(ms);
  if (cached) return cached;
  const key = date.toLocaleDateString('en-CA', { timeZone: getAppTz() });
  if (_etDateKeyCache.size > 2000) _etDateKeyCache.clear();
  _etDateKeyCache.set(ms, key);
  return key;
}

const _toETCache = new Map<number, Date>();
export function toET(date: Date): Date {
  const ms = date.getTime();
  const cached = _toETCache.get(ms);
  if (cached) return new Date(cached.getTime());
  const s = date.toLocaleString('en-US', { timeZone: getAppTz() });
  const result = new Date(s);
  if (_toETCache.size > 2000) _toETCache.clear();
  _toETCache.set(ms, result);
  return new Date(result.getTime());
}

export function getWmoEmoji(code: number, isDay: boolean = true): string {
  if (code === 0) return isDay ? '☀️' : '🌙';
  if (code === 1) return isDay ? '🌤️' : '🌙';
  if (code === 2) return '⛅';
  if (code === 3) return '☁️';
  if (code === 45 || code === 48) return '🌁';
  if (code >= 51 && code <= 55) return '🌦️';
  if (code >= 61 && code <= 65) return '🌧️';
  if (code === 66 || code === 67) return '🧊';
  if (code >= 71 && code <= 77) return '❄️';
  if (code >= 80 && code <= 82) return '🌧️';
  if (code === 85 || code === 86) return '🌨️';
  if (code >= 95) return '⛈️';
  return '🌡️';
}

export function getETHours(date: Date): number {
  return toET(date).getHours();
}

export function getETMinutes(date: Date): number {
  return toET(date).getMinutes();
}

export function startOfDayET(date: Date): Date {
  const et = toET(date);
  et.setHours(0, 0, 0, 0);
  return et;
}

export function isSameDayET(a: Date, b: Date): boolean {
  return _etDateKey(a) === _etDateKey(b);
}

export function getETDateString(date: Date): string {
  return _etDateKey(date);
}

export const TICKER_LOGO_MAP: Record<string, { src: string; height: number }> = {
  CNN: { src: cnnLogoPath, height: 33 },
  CBC: { src: cbcLogoPath, height: 78 },
  CTV: { src: ctvLogoPath, height: 42 },
  Global: { src: globalLogoPath, height: 42 },
  MSNBC: { src: msnbcLogoPath, height: 68 },
  Politico: { src: politicoLogoPath, height: 57 },
  'Raw Story': { src: rawStoryLogoPath, height: 64 },
  'ABC News': { src: abcNewsLogoPath, height: 56 },
  'BBC': { src: bbcNewsLogoPath, height: 64 },
  'Fox News': { src: foxNewsLogoPath, height: 72 },
};
