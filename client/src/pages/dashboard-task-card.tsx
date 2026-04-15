import { useState } from "react";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  ClipboardCheck,
  Clock,
  CalendarDays,
  Bell,
  Paperclip,
  Download,
  Play,
  Square,
  MinusCircle,
  PlusCircle,
  RefreshCw,
  Link,
  Loader2,
  Mail,
  Share2,
} from "lucide-react";
import { iconMap, typeColors } from "./dashboard-constants";
import type { Task } from "@shared/schema";

export function TaskCard({
  task,
  onComplete,
  onReschedule,
  onEdit,
  onDelete,
  onFileClick,
  cardBgClass,
  compact = false,
  overdueBlink = false,
  urgentBlink = false,
  blinkSyncDelay,
  colorSettings,
  courseColors,
}: {
  task: Task;
  onComplete: (isCompleted: boolean) => void;
  onReschedule: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onFileClick?: (attachment: string) => void;
  cardBgClass?: string;
  compact?: boolean;
  overdueBlink?: boolean;
  blinkSyncDelay?: string;
  urgentBlink?: boolean;
  colorSettings?: { headerBar: string; pomodoroButton: string; icons: string };
  courseColors?: Record<string, { bg: string; border: string; text: string; dot: string; prepBg: string; prepBorder: string; prepText: string; hex: string }>;
}) {
  const Icon = iconMap[task.type] || ClipboardCheck;
  const isMissed = task.isMissed && !task.isCompleted;
  
  // Get course color
  const courseCode = task.courseName?.split(" ")[0] || "";
  const colors = courseColors?.[courseCode];
  
  const handleExportCalendar = () => {
    window.open(`/api/tasks/${task.id}/ics`, '_blank');
  };

  const [isSendingTTS, setIsSendingTTS] = useState(false);
  const [isControlling, setIsControlling] = useState(false);
  
  const handlePlayTTS = async () => {
    setIsSendingTTS(true);
    try {
      const attachments = task.attachments || [];
      
      if (attachments.length > 0) {
        // Read PDF/file content aloud
        const mediaUrl = attachments[0];
        const response = await fetch('/api/media/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mediaUrl, entityId: 'media_player.echo_lr_studio_white_am' }),
        });
        
        if (!response.ok) {
          console.error('PDF TTS failed');
        }
      }
    } catch (error) {
      console.error('TTS error:', error);
    } finally {
      setIsSendingTTS(false);
    }
  };

  const handleStop = async () => {
    setIsControlling(true);
    try {
      await fetch('/api/media/stop', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: 'media_player.echo_lr_studio_white_am' }),
      });
    } catch (error) {
      console.error('Stop error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const handleResume = async () => {
    setIsControlling(true);
    try {
      await fetch('/api/media/resume', { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityId: 'media_player.echo_lr_studio_white_am' }),
      });
    } catch (error) {
      console.error('Resume error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const handleVolume = async (action: "up" | "down") => {
    setIsControlling(true);
    try {
      await fetch('/api/media/volume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, entityId: 'media_player.echo_lr_studio_white_am' }),
      });
    } catch (error) {
      console.error('Volume error:', error);
    } finally {
      setIsControlling(false);
    }
  };

  const [isSyncingCalendar, setIsSyncingCalendar] = useState(false);
  
  const handleGoogleCalendarSync = async () => {
    setIsSyncingCalendar(true);
    try {
      if (task.calendarEventId) {
        // Remove from calendar
        await fetch(`/api/tasks/${task.id}/calendar`, { method: 'DELETE' });
      } else {
        // Add to calendar
        await fetch(`/api/tasks/${task.id}/calendar`, { method: 'POST' });
      }
      // Refresh tasks to get updated calendar status
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    } catch (error) {
      console.error('Google Calendar sync error:', error);
    } finally {
      setIsSyncingCalendar(false);
    }
  };

  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [isSendingInvite, setIsSendingInvite] = useState(false);

  const handleSendInvite = async () => {
    const emails = inviteEmailInput.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    if (emails.length === 0) return;
    setIsSendingInvite(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails }),
      });
      if (res.ok) {
        setShowInviteInput(false);
        setInviteEmailInput('');
      }
    } catch (e) { console.error('[Invite] send error:', e); }
    setIsSendingInvite(false);
  };

  const hasAttachments = task.attachments && task.attachments.length > 0;

  const cardElement = (
    <Card
      className={`transition-all rounded-md shadow-sm border ${
        compact ? "h-[60px] flex flex-col" : "flex-1"
      } ${isMissed && !cardBgClass ? "border-destructive bg-destructive/5" : ""} ${
        task.isCompleted ? "opacity-60" : ""
      } ${overdueBlink ? "animate-urgent-blink" : ""} ${urgentBlink ? "animate-shimmer" : ""}`}
      style={{
        ...(overdueBlink && blinkSyncDelay ? { animationDelay: blinkSyncDelay } : {}),
        backgroundColor: cardBgClass ? undefined : (colors?.bg || undefined),
        borderColor: colors?.border || '#9ca3af'
      }}
      data-testid={`card-task-${task.id}`}
    >
      <CardHeader className={`flex flex-row items-start justify-between gap-1 space-y-0 ${compact ? "pb-0 pt-1.5 px-2 flex-shrink-0" : "pb-1 pt-3 px-3"}`}>
        <div className="flex items-start gap-1.5">
          <Checkbox
            checked={task.isCompleted || false}
            onCheckedChange={(checked) => onComplete(!!checked)}
            data-testid={`checkbox-task-${task.id}`}
            className={`${compact ? "h-3.5 w-3.5" : ""} border-black data-[state=checked]:bg-black data-[state=checked]:border-black`}
          />
          <div>
            <CardTitle className={`font-normal ${task.isCompleted ? "line-through" : ""} ${compact ? "text-[10px] leading-tight" : "text-xs"}`}>
              {task.title}
            </CardTitle>
            {task.courseName && (
              <p 
                className={`font-normal ${compact ? "text-[8px]" : "text-[10px]"}`}
                style={{ color: colors?.text || undefined }}
              >
                {compact ? (task.courseName.split(" - ")[1] || task.courseName) : task.courseName.split(" - ")[0]}
              </p>
            )}
          </div>
        </div>
        {!compact && (
          <Badge 
            className={colors ? "" : typeColors[task.type]}
            style={colors ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text } : undefined}
          >
            <Icon className="h-3 w-3 mr-1" />
            {task.type}
          </Badge>
        )}
      </CardHeader>
      <CardContent className={`space-y-1 ${compact ? "px-2 pb-1 pt-0 mt-auto" : "px-3 pb-3 pt-0"}`}>
        {!compact && task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        
        {compact ? (
          <div className="flex items-center">
            <Badge 
              className={`${colors ? "" : typeColors[task.type]} text-[8px] px-1.5 py-0.5`}
              style={colors ? { backgroundColor: colors.bg, borderColor: colors.border, color: colors.text } : undefined}
            >
              <Icon className="h-2.5 w-2.5 mr-0.5" />
              {task.type}
            </Badge>
            {hasAttachments && (
              <Paperclip className="h-3 w-3 ml-1.5 text-muted-foreground" data-testid={`icon-attachment-${task.id}`} />
            )}
            <div className="flex-1 flex items-center justify-end gap-1 text-black dark:text-white text-[10px]">
              <Clock className="h-2.5 w-2.5" />
              <span className="font-bold">DUE</span> {format(new Date(task.dueDate), "MMM d")}
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 text-muted-foreground text-[10px]">
              <Clock className="h-3 w-3" />
              {format(new Date(task.dueDate), "MMM d, h:mm a")}
            </div>

            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Bell className="h-3 w-3" />
              <span>Reminders: 12h, 6h, 2h, 30min before</span>
            </div>

            {task.referenceLink && (
              <div className="flex items-center gap-1 text-[10px]">
                <Link className="h-3 w-3 text-primary" />
                <a 
                  href={task.referenceLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-primary hover:underline truncate"
                  data-testid={`link-reference-${task.id}`}
                >
                  {task.referenceLink}
                </a>
              </div>
            )}

            {task.attachments && task.attachments.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Paperclip className="h-3 w-3" />
                  <span>{task.attachments.length} attachment{task.attachments.length > 1 ? "s" : ""}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {task.attachments.map((attachment, idx) => {
                    const attachmentName = attachment.split('/').pop() || attachment;
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <button
                          onClick={() => onFileClick?.(attachment)}
                          className="text-[10px] text-primary hover:underline truncate max-w-[150px] cursor-pointer"
                          data-testid={`link-attachment-${task.id}-${idx}`}
                        >
                          {attachmentName}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              {isMissed && (
                <Button size="sm" variant="destructive" onClick={onReschedule} data-testid={`button-reschedule-${task.id}`}>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Reschedule
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleExportCalendar} data-testid={`button-export-${task.id}`}>
                <Download className="h-3 w-3 mr-1" />
                .ics
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowInviteInput(!showInviteInput)}
                data-testid={`button-invite-${task.id}`}
              >
                <Mail className="h-3 w-3 mr-1" />
                Invite
              </Button>
              <Button 
                size="sm" 
                variant={task.calendarEventId ? "default" : "outline"}
                className={task.calendarEventId ? "bg-[#5979CC] hover:bg-[#4a68b3]" : ""}
                onClick={handleGoogleCalendarSync}
                disabled={isSyncingCalendar}
                data-testid={`button-gcal-${task.id}`}
              >
                {isSyncingCalendar ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <CalendarDays className="h-3 w-3 mr-1" />
                )}
                {task.calendarEventId ? "On Calendar" : "Google Cal"}
              </Button>
              <Button size="sm" variant="ghost" onClick={onEdit} data-testid={`button-edit-${task.id}`}>
                Edit
              </Button>
            </div>
            {showInviteInput && (
              <div className="flex items-center gap-2 mt-2" data-testid={`invite-input-${task.id}`}>
                <Input
                  placeholder="Email addresses (comma separated)"
                  value={inviteEmailInput}
                  onChange={(e) => setInviteEmailInput(e.target.value)}
                  className="flex-1 h-7 text-xs"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendInvite(); }}
                  data-testid={`input-invite-email-${task.id}`}
                />
                <Button
                  size="sm"
                  className="h-7 text-xs bg-blue-600 hover:bg-blue-700"
                  onClick={handleSendInvite}
                  disabled={isSendingInvite || !inviteEmailInput.trim()}
                  data-testid={`button-send-invite-${task.id}`}
                >
                  {isSendingInvite ? <Loader2 className="h-3 w-3 animate-spin" /> : <Share2 className="h-3 w-3 mr-1" />}
                  Send
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  // For compact mode with attachments, add media controls
  if (compact) {
    if (hasAttachments) {
      return (
        <div className="relative pt-1 h-full flex flex-col cursor-pointer pb-2" onClick={onEdit}>
          {/* Mini Media Controls for compact cards */}
          <div className="h-5 flex items-center justify-around rounded-md px-1 text-white border-[0.1px] border-white no-blink mb-1" style={{ background: colorSettings?.headerBar || '#607d9d' }}>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handlePlayTTS(); }}
              data-testid={`button-play-${task.id}`}
              title="Play"
            >
              {isSendingTTS ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3 fill-current" />
              )}
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleStop(); }}
              data-testid={`button-stop-${task.id}`}
              title="Stop"
            >
              <Square className="h-3 w-3 fill-current" />
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleResume(); }}
              data-testid={`button-resume-${task.id}`}
              title="Resume"
            >
              <RefreshCw className="h-3 w-3" />
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleVolume("down"); }}
              data-testid={`button-voldown-${task.id}`}
              title="Volume Down"
            >
              <MinusCircle className="h-3 w-3" />
            </div>
            <div
              className="cursor-pointer hover:opacity-70"
              onClick={(e) => { e.stopPropagation(); handleVolume("up"); }}
              data-testid={`button-volup-${task.id}`}
              title="Volume Up"
            >
              <PlusCircle className="h-3 w-3" />
            </div>
          </div>
          {cardElement}
        </div>
      );
    }
    // Compact without attachments - add pt-1 to align with cards that have media controls
    return (
      <div className="pt-1 cursor-pointer" onClick={onEdit}>
        {cardElement}
      </div>
    );
  }

  if (hasAttachments) {
    return (
      <div className="relative pt-1 h-full flex flex-col">
        {/* Media Controls - positioned absolutely at top, half height */}
        <div className="absolute -top-5 left-0 right-0 h-5 flex items-center justify-around rounded-md px-1 bg-[#5979CC] text-white border-[0.1px] border-white">
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={handlePlayTTS}
            data-testid={`button-play-${task.id}`}
            title="Play"
          >
            {isSendingTTS ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Play className="h-3.5 w-3.5 fill-current" />
            )}
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={handleStop}
            data-testid={`button-stop-${task.id}`}
            title="Stop"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={handleResume}
            data-testid={`button-resume-${task.id}`}
            title="Resume"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={() => handleVolume("down")}
            data-testid={`button-voldown-${task.id}`}
            title="Volume Down"
          >
            <MinusCircle className="h-3.5 w-3.5" />
          </div>
          <div
            className="cursor-pointer hover:opacity-70"
            onClick={() => handleVolume("up")}
            data-testid={`button-volup-${task.id}`}
            title="Volume Up"
          >
            <PlusCircle className="h-3.5 w-3.5" />
          </div>
        </div>
        {cardElement}
      </div>
    );
  }

  // For cards without attachments, add padding to align with cards that have media controls
  return (
    <div className="pt-5 h-full flex flex-col">
      {cardElement}
    </div>
  );
}

interface FileRecord {
  id: number;
  originalName: string;
  displayName: string;
  objectPath: string;
  contentType: string;
  size: number;
  folder: string | null;
}

