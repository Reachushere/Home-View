import { useEffect, useMemo, useState } from "react";
import { X, GraduationCap, CalendarClock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Semester {
  id: number;
  semesterName: string;
  semesterStartDate: string | null;
  semesterEndDate: string | null;
  isActive: boolean | null;
}

function torontoYMD(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
}

function torontoMinutesOfDay(d: Date): number {
  const parts = d.toLocaleString("en-US", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const m = parts.match(/(\d{1,2}):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

function ymdFromIso(iso: string | null): string {
  if (!iso) return "";
  return torontoYMD(new Date(iso));
}

function saturdayBefore(date: Date): Date {
  const dow = date.getDay();
  const daysBack = dow === 6 ? 7 : dow + 1;
  const sat = new Date(date);
  sat.setDate(sat.getDate() - daysBack);
  return sat;
}

function ymdToInput(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function SemesterEndPopup() {
  const { toast } = useToast();
  const [, setTick] = useState(0);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => {
    const raw = localStorage.getItem("semesterEndDismissed");
    if (!raw) return new Set();
    try { return new Set(JSON.parse(raw) as string[]); } catch { return new Set(); }
  });
  const [mode, setMode] = useState<"choose" | "extend" | "submitting">("choose");
  const [extendDate, setExtendDate] = useState<string>("");
  const [extendTime, setExtendTime] = useState<string>("23:59");

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const { data: semesters = [] } = useQuery<Semester[]>({
    queryKey: ["/api/semesters"],
    refetchInterval: 5 * 60_000,
  });

  const target = useMemo(() => {
    if (!semesters.length) return null;
    const now = new Date();
    const todayYMD = torontoYMD(now);
    const minsNow = torontoMinutesOfDay(now);
    const triggerMins = 23 * 60 + 59;
    let candidate: Semester | null = null;
    for (const s of semesters) {
      if (!s.semesterEndDate) continue;
      const endYMD = ymdFromIso(s.semesterEndDate);
      if (endYMD < todayYMD) continue;
      if (endYMD === todayYMD && minsNow < triggerMins) continue;
      const dismissKey = `${s.id}:${endYMD}`;
      if (dismissedKeys.has(dismissKey)) continue;
      candidate = s;
      break;
    }
    return candidate;
  }, [semesters, dismissedKeys]);

  const nextSemester = useMemo(() => {
    if (!target || !target.semesterEndDate) return null;
    const endTime = new Date(target.semesterEndDate).getTime();
    let best: Semester | null = null;
    let bestStart = Infinity;
    for (const s of semesters) {
      if (s.id === target.id || !s.semesterStartDate) continue;
      const st = new Date(s.semesterStartDate).getTime();
      if (st > endTime && st < bestStart) {
        best = s;
        bestStart = st;
      }
    }
    return best;
  }, [semesters, target]);

  const maxExtendDate = useMemo(() => {
    if (!nextSemester || !nextSemester.semesterStartDate) return null;
    return saturdayBefore(new Date(nextSemester.semesterStartDate));
  }, [nextSemester]);

  const minExtendDate = useMemo(() => {
    if (!target || !target.semesterEndDate) return new Date();
    const d = new Date(target.semesterEndDate);
    d.setDate(d.getDate() + 1);
    return d;
  }, [target]);

  useEffect(() => {
    if (target && !extendDate) {
      const initial = maxExtendDate ?? minExtendDate;
      setExtendDate(ymdToInput(initial));
    }
  }, [target, maxExtendDate, minExtendDate, extendDate]);

  if (!target) return null;

  const dismissKey = `${target.id}:${ymdFromIso(target.semesterEndDate)}`;
  const persistDismiss = () => {
    const next = new Set(dismissedKeys);
    next.add(dismissKey);
    setDismissedKeys(next);
    localStorage.setItem("semesterEndDismissed", JSON.stringify(Array.from(next)));
  };

  const handleClose = async () => {
    setMode("submitting");
    try {
      await apiRequest("PATCH", `/api/semester-settings/${target.id}`, { isActive: false });
      queryClient.invalidateQueries({ queryKey: ["/api/semesters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/semester"] });
      toast({ title: "Semester closed", description: `${target.semesterName} marked inactive.` });
      persistDismiss();
    } catch (err: any) {
      toast({ title: "Could not close semester", description: err?.message || "Try again", variant: "destructive" });
      setMode("choose");
    }
  };

  const handleExtend = async () => {
    if (!extendDate) return;
    const newEndIso = new Date(`${extendDate}T${extendTime || "23:59"}:00`).toISOString();
    if (maxExtendDate) {
      const cap = new Date(maxExtendDate);
      cap.setHours(23, 59, 59, 999);
      if (new Date(newEndIso).getTime() > cap.getTime()) {
        toast({
          title: "Date too far",
          description: `Latest allowed is Saturday ${ymdToInput(maxExtendDate)} (the Saturday before ${nextSemester?.semesterName || "the next semester"}).`,
          variant: "destructive",
        });
        return;
      }
    }
    setMode("submitting");
    try {
      await apiRequest("PATCH", `/api/semester-settings/${target.id}`, { semesterEndDate: newEndIso });
      queryClient.invalidateQueries({ queryKey: ["/api/semesters"] });
      queryClient.invalidateQueries({ queryKey: ["/api/semester"] });
      toast({ title: "Semester extended", description: `New end: ${extendDate} at ${extendTime}` });
      persistDismiss();
    } catch (err: any) {
      toast({ title: "Could not extend semester", description: err?.message || "Try again", variant: "destructive" });
      setMode("extend");
    }
  };

  const handleSnooze = () => {
    persistDismiss();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 11000,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
      }}
      data-testid="modal-semester-end"
    >
      <div
        style={{
          background: "linear-gradient(160deg, #1e1b4b 0%, #2e1065 100%)",
          color: "#fff",
          borderRadius: "20px",
          padding: "28px 28px 24px",
          maxWidth: "480px", width: "100%",
          border: "1px solid rgba(170,120,240,0.5)",
          boxShadow: "0 20px 60px rgba(124,58,237,0.4)",
          position: "relative",
        }}
      >
        <button
          onClick={handleSnooze}
          style={{
            position: "absolute", top: "14px", right: "14px",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "8px", padding: "4px",
            color: "rgba(255,255,255,0.7)", cursor: "pointer",
          }}
          aria-label="Dismiss"
          data-testid="button-semester-end-dismiss"
        >
          <X size={16} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
          <div style={{
            width: "44px", height: "44px", borderRadius: "12px",
            background: "rgba(170,120,240,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <GraduationCap size={24} color="#c4b5fd" />
          </div>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 700 }} data-testid="text-semester-end-title">
              {target.semesterName} is over
            </div>
            <div style={{ fontSize: "13px", color: "rgba(220,210,255,0.8)", marginTop: "2px" }}>
              Final day was {ymdFromIso(target.semesterEndDate)}
            </div>
          </div>
        </div>

        {mode === "choose" && (
          <>
            <p style={{ fontSize: "14px", lineHeight: 1.5, color: "rgba(230,225,255,0.9)", margin: "0 0 18px" }}>
              Close this semester to archive it, or extend the end date if you still need more time.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={handleClose}
                style={{
                  background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                  color: "#fff", border: "none", borderRadius: "12px",
                  padding: "14px 16px", fontSize: "15px", fontWeight: 600,
                  cursor: "pointer", boxShadow: "0 6px 20px rgba(124,58,237,0.4)",
                }}
                data-testid="button-semester-end-close"
              >
                Close semester
              </button>
              <button
                onClick={() => setMode("extend")}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  color: "#fff", border: "1px solid rgba(170,120,240,0.5)",
                  borderRadius: "12px", padding: "14px 16px",
                  fontSize: "15px", fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                }}
                data-testid="button-semester-end-extend"
              >
                <CalendarClock size={18} /> Extend semester
              </button>
              <button
                onClick={handleSnooze}
                style={{
                  background: "transparent", color: "rgba(220,210,255,0.6)",
                  border: "none", padding: "8px", fontSize: "12px", cursor: "pointer",
                }}
                data-testid="button-semester-end-later"
              >
                Decide later
              </button>
            </div>
          </>
        )}

        {mode === "extend" && (
          <>
            <p style={{ fontSize: "13px", color: "rgba(220,210,255,0.85)", margin: "0 0 14px" }}>
              Extend until at most{" "}
              <strong>
                {maxExtendDate ? ymdToInput(maxExtendDate) : "no limit set"}
              </strong>
              {nextSemester && maxExtendDate && (
                <> (the Saturday before {nextSemester.semesterName} starts).</>
              )}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "10px", marginBottom: "16px" }}>
              <div>
                <label style={{ fontSize: "11px", color: "rgba(220,210,255,0.7)", display: "block", marginBottom: "4px" }}>
                  New end date
                </label>
                <input
                  type="date"
                  value={extendDate}
                  min={ymdToInput(minExtendDate)}
                  max={maxExtendDate ? ymdToInput(maxExtendDate) : undefined}
                  onChange={(e) => setExtendDate(e.target.value)}
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px",
                    border: "1px solid rgba(170,120,240,0.4)",
                    background: "rgba(255,255,255,0.08)", color: "#fff",
                    fontSize: "14px",
                  }}
                  data-testid="input-semester-end-date"
                />
              </div>
              <div>
                <label style={{ fontSize: "11px", color: "rgba(220,210,255,0.7)", display: "block", marginBottom: "4px" }}>
                  Time
                </label>
                <input
                  type="time"
                  value={extendTime}
                  onChange={(e) => setExtendTime(e.target.value)}
                  style={{
                    width: "100%", padding: "10px", borderRadius: "8px",
                    border: "1px solid rgba(170,120,240,0.4)",
                    background: "rgba(255,255,255,0.08)", color: "#fff",
                    fontSize: "14px",
                  }}
                  data-testid="input-semester-end-time"
                />
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setMode("choose")}
                style={{
                  flex: "0 0 auto", background: "rgba(255,255,255,0.06)",
                  color: "#fff", border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: "10px", padding: "12px 16px",
                  fontSize: "14px", cursor: "pointer",
                }}
                data-testid="button-semester-end-back"
              >
                Back
              </button>
              <button
                onClick={handleExtend}
                disabled={!extendDate}
                style={{
                  flex: 1, background: "linear-gradient(135deg, #8b5cf6, #6d28d9)",
                  color: "#fff", border: "none", borderRadius: "10px",
                  padding: "12px 16px", fontSize: "14px", fontWeight: 600,
                  cursor: extendDate ? "pointer" : "not-allowed",
                  opacity: extendDate ? 1 : 0.5,
                }}
                data-testid="button-semester-end-extend-confirm"
              >
                Save new end date
              </button>
            </div>
          </>
        )}

        {mode === "submitting" && (
          <div style={{ padding: "20px 0", textAlign: "center", color: "rgba(220,210,255,0.8)" }}>
            Saving…
          </div>
        )}
      </div>
    </div>
  );
}
