import { useState, DragEvent } from "react";
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
  Loader2
} from "lucide-react";
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
        className={`flex flex-col gap-1 p-2 bg-[#ffd251] border-2 border-black dark:border-white rounded-[4px] hover-elevate cursor-move ${
          isDragging ? "opacity-50" : ""
        }`}
        data-testid={`file-row-${file.id}`}
      >
        <div className="flex items-center justify-between gap-1">
          <a 
            href={file.objectPath} 
            target="_blank" 
            rel="noopener noreferrer"
            className="font-medium text-[10px] truncate hover:underline cursor-pointer text-black flex-1"
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

        <div className="flex items-center w-[calc(100%+16px)] bg-black dark:bg-black rounded-b-[4px] -ml-2 -mr-2 -mb-2 px-2 py-1 mt-1">
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
              onClick={() => handleVolume(file.id, "down")}
              data-testid={`button-vol-down-${file.id}`}
            />
            <Volume2 
              className="h-3 w-3 text-white cursor-pointer hover:opacity-70" 
              onClick={() => handleVolume(file.id, "up")}
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

  return (
    <div 
      className={`min-h-screen bg-background p-6 transition-all ${isExternalDragOver ? "ring-4 ring-primary ring-inset bg-primary/5" : ""}`}
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
          <div className="bg-card border-2 border-dashed border-primary rounded-lg p-8 text-center">
            <Upload className="h-12 w-12 mx-auto text-primary mb-2" />
            <p className="text-lg font-medium">Drop files here to upload</p>
          </div>
        </div>
      )}
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">File Manager</h1>
          <ObjectUploader
            maxNumberOfFiles={5}
            onGetUploadParameters={getUploadParameters}
            onComplete={handleUploadComplete}
            buttonClassName="h-8 text-xs px-3 bg-[#5979CC] hover:bg-[#4a68b3] text-white border-[1.75px] border-blue-800"
          >
            <Upload className="h-3 w-3 mr-1" />
            Upload
          </ObjectUploader>
          <div className="flex-1" />
          <Badge variant="secondary">
            {files.length} {files.length === 1 ? "file" : "files"}
          </Badge>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="w-[160px]" data-testid="select-sort">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-newest">Newest first</SelectItem>
              <SelectItem value="date-oldest">Oldest first</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="size-largest">Largest first</SelectItem>
              <SelectItem value="size-smallest">Smallest first</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {WEEKS.map((week) => {
            const weekFiles = getFilesInWeek(week.id);
            const isWeekExpanded = expandedFolders.has(week.id);
            
            return (
              <Card 
                key={week.id}
                className="hover-elevate transition-all"
                data-testid={`folder-${week.id}`}
              >
                <CardHeader 
                  className="cursor-pointer pb-2"
                  onClick={() => toggleFolder(week.id)}
                >
                  <CardTitle className="flex items-center gap-2 text-base">
                    {isWeekExpanded ? (
                      <FolderOpen className="h-5 w-5 text-yellow-500 fill-yellow-400" />
                    ) : (
                      <Folder className="h-5 w-5 text-yellow-600 fill-yellow-400" />
                    )}
                    {week.name}
                    <Badge variant="secondary" className="ml-auto">
                      {weekFiles.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                {isWeekExpanded && (
                  <CardContent className="space-y-3 pt-0">
                    {COURSE_FOLDERS.map((course) => {
                      const courseFolderId = `${week.id}-${course.id}`;
                      const courseFiles = getFilesInCourse(week.id, course.id);
                      const isCourseExpanded = expandedFolders.has(courseFolderId);
                      
                      return (
                        <div
                          key={courseFolderId}
                          className="border rounded-md p-2"
                          data-testid={`course-folder-${courseFolderId}`}
                        >
                          <div 
                            className="flex items-center gap-2 cursor-pointer p-1"
                            onClick={() => toggleFolder(courseFolderId)}
                          >
                            {isCourseExpanded ? (
                              <FolderOpen className="h-4 w-4 text-yellow-500 fill-yellow-400" />
                            ) : (
                              <Folder className="h-4 w-4 text-yellow-600 fill-yellow-400" />
                            )}
                            <span className={`text-sm font-medium ${course.color}`}>{course.name}</span>
                            <Badge variant="outline" className="ml-auto text-xs">
                              {courseFiles.length}
                            </Badge>
                          </div>
                          {isCourseExpanded && (
                            <div className="mt-2 space-y-2 pl-4">
                              {CONTENT_FOLDERS.map((content) => {
                                const contentFolderId = `${week.id}-${course.id}-${content.id}`;
                                const contentFiles = getFilesInFolder(contentFolderId);
                                const isContentExpanded = expandedFolders.has(contentFolderId);
                                const isDragOver = dragOverFolder === contentFolderId;
                                
                                return (
                                  <div
                                    key={contentFolderId}
                                    className={`border rounded-md p-2 transition-all ${isDragOver ? "ring-2 ring-primary bg-primary/5" : ""}`}
                                    onDragOver={(e) => handleDragOver(e, contentFolderId)}
                                    onDragLeave={(e) => handleDragLeave(e)}
                                    onDrop={(e) => handleDrop(e, contentFolderId)}
                                    data-testid={`content-folder-${contentFolderId}`}
                                  >
                                    <div 
                                      className="flex items-center gap-2 cursor-pointer p-1"
                                      onClick={() => toggleFolder(contentFolderId)}
                                    >
                                      {isContentExpanded ? (
                                        <FolderOpen className="h-3 w-3 text-yellow-500 fill-yellow-400" />
                                      ) : (
                                        <Folder className="h-3 w-3 text-yellow-600 fill-yellow-400" />
                                      )}
                                      <span className="text-xs font-medium">{content.name}</span>
                                      <Badge variant="outline" className="ml-auto text-[10px] py-0">
                                        {contentFiles.length}
                                      </Badge>
                                    </div>
                                    {isContentExpanded && (
                                      <div className="mt-2 space-y-2 pl-2">
                                        {contentFiles.length === 0 ? (
                                          <div className="text-center py-2 text-muted-foreground text-xs">
                                            Drop files here
                                          </div>
                                        ) : (
                                          sortedFiles(contentFiles).map(file => renderFileRow(file))
                                        )}
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
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>

        {unfiledFiles.length > 0 && (
          <Card
            className={`mt-6 ${dragOverFolder === "unfiled" ? "ring-2 ring-primary" : ""}`}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOverFolder("unfiled"); }}
            onDragLeave={(e) => handleDragLeave(e)}
            onDrop={handleDropOnUnfiled}
          >
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Unfiled
                <Badge variant="secondary" className="ml-2">
                  {unfiledFiles.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sortedFiles(unfiledFiles).map(file => renderFileRow(file))}
            </CardContent>
          </Card>
        )}

        {files.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No files uploaded yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload files when creating or editing tasks to see them here.
              </p>
              <Link href="/">
                <Button data-testid="button-go-to-dashboard">Go to Dashboard</Button>
              </Link>
            </CardContent>
          </Card>
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
