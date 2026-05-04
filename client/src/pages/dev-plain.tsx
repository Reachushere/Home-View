import { useEffect, useState } from "react";
import { DevPanel } from "@/components/DevPanel";

export default function DevPlainPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const authParam = params.get("auth");
        const url = authParam
          ? `/api/auth/check?auth=${encodeURIComponent(authParam)}`
          : "/api/auth/check";
        const r = await fetch(url, { credentials: "include" });
        const j = await r.json().catch(() => ({}));
        const level = j?.level || j?.authLevel || "";
        if (!cancelled) setAllowed(level === "5747");
      } catch {
        if (!cancelled) setAllowed(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (allowed === null) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0f0f14", color: "#888",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12,
      }}>checking access…</div>
    );
  }

  if (!allowed) {
    return (
      <div data-testid="dev-plain-blocked" style={{
        minHeight: "100vh", background: "#0f0f14", color: "#e8e8ec",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: 24, textAlign: "center",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>404 — Not Found</div>
          <div style={{ fontSize: 12, color: "#888" }}>This page is admin-only (level 5747).</div>
        </div>
      </div>
    );
  }

  return (
    <div data-testid="dev-plain-page" style={{ minHeight: "100vh", background: "#0f0f14" }}>
      <DevPanel plainMode />
    </div>
  );
}
