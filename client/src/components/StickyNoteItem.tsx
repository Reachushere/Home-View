import { useState, useRef, useCallback, memo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { StickyNote as StickyNoteType } from "@shared/schema";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Palette,
  Bell,
  Paperclip,
  Link2,
  Mail,
  Smartphone,
  Volume2,
  List,
  Plus,
  Minus,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";

const NOTE_COLORS: Record<string, { bg: string; border: string; header: string }> = {
  yellow: { bg: '#FFFACD', border: '#E6D200', header: '#FFFF00' },
  pink: { bg: '#FFE4EC', border: '#FF69B4', header: '#FFB6C1' },
  blue: { bg: '#E0F0FF', border: '#4DA6FF', header: '#87CEEB' },
  green: { bg: '#E0FFE0', border: '#32CD32', header: '#98FB98' },
  orange: { bg: '#FFE4CC', border: '#FF8C00', header: '#FFCC99' },
  purple: { bg: '#F0E0FF', border: '#9370DB', header: '#DDA0DD' },
};

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface StickyNoteItemProps {
  note: StickyNoteType;
  isDragging: boolean;
  dragPosition: { x: number; y: number } | null;
  maxStickyZIndex: number;
  tasks: Array<{ id: number; title: string }>;
  allProjects: Array<{ id: number; name: string }>;
  onPointerDown: (e: React.MouseEvent | React.TouchEvent, noteId: number, note: StickyNoteType) => void;
  onResizeStart: (e: React.MouseEvent | React.TouchEvent, noteId: number, note: StickyNoteType) => void;
  onDelete: (note: StickyNoteType) => void;
  onBringToFront: (noteId: number) => void;
}

const StickyNoteItem = memo(function StickyNoteItem({
  note,
  isDragging,
  dragPosition,
  maxStickyZIndex,
  tasks,
  allProjects,
  onPointerDown,
  onResizeStart,
  onDelete,
  onBringToFront,
}: StickyNoteItemProps) {
  const queryClient = useQueryClient();
  const [localContent, setLocalContent] = useState(note.content);
  const [localTitle, setLocalTitle] = useState(note.title || "Note Name");
  const contentTimeout = useRef<NodeJS.Timeout | null>(null);
  const titleTimeout = useRef<NodeJS.Timeout | null>(null);
  const prevNoteIdRef = useRef(note.id);
  const prevContentRef = useRef(note.content);
  const prevTitleRef = useRef(note.title);

  if (prevNoteIdRef.current !== note.id) {
    prevNoteIdRef.current = note.id;
    setLocalContent(note.content);
    setLocalTitle(note.title || "Note Name");
    prevContentRef.current = note.content;
    prevTitleRef.current = note.title;
  } else {
    if (prevContentRef.current !== note.content && !contentTimeout.current) {
      setLocalContent(note.content);
    }
    prevContentRef.current = note.content;
    if (prevTitleRef.current !== note.title && !titleTimeout.current) {
      setLocalTitle(note.title || "Note Name");
    }
    prevTitleRef.current = note.title;
  }

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: number; updates: Partial<StickyNoteType> }) =>
      apiRequest("PATCH", `/api/sticky-notes/${id}`, updates),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sticky-notes"] }),
  });

  const handleContentChange = useCallback((newContent: string) => {
    setLocalContent(newContent);
    if (contentTimeout.current) clearTimeout(contentTimeout.current);
    contentTimeout.current = setTimeout(() => {
      updateMutation.mutate({ id: note.id, updates: { content: newContent } });
      contentTimeout.current = null;
    }, 500);
  }, [note.id, updateMutation]);

  const handleTitleChange = useCallback((newTitle: string) => {
    setLocalTitle(newTitle);
    if (titleTimeout.current) clearTimeout(titleTimeout.current);
    titleTimeout.current = setTimeout(() => {
      updateMutation.mutate({ id: note.id, updates: { title: newTitle } });
      titleTimeout.current = null;
    }, 500);
  }, [note.id, updateMutation]);

  const toggleBullets = useCallback(() => {
    const lines = localContent.split('\n');
    const hasBullets = lines.some(line => line.trimStart().startsWith('\u25CF ') || line.trimStart().startsWith('\u2022 '));
    let newContent: string;
    if (hasBullets) {
      newContent = lines.map(line => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith('\u25CF ')) return line.replace(/\u25CF /, '');
        if (trimmed.startsWith('\u2022 ')) return line.replace(/\u2022 /, '');
        return line;
      }).join('\n');
    } else {
      newContent = lines.map(line => {
        if (line.trim() === '') return line;
        return '\u25CF ' + line;
      }).join('\n');
    }
    handleContentChange(newContent);
  }, [localContent, handleContentChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter') {
      const textarea = e.currentTarget;
      const { selectionStart } = textarea;
      const content = textarea.value;
      const lineStart = content.lastIndexOf('\n', selectionStart - 1) + 1;
      const currentLine = content.substring(lineStart, selectionStart);

      if (currentLine.trimStart().startsWith('\u25CF ') || currentLine.trimStart().startsWith('\u2022 ')) {
        const bulletChar = currentLine.trimStart().startsWith('\u25CF ') ? '\u25CF' : '\u2022';
        if (currentLine.trim() === bulletChar) {
          e.preventDefault();
          const before = content.substring(0, lineStart);
          const after = content.substring(selectionStart);
          handleContentChange(before + after);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = lineStart; }, 0);
        } else {
          e.preventDefault();
          const before = content.substring(0, selectionStart);
          const after = content.substring(selectionStart);
          const newContent = before + '\n' + bulletChar + ' ' + after;
          handleContentChange(newContent);
          setTimeout(() => { textarea.selectionStart = textarea.selectionEnd = selectionStart + 3; }, 0);
        }
      }
    }
  }, [handleContentChange]);

  const colors = note.customColor
    ? { bg: hexToRgba(note.customColor, 0.3), border: note.customColor, header: note.customColor }
    : (NOTE_COLORS[note.color] || NOTE_COLORS.yellow);

  const displayX = Math.max(0, Math.min(note.positionX, window.innerWidth - 50));
  const displayY = Math.max(0, Math.min(note.positionY, window.innerHeight - 30));

  return (
    <div
      data-sticky-note
      data-sticky-note-id={note.id}
      className="fixed shadow-lg rounded-md overflow-hidden"
      style={{
        left: `${displayX}px`,
        top: `${displayY}px`,
        width: `${note.width}px`,
        height: note.isMinimized ? '28px' : `${note.height}px`,
        zIndex: isDragging ? 10000 : (note.zIndex || 100),
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        pointerEvents: 'auto',
      }}
      data-testid={`sticky-note-${note.id}`}
    >
      <div
        className="flex items-center justify-between px-1 py-1 select-none cursor-move"
        style={{ backgroundColor: colors.header, borderBottom: `1px solid ${colors.border}`, touchAction: 'none' }}
        onMouseDown={(e) => onPointerDown(e, note.id, note)}
        onTouchStart={(e) => onPointerDown(e, note.id, note)}
      >
        <div className="flex items-center gap-1 flex-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center text-gray-600 hover:text-gray-800"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Palette className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="min-w-0 p-2" onClick={(e) => e.stopPropagation()}>
              <div className="flex gap-2">
                <button
                  className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: '#4ade80' }}
                  title="CPPA122"
                  onClick={() => updateMutation.mutate({ id: note.id, updates: { customColor: '#4ade80', color: 'custom' } })}
                />
                <button
                  className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: '#f472b6' }}
                  title="CFNF400"
                  onClick={() => updateMutation.mutate({ id: note.id, updates: { customColor: '#f472b6', color: 'custom' } })}
                />
                <button
                  className="h-5 w-5 rounded-full border border-gray-300 hover:scale-110 transition-transform"
                  style={{ backgroundColor: '#818cf8' }}
                  title="CASL101"
                  onClick={() => updateMutation.mutate({ id: note.id, updates: { customColor: '#818cf8', color: 'custom' } })}
                />
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            type="text"
            value={localTitle}
            onChange={(e) => handleTitleChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="text-[10px] text-gray-700 font-medium border-none outline-none w-20 cursor-text rounded px-0.5"
            style={{ backgroundColor: 'white', marginRight: '-8px' }}
            placeholder="Note Name"
            data-testid={`sticky-note-title-${note.id}`}
          />
        </div>
        <div className="flex items-center gap-2">
          {(note.taskId || note.projectId) && (
            <span className="text-[8px] text-gray-600 truncate max-w-[60px]" title={
              note.taskId
                ? tasks.find(t => t.id === note.taskId)?.title || 'Task'
                : allProjects?.find(p => p.id === note.projectId)?.name || 'Project'
            }>
              <Link2 className="h-2 w-2 inline" />
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={`flex items-center justify-center ${note.reminderTime ? 'text-amber-600' : 'text-gray-600'} hover:text-gray-800`}
                title="Set reminder"
              >
                <Bell className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuLabel className="text-[9px] py-1" style={{ marginLeft: '0px' }}>Reminder Settings</DropdownMenuLabel>
              <div className="space-y-2 p-1">
                <div className="space-y-1">
                  <Label className="text-[9px]">Reminder Time</Label>
                  <Input
                    type="datetime-local"
                    className="h-6 text-[8px] px-1"
                    value={note.reminderTime ? format(new Date(note.reminderTime), "yyyy-MM-dd'T'HH:mm") : ''}
                    onChange={(e) => {
                      const value = e.target.value ? new Date(e.target.value) : null;
                      updateMutation.mutate({ id: note.id, updates: { reminderTime: value } });
                    }}
                  />
                </div>
                <DropdownMenuSeparator />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Volume2 className="h-3 w-3" />
                    <span className="text-[10px]">Alarm</span>
                  </div>
                  <Checkbox
                    checked={note.reminderAlarm}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: note.id, updates: { reminderAlarm: !!checked } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    <span className="text-[10px]">Email</span>
                  </div>
                  <Checkbox
                    checked={note.reminderEmail}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: note.id, updates: { reminderEmail: !!checked } })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    <span className="text-[10px]">Push</span>
                  </div>
                  <Checkbox
                    checked={note.reminderPush}
                    onCheckedChange={(checked) => updateMutation.mutate({ id: note.id, updates: { reminderPush: !!checked } })}
                  />
                </div>
                {note.reminderTime && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-6 text-[10px] text-red-600 hover:text-red-700"
                    onClick={() => updateMutation.mutate({ id: note.id, updates: { reminderTime: null, reminderAlarm: false, reminderEmail: false, reminderPush: false } })}
                  >
                    Clear Reminder
                  </Button>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center justify-center text-gray-600 hover:text-gray-800"
                title="Attach to task or project"
              >
                <Paperclip className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="max-h-[300px] overflow-y-auto w-48">
              <DropdownMenuLabel className="text-[10px] py-1">Attach to Task</DropdownMenuLabel>
              <DropdownMenuItem
                className="text-[10px] py-1"
                onClick={() => updateMutation.mutate({ id: note.id, updates: { taskId: null } })}
              >
                <span className="text-gray-500">None</span>
              </DropdownMenuItem>
              {tasks.slice(0, 20).map((task) => (
                <DropdownMenuItem
                  key={task.id}
                  className="text-[10px] py-1 truncate"
                  onClick={() => updateMutation.mutate({ id: note.id, updates: { taskId: task.id, projectId: null } })}
                >
                  <span className={note.taskId === task.id ? "font-semibold" : ""}>
                    {task.title}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-[10px] py-1">Attach to Project</DropdownMenuLabel>
              <DropdownMenuItem
                className="text-[10px] py-1"
                onClick={() => updateMutation.mutate({ id: note.id, updates: { projectId: null } })}
              >
                <span className="text-gray-500">None</span>
              </DropdownMenuItem>
              {allProjects?.map((project) => (
                <DropdownMenuItem
                  key={project.id}
                  className="text-[10px] py-1 truncate"
                  onClick={() => updateMutation.mutate({ id: note.id, updates: { projectId: project.id, taskId: null } })}
                >
                  <span className={note.projectId === project.id ? "font-semibold" : ""}>
                    {project.name}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="relative">
            <input
              type="color"
              value={note.customColor || NOTE_COLORS[note.color]?.header || '#FFFACD'}
              onChange={(e) => updateMutation.mutate({ id: note.id, updates: { customColor: e.target.value, color: 'custom' } })}
              className="absolute opacity-0 w-0 h-0"
              id={`color-picker-${note.id}`}
            />
            <label
              htmlFor={`color-picker-${note.id}`}
              className="h-3 w-3 rounded-full border border-gray-400 hover:opacity-80 cursor-pointer block"
              style={{ backgroundColor: note.customColor || colors.header }}
            />
          </div>
          <button
            className="h-4 w-4 flex items-center justify-center text-gray-600 hover:text-gray-800"
            onClick={toggleBullets}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title="Toggle bullet list"
            data-testid={`sticky-note-bullets-${note.id}`}
          >
            <List className="h-3 w-3" />
          </button>
          <button
            className="h-4 w-4 flex items-center justify-center text-gray-600 hover:text-gray-800"
            onClick={() => updateMutation.mutate({ id: note.id, updates: { isMinimized: !note.isMinimized } })}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {note.isMinimized ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
          </button>
          <button
            className="h-4 w-4 flex items-center justify-center text-gray-600 hover:text-red-600"
            onClick={() => onDelete(note)}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            title="Delete note"
            data-testid={`sticky-note-delete-${note.id}`}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {!note.isMinimized && (
        <>
          <textarea
            className="w-full h-[calc(100%-28px)] p-2 text-[11px] resize-none border-0 outline-none !font-normal"
            style={{ backgroundColor: 'transparent', fontFamily: 'inherit' }}
            value={localContent}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Write your note here..."
            data-testid={`sticky-note-content-${note.id}`}
          />
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
            style={{
              background: `linear-gradient(135deg, transparent 50%, ${colors.header} 50%)`,
            }}
            onMouseDown={(e) => onResizeStart(e, note.id, note)}
            onTouchStart={(e) => onResizeStart(e, note.id, note)}
            data-testid={`sticky-note-resize-${note.id}`}
          />
        </>
      )}
    </div>
  );
});

export default StickyNoteItem;
