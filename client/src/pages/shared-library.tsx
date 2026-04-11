import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import LibraryView from "@/components/LibraryView";

interface Props {
  params: { token: string };
}

export default function SharedLibraryPage({ params }: Props) {
  const token = params.token;
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState("");
  const [semesterKey, setSemesterKey] = useState<string | undefined>();

  useEffect(() => {
    fetch(`/api/shared-library/validate/${token}`)
      .then(r => {
        if (!r.ok) throw new Error("Invalid or expired link");
        return r.json();
      })
      .then(data => {
        setValidated(true);
        if (data.semesterKey) setSemesterKey(data.semesterKey);
      })
      .catch(err => setError(err.message || "This share link is no longer valid"));
  }, [token]);

  const { data: semesterSettings = [] } = useQuery<any[]>({
    queryKey: ["/api/semesters"],
    enabled: validated,
  });

  const semesters = useMemo(() => {
    if (semesterSettings.length === 0) return [];
    return semesterSettings.map((s: any) => {
      const st = s.semesterType || "";
      const name = s.semesterName || "";
      const yearMatch = name.match(/\d{4}/);
      const year = yearMatch ? yearMatch[0] : "";
      const key = st.startsWith("spring_summer") ? `ss${year}` : st === "fall" ? `f${year}` : st === "winter" ? `w${year}` : `s${s.id}`;
      const courses: { code: string; name: string; color: string }[] = [];
      for (let i = 1; i <= 3; i++) {
        const code = s[`course${i}Code`] || "";
        if (code) {
          courses.push({
            code,
            name: s[`course${i}Name`] || "",
            color: s[`course${i}Color`] || "#3b82f6",
          });
        }
      }
      return { key, label: name, courses };
    });
  }, [semesterSettings]);

  if (error) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "linear-gradient(180deg, #1a0e07 0%, #0d0805 30%, #000 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "12px",
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "48px" }}>📚</div>
        <div style={{ color: "#fff", fontSize: "18px", fontWeight: 600 }}>{error}</div>
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
          The owner may have revoked this link.
        </div>
      </div>
    );
  }

  if (!validated || semesters.length === 0) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        background: "linear-gradient(180deg, #1a0e07 0%, #0d0805 30%, #000 100%)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px" }}>Loading library...</div>
      </div>
    );
  }

  return (
    <LibraryView
      isOpen={true}
      onClose={() => window.close()}
      semesters={semesters}
      initialSemesterKey={semesterKey}
      isSharedView
    />
  );
}
