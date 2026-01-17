import { Device, UpdateDeviceRequest } from "@shared/schema";
import { 
  Lightbulb, 
  Power, 
  Thermometer, 
  Activity, 
  Fan, 
  Tv, 
  Wifi, 
  Lock,
  MoreVertical,
  Trash2
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface DeviceCardProps {
  device: Device;
  onUpdate: (updates: UpdateDeviceRequest) => void;
  onDelete: (id: number) => void;
}

const iconMap: Record<string, any> = {
  lightbulb: Lightbulb,
  power: Power,
  thermometer: Thermometer,
  activity: Activity,
  fan: Fan,
  tv: Tv,
  wifi: Wifi,
  lock: Lock,
};

export function DeviceCard({ device, onUpdate, onDelete }: DeviceCardProps) {
  const Icon = iconMap[device.icon] || Activity;
  const isClimate = device.type === 'climate';
  const isSensor = device.type === 'sensor';
  const isActive = device.isOn;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative p-5 rounded-2xl border transition-all duration-300 group",
        "flex flex-col gap-4 overflow-hidden",
        isActive 
          ? "bg-primary/10 border-primary/40 shadow-lg shadow-primary/10" 
          : "bg-card border-white/5 hover:border-white/10"
      )}
    >
      {/* Header */}
      <div className="flex justify-between items-start z-10">
        <div className={cn(
          "p-3 rounded-xl transition-colors duration-300",
          isActive ? "bg-primary text-white" : "bg-secondary text-muted-foreground"
        )}>
          <Icon className="w-6 h-6" />
        </div>
        
        <div className="flex gap-2">
          {/* Main Toggle Switch (visible if not a sensor) */}
          {!isSensor && (
            <button
              onClick={() => onUpdate({ isOn: !device.isOn })}
              className={cn(
                "w-10 h-6 rounded-full relative transition-colors duration-300 flex items-center px-0.5",
                isActive ? "bg-primary" : "bg-muted"
              )}
            >
              <motion.div 
                animate={{ x: isActive ? 16 : 0 }}
                className="w-5 h-5 bg-white rounded-full shadow-sm"
              />
            </button>
          )}

          {/* Context Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-muted-foreground hover:text-white p-1 rounded-md hover:bg-white/10 transition-colors">
                <MoreVertical className="w-5 h-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card border-white/10 text-foreground">
              <DropdownMenuItem 
                onClick={() => onDelete(device.id)}
                className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Remove Device
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Info */}
      <div className="z-10">
        <h3 className="text-lg font-bold font-display truncate">{device.name}</h3>
        <p className="text-sm text-muted-foreground">{device.room}</p>
      </div>

      {/* Controls / Status */}
      <div className="mt-auto z-10 min-h-[2rem] flex items-end">
        {device.type === 'light' && isActive && (
          <div className="w-full">
            <div className="flex justify-between text-xs mb-2 text-muted-foreground">
              <span>Brightness</span>
              <span>{device.value}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={device.value || 0}
              onChange={(e) => onUpdate({ value: parseInt(e.target.value) })}
              className="w-full h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        )}

        {isClimate && (
          <div className="flex items-center justify-between w-full">
            <div className="text-2xl font-bold font-display">
              {device.value}{device.unit || '°C'}
            </div>
            {isActive && (
               <div className="flex gap-2">
                 <button 
                    onClick={() => onUpdate({ value: (device.value || 20) - 1 })}
                    className="p-1 rounded bg-secondary hover:bg-secondary/80 text-foreground"
                 >
                   -
                 </button>
                 <button 
                    onClick={() => onUpdate({ value: (device.value || 20) + 1 })}
                    className="p-1 rounded bg-secondary hover:bg-secondary/80 text-foreground"
                 >
                   +
                 </button>
               </div>
            )}
          </div>
        )}

        {isSensor && (
          <div className="text-2xl font-bold text-accent font-display">
            {device.value}{device.unit}
          </div>
        )}
      </div>

      {/* Glow Effect Background */}
      {isActive && (
        <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-primary/20 blur-[60px] rounded-full pointer-events-none" />
      )}
    </motion.div>
  );
}
