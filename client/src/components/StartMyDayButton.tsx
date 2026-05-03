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
        bottom: 50,
        left: 50,
        zIndex: 2147483646,
        background: "linear-gradient(135deg, #f59e0b, #f97316)",
        color: "#fff",
        border: "2px solid rgba(255,255,255,0.25)",
        padding: "7px 11px",
        borderRadius: 999,
        fontWeight: 800,
        fontSize: 8,
        cursor: "pointer",
        boxShadow: "0 5px 15px rgba(249,115,22,0.55), 0 2px 5px rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: 0.2,
        textTransform: "uppercase" as const,
      }}
    >
      <Sun className="h-2.5 w-2.5" />
      Start My Day
    </button>
  );
}
