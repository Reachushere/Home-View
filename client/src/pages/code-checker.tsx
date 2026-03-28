import { useState } from "react";
import { useLocation } from "wouter";

const LANGUAGES = [
  "JavaScript", "TypeScript", "Python", "HTML", "CSS", "Java", "C", "C++", "C#", "Go", "Rust", "PHP", "Ruby", "SQL", "Bash", "Other"
];

export default function CodeCheckerPage() {
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("JavaScript");
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [, setLocation] = useLocation();

  const checkCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setResult(null);
    setEmailSent(false);
    try {
      const res = await fetch("/api/code-checker/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data.analysis);
    } catch (err: any) {
      setResult("Error: " + (err.message || "Failed to analyze code"));
    } finally {
      setLoading(false);
    }
  };

  const emailResults = async () => {
    if (!result) return;
    setEmailing(true);
    try {
      const res = await fetch("/api/code-checker/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, language, analysis: result }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setEmailSent(true);
    } catch (err: any) {
      alert("Failed to send email: " + (err.message || "Unknown error"));
    } finally {
      setEmailing(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)", color: "#e2e8f0", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "30px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <h1 style={{ fontSize: "24px", fontWeight: 700, color: "#f8fafc" }} data-testid="text-page-title">
            Code Checker
          </h1>
          <button
            onClick={() => setLocation("/")}
            style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "8px", padding: "6px 14px", color: "#94a3b8", cursor: "pointer", fontSize: "13px" }}
            data-testid="button-back-dashboard"
          >
            Back to Dashboard
          </button>
        </div>

        <div style={{ display: "flex", gap: "12px", marginBottom: "16px", alignItems: "center" }}>
          <label style={{ fontSize: "13px", color: "#94a3b8" }}>Language:</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            style={{ background: "#1e293b", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", padding: "6px 10px", color: "#e2e8f0", fontSize: "13px" }}
            data-testid="select-language"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>

        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Paste your code here..."
          style={{
            width: "100%",
            minHeight: "280px",
            background: "#0f172a",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "10px",
            padding: "16px",
            color: "#e2e8f0",
            fontFamily: "'Fira Code', 'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
            fontSize: "13px",
            lineHeight: "1.6",
            resize: "vertical",
            outline: "none",
          }}
          data-testid="input-code"
        />

        <div style={{ display: "flex", gap: "12px", marginTop: "16px" }}>
          <button
            onClick={checkCode}
            disabled={loading || !code.trim()}
            style={{
              background: loading ? "#334155" : "linear-gradient(135deg, #3b82f6, #2563eb)",
              border: "none",
              borderRadius: "8px",
              padding: "10px 24px",
              color: "#fff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading || !code.trim() ? "not-allowed" : "pointer",
              opacity: loading || !code.trim() ? 0.6 : 1,
            }}
            data-testid="button-check-code"
          >
            {loading ? "Analyzing..." : "Check for Errors"}
          </button>

          {result && (
            <button
              onClick={emailResults}
              disabled={emailing}
              style={{
                background: emailSent ? "#16a34a" : emailing ? "#334155" : "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                border: "none",
                borderRadius: "8px",
                padding: "10px 24px",
                color: "#fff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: emailing ? "not-allowed" : "pointer",
                opacity: emailing ? 0.6 : 1,
              }}
              data-testid="button-email-results"
            >
              {emailSent ? "Sent!" : emailing ? "Sending..." : "Email Results to Me"}
            </button>
          )}
        </div>

        {result && (
          <div
            style={{
              marginTop: "24px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "10px",
              padding: "20px",
            }}
            data-testid="text-analysis-result"
          >
            <h2 style={{ fontSize: "16px", fontWeight: 600, color: "#f8fafc", marginBottom: "12px" }}>Analysis</h2>
            <pre style={{
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
              fontFamily: "ui-sans-serif, system-ui, sans-serif",
              fontSize: "13px",
              lineHeight: "1.7",
              color: "#cbd5e1",
            }}>
              {result}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
