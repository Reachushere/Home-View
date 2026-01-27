import { useState, DragEvent, useRef, useCallback, useEffect, useMemo } from "react";
import quickActionsBg from "@assets/Washroom_1769164969510.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
import { useToast } from "@/hooks/use-toast";
import { useUpload } from "@/hooks/use-upload";
import { ObjectUploader } from "@/components/ObjectUploader";
import { Link } from "wouter";
import { 
  FileText, 
  File, 
  Image, 
  Video, 
  Music, 
  Archive,
  Edit2,
  Link2,
  Trash2,
  ArrowLeft,
  Download,
  Clock,
  CheckCircle2,
  Upload,
  Play,
  Square,
  Volume2,
  VolumeX,
  Folder,
  FolderOpen,
  Loader2,
  ChevronRight,
  ChevronDown,
  Plus,
  FolderPlus,
  SkipBack,
  SkipForward,
  RotateCcw,
  Minus
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { FileRecord } from "@shared/schema";

interface Task {
  id: number;
  title: string;
  courseName: string | null;
  dueDate: string;
  isCompleted: boolean;
  attachments: string[] | null;
}

const WEEKS = [
  { id: "week-1", name: "Week 1" },
  { id: "week-2", name: "Week 2" },
  { id: "week-3", name: "Week 3" },
  { id: "week-4", name: "Week 4" },
  { id: "week-5", name: "Week 5" },
  { id: "week-6", name: "Week 6" },
  { id: "week-7", name: "Week 7" },
  { id: "week-8", name: "Week 8" },
  { id: "week-9", name: "Week 9" },
  { id: "week-10", name: "Week 10" },
  { id: "week-11", name: "Week 11" },
  { id: "week-12", name: "Week 12" },
  { id: "week-13", name: "Week 13" },
  { id: "other", name: "Other" },
];

const COURSE_FOLDERS = [
  { id: "casl101", name: "CASL101 - ASL", color: "text-purple-500" },
  { id: "cfnf400", name: "CFNF400 - Sexuality", color: "text-pink-500" },
  { id: "cppa122", name: "CPPA122 - Local Politics", color: "text-green-500" },
];

const CONTENT_FOLDERS = [
  { id: "module", name: "Module" },
  { id: "reading", name: "Reading" },
];

function getFileIcon(contentType: string | null) {
  if (!contentType) return File;
  if (contentType.startsWith("image/")) return Image;
  if (contentType.startsWith("video/")) return Video;
  if (contentType.startsWith("audio/")) return Music;
  if (contentType.includes("pdf") || contentType.includes("document") || contentType.includes("text")) return FileText;
  if (contentType.includes("zip") || contentType.includes("archive")) return Archive;
  return File;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "Unknown size";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateValue: string | Date | null) {
  if (!dateValue) return "Unknown date";
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type SortOption = "name-asc" | "name-desc" | "date-newest" | "date-oldest" | "size-largest" | "size-smallest";

const SPEAKERS = [
  { id: "media_player.byhome", name: "Apartment" },
  { id: "media_player.cat_wr", name: "Cat Washroom Speakers" },
  { id: "media_player.echo_cat_left_am", name: "Cat Washroom Left" },
  { id: "media_player.echo_cat_right_am", name: "Cat Washroom Right" },
  { id: "media_player.echo_cat_washroom_middle", name: "Cat Washroom Middle" },
  { id: "media_player.echo_closet_am", name: "Closet" },
  { id: "media_player.echo_lr_couch_r_am", name: "Hallway Corner" },
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

export default function FilesPage() {
  const { toast } = useToast();
  const [editingFile, setEditingFile] = useState<FileRecord | null>(null);
  const [newName, setNewName] = useState("");
  const [assigningFile, setAssigningFile] = useState<FileRecord | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [showAssignAfterUpload, setShowAssignAfterUpload] = useState(false);
  const [lastUploadedObjectPath, setLastUploadedObjectPath] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortOption>("date-newest");
  const [fileSpeakers, setFileSpeakers] = useState<Record<number, string>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [draggedFileId, setDraggedFileId] = useState<number | null>(null);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isExternalDragOver, setIsExternalDragOver] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showDeleteFolderConfirm, setShowDeleteFolderConfirm] = useState(false);
  const [showAddFolderDialog, setShowAddFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [addFolderParentId, setAddFolderParentId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<number | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [editingBuiltinFolderId, setEditingBuiltinFolderId] = useState<string | null>(null);
  const [editingBuiltinFolderName, setEditingBuiltinFolderName] = useState("");
  const [folderDisplayNames, setFolderDisplayNames] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem("folderDisplayNames");
    return saved ? JSON.parse(saved) : {};
  });
  const [foldersPanelWidth, setFoldersPanelWidth] = useState(224); // 224px = w-56
  const isResizingPanelRef = useRef(false);

  // Column widths state for draggable resizing
  const [columnWidths, setColumnWidths] = useState({
    name: 300,
    actions: 96,
    status: 80,
    date: 144,
    type: 112,
    size: 80,
  });
  const resizingColumn = useRef<string | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  const handleMouseDown = useCallback((e: React.MouseEvent, column: string) => {
    e.preventDefault();
    resizingColumn.current = column;
    startX.current = e.clientX;
    startWidth.current = columnWidths[column as keyof typeof columnWidths];
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [columnWidths]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!resizingColumn.current) return;
    const diff = e.clientX - startX.current;
    const newWidth = Math.max(50, startWidth.current + diff);
    setColumnWidths(prev => ({
      ...prev,
      [resizingColumn.current!]: newWidth,
    }));
  }, []);

  const handleMouseUp = useCallback(() => {
    resizingColumn.current = null;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Panel resize handlers
  const panelStartX = useRef<number>(0);
  const panelStartWidth = useRef<number>(0);

  const handlePanelMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingPanelRef.current) return;
    const diff = e.clientX - panelStartX.current;
    const newWidth = Math.max(150, Math.min(500, panelStartWidth.current + diff));
    setFoldersPanelWidth(newWidth);
  }, []);

  const handlePanelMouseUp = useCallback(() => {
    isResizingPanelRef.current = false;
    document.removeEventListener('mousemove', handlePanelMouseMove);
    document.removeEventListener('mouseup', handlePanelMouseUp);
  }, [handlePanelMouseMove]);

  const handlePanelMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizingPanelRef.current = true;
    panelStartX.current = e.clientX;
    panelStartWidth.current = foldersPanelWidth;
    document.addEventListener('mousemove', handlePanelMouseMove);
    document.addEventListener('mouseup', handlePanelMouseUp);
  }, [foldersPanelWidth, handlePanelMouseMove, handlePanelMouseUp]);

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handlePanelMouseMove);
      document.removeEventListener('mouseup', handlePanelMouseUp);
    };
  }, [handlePanelMouseMove, handlePanelMouseUp]);

  const { getUploadParameters, uploadFile } = useUpload({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    },
  });

  const { data: files = [], isLoading: filesLoading } = useQuery<FileRecord[]>({
    queryKey: ["/api/files"],
  });

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: deletedFoldersData = [] } = useQuery<{ id: number; folderId: string }[]>({
    queryKey: ["/api/deleted-folders"],
  });

  // Fetch weeks to determine current week for sorting
  interface Week {
    weekNumber: number;
    startDate: string;
    endDate: string;
  }
  const { data: weeks = [] } = useQuery<Week[]>({
    queryKey: ["/api/weeks"],
    queryFn: () => fetch("/api/weeks").then(r => r.json()),
  });

  // Helper to get week number from week id
  const getWeekNumberFromId = (weekId: string): number | null => {
    if (weekId === "other") return null;
    const match = weekId.match(/^week-(\d+)$/);
    return match ? parseInt(match[1], 10) : null;
  };

  // Check if a week is past based on its end date
  const isWeekPast = useCallback((weekId: string): boolean => {
    const weekNum = getWeekNumberFromId(weekId);
    if (weekNum === null) return false; // "other" folder is never past
    
    // Find the week data from API
    const weekData = weeks.find(w => w.weekNumber === weekNum);
    if (!weekData) return false;
    
    const today = new Date();
    const todayDateOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endDate = parseISO(weekData.endDate);
    const endDateOnly = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    
    // Week is past if today is after the week's end date
    return todayDateOnly > endDateOnly;
  }, [weeks]);

  // Sort weeks: current and future weeks first (in order), then past weeks (in order)
  const sortedWeeks = useMemo(() => {
    return [...WEEKS].sort((a, b) => {
      const aNum = getWeekNumberFromId(a.id);
      const bNum = getWeekNumberFromId(b.id);
      
      // "Other" folder always at the end
      if (a.id === "other") return 1;
      if (b.id === "other") return -1;
      
      if (aNum === null || bNum === null) return 0;
      
      const aIsPast = isWeekPast(a.id);
      const bIsPast = isWeekPast(b.id);
      
      // If one is past and one is not, the past one goes to the bottom
      if (aIsPast && !bIsPast) return 1;
      if (!aIsPast && bIsPast) return -1;
      
      // Both past or both current/future: sort by week number
      return aNum - bNum;
    });
  }, [weeks, isWeekPast]);

  const deletedFolderIds = new Set(deletedFoldersData.map(f => f.folderId));

  const renameMutation = useMutation({
    mutationFn: async ({ id, displayName }: { id: number; displayName: string }) => {
      return await apiRequest("PATCH", `/api/files/${id}`, { displayName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setEditingFile(null);
      toast({ title: "File renamed successfully" });
    },
    onError: (err) => {
      toast({ title: "Failed to rename file", description: String(err), variant: "destructive" });
    },
  });

  const listenedMutation = useMutation({
    mutationFn: async ({ id, listened }: { id: number; listened: boolean }) => {
      return await apiRequest("PATCH", `/api/files/${id}`, { listened });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    },
    onError: (err) => {
      toast({ title: "Failed to update file", description: String(err), variant: "destructive" });
    },
  });

  const moveFolderMutation = useMutation({
    mutationFn: async ({ id, folder }: { id: number; folder: string | null }) => {
      // If moving to a folder that was deleted, restore it first
      if (folder && deletedFolderIds.has(folder)) {
        await apiRequest("DELETE", `/api/deleted-folders/${encodeURIComponent(folder)}`);
      }
      return await apiRequest("PATCH", `/api/files/${id}`, { folder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-folders"] });
      toast({ title: "File moved to folder" });
    },
    onError: (err) => {
      toast({ title: "Failed to move file", description: String(err), variant: "destructive" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ fileId, taskId }: { fileId: number; taskId: number }) => {
      return await apiRequest("POST", `/api/files/${fileId}/assign`, { taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setAssigningFile(null);
      setSelectedTaskId("");
      toast({ title: "File assigned to task" });
    },
    onError: (err) => {
      toast({ title: "Failed to assign file", description: String(err), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/files/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ title: "File deleted" });
    },
    onError: (err) => {
      toast({ title: "Failed to delete file", description: String(err), variant: "destructive" });
    },
  });

  const addDeletedFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return await apiRequest("POST", "/api/deleted-folders", { folderId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-folders"] });
    },
    onError: (err) => {
      toast({ title: "Failed to delete folder", description: String(err), variant: "destructive" });
    },
  });

  const restoreFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return await apiRequest("DELETE", `/api/deleted-folders/${encodeURIComponent(folderId)}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-folders"] });
    },
  });

  const { data: customFoldersData = [] } = useQuery<{ id: number; parentFolderId: string; name: string }[]>({
    queryKey: ["/api/custom-folders"],
  });

  const createCustomFolderMutation = useMutation({
    mutationFn: async ({ parentFolderId, name }: { parentFolderId: string; name: string }) => {
      return await apiRequest("POST", "/api/custom-folders", { parentFolderId, name });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-folders"] });
      // Expand the parent folder and all ancestors so the new folder is visible
      const parentId = variables.parentFolderId;
      setExpandedFolders(prev => {
        const next = new Set(prev);
        next.add(parentId);
        // Expand ancestor folders (parse the hierarchy)
        const parts = parentId.split("-");
        // e.g. "week-1-cppa122-module" -> expand "week-1", "week-1-cppa122"
        for (let i = 2; i <= parts.length; i++) {
          next.add(parts.slice(0, i).join("-"));
        }
        return next;
      });
      setShowAddFolderDialog(false);
      setNewFolderName("");
      setAddFolderParentId(null);
      toast({ title: "Folder created successfully" });
    },
    onError: (err) => {
      toast({ title: "Failed to create folder", description: String(err), variant: "destructive" });
    },
  });

  const deleteCustomFolderMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest("DELETE", `/api/custom-folders/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-folders"] });
      toast({ title: "Folder deleted" });
    },
    onError: (err) => {
      toast({ title: "Failed to delete folder", description: String(err), variant: "destructive" });
    },
  });

  const renameCustomFolderMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      return await apiRequest("PATCH", `/api/custom-folders/${id}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/custom-folders"] });
      setEditingFolderId(null);
      setEditingFolderName("");
      toast({ title: "Folder renamed" });
    },
    onError: (err) => {
      toast({ title: "Failed to rename folder", description: String(err), variant: "destructive" });
    },
  });

  const getFilesToDeleteInFolder = (folderId: string) => {
    // Check if this is a week folder (e.g., "week-1")
    if (folderId.match(/^week-\d+$/)) {
      return files.filter(f => f.folder?.startsWith(folderId + "-"));
    }
    // Check if this is a course folder (e.g., "week-1-cppa122")  
    const parts = folderId.split("-");
    if (parts.length === 3 && parts[0] === "week") {
      return files.filter(f => f.folder?.startsWith(folderId + "-"));
    }
    // Content folder - exact match
    return files.filter(f => f.folder === folderId);
  };

  // Keyboard event listener for Delete key to delete selected folder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Delete" && selectedFolder && !editingFile && !assigningFile) {
        e.preventDefault();
        // Check if folder has contents - if empty, delete immediately without confirmation
        const folderFiles = getFilesToDeleteInFolder(selectedFolder);
        if (folderFiles.length === 0) {
          // Empty folder - delete immediately
          addDeletedFolderMutation.mutate(selectedFolder);
          toast({ title: "Folder deleted" });
          setSelectedFolder(null);
        } else {
          // Folder has contents - show confirmation
          setShowDeleteFolderConfirm(true);
        }
      }
    };
    
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [selectedFolder, editingFile, assigningFile, files, addDeletedFolderMutation, toast]);

  const saveFolderDisplayName = useCallback((folderId: string, name: string) => {
    const newNames = { ...folderDisplayNames, [folderId]: name };
    setFolderDisplayNames(newNames);
    localStorage.setItem("folderDisplayNames", JSON.stringify(newNames));
    setEditingBuiltinFolderId(null);
    setEditingBuiltinFolderName("");
    toast({ title: "Folder renamed" });
  }, [folderDisplayNames, toast]);

  const handleDeleteFolder = async () => {
    if (!selectedFolder) return;
    
    const folderFiles = getFilesToDeleteInFolder(selectedFolder);
    
    try {
      // Delete all files in the folder
      for (const file of folderFiles) {
        await apiRequest("DELETE", `/api/files/${file.id}`);
      }
      // Add folder to deleted list
      await apiRequest("POST", "/api/deleted-folders", { folderId: selectedFolder });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/deleted-folders"] });
      toast({ title: folderFiles.length > 0 ? `Deleted folder and ${folderFiles.length} file(s)` : "Folder deleted" });
      setSelectedFolder(null);
    } catch (err) {
      toast({ title: "Failed to delete folder contents", description: String(err), variant: "destructive" });
    }
    setShowDeleteFolderConfirm(false);
  };

  const getSpeakerForFile = (fileId: number) => fileSpeakers[fileId] || "media_player.echo_cat_left_am";
  
  const setSpeakerForFile = (fileId: number, speakerId: string) => {
    setFileSpeakers(prev => ({ ...prev, [fileId]: speakerId }));
  };

  const handlePlayFile = async (fileId: number, fileUrl: string, fileName: string) => {
    const speaker = getSpeakerForFile(fileId);
    try {
      const response = await fetch("/api/media/play", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: fileUrl, entityId: speaker }),
      });
      if (response.ok) {
        const speakerName = SPEAKERS.find(s => s.id === speaker)?.name || speaker;
        toast({ title: `Playing on ${speakerName}: ${fileName}` });
      } else {
        toast({ title: "Failed to play file", variant: "destructive" });
      }
    } catch (error) {
      console.error("Play error:", error);
      toast({ title: "Failed to play file", variant: "destructive" });
    }
  };

  const handleStop = async (fileId: number) => {
    const speaker = getSpeakerForFile(fileId);
    try {
      await fetch("/api/media/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityId: speaker }),
      });
    } catch (error) {
      console.error("Stop error:", error);
    }
  };

  const handleVolume = async (fileId: number, action: "up" | "down") => {
    const speaker = getSpeakerForFile(fileId);
    try {
      await fetch("/api/media/volume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, entityId: speaker }),
      });
    } catch (error) {
      console.error("Volume error:", error);
    }
  };

  const handleRestart = async (fileId: number, fileUrl: string, fileName: string) => {
    const speaker = getSpeakerForFile(fileId);
    try {
      // First clear the session/stop
      await fetch("/api/media/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaUrl: fileUrl, entityId: speaker }),
      });
      // Then start playback from beginning
      await handlePlayFile(fileId, fileUrl, fileName);
    } catch (error) {
      console.error("Restart error:", error);
      toast({ title: "Failed to restart", variant: "destructive" });
    }
  };

  const handleSkipChunk = async (fileId: number, direction: "forward" | "backward") => {
    const speaker = getSpeakerForFile(fileId);
    try {
      await fetch("/api/media/skip-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction, entityId: speaker }),
      });
    } catch (error) {
      console.error("Skip chunk error:", error);
    }
  };

  const handleRename = () => {
    if (editingFile && newName.trim()) {
      renameMutation.mutate({ id: editingFile.id, displayName: newName.trim() });
    }
  };

  const handleAssign = () => {
    if (assigningFile && selectedTaskId) {
      assignMutation.mutate({ fileId: assigningFile.id, taskId: parseInt(selectedTaskId) });
    }
  };

  const assignByPathMutation = useMutation({
    mutationFn: async ({ objectPath, taskId }: { objectPath: string; taskId: number }) => {
      return await apiRequest("POST", `/api/files/assign-by-path`, { objectPath, taskId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setShowAssignAfterUpload(false);
      setSelectedTaskId("");
      setLastUploadedObjectPath("");
      toast({ title: "File assigned to task" });
    },
    onError: (err) => {
      toast({ title: "Failed to assign file", description: String(err), variant: "destructive" });
    },
  });

  const handleAssignAfterUpload = () => {
    if (lastUploadedObjectPath && selectedTaskId) {
      assignByPathMutation.mutate({ objectPath: lastUploadedObjectPath, taskId: parseInt(selectedTaskId) });
    }
  };

  const handleUploadComplete = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/files"] });
    toast({ title: "File uploaded successfully" });
  };

  const getTasksForFile = (file: FileRecord): Task[] => {
    return tasks.filter(task => 
      task.attachments && task.attachments.includes(file.objectPath)
    );
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(folderId)) {
        newSet.delete(folderId);
      } else {
        newSet.add(folderId);
      }
      return newSet;
    });
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, fileId: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", fileId.toString());
    setDraggedFileId(fileId);
  };

  const handleDragEnd = () => {
    setDraggedFileId(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if this is an external file drop
    if (e.dataTransfer.types.includes("Files")) {
      e.dataTransfer.dropEffect = "copy";
      setIsExternalDragOver(true);
    } else {
      e.dataTransfer.dropEffect = "move";
    }
    if (dragOverFolder !== folderId) {
      setDragOverFolder(folderId);
    }
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // Only clear if we're leaving to a non-child element
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverFolder(null);
      setIsExternalDragOver(false);
    }
  };

  const handleExternalFileDrop = async (files: FileList, targetFolder: string | null) => {
    const fileArray = Array.from(files);
    setUploadingCount(fileArray.length);
    
    for (const file of fileArray) {
      try {
        const response = await uploadFile(file);
        if (response && targetFolder) {
          // Move the uploaded file to the target folder
          // We need to find the file by objectPath after it's created
          const filesResponse = await fetch("/api/files");
          const allFiles = await filesResponse.json();
          const uploadedFile = allFiles.find((f: FileRecord) => f.objectPath === response.objectPath);
          if (uploadedFile) {
            await apiRequest("PATCH", `/api/files/${uploadedFile.id}`, { folder: targetFolder });
          }
        }
        queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      } catch (error) {
        console.error("Upload error:", error);
        toast({ title: "Failed to upload file", variant: "destructive" });
      }
    }
    
    setUploadingCount(0);
    toast({ title: `${fileArray.length} file(s) uploaded successfully` });
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    let targetFolder = folderId;
    const parts = folderId.split("-");
    
    // If dropping on a week folder (e.g., "week-1"), redirect to first course's "other" subfolder
    if (parts.length === 2 && parts[0] === "week") {
      // Week folder - redirect to first available course's "other" folder
      targetFolder = `${folderId}-${COURSE_FOLDERS[0].id}-other`;
    }
    // If dropping on a course folder (e.g., "week-1-cppa122"), redirect to "other" subfolder
    else if (parts.length === 3 && parts[0] === "week") {
      // This is a course folder, redirect to "other" content folder
      targetFolder = `${folderId}-other`;
    }
    
    // Check if this is an external file drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleExternalFileDrop(e.dataTransfer.files, targetFolder);
      setDragOverFolder(null);
      setIsExternalDragOver(false);
      return;
    }
    
    // Internal drag-drop (moving existing files)
    const fileId = parseInt(e.dataTransfer.getData("text/plain"));
    if (fileId) {
      moveFolderMutation.mutate({ id: fileId, folder: targetFolder });
    }
    setDraggedFileId(null);
    setDragOverFolder(null);
  };

  const handleDropOnUnfiled = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if this is an external file drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleExternalFileDrop(e.dataTransfer.files, null);
      setDragOverFolder(null);
      setIsExternalDragOver(false);
      return;
    }
    
    const fileId = parseInt(e.dataTransfer.getData("text/plain"));
    if (fileId) {
      moveFolderMutation.mutate({ id: fileId, folder: null });
    }
    setDraggedFileId(null);
    setDragOverFolder(null);
  };

  const getFilesInFolder = (folderId: string) => {
    return files.filter(f => f.folder === folderId);
  };

  const getFilesInWeek = (weekId: string) => {
    // Include files directly in the week folder OR in any subfolder
    return files.filter(f => f.folder === weekId || f.folder?.startsWith(weekId + "-"));
  };

  const getFilesInCourse = (weekId: string, courseId: string) => {
    return files.filter(f => f.folder?.startsWith(`${weekId}-${courseId}-`));
  };

  const unfiledFiles = files.filter(f => !f.folder);

  const sortedFiles = (fileList: FileRecord[]) => {
    return [...fileList].sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.displayName || "").localeCompare(b.displayName || "");
        case "name-desc":
          return (b.displayName || "").localeCompare(a.displayName || "");
        case "date-newest":
          return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
        case "date-oldest":
          return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
        case "size-largest":
          return (b.size || 0) - (a.size || 0);
        case "size-smallest":
          return (a.size || 0) - (b.size || 0);
        default:
          return 0;
      }
    });
  };

  const renderFileRow = (file: FileRecord) => {
    const FileIcon = getFileIcon(file.contentType);
    const assignedTasks = getTasksForFile(file);
    const isDragging = draggedFileId === file.id;

    return (
      <div
        key={file.id}
        draggable
        onDragStart={(e) => handleDragStart(e, file.id)}
        onDragEnd={handleDragEnd}
        className={`flex flex-col gap-1 p-2 bg-[#ffd251] border-2 border-black dark:border-white rounded-[8px] hover-elevate cursor-move ${
          isDragging ? "opacity-50" : ""
        }`}
        data-testid={`file-row-${file.id}`}
      >
        <div className="flex items-center justify-between gap-2">
          <Checkbox
            checked={file.listened || false}
            onCheckedChange={(checked) => {
              listenedMutation.mutate({ id: file.id, listened: checked === true });
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 border-2 border-black data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
            data-testid={`checkbox-listened-${file.id}`}
          />
          <a 
            href={file.objectPath} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`font-medium text-[10px] truncate hover:underline cursor-pointer text-black flex-1 ${file.listened ? 'line-through opacity-60' : ''}`}
            onClick={(e) => e.stopPropagation()}
            data-testid={`text-filename-${file.id}`}
          >
            {file.displayName}
          </a>
          {assignedTasks.length > 0 && (
            <Badge variant="secondary" className="text-[8px] py-0 px-1">
              {assignedTasks.length}
            </Badge>
          )}
          <Select 
            value={getSpeakerForFile(file.id)} 
            onValueChange={(value) => setSpeakerForFile(file.id, value)}
          >
            <SelectTrigger className="w-[75px] h-5 text-xs font-medium bg-black hover:bg-gray-800 text-white border border-black px-1" data-testid={`select-speaker-${file.id}`}>
              <SelectValue placeholder="Spkr" />
            </SelectTrigger>
            <SelectContent>
              {SPEAKERS.map(speaker => (
                <SelectItem key={speaker.id} value={speaker.id}>
                  {speaker.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col w-[calc(100%+16px)] bg-[#c9a033] dark:bg-[#c9a033] rounded-b-[6px] -ml-2 -mr-2 -mb-2 px-3 py-2 mt-1 gap-2">
          {/* Main playback controls - larger */}
          <div className="flex items-center justify-center gap-4">
            <SkipBack 
              className="h-5 w-5 text-black cursor-pointer hover:opacity-70" 
              onClick={(e) => { e.stopPropagation(); handleSkipChunk(file.id, "backward"); }}
              data-testid={`button-skip-back-${file.id}`}
            />
            <Play 
              className="h-6 w-6 fill-black text-black cursor-pointer hover:opacity-70" 
              onClick={() => handlePlayFile(file.id, file.objectPath, file.displayName)}
              data-testid={`button-play-${file.id}`}
            />
            <Square 
              className="h-5 w-5 fill-black text-black cursor-pointer hover:opacity-70" 
              onClick={() => handleStop(file.id)}
              data-testid={`button-stop-${file.id}`}
            />
            <SkipForward 
              className="h-5 w-5 text-black cursor-pointer hover:opacity-70" 
              onClick={(e) => { e.stopPropagation(); handleSkipChunk(file.id, "forward"); }}
              data-testid={`button-skip-forward-${file.id}`}
            />
            <RotateCcw 
              className="h-5 w-5 text-black cursor-pointer hover:opacity-70" 
              onClick={() => handleRestart(file.id, file.objectPath, file.displayName)}
              data-testid={`button-restart-${file.id}`}
            />
          </div>
          {/* Volume controls */}
          <div className="flex items-center justify-center gap-3">
            <Minus 
              className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
              onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "down"); }}
              data-testid={`button-vol-down-${file.id}`}
            />
            <Volume2 className="h-4 w-4 text-black" />
            <Plus 
              className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
              onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "up"); }}
              data-testid={`button-vol-up-${file.id}`}
            />
          </div>
          {/* Action buttons */}
          <div className="flex items-center justify-center gap-4">
            <Edit2 
              className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
              onClick={() => {
                setEditingFile(file);
                setNewName(file.displayName);
              }}
              data-testid={`button-rename-${file.id}`}
            />
            <Link2 
              className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
              onClick={() => {
                setAssigningFile(file);
                setSelectedTaskId("");
              }}
              data-testid={`button-assign-${file.id}`}
            />
            <Trash2 
              className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
              onClick={() => {
                if (confirm("Are you sure you want to delete this file?")) {
                  deleteMutation.mutate(file.id);
                }
              }}
              data-testid={`button-delete-${file.id}`}
            />
          </div>
        </div>
      </div>
    );
  };

  if (filesLoading || tasksLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="grid gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-muted rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handlePageDragOver = (e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsExternalDragOver(true);
    }
  };

  const handlePageDragLeave = (e: DragEvent<HTMLDivElement>) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsExternalDragOver(false);
    }
  };

  const handlePageDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleExternalFileDrop(e.dataTransfer.files, null);
    }
    setIsExternalDragOver(false);
  };

  // Get files for the currently selected folder
  const getCurrentFolderFiles = () => {
    if (!selectedFolder) return unfiledFiles;
    return getFilesInFolder(selectedFolder);
  };

  // Get breadcrumb path for selected folder
  const getBreadcrumb = () => {
    if (!selectedFolder) return ["Bryn's Files"];
    
    // Handle custom folders
    if (selectedFolder.startsWith("custom-")) {
      const customId = parseInt(selectedFolder.replace("custom-", ""));
      const customFolder = customFoldersData.find(cf => cf.id === customId);
      if (customFolder) {
        // Get parent breadcrumb and add custom folder name
        const parentParts = customFolder.parentFolderId.split("-");
        const result = ["Bryn's Files"];
        if (parentParts[0] === "week") {
          const week = WEEKS.find(w => w.id === `${parentParts[0]}-${parentParts[1]}`);
          if (week) result.push(week.name);
        }
        if (parentParts.length >= 3) {
          const course = COURSE_FOLDERS.find(c => c.id === parentParts[2]);
          if (course) result.push(course.name);
        }
        if (parentParts.length >= 4) {
          const content = CONTENT_FOLDERS.find(c => c.id === parentParts[3]);
          if (content) result.push(content.name);
        }
        result.push(customFolder.name);
        return result;
      }
    }
    
    const parts = selectedFolder.split("-");
    const result = ["Bryn's Files"];
    if (parts[0]) {
      const week = WEEKS.find(w => w.id === parts[0]);
      if (week) result.push(week.name);
    }
    if (parts[1]) {
      const course = COURSE_FOLDERS.find(c => c.id === parts[1]);
      if (course) result.push(course.name);
    }
    if (parts[2]) {
      const content = CONTENT_FOLDERS.find(c => c.id === parts[2]);
      if (content) result.push(content.name);
    }
    return result;
  };

  return (
    <div 
      className={`h-screen flex flex-col bg-[#191919] text-white transition-all ${isExternalDragOver ? "ring-4 ring-primary ring-inset bg-primary/5" : ""}`}
      onDragOver={handlePageDragOver}
      onDragLeave={handlePageDragLeave}
      onDrop={handlePageDrop}
    >
      {uploadingCount > 0 && (
        <div className="fixed top-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md shadow-lg flex items-center gap-2 z-50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Uploading {uploadingCount} file(s)...
        </div>
      )}
      {isExternalDragOver && (
        <div className="fixed inset-0 bg-primary/10 pointer-events-none z-40 flex items-center justify-center">
          <div className="bg-[#2d2d2d] border-2 border-dashed border-blue-500 rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-blue-400 mb-2" />
            <p className="text-lg font-medium">Drop files here to upload</p>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3d3d3d] bg-[#202020]">
        <Link href="/">
          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-[#3d3d3d]" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-1 text-sm text-gray-400">
          {getBreadcrumb().map((part, idx) => (
            <span key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight className="h-3 w-3" />}
              <span className={idx === getBreadcrumb().length - 1 ? "text-white" : ""}>{part}</span>
            </span>
          ))}
        </div>
        <div className="flex-1" />
        <ObjectUploader
          maxNumberOfFiles={5}
          onGetUploadParameters={getUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="h-7 text-xs px-3 bg-transparent hover:bg-[#5979CC]/10 text-[#5979CC] border-2 border-[#5979CC] shadow-lg shadow-[#5979CC]/40"
        >
          <Upload className="h-3 w-3 mr-1" />
          Upload
        </ObjectUploader>
        <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
          <SelectTrigger className="w-[130px] h-7 text-xs bg-[#2d2d2d] border-[#3d3d3d] text-white" data-testid="select-sort">
            <SelectValue placeholder="Sort by..." />
          </SelectTrigger>
          <SelectContent className="bg-[#2d2d2d] border-[#3d3d3d]">
            <SelectItem value="date-newest">Newest first</SelectItem>
            <SelectItem value="date-oldest">Oldest first</SelectItem>
            <SelectItem value="name-asc">Name A-Z</SelectItem>
            <SelectItem value="name-desc">Name Z-A</SelectItem>
            <SelectItem value="size-largest">Largest first</SelectItem>
            <SelectItem value="size-smallest">Smallest first</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar - Tree Navigation */}
        <div 
          className="border-r border-[#3d3d3d] bg-[#202020] overflow-y-auto flex-shrink-0 relative"
          style={{ width: foldersPanelWidth }}
        >
          {/* Resize handle */}
          <div
            className="absolute top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#0078d4] z-10 right-0"
            onMouseDown={handlePanelMouseDown}
            data-testid="panel-resize-handle"
          />
          <div className="py-2">
            {/* Root-level custom folders (at week level) */}
            {(() => {
              const rootCustomFolders = customFoldersData.filter(cf => cf.parentFolderId === "root");
              return (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div
                      className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d] text-gray-400 text-xs"
                      onClick={() => toggleFolder("root")}
                      data-testid="root-folder-header"
                    >
                      {rootCustomFolders.length > 0 ? (
                        expandedFolders.has("root") ? (
                          <ChevronDown className="h-3 w-3 text-gray-500" />
                        ) : (
                          <ChevronRight className="h-3 w-3 text-gray-500" />
                        )
                      ) : (
                        <div className="w-3 h-3" />
                      )}
                      <FolderPlus className="h-4 w-4 text-gray-500" />
                      <span className="flex-1">My Folders</span>
                      <span className="text-xs text-gray-600">{rootCustomFolders.length}</span>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-48">
                    <ContextMenuItem
                      onClick={() => {
                        setAddFolderParentId("root");
                        setShowAddFolderDialog(true);
                      }}
                      data-testid="add-root-folder"
                    >
                      <FolderPlus className="h-4 w-4 mr-2" />
                      Add Folder
                    </ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              );
            })()}
            
            {/* Root-level custom folders children */}
            {expandedFolders.has("root") && customFoldersData.filter(cf => cf.parentFolderId === "root").map(folder => {
              const folderFiles = files.filter(f => f.folder === `custom-${folder.id}`);
              const isSelected = selectedFolder === `custom-${folder.id}`;
              return (
                <div key={folder.id} className="ml-3">
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d] ${isSelected ? "bg-[#0078d4]/30" : ""} ${dragOverFolder === `custom-${folder.id}` ? "bg-[#0078d4]/50" : ""}`}
                        onClick={() => setSelectedFolder(`custom-${folder.id}`)}
                        onDragOver={(e) => handleDragOver(e, `custom-${folder.id}`)}
                        onDragLeave={(e) => handleDragLeave(e)}
                        onDrop={(e) => handleDrop(e, `custom-${folder.id}`)}
                        data-testid={`custom-folder-${folder.id}`}
                      >
                        <div className="w-3 h-3" />
                        <Folder className="h-4 w-4 text-blue-400" />
                        {editingFolderId === folder.id ? (
                          <input
                            type="text"
                            value={editingFolderName}
                            onChange={(e) => setEditingFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingFolderName.trim()) {
                                renameCustomFolderMutation.mutate({ id: folder.id, name: editingFolderName.trim() });
                              } else if (e.key === "Escape") {
                                setEditingFolderId(null);
                                setEditingFolderName("");
                              }
                            }}
                            onBlur={() => {
                              if (editingFolderName.trim()) {
                                renameCustomFolderMutation.mutate({ id: folder.id, name: editingFolderName.trim() });
                              } else {
                                setEditingFolderId(null);
                                setEditingFolderName("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="text-sm flex-1 bg-[#1e1e1e] border border-[#0078d4] rounded px-1 py-0 text-white outline-none"
                          />
                        ) : (
                          <span className="text-sm flex-1 text-blue-300">{folder.name}</span>
                        )}
                        <span className="text-xs text-gray-500">{folderFiles.length}</span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem
                        onClick={() => {
                          setEditingFolderId(folder.id);
                          setEditingFolderName(folder.name);
                        }}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename Folder
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => deleteCustomFolderMutation.mutate(folder.id)}
                        className="text-red-400"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Folder
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                </div>
              );
            })}

            {/* Week folders - sorted with past weeks at bottom */}
            {sortedWeeks.map((week) => {
              const weekFiles = getFilesInWeek(week.id);
              const isWeekExpanded = expandedFolders.has(week.id);
              const allFilesListened = weekFiles.length > 0 && weekFiles.every(f => f.listened);
              const isPastWeek = isWeekPast(week.id);
              // Past week with incomplete files should blink
              const shouldBlink = isPastWeek && weekFiles.length > 0 && !allFilesListened;
              // Past week with all files completed should have strikethrough
              const shouldStrikethrough = isPastWeek && allFilesListened;
              
              return (
                <div key={week.id}>
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <div
                        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-[#2d2d2d] ${selectedFolder === week.id ? "bg-[#0078d4]/30 border-l-2 border-[#0078d4]" : ""} ${dragOverFolder === week.id ? "bg-[#0078d4]/50" : ""} ${shouldBlink ? "animate-slow-blink" : ""}`}
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            setSelectedFolder(week.id);
                          } else if (weekFiles.length > 0 || COURSE_FOLDERS.some(c => !deletedFolderIds.has(`${week.id}-${c.id}`))) {
                            toggleFolder(week.id);
                          }
                        }}
                        onDragOver={(e) => handleDragOver(e, week.id)}
                        onDragLeave={(e) => handleDragLeave(e)}
                        onDrop={(e) => handleDrop(e, week.id)}
                        data-testid={`folder-${week.id}`}
                      >
                        {weekFiles.length > 0 || COURSE_FOLDERS.some(c => !deletedFolderIds.has(`${week.id}-${c.id}`)) ? (
                          isWeekExpanded ? (
                            <ChevronDown className="h-3 w-3 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-3 w-3 text-gray-500" />
                          )
                        ) : (
                          <div className="w-3 h-3" />
                        )}
                        {isWeekExpanded ? (
                          <FolderOpen className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                        ) : (
                          <Folder className="h-4 w-4 text-yellow-600 fill-yellow-400" />
                        )}
                        {editingBuiltinFolderId === week.id ? (
                          <input
                            type="text"
                            value={editingBuiltinFolderName}
                            onChange={(e) => setEditingBuiltinFolderName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && editingBuiltinFolderName.trim()) {
                                saveFolderDisplayName(week.id, editingBuiltinFolderName.trim());
                              } else if (e.key === "Escape") {
                                setEditingBuiltinFolderId(null);
                                setEditingBuiltinFolderName("");
                              }
                            }}
                            onBlur={() => {
                              if (editingBuiltinFolderName.trim()) {
                                saveFolderDisplayName(week.id, editingBuiltinFolderName.trim());
                              } else {
                                setEditingBuiltinFolderId(null);
                                setEditingBuiltinFolderName("");
                              }
                            }}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            className="text-sm flex-1 bg-[#1e1e1e] border border-[#0078d4] rounded px-1 py-0 text-white outline-none"
                            data-testid={`input-rename-week-folder-${week.id}`}
                          />
                        ) : (
                          <span className={`text-sm flex-1 ${shouldStrikethrough ? 'line-through text-gray-500' : ''}`}>{folderDisplayNames[week.id] || week.name}</span>
                        )}
                        <span className="text-xs text-gray-500">{weekFiles.length}</span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem
                        onClick={() => {
                          setEditingBuiltinFolderId(week.id);
                          setEditingBuiltinFolderName(folderDisplayNames[week.id] || week.name);
                        }}
                        data-testid={`rename-week-folder-${week.id}`}
                      >
                        <Edit2 className="h-4 w-4 mr-2" />
                        Rename Folder
                      </ContextMenuItem>
                      <ContextMenuItem
                        onClick={() => {
                          setAddFolderParentId(week.id);
                          setShowAddFolderDialog(true);
                        }}
                        data-testid={`add-folder-${week.id}`}
                      >
                        <FolderPlus className="h-4 w-4 mr-2" />
                        Add Folder
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                  
                  {isWeekExpanded && (
                    <div className="ml-3">
                      {COURSE_FOLDERS.map((course) => {
                        const courseFolderId = `${week.id}-${course.id}`;
                        // Skip deleted folders
                        if (deletedFolderIds.has(courseFolderId)) return null;
                        const courseFiles = getFilesInCourse(week.id, course.id);
                        const isCourseExpanded = expandedFolders.has(courseFolderId);
                        
                        return (
                          <div key={courseFolderId}>
                            <ContextMenu>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d] ${selectedFolder === courseFolderId ? "bg-[#0078d4]/30 border-l-2 border-[#0078d4]" : ""} ${dragOverFolder === courseFolderId ? "bg-[#0078d4]/50" : ""}`}
                                  onClick={(e) => {
                                    if (e.ctrlKey || e.metaKey) {
                                      setSelectedFolder(courseFolderId);
                                    } else if (courseFiles.length > 0 || CONTENT_FOLDERS.some(cf => !deletedFolderIds.has(`${courseFolderId}-${cf.id}`))) {
                                      toggleFolder(courseFolderId);
                                    }
                                  }}
                                  onDragOver={(e) => handleDragOver(e, courseFolderId)}
                                  onDragLeave={(e) => handleDragLeave(e)}
                                  onDrop={(e) => handleDrop(e, courseFolderId)}
                                  data-testid={`course-folder-${courseFolderId}`}
                                >
                                  {courseFiles.length > 0 || CONTENT_FOLDERS.some(cf => !deletedFolderIds.has(`${courseFolderId}-${cf.id}`)) ? (
                                    isCourseExpanded ? (
                                      <ChevronDown className="h-3 w-3 text-gray-500" />
                                    ) : (
                                      <ChevronRight className="h-3 w-3 text-gray-500" />
                                    )
                                  ) : (
                                    <div className="w-3 h-3" />
                                  )}
                                  {isCourseExpanded ? (
                                    <FolderOpen className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                                  ) : (
                                    <Folder className="h-4 w-4 text-yellow-600 fill-yellow-400" />
                                  )}
                                  {editingBuiltinFolderId === courseFolderId ? (
                                    <input
                                      type="text"
                                      value={editingBuiltinFolderName}
                                      onChange={(e) => setEditingBuiltinFolderName(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" && editingBuiltinFolderName.trim()) {
                                          saveFolderDisplayName(courseFolderId, editingBuiltinFolderName.trim());
                                        } else if (e.key === "Escape") {
                                          setEditingBuiltinFolderId(null);
                                          setEditingBuiltinFolderName("");
                                        }
                                      }}
                                      onBlur={() => {
                                        if (editingBuiltinFolderName.trim()) {
                                          saveFolderDisplayName(courseFolderId, editingBuiltinFolderName.trim());
                                        } else {
                                          setEditingBuiltinFolderId(null);
                                          setEditingBuiltinFolderName("");
                                        }
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      autoFocus
                                      className={`text-sm flex-1 bg-[#1e1e1e] border border-[#0078d4] rounded px-1 py-0 outline-none ${course.color}`}
                                      data-testid={`input-rename-course-folder-${courseFolderId}`}
                                    />
                                  ) : (
                                    <span className={`text-sm flex-1 ${course.color}`}>{folderDisplayNames[courseFolderId] || course.name}</span>
                                  )}
                                  <span className="text-xs text-gray-500">{courseFiles.length}</span>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent className="w-48">
                                <ContextMenuItem
                                  onClick={() => {
                                    setEditingBuiltinFolderId(courseFolderId);
                                    setEditingBuiltinFolderName(folderDisplayNames[courseFolderId] || course.name);
                                  }}
                                  data-testid={`rename-course-folder-${courseFolderId}`}
                                >
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Rename Folder
                                </ContextMenuItem>
                                <ContextMenuItem
                                  onClick={() => {
                                    setAddFolderParentId(courseFolderId);
                                    setShowAddFolderDialog(true);
                                  }}
                                  data-testid={`add-folder-${courseFolderId}`}
                                >
                                  <FolderPlus className="h-4 w-4 mr-2" />
                                  Add Folder
                                </ContextMenuItem>
                              </ContextMenuContent>
                            </ContextMenu>
                            
                            {isCourseExpanded && (
                              <div className="ml-4">
                                {CONTENT_FOLDERS.map((content) => {
                                  const contentFolderId = `${week.id}-${course.id}-${content.id}`;
                                  // Skip deleted folders
                                  if (deletedFolderIds.has(contentFolderId)) return null;
                                  const contentFiles = getFilesInFolder(contentFolderId);
                                  const isSelected = selectedFolder === contentFolderId;
                                  const contentCustomFolders = customFoldersData.filter(cf => cf.parentFolderId === contentFolderId);
                                  const isContentExpanded = expandedFolders.has(contentFolderId);
                                  const hasSubfolders = contentCustomFolders.length > 0;
                                  
                                  return (
                                    <div key={contentFolderId}>
                                      <ContextMenu>
                                        <ContextMenuTrigger asChild>
                                          <div
                                            className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d] ${isSelected ? "bg-[#0078d4]/30" : ""} ${dragOverFolder === contentFolderId ? "bg-[#0078d4]/50 ring-1 ring-[#0078d4]" : ""}`}
                                            onClick={() => {
                                              if (hasSubfolders) {
                                                toggleFolder(contentFolderId);
                                              }
                                              setSelectedFolder(contentFolderId);
                                            }}
                                            onDragOver={(e) => handleDragOver(e, contentFolderId)}
                                            onDragLeave={(e) => handleDragLeave(e)}
                                            onDrop={(e) => handleDrop(e, contentFolderId)}
                                            data-testid={`content-folder-${contentFolderId}`}
                                          >
                                            {hasSubfolders ? (
                                              isContentExpanded ? (
                                                <ChevronDown className="h-3 w-3 text-gray-500" />
                                              ) : (
                                                <ChevronRight className="h-3 w-3 text-gray-500" />
                                              )
                                            ) : (
                                              <div className="w-3 h-3" />
                                            )}
                                            <Folder className="h-3.5 w-3.5 text-yellow-600 fill-yellow-400" />
                                            {editingBuiltinFolderId === contentFolderId ? (
                                              <input
                                                type="text"
                                                value={editingBuiltinFolderName}
                                                onChange={(e) => setEditingBuiltinFolderName(e.target.value)}
                                                onKeyDown={(e) => {
                                                  if (e.key === "Enter" && editingBuiltinFolderName.trim()) {
                                                    saveFolderDisplayName(contentFolderId, editingBuiltinFolderName.trim());
                                                  } else if (e.key === "Escape") {
                                                    setEditingBuiltinFolderId(null);
                                                    setEditingBuiltinFolderName("");
                                                  }
                                                }}
                                                onBlur={() => {
                                                  if (editingBuiltinFolderName.trim()) {
                                                    saveFolderDisplayName(contentFolderId, editingBuiltinFolderName.trim());
                                                  } else {
                                                    setEditingBuiltinFolderId(null);
                                                    setEditingBuiltinFolderName("");
                                                  }
                                                }}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                                className="text-sm flex-1 bg-[#1e1e1e] border border-[#0078d4] rounded px-1 py-0 text-white outline-none"
                                                data-testid={`input-rename-builtin-folder-${contentFolderId}`}
                                              />
                                            ) : (
                                              <span className="text-sm flex-1">{folderDisplayNames[contentFolderId] || content.name}</span>
                                            )}
                                            <span className="text-xs text-gray-500">{contentFiles.length}</span>
                                          </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent className="w-48">
                                          <ContextMenuItem
                                            onClick={() => {
                                              setEditingBuiltinFolderId(contentFolderId);
                                              setEditingBuiltinFolderName(folderDisplayNames[contentFolderId] || content.name);
                                            }}
                                            data-testid={`rename-builtin-folder-${contentFolderId}`}
                                          >
                                            <Edit2 className="h-4 w-4 mr-2" />
                                            Rename Folder
                                          </ContextMenuItem>
                                          <ContextMenuItem
                                            onClick={() => {
                                              setAddFolderParentId(contentFolderId);
                                              setShowAddFolderDialog(true);
                                            }}
                                            data-testid={`add-folder-${contentFolderId}`}
                                          >
                                            <FolderPlus className="h-4 w-4 mr-2" />
                                            Add Folder
                                          </ContextMenuItem>
                                        </ContextMenuContent>
                                      </ContextMenu>
                                      {isContentExpanded && hasSubfolders && (
                                        <div className="ml-4">
                                          {contentCustomFolders.map((customFolder) => {
                                            const customFolderId = `custom-${customFolder.id}`;
                                            const customFiles = files.filter(f => f.folder === customFolderId);
                                            const isCustomSelected = selectedFolder === customFolderId;
                                            
                                            return (
                                              <ContextMenu key={customFolderId}>
                                                <ContextMenuTrigger asChild>
                                                  <div
                                                    className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d] ${isCustomSelected ? "bg-[#0078d4]/30" : ""} ${dragOverFolder === customFolderId ? "bg-[#0078d4]/50 ring-1 ring-[#0078d4]" : ""}`}
                                                    onClick={() => setSelectedFolder(customFolderId)}
                                                    onDragOver={(e) => handleDragOver(e, customFolderId)}
                                                    onDragLeave={(e) => handleDragLeave(e)}
                                                    onDrop={(e) => handleDrop(e, customFolderId)}
                                                    data-testid={`custom-folder-${customFolderId}`}
                                                  >
                                                    <div className="w-3 h-3" />
                                                    <Folder className="h-3.5 w-3.5 text-blue-500 fill-blue-400" />
                                                    {editingFolderId === customFolder.id ? (
                                                      <input
                                                        type="text"
                                                        value={editingFolderName}
                                                        onChange={(e) => setEditingFolderName(e.target.value)}
                                                        onKeyDown={(e) => {
                                                          if (e.key === "Enter" && editingFolderName.trim()) {
                                                            renameCustomFolderMutation.mutate({ id: customFolder.id, name: editingFolderName.trim() });
                                                          } else if (e.key === "Escape") {
                                                            setEditingFolderId(null);
                                                            setEditingFolderName("");
                                                          }
                                                        }}
                                                        onBlur={() => {
                                                          if (editingFolderName.trim() && editingFolderName !== customFolder.name) {
                                                            renameCustomFolderMutation.mutate({ id: customFolder.id, name: editingFolderName.trim() });
                                                          } else {
                                                            setEditingFolderId(null);
                                                            setEditingFolderName("");
                                                          }
                                                        }}
                                                        onClick={(e) => e.stopPropagation()}
                                                        autoFocus
                                                        className="text-sm flex-1 bg-[#1e1e1e] border border-[#0078d4] rounded px-1 py-0 text-white outline-none"
                                                        data-testid={`input-rename-folder-${customFolder.id}`}
                                                      />
                                                    ) : (
                                                      <span 
                                                        className="text-sm flex-1 hover:underline"
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          setEditingFolderId(customFolder.id);
                                                          setEditingFolderName(customFolder.name);
                                                        }}
                                                        data-testid={`folder-name-${customFolder.id}`}
                                                      >
                                                        {customFolder.name}
                                                      </span>
                                                    )}
                                                    <span className="text-xs text-gray-500">{customFiles.length}</span>
                                                  </div>
                                                </ContextMenuTrigger>
                                                <ContextMenuContent className="w-48">
                                                  <ContextMenuItem
                                                    onClick={() => {
                                                      setEditingFolderId(customFolder.id);
                                                      setEditingFolderName(customFolder.name);
                                                    }}
                                                    data-testid={`rename-folder-${customFolderId}`}
                                                  >
                                                    <Edit2 className="h-4 w-4 mr-2" />
                                                    Rename Folder
                                                  </ContextMenuItem>
                                                  <ContextMenuItem
                                                    onClick={() => {
                                                      setAddFolderParentId(customFolderId);
                                                      setShowAddFolderDialog(true);
                                                    }}
                                                    data-testid={`add-folder-${customFolderId}`}
                                                  >
                                                    <FolderPlus className="h-4 w-4 mr-2" />
                                                    Add Folder
                                                  </ContextMenuItem>
                                                  <ContextMenuItem
                                                    onClick={() => deleteCustomFolderMutation.mutate(customFolder.id)}
                                                    className="text-red-500"
                                                    data-testid={`delete-folder-${customFolderId}`}
                                                  >
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Folder
                                                  </ContextMenuItem>
                                                </ContextMenuContent>
                                              </ContextMenu>
                                            );
                                          })}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Completed folder - single folder at bottom */}
            <div
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#2d2d2d] ${selectedFolder === "completed" ? "bg-[#0078d4]/30 border-l-2 border-[#0078d4]" : ""}`}
              onClick={() => setSelectedFolder("completed")}
              data-testid="folder-completed"
            >
              <Folder className="h-4 w-4 text-green-500 fill-green-400" />
              <span className="text-sm text-white">Completed</span>
              {files.filter(f => f.folder === "completed").length > 0 && (
                <span className="ml-auto text-xs bg-green-600 px-1.5 py-0.5 rounded">{files.filter(f => f.folder === "completed").length}</span>
              )}
            </div>

            {/* Unfiled files */}
            <div
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#2d2d2d] ${selectedFolder === null ? "bg-[#0078d4]/30 border-l-2 border-[#0078d4]" : ""}`}
              onClick={() => setSelectedFolder(null)}
              data-testid="folder-unfiled"
            >
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-white">Unfiled</span>
              {unfiledFiles.length > 0 && (
                <span className="ml-auto text-xs bg-gray-600 px-1.5 py-0.5 rounded">{unfiledFiles.length}</span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Area - File List */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#191919]">
          {/* Column Headers */}
          <div className="flex items-center px-4 py-2 border-b border-[#3d3d3d] text-xs text-gray-400 bg-[#202020] select-none">
            <div className="w-8 flex-shrink-0"></div>
            <div className="relative flex items-center" style={{ width: columnWidths.name }}>
              <span>Name</span>
              <div 
                className="absolute right-0 top-0 bottom-0 w-px bg-white/30 cursor-col-resize hover:bg-white/70"
                onMouseDown={(e) => handleMouseDown(e, 'name')}
              />
            </div>
            <div className="relative flex items-center justify-center" style={{ width: columnWidths.actions }}>
              <span>Actions</span>
              <div 
                className="absolute right-0 top-0 bottom-0 w-px bg-white/30 cursor-col-resize hover:bg-white/70"
                onMouseDown={(e) => handleMouseDown(e, 'actions')}
              />
            </div>
            <div className="relative flex items-center justify-center" style={{ width: columnWidths.status }}>
              <span>Status</span>
              <div 
                className="absolute right-0 top-0 bottom-0 w-px bg-white/30 cursor-col-resize hover:bg-white/70"
                onMouseDown={(e) => handleMouseDown(e, 'status')}
              />
            </div>
            <div className="relative flex items-center justify-center" style={{ width: columnWidths.date }}>
              <span>Date modified</span>
              <div 
                className="absolute right-0 top-0 bottom-0 w-px bg-white/30 cursor-col-resize hover:bg-white/70"
                onMouseDown={(e) => handleMouseDown(e, 'date')}
              />
            </div>
            <div className="relative flex items-center justify-center" style={{ width: columnWidths.type }}>
              <span>Type</span>
              <div 
                className="absolute right-0 top-0 bottom-0 w-px bg-white/30 cursor-col-resize hover:bg-white/70"
                onMouseDown={(e) => handleMouseDown(e, 'type')}
              />
            </div>
            <div className="text-right" style={{ width: columnWidths.size }}>Size</div>
          </div>

          {/* File List */}
          <div 
            className="flex-1 overflow-y-auto"
            onDragOver={(e) => { if (selectedFolder) handleDragOver(e, selectedFolder); else { e.preventDefault(); setDragOverFolder("unfiled"); }}}
            onDragLeave={handleDragLeave}
            onDrop={(e) => selectedFolder ? handleDrop(e, selectedFolder) : handleDropOnUnfiled(e)}
          >
            {sortedFiles(getCurrentFolderFiles()).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Folder className="h-16 w-16 text-gray-600 mb-4" />
                <p className="text-sm">This folder is empty</p>
                <p className="text-xs mt-1">Drop files here to add them</p>
              </div>
            ) : (
              sortedFiles(getCurrentFolderFiles()).map((file) => {
                const FileIcon = getFileIcon(file.contentType);
                const assignedTasks = getTasksForFile(file);
                const isDragging = draggedFileId === file.id;

                return (
                  <div
                    key={file.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, file.id)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center px-4 py-1.5 hover:bg-[#2d2d2d] border-b border-[#2a2a2a] cursor-pointer ${isDragging ? "opacity-50" : ""}`}
                    data-testid={`file-row-${file.id}`}
                  >
                    {/* Checkbox */}
                    <div className="w-8 flex-shrink-0">
                      <Checkbox
                        checked={file.listened || false}
                        onCheckedChange={(checked) => {
                          listenedMutation.mutate({ id: file.id, listened: checked === true });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 border-gray-500 data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                        data-testid={`checkbox-listened-${file.id}`}
                      />
                    </div>
                    
                    {/* Name */}
                    <div className="flex items-center gap-2 min-w-0" style={{ width: columnWidths.name }}>
                      <FileIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <a 
                        href={file.objectPath} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className={`text-sm truncate hover:underline ${file.listened ? 'line-through text-gray-500' : 'text-white'}`}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`text-filename-${file.id}`}
                      >
                        {file.displayName}
                      </a>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-3" style={{ width: columnWidths.actions }}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingFile(file);
                          setNewName(file.displayName);
                        }}
                        data-testid={`button-rename-${file.id}`}
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-white"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(file.objectPath);
                          toast({ title: "Link copied to clipboard" });
                        }}
                        data-testid={`button-link-${file.id}`}
                      >
                        <Link2 className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-gray-400 hover:text-red-500"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMutation.mutate(file.id);
                        }}
                        data-testid={`button-delete-${file.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>

                    {/* Status */}
                    <div className="flex justify-center" style={{ width: columnWidths.status }}>
                      {file.listened ? (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      ) : assignedTasks.length > 0 ? (
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 bg-blue-600">
                          {assignedTasks.length}
                        </Badge>
                      ) : null}
                    </div>

                    {/* Date modified */}
                    <div className="text-xs text-gray-400" style={{ width: columnWidths.date }}>
                      {formatDate(file.createdAt)}
                    </div>

                    {/* Type */}
                    <div className="text-xs text-gray-400 truncate" style={{ width: columnWidths.type }}>
                      {file.contentType?.split("/")[1]?.toUpperCase() || "File"}
                    </div>

                    {/* Size */}
                    <div className="text-xs text-gray-400 text-right" style={{ width: columnWidths.size }}>
                      {formatFileSize(file.size)}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Action Bar */}
          {sortedFiles(getCurrentFolderFiles()).length > 0 && (
            <div className="border-t border-[#3d3d3d] bg-[#202020] px-4 py-2">
              <div className="text-xs text-gray-400">
                {sortedFiles(getCurrentFolderFiles()).length} items
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - File Details/Controls */}
        {sortedFiles(getCurrentFolderFiles()).length > 0 && (
          <div className="w-64 border-l border-[#3d3d3d] overflow-y-auto p-3 relative">
            <div 
              className="absolute inset-0" 
              style={{
                backgroundImage: `url(${quickActionsBg})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center center',
                filter: 'brightness(1.04)'
              }}
            ></div>
            <h3 className="text-sm font-medium mb-3 text-white relative z-10">Media Player</h3>
            {sortedFiles(getCurrentFolderFiles()).map((file) => (
              <div 
                key={file.id}
                className="mb-3 p-2 bg-[#c9a033] rounded-md relative z-10 border border-black/50"
              >
                <div className="text-[10px] truncate mb-2 text-black font-medium">{file.displayName}</div>
                <div className="flex items-center gap-2 mb-2">
                  <Select 
                    value={getSpeakerForFile(file.id)} 
                    onValueChange={(value) => setSpeakerForFile(file.id, value)}
                  >
                    <SelectTrigger className="flex-1 h-6 text-[10px] bg-[#3d3d3d] border-[#4d4d4d] text-white" data-testid={`select-speaker-${file.id}`}>
                      <SelectValue placeholder="Speaker" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#2d2d2d] border-[#3d3d3d]">
                      {SPEAKERS.map(speaker => (
                        <SelectItem key={speaker.id} value={speaker.id} className="text-xs">
                          {speaker.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Playback controls */}
                <div className="flex items-center justify-center gap-3 mb-2">
                  <SkipBack 
                    className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
                    onClick={(e) => { e.stopPropagation(); handleSkipChunk(file.id, "backward"); }}
                    data-testid={`button-skip-back-panel-${file.id}`}
                  />
                  <Play 
                    className="h-5 w-5 fill-black text-black cursor-pointer hover:opacity-70" 
                    onClick={() => handlePlayFile(file.id, file.objectPath, file.displayName)}
                    data-testid={`button-play-panel-${file.id}`}
                  />
                  <Square 
                    className="h-4 w-4 fill-black text-black cursor-pointer hover:opacity-70" 
                    onClick={() => handleStop(file.id)}
                    data-testid={`button-stop-panel-${file.id}`}
                  />
                  <SkipForward 
                    className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
                    onClick={(e) => { e.stopPropagation(); handleSkipChunk(file.id, "forward"); }}
                    data-testid={`button-skip-forward-panel-${file.id}`}
                  />
                  <RotateCcw 
                    className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
                    onClick={() => handleRestart(file.id, file.objectPath, file.displayName)}
                    data-testid={`button-restart-panel-${file.id}`}
                  />
                </div>
                {/* Volume controls with plus/minus */}
                <div className="flex items-center justify-center gap-3">
                  <Minus 
                    className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
                    onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "down"); }}
                    data-testid={`button-vol-down-panel-${file.id}`}
                  />
                  <Volume2 className="h-4 w-4 text-black" />
                  <Plus 
                    className="h-4 w-4 text-black cursor-pointer hover:opacity-70" 
                    onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "up"); }}
                    data-testid={`button-vol-up-panel-${file.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!editingFile} onOpenChange={() => setEditingFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename File</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Enter new file name"
              data-testid="input-rename"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingFile(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleRename} 
              disabled={renameMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameMutation.isPending ? "Renaming..." : "Rename"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigningFile} onOpenChange={() => setAssigningFile(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Task</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger data-testid="select-task">
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id.toString()}>
                    {task.title}
                    {task.courseName && ` (${task.courseName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigningFile(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAssign}
              disabled={!selectedTaskId || assignMutation.isPending}
              data-testid="button-confirm-assign"
            >
              {assignMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignAfterUpload} onOpenChange={setShowAssignAfterUpload}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Uploaded File to Task</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger data-testid="select-task-after-upload">
                <SelectValue placeholder="Select a task..." />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id.toString()}>
                    {task.title}
                    {task.courseName && ` (${task.courseName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssignAfterUpload(false)}>
              Skip
            </Button>
            <Button 
              onClick={handleAssignAfterUpload}
              disabled={!selectedTaskId || assignByPathMutation.isPending}
              data-testid="button-confirm-assign-after-upload"
            >
              {assignByPathMutation.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteFolderConfirm} onOpenChange={setShowDeleteFolderConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Folder Contents</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete all files in this folder? This action cannot be undone.
            </p>
            {selectedFolder && (
              <p className="text-sm font-medium mt-2">
                Files to delete: {getFilesToDeleteInFolder(selectedFolder).length}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteFolderConfirm(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteFolder}
              data-testid="button-confirm-delete-folder"
            >
              Delete All Files
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddFolderDialog} onOpenChange={setShowAddFolderDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Folder</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newFolderName.trim() && addFolderParentId) {
                  createCustomFolderMutation.mutate({ 
                    parentFolderId: addFolderParentId, 
                    name: newFolderName.trim() 
                  });
                }
              }}
              data-testid="input-new-folder-name"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowAddFolderDialog(false);
              setNewFolderName("");
              setAddFolderParentId(null);
            }}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (newFolderName.trim() && addFolderParentId) {
                  createCustomFolderMutation.mutate({ 
                    parentFolderId: addFolderParentId, 
                    name: newFolderName.trim() 
                  });
                }
              }}
              disabled={!newFolderName.trim() || createCustomFolderMutation.isPending}
              data-testid="button-create-folder"
            >
              {createCustomFolderMutation.isPending ? "Creating..." : "Create Folder"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
