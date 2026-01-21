import { useState, DragEvent, useRef, useCallback, useEffect } from "react";
import quickActionsBg from "@assets/image_1769032847168.png";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  ChevronDown
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
  { id: "cppa122", name: "CPPA122 - Local Politics", color: "text-green-500" },
  { id: "cfnf400", name: "CFNF400 - Sexuality", color: "text-pink-500" },
  { id: "casl101", name: "CASL101 - ASL", color: "text-purple-500" },
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
      return await apiRequest("PATCH", `/api/files/${id}`, { folder });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
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

  const getSpeakerForFile = (fileId: number) => fileSpeakers[fileId] || "media_player.cat_wr";
  
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
    
    // Check if this is an external file drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleExternalFileDrop(e.dataTransfer.files, folderId);
      setDragOverFolder(null);
      setIsExternalDragOver(false);
      return;
    }
    
    // Internal drag-drop (moving existing files)
    const fileId = parseInt(e.dataTransfer.getData("text/plain"));
    if (fileId) {
      moveFolderMutation.mutate({ id: fileId, folder: folderId });
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
    return files.filter(f => f.folder?.startsWith(weekId + "-"));
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

        <div className="flex items-center w-[calc(100%+16px)] bg-black dark:bg-black rounded-b-[6px] -ml-2 -mr-2 -mb-2 px-2 py-1 mt-1">
          <div className="flex items-center gap-[26px]">
            <Play 
              className="h-3 w-3 fill-white text-white cursor-pointer hover:opacity-70" 
              onClick={() => handlePlayFile(file.id, file.objectPath, file.displayName)}
              data-testid={`button-play-${file.id}`}
            />
            <Square 
              className="h-3 w-3 fill-white text-white cursor-pointer hover:opacity-70" 
              onClick={() => handleStop(file.id)}
              data-testid={`button-stop-${file.id}`}
            />
            <VolumeX 
              className="h-3 w-3 text-white cursor-pointer hover:opacity-70" 
              onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "down"); }}
              data-testid={`button-vol-down-${file.id}`}
            />
            <Volume2 
              className="h-3 w-3 text-white cursor-pointer hover:opacity-70" 
              onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "up"); }}
              data-testid={`button-vol-up-${file.id}`}
            />
            <Edit2 
              className="h-3 w-3 text-white cursor-pointer hover:opacity-70" 
              onClick={() => {
                setEditingFile(file);
                setNewName(file.displayName);
              }}
              data-testid={`button-rename-${file.id}`}
            />
            <Link2 
              className="h-3 w-3 text-white cursor-pointer hover:opacity-70" 
              onClick={() => {
                setAssigningFile(file);
                setSelectedTaskId("");
              }}
              data-testid={`button-assign-${file.id}`}
            />
            <Trash2 
              className="h-3 w-3 text-white cursor-pointer hover:opacity-70" 
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
          buttonClassName="h-7 text-xs px-3 bg-[#5979CC] hover:bg-[#6989DC] text-white border-0"
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

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Tree Navigation */}
        <div className="w-56 border-r border-[#3d3d3d] bg-[#202020] overflow-y-auto">
          <div className="py-2">
            {/* Week folders */}
            {WEEKS.map((week) => {
              const weekFiles = getFilesInWeek(week.id);
              const isWeekExpanded = expandedFolders.has(week.id);
              const allFilesListened = weekFiles.length > 0 && weekFiles.every(f => f.listened);
              
              return (
                <div key={week.id}>
                  <div
                    className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-[#2d2d2d]`}
                    onClick={() => toggleFolder(week.id)}
                    data-testid={`folder-${week.id}`}
                  >
                    {isWeekExpanded ? (
                      <ChevronDown className="h-3 w-3 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-3 w-3 text-gray-500" />
                    )}
                    {isWeekExpanded ? (
                      <FolderOpen className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                    ) : (
                      <Folder className="h-4 w-4 text-yellow-600 fill-yellow-400" />
                    )}
                    <span className={`text-sm flex-1 ${allFilesListened ? 'line-through text-gray-500' : ''}`}>{week.name}</span>
                    <span className="text-xs text-gray-500">{weekFiles.length}</span>
                  </div>
                  
                  {isWeekExpanded && (
                    <div className="ml-3">
                      {COURSE_FOLDERS.map((course) => {
                        const courseFolderId = `${week.id}-${course.id}`;
                        const courseFiles = getFilesInCourse(week.id, course.id);
                        const isCourseExpanded = expandedFolders.has(courseFolderId);
                        
                        return (
                          <div key={courseFolderId}>
                            <div
                              className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d]`}
                              onClick={() => toggleFolder(courseFolderId)}
                              data-testid={`course-folder-${courseFolderId}`}
                            >
                              {isCourseExpanded ? (
                                <ChevronDown className="h-3 w-3 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-gray-500" />
                              )}
                              {isCourseExpanded ? (
                                <FolderOpen className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                              ) : (
                                <Folder className="h-4 w-4 text-yellow-600 fill-yellow-400" />
                              )}
                              <span className={`text-sm flex-1 ${course.color}`}>{course.name.split(" - ")[0]}</span>
                              <span className="text-sm text-gray-500">{courseFiles.length}</span>
                            </div>
                            
                            {isCourseExpanded && (
                              <div className="ml-4">
                                {CONTENT_FOLDERS.map((content) => {
                                  const contentFolderId = `${week.id}-${course.id}-${content.id}`;
                                  const contentFiles = getFilesInFolder(contentFolderId);
                                  const isSelected = selectedFolder === contentFolderId;
                                  
                                  return (
                                    <div
                                      key={contentFolderId}
                                      className={`flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-[#2d2d2d] ${isSelected ? "bg-[#0078d4]/30" : ""}`}
                                      onClick={() => setSelectedFolder(contentFolderId)}
                                      onDragOver={(e) => handleDragOver(e, contentFolderId)}
                                      onDragLeave={(e) => handleDragLeave(e)}
                                      onDrop={(e) => handleDrop(e, contentFolderId)}
                                      data-testid={`content-folder-${contentFolderId}`}
                                    >
                                      <Folder className="h-3.5 w-3.5 text-yellow-600 fill-yellow-400 ml-2" />
                                      <span className="text-sm flex-1">{content.name}</span>
                                      <span className="text-sm text-gray-500">{contentFiles.length}</span>
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
                filter: 'brightness(1.3)'
              }}
            ></div>
            <h3 className="text-sm font-medium mb-3 text-white relative z-10">Media Player</h3>
            {sortedFiles(getCurrentFolderFiles()).map((file) => (
              <div 
                key={file.id}
                className="mb-3 p-2 bg-[#2d2d2d]/90 rounded-md relative z-10 border border-black/50"
              >
                <div className="text-[10px] truncate mb-2 text-gray-300">{file.displayName}</div>
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
                <div className="flex items-center justify-evenly">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-[#4d4d4d]"
                    onClick={() => handlePlayFile(file.id, file.objectPath, file.displayName)}
                    data-testid={`button-play-${file.id}`}
                  >
                    <Play className="h-3 w-3 fill-white" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-[#4d4d4d]"
                    onClick={() => handleStop(file.id)}
                    data-testid={`button-stop-${file.id}`}
                  >
                    <Square className="h-3 w-3 fill-white" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-[#4d4d4d]"
                    onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "down"); }}
                    data-testid={`button-vol-down-${file.id}`}
                  >
                    <VolumeX className="h-3 w-3" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 hover:bg-[#4d4d4d]"
                    onClick={(e) => { e.stopPropagation(); handleVolume(file.id, "up"); }}
                    data-testid={`button-vol-up-${file.id}`}
                  >
                    <Volume2 className="h-3 w-3" />
                  </Button>
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
    </div>
  );
}
