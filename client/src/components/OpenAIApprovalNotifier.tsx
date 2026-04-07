import { useState, useEffect, useCallback } from "react";
import { AlertTriangle, Check, X, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PendingApproval {
  id: string;
  feature: string;
  detail: string;
  estimatedCost: string;
  createdAt: number;
  status: "pending" | "approved" | "denied";
}

function isTablet(): boolean {
  const ua = navigator.userAgent.toLowerCase();
  const isIPad = /ipad/.test(ua) || (/macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isAndroidTablet = /android/.test(ua) && !/mobile/.test(ua);
  const isFireTablet = /silk/.test(ua);
  const screenMin = Math.min(window.innerWidth, window.innerHeight);
  const screenMax = Math.max(window.innerWidth, window.innerHeight);
  const isTabletSize = screenMin >= 600 && screenMax >= 900;
  return isIPad || isAndroidTablet || isFireTablet || (isTabletSize && 'ontouchstart' in window && !(/mobile/.test(ua)));
}

export default function OpenAIApprovalNotifier() {
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [hidden, setHidden] = useState(false);
  const [isTabletDevice, setIsTabletDevice] = useState(false);

  useEffect(() => {
    setIsTabletDevice(isTablet());
  }, []);

  useEffect(() => {
    if (isTabletDevice) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    function connect() {
      eventSource = new EventSource("/api/openai-approval/stream");

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "approval" && data.data?.status === "pending") {
            setApprovals((prev) => {
              if (prev.find((a) => a.id === data.data.id)) return prev;
              return [...prev, data.data];
            });
            setHidden(false);

            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("UniCal: OpenAI Charge Approval", {
                body: `${data.data.feature}: ${data.data.detail}\nEst. cost: ${data.data.estimatedCost}`,
                icon: "/favicon.ico",
                tag: data.data.id,
                requireInteraction: true,
              });
            }

            if ("vibrate" in navigator) {
              navigator.vibrate([200, 100, 200]);
            }
          }
        } catch {}
      };

      eventSource.onerror = () => {
        eventSource?.close();
        reconnectTimer = setTimeout(connect, 5000);
      };
    }

    connect();

    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimer);
    };
  }, [isTabletDevice]);

  const respond = useCallback(async (id: string, approved: boolean) => {
    try {
      await fetch(`/api/openai-approval/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approved }),
      });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to respond to approval:", err);
    }
  }, []);

  if (isTabletDevice || hidden || approvals.length === 0) return null;

  return (
    <div
      data-testid="openai-approval-overlay"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="mx-4 w-full max-w-md space-y-3">
        {approvals.map((approval) => (
          <div
            key={approval.id}
            data-testid={`approval-card-${approval.id}`}
            className="rounded-xl border-2 border-amber-500 bg-white p-5 shadow-2xl dark:bg-zinc-900"
          >
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                <DollarSign className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                  Personal OpenAI Charge
                </h3>
                <p className="text-xs text-zinc-500">Approval required</p>
              </div>
            </div>

            <div className="mb-4 space-y-1.5 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
                <span className="font-medium text-zinc-800 dark:text-zinc-200">
                  {approval.feature}
                </span>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{approval.detail}</p>
              <p className="text-sm font-medium text-amber-600">
                Estimated cost: {approval.estimatedCost}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                data-testid={`deny-approval-${approval.id}`}
                variant="outline"
                className="flex-1 border-red-200 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                onClick={() => respond(approval.id, false)}
              >
                <X className="mr-1.5 h-4 w-4" />
                Deny
              </Button>
              <Button
                data-testid={`approve-approval-${approval.id}`}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
                onClick={() => respond(approval.id, true)}
              >
                <Check className="mr-1.5 h-4 w-4" />
                Approve
              </Button>
            </div>

            <p className="mt-2 text-center text-xs text-zinc-400">
              Auto-denied in 5 min if no response
            </p>
          </div>
        ))}

        {approvals.length > 1 && (
          <Button
            data-testid="deny-all-approvals"
            variant="outline"
            className="w-full border-red-200 text-red-600"
            onClick={() => approvals.forEach((a) => respond(a.id, false))}
          >
            Deny All ({approvals.length})
          </Button>
        )}
      </div>
    </div>
  );
}
