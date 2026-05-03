import { useLocation } from "wouter";
import { Sun } from "lucide-react";

export default function StartMyDayButton() {
  const [location] = useLocation();
  if (location !== "/" && location !== "") return null;
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.location.href = "/start-my-day";
      }}
      data-testid="button-start-my-day"
      title="Start My Day — pick up where you left off"
      style={{
        position: "fixed",
        bottom: 20,
        left: 20,
        zIndex: 2147483646,
        background: "linear-gradient(135deg, #f59e0b, #f97316)",
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.25)",
        padding: "14px 22px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 15,
        cursor: "pointer",
        boxShadow: "0 10px 30px rgba(249,115,22,0.55), 0 4px 10px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: 0.4,
        textTransform: "uppercase" as const,
      }}
    >
      <Sun className="h-5 w-5" />
      Start My Day
    </button>
  );
}
