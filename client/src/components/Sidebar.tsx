import { cn } from "@/lib/utils";
import { LayoutDashboard, Armchair, Utensils, BedDouble, Briefcase, DoorOpen } from "lucide-react";

interface SidebarProps {
  selectedRoom: string | null;
  onSelectRoom: (room: string | null) => void;
  className?: string;
}

const roomIcons: Record<string, any> = {
  "Living Room": Armchair,
  "Kitchen": Utensils,
  "Bedroom": BedDouble,
  "Office": Briefcase,
  "Entrance": DoorOpen,
};

export function Sidebar({ selectedRoom, onSelectRoom, className }: SidebarProps) {
  const rooms = ["Living Room", "Kitchen", "Bedroom", "Office", "Entrance"];

  return (
    <div className={cn("bg-card/50 backdrop-blur-xl border-r border-white/5 h-screen p-6 flex flex-col gap-8", className)}>
      <div className="flex items-center gap-3 px-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
          <LayoutDashboard className="text-white w-5 h-5" />
        </div>
        <span className="font-display font-bold text-xl tracking-tight">HomeOS</span>
      </div>

      <nav className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">Rooms</p>
        
        <button
          onClick={() => onSelectRoom(null)}
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
            selectedRoom === null 
              ? "bg-primary text-white shadow-lg shadow-primary/20" 
              : "text-muted-foreground hover:bg-white/5 hover:text-white"
          )}
        >
          <LayoutDashboard className="w-4 h-4" />
          All Devices
        </button>

        {rooms.map((room) => {
          const Icon = roomIcons[room] || LayoutDashboard;
          return (
            <button
              key={room}
              onClick={() => onSelectRoom(room)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                selectedRoom === room
                  ? "bg-primary text-white shadow-lg shadow-primary/20" 
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {room}
            </button>
          );
        })}
      </nav>

      <div className="mt-auto">
        <div className="p-4 rounded-2xl bg-gradient-to-br from-card to-secondary border border-white/5">
          <p className="text-xs text-muted-foreground mb-2">System Status</p>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-white">Online</span>
          </div>
          <p className="text-xs text-muted-foreground">Firmware v2.4.0</p>
        </div>
      </div>
    </div>
  );
}
