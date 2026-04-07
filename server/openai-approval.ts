import { EventEmitter } from "events";

interface PendingApproval {
  id: string;
  feature: string;
  detail: string;
  estimatedCost: string;
  createdAt: number;
  status: "pending" | "approved" | "denied";
  resolvedAt?: number;
}

const approvals = new Map<string, PendingApproval>();
const emitter = new EventEmitter();
emitter.setMaxListeners(50);

let approvalCounter = 0;

export function hasReplitOpenAI(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_API_KEY && process.env.AI_INTEGRATIONS_OPENAI_BASE_URL);
}

export function hasPersonalOpenAI(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

export function getReplitOpenAIConfig(): { apiKey: string; baseURL: string } | null {
  if (hasReplitOpenAI()) {
    return {
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY!,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL!,
    };
  }
  return null;
}

export async function getApprovedOpenAIConfig(
  feature: string,
  detail: string,
  estimatedCost: string = "~$0.01-0.05"
): Promise<{ apiKey: string; baseURL?: string } | null> {
  const replitConfig = getReplitOpenAIConfig();
  if (replitConfig) return replitConfig;

  if (!hasPersonalOpenAI()) return null;

  const id = `approval-${++approvalCounter}-${Date.now()}`;
  const approval: PendingApproval = {
    id,
    feature,
    detail,
    estimatedCost,
    createdAt: Date.now(),
    status: "pending",
  };
  approvals.set(id, approval);
  emitter.emit("new-approval", approval);
  console.log(`[OpenAI Approval] Requesting approval: ${feature} — ${detail} (est. ${estimatedCost})`);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (approval.status === "pending") {
        approval.status = "denied";
        approval.resolvedAt = Date.now();
        console.log(`[OpenAI Approval] Auto-denied (timeout): ${feature}`);
        resolve(null);
      }
    }, 5 * 60 * 1000);

    const checkResolved = () => {
      if (approval.status === "approved") {
        clearTimeout(timeout);
        resolve({ apiKey: process.env.OPENAI_API_KEY! });
      } else if (approval.status === "denied") {
        clearTimeout(timeout);
        resolve(null);
      }
    };

    emitter.on(`resolved-${id}`, () => {
      checkResolved();
    });
  });
}

export function resolveApproval(id: string, approved: boolean): boolean {
  const approval = approvals.get(id);
  if (!approval || approval.status !== "pending") return false;

  approval.status = approved ? "approved" : "denied";
  approval.resolvedAt = Date.now();
  console.log(`[OpenAI Approval] ${approved ? "APPROVED" : "DENIED"}: ${approval.feature}`);
  emitter.emit(`resolved-${id}`);
  return true;
}

export function getPendingApprovals(): PendingApproval[] {
  return Array.from(approvals.values()).filter((a) => a.status === "pending");
}

export function getRecentApprovals(limit = 20): PendingApproval[] {
  return Array.from(approvals.values())
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
}

export function subscribeToApprovals(callback: (approval: PendingApproval) => void): () => void {
  emitter.on("new-approval", callback);
  return () => emitter.off("new-approval", callback);
}
