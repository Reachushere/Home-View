import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import {
  FileText,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ArrowLeft,
  Search,
  Loader2,
  Home,
  Cloud,
  Play
} from "lucide-react";

interface OneDriveItem {
  id: string;
  name: string;
  type: "folder" | "file";
  mimeType?: string;
  size?: number;
  lastModified?: string;
  downloadUrl?: string;
  path: string;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  if (mimeType.includes("pdf")) return FileText;
  return File;
}

function formatFileSize(bytes?: number) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OneDrivePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [currentPath, setCurrentPath] = useState("/");
  const [pathHistory, setPathHistory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const { data: items, isLoading, error, refetch } = useQuery<OneDriveItem[]>({
    queryKey: ["/api/onedrive/files", currentPath],
    queryFn: async () => {
      const response = await fetch(`/api/onedrive/files?path=${encodeURIComponent(currentPath)}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to load files");
      }
      return response.json();
    },
  });

  const { data: searchResults, isLoading: searchLoading } = useQuery<OneDriveItem[]>({
    queryKey: ["/api/onedrive/search", searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/onedrive/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Search failed");
      }
      return response.json();
    },
    enabled: isSearching && searchQuery.trim().length > 0,
  });

  const handleFolderClick = (item: OneDriveItem) => {
    if (item.type === "folder") {
      setPathHistory([...pathHistory, currentPath]);
      setCurrentPath(item.path);
      setIsSearching(false);
      setSearchQuery("");
    }
  };

  const handleFileClick = (item: OneDriveItem) => {
    if (item.type === "file" && item.mimeType?.includes("pdf")) {
      const encodedUrl = encodeURIComponent(item.downloadUrl || "");
      const encodedName = encodeURIComponent(item.name);
      setLocation(`/pdf-reader/onedrive?url=${encodedUrl}&name=${encodedName}`);
    } else if (item.downloadUrl) {
      window.open(item.downloadUrl, "_blank");
    }
  };

  const handleGoBack = () => {
    if (pathHistory.length > 0) {
      const previousPath = pathHistory[pathHistory.length - 1];
      setPathHistory(pathHistory.slice(0, -1));
      setCurrentPath(previousPath);
    }
  };

  const handleGoHome = () => {
    setPathHistory([]);
    setCurrentPath("/");
    setIsSearching(false);
    setSearchQuery("");
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      setIsSearching(true);
    }
  };

  const handleClearSearch = () => {
    setIsSearching(false);
    setSearchQuery("");
  };

  const displayItems = isSearching && searchResults ? searchResults : items;
  const pdfFiles = displayItems?.filter(item => 
    item.type === "file" && item.mimeType?.includes("pdf")
  ) || [];
  const folders = displayItems?.filter(item => item.type === "folder") || [];
  const otherFiles = displayItems?.filter(item => 
    item.type === "file" && !item.mimeType?.includes("pdf")
  ) || [];

  const pathParts = currentPath === "/" ? [] : currentPath.split("/").filter(Boolean);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              OneDrive Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {(error as Error).message || "Failed to connect to OneDrive"}
            </p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="border-b p-4">
        <div className="flex items-center gap-4 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoBack}
            disabled={pathHistory.length === 0 && !isSearching}
            data-testid="button-go-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleGoHome}
            data-testid="button-go-home"
          >
            <Home className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1">
            <Cloud className="w-4 h-4" />
            <span className="font-medium">OneDrive</span>
            {pathParts.map((part, i) => (
              <span key={i} className="flex items-center">
                <ChevronRight className="w-4 h-4 mx-1" />
                <span>{part}</span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="flex-1"
            data-testid="input-search"
          />
          <Button onClick={handleSearch} disabled={!searchQuery.trim()} data-testid="button-search">
            <Search className="w-4 h-4" />
          </Button>
          {isSearching && (
            <Button variant="outline" onClick={handleClearSearch} data-testid="button-clear-search">
              Clear
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isLoading || searchLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {folders.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Folders</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {folders.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleFolderClick(item)}
                      className="flex flex-col items-center p-4 rounded-lg border bg-card hover-elevate transition-all text-center"
                      data-testid={`folder-${item.id}`}
                    >
                      <Folder className="w-10 h-10 text-yellow-500 mb-2" />
                      <span className="text-sm font-medium truncate w-full">{item.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pdfFiles.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">PDF Files</h3>
                <div className="space-y-2">
                  {pdfFiles.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-4 p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                      onClick={() => handleFileClick(item)}
                      data-testid={`file-${item.id}`}
                    >
                      <FileText className="w-8 h-8 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item.name}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-3">
                          <span>{formatFileSize(item.size)}</span>
                          <span>{formatDate(item.lastModified)}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" data-testid={`button-open-${item.id}`}>
                        <Play className="w-4 h-4" />
                        Open
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {otherFiles.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Other Files</h3>
                <div className="space-y-2">
                  {otherFiles.map((item) => {
                    const Icon = getFileIcon(item.mimeType);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-4 p-3 rounded-lg border bg-card hover-elevate cursor-pointer"
                        onClick={() => handleFileClick(item)}
                        data-testid={`file-${item.id}`}
                      >
                        <Icon className="w-8 h-8 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{item.name}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-3">
                            <span>{formatFileSize(item.size)}</span>
                            <span>{formatDate(item.lastModified)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {displayItems?.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <Folder className="w-16 h-16 mb-4 opacity-50" />
                <p>No files found</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
