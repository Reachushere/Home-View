import { useLocation } from "wouter";
import { Sun } from "lucide-react";

export default function StartMyDayButton() {
  const [location, navigate] = useLocation();
  if (location !== "/") return null;
  return (
    <button
      onClick={() => navigate("/start-my-day")}
      data-testid="button-start-my-day"
      title="Start My Day — pick up where you left off"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        zIndex: 9998,
        background: "linear-gradient(135deg, #f59e0b, #f97316)",
        color: "#fff",
        border: 0,
        padding: "12px 18px",
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 13,
        cursor: "pointer",
        boxShadow: "0 8px 24px rgba(249,115,22,0.4), 0 2px 6px rgba(0,0,0,0.3)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        fontFamily: "system-ui, -apple-system, sans-serif",
        letterSpacing: 0.3,
      }}
    >
      <Sun className="h-4 w-4" />
      Start My Day
    </button>
  );
}
