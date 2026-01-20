import { useState } from "react";
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
  VolumeX
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

  const { getUploadParameters } = useUpload();

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

  // Helper to get speaker for a file
  const getSpeakerForFile = (fileId: number) => fileSpeakers[fileId] || "media_player.cat_wr";
  
  const setSpeakerForFile = (fileId: number, speakerId: string) => {
    setFileSpeakers(prev => ({ ...prev, [fileId]: speakerId }));
  };

  // Media control functions
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

  const sortedFiles = [...files].sort((a, b) => {
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

  return (
    <div className="min-h-screen bg-background p-6">
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

        {files.length === 0 ? (
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
        ) : (
          <div className="grid gap-4">
            {sortedFiles.map((file) => {
              const FileIcon = getFileIcon(file.contentType);
              const assignedTasks = getTasksForFile(file);
              
              return (
                <Card key={file.id} className="hover-elevate" data-testid={`card-file-${file.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-muted rounded-md">
                        <FileIcon className="h-6 w-6 text-muted-foreground" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <a 
                            href={file.objectPath} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium truncate hover:underline cursor-pointer text-primary"
                            data-testid={`text-filename-${file.id}`}
                          >
                            {file.displayName}
                          </a>
                          {file.displayName !== file.originalName && (
                            <span className="text-xs text-muted-foreground truncate">
                              (was: {file.originalName})
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-2">
                          <span>{formatFileSize(file.size)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(file.createdAt)}
                          </span>
                          {file.contentType && (
                            <Badge variant="outline" className="text-xs">
                              {file.contentType.split("/")[1] || file.contentType}
                            </Badge>
                          )}
                        </div>

                        {assignedTasks.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {assignedTasks.map(task => (
                              <Badge 
                                key={task.id} 
                                variant={task.isCompleted ? "secondary" : "default"}
                                className="text-xs"
                              >
                                {task.isCompleted && <CheckCircle2 className="h-3 w-3 mr-1" />}
                                {task.title}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {/* Speaker Selection */}
                        <Select 
                          value={getSpeakerForFile(file.id)} 
                          onValueChange={(value) => setSpeakerForFile(file.id, value)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs bg-[#5979CC] hover:bg-[#4a68b3] text-white border-[1.75px] border-blue-800" data-testid={`select-speaker-${file.id}`}>
                            <SelectValue placeholder="Speaker..." />
                          </SelectTrigger>
                          <SelectContent>
                            {SPEAKERS.map(speaker => (
                              <SelectItem key={speaker.id} value={speaker.id}>
                                {speaker.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        
                        {/* Media Controls */}
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handlePlayFile(file.id, file.objectPath, file.displayName)}
                          title="Play"
                          data-testid={`button-play-${file.id}`}
                        >
                          <Play className="h-4 w-4 fill-black text-black dark:fill-white dark:text-white" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleStop(file.id)}
                          title="Stop"
                          data-testid={`button-stop-${file.id}`}
                        >
                          <Square className="h-4 w-4 fill-black text-black dark:fill-white dark:text-white" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleVolume(file.id, "down")}
                          title="Volume Down"
                          data-testid={`button-vol-down-${file.id}`}
                        >
                          <VolumeX className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleVolume(file.id, "up")}
                          title="Volume Up"
                          data-testid={`button-vol-up-${file.id}`}
                        >
                          <Volume2 className="h-4 w-4" />
                        </Button>
                        
                        <div className="w-px h-6 bg-border mx-1" />
                        
                        {/* File Actions */}
                        <a 
                          href={file.objectPath} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          data-testid={`button-download-${file.id}`}
                        >
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingFile(file);
                            setNewName(file.displayName);
                          }}
                          data-testid={`button-rename-${file.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setAssigningFile(file);
                            setSelectedTaskId("");
                          }}
                          data-testid={`button-assign-${file.id}`}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            if (confirm("Are you sure you want to delete this file?")) {
                              deleteMutation.mutate(file.id);
                            }
                          }}
                          data-testid={`button-delete-${file.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
            <DialogTitle>Assign File to Task</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Select a task to attach "{assigningFile?.displayName}" to:
            </p>
            <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
              <SelectTrigger data-testid="select-task">
                <SelectValue placeholder="Select a task" />
              </SelectTrigger>
              <SelectContent>
                {tasks.map(task => (
                  <SelectItem key={task.id} value={task.id.toString()}>
                    <div className="flex items-center gap-2">
                      {task.isCompleted && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                      <span>{task.title}</span>
                      <span className="text-xs text-muted-foreground">
                        ({new Date(task.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })})
                      </span>
                    </div>
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
    </div>
  );
}
