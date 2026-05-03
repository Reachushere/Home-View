import { useEffect, useState } from "react";
import { DevPanel } from "@/components/DevPanel";

export default function DevPlainPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const port = window.location.port;
      const host = window.location.hostname;
      const isLanPort = port === "5747";
      const isLocalhost = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0";
      setAllowed(isLanPort || (isLocalhost && (port === "5747" || port === "")));
    } catch {
      setAllowed(false);
    }
  }, []);

  if (allowed === null) return null;

  if (!allowed) {
    return (
      <div data-testid="dev-plain-blocked" style={{
        minHeight: "100vh", background: "#0f0f14", color: "#e8e8ec",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", padding: 24, textAlign: "center",
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>404 — Not Found</div>
          <div style={{ fontSize: 12, color: "#888" }}>This page is only available on the local network (port 5747).</div>
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
