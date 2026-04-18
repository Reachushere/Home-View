import React, { useState, useRef, useEffect, useMemo } from "react";
import Cropper from "react-easy-crop";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { DayPicker } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpload } from "@/hooks/use-upload";
import { useToast } from "@/hooks/use-toast";
import {
  FileText,
  FolderOpen,
  GraduationCap,
  Calendar,
  CalendarDays,
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  X,
  Link,
  Paperclip,
  Upload,
  Camera,
  Loader2,
  Trash2,
  Cloud,
  ExternalLink,
  Eye,
  EyeOff,
  Pencil,
  Check,
  ListChecks,
  Mail,
  Flag,
  AlertTriangle,
  Plane,
  Bell,
  User,
  Minus,
} from "lucide-react";
import type { Task, SemesterSettings, Subtask, Project, TaskLink, CourseWeekMapping } from "@shared/schema";
import { TASK_TYPES, COURSES, getWeekNumber, REMINDER_OPTIONS, DEFAULT_REMINDER_1, DEFAULT_REMINDER_2, REPEAT_TYPES, REPEAT_INTERVAL_UNITS } from "@shared/schema";
import { getETHours, getETMinutes } from "./dashboard-utils";
import { format, addDays, startOfWeek, endOfWeek } from "date-fns";
import { iconMap, calendarTypeIconColors } from "./dashboard-constants";
import { formatTimeTo12Hour } from "./dashboard-utils";
import tmuLogo from "@assets/Chang-School2_1775779674508.png";
import zoomCamPath from "@assets/Zoomcam_1773655084814.png";
import pdfAttachIconPath from "@assets/image_1775209235777.png";


export interface FileRecord {
  id: number;
  originalName: string;
  displayName: string;
  objectPath: string;
  contentType: string;
  size: number;
  folder: string | null;
}

export function FileSelector({ 
  onSelect, 
  excludePaths,
  courseName 
}: { 
  onSelect: (objectPath: string) => void;
  excludePaths: string[];
  courseName?: string;
}) {
  const { data: files = [] } = useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });

  const courseCode = courseName ? courseName.split(' - ')[0].trim().toLowerCase() : '';

  const availableFiles = files
    .filter(f => !excludePaths.includes(f.objectPath))
    .filter(f => {
      if (!courseCode) return true;
      if (!f.folder) return false;
      return f.folder.toLowerCase().includes(courseCode);
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { numeric: true, sensitivity: 'base' }));

  if (availableFiles.length === 0) {
    return (
      <Button type="button" variant="outline" disabled className="flex-1 !text-black bg-white h-8" style={{ fontSize: '12px' }} data-testid="button-select-file-empty">
        <FolderOpen className="h-3 w-3 mr-1" />
        No Files
      </Button>
    );
  }

  return (
    <Select onValueChange={onSelect}>
      <SelectTrigger className="flex-1 !text-black [&_*]:!text-black bg-white h-8" style={{ color: 'black', fontSize: '12px' }} data-testid="select-existing-file">
        <FolderOpen className="h-3 w-3 mr-1" />
        <SelectValue placeholder="Select File" />
      </SelectTrigger>
      <SelectContent style={{ zIndex: 99999 }}>
        {availableFiles.map(file => (
          <SelectItem key={file.id} value={file.objectPath}>
            {file.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ProfileForm({ 
  profileData, 
  timezones, 
  onSave,
  onCancel,
  profilePhotoUrl,
  onProfilePhotoChange,
  schoolData,
  onSchoolSave,
  onDirtyChange,
  timezoneOverride,
  onTimezoneOverrideChange
}: { 
  profileData: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null; postalCode: string; location: string; phoneNumber: string; email: string; address: string; country: string; provinceState: string; emergencyContactName: string; emergencyContactPhone: string; allergies: string };
  timezones: { value: string; label: string }[];
  onSave: (data: { firstName: string; lastName: string; birthdate: string; timezone: string; travelTimezone: string | null; postalCode: string; location: string; phoneNumber: string; email: string; address: string; country: string; provinceState: string; emergencyContactName: string; emergencyContactPhone: string; allergies: string }) => void;
  onCancel: () => void;
  profilePhotoUrl: string | null;
  onProfilePhotoChange: (url: string | null) => void;
  schoolData: { schoolLogo: string | null; schoolName: string };
  onSchoolSave: (data: { schoolLogo: string | null; schoolName: string }) => void;
  onDirtyChange?: (dirty: boolean) => void;
  timezoneOverride?: boolean;
  onTimezoneOverrideChange?: (val: boolean) => void;
}) {
  const [firstName, setFirstName] = useState(profileData.firstName);
  const [lastName, setLastName] = useState(profileData.lastName);
  const [birthdate, setBirthdate] = useState(profileData.birthdate);
  const [timezone, setTimezone] = useState(profileData.timezone);
  const [travelTimezone, setTravelTimezone] = useState<string | null>(profileData.travelTimezone);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [isTraveling, setIsTraveling] = useState(!!profileData.travelTimezone);
  const [postalCode, setPostalCode] = useState(profileData.postalCode || '');
  const [location, setLocation] = useState(profileData.location || '');
  const [phoneNumber, setPhoneNumber] = useState(profileData.phoneNumber || '');
  const [email, setEmail] = useState(profileData.email || '');
  const [address, setAddress] = useState(profileData.address || '');
  const [country, setCountry] = useState(profileData.country || '');
  const [provinceState, setProvinceState] = useState(profileData.provinceState || '');
  const [emergencyContactName, setEmergencyContactName] = useState(profileData.emergencyContactName || '');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(profileData.emergencyContactPhone || '');
  const [allergies, setAllergies] = useState(profileData.allergies || '');
  const [osapNumber, setOsapNumber] = useState(() => localStorage.getItem('osapNumber') || '');
  const [studentNumber, setStudentNumber] = useState(() => localStorage.getItem('studentNumber') || '');
  const [osapPassword, setOsapPassword] = useState(() => localStorage.getItem('osapPassword') || '');
  const [showOsapPassword, setShowOsapPassword] = useState(false);
  const [ouacUsername, setOuacUsername] = useState(() => localStorage.getItem('ouacUsername') || '');
  const [oenNumber, setOenNumber] = useState(() => localStorage.getItem('oenNumber') || '');
  const closingRef = useRef(false);

  const initialSnap = useRef({
    firstName: profileData.firstName,
    lastName: profileData.lastName,
    birthdate: profileData.birthdate,
    timezone: profileData.timezone,
    travelTimezone: profileData.travelTimezone,
    postalCode: profileData.postalCode || '',
    location: profileData.location || '',
    phoneNumber: profileData.phoneNumber || '',
    email: profileData.email || '',
    address: profileData.address || '',
    country: profileData.country || '',
    provinceState: profileData.provinceState || '',
    emergencyContactName: profileData.emergencyContactName || '',
    emergencyContactPhone: profileData.emergencyContactPhone || '',
    allergies: profileData.allergies || '',
  });

  useEffect(() => {
    const s = initialSnap.current;
    const dirty = firstName !== s.firstName || lastName !== s.lastName || birthdate !== s.birthdate || timezone !== s.timezone || (isTraveling ? travelTimezone : null) !== s.travelTimezone || postalCode !== s.postalCode || location !== s.location || phoneNumber !== s.phoneNumber || email !== s.email || address !== s.address || country !== s.country || provinceState !== s.provinceState || emergencyContactName !== s.emergencyContactName || emergencyContactPhone !== s.emergencyContactPhone || allergies !== s.allergies;
    onDirtyChange?.(dirty);
  }, [firstName, lastName, birthdate, timezone, travelTimezone, isTraveling, postalCode, location, phoneNumber, email, address, country, provinceState, emergencyContactName, emergencyContactPhone, allergies, onDirtyChange]);

  useEffect(() => {
    fetch('/api/ui-settings/osapNumber').then(r => r.json()).then(d => { if (d.value) setOsapNumber(d.value); }).catch(() => {});
    fetch('/api/ui-settings/studentNumber').then(r => r.json()).then(d => { if (d.value) setStudentNumber(d.value); }).catch(() => {});
    fetch('/api/ui-settings/osapPassword').then(r => r.json()).then(d => { if (d.value) setOsapPassword(d.value); }).catch(() => {});
    fetch('/api/ui-settings/ouacUsername').then(r => r.json()).then(d => { if (d.value) setOuacUsername(d.value); }).catch(() => {});
    fetch('/api/ui-settings/oenNumber').then(r => r.json()).then(d => { if (d.value) setOenNumber(d.value); }).catch(() => {});
  }, []);

  const [schoolName, setSchoolName] = useState(schoolData.schoolName || 'Toronto Metropolitan University');
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [schoolLogoPreview, setSchoolLogoPreview] = useState<string | null>(schoolData.schoolLogo);
  const schoolLogoInputRef = useRef<HTMLInputElement>(null);

  const COUNTRIES = [
    { value: 'CA', label: 'Canada' },
    { value: 'US', label: 'United States' },
    { value: 'UK', label: 'United Kingdom' },
    { value: 'AU', label: 'Australia' },
    { value: 'FR', label: 'France' },
    { value: 'DE', label: 'Germany' },
    { value: 'IN', label: 'India' },
    { value: 'JP', label: 'Japan' },
    { value: 'MX', label: 'Mexico' },
    { value: 'BR', label: 'Brazil' },
    { value: 'other', label: 'Other' },
  ];

  const PROVINCES_STATES: Record<string, { value: string; label: string }[]> = {
    CA: [
      { value: 'AB', label: 'Alberta' }, { value: 'BC', label: 'British Columbia' }, { value: 'MB', label: 'Manitoba' },
      { value: 'NB', label: 'New Brunswick' }, { value: 'NL', label: 'Newfoundland and Labrador' }, { value: 'NS', label: 'Nova Scotia' },
      { value: 'NT', label: 'Northwest Territories' }, { value: 'NU', label: 'Nunavut' }, { value: 'ON', label: 'Ontario' },
      { value: 'PE', label: 'Prince Edward Island' }, { value: 'QC', label: 'Quebec' }, { value: 'SK', label: 'Saskatchewan' }, { value: 'YT', label: 'Yukon' },
    ],
    US: [
      { value: 'AL', label: 'Alabama' }, { value: 'AK', label: 'Alaska' }, { value: 'AZ', label: 'Arizona' }, { value: 'AR', label: 'Arkansas' },
      { value: 'CA', label: 'California' }, { value: 'CO', label: 'Colorado' }, { value: 'CT', label: 'Connecticut' }, { value: 'DE', label: 'Delaware' },
      { value: 'FL', label: 'Florida' }, { value: 'GA', label: 'Georgia' }, { value: 'HI', label: 'Hawaii' }, { value: 'ID', label: 'Idaho' },
      { value: 'IL', label: 'Illinois' }, { value: 'IN', label: 'Indiana' }, { value: 'IA', label: 'Iowa' }, { value: 'KS', label: 'Kansas' },
      { value: 'KY', label: 'Kentucky' }, { value: 'LA', label: 'Louisiana' }, { value: 'ME', label: 'Maine' }, { value: 'MD', label: 'Maryland' },
      { value: 'MA', label: 'Massachusetts' }, { value: 'MI', label: 'Michigan' }, { value: 'MN', label: 'Minnesota' }, { value: 'MS', label: 'Mississippi' },
      { value: 'MO', label: 'Missouri' }, { value: 'MT', label: 'Montana' }, { value: 'NE', label: 'Nebraska' }, { value: 'NV', label: 'Nevada' },
      { value: 'NH', label: 'New Hampshire' }, { value: 'NJ', label: 'New Jersey' }, { value: 'NM', label: 'New Mexico' }, { value: 'NY', label: 'New York' },
      { value: 'NC', label: 'North Carolina' }, { value: 'ND', label: 'North Dakota' }, { value: 'OH', label: 'Ohio' }, { value: 'OK', label: 'Oklahoma' },
      { value: 'OR', label: 'Oregon' }, { value: 'PA', label: 'Pennsylvania' }, { value: 'RI', label: 'Rhode Island' }, { value: 'SC', label: 'South Carolina' },
      { value: 'SD', label: 'South Dakota' }, { value: 'TN', label: 'Tennessee' }, { value: 'TX', label: 'Texas' }, { value: 'UT', label: 'Utah' },
      { value: 'VT', label: 'Vermont' }, { value: 'VA', label: 'Virginia' }, { value: 'WA', label: 'Washington' }, { value: 'WV', label: 'West Virginia' },
      { value: 'WI', label: 'Wisconsin' }, { value: 'WY', label: 'Wyoming' }, { value: 'DC', label: 'District of Columbia' },
    ],
    AU: [
      { value: 'ACT', label: 'Australian Capital Territory' }, { value: 'NSW', label: 'New South Wales' }, { value: 'NT', label: 'Northern Territory' },
      { value: 'QLD', label: 'Queensland' }, { value: 'SA', label: 'South Australia' }, { value: 'TAS', label: 'Tasmania' },
      { value: 'VIC', label: 'Victoria' }, { value: 'WA', label: 'Western Australia' },
    ],
  };

  const regionLabel = country === 'CA' ? 'Province' : country === 'US' ? 'State' : country === 'AU' ? 'State/Territory' : 'Province/State';
  const regionOptions = PROVINCES_STATES[country] || [];
  
  const handleSchoolLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const maxW = 300;
      const maxH = 150;
      let w = img.width;
      let h = img.height;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/png', 0.9);
      setSchoolLogoPreview(dataUrl);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleClose = () => {
    closingRef.current = true;
    onCancel();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ firstName, lastName, birthdate, timezone, travelTimezone: isTraveling ? travelTimezone : null, postalCode, location, phoneNumber, email, address, country, provinceState, emergencyContactName, emergencyContactPhone, allergies });
    const finalSchoolName = schoolName === 'Other' ? customSchoolName : schoolName;
    onSchoolSave({ schoolLogo: schoolLogoPreview, schoolName: finalSchoolName });
    localStorage.setItem('studentNumber', studentNumber); fetch('/api/ui-settings/studentNumber', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: studentNumber }) }).catch(() => {});
    localStorage.setItem('ouacUsername', ouacUsername); fetch('/api/ui-settings/ouacUsername', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: ouacUsername }) }).catch(() => {});
    localStorage.setItem('osapNumber', osapNumber); fetch('/api/ui-settings/osapNumber', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: osapNumber }) }).catch(() => {});
    localStorage.setItem('osapPassword', osapPassword); fetch('/api/ui-settings/osapPassword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: osapPassword }) }).catch(() => {});
    localStorage.setItem('oenNumber', oenNumber); fetch('/api/ui-settings/oenNumber', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: oenNumber }) }).catch(() => {});
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const getCroppedBlob = async (): Promise<Blob> => {
    const image = new Image();
    image.src = cropImageSrc!;
    await new Promise((resolve) => { image.onload = resolve; });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const area = croppedAreaPixels!;
    canvas.width = area.width;
    canvas.height = area.height;
    ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.9));
  };

  const handleCropConfirm = async () => {
    if (!croppedAreaPixels) return;
    setIsUploadingPhoto(true);
    try {
      const blob = await getCroppedBlob();
      const resp = await fetch('/api/profile-photo/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'profile.jpg', contentType: 'image/jpeg' }) });
      const { uploadURL, objectPath } = await resp.json();
      await fetch(uploadURL, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
      const servedUrl = `/objects/${objectPath.split('/').slice(1).join('/')}`;
      onProfilePhotoChange(servedUrl);
      setCropImageSrc(null);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setIsUploadingPhoto(false);
    }
  };
  
  const [transcripts, setTranscripts] = useState<{ id: string; name: string; contentType: string; size: number; uploadedAt: string }[]>([]);
  const [isUploadingTranscript, setIsUploadingTranscript] = useState(false);
  const transcriptInputRef = useRef<HTMLInputElement>(null);
  const [importantLinks, setImportantLinks] = useState<{ id: string; label: string; url: string }[]>([]);
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [isAddingLink, setIsAddingLink] = useState(false);

  useEffect(() => {
    fetch('/api/transcripts').then(r => r.json()).then(data => { if (Array.isArray(data)) setTranscripts(data); }).catch(() => {});
    fetch('/api/ui-settings/importantLinks').then(r => r.json()).then(d => { if (d.value) { try { setImportantLinks(JSON.parse(d.value)); } catch {} } }).catch(() => {});
  }, []);

  const handleTranscriptUpload = async (file: File) => {
    setIsUploadingTranscript(true);
    try {
      const resp = await fetch('/api/transcripts/upload', {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-File-Name': file.name },
        body: file,
      });
      const data = await resp.json();
      if (data.success && data.transcript) {
        setTranscripts(prev => [...prev, data.transcript]);
      }
    } catch (e) {
      console.error('Transcript upload failed:', e);
    } finally {
      setIsUploadingTranscript(false);
    }
  };

  const handleDeleteTranscript = async (id: string) => {
    try {
      await fetch(`/api/transcripts/${id}`, { method: 'DELETE' });
      setTranscripts(prev => prev.filter(t => t.id !== id));
    } catch (e) {
      console.error('Transcript delete failed:', e);
    }
  };

  const saveImportantLinks = (links: { id: string; label: string; url: string }[]) => {
    setImportantLinks(links);
    fetch('/api/ui-settings/importantLinks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: JSON.stringify(links) }) }).catch(() => {});
  };

  const handleAddLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim()) return;
    let url = newLinkUrl.trim();
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const link = { id: Date.now().toString(), label: newLinkLabel.trim(), url };
    saveImportantLinks([...importantLinks, link]);
    setNewLinkLabel('');
    setNewLinkUrl('');
    setIsAddingLink(false);
  };

  return (
    <form onSubmit={handleSubmit} className="text-[10px]">
      {cropImageSrc && (
        <div className="rounded-lg overflow-hidden bg-black/50 p-3 space-y-3">
          <span className="text-[10px] text-white/70">Move and zoom to crop your photo</span>
          <div className="relative w-full" style={{ height: '220px' }}>
            <Cropper
              image={cropImageSrc}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={(_: any, croppedPixels: { x: number; y: number; width: number; height: number }) => setCroppedAreaPixels(croppedPixels)}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-white/50">Zoom</span>
            <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 h-1 accent-white" data-testid="input-crop-zoom" />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" className="text-[10px] px-3 py-1.5 rounded border border-white/30 text-white/70 hover:text-white hover:border-white/50 transition-colors" onClick={() => setCropImageSrc(null)} data-testid="button-cancel-crop">Cancel</button>
            <button type="button" className="text-[10px] px-3 py-1.5 rounded bg-white/20 text-white hover:bg-white/30 transition-colors" onClick={handleCropConfirm} disabled={isUploadingPhoto} data-testid="button-confirm-crop">
              {isUploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              {isUploadingPhoto ? 'Saving...' : 'Save Photo'}
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 pb-2 border-b border-white/20" style={{ marginTop: '-10px' }}>
        <div 
          className="relative cursor-pointer group"
          style={{ marginTop: '-7px', zIndex: 10 }}
          onClick={() => photoInputRef.current?.click()}
          data-testid="button-upload-profile-photo"
        >
          <div className="w-[84px] h-[84px] rounded-full overflow-hidden border-2 border-white/30 group-hover:border-white/60 transition-colors">
            {profilePhotoUrl ? (
              <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <Camera className="w-5 h-5 text-white/50" />
              </div>
            )}
          </div>
          <div className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            {isUploadingPhoto ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Camera className="w-4 h-4 text-white" />}
          </div>
          <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} data-testid="input-profile-photo" />
        </div>
        <div className="flex flex-col gap-0.5" style={{ marginTop: '4px' }}>
          {(firstName || lastName) && (
            <span className="text-[16px]" style={{ fontWeight: 900, color: '#ffffff', textShadow: '0 0 0.5px #fff, 0 0 0.5px #fff' }} data-testid="text-profile-fullname">{firstName} {lastName}</span>
          )}
          {studentNumber && (
            <span className="text-[11px] text-white" style={{ fontWeight: 600 }} data-testid="text-profile-student-number">Student Number: {studentNumber}</span>
          )}
          <span className="text-[9px] text-white/40">{isUploadingPhoto ? 'Uploading...' : 'Click to change'}</span>
          {profilePhotoUrl && (
            <button type="button" className="text-[9px] text-red-400 hover:text-red-300 text-left" onClick={(e) => { e.stopPropagation(); onProfilePhotoChange(null); }} data-testid="button-remove-profile-photo">Remove photo</button>
          )}
        </div>
        <div className="ml-auto" style={{ marginTop: '20px', alignSelf: 'flex-start' }}>
          <img src={tmuLogo} alt="School Logo" style={{ height: '42px', objectFit: 'contain' }} data-testid="img-profile-school-logo" />
        </div>
      </div>
      <div className="flex gap-5" style={{ marginTop: '12px' }}>
      <div className="flex-1 space-y-3 min-w-0">
      <div className="flex gap-[6px]" style={{ marginTop: '-1px' }}>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="firstName" className="text-[10px]">First Name</Label>
          <Input 
            id="firstName" 
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="!text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-firstname"
          />
        </div>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="lastName" className="text-[10px]">Last Name</Label>
          <Input 
            id="lastName" 
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="!text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-lastname"
          />
        </div>
      </div>
      <div className="flex gap-[6px]">
        <div className="space-y-0" style={{ width: 'calc(50% - 3px)', flexShrink: 0 }}>
          <Label htmlFor="address" className="text-[10px]">Address</Label>
          <Input 
            id="address" 
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. 123 Main Street, Apt 4"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-address"
          />
        </div>
        <div className="space-y-0 flex-1">
          <Label htmlFor="location" className="text-[10px]">City</Label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
            data-testid="select-profile-location"
          >
            <option value="">Select your city</option>
            {TRAVEL_CITIES.map(c => (
              <option key={c.label} value={c.label}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-0" style={{ width: '18%', flexShrink: 0 }}>
          <Label htmlFor="provinceState" className="text-[10px]">{regionLabel}</Label>
          <select
            value={provinceState}
            onChange={(e) => setProvinceState(e.target.value)}
            className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
            data-testid="select-profile-province-state"
          >
            <option value="">Select {regionLabel.toLowerCase()}</option>
            {regionOptions.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-[6px]">
        <div className="space-y-0" style={{ width: 'calc(20% - 3px)', flexShrink: 0 }}>
          <Label htmlFor="postalCode" className="text-[10px]">Postal Code</Label>
          <Input 
            id="postalCode" 
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
            placeholder="M5V 2T6"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-postalcode"
          />
        </div>
        <div className="space-y-0" style={{ width: 'calc(30% - 6px)', flexShrink: 0 }}>
          <Label htmlFor="country" className="text-[10px]">Country</Label>
          <select
            value={country}
            onChange={(e) => { setCountry(e.target.value); setProvinceState(''); }}
            className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
            data-testid="select-profile-country"
          >
            <option value="">Select country</option>
            {COUNTRIES.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-0 flex-1">
          <div className="flex items-center gap-2">
            <Label htmlFor="timezone" className="text-[10px]">Home Time Zone</Label>
            <button
              type="button"
              onClick={() => onTimezoneOverrideChange?.(!timezoneOverride)}
              className="flex items-center gap-1 px-[6px] py-[1px] rounded-full text-[8px] font-medium transition-all"
              style={timezoneOverride
                ? { background: 'rgba(34,197,94,0.25)', border: '1px solid rgba(34,197,94,0.5)', color: '#4ade80' }
                : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)' }}
              title={timezoneOverride ? 'UTC Override ON — all times use your selected timezone' : 'UTC Override OFF — times use server default (America/Toronto)'}
              data-testid="toggle-timezone-override"
            >
              <div className="w-[6px] h-[6px] rounded-full" style={{ background: timezoneOverride ? '#4ade80' : 'rgba(255,255,255,0.3)' }} />
              UTC Override
            </button>
          </div>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
            data-testid="select-profile-timezone"
          >
            {timezones.map(tz => (
              <option key={tz.value} value={tz.value} className="text-black bg-white">{tz.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-[6px]">
        <div className="space-y-0 w-1/2">
          <Label htmlFor="phoneNumber" className="text-[10px]">Phone Number</Label>
          <Input 
            id="phoneNumber" 
            type="tel"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            placeholder="+1 (416) 555-0123"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-phone"
          />
        </div>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="email" className="text-[10px]">Email</Label>
          <Input 
            id="email" 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e.g. name@example.com"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-email"
          />
        </div>
      </div>
      <div className="flex gap-[6px]">
        <div className="space-y-0 w-1/2">
          <Label htmlFor="birthdate" className="text-[10px]">Birthdate</Label>
          <Input 
            id="birthdate" 
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            className="bg-white !text-[10px] h-8 [&]:!text-black [&::-webkit-datetime-edit]:!text-black [&::-webkit-datetime-edit-fields-wrapper]:!text-black [&::-webkit-calendar-picker-indicator]:!text-black"
            style={{ fontSize: '10px', color: 'black', colorScheme: 'light', WebkitTextFillColor: 'black' }}
            data-testid="input-profile-birthdate"
          />
        </div>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="allergies" className="text-[10px]">Allergies</Label>
          <Input 
            id="allergies" 
            value={allergies}
            onChange={(e) => setAllergies(e.target.value)}
            placeholder="e.g. Peanuts, Penicillin"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-allergies"
          />
        </div>
      </div>
      <div className="flex gap-[6px]">
        <div className="space-y-0 w-1/2">
          <Label htmlFor="emergencyContactName" className="text-[10px]">Emergency Contact Name</Label>
          <Input 
            id="emergencyContactName" 
            value={emergencyContactName}
            onChange={(e) => setEmergencyContactName(e.target.value)}
            placeholder="Contact name"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-emergency-name"
          />
        </div>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="emergencyContactPhone" className="text-[10px]">Emergency Contact Phone</Label>
          <Input 
            id="emergencyContactPhone" 
            type="tel"
            value={emergencyContactPhone}
            onChange={(e) => setEmergencyContactPhone(e.target.value)}
            placeholder="+1 (416) 555-0123"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-emergency-phone"
          />
        </div>
      </div>

      <div className="flex gap-[6px]" style={{ marginTop: '12px' }}>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="studentNumber" className="text-[10px]">Student Number</Label>
          <Input
            id="studentNumber"
            value={studentNumber}
            onChange={(e) => { setStudentNumber(e.target.value); }}
            onBlur={(e) => { if (closingRef.current || (e.relatedTarget as HTMLElement)?.dataset?.testid === 'button-close-profile') { closingRef.current = true; return; } localStorage.setItem('studentNumber', studentNumber); fetch('/api/ui-settings/studentNumber', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: studentNumber }) }).catch(() => {}); }}
            placeholder="e.g. 501234567"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-student-number"
          />
        </div>
        <div className="space-y-0 w-1/2">
          <Label htmlFor="ouacUsername" className="text-[10px]">OUAC Username</Label>
          <Input
            id="ouacUsername"
            value={ouacUsername}
            onChange={(e) => { setOuacUsername(e.target.value); }}
            onBlur={(e) => { if (closingRef.current || (e.relatedTarget as HTMLElement)?.dataset?.testid === 'button-close-profile') { closingRef.current = true; return; } localStorage.setItem('ouacUsername', ouacUsername); fetch('/api/ui-settings/ouacUsername', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: ouacUsername }) }).catch(() => {}); }}
            placeholder="Enter OUAC username"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-ouac-username"
          />
        </div>
      </div>
      <div className="flex gap-[6px]" style={{ marginTop: '12px' }}>
        <div className="space-y-0 w-1/3">
          <Label htmlFor="osapNumber" className="text-[10px]">OSAP Access Number (OAN)</Label>
          <Input
            id="osapNumber"
            value={osapNumber}
            onChange={(e) => { setOsapNumber(e.target.value); }}
            onBlur={(e) => { if (closingRef.current || (e.relatedTarget as HTMLElement)?.dataset?.testid === 'button-close-profile') { closingRef.current = true; return; } localStorage.setItem('osapNumber', osapNumber); fetch('/api/ui-settings/osapNumber', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: osapNumber }) }).catch(() => {}); }}
            placeholder="e.g. 1234567890"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-osap-number"
          />
        </div>
        <div className="space-y-0 w-1/3">
          <Label htmlFor="osapPassword" className="text-[10px]">OSAP Password</Label>
          <div className="relative">
            <Input
              id="osapPassword"
              type={showOsapPassword ? 'text' : 'password'}
              value={osapPassword}
              onChange={(e) => { setOsapPassword(e.target.value); }}
              onBlur={(e) => { if (closingRef.current || (e.relatedTarget as HTMLElement)?.dataset?.testid === 'button-close-profile') { closingRef.current = true; return; } localStorage.setItem('osapPassword', osapPassword); fetch('/api/ui-settings/osapPassword', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: osapPassword }) }).catch(() => {}); }}
              placeholder="Enter password"
              className="bg-white !text-black !text-[10px] h-8 pr-8"
              style={{ fontSize: '10px', color: 'black' }}
              data-testid="input-profile-osap-password"
            />
            <button
              type="button"
              className="absolute right-1 top-1/2 -translate-y-1/2 p-1 transition-colors"
              onClick={() => setShowOsapPassword(prev => !prev)}
              data-testid="button-toggle-osap-password"
            >
              {showOsapPassword ? <EyeOff className="w-4 h-4" style={{ color: '#555', stroke: '#555' }} /> : <Eye className="w-4 h-4" style={{ color: '#555', stroke: '#555' }} />}
            </button>
          </div>
        </div>
        <div className="space-y-0 w-1/3">
          <Label htmlFor="oenNumber" className="text-[10px]">OEN</Label>
          <Input
            id="oenNumber"
            value={oenNumber}
            onChange={(e) => { setOenNumber(e.target.value); }}
            onBlur={(e) => { if (closingRef.current || (e.relatedTarget as HTMLElement)?.dataset?.testid === 'button-close-profile') { closingRef.current = true; return; } localStorage.setItem('oenNumber', oenNumber); fetch('/api/ui-settings/oenNumber', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: oenNumber }) }).catch(() => {}); }}
            placeholder="e.g. 123456789"
            className="bg-white !text-black !text-[10px] h-8"
            style={{ fontSize: '10px', color: 'black' }}
            data-testid="input-profile-oen"
          />
        </div>
      </div>

      <div className="border rounded-lg p-3 space-y-2" style={{ marginTop: '20px' }}>
        <Label className="text-[10px] font-medium">School</Label>
        <div className="flex items-center gap-3">
          <div
            className="relative cursor-pointer group flex-shrink-0"
            onClick={() => schoolLogoInputRef.current?.click()}
            data-testid="button-upload-school-logo"
          >
            <div className="w-[48px] h-[48px] rounded-lg overflow-hidden border border-white/30 group-hover:border-white/60 transition-colors flex items-center justify-center bg-white/5">
              {schoolLogoPreview ? (
                <img src={schoolLogoPreview} alt="School logo" className="w-full h-full object-contain" />
              ) : (
                <span className="text-[8px] text-white/40">Logo</span>
              )}
            </div>
            <input ref={schoolLogoInputRef} type="file" accept="image/*" className="hidden" onChange={handleSchoolLogoUpload} data-testid="input-school-logo" />
          </div>
          <div className="flex-1 space-y-1">
            <select
              value={NORTH_AMERICAN_SCHOOLS.includes(schoolName) ? schoolName : 'Other'}
              onChange={(e) => setSchoolName(e.target.value)}
              className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ color: 'black' }}
              data-testid="select-school-name-profile"
            >
              {NORTH_AMERICAN_SCHOOLS.map(s => (
                <option key={s} value={s} className="text-black bg-white">{s}</option>
              ))}
              <option value="Other" className="text-black bg-white">Other</option>
            </select>
            {(schoolName === 'Other' || !NORTH_AMERICAN_SCHOOLS.includes(schoolName)) && (
              <Input
                value={customSchoolName || (NORTH_AMERICAN_SCHOOLS.includes(schoolName) ? '' : schoolName)}
                onChange={(e) => { setCustomSchoolName(e.target.value); setSchoolName('Other'); }}
                placeholder="Enter school name"
                className="bg-white !text-black !text-[10px] h-8"
                style={{ fontSize: '10px', color: 'black' }}
                data-testid="input-custom-school-name-profile"
              />
            )}
          </div>
        </div>
      </div>
      </div>
      <div className="space-y-2" style={{ width: '220px', flexShrink: 0 }}>
        <div className="rounded-lg p-3 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-white">Transcripts</span>
            <button type="button" onClick={() => transcriptInputRef.current?.click()} className="px-2 py-1 rounded text-[9px] font-medium text-white/80 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }} data-testid="button-upload-transcript">{isUploadingTranscript ? 'Uploading...' : 'Upload'}</button>
          </div>
          <input ref={transcriptInputRef} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleTranscriptUpload(file); if (transcriptInputRef.current) transcriptInputRef.current.value = ''; }} data-testid="input-transcript-file" />
          <div className="space-y-1" style={{ maxHeight: '140px', overflowY: 'auto' }}>
            {transcripts.length === 0 && <span className="text-[9px] text-white/40 block text-center py-3">No transcripts uploaded</span>}
            {transcripts.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-white/10 transition-colors group" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <FileText className="h-3 w-3 text-white/60 shrink-0" />
                <a href={`/api/transcripts/${t.id}/download`} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white/80 hover:text-white truncate flex-1 min-w-0 cursor-pointer" title={t.name} data-testid={`link-transcript-${t.id}`}>{t.name}</a>
                <button type="button" onClick={() => handleDeleteTranscript(t.id)} className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 transition-all shrink-0" data-testid={`button-delete-transcript-${t.id}`}><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg p-3 space-y-2" style={{ border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-white">Important Links</span>
            <button type="button" onClick={() => setIsAddingLink(true)} className="px-2 py-1 rounded text-[9px] font-medium text-white/80 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.25)' }} data-testid="button-add-link">Add</button>
          </div>
          {isAddingLink && (
            <div className="space-y-1.5 p-2 rounded" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)' }}>
              <Input value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Label (e.g. My D2L)" className="bg-white !text-black !text-[9px] h-6" style={{ fontSize: '9px', color: 'black' }} data-testid="input-link-label" />
              <Input value={newLinkUrl} onChange={(e) => setNewLinkUrl(e.target.value)} placeholder="URL (e.g. d2l.torontomu.ca)" className="bg-white !text-black !text-[9px] h-6" style={{ fontSize: '9px', color: 'black' }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLink(); } }} data-testid="input-link-url" />
              <div className="flex gap-1.5 justify-end">
                <button type="button" onClick={() => { setIsAddingLink(false); setNewLinkLabel(''); setNewLinkUrl(''); }} className="px-2 py-0.5 rounded text-[8px] text-white/60 hover:text-white transition-colors" data-testid="button-cancel-link">Cancel</button>
                <button type="button" onClick={handleAddLink} className="px-2 py-0.5 rounded text-[8px] text-white/80 hover:text-white transition-colors" style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }} data-testid="button-save-link">Save</button>
              </div>
            </div>
          )}
          <div className="space-y-1" style={{ maxHeight: '140px', overflowY: 'auto' }}>
            {importantLinks.length === 0 && !isAddingLink && <span className="text-[9px] text-white/40 block text-center py-3">No links added</span>}
            {importantLinks.map((link) => (
              <div key={link.id} className="flex items-center gap-1.5 rounded px-2 py-1.5 hover:bg-white/10 transition-colors group" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                <ExternalLink className="h-3 w-3 text-white/60 shrink-0" />
                <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-[9px] text-white/80 hover:text-white truncate flex-1 min-w-0 cursor-pointer" title={link.url} data-testid={`link-important-${link.id}`}>{link.label}</a>
                <button type="button" onClick={() => saveImportantLinks(importantLinks.filter(l => l.id !== link.id))} className="opacity-0 group-hover:opacity-100 text-red-400/70 hover:text-red-400 transition-all shrink-0" data-testid={`button-delete-link-${link.id}`}><X className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
      </div>
    </form>
  );
}

const TRAVEL_CITIES = [
  { label: 'Abu Dhabi', value: 'Asia/Dubai' },
  { label: 'Accra', value: 'Africa/Accra' },
  { label: 'Adelaide', value: 'Australia/Adelaide' },
  { label: 'Amsterdam', value: 'Europe/Amsterdam' },
  { label: 'Anchorage', value: 'America/Anchorage' },
  { label: 'Athens', value: 'Europe/Athens' },
  { label: 'Atlanta', value: 'America/New_York' },
  { label: 'Auckland', value: 'Pacific/Auckland' },
  { label: 'Baghdad', value: 'Asia/Baghdad' },
  { label: 'Bangkok', value: 'Asia/Bangkok' },
  { label: 'Barcelona', value: 'Europe/Madrid' },
  { label: 'Beijing', value: 'Asia/Shanghai' },
  { label: 'Beirut', value: 'Asia/Beirut' },
  { label: 'Berlin', value: 'Europe/Berlin' },
  { label: 'Bogota', value: 'America/Bogota' },
  { label: 'Boston', value: 'America/New_York' },
  { label: 'Brisbane', value: 'Australia/Brisbane' },
  { label: 'Brussels', value: 'Europe/Brussels' },
  { label: 'Budapest', value: 'Europe/Budapest' },
  { label: 'Buenos Aires', value: 'America/Argentina/Buenos_Aires' },
  { label: 'Cairo', value: 'Africa/Cairo' },
  { label: 'Calgary', value: 'America/Edmonton' },
  { label: 'Cape Town', value: 'Africa/Johannesburg' },
  { label: 'Casablanca', value: 'Africa/Casablanca' },
  { label: 'Chicago', value: 'America/Chicago' },
  { label: 'Copenhagen', value: 'Europe/Copenhagen' },
  { label: 'Dallas', value: 'America/Chicago' },
  { label: 'Delhi', value: 'Asia/Kolkata' },
  { label: 'Denver', value: 'America/Denver' },
  { label: 'Doha', value: 'Asia/Qatar' },
  { label: 'Dubai', value: 'Asia/Dubai' },
  { label: 'Dublin', value: 'Europe/Dublin' },
  { label: 'Edmonton', value: 'America/Edmonton' },
  { label: 'Frankfurt', value: 'Europe/Berlin' },
  { label: 'Halifax', value: 'America/Halifax' },
  { label: 'Hanoi', value: 'Asia/Ho_Chi_Minh' },
  { label: 'Helsinki', value: 'Europe/Helsinki' },
  { label: 'Ho Chi Minh City', value: 'Asia/Ho_Chi_Minh' },
  { label: 'Hong Kong', value: 'Asia/Hong_Kong' },
  { label: 'Honolulu', value: 'Pacific/Honolulu' },
  { label: 'Houston', value: 'America/Chicago' },
  { label: 'Istanbul', value: 'Europe/Istanbul' },
  { label: 'Jakarta', value: 'Asia/Jakarta' },
  { label: 'Johannesburg', value: 'Africa/Johannesburg' },
  { label: 'Kuala Lumpur', value: 'Asia/Kuala_Lumpur' },
  { label: 'Lagos', value: 'Africa/Lagos' },
  { label: 'Las Vegas', value: 'America/Los_Angeles' },
  { label: 'Lima', value: 'America/Lima' },
  { label: 'Lisbon', value: 'Europe/Lisbon' },
  { label: 'London', value: 'Europe/London' },
  { label: 'Los Angeles', value: 'America/Los_Angeles' },
  { label: 'Madrid', value: 'Europe/Madrid' },
  { label: 'Manila', value: 'Asia/Manila' },
  { label: 'Melbourne', value: 'Australia/Melbourne' },
  { label: 'Mexico City', value: 'America/Mexico_City' },
  { label: 'Miami', value: 'America/New_York' },
  { label: 'Milan', value: 'Europe/Rome' },
  { label: 'Montreal', value: 'America/Toronto' },
  { label: 'Moscow', value: 'Europe/Moscow' },
  { label: 'Mumbai', value: 'Asia/Kolkata' },
  { label: 'Munich', value: 'Europe/Berlin' },
  { label: 'Nairobi', value: 'Africa/Nairobi' },
  { label: 'Nashville', value: 'America/Chicago' },
  { label: 'New York', value: 'America/New_York' },
  { label: 'Osaka', value: 'Asia/Tokyo' },
  { label: 'Oslo', value: 'Europe/Oslo' },
  { label: 'Ottawa', value: 'America/Toronto' },
  { label: 'Paris', value: 'Europe/Paris' },
  { label: 'Perth', value: 'Australia/Perth' },
  { label: 'Philadelphia', value: 'America/New_York' },
  { label: 'Phoenix', value: 'America/Phoenix' },
  { label: 'Prague', value: 'Europe/Prague' },
  { label: 'Quebec City', value: 'America/Toronto' },
  { label: 'Regina', value: 'America/Regina' },
  { label: 'Reykjavik', value: 'Atlantic/Reykjavik' },
  { label: 'Rio de Janeiro', value: 'America/Sao_Paulo' },
  { label: 'Rome', value: 'Europe/Rome' },
  { label: 'San Francisco', value: 'America/Los_Angeles' },
  { label: 'Santiago', value: 'America/Santiago' },
  { label: 'Sao Paulo', value: 'America/Sao_Paulo' },
  { label: 'Seattle', value: 'America/Los_Angeles' },
  { label: 'Seoul', value: 'Asia/Seoul' },
  { label: 'Shanghai', value: 'Asia/Shanghai' },
  { label: 'Singapore', value: 'Asia/Singapore' },
  { label: 'St. John\'s', value: 'America/St_Johns' },
  { label: 'Stockholm', value: 'Europe/Stockholm' },
  { label: 'Sydney', value: 'Australia/Sydney' },
  { label: 'Taipei', value: 'Asia/Taipei' },
  { label: 'Tel Aviv', value: 'Asia/Jerusalem' },
  { label: 'Tokyo', value: 'Asia/Tokyo' },
  { label: 'Toronto', value: 'America/Toronto' },
  { label: 'Vancouver', value: 'America/Vancouver' },
  { label: 'Vienna', value: 'Europe/Vienna' },
  { label: 'Warsaw', value: 'Europe/Warsaw' },
  { label: 'Washington D.C.', value: 'America/New_York' },
  { label: 'Winnipeg', value: 'America/Winnipeg' },
  { label: 'Zurich', value: 'Europe/Zurich' },
];

const NORTH_AMERICAN_SCHOOLS = [
  'Boston University',
  'Brock University',
  'Carleton University',
  'Columbia University',
  'Concordia University',
  'Cornell University',
  'Dalhousie University',
  'Duke University',
  'Georgetown University',
  'Harvard University',
  'Johns Hopkins University',
  'Lakehead University',
  'Laurentian University',
  'McGill University',
  'McMaster University',
  'Memorial University',
  'MIT',
  'Nipissing University',
  'Northeastern University',
  'Northwestern University',
  'NYU',
  'Ontario Tech University',
  'Princeton University',
  'Queen\'s University',
  'Simon Fraser University',
  'Stanford University',
  'Toronto Metropolitan University',
  'Trent University',
  'UC Berkeley',
  'UCLA',
  'Universit\u00e9 de Montr\u00e9al',
  'Universit\u00e9 Laval',
  'University of Alberta',
  'University of British Columbia',
  'University of Calgary',
  'University of Chicago',
  'University of Guelph',
  'University of Manitoba',
  'University of Michigan',
  'University of New Brunswick',
  'University of Ottawa',
  'University of Pennsylvania',
  'University of Saskatchewan',
  'University of Southern California',
  'University of Toronto',
  'University of Victoria',
  'University of Waterloo',
  'University of Windsor',
  'Western University',
  'Wilfrid Laurier University',
  'Yale University',
  'York University',
  'Other',
];

export function TravelDateTimePicker({ label, value, onChange, testId }: { label: string; value: string; onChange: (val: string) => void; testId: string }) {
  const dateVal = value ? value.split('T')[0] || '' : '';
  const timeVal = value ? value.split('T')[1] || '' : '';

  const handleDateChange = (newDate: string) => {
    const t = timeVal || '12:00';
    if (newDate) onChange(newDate + 'T' + t);
  };

  const handleTimeChange = (newTime: string) => {
    const d = dateVal || new Date().toISOString().split('T')[0];
    if (newTime) onChange(d + 'T' + newTime);
  };

  return (
    <div className="space-y-1">
      <Label className="text-[10px] text-white/70">{label}</Label>
      <input
        type="date"
        value={dateVal}
        onChange={(e) => handleDateChange(e.target.value)}
        className="w-full h-7 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-orange-400"
        style={{ color: 'black' }}
        data-testid={testId + '-date'}
      />
      <input
        type="time"
        value={timeVal}
        onChange={(e) => handleTimeChange(e.target.value)}
        className="w-full h-7 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-orange-400"
        style={{ color: 'black' }}
        data-testid={testId + '-time'}
      />
    </div>
  );
}



export function SemDatePickerBody({ startLabel, endLabel, initialStart, initialEnd, onCancel, onSave }: {
  startLabel: string;
  endLabel: string;
  initialStart: string;
  initialEnd: string;
  onCancel: () => void;
  onSave: (start: string, end: string) => void;
}) {
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [showStartCal, setShowStartCal] = useState(false);
  const [showEndCal, setShowEndCal] = useState(false);

  const parseDate = (d: string) => { if (!d) return undefined; const parts = d.split('-'); return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])); };
  const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const fmtDisplay = (d: string) => { if (!d) return 'Select date'; const dt = parseDate(d); return dt ? dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'Select date'; };

  return (
    <>
      <div className="px-4 py-3 space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-white/70 block">{startLabel}</label>
          <button
            className="w-full h-8 px-3 text-[10px] rounded-md bg-white/10 border border-white/20 text-white text-left hover:bg-white/15 transition-colors flex items-center justify-between"
            onClick={() => { setShowStartCal(!showStartCal); setShowEndCal(false); }}
            data-testid="input-sem-date-start"
          >
            <span className={startDate ? 'text-white' : 'text-white/40'}>{fmtDisplay(startDate)}</span>
            <Calendar className="h-3 w-3 text-white/50" />
          </button>
          {showStartCal && (
            <div className="rounded-lg border border-white/20 overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <DayPicker
                mode="single"
                selected={parseDate(startDate)}
                defaultMonth={parseDate(startDate) || parseDate(endDate)}
                onSelect={(day) => { if (day) { setStartDate(fmtDate(day)); setShowStartCal(false); } }}
                className="!bg-transparent p-2"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-2",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-[11px] font-medium text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-6 w-6 bg-transparent p-0 opacity-60 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-white/20 text-white",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex",
                  head_cell: "text-white/50 rounded-md w-8 font-normal text-[9px]",
                  row: "flex w-full mt-1",
                  cell: "h-8 w-8 text-center text-[10px] p-0 relative",
                  day: "h-8 w-8 p-0 font-normal text-white/80 hover:bg-white/20 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors",
                  day_selected: "!bg-blue-500 !text-white hover:!bg-blue-600",
                  day_today: "bg-white/10 text-white font-bold",
                  day_outside: "text-white/20",
                  day_disabled: "text-white/20 opacity-50",
                }}
                components={{
                  IconLeft: () => <ChevronLeft className="h-3 w-3 text-white" />,
                  IconRight: () => <ChevronRight className="h-3 w-3 text-white" />,
                }}
              />
            </div>
          )}
        </div>
        <div className="space-y-1">
          <label className="text-[10px] text-white/70 block">{endLabel}</label>
          <button
            className="w-full h-8 px-3 text-[10px] rounded-md bg-white/10 border border-white/20 text-white text-left hover:bg-white/15 transition-colors flex items-center justify-between"
            onClick={() => { setShowEndCal(!showEndCal); setShowStartCal(false); }}
            data-testid="input-sem-date-end"
          >
            <span className={endDate ? 'text-white' : 'text-white/40'}>{fmtDisplay(endDate)}</span>
            <Calendar className="h-3 w-3 text-white/50" />
          </button>
          {showEndCal && (
            <div className="rounded-lg border border-white/20 overflow-hidden" style={{ background: 'rgba(0,0,0,0.3)' }}>
              <DayPicker
                mode="single"
                selected={parseDate(endDate)}
                defaultMonth={parseDate(endDate) || parseDate(startDate)}
                onSelect={(day) => { if (day) { setEndDate(fmtDate(day)); setShowEndCal(false); } }}
                className="!bg-transparent p-2"
                classNames={{
                  months: "flex flex-col",
                  month: "space-y-2",
                  caption: "flex justify-center pt-1 relative items-center",
                  caption_label: "text-[11px] font-medium text-white",
                  nav: "space-x-1 flex items-center",
                  nav_button: "h-6 w-6 bg-transparent p-0 opacity-60 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-white/20 text-white",
                  nav_button_previous: "absolute left-1",
                  nav_button_next: "absolute right-1",
                  table: "w-full border-collapse",
                  head_row: "flex",
                  head_cell: "text-white/50 rounded-md w-8 font-normal text-[9px]",
                  row: "flex w-full mt-1",
                  cell: "h-8 w-8 text-center text-[10px] p-0 relative",
                  day: "h-8 w-8 p-0 font-normal text-white/80 hover:bg-white/20 rounded-md inline-flex items-center justify-center cursor-pointer transition-colors",
                  day_selected: "!bg-blue-500 !text-white hover:!bg-blue-600",
                  day_today: "bg-white/10 text-white font-bold",
                  day_outside: "text-white/20",
                  day_disabled: "text-white/20 opacity-50",
                }}
                components={{
                  IconLeft: () => <ChevronLeft className="h-3 w-3 text-white" />,
                  IconRight: () => <ChevronRight className="h-3 w-3 text-white" />,
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2 px-4 py-2.5 border-t border-white/20">
        <button
          className="px-3 py-1.5 text-[10px] rounded-md border border-white/20 text-white/70 hover:bg-white/10 transition-colors"
          onClick={onCancel}
          data-testid="button-sem-date-cancel"
        >
          Cancel
        </button>
        <button
          className="px-3 py-1.5 text-[10px] rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          onClick={() => onSave(startDate, endDate)}
          data-testid="button-sem-date-save"
        >
          Save
        </button>
      </div>
    </>
  );
}
export function SemesterSettingsFormBody({ semKey, existing, onCancel, onSave, onEndEarly, isCurrentSemester }: {
  semKey: string;
  existing: Partial<{ week1StartDate: string; semesterType: string; numberOfWeeks: number; timezone: string; readingWeekDate: string; isTravelling: boolean; travelTimezone: string; travelStartDate: string; travelEndDate: string; springStartDate: string; springEndDate: string; summerStartDate: string; summerEndDate: string }>;
  onCancel: () => void;
  onSave: (data: { week1StartDate: string; semesterType: string; numberOfWeeks: number; timezone: string; readingWeekDate: string; isTravelling: boolean; travelTimezone: string; travelStartDate: string; travelEndDate: string; springStartDate: string; springEndDate: string; summerStartDate: string; summerEndDate: string }) => void;
  onEndEarly?: () => void;
  isCurrentSemester?: boolean;
}) {
  const defaultType = semKey.startsWith('ss') ? 'spring_summer' : semKey.startsWith('f') ? 'fall' : 'winter';
  const [localW1, setLocalW1] = useState(existing.week1StartDate || '');
  const [localType, setLocalType] = useState(existing.semesterType || defaultType);
  const [localWeeks, setLocalWeeks] = useState(existing.numberOfWeeks || 13);
  const [localTz, setLocalTz] = useState(existing.timezone || 'America/Toronto');
  const [localRw, setLocalRw] = useState(existing.readingWeekDate || '');
  const [localTravel, setLocalTravel] = useState(existing.isTravelling || false);
  const [localTravelTz, setLocalTravelTz] = useState(existing.travelTimezone || '');
  const [localTravelStart, setLocalTravelStart] = useState(existing.travelStartDate || '');
  const [localTravelEnd, setLocalTravelEnd] = useState(existing.travelEndDate || '');
  const [springStart, setSpringStart] = useState(existing.springStartDate || '');
  const [springEnd, setSpringEnd] = useState(existing.springEndDate || '');
  const [summerStart, setSummerStart] = useState(existing.summerStartDate || '');
  const [summerEnd, setSummerEnd] = useState(existing.summerEndDate || '');
  const isSSType = localType === 'spring_summer';
  const [showEndEarlyConfirm, setShowEndEarlyConfirm] = useState(false);

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.3) transparent' }}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-white/70">Week 1, Day 1 Date</Label>
            <input
              type="date"
              value={localW1}
              onChange={(e) => setLocalW1(e.target.value)}
              onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
              className="w-full h-8 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
              style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }}
              data-testid="input-sem-settings-week1"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-white/70">Semester Type</Label>
            <select
              value={localType}
              onChange={(e) => setLocalType(e.target.value)}
              className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
              data-testid="select-sem-settings-type"
            >
              <option value="fall" className="text-black bg-white">Fall</option>
              <option value="winter" className="text-black bg-white">Winter</option>
              <option value="spring_summer" className="text-black bg-white">Spring/Summer</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-[10px] text-white/70">School Weeks</Label>
            <select
              value={String(localWeeks)}
              onChange={(e) => setLocalWeeks(Number(e.target.value))}
              className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
              data-testid="select-sem-settings-weeks"
            >
              {[10, 11, 12, 13, 14, 15, 16].map(w => (
                <option key={w} value={String(w)} className="text-black bg-white">{w} weeks</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-white/70">Time Zone</Label>
            <select
              value={localTz}
              onChange={(e) => setLocalTz(e.target.value)}
              className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ color: 'black' }}
              data-testid="select-sem-settings-timezone"
            >
              {[
                { value: 'America/Toronto', label: 'Eastern (Toronto)' },
                { value: 'America/New_York', label: 'Eastern (New York)' },
                { value: 'America/Chicago', label: 'Central (Chicago)' },
                { value: 'America/Denver', label: 'Mountain (Denver)' },
                { value: 'America/Los_Angeles', label: 'Pacific (LA)' },
                { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
                { value: 'America/Edmonton', label: 'Mountain (Edmonton)' },
                { value: 'America/Winnipeg', label: 'Central (Winnipeg)' },
                { value: 'America/Halifax', label: 'Atlantic (Halifax)' },
                { value: 'America/St_Johns', label: "Newfoundland (St. John's)" },
                { value: 'America/Regina', label: 'Central - No DST (Regina)' },
                { value: 'Pacific/Honolulu', label: 'Hawaii' },
                { value: 'America/Anchorage', label: 'Alaska' },
                { value: 'Europe/London', label: 'GMT (London)' },
                { value: 'Europe/Paris', label: 'CET (Paris)' },
                { value: 'Europe/Berlin', label: 'CET (Berlin)' },
                { value: 'Asia/Tokyo', label: 'JST (Tokyo)' },
                { value: 'Asia/Shanghai', label: 'CST (Shanghai)' },
                { value: 'Australia/Sydney', label: 'AEST (Sydney)' },
                { value: 'UTC', label: 'UTC' },
              ].map(tz => (
                <option key={tz.value} value={tz.value} className="text-black bg-white">{tz.label}</option>
              ))}
            </select>
          </div>
        </div>
        {isSSType && (
          <div className="space-y-2 p-2.5 rounded-md border border-white/15 bg-white/5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-white/90">Spring Half</Label>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/60">Start Date</Label>
                  <input
                    type="date"
                    value={springStart}
                    onChange={(e) => setSpringStart(e.target.value)}
                    onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                    className="w-full h-7 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }}
                    data-testid="input-sem-spring-start"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/60">End Date</Label>
                  <input
                    type="date"
                    value={springEnd}
                    onChange={(e) => setSpringEnd(e.target.value)}
                    onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                    className="w-full h-7 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }}
                    data-testid="input-sem-spring-end"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-semibold text-white/90">Summer Half</Label>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/60">Start Date</Label>
                  <input
                    type="date"
                    value={summerStart}
                    onChange={(e) => setSummerStart(e.target.value)}
                    onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                    className="w-full h-7 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }}
                    data-testid="input-sem-summer-start"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[9px] text-white/60">End Date</Label>
                  <input
                    type="date"
                    value={summerEnd}
                    onChange={(e) => setSummerEnd(e.target.value)}
                    onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
                    className="w-full h-7 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 cursor-pointer"
                    style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }}
                    data-testid="input-sem-summer-end"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[10px] text-white/70">Reading Week Start Date</Label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={localRw}
              onChange={(e) => setLocalRw(e.target.value)}
              onClick={(e) => { try { (e.target as HTMLInputElement).showPicker?.(); } catch {} }}
              className="h-8 px-2 text-[10px] rounded-md bg-white border border-white/20 focus:outline-none focus:ring-2 focus:ring-blue-400 w-40 cursor-pointer"
              style={{ fontSize: '10px', color: 'black', colorScheme: 'light' }}
              data-testid="input-sem-settings-reading-week"
            />
            {localRw && (
              <button
                type="button"
                onClick={() => setLocalRw('')}
                className="text-[9px] text-red-300 hover:text-red-200 underline"
                data-testid="button-clear-sem-reading-week"
              >
                Clear
              </button>
            )}
          </div>
          {localRw && (
            <div className="text-[9px] text-white/50">
              Week of {format(new Date(localRw), 'MMM d, yyyy')} will be skipped in week numbering
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={localTravel}
              onCheckedChange={(checked) => setLocalTravel(!!checked)}
              className="h-3.5 w-3.5 border-white/50 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
              data-testid="checkbox-sem-settings-travelling"
            />
            <Label className="text-[10px] text-white/70 cursor-pointer flex items-center gap-1">
              <Plane className="h-3 w-3" />
              I'm travelling
            </Label>
          </div>
          {localTravel && (
            <div className="space-y-2 ml-5">
              <Label className="text-[10px] text-white/70">Where are you travelling to?</Label>
              <select
                value={localTravelTz}
                onChange={(e) => setLocalTravelTz(e.target.value)}
                className="w-full h-8 px-2 text-[10px] rounded-md bg-white !text-black focus:outline-none focus:ring-2 focus:ring-orange-400" style={{ color: 'black' }}
                data-testid="select-sem-settings-travel-tz"
              >
                <option value="" className="text-black bg-white">Pick a city</option>
                {TRAVEL_CITIES.map(c => (
                  <option key={c.value} value={c.value} className="text-black bg-white">{c.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <p className="text-[8px] text-white/40">Course details shown in the Courses section.</p>
        {isCurrentSemester && onEndEarly && (
          <div className="mt-4 pt-3 border-t border-red-500/30">
            {!showEndEarlyConfirm ? (
              <button
                className="w-full py-2 rounded text-[11px] font-bold border cursor-pointer transition-all hover:brightness-110"
                style={{ background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.4)', color: '#f87171' }}
                onClick={() => setShowEndEarlyConfirm(true)}
                data-testid="button-end-semester-early"
              >
                End Semester Early
              </button>
            ) : (
              <div className="space-y-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-400 flex-shrink-0" />
                  <span className="text-[11px] font-bold text-red-300">Are you sure?</span>
                </div>
                <p className="text-[10px] text-white/70 leading-relaxed">
                  This will mark the semester as <span className="font-bold text-white">COMPLETE</span> and remove course rows from the calendar. A backup will be created automatically. <span className="font-bold text-red-300">This cannot be undone.</span>
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="flex-1 py-1.5 rounded text-[10px] font-bold border cursor-pointer transition-all hover:brightness-110"
                    style={{ background: 'rgba(239,68,68,0.25)', borderColor: 'rgba(239,68,68,0.5)', color: '#f87171' }}
                    onClick={() => { onEndEarly(); }}
                    data-testid="button-confirm-end-semester-early"
                  >
                    Yes, End Semester
                  </button>
                  <button
                    className="flex-1 py-1.5 rounded text-[10px] font-bold border cursor-pointer transition-all hover:brightness-110"
                    style={{ background: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                    onClick={() => setShowEndEarlyConfirm(false)}
                    data-testid="button-cancel-end-semester-early"
                  >
                    No, Go Back
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center justify-end px-4 py-3 border-t border-white/20">
        <div className="flex gap-2">
          <Button variant="outline" className="border !border-white/30 text-white/70 hover:text-white hover:!border-white/50 hover:bg-transparent transition-opacity duration-200 h-8 px-6" style={{ fontSize: '12px', minWidth: '100px' }} onClick={onCancel} data-testid="button-cancel-sem-settings">Cancel</Button>
          <Button variant="outline" className="border !border-white/50 text-white hover:text-white hover:!border-white hover:bg-transparent transition-opacity duration-200 h-8 px-6" style={{ boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)', fontSize: '12px', minWidth: '100px' }} onClick={() => {
            onSave({ week1StartDate: localW1, semesterType: localType, numberOfWeeks: localWeeks, timezone: localTz, readingWeekDate: localRw, isTravelling: localTravel, travelTimezone: localTravelTz, travelStartDate: localTravelStart, travelEndDate: localTravelEnd, springStartDate: springStart, springEndDate: springEnd, summerStartDate: summerStart, summerEndDate: summerEnd });
          }} data-testid="button-save-sem-settings">Save</Button>
        </div>
      </div>
    </>
  );
}

export function WeekVariantsSection({ semesterSettings, week1StartDate }: { semesterSettings: SemesterSettings | null | undefined; week1StartDate: string }) {
  const { data: mappings = [] } = useQuery<CourseWeekMapping[]>({
    queryKey: ["/api/course-week-mappings"],
  });

  const variantsByWeek = useMemo(() => {
    const result: Record<number, { courseCode: string; label: string }[]> = {};
    for (const m of mappings) {
      if (m.courseWeekLabel && m.courseWeekLabel.trim()) {
        if (!result[m.weekNumber]) result[m.weekNumber] = [];
        result[m.weekNumber].push({ courseCode: m.courseCode, label: m.courseWeekLabel });
      }
    }
    return result;
  }, [mappings]);

  const weeksWithVariants = Object.keys(variantsByWeek).map(Number).sort((a, b) => a - b);
  if (weeksWithVariants.length === 0) return null;

  const semStart = week1StartDate ? new Date(week1StartDate) : (semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : null);
  const readingWeek = semesterSettings?.readingWeekStart || null;
  const currentWeek = semStart ? getWeekNumber(new Date(), semStart, readingWeek) : null;

  return (
    <div className="space-y-2" data-testid="week-variants-section">
      <span className="text-[9px] text-white/50 block">Courses using different week numbering than the TMU standard</span>
      <div className="space-y-1 text-[10px]">
        {weeksWithVariants.map(weekNum => {
          const variants = variantsByWeek[weekNum];
          const isCurrent = weekNum === currentWeek;
          return (
            <div key={weekNum} className={`flex items-center justify-between py-1.5 px-2 rounded ${isCurrent ? 'bg-blue-500/10 border border-blue-500/20' : 'hover:bg-white/5'}`} data-testid={`week-variant-row-${weekNum}`}>
              <div className="flex items-center gap-2">
                <span className={`text-white font-medium ${isCurrent ? 'text-blue-300' : ''}`}>Week {weekNum}</span>
                {isCurrent && <span className="text-[7px] px-1 py-0.5 bg-blue-500/20 text-blue-300 rounded">Current</span>}
              </div>
              <div className="flex items-center gap-2">
                {variants.map((v, i) => (
                  <span key={i} className="text-[8px] px-1.5 py-0.5 bg-amber-500/15 text-amber-300 rounded border border-amber-500/20">
                    {v.courseCode}: Wk {v.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


export function CoursesForm({ 
  coursesData, 
  semesterSettings,
  onSave,
  onSaveSemesterSchedule,
  onGenerateClassTasks,
  isGenerating,
  onCancel 
}: { 
  coursesData: { courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> };
  semesterSettings: SemesterSettings | null | undefined;
  onSave: (data: { courses: Array<{ name: string; color: string; professor: string; professorEmail?: string }> }) => void;
  onSaveSemesterSchedule: (data: Record<string, any>) => void;
  onGenerateClassTasks: () => void;
  isGenerating?: boolean;
  onCancel: () => void;
}) {
  const [courses, setCourses] = useState(coursesData.courses);
  const [isNewCourseOpen, setIsNewCourseOpen] = useState(false);
  const [editingCourseIndex, setEditingCourseIndex] = useState<number | null>(null);

  const handleSaveNewCourse = (courseData: {
    courseCode: string;
    courseName: string;
    professorName: string;
    professorEmail: string;
    color: string;
    semesterType: string;
    deliveryMode: string;
    classDay: string;
    classDay2: string;
    classTime: string;
    classEndTime: string;
    startDate: string;
    endDate: string;
    springSummerTerm: string;
    moduleFolder?: string;
    readingFolder?: string;
    deadlines: Array<{ title: string; type: string; dueDate: string; description: string }>;
    reminders: number[];
  }) => {
    const fullName = `${courseData.courseCode} - ${courseData.courseName}`;
    const updatedCourses = [...courses];
    
    if (editingCourseIndex !== null) {
      updatedCourses[editingCourseIndex] = {
        name: fullName,
        color: courseData.color,
        professor: courseData.professorName,
        professorEmail: courseData.professorEmail,
      };
    } else {
      const emptyIdx = updatedCourses.findIndex(c => !c.name.trim());
      if (emptyIdx !== -1) {
        updatedCourses[emptyIdx] = {
          name: fullName,
          color: courseData.color,
          professor: courseData.professorName,
          professorEmail: courseData.professorEmail,
        };
      } else {
        updatedCourses.push({
          name: fullName,
          color: courseData.color,
          professor: courseData.professorName,
          professorEmail: courseData.professorEmail,
        });
      }
    }
    
    setCourses(updatedCourses);
    onSave({ courses: updatedCourses });

    const courseIndex = editingCourseIndex !== null ? editingCourseIndex : updatedCourses.findIndex(c => c.name === fullName);
    const prefix = `course${courseIndex + 1}` as const;
    
    if (courseIndex >= 0 && courseIndex < 3) {
      const schedulePayload: Record<string, any> = {
        semesterType: courseData.semesterType,
        [`${prefix}Code`]: courseData.courseCode || null,
        [`${prefix}Name`]: fullName || null,
        [`${prefix}DeliveryMode`]: courseData.deliveryMode || null,
        [`${prefix}ClassDay`]: courseData.classDay || null,
        [`${prefix}ClassDay2`]: courseData.classDay2 || null,
        [`${prefix}ClassTime`]: courseData.classTime || null,
        [`${prefix}ClassEndTime`]: courseData.classEndTime || null,
        [`${prefix}SpringSummerTerm`]: courseData.springSummerTerm || null,
        [`${prefix}StartDate`]: courseData.startDate ? new Date(courseData.startDate).toISOString() : null,
        [`${prefix}EndDate`]: courseData.endDate ? new Date(courseData.endDate).toISOString() : null,
        [`${prefix}ModuleFolder`]: courseData.moduleFolder || null,
        [`${prefix}ReadingFolder`]: courseData.readingFolder || null,
      };
      onSaveSemesterSchedule(schedulePayload);

      fetch('/api/onedrive/rename-course-folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          courseIndex: courseIndex + 1,
          oldCode: courseData.courseCode,
          oldName: '',
          newCode: courseData.courseCode,
          newName: courseData.courseName,
        }),
      }).catch(() => {});
    }

    if (courseData.reminders && courseData.reminders.length > 0) {
      const courseReminders = JSON.parse(localStorage.getItem('courseReminders') || '{}');
      courseReminders[fullName] = courseData.reminders;
      localStorage.setItem('courseReminders', JSON.stringify(courseReminders));
    }

    setIsNewCourseOpen(false);
    setEditingCourseIndex(null);

    if (courseData.deadlines.length > 0) {
      (async () => {
        let created = 0;
        for (const deadline of courseData.deadlines) {
          if (deadline.title && deadline.dueDate) {
            try {
              const dueDate = new Date(deadline.dueDate);
              dueDate.setHours(23, 59, 0, 0);
              await apiRequest("POST", "/api/tasks", {
                title: deadline.title,
                description: deadline.description || '',
                type: deadline.type || 'assignment',
                courseName: fullName,
                dueDate: dueDate.toISOString(),
                priority: deadline.type === 'exam' || deadline.type === 'quiz' ? 'high' : 'medium',
                weekNumber: getWeekNumber(dueDate, semesterSettings?.semesterStartDate ? new Date(semesterSettings.semesterStartDate) : undefined, semesterSettings?.readingWeekStart ? new Date(semesterSettings.readingWeekStart) : null),
                reminder1: DEFAULT_REMINDER_1,
                reminder2: DEFAULT_REMINDER_2,
              });
              created++;
            } catch (err) {
              console.error("Failed to create deadline task:", err);
            }
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      })();
    }
  };

  const handleEditCourse = (index: number) => {
    setEditingCourseIndex(index);
    setIsNewCourseOpen(true);
  };

  const handleDeleteCourse = (index: number) => {
    const updatedCourses = [...courses];
    updatedCourses[index] = { name: '', color: '#6b7280', professor: '', professorEmail: '' };
    setCourses(updatedCourses);
    onSave({ courses: updatedCourses });
  };

  const activeCoursesWithIndex = courses
    .map((course, index) => ({ course, index }))
    .filter(({ course }) => course.name.trim());

  const canAddMore = activeCoursesWithIndex.length < 3;

  return (
    <div className="space-y-3 text-[10px]">
      {activeCoursesWithIndex.length === 0 ? (
        <p className="text-[10px] text-white/50 text-center py-4">No courses added yet. Click the button below to add your first course.</p>
      ) : (
        <div className="space-y-2">
          {activeCoursesWithIndex.map(({ course, index: realIndex }) => {
            const prefix = `course${realIndex + 1}`;
            const deliveryMode = (semesterSettings as any)?.[`${prefix}DeliveryMode`] || '';
            const classDay = (semesterSettings as any)?.[`${prefix}ClassDay`] || '';
            const classDay2 = (semesterSettings as any)?.[`${prefix}ClassDay2`] || '';
            const classTime = (semesterSettings as any)?.[`${prefix}ClassTime`] || '';
            const classEndTime = (semesterSettings as any)?.[`${prefix}ClassEndTime`] || '';
            const dayNames: Record<string, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };

            const currentCode = course.name.split(' - ')[0] || '';
            const currentName = course.name.split(' - ').slice(1).join(' - ') || '';

            const updateCourseName = (newCode: string, newName: string) => {
              const combined = newName ? `${newCode} - ${newName}` : newCode;
              const updatedCourses = [...courses];
              updatedCourses[realIndex] = { ...updatedCourses[realIndex], name: combined };
              setCourses(updatedCourses);
              onSave({ courses: updatedCourses });
            };

            return (
              <div key={realIndex} className="border rounded p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-shrink-0">
                    <div className="w-3 h-3 rounded-full cursor-pointer" style={{ backgroundColor: course.color }} onClick={() => document.getElementById(`course-color-${realIndex}`)?.click()} />
                    <input
                      id={`course-color-${realIndex}`}
                      type="color"
                      value={course.color}
                      onChange={(e) => {
                        const updatedCourses = [...courses];
                        updatedCourses[realIndex] = { ...updatedCourses[realIndex], color: e.target.value };
                        setCourses(updatedCourses);
                        onSave({ courses: updatedCourses });
                      }}
                      className="absolute inset-0 w-0 h-0 opacity-0"
                      data-testid={`input-course-color-${realIndex}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium truncate">{currentCode}</span>
                      <span className="text-[9px] text-white/50 truncate">{currentName}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditCourse(realIndex)}
                      className="p-1 text-white/40 transition-colors"
                      data-testid={`button-edit-course-${realIndex}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(realIndex)}
                      className="p-1 text-white/40 transition-colors"
                      data-testid={`button-delete-course-${realIndex}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-5">
                  <div className="flex-shrink-0">
                    <label className="text-[8px] text-white/40 uppercase tracking-wider">Code</label>
                    <input
                      type="text"
                      value={currentCode}
                      onChange={(e) => updateCourseName(e.target.value.toUpperCase(), currentName)}
                      className="block w-[80px] text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/10 text-white"
                      placeholder="CPPA122"
                      data-testid={`input-course-code-${realIndex}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <label className="text-[8px] text-white/40 uppercase tracking-wider">Course Name</label>
                    <input
                      type="text"
                      value={currentName}
                      onChange={(e) => updateCourseName(currentCode, e.target.value)}
                      className="block w-full text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/10 text-white"
                      placeholder="Local Politics"
                      data-testid={`input-course-name-${realIndex}`}
                    />
                  </div>
                  <div className="flex-shrink-0" style={{ width: '90px' }}>
                    <label className="text-[8px] text-white/40 uppercase tracking-wider">Display Name</label>
                    <input
                      type="text"
                      value={(() => { const prefix = `course${realIndex + 1}`; return (semesterSettings as any)?.[`${prefix}DisplayName`] || ''; })()}
                      onChange={(e) => { const v = e.target.value; const prefix = `course${realIndex + 1}`; onSaveSemesterSchedule({ [`${prefix}DisplayName`]: v || null }); }}
                      className="block w-full text-[10px] px-1.5 py-0.5 rounded border border-white/20 bg-white/10 text-white"
                      placeholder="Row label"
                      data-testid={`input-course-display-name-${realIndex}`}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[9px] text-white/50 pl-5">
                  {course.professor && (
                    <span className="flex items-center gap-1">
                      <User className="h-2.5 w-2.5" />
                      {course.professor}
                    </span>
                  )}
                  {(course as any).professorEmail && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-2.5 w-2.5" />
                      {(course as any).professorEmail}
                    </span>
                  )}
                  {deliveryMode && (
                    <span className="flex items-center gap-1">
                      {deliveryMode === 'virtual' ? (() => { const cc = currentCode.replace(/\s/g, ''); const zl = courseZoomLinks[cc] || ''; return <img src={zoomCamPath} alt="Zoom" style={{ width: '12px', height: '12px', objectFit: 'contain', borderRadius: '50%', cursor: zl ? 'pointer' : 'default' }} onClick={zl ? (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); window.open(zl, '_blank'); try { const f = document.createElement('iframe'); f.style.display = 'none'; f.src = `unical://${encodeURIComponent(zl)}`; document.body.appendChild(f); setTimeout(() => f.remove(), 2000); } catch {} } : undefined} title={zl ? 'Click to open Zoom + Screen Recorder' : 'Virtual class'} data-testid={`zoom-icon-settings-${realIndex}`} />; })() : <Cloud className="h-2.5 w-2.5" />}
                      {deliveryMode === 'virtual' ? 'Virtual' : 'Online'}
                    </span>
                  )}
                  {classDay && deliveryMode === 'virtual' && (
                    <span>
                      {dayNames[classDay] || classDay}{classDay2 ? `/${dayNames[classDay2] || classDay2}` : ''} {classTime && classEndTime ? `${formatTimeTo12Hour(classTime)}-${formatTimeTo12Hour(classEndTime)}` : ''}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-between items-center gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          onClick={() => { setEditingCourseIndex(null); setIsNewCourseOpen(true); }}
          disabled={!canAddMore}
          className="border !border-green-400/50 text-green-300 transition-opacity duration-200"
          style={{ fontSize: '11px' }}
          data-testid="button-new-course"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          {canAddMore ? 'New Course' : 'Max 3 Courses'}
        </Button>
        <div className="flex items-center gap-2">
          {activeCoursesWithIndex.some(({ index }) => {
            return (semesterSettings as any)?.[`course${index + 1}DeliveryMode`] === 'virtual';
          }) && (
            <Button
              type="button"
              variant="outline"
              onClick={onGenerateClassTasks}
              disabled={isGenerating}
              className="border !border-blue-400/50 text-blue-300 transition-opacity duration-200"
              style={{ fontSize: '11px' }}
              data-testid="button-generate-class-tasks"
            >
              {isGenerating ? 'Generating...' : 'Generate Class Tasks'}
            </Button>
          )}
        </div>
      </div>

      {isNewCourseOpen && (
        <NewCourseDialog
          existingCourse={editingCourseIndex !== null ? {
            courseCode: courses[editingCourseIndex]?.name?.split(' - ')[0] || '',
            courseName: courses[editingCourseIndex]?.name?.split(' - ').slice(1).join(' - ') || '',
            professorName: courses[editingCourseIndex]?.professor || '',
            professorEmail: (courses[editingCourseIndex] as any)?.professorEmail || '',
            color: courses[editingCourseIndex]?.color || '#6b7280',
            semesterType: semesterSettings?.semesterType || 'winter',
            deliveryMode: (semesterSettings as any)?.[`course${editingCourseIndex + 1}DeliveryMode`] || '',
            classDay: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassDay`] || '',
            classDay2: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassDay2`] || '',
            classTime: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassTime`] || '',
            classEndTime: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ClassEndTime`] || '',
            startDate: (semesterSettings as any)?.[`course${editingCourseIndex + 1}StartDate`] ? new Date((semesterSettings as any)[`course${editingCourseIndex + 1}StartDate`]).toISOString().split('T')[0] : '',
            endDate: (semesterSettings as any)?.[`course${editingCourseIndex + 1}EndDate`] ? new Date((semesterSettings as any)[`course${editingCourseIndex + 1}EndDate`]).toISOString().split('T')[0] : '',
            springSummerTerm: (semesterSettings as any)?.[`course${editingCourseIndex + 1}SpringSummerTerm`] || 'full',
            moduleFolder: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ModuleFolder`] || '',
            readingFolder: (semesterSettings as any)?.[`course${editingCourseIndex + 1}ReadingFolder`] || '',
          } : undefined}
          onSave={handleSaveNewCourse}
          onClose={() => { setIsNewCourseOpen(false); setEditingCourseIndex(null); }}
        />
      )}
    </div>
  );
}

type NewCourseDialogProps = {
  existingCourse?: {
    courseCode: string;
    courseName: string;
    professorName: string;
    professorEmail: string;
    color: string;
    semesterType: string;
    deliveryMode: string;
    classDay: string;
    classDay2: string;
    classTime: string;
    classEndTime: string;
    startDate: string;
    endDate: string;
    springSummerTerm: string;
    moduleFolder?: string;
    readingFolder?: string;
  };
  onSave: (data: {
    courseCode: string;
    courseName: string;
    professorName: string;
    professorEmail: string;
    color: string;
    semesterType: string;
    deliveryMode: string;
    classDay: string;
    classDay2: string;
    classTime: string;
    classEndTime: string;
    startDate: string;
    endDate: string;
    springSummerTerm: string;
    moduleFolder: string;
    readingFolder: string;
    deadlines: Array<{ title: string; type: string; dueDate: string; description: string }>;
    reminders: number[];
  }) => void;
  onClose: () => void;
  headerBar?: string;
};

export function NewCourseDialogInner({ existingCourse, onSave, onClose, headerBar }: NewCourseDialogProps) {
  const [courseCode, setCourseCode] = useState(existingCourse?.courseCode || '');
  const [courseName, setCourseName] = useState(existingCourse?.courseName || '');
  const [professorName, setProfessorName] = useState(existingCourse?.professorName || '');
  const [professorEmail, setProfessorEmail] = useState(existingCourse?.professorEmail || '');
  const [color, setColor] = useState(existingCourse?.color || '#6366F1');
  const [semesterType, setSemesterType] = useState(existingCourse?.semesterType || 'winter');
  const [deliveryMode, setDeliveryMode] = useState(existingCourse?.deliveryMode || '');
  const [classDay, setClassDay] = useState(existingCourse?.classDay || '');
  const [classDay2, setClassDay2] = useState(existingCourse?.classDay2 || '');
  const [classTime, setClassTime] = useState(existingCourse?.classTime || '');
  const [classEndTime, setClassEndTime] = useState(existingCourse?.classEndTime || '');
  const [startDate, setStartDate] = useState(existingCourse?.startDate || '');
  const [moduleFolder, setModuleFolder] = useState(existingCourse?.moduleFolder || '');
  const [readingFolder, setReadingFolder] = useState(existingCourse?.readingFolder || '');
  const [moduleFolderValid, setModuleFolderValid] = useState<boolean | null>(null);
  const [readingFolderValid, setReadingFolderValid] = useState<boolean | null>(null);
  const [folderValidating, setFolderValidating] = useState(false);
  const [browsingFor, setBrowsingFor] = useState<'module' | 'reading' | null>(null);
  const [browsePath, setBrowsePath] = useState('/');
  const [browseFolders, setBrowseFolders] = useState<Array<{ name: string; path: string }>>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [endDate, setEndDate] = useState(existingCourse?.endDate || '');
  const [springSummerTerm, setSpringSummerTerm] = useState(existingCourse?.springSummerTerm || 'full');
  const [reminder1, setReminder1] = useState(15);
  const [reminder2, setReminder2] = useState(60);
  const [reminder3, setReminder3] = useState(0);
  const [deadlines, setDeadlines] = useState<Array<{ title: string; type: string; dueDate: string; description: string }>>([]);

  const addDeadline = () => {
    setDeadlines(prev => [...prev, { title: '', type: 'assignment', dueDate: '', description: '' }]);
  };

  const updateDeadline = (index: number, field: string, value: string) => {
    setDeadlines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const removeDeadline = (index: number) => {
    setDeadlines(prev => prev.filter((_, i) => i !== index));
  };

  useEffect(() => {
    const validateFolders = async () => {
      if (moduleFolder) {
        setFolderValidating(true);
        try {
          const res = await fetch(`/api/onedrive/validate-folder?path=${encodeURIComponent(moduleFolder)}`);
          const data = await res.json();
          setModuleFolderValid(data.valid);
        } catch { setModuleFolderValid(false); }
      }
      if (readingFolder) {
        try {
          const res = await fetch(`/api/onedrive/validate-folder?path=${encodeURIComponent(readingFolder)}`);
          const data = await res.json();
          setReadingFolderValid(data.valid);
        } catch { setReadingFolderValid(false); }
      }
      setFolderValidating(false);
    };
    validateFolders();
  }, []);

  const openFolderBrowser = async (target: 'module' | 'reading') => {
    setBrowsingFor(target);
    const currentPath = target === 'module' ? moduleFolder : readingFolder;
    const startPath = currentPath ? currentPath.split('/').slice(0, -1).join('/') || '/' : '/';
    setBrowsePath(startPath);
    setBrowseLoading(true);
    try {
      const res = await fetch(`/api/onedrive/browse-folders?path=${encodeURIComponent(startPath)}`);
      const folders = await res.json();
      setBrowseFolders(Array.isArray(folders) ? folders : []);
    } catch { setBrowseFolders([]); }
    setBrowseLoading(false);
  };

  const navigateBrowseFolder = async (path: string) => {
    setBrowsePath(path);
    setBrowseLoading(true);
    try {
      const res = await fetch(`/api/onedrive/browse-folders?path=${encodeURIComponent(path)}`);
      const folders = await res.json();
      setBrowseFolders(Array.isArray(folders) ? folders : []);
    } catch { setBrowseFolders([]); }
    setBrowseLoading(false);
  };

  const selectBrowseFolder = (path: string) => {
    if (browsingFor === 'module') { setModuleFolder(path); setModuleFolderValid(true); }
    else if (browsingFor === 'reading') { setReadingFolder(path); setReadingFolderValid(true); }
    setBrowsingFor(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseName.trim()) return;
    onSave({
      courseCode: courseCode.trim(),
      courseName: courseName.trim(),
      professorName: professorName.trim(),
      professorEmail: professorEmail.trim(),
      color,
      semesterType,
      deliveryMode,
      classDay,
      classDay2,
      classTime,
      classEndTime,
      startDate,
      endDate,
      springSummerTerm,
      moduleFolder,
      readingFolder,
      deadlines: deadlines.filter(d => d.title.trim() && d.dueDate),
      reminders: [15, ...(reminder2 > 0 ? [reminder2] : []), ...(reminder3 > 0 ? [reminder3] : [])],
    });
  };

  const dayOptions = [
    { value: '', label: 'None' },
    { value: 'monday', label: 'Monday' },
    { value: 'tuesday', label: 'Tuesday' },
    { value: 'wednesday', label: 'Wednesday' },
    { value: 'thursday', label: 'Thursday' },
    { value: 'friday', label: 'Friday' },
    { value: 'saturday', label: 'Saturday' },
    { value: 'sunday', label: 'Sunday' },
  ];

  const deadlineTypes = [
    { value: 'assignment', label: 'Assignment' },
    { value: 'exam', label: 'Exam' },
    { value: 'quiz', label: 'Quiz' },
    { value: 'essay', label: 'Essay' },
    { value: 'project', label: 'Project' },
    { value: 'discussion', label: 'Discussion' },
    { value: 'reading', label: 'Reading' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/40 flex-shrink-0 rounded-t-lg" style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', background: `linear-gradient(180deg, rgba(255,255,255,0.28) 0%, ${headerBar || '#1e293b'}cc 40%, ${headerBar || '#1e293b'}bb 100%)`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.45), inset 0 2px 4px rgba(255,255,255,0.15), inset 0 -1px 0 rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.1)' }}>
        <div className="flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5 text-white" />
          <h2 className="font-normal text-white" style={{ fontFamily: "Avenir, 'Avenir Next', -apple-system, BlinkMacSystemFont, sans-serif", textShadow: '0 1px 2px rgba(0,0,0,0.2)', fontSize: '12px' }}>
            {existingCourse ? 'EDIT COURSE' : 'NEW COURSE'}
          </h2>
        </div>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} className="text-white hover:text-white/80 transition-colors p-1" data-testid="button-close-new-course">
          <X className="h-5 w-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Course Number</Label>
              <Input
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                placeholder="e.g. CSOC103"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                required
                data-testid="input-new-course-code"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Course Name</Label>
              <Input
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g. How Society Works"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                required
                data-testid="input-new-course-name"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Color</Label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer p-0"
                data-testid="input-new-course-color"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Professor Name</Label>
              <Input
                value={professorName}
                onChange={(e) => setProfessorName(e.target.value)}
                placeholder="e.g. Dr. Smith"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                data-testid="input-new-professor-name"
              />
            </div>
            <div>
              <Label className="text-[9px] text-white/60 mb-1 block">Professor Email</Label>
              <Input
                value={professorEmail}
                onChange={(e) => setProfessorEmail(e.target.value)}
                placeholder="e.g. prof@university.ca"
                className="h-8 !text-[10px] !text-black"
                style={{ fontSize: '10px' }}
                data-testid="input-new-professor-email"
              />
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <Label className="text-[10px] font-medium mb-2 block">Semester & Schedule</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Semester</Label>
                <select
                  value={semesterType}
                  onChange={(e) => setSemesterType(e.target.value)}
                  className="w-full h-8 rounded bg-white/10 text-white text-[10px] px-2"
                  data-testid="select-new-course-semester"
                >
                  <option value="fall" className="bg-gray-800">Fall</option>
                  <option value="winter" className="bg-gray-800">Winter</option>
                  <option value="spring_summer" className="bg-gray-800">Spring/Summer</option>
                </select>
              </div>
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Delivery Mode</Label>
                <select
                  value={deliveryMode}
                  onChange={(e) => setDeliveryMode(e.target.value)}
                  className="w-full h-8 rounded bg-white/10 text-white text-[10px] px-2"
                  data-testid="select-new-course-delivery"
                >
                  <option value="" className="bg-gray-800">Select...</option>
                  <option value="virtual" className="bg-gray-800">Virtual (live class)</option>
                  <option value="online" className="bg-gray-800">Online (async)</option>
                </select>
              </div>
            </div>

            {semesterType === 'spring_summer' && (
              <div className="mt-2">
                <Label className="text-[9px] text-white/60 mb-1 block">Spring/Summer Term</Label>
                <select
                  value={springSummerTerm}
                  onChange={(e) => setSpringSummerTerm(e.target.value)}
                  className="w-full h-8 rounded bg-white/10 text-white text-[10px] px-2"
                  data-testid="select-new-course-term"
                >
                  <option value="full" className="bg-gray-800">Full Length (May-Aug)</option>
                  <option value="first_half" className="bg-gray-800">First Half (May-Jun)</option>
                  <option value="second_half" className="bg-gray-800">Second Half (Jun-Aug)</option>
                </select>
              </div>
            )}

            {deliveryMode === 'virtual' && (
              <div className="grid grid-cols-4 gap-2 mt-2">
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">Day 1</Label>
                  <select
                    value={classDay}
                    onChange={(e) => setClassDay(e.target.value)}
                    className="w-full h-8 rounded bg-white/10 text-white text-[10px] px-2"
                    data-testid="select-new-course-day1"
                  >
                    {dayOptions.map(d => (
                      <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">Day 2</Label>
                  <select
                    value={classDay2}
                    onChange={(e) => setClassDay2(e.target.value)}
                    className="w-full h-8 rounded bg-white/10 text-white text-[10px] px-2"
                    data-testid="select-new-course-day2"
                  >
                    {dayOptions.map(d => (
                      <option key={d.value} value={d.value} className="bg-gray-800">{d.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">Start Time</Label>
                  <Input
                    type="time"
                    value={classTime}
                    onChange={(e) => setClassTime(e.target.value)}
                    className="h-8 !text-[10px] !text-black"
                    data-testid="input-new-course-start-time"
                  />
                </div>
                <div>
                  <Label className="text-[9px] text-white/60 mb-1 block">End Time</Label>
                  <Input
                    type="time"
                    value={classEndTime}
                    onChange={(e) => setClassEndTime(e.target.value)}
                    className="h-8 !text-[10px] !text-black"
                    data-testid="input-new-course-end-time"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Course Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-8 !text-[10px] !text-black"
                  data-testid="input-new-course-start-date"
                />
              </div>
              <div>
                <Label className="text-[9px] text-white/60 mb-1 block">Course End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-8 !text-[10px] !text-black"
                  data-testid="input-new-course-end-date"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] font-medium flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-amber-400" />
                Class Reminders
              </Label>
            </div>
            <p className="text-[9px] text-white/40 mb-2">Popup reminders before class starts. 15-minute reminder is always active.</p>

            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-[10px] text-white/80 flex-1">15 minutes before</span>
                <span className="text-[9px] text-amber-400/80 italic">Always on</span>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full shrink-0 ${reminder2 > 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
                <span className="text-[10px] text-white/80 flex-1">Reminder 2</span>
                <select
                  value={reminder2}
                  onChange={(e) => setReminder2(Number(e.target.value))}
                  className="h-6 rounded bg-white/10 text-white text-[10px] px-1.5"
                  data-testid="select-reminder-2"
                >
                  <option value={0} className="bg-gray-800">Off</option>
                  <option value={5} className="bg-gray-800">5 min before</option>
                  <option value={10} className="bg-gray-800">10 min before</option>
                  <option value={30} className="bg-gray-800">30 min before</option>
                  <option value={45} className="bg-gray-800">45 min before</option>
                  <option value={60} className="bg-gray-800">1 hour before</option>
                  <option value={90} className="bg-gray-800">1.5 hours before</option>
                  <option value={120} className="bg-gray-800">2 hours before</option>
                  <option value={180} className="bg-gray-800">3 hours before</option>
                  <option value={1440} className="bg-gray-800">1 day before</option>
                </select>
              </div>

              <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/5 border border-white/10">
                <div className={`w-2 h-2 rounded-full shrink-0 ${reminder3 > 0 ? 'bg-blue-400' : 'bg-white/20'}`} />
                <span className="text-[10px] text-white/80 flex-1">Reminder 3</span>
                <select
                  value={reminder3}
                  onChange={(e) => setReminder3(Number(e.target.value))}
                  className="h-6 rounded bg-white/10 text-white text-[10px] px-1.5"
                  data-testid="select-reminder-3"
                >
                  <option value={0} className="bg-gray-800">Off</option>
                  <option value={5} className="bg-gray-800">5 min before</option>
                  <option value={10} className="bg-gray-800">10 min before</option>
                  <option value={30} className="bg-gray-800">30 min before</option>
                  <option value={45} className="bg-gray-800">45 min before</option>
                  <option value={60} className="bg-gray-800">1 hour before</option>
                  <option value={90} className="bg-gray-800">1.5 hours before</option>
                  <option value={120} className="bg-gray-800">2 hours before</option>
                  <option value={180} className="bg-gray-800">3 hours before</option>
                  <option value={1440} className="bg-gray-800">1 day before</option>
                </select>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 pt-3">
            <Label className="text-[10px] font-medium mb-2 block flex items-center gap-1.5">
              <FolderOpen className="h-3.5 w-3.5 text-blue-400" />
              OneDrive File Folders
            </Label>
            <p className="text-[8px] text-white/40 mb-2">Set the OneDrive course folder where the player finds Module &amp; Reading files.</p>
            <div className="space-y-2 mb-3">
              {(['module', 'reading'] as const).map(type => {
                const folder = type === 'module' ? moduleFolder : readingFolder;
                const valid = type === 'module' ? moduleFolderValid : readingFolderValid;
                return (
                  <div key={type}>
                    <Label className="text-[9px] text-white/60 mb-1 block capitalize">{type} Files Folder</Label>
                    <div className="flex items-center gap-1.5">
                      <div className={`flex-1 min-w-0 h-8 rounded border flex items-center px-2 overflow-hidden ${
                        !folder ? 'bg-white/5 border-white/15' :
                        valid === false ? 'bg-red-900/20 border-red-500/50' :
                        valid === true ? 'bg-green-900/10 border-green-500/30' :
                        'bg-white/5 border-white/15'
                      }`}>
                        {folder ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            {valid === false && <AlertTriangle className="h-3 w-3 text-red-400 shrink-0" />}
                            {valid === true && <Check className="h-3 w-3 text-green-400 shrink-0" />}
                            {valid === null && folderValidating && <Loader2 className="h-3 w-3 text-white/40 animate-spin shrink-0" />}
                            <span className={`text-[9px] truncate ${valid === false ? 'text-red-400' : 'text-white/80'}`}>
                              {valid === false ? 'ERROR — ' + folder.split('/').pop() : folder.split('/').pop()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] text-white/30">Not set</span>
                        )}
                      </div>
                      <button type="button" onClick={() => openFolderBrowser(type)} className="h-8 px-2.5 rounded bg-blue-600/30 border border-blue-500/40 text-[9px] text-blue-300 hover:bg-blue-600/50 transition-colors flex items-center gap-1 shrink-0" data-testid={`btn-browse-${type}-folder`}>
                        <FolderOpen className="h-3 w-3" /> Browse
                      </button>
                      {folder && (
                        <button type="button" onClick={() => { if (type === 'module') { setModuleFolder(''); setModuleFolderValid(null); } else { setReadingFolder(''); setReadingFolderValid(null); }}} className="h-8 px-1.5 rounded text-white/30 hover:text-red-400 transition-colors shrink-0" data-testid={`btn-clear-${type}-folder`}>
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    {folder && <p className="text-[7px] text-white/30 mt-0.5 truncate">{folder}</p>}
                    {folder && valid === false && <p className="text-[8px] text-red-400 mt-0.5">This folder was not found on OneDrive. It may have been renamed or deleted.</p>}
                  </div>
                );
              })}
            </div>

            {browsingFor && (
              <div className="mb-3 bg-black/40 border border-white/20 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/10">
                  <span className="text-[10px] text-white font-medium">Select {browsingFor === 'module' ? 'Module' : 'Reading'} Folder</span>
                  <button type="button" onClick={() => setBrowsingFor(null)} className="text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
                <div className="px-3 py-1.5 bg-white/3 border-b border-white/10 flex items-center gap-1.5">
                  {browsePath !== '/' && (
                    <button type="button" onClick={() => navigateBrowseFolder(browsePath.split('/').slice(0, -1).join('/') || '/')} className="text-blue-400 hover:text-blue-300 shrink-0">
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <span className="text-[8px] text-white/50 truncate">{browsePath}</span>
                  <button type="button" onClick={() => selectBrowseFolder(browsePath)} className="ml-auto text-[8px] px-2 py-1 rounded bg-green-600/40 border border-green-500/50 text-green-300 hover:bg-green-600/60 shrink-0" data-testid="btn-select-current-folder">
                    Select This Folder
                  </button>
                </div>
                <div className="max-h-[150px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                  {browseLoading ? (
                    <div className="flex items-center justify-center py-4"><Loader2 className="h-4 w-4 text-white/40 animate-spin" /></div>
                  ) : browseFolders.length === 0 ? (
                    <div className="text-[9px] text-white/30 text-center py-3">No subfolders here</div>
                  ) : (
                    browseFolders.map(f => (
                      <button key={f.path} type="button" onClick={() => navigateBrowseFolder(f.path)} className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10 transition-colors" data-testid={`browse-folder-${f.name}`}>
                        <Folder className="h-3.5 w-3.5 text-yellow-400 shrink-0" />
                        <span className="text-[9px] text-white/80 truncate">{f.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] font-medium">Known Deadlines</Label>
              <button
                type="button"
                onClick={addDeadline}
                className="flex items-center gap-1 text-[9px] text-blue-300 transition-colors"
                data-testid="button-add-deadline"
              >
                <Plus className="h-3 w-3" />
                Add Deadline
              </button>
            </div>
            <p className="text-[9px] text-white/40 mb-2">Add tests, exams, assignments, and other deadlines you already know about.</p>

            {deadlines.length === 0 ? (
              <div className="text-center py-3 border border-dashed border-white/15 rounded">
                <p className="text-[9px] text-white/30">No deadlines added yet</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {deadlines.map((deadline, idx) => (
                  <div key={idx} className="border border-white/15 rounded p-2 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 grid grid-cols-[1fr_auto_auto] gap-2">
                        <Input
                          value={deadline.title}
                          onChange={(e) => updateDeadline(idx, 'title', e.target.value)}
                          placeholder="Deadline title (e.g. Midterm Exam)"
                          className="h-7 !text-[10px] !text-black"
                          style={{ fontSize: '10px' }}
                          data-testid={`input-deadline-title-${idx}`}
                        />
                        <select
                          value={deadline.type}
                          onChange={(e) => updateDeadline(idx, 'type', e.target.value)}
                          className="h-7 rounded bg-white/10 text-white text-[10px] px-2 w-28"
                          data-testid={`select-deadline-type-${idx}`}
                        >
                          {deadlineTypes.map(t => (
                            <option key={t.value} value={t.value} className="bg-gray-800">{t.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeDeadline(idx)}
                          className="p-1 text-white/40 transition-colors"
                          data-testid={`button-remove-deadline-${idx}`}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_1fr] gap-2">
                      <Input
                        type="date"
                        value={deadline.dueDate}
                        onChange={(e) => updateDeadline(idx, 'dueDate', e.target.value)}
                        className="h-7 !text-[10px] !text-black"
                        data-testid={`input-deadline-date-${idx}`}
                      />
                      <Input
                        value={deadline.description}
                        onChange={(e) => updateDeadline(idx, 'description', e.target.value)}
                        placeholder="Notes (optional)"
                        className="h-7 !text-[10px] !text-black"
                        style={{ fontSize: '10px' }}
                        data-testid={`input-deadline-description-${idx}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
              className="border !border-white/30 text-white/60 transition-opacity duration-200"
              style={{ fontSize: '11px' }}
              data-testid="button-cancel-new-course"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="outline"
              className="border !border-white/50 text-white transition-opacity duration-200"
              style={{
                boxShadow: '0 0 6px rgba(255,255,255,0.6), 0 0 12px rgba(255,255,255,0.4), 0 0 18px rgba(255,255,255,0.3)',
                fontSize: '11px'
              }}
              data-testid="button-save-new-course"
            >
              {existingCourse ? 'Update Course' : 'Save Course'}
            </Button>
          </div>
        </form>
    </>
  );
}

export function NewCourseDialog(props: NewCourseDialogProps) {
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={(e) => { if (e.target === e.currentTarget) props.onClose(); }}>
      <div className="rounded-lg w-[520px] max-h-[85vh] overflow-hidden flex flex-col text-white" style={{ background: `linear-gradient(180deg, ${props.headerBar || '#1e293b'} 0%, #000 100%)`, border: '1.5px solid rgba(255,255,255,0.35)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} onClick={(e) => e.stopPropagation()}>
        <NewCourseDialogInner {...props} />
      </div>
    </div>,
    document.body
  );
}

export function TaskForm({ 
  task, 
  weekNumber,
  initialDate,
  initialType,
  initialStartTime,
  initialEndTime,
  hideSubmitButton,
  onSuccess,
  onRecurringEdit,
  onUndoPush,
  currentSemesterCourses 
}: { 
  task?: Task; 
  weekNumber: number;
  initialDate?: Date | null;
  initialType?: string;
  initialStartTime?: string;
  initialEndTime?: string;
  hideSubmitButton?: boolean;
  onSuccess: () => void;
  onRecurringEdit?: (taskId: number, title: string, payload: Record<string, unknown>, onSuccess: () => void) => void;
  onUndoPush?: (action: { type: 'edit'; description: string; data: { taskId: number; taskTitle: string; oldFields: Record<string, any>; newFields: Record<string, any> } }) => void;
  currentSemesterCourses?: Array<{ code: string; name: string }>;
}) {
  const { toast } = useToast();
  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const getDefaultDate = () => {
    if (task?.dueDate) return format(new Date(task.dueDate), "yyyy-MM-dd'T'HH:mm");
    if (initialDate) {
      // Always set default time to 6 PM for new tasks
      const date = new Date(initialDate);
      date.setHours(18, 0, 0, 0);
      return format(date, "yyyy-MM-dd'T'HH:mm");
    }
    return "";
  };

  const getDefaultPrepDays = () => {
    if (task?.startDate && task?.dueDate) {
      const start = new Date(task.startDate);
      const due = new Date(task.dueDate);
      const diffTime = due.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    }
    return 0;
  };

  const [formData, setFormData] = useState({
    title: task?.title || "",
    description: task?.description || "",
    type: task?.type || initialType || "reading",
    courseName: task?.courseName || "",
    prepDays: getDefaultPrepDays(),
    dueDate: getDefaultDate(),
    eventStartTime: task?.eventStartTime || initialStartTime || "",
    eventEndTime: task?.eventEndTime || initialEndTime || "",
    eventEndDate: task?.eventEndDate ? new Date(task.eventEndDate).toISOString() : "",
    reminder1: task?.reminder1 ?? DEFAULT_REMINDER_1,
    reminder2: task?.reminder2 ?? DEFAULT_REMINDER_2,
    reminder3: task?.reminder3 ?? 0,
    reminder4: task?.reminder4 ?? 0,
    reminder1Methods: task?.reminder1Methods || '',
    reminder2Methods: task?.reminder2Methods || '',
    reminder3Methods: task?.reminder3Methods || '',
    reminder4Methods: task?.reminder4Methods || '',
    reminder4DateTime: task?.reminder4DateTime || '',
    reminder4DateTimeMode: !!(task?.reminder4DateTime),
    priority: task?.priority || "medium",
    weekNumber: task?.weekNumber || weekNumber,
    referenceLink: task?.referenceLink || "",
    attachments: task?.attachments || [] as string[],
    repeatType: (task?.repeatType as typeof REPEAT_TYPES[number]) || "none",
    repeatInterval: task?.repeatInterval || 1,
    repeatIntervalUnit: (task?.repeatIntervalUnit as typeof REPEAT_INTERVAL_UNITS[number]) || "weeks",
    repeatEndDate: task?.repeatEndDate ? format(new Date(task.repeatEndDate), "yyyy-MM-dd") : "",
    hideFromSummary: task?.hideFromSummary ?? false,
    hideFromCountdown: task?.hideFromCountdown ?? false,
    flagged: task?.flagged ?? false,
    showCountdownBar: task?.showCountdownBar ?? true,
    showCountdownBarMain: task?.showCountdownBarMain ?? true,
    showCountdownBarSummary: task?.showCountdownBarSummary ?? true,
    countdownBarDays: task?.countdownBarDays ?? 0,
    countdownBarColor: task?.countdownBarColor || '',
    repeatSpanDays: task?.repeatSpanDays ?? 1,
  });
  const [newAttachment, setNewAttachment] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Pending subtasks for new task creation
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);
  const [newPendingSubtask, setNewPendingSubtask] = useState("");
  
  // Query files to look up display names for attachments
  const { data: allFiles = [] } = useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });
  
  // Helper to get display name for an attachment
  const getAttachmentDisplayName = (attachment: string) => {
    const file = allFiles.find(f => f.objectPath === attachment);
    return file?.displayName || attachment.split('/').pop() || 'File';
  };
  
  // Date picker popover state
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [editR4CalendarOpen, setEditR4CalendarOpen] = useState(false);
  const [dupSearching, setDupSearching] = useState(false);
  const [dupResults, setDupResults] = useState<any[] | null>(null);
  const [dupDiffTimeEvents, setDupDiffTimeEvents] = useState<any[]>([]);
  const [dupShowDiffTime, setDupShowDiffTime] = useState(false);
  const [dupDeleting, setDupDeleting] = useState(false);
  const [emailWizardSelected, setEmailWizardSelected] = useState<Set<string>>(new Set());
  const [tempDate, setTempDate] = useState<Date | undefined>(() => {
    if (formData.dueDate) {
      return new Date(formData.dueDate);
    }
    return undefined;
  });
  const [tempHour, setTempHour] = useState(() => {
    if (formData.dueDate) {
      return getETHours(new Date(formData.dueDate)).toString().padStart(2, '0');
    }
    return "18";
  });
  const [tempMinute, setTempMinute] = useState(() => {
    if (formData.dueDate) {
      return getETMinutes(new Date(formData.dueDate)).toString().padStart(2, '0');
    }
    return "00";
  });

  const [showEndDate, setShowEndDate] = useState(() => !!(task?.eventEndDate));
  const [isEndDatePickerOpen, setIsEndDatePickerOpen] = useState(false);
  const [endDateValue, setEndDateValue] = useState<string>(() => {
    if (task?.eventEndDate) {
      const d = new Date(task.eventEndDate);
      return format(d, "yyyy-MM-dd'T'HH:mm");
    }
    return "";
  });
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(() => {
    if (task?.eventEndDate) return new Date(task.eventEndDate);
    return undefined;
  });
  const [tempEndHour, setTempEndHour] = useState(() => {
    if (task?.eventEndDate) return getETHours(new Date(task.eventEndDate)).toString().padStart(2, '0');
    return "23";
  });
  const [tempEndMinute, setTempEndMinute] = useState(() => {
    if (task?.eventEndDate) return getETMinutes(new Date(task.eventEndDate)).toString().padStart(2, '0');
    return "59";
  });

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      // Add the object path to attachments
      setFormData(prev => ({
        ...prev,
        attachments: [...prev.attachments, response.objectPath]
      }));
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadFile(file);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      console.log('[DEBUG] mutationFn called, task:', task ? task.id : 'new', 'eventEndDate:', data.eventEndDate);
      let effectiveDueDate = data.dueDate;
      if (!effectiveDueDate && data.type === 'reminder') {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        effectiveDueDate = tomorrow.toISOString();
      }
      // For MODULE tasks, automatically set startDate to Sunday and dueDate to Friday of current week
      let finalDueDate = new Date(effectiveDueDate);
      let finalStartDate: Date | null = null;
      
      if (data.type === "module" && !task) {
        // Get current date
        const today = new Date();
        const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Calculate Sunday of the current week
        const sunday = new Date(today);
        sunday.setDate(today.getDate() - currentDayOfWeek);
        sunday.setHours(0, 0, 0, 0);
        
        // Calculate Friday of the current week
        const friday = new Date(sunday);
        friday.setDate(sunday.getDate() + 5);
        friday.setHours(18, 0, 0, 0); // 6 PM on Friday
        
        finalStartDate = sunday;
        finalDueDate = friday;
      } else if (data.prepDays > 0) {
        // Calculate startDate from prepDays if set
        const dueDate = new Date(data.dueDate);
        finalStartDate = new Date(dueDate);
        finalStartDate.setDate(finalStartDate.getDate() - data.prepDays);
      }
      
      // Build payload explicitly
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        type: data.type,
        courseName: data.courseName,
        dueDate: finalDueDate.toISOString(),
        eventStartTime: data.eventStartTime || null,
        eventEndTime: data.eventEndTime || null,
        eventEndDate: data.eventEndDate ? new Date(data.eventEndDate).toISOString() : null,
        reminder1: data.reminder1 || null,
        reminder2: data.reminder2 || null,
        reminder3: data.reminder3 || null,
        reminder4: data.reminder4 || null,
        reminder1Methods: data.reminder1Methods || null,
        reminder2Methods: data.reminder2Methods || null,
        reminder3Methods: data.reminder3Methods || null,
        reminder4Methods: data.reminder4Methods || null,
        reminder4DateTime: data.reminder4DateTimeMode && data.reminder4DateTime ? data.reminder4DateTime : null,
        priority: data.priority,
        weekNumber: data.weekNumber,
        referenceLink: data.referenceLink,
        attachments: data.attachments,
        repeatType: data.repeatType,
        repeatInterval: data.repeatType === "custom" ? data.repeatInterval : null,
        repeatIntervalUnit: data.repeatType === "custom" ? data.repeatIntervalUnit : null,
        repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate).toISOString() : null,
        startDate: finalStartDate ? finalStartDate.toISOString() : null,
        hideFromSummary: data.hideFromSummary ?? false,
        hideFromCountdown: data.hideFromCountdown ?? false,
        flagged: data.flagged ?? false,
        showCountdownBar: data.showCountdownBar ?? true,
        showCountdownBarMain: data.showCountdownBarMain ?? true,
        showCountdownBarSummary: data.showCountdownBarSummary ?? true,
        countdownBarDays: data.countdownBarDays ?? 0,
        countdownBarColor: data.countdownBarColor || null,
        repeatSpanDays: data.repeatSpanDays ?? 1,
      };
      if (task) {
        if (onUndoPush) {
          const oldFields: Record<string, any> = {};
          const newFields: Record<string, any> = {};
          for (const key of Object.keys(payload)) {
            const oldVal = (task as any)[key];
            const newVal = payload[key];
            const oldStr = oldVal instanceof Date ? oldVal.toISOString() : String(oldVal ?? '');
            const newStr = String(newVal ?? '');
            if (oldStr !== newStr) {
              oldFields[key] = oldVal instanceof Date ? oldVal.toISOString() : oldVal;
              newFields[key] = newVal;
            }
          }
          if (Object.keys(oldFields).length > 0) {
            onUndoPush({
              type: 'edit',
              description: `Edited "${task.title}"`,
              data: { taskId: task.id, taskTitle: task.title, oldFields, newFields }
            });
          }
        }
        const patchRes = await apiRequest("PATCH", `/api/tasks/${task.id}`, payload);
        if (data.type === 'essay') {
          const hasEssayAttachment = task.attachments?.some((att: any) => {
            try { const parsed = typeof att === 'string' ? JSON.parse(att) : att; return parsed?.type === 'onedrive' && parsed?.name?.includes('BrynKaiHendricks_'); } catch { return false; }
          });
          if (!task.referenceLink && !hasEssayAttachment) {
            try {
              const courseCode = data.courseName?.split(' - ')[0]?.split(' ')[0]?.trim() || '';
              const courseNamePart = data.courseName?.split(' - ').slice(1).join(' - ')?.trim() || '';
              await apiRequest("POST", "/api/tasks/essay-template", {
                taskId: task.id,
                assignmentName: data.title,
                courseCode,
                courseName: courseNamePart,
                dueDate: finalDueDate.toISOString(),
              });
            } catch (essayErr) {
              console.error("Essay template creation failed for edited task:", essayErr);
            }
          }
        }
        return patchRes;
      }
      // Create the task and return the response to get the new task ID
      const response = await apiRequest("POST", "/api/tasks", payload);
      const newTask = await response.json();
      
      // If there are pending subtasks, create them for the new task
      if (pendingSubtasks.length > 0 && newTask?.id) {
        for (const subtaskTitle of pendingSubtasks) {
          await apiRequest("POST", `/api/tasks/${newTask.id}/subtasks`, { title: subtaskTitle });
        }
      }

      if (data.type === 'essay' && newTask?.id && !task) {
        try {
          const courseCode = data.courseName?.split(' - ')[0]?.split(' ')[0]?.trim() || '';
          const courseNamePart = data.courseName?.split(' - ').slice(1).join(' - ')?.trim() || '';
          await apiRequest("POST", "/api/tasks/essay-template", {
            taskId: newTask.id,
            assignmentName: data.title,
            courseCode,
            courseName: courseNamePart,
            dueDate: finalDueDate.toISOString(),
          });
        } catch (essayErr) {
          console.error("Essay template creation failed:", essayErr);
        }
      }

      if (data.type === 'phone_call' && newTask?.id && !task) {
        try {
          const dueDateObj = new Date(finalDueDate);
          const dateStr = dueDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const tickerBody = `📞 ${data.title}${data.courseName ? ` (${data.courseName.split(' - ')[0]?.trim()})` : ''} — ${dateStr}`;
          await apiRequest("POST", "/api/announcements", {
            body: tickerBody,
            courseName: 'REMINDER',
            visibleTo: ['5747', '4201', '1010'],
          });
        } catch (tickerErr) {
          console.error("Phone call ticker item creation failed:", tickerErr);
        }
      }
      
      return newTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/announcements"] });
      setPendingSubtasks([]); // Clear pending subtasks after successful creation
      onSuccess();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to save task. Please try again.", variant: "destructive" });
    },
  });

  const futureSiblingCount = task ? allTasks.filter(t => t.id !== task.id && t.title === task.title && t.courseName === task.courseName && !t.isCompleted && new Date(t.dueDate) > new Date(task.dueDate)).length : 0;

  const [updateSimilarPending, setUpdateSimilarPending] = useState(false);
  const handleUpdateSimilar = async () => {
    if (!task) return;
    setUpdateSimilarPending(true);
    try {
      const data = formData;
      const finalDueDate = new Date(data.dueDate);
      let finalStartDate: Date | null = null;
      if (data.startDate) {
        finalStartDate = new Date(data.startDate);
      } else if (data.prepDays > 0) {
        finalStartDate = new Date(finalDueDate);
        finalStartDate.setDate(finalStartDate.getDate() - data.prepDays);
      }
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        type: data.type,
        courseName: data.courseName,
        dueDate: finalDueDate.toISOString(),
        eventStartTime: data.eventStartTime || null,
        eventEndTime: data.eventEndTime || null,
        eventEndDate: data.eventEndDate ? new Date(data.eventEndDate).toISOString() : null,
        reminder1: data.reminder1 || null,
        reminder2: data.reminder2 || null,
        reminder3: data.reminder3 || null,
        reminder4: data.reminder4 || null,
        reminder1Methods: data.reminder1Methods || null,
        reminder2Methods: data.reminder2Methods || null,
        reminder3Methods: data.reminder3Methods || null,
        reminder4Methods: data.reminder4Methods || null,
        priority: data.priority,
        weekNumber: data.weekNumber,
        referenceLink: data.referenceLink,
        attachments: data.attachments,
        hideFromSummary: data.hideFromSummary ?? false,
        hideFromCountdown: data.hideFromCountdown ?? false,
        flagged: data.flagged ?? false,
        showCountdownBar: data.showCountdownBar ?? true,
        showCountdownBarMain: data.showCountdownBarMain ?? true,
        showCountdownBarSummary: data.showCountdownBarSummary ?? true,
        countdownBarDays: data.countdownBarDays ?? 0,
        countdownBarColor: data.countdownBarColor || null,
        startDate: finalStartDate ? finalStartDate.toISOString() : null,
        originalTitle: task.title,
      };
      await apiRequest("PATCH", `/api/tasks/${task.id}/update-similar`, payload);
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      toast({ title: "Updated", description: `Updated this task and ${futureSiblingCount} similar future task${futureSiblingCount !== 1 ? 's' : ''}.` });
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to update similar tasks.", variant: "destructive" });
    } finally {
      setUpdateSimilarPending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('[DEBUG] handleSubmit fired, formData:', JSON.stringify({ dueDate: formData.dueDate, eventEndDate: formData.eventEndDate, type: formData.type, title: formData.title }));
    if (!formData.dueDate && formData.type !== 'reminder' && formData.type !== 'module') {
      console.log('[DEBUG] Missing dueDate, showing toast');
      toast({ title: "Missing due date", description: "Please select a due date for this task.", variant: "destructive" });
      return;
    }
    if (!formData.dueDate && formData.type === 'reminder') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      formData.dueDate = format(tomorrow, "yyyy-MM-dd'T'HH:mm");
    }
    const isLinkedRecurring = task && ((task.repeatType && task.repeatType !== 'none') || !!task.parentTaskId);
    const hasSameTitleSiblings = task && !isLinkedRecurring && allTasks.filter(t => t.id !== task.id && t.title === task.title && t.courseName === task.courseName && !t.isCompleted).length > 0;
    console.log('[DEBUG] isLinkedRecurring:', isLinkedRecurring, 'hasSameTitleSiblings:', hasSameTitleSiblings, 'task:', !!task, 'onRecurringEdit:', !!onRecurringEdit);
    if (task && onRecurringEdit && (isLinkedRecurring || (hasSameTitleSiblings && formData.title !== task.title))) {
      const data = formData;
      const finalDueDate = new Date(data.dueDate);
      let finalStartDate: Date | null = null;
      if (data.startDate) {
        finalStartDate = new Date(data.startDate);
      } else if (data.prepDays > 0) {
        finalStartDate = new Date(finalDueDate);
        finalStartDate.setDate(finalStartDate.getDate() - data.prepDays);
      }
      const payload: Record<string, unknown> = {
        title: data.title,
        description: data.description,
        type: data.type,
        courseName: data.courseName,
        dueDate: finalDueDate.toISOString(),
        eventStartTime: data.eventStartTime || null,
        eventEndTime: data.eventEndTime || null,
        eventEndDate: data.eventEndDate ? new Date(data.eventEndDate).toISOString() : null,
        reminder1: data.reminder1 || null,
        reminder2: data.reminder2 || null,
        reminder3: data.reminder3 || null,
        reminder4: data.reminder4 || null,
        reminder1Methods: data.reminder1Methods || null,
        reminder2Methods: data.reminder2Methods || null,
        reminder3Methods: data.reminder3Methods || null,
        reminder4Methods: data.reminder4Methods || null,
        reminder4DateTime: data.reminder4DateTimeMode && data.reminder4DateTime ? data.reminder4DateTime : null,
        priority: data.priority,
        weekNumber: data.weekNumber,
        referenceLink: data.referenceLink,
        attachments: data.attachments,
        repeatType: data.repeatType,
        repeatInterval: data.repeatType === "custom" ? data.repeatInterval : null,
        repeatIntervalUnit: data.repeatType === "custom" ? data.repeatIntervalUnit : null,
        repeatEndDate: data.repeatEndDate ? new Date(data.repeatEndDate).toISOString() : null,
        startDate: finalStartDate ? finalStartDate.toISOString() : null,
        hideFromSummary: data.hideFromSummary ?? false,
        hideFromCountdown: data.hideFromCountdown ?? false,
        flagged: data.flagged ?? false,
        showCountdownBar: data.showCountdownBar ?? true,
        showCountdownBarMain: data.showCountdownBarMain ?? true,
        showCountdownBarSummary: data.showCountdownBarSummary ?? true,
        countdownBarDays: data.countdownBarDays ?? 0,
        countdownBarColor: data.countdownBarColor || null,
        repeatSpanDays: data.repeatSpanDays ?? 1,
      };
      if (hasSameTitleSiblings && !isLinkedRecurring) {
        payload.originalTitle = task.title;
      }
      console.log('[DEBUG] Taking onRecurringEdit path');
      onRecurringEdit(task.id, task.title, payload, onSuccess);
      return;
    }
    console.log('[DEBUG] Calling createMutation.mutate, task:', task ? task.id : 'new');
    createMutation.mutate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3" data-task-form {...(task ? { 'data-edit-task-form': true, style: { marginTop: '-8px' } } : {})}>
      <div className="grid grid-cols-2 gap-5">
        {/* Left Column */}
        <div className="space-y-3">
          <div>
            <Label htmlFor="title" className="text-[11px] text-white">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Assignment title"
              required
              data-testid="input-title"
              className="bg-white h-8 font-normal"
              style={{ color: 'black', fontSize: '11px' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="courseName" className="text-[11px] text-white">Course</Label>
              <select
                value={formData.courseName}
                onChange={(e) => setFormData(prev => ({ ...prev, courseName: e.target.value }))}
                data-testid="select-course"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 font-normal ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                <option value="">Select course</option>
                {(() => {
                  if (currentSemesterCourses && currentSemesterCourses.length > 0) {
                    return currentSemesterCourses.map(course => (
                      <option key={course.code} value={`${course.code} - ${course.name}`}>
                        {course.code} - {course.name}
                      </option>
                    ));
                  }
                  return COURSES.map(course => (
                    <option key={course.code} value={`${course.code} - ${course.name}`}>
                      {course.code} - {course.name}
                    </option>
                  ));
                })()}
                <option value="School - Toronto Metropolitan University" style={{ fontWeight: 600 }}>School - Toronto Metropolitan University</option>
              </select>
            </div>

            <div>
              <Label htmlFor="type" className="text-[11px] text-white">Type</Label>
              <div className="relative">
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  data-testid="select-type"
                  className="flex h-8 w-full rounded-md border border-input bg-white pl-7 pr-2 py-1 font-normal ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 appearance-none"
                  style={{ color: 'black', fontSize: '11px' }}
                >
                  {TASK_TYPES.map(type => (
                    <option key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: calendarTypeIconColors[formData.type] || '#6b7280' }}>
                  {(() => { const Icon = iconMap[formData.type] || MoreHorizontal; return <Icon className="h-3.5 w-3.5" />; })()}
                </div>
              </div>
            </div>
          </div>

          <div>
            <Label htmlFor="dueDate" className="text-[11px] text-white">Due Date</Label>
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal h-8 bg-white"
                  style={{ color: 'black', fontSize: '11px' }}
                  data-testid="input-duedate"
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {formData.dueDate ? format(new Date(formData.dueDate), "MMM d, yyyy 'at' h:mm a") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side="top" style={{ zIndex: 10010, maxHeight: '50vh', overflowY: 'auto' }} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onFocusOutside={(e) => e.preventDefault()}>
                <div className="p-3">
                  {(() => {
                    const now = new Date();
                    const dueDate = tempDate || (formData.dueDate ? new Date(formData.dueDate) : null);
                    const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 });
                    const dueWeekEnd = dueDate ? endOfWeek(dueDate, { weekStartsOn: 0 }) : null;
                    const nowMonth = now.getFullYear() * 12 + now.getMonth();
                    const dueMonth = dueDate ? dueDate.getFullYear() * 12 + dueDate.getMonth() : nowMonth;
                    const numMonths = Math.min(Math.max(1, dueMonth - nowMonth + 1), 2);
                    const weekRangeDays: Date[] = [];
                    if (dueDate && dueWeekEnd) {
                      let d = new Date(currentWeekStart);
                      while (d <= dueWeekEnd) {
                        weekRangeDays.push(new Date(d));
                        d = addDays(d, 1);
                      }
                    }
                    return (
                      <CalendarPicker
                        mode="single"
                        selected={tempDate}
                        onSelect={(date) => {
                          if (date) {
                            setTempDate(date);
                          }
                        }}
                        defaultMonth={now}
                        numberOfMonths={numMonths}
                        modifiers={{ weekRange: weekRangeDays }}
                        modifiersStyles={{ weekRange: { backgroundColor: 'rgba(59, 130, 246, 0.12)', borderRadius: 0 } }}
                        classNames={{ months: "flex flex-col space-y-4" }}
                      />
                    );
                  })()}
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-medium shrink-0">Time</Label>
                      {(() => {
                        const h24 = parseInt(tempHour);
                        const isPM = h24 >= 12;
                        const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                        return (
                          <>
                            <select
                              value={h12}
                              onChange={(e) => { const v = Number(e.target.value); const h = v === 12 ? 0 : v; setTempHour(String(isPM ? h + 12 : h).padStart(2, '0')); }}
                              className="w-14 h-8 rounded-md border border-input bg-white px-1 font-normal"
                              style={{ color: 'black', fontSize: '11px' }}
                              data-testid="select-due-hour"
                            >
                              {Array.from({ length: 12 }, (_, i) => i + 1).map(v => <option key={v} value={v}>{v}</option>)}
                            </select>
                            <span>:</span>
                            <select
                              value={tempMinute}
                              onChange={(e) => setTempMinute(e.target.value)}
                              className="w-14 h-8 rounded-md border border-input bg-white px-1 font-normal"
                              style={{ color: 'black', fontSize: '11px' }}
                              data-testid="select-due-minute"
                            >
                              {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(min => <option key={min} value={min}>{min}</option>)}
                            </select>
                            <select
                              value={isPM ? 'PM' : 'AM'}
                              onChange={(e) => { const pm = e.target.value === 'PM'; const cur12 = h12 === 12 ? 0 : h12; setTempHour(String(pm ? cur12 + 12 : cur12).padStart(2, '0')); }}
                              className="w-14 h-8 rounded-md border border-input bg-white px-1 font-medium"
                              style={{ color: 'black', fontSize: '11px' }}
                              data-testid="select-due-ampm"
                            >
                              <option value="AM">AM</option>
                              <option value="PM">PM</option>
                            </select>
                          </>
                        );
                      })()}
                      <div className="flex-1" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsDatePickerOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (tempDate) {
                            const newDate = new Date(tempDate);
                            newDate.setHours(parseInt(tempHour), parseInt(tempMinute), 0, 0);
                            setFormData(prev => ({ ...prev, dueDate: format(newDate, "yyyy-MM-dd'T'HH:mm"), eventStartTime: `${tempHour}:${tempMinute}` }));
                          }
                          setIsDatePickerOpen(false);
                        }}
                        data-testid="button-apply-date"
                      >
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="showEndDate"
                checked={showEndDate}
                onChange={(e) => {
                  setShowEndDate(e.target.checked);
                  if (!e.target.checked) {
                    setEndDateValue("");
                    setTempEndDate(undefined);
                    setFormData(prev => ({ ...prev, eventEndTime: '', eventEndDate: '' }));
                  }
                }}
                className="h-3 w-3 rounded border-gray-300"
                data-testid="checkbox-end-date"
              />
              <Label htmlFor="showEndDate" className="text-[10px] text-white/70 cursor-pointer">Add end date/time (optional)</Label>
            </div>
            {showEndDate && (
              <div className="mt-2">
                <Popover open={isEndDatePickerOpen} onOpenChange={setIsEndDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal h-8 bg-white"
                      style={{ color: 'black', fontSize: '11px' }}
                      data-testid="input-enddate"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {endDateValue ? format(new Date(endDateValue), "MMM d, yyyy 'at' h:mm a") : "Pick end date/time"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start" side="top" style={{ zIndex: 10010, maxHeight: '50vh', overflowY: 'auto' }} onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()} onPointerDownOutside={(e) => e.preventDefault()} onFocusOutside={(e) => e.preventDefault()}>
                    <div className="p-3">
                      <CalendarPicker
                        mode="single"
                        selected={tempEndDate}
                        onSelect={(date) => { if (date) setTempEndDate(date); }}
                        defaultMonth={tempDate || new Date()}
                        numberOfMonths={1}
                      />
                      <div className="border-t pt-3 mt-3">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-medium shrink-0">End Time</Label>
                          {(() => {
                            const h24 = parseInt(tempEndHour);
                            const isPM = h24 >= 12;
                            const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
                            return (
                              <>
                                <select
                                  value={h12}
                                  onChange={(e) => { const v = Number(e.target.value); const h = v === 12 ? 0 : v; setTempEndHour(String(isPM ? h + 12 : h).padStart(2, '0')); }}
                                  className="w-14 h-8 rounded-md border border-input bg-white px-1 font-normal"
                                  style={{ color: 'black', fontSize: '11px' }}
                                  data-testid="select-end-date-hour"
                                >
                                  {Array.from({ length: 12 }, (_, i) => i + 1).map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                                <span>:</span>
                                <select
                                  value={tempEndMinute}
                                  onChange={(e) => setTempEndMinute(e.target.value)}
                                  className="w-14 h-8 rounded-md border border-input bg-white px-1 font-normal"
                                  style={{ color: 'black', fontSize: '11px' }}
                                  data-testid="select-end-date-minute"
                                >
                                  {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(min => <option key={min} value={min}>{min}</option>)}
                                </select>
                                <select
                                  value={isPM ? 'PM' : 'AM'}
                                  onChange={(e) => { const pm = e.target.value === 'PM'; const cur12 = h12 === 12 ? 0 : h12; setTempEndHour(String(pm ? cur12 + 12 : cur12).padStart(2, '0')); }}
                                  className="w-14 h-8 rounded-md border border-input bg-white px-1 font-medium"
                                  style={{ color: 'black', fontSize: '11px' }}
                                  data-testid="select-end-date-ampm"
                                >
                                  <option value="AM">AM</option>
                                  <option value="PM">PM</option>
                                </select>
                              </>
                            );
                          })()}
                          <div className="flex-1" />
                          <Button variant="outline" size="sm" onClick={() => setIsEndDatePickerOpen(false)}>Cancel</Button>
                          <Button
                            size="sm"
                            onClick={() => {
                              if (tempEndDate) {
                                const newDate = new Date(tempEndDate);
                                newDate.setHours(parseInt(tempEndHour), parseInt(tempEndMinute), 0, 0);
                                setEndDateValue(format(newDate, "yyyy-MM-dd'T'HH:mm"));
                                setFormData(prev => ({ ...prev, eventEndTime: `${tempEndHour}:${tempEndMinute}`, eventEndDate: newDate.toISOString() }));
                              }
                              setIsEndDatePickerOpen(false);
                            }}
                            data-testid="button-apply-end-date"
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Label htmlFor="priority" className="text-[11px] text-white">Priority</Label>
              <div className="flex items-center gap-2">
                <select
                  value={formData.priority}
                  onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                  data-testid="select-priority"
                  className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ color: 'black', fontSize: '11px' }}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, flagged: !prev.flagged, priority: !prev.flagged ? 'high' : prev.priority }))}
                  className={`h-8 w-8 flex items-center justify-center rounded-md border transition-all flex-shrink-0 ${formData.flagged ? 'bg-red-500/20 border-red-500/50 text-red-400' : 'bg-white/10 border-white/20 text-white/40 hover:text-red-400 hover:border-red-400/50'}`}
                  title={formData.flagged ? 'Remove flag' : 'Flag as priority'}
                  data-testid="button-flag-task"
                >
                  <Flag className={`h-4 w-4 ${formData.flagged ? 'fill-red-400' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex-1">
              <Label className="text-[11px] text-white">Repeat</Label>
              <select
                value={formData.repeatType}
                onChange={(e) => setFormData(prev => ({ ...prev, repeatType: e.target.value as typeof REPEAT_TYPES[number] }))}
                data-testid="select-repeat-type"
                className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                style={{ color: 'black', fontSize: '11px' }}
              >
                <option value="none">No repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="custom">Custom...</option>
              </select>
            </div>
            <div className="flex items-end" style={{ paddingBottom: '1px' }}>
              <Button
                variant="outline"
                className="text-[9px] h-8 px-2 text-orange-300 border-orange-400/40 hover:bg-orange-500/15 hover:text-orange-200"
                disabled={dupSearching || !task?.id}
                data-testid="button-find-duplicates"
                onClick={async () => {
                  if (!task?.id) return;
                  setDupSearching(true);
                  setDupResults(null);
                  setDupDiffTimeEvents([]);
                  setDupShowDiffTime(false);
                  try {
                    const resp = await fetch(`/api/tasks/${task.id}/find-calendar-duplicates`, { method: 'POST', credentials: 'include' });
                    const data = await resp.json();
                    const exact = (data.duplicates || []).filter((d: any) => d.isExactTime);
                    const diffTime = (data.duplicates || []).filter((d: any) => !d.isExactTime);
                    setDupResults(exact);
                    setDupDiffTimeEvents(diffTime);
                  } catch { setDupResults([]); }
                  setDupSearching(false);
                }}
              >
                {dupSearching ? 'Searching...' : 'Find Duplicates'}
              </Button>
            </div>
          </div>

          {formData.repeatType === "custom" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[11px] text-white">Every</Label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={formData.repeatInterval}
                  onChange={(e) => setFormData(prev => ({ ...prev, repeatInterval: parseInt(e.target.value) || 1 }))}
                  data-testid="input-repeat-interval"
                  className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ color: 'black', fontSize: '11px' }}
                />
              </div>
              <div>
                <Label className="text-[11px] text-white">Unit</Label>
                <select
                  value={formData.repeatIntervalUnit}
                  onChange={(e) => setFormData(prev => ({ ...prev, repeatIntervalUnit: e.target.value as typeof REPEAT_INTERVAL_UNITS[number] }))}
                  data-testid="select-repeat-unit"
                  className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  style={{ color: 'black', fontSize: '11px' }}
                >
                  <option value="days">Days</option>
                  <option value="weeks">Weeks</option>
                  <option value="months">Months</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
          )}

          {formData.repeatType !== "none" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[11px] text-white">Span (consecutive days)</Label>
                  <select
                    value={formData.repeatSpanDays}
                    onChange={(e) => setFormData(prev => ({ ...prev, repeatSpanDays: parseInt(e.target.value) }))}
                    data-testid="select-repeat-span-days"
                    className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    style={{ color: 'black', fontSize: '11px' }}
                  >
                    {[1,2,3,4,5,6,7,10,14].map(n => (
                      <option key={n} value={n}>{n === 1 ? '1 day (no span)' : `${n} days in a row`}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-[11px] text-white">End Repeat (optional)</Label>
                  <input
                    type="date"
                    value={formData.repeatEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, repeatEndDate: e.target.value }))}
                    data-testid="input-repeat-end-date"
                    className="flex h-8 w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    style={{ color: 'black', fontSize: '11px' }}
                  />
                </div>
              </div>
            </>
          )}

          {formData.repeatType !== "none" && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <Label className="text-[11px] text-white">Partner shift adjust</Label>
                <span className="text-white/50 text-[9px]">Shift time ±12h on night-shift days</span>
              </div>
              <button
                onClick={() => setFormData(prev => ({ ...prev, shiftAdjust: !prev.shiftAdjust }))}
                className="relative shrink-0"
                style={{ width: '34px', height: '18px', borderRadius: '9px', background: formData.shiftAdjust ? 'rgba(139,92,246,0.7)' : 'rgba(255,255,255,0.15)', border: '0.5px solid rgba(255,255,255,0.3)', transition: 'background 0.2s' }}
                data-testid="edit-task-shift-adjust"
              >
                <div style={{ width: '14px', height: '14px', borderRadius: '7px', background: '#fff', position: 'absolute', top: '2px', left: formData.shiftAdjust ? '18px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          )}

          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px' }}>Reminders</span>
            <div className="flex flex-col gap-2" style={{ marginTop: '8px' }}>
              {([
                { label: 'R1', key: 'reminder1' as const, methodsKey: 'reminder1Methods' as const },
                { label: 'R2', key: 'reminder2' as const, methodsKey: 'reminder2Methods' as const },
                { label: 'R3', key: 'reminder3' as const, methodsKey: 'reminder3Methods' as const },
                { label: 'R4', key: 'reminder4' as const, methodsKey: 'reminder4Methods' as const },
              ] as const).map(r => {
                const isR4 = r.key === 'reminder4';
                const curMethods = (formData[r.methodsKey] || '') as string;
                const mList = curMethods ? curMethods.split(',') : [];
                const toggleM = (method: string) => {
                  setFormData(prev => {
                    const cur = (prev[r.methodsKey] || '') as string;
                    const arr = cur ? cur.split(',') : [];
                    const next = arr.includes(method) ? arr.filter(m => m !== method) : [...arr, method];
                    return { ...prev, [r.methodsKey]: next.join(',') };
                  });
                };
                return (
                <div key={r.key} className="flex flex-col gap-1 bg-white/5 rounded-md px-2 py-1.5 border border-white/10">
                  <div className="flex items-center gap-1.5">
                    <span className="text-white text-[10px] w-[22px] shrink-0">{r.label}</span>
                    {isR4 && formData.reminder4DateTimeMode ? (
                      <div className="flex items-center gap-1 flex-1">
                        <Popover open={editR4CalendarOpen} onOpenChange={setEditR4CalendarOpen}>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="flex-1 h-7 rounded-md border border-input bg-white px-2 py-0.5 text-left"
                              style={{ color: 'black', fontSize: '10px' }}
                              data-testid="edit-reminder4-date"
                            >
                              {formData.reminder4DateTime?.split('T')[0] ? format(new Date(formData.reminder4DateTime.split('T')[0] + 'T12:00:00'), 'MMM d, yyyy') : 'Pick date'}
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start" side="top" sideOffset={4} style={{ zIndex: 99999 }}>
                            <CalendarPicker
                              mode="single"
                              selected={formData.reminder4DateTime?.split('T')[0] ? new Date(formData.reminder4DateTime.split('T')[0] + 'T12:00:00') : undefined}
                              onSelect={(date) => {
                                if (date) {
                                  const yyyy = date.getFullYear();
                                  const mm = String(date.getMonth() + 1).padStart(2, '0');
                                  const dd = String(date.getDate()).padStart(2, '0');
                                  const dateStr = `${yyyy}-${mm}-${dd}`;
                                  const dt = formData.reminder4DateTime || '';
                                  const timePart = dt.includes('T') ? dt.split('T')[1] : '09:00';
                                  setFormData(prev => ({ ...prev, reminder4DateTime: `${dateStr}T${timePart}` }));
                                }
                                setEditR4CalendarOpen(false);
                              }}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <select
                          value={(() => { const dt = formData.reminder4DateTime || ''; const t = dt.includes('T') ? dt.split('T')[1] : '09:00'; return t.split(':')[0] || '09'; })()}
                          onChange={(e) => {
                            const dt = formData.reminder4DateTime || '';
                            const datePart = dt.includes('T') ? dt.split('T')[0] : '';
                            const minPart = dt.includes('T') ? (dt.split('T')[1]?.split(':')[1] || '00') : '00';
                            setFormData(prev => ({ ...prev, reminder4DateTime: `${datePart}T${e.target.value}:${minPart}` }));
                          }}
                          className="w-[56px] h-7 rounded-md border border-input bg-white px-0.5 py-0.5"
                          style={{ color: 'black', fontSize: '10px' }}
                          data-testid="edit-reminder4-hour"
                        >
                          {Array.from({ length: 24 }, (_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')}>{i === 0 ? '12AM' : i < 12 ? `${i}AM` : i === 12 ? '12PM' : `${i-12}PM`}</option>
                          ))}
                        </select>
                        <select
                          value={(() => { const dt = formData.reminder4DateTime || ''; const t = dt.includes('T') ? dt.split('T')[1] : '09:00'; return t.split(':')[1] || '00'; })()}
                          onChange={(e) => {
                            const dt = formData.reminder4DateTime || '';
                            const datePart = dt.includes('T') ? dt.split('T')[0] : '';
                            const hourPart = dt.includes('T') ? (dt.split('T')[1]?.split(':')[0] || '09') : '09';
                            setFormData(prev => ({ ...prev, reminder4DateTime: `${datePart}T${hourPart}:${e.target.value}` }));
                          }}
                          className="w-[46px] h-7 rounded-md border border-input bg-white px-0.5 py-0.5"
                          style={{ color: 'black', fontSize: '10px' }}
                          data-testid="edit-reminder4-minute"
                        >
                          {Array.from({ length: 60 }, (_, i) => (
                            <option key={i} value={i.toString().padStart(2, '0')}>{i.toString().padStart(2, '0')}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, reminder4DateTimeMode: false, reminder4DateTime: '' }))}
                          className="text-[9px] text-white/40 hover:text-white/60 underline"
                          data-testid="edit-reminder4-switch-relative"
                        >
                          relative
                        </button>
                      </div>
                    ) : (
                    <select
                      value={String(formData[r.key])}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val === -2 && isR4) {
                          setFormData(prev => ({ ...prev, reminder4DateTimeMode: true, reminder4DateTime: prev.reminder4DateTime || '' }));
                        } else {
                          setFormData(prev => ({ ...prev, [r.key]: val, ...(isR4 ? { reminder4DateTimeMode: false } : {}) }));
                        }
                      }}
                      data-testid={`select-${r.key}`}
                      className="flex h-7 flex-1 rounded-md border border-input bg-white px-1 py-0.5 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      style={{ color: 'black', fontSize: '10px' }}
                    >
                      {REMINDER_OPTIONS.map(opt => (
                        <option key={opt.value} value={String(opt.value)}>{opt.label}</option>
                      ))}
                      {isR4 && <option value="-2">Specific date/time...</option>}
                    </select>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-0.5 pl-[22px]">
                    {[
                      { id: 'email', label: 'Email', icon: '✉️' },
                      { id: 'sms', label: 'SMS', icon: '💬' },
                      { id: 'alarm', label: 'Alarm', icon: '⏰' },
                      { id: 'calendar', label: 'Cal', icon: '📅' },
                      { id: 'alexa', label: 'Alexa', icon: '🔊' },
                    ].map(method => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => toggleM(method.id)}
                        className={`px-1 py-0 rounded text-[8px] border transition-colors ${mList.includes(method.id) ? 'bg-blue-500/30 border-blue-400/50 text-blue-300' : 'bg-white/5 border-white/10 text-white hover:text-white'}`}
                        data-testid={`edit-${r.key}-method-${method.id}`}
                      >
                        {method.icon} {method.label}
                      </button>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-3">
          <div>
            <Label htmlFor="description" className="text-[11px] text-white">Description</Label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Add notes or details..."
              rows={3}
              data-testid="input-description"
              className="flex w-full rounded-md border border-input bg-white px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-none"
              style={{ color: 'black', fontSize: '11px' }}
            />
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.45)', letterSpacing: '0.5px' }}>Display Options</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' }}>
              <div className="flex items-center justify-between" data-testid="toggle-hide-from-summary">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>Hide task from summary rows</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.hideFromSummary}
                  onClick={() => setFormData(prev => ({ ...prev, hideFromSummary: !prev.hideFromSummary }))}
                  style={{
                    width: '34px', height: '18px', borderRadius: '9px', position: 'relative',
                    background: formData.hideFromSummary ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                    border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: '2px', transition: 'left 0.2s',
                    left: formData.hideFromSummary ? '18px' : '2px',
                  }} />
                </button>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex items-center justify-between" data-testid="toggle-hide-from-countdown">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>Hide task from countdown box</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.hideFromCountdown}
                  onClick={() => setFormData(prev => ({ ...prev, hideFromCountdown: !prev.hideFromCountdown }))}
                  style={{
                    width: '34px', height: '18px', borderRadius: '9px', position: 'relative',
                    background: formData.hideFromCountdown ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                    border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: '2px', transition: 'left 0.2s',
                    left: formData.hideFromCountdown ? '18px' : '2px',
                  }} />
                </button>
              </div>
              <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)' }} />
              <div className="flex items-center justify-between" data-testid="toggle-show-countdown-bar-edit">
                <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.8)' }}>Show countdown bar</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={formData.showCountdownBar}
                  onClick={() => setFormData(prev => ({ ...prev, showCountdownBar: !prev.showCountdownBar }))}
                  style={{
                    width: '34px', height: '18px', borderRadius: '9px', position: 'relative',
                    background: formData.showCountdownBar ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                    border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                  }}
                >
                  <div style={{
                    width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: '2px', transition: 'left 0.2s',
                    left: formData.showCountdownBar ? '18px' : '2px',
                  }} />
                </button>
              </div>
              {formData.showCountdownBar && (
                <div style={{ paddingLeft: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                  <div className="flex items-center justify-between" data-testid="toggle-countdown-bar-main">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.9)' }}>Main tasks</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.showCountdownBarMain}
                      onClick={() => setFormData(prev => ({ ...prev, showCountdownBarMain: !prev.showCountdownBarMain }))}
                      style={{
                        width: '34px', height: '18px', borderRadius: '9px', position: 'relative',
                        background: formData.showCountdownBarMain ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                        border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: '2px', transition: 'left 0.2s',
                        left: formData.showCountdownBarMain ? '18px' : '2px',
                      }} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between" data-testid="toggle-countdown-bar-summary">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.9)' }}>Summary tasks</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={formData.showCountdownBarSummary}
                      onClick={() => setFormData(prev => ({ ...prev, showCountdownBarSummary: !prev.showCountdownBarSummary }))}
                      style={{
                        width: '34px', height: '18px', borderRadius: '9px', position: 'relative',
                        background: formData.showCountdownBarSummary ? '#3b82f6' : 'rgba(255,255,255,0.15)',
                        border: 'none', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                      }}
                    >
                      <div style={{
                        width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
                        position: 'absolute', top: '2px', transition: 'left 0.2s',
                        left: formData.showCountdownBarSummary ? '18px' : '2px',
                      }} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.9)' }}>Show for</span>
                    <select
                      value={formData.countdownBarDays}
                      onChange={(e) => setFormData(prev => ({ ...prev, countdownBarDays: parseInt(e.target.value) }))}
                      className="rounded border border-white/15 text-white"
                      style={{ fontSize: '10px', padding: '2px 6px', height: '22px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                      data-testid="select-countdown-bar-days-edit"
                    >
                      <option value={0}>All days</option>
                      <option value={3}>3 days</option>
                      <option value={5}>5 days</option>
                      <option value={7}>7 days</option>
                      <option value={10}>10 days</option>
                      <option value={14}>14 days</option>
                      <option value={21}>21 days</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.9)' }}>Bar colour</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {formData.countdownBarColor && (
                        <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: formData.countdownBarColor, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />
                      )}
                      <select
                        value={formData.countdownBarColor}
                        onChange={(e) => setFormData(prev => ({ ...prev, countdownBarColor: e.target.value }))}
                        className="rounded border border-white/15 text-white"
                        style={{ fontSize: '10px', padding: '2px 6px', height: '22px', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)' }}
                        data-testid="select-countdown-bar-color"
                      >
                        <option value="">Auto (urgency)</option>
                        <option value="#ef4444">Red</option>
                        <option value="#e89200">Orange</option>
                        <option value="#eab308">Yellow</option>
                        <option value="#22c55e">Green</option>
                        <option value="#3b82f6">Blue</option>
                        <option value="#8b5cf6">Purple</option>
                        <option value="#ec4899">Pink</option>
                        <option value="#14b8a6">Teal</option>
                        <option value="#6b7280">Grey</option>
                        <option value="#ffffff">White</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.5px' }}>Attachments</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
              {formData.attachments.map((attachment, idx) => (
                <div key={idx} className="flex items-center gap-2" style={{ fontSize: '11px' }}>
                  <Paperclip className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                  <a href={attachment.startsWith('/objects/') ? attachment : attachment} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate flex-1">
                    {getAttachmentDisplayName(attachment)}
                  </a>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      attachments: prev.attachments.filter((_, i) => i !== idx)
                    }))}
                    data-testid={`button-remove-attachment-${idx}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <Button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex-1 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40 h-8"
                  style={{ fontSize: '11px' }}
                  data-testid="button-upload-file"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-3 w-3 mr-1" />
                      Upload New
                    </>
                  )}
                </Button>
                <FileSelector 
                  onSelect={(objectPath) => {
                    if (!formData.attachments.includes(objectPath)) {
                      setFormData(prev => ({
                        ...prev,
                        attachments: [...prev.attachments, objectPath]
                      }));
                    }
                  }}
                  excludePaths={formData.attachments}
                  courseName={formData.courseName}
                />
              </div>
              <div className="flex gap-2">
                <input
                  value={newAttachment}
                  onChange={(e) => setNewAttachment(e.target.value)}
                  placeholder="Or paste URL..."
                  data-testid="input-new-attachment"
                  className="flex h-8 w-full rounded-md border px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  style={{ color: 'white', fontSize: '11px', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-8"
                  style={{ fontSize: '11px' }}
                  onClick={() => {
                    if (newAttachment.trim()) {
                      setFormData(prev => ({
                        ...prev,
                        attachments: [...prev.attachments, newAttachment.trim()]
                      }));
                      setNewAttachment("");
                    }
                  }}
                  data-testid="button-add-attachment"
                >
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '10px 12px' }}>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider shrink-0" style={{ color: 'rgba(255,255,255,0.85)', letterSpacing: '0.5px' }}>Reference Link</span>
              <input
                id="referenceLink"
                type="url"
                value={formData.referenceLink}
                onChange={(e) => setFormData(prev => ({ ...prev, referenceLink: e.target.value }))}
                placeholder="https://example.com"
                data-testid="input-reference-link"
                className="flex h-8 w-full rounded-md border px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ color: 'white', fontSize: '11px', background: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.2)' }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* Subtasks Section - Only show when editing existing task */}
      {task && (
        <SubtasksSection taskId={task.id} />
      )}

      {/* Dependencies Section - Only show when editing existing task */}
      {task && (
        <TaskDependencies taskId={task.id} taskTitle={task.title} />
      )}

      {/* Subtasks Section for NEW tasks - Pending subtasks */}
      {!task && (
        <div className="border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Subtasks (optional)</Label>
            <span className="text-[10px] text-white/60">{pendingSubtasks.length} subtask{pendingSubtasks.length !== 1 ? 's' : ''}</span>
          </div>
          
          {pendingSubtasks.length > 0 && (
            <div className="space-y-1">
              {pendingSubtasks.map((subtask, index) => (
                <div key={index} className="flex items-center gap-2 bg-white/5 rounded px-2 py-1.5">
                  <div className="w-3 h-3 rounded-full border border-white/40" />
                  <span className="flex-1 text-xs">{subtask}</span>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 hover:bg-red-500/20"
                    onClick={() => setPendingSubtasks(prev => prev.filter((_, i) => i !== index))}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2">
            <Input
              placeholder="Add a subtask..."
              value={newPendingSubtask}
              onChange={(e) => setNewPendingSubtask(e.target.value)}
              className="flex-1 h-8 text-xs bg-black/20 border-white/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (newPendingSubtask.trim()) {
                    setPendingSubtasks(prev => [...prev, newPendingSubtask.trim()]);
                    setNewPendingSubtask("");
                  }
                }
              }}
              data-testid="input-new-subtask"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 text-xs hover:bg-white/10"
              onClick={() => {
                if (newPendingSubtask.trim()) {
                  setPendingSubtasks(prev => [...prev, newPendingSubtask.trim()]);
                  setNewPendingSubtask("");
                }
              }}
              data-testid="button-add-subtask"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>
        </div>
      )}

      {task && futureSiblingCount > 0 && hideSubmitButton && (
        <button type="button" onClick={handleUpdateSimilar} data-testid="button-update-similar" style={{ display: 'none' }} />
      )}

      {!hideSubmitButton && (
        <div className="flex justify-end gap-2 pt-2">
          {task && futureSiblingCount > 0 && (
            <button
              type="button"
              disabled={updateSimilarPending}
              onClick={handleUpdateSimilar}
              className="inline-flex items-center justify-center rounded-md px-4 py-1.5 text-white transition-opacity duration-200"
              style={{
                fontSize: '11px',
                border: '1.5px solid rgba(59,130,246,0.6)',
                background: 'linear-gradient(180deg, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0.15) 48%, rgba(59,130,246,0.06) 52%, rgba(59,130,246,0.22) 100%)',
                boxShadow: 'inset 0 1px 0 rgba(59,130,246,0.4), inset 0 -1px 0 rgba(59,130,246,0.1)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(59,130,246,0.5) 0%, rgba(59,130,246,0.22) 48%, rgba(59,130,246,0.1) 52%, rgba(59,130,246,0.3) 100%)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(59,130,246,0.38) 0%, rgba(59,130,246,0.15) 48%, rgba(59,130,246,0.06) 52%, rgba(59,130,246,0.22) 100%)'; }}
              data-testid="button-update-similar"
            >
              {updateSimilarPending ? "Updating..." : `Update Similar (${futureSiblingCount})`}
            </button>
          )}
          <button 
            type="submit" 
            disabled={createMutation.isPending}
            className="inline-flex items-center justify-center rounded-md px-4 py-1.5 text-white transition-opacity duration-200"
            style={{ 
              fontSize: '11px',
              border: '1.5px solid rgba(255,255,255,0.6)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.06) 52%, rgba(255,255,255,0.22) 100%)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -1px 0 rgba(255,255,255,0.1)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.22) 48%, rgba(255,255,255,0.1) 52%, rgba(255,255,255,0.3) 100%)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.15) 48%, rgba(255,255,255,0.06) 52%, rgba(255,255,255,0.22) 100%)'; }}
            data-testid="button-submit-task"
          >
            {createMutation.isPending ? "Saving..." : task ? "Update Task" : "Add Task"}
          </button>
        </div>
      )}
    </form>
  );
}

// Subtasks Section Component
export function SubtasksSection({ taskId }: { taskId: number }) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch subtasks for this task - use array queryKey for proper cache invalidation
  const { data: subtasks = [], isLoading, isError } = useQuery<Subtask[]>({
    queryKey: [`/api/tasks/${taskId}/subtasks`],
  });

  // Create subtask mutation using apiRequest
  const createSubtaskMutation = useMutation({
    mutationFn: async (title: string) => {
      return apiRequest("POST", `/api/tasks/${taskId}/subtasks`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/subtasks`] });
      setNewSubtaskTitle("");
      setShowAddForm(false);
    },
  });

  // Toggle subtask completion using apiRequest
  const toggleSubtaskMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: number; isCompleted: boolean }) => {
      return apiRequest("PATCH", `/api/subtasks/${id}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/subtasks`] });
    },
  });

  // Delete subtask mutation using apiRequest
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/subtasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/subtasks`] });
    },
  });

  const handleAddSubtask = () => {
    if (newSubtaskTitle.trim()) {
      createSubtaskMutation.mutate(newSubtaskTitle.trim());
    }
  };

  const completedCount = subtasks.filter(s => s.isCompleted).length;
  const totalCount = subtasks.length;

  return (
    <div className="border-t pt-4 mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-white/70" />
          <Label className="text-[11px] text-white">Subtasks</Label>
          {totalCount > 0 && (
            <span className="text-[10px] text-white/50">
              ({completedCount}/{totalCount} done)
            </span>
          )}
        </div>
        {!showAddForm && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setShowAddForm(true)}
            className="h-6 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-add-subtask"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-[10px] text-white/50">Loading subtasks...</div>
      ) : isError ? (
        <div className="text-[10px] text-red-400">Failed to load subtasks</div>
      ) : (
        <div className="space-y-1 max-h-40 overflow-y-auto">
          {subtasks.map((subtask) => (
            <div
              key={subtask.id}
              className="flex items-center gap-2 group p-1 rounded hover:bg-white/5"
              data-testid={`subtask-item-${subtask.id}`}
            >
              <button
                type="button"
                onClick={() => toggleSubtaskMutation.mutate({ 
                  id: subtask.id, 
                  isCompleted: !subtask.isCompleted 
                })}
                className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors ${
                  subtask.isCompleted 
                    ? 'bg-green-500 border-green-500' 
                    : 'border-white/40 hover:border-white/60'
                }`}
                data-testid={`button-toggle-subtask-${subtask.id}`}
              >
                {subtask.isCompleted && <Check className="h-3 w-3 text-white" />}
              </button>
              <span 
                className={`flex-1 text-[11px] ${
                  subtask.isCompleted ? 'text-white/40 line-through' : 'text-white/90'
                }`}
              >
                {subtask.title}
              </span>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                className="h-5 w-5 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/20"
                data-testid={`button-delete-subtask-${subtask.id}`}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {subtasks.length === 0 && !showAddForm && (
            <div className="text-[10px] text-white/40 py-2">
              No subtasks yet. Click "Add" to create one.
            </div>
          )}
        </div>
      )}

      {/* Add subtask form */}
      {showAddForm && (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Subtask title..."
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddSubtask();
              } else if (e.key === "Escape") {
                setShowAddForm(false);
                setNewSubtaskTitle("");
              }
            }}
            autoFocus
            className="flex h-7 flex-1 rounded-md bg-white/10 px-2 py-1 ring-offset-background focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 text-white placeholder:text-white/40"
            style={{ fontSize: '11px' }}
            data-testid="input-new-subtask"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddSubtask}
            disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
            className="h-7 px-2 text-[10px] bg-green-600 hover:bg-green-500 text-white"
            data-testid="button-save-subtask"
          >
            {createSubtaskMutation.isPending ? "..." : "Add"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowAddForm(false);
              setNewSubtaskTitle("");
            }}
            className="h-7 px-2 text-[10px] text-white/70 hover:text-white hover:bg-white/10"
            data-testid="button-cancel-subtask"
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}

export function TaskDependencies({ taskId, taskTitle }: { taskId: number; taskTitle: string }) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLinkType, setSelectedLinkType] = useState<string>("blocks");

  const { data: allLinks = [] } = useQuery<TaskLink[]>({
    queryKey: ['/api/links'],
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
  });

  const taskLinks = allLinks.filter(
    l => (l.sourceType === 'task' && l.sourceId === taskId) ||
         (l.targetType === 'task' && l.targetId === taskId)
  );

  const createLinkMutation = useMutation({
    mutationFn: async (data: { targetId: number; linkType: string }) => {
      return apiRequest("POST", "/api/links", {
        sourceType: "task",
        sourceId: taskId,
        targetType: "task",
        targetId: data.targetId,
        linkType: data.linkType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
      setShowAddForm(false);
      setSearchQuery("");
    },
  });

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: number) => {
      return apiRequest("DELETE", `/api/links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/links'] });
    },
  });

  const linkTypeLabels: Record<string, string> = {
    blocks: "Blocks",
    blocked_by: "Blocked by",
    relates_to: "Related to",
  };

  const linkTypeColors: Record<string, string> = {
    blocks: "text-orange-400",
    blocked_by: "text-red-400",
    relates_to: "text-blue-400",
  };

  const filteredTasks = allTasks.filter(t => {
    if (t.id === taskId) return false;
    const alreadyLinked = taskLinks.some(
      l => (l.sourceId === t.id && l.sourceType === 'task') ||
           (l.targetId === t.id && l.targetType === 'task')
    );
    if (alreadyLinked) return false;
    if (!searchQuery.trim()) return false;
    const q = searchQuery.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.courseName || '').toLowerCase().includes(q);
  });

  const getLinkedTaskInfo = (link: TaskLink) => {
    const linkedId = link.sourceId === taskId && link.sourceType === 'task' ? link.targetId : link.sourceId;
    const linkedTask = allTasks.find(t => t.id === linkedId);
    let displayType = link.linkType;
    if (link.targetId === taskId && link.targetType === 'task') {
      if (link.linkType === 'blocks') displayType = 'blocked_by';
      else if (link.linkType === 'blocked_by') displayType = 'blocks';
    }
    return { linkedTask, displayType };
  };

  return (
    <div className="space-y-2 pt-2 border-t border-white/10">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/60 font-medium">Dependencies</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-white/60 hover:text-white hover:bg-white/10"
          onClick={() => setShowAddForm(!showAddForm)}
          data-testid="button-toggle-dependencies"
        >
          {showAddForm ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3 mr-1" />}
          {showAddForm ? "" : "Add"}
        </Button>
      </div>

      {taskLinks.length === 0 && !showAddForm && (
        <p className="text-xs text-white/30 italic">No dependencies</p>
      )}

      {taskLinks.map(link => {
        const { linkedTask, displayType } = getLinkedTaskInfo(link);
        if (!linkedTask) return null;
        return (
          <div key={link.id} className="flex items-center gap-2 rounded px-2 py-1.5 bg-white/5" data-testid={`dependency-${link.id}`}>
            <span className={`text-[10px] font-medium uppercase tracking-wider ${linkTypeColors[displayType] || 'text-white/50'}`}>
              {linkTypeLabels[displayType] || displayType}
            </span>
            <span className="text-xs text-white/80 truncate flex-1">{linkedTask.title}</span>
            {linkedTask.courseName && (
              <span className="text-[10px] text-white/40 truncate max-w-[120px]">{linkedTask.courseName.split(' - ')[0]}</span>
            )}
            <button
              type="button"
              onClick={() => deleteLinkMutation.mutate(link.id)}
              className="shrink-0 p-0.5 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400"
              data-testid={`button-delete-dependency-${link.id}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}

      {showAddForm && (
        <div className="space-y-2 p-2 rounded bg-white/5 border border-white/10">
          <div className="flex gap-2">
            <select
              value={selectedLinkType}
              onChange={(e) => setSelectedLinkType(e.target.value)}
              className="h-7 text-xs rounded bg-white/10 text-white px-2"
              data-testid="select-link-type"
            >
              <option value="blocks">Blocks</option>
              <option value="blocked_by">Blocked by</option>
              <option value="relates_to">Related to</option>
            </select>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="flex-1 h-7 text-xs rounded bg-white/10 text-white px-2 placeholder:text-white/30"
              autoFocus
              data-testid="input-search-dependency"
            />
          </div>

          {searchQuery.trim() && (
            <div className="max-h-[150px] overflow-y-auto space-y-0.5">
              {filteredTasks.length === 0 ? (
                <p className="text-xs text-white/30 py-1 px-1">No matching tasks</p>
              ) : (
                filteredTasks.slice(0, 10).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left hover:bg-white/10 transition-colors"
                    onClick={() => createLinkMutation.mutate({ targetId: t.id, linkType: selectedLinkType })}
                    data-testid={`button-link-task-${t.id}`}
                  >
                    <span className="text-xs text-white/80 truncate flex-1">{t.title}</span>
                    {t.courseName && (
                      <span className="text-[10px] text-white/40 truncate max-w-[100px]">{t.courseName.split(' - ')[0]}</span>
                    )}
                    {t.dueDate && (
                      <span className="text-[10px] text-white/30">{format(new Date(t.dueDate), 'MMM d')}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function RescheduleForm({ 
  task, 
  onSuccess,
  onUndoPush 
}: { 
  task: Task; 
  onSuccess: () => void;
  onUndoPush?: (action: { type: 'edit'; description: string; data: { taskId: number; taskTitle: string; oldFields: Record<string, any>; newFields: Record<string, any> } }) => void;
}) {
  const [newDate, setNewDate] = useState("");
  const [newWeek, setNewWeek] = useState(task.weekNumber);

  const rescheduleMutation = useMutation({
    mutationFn: async () => {
      if (onUndoPush) {
        onUndoPush({
          type: 'edit',
          description: `Rescheduled "${task.title}"`,
          data: {
            taskId: task.id,
            taskTitle: task.title,
            oldFields: { dueDate: task.dueDate instanceof Date ? task.dueDate.toISOString() : task.dueDate, weekNumber: task.weekNumber },
            newFields: { dueDate: newDate, weekNumber: newWeek }
          }
        });
      }
      return apiRequest("PATCH", `/api/tasks/${task.id}/reschedule`, {
        dueDate: newDate,
        weekNumber: newWeek,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/weeks"] });
      onSuccess();
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reschedule "{task.title}" to a new date and week.
      </p>

      <div>
        <Label htmlFor="newDate">New Due Date & Time</Label>
        <Input
          id="newDate"
          type="datetime-local"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          required
          data-testid="input-reschedule-date"
        />
      </div>

      <div>
        <Label htmlFor="newWeek">Week Number</Label>
        <Select value={String(newWeek)} onValueChange={(v) => setNewWeek(Number(v))}>
          <SelectTrigger data-testid="select-reschedule-week">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from({ length: 12 }, (_, i) => i + 2).map(w => (
              <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button 
        onClick={() => rescheduleMutation.mutate()} 
        disabled={!newDate || rescheduleMutation.isPending}
        data-testid="button-confirm-reschedule"
      >
        {rescheduleMutation.isPending ? "Saving..." : "Reschedule"}
      </Button>
    </div>
  );
}
