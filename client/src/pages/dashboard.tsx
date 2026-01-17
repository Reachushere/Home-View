import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch as ToggleSwitch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  Plug,
  Thermometer,
  ThermometerSun,
  Lamp,
  DoorClosed,
  Activity,
  Home,
  ChefHat,
  Bed,
  Briefcase,
  DoorOpen,
} from "lucide-react";
import type { Device } from "@shared/schema";
import { ROOMS } from "@shared/schema";
import { useState } from "react";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  lightbulb: Lightbulb,
  plug: Plug,
  thermometer: Thermometer,
  "thermometer-sun": ThermometerSun,
  lamp: Lamp,
  "door-closed": DoorClosed,
  activity: Activity,
};

const roomIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  "Living Room": Home,
  "Kitchen": ChefHat,
  "Bedroom": Bed,
  "Office": Briefcase,
  "Entrance": DoorOpen,
};

export default function Dashboard() {
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);

  const { data: devices = [], isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
  });

  const updateDevice = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Device> }) => {
      return apiRequest("PATCH", `/api/devices/${id}`, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
    },
  });

  const filteredDevices = selectedRoom
    ? devices.filter((d) => d.room === selectedRoom)
    : devices;

  const roomCounts = devices.reduce((acc, d) => {
    acc[d.room] = (acc[d.room] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeDevices = devices.filter((d) => d.isOn).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-muted-foreground">Loading devices...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-sidebar p-4 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-2 py-4">
          <Home className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-display font-semibold text-sidebar-foreground">
            Home Assistant
          </h1>
        </div>

        <nav className="flex flex-col gap-1">
          <Button
            variant={selectedRoom === null ? "secondary" : "ghost"}
            className="justify-start gap-2"
            onClick={() => setSelectedRoom(null)}
            data-testid="button-all-devices"
          >
            <Activity className="h-4 w-4" />
            All Devices
            <Badge variant="secondary" className="ml-auto">
              {devices.length}
            </Badge>
          </Button>

          {ROOMS.map((room) => {
            const RoomIcon = roomIconMap[room] || Home;
            const count = roomCounts[room] || 0;
            return (
              <Button
                key={room}
                variant={selectedRoom === room ? "secondary" : "ghost"}
                className="justify-start gap-2"
                onClick={() => setSelectedRoom(room)}
                data-testid={`button-room-${room.toLowerCase().replace(/\s/g, "-")}`}
              >
                <RoomIcon className="h-4 w-4" />
                {room}
                {count > 0 && (
                  <Badge variant="outline" className="ml-auto">
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </nav>

        <div className="mt-auto p-4 rounded-md bg-card border border-card-border">
          <div className="text-sm text-muted-foreground">Active Devices</div>
          <div className="text-2xl font-semibold text-foreground">
            {activeDevices} / {devices.length}
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 overflow-auto">
        <header className="mb-6">
          <h2 className="text-2xl font-display font-semibold text-foreground">
            {selectedRoom || "All Devices"}
          </h2>
          <p className="text-muted-foreground">
            {filteredDevices.length} device{filteredDevices.length !== 1 ? "s" : ""}
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredDevices.map((device) => (
            <DeviceCard
              key={device.id}
              device={device}
              onToggle={(isOn) =>
                updateDevice.mutate({ id: device.id, updates: { isOn } })
              }
              onValueChange={(value) =>
                updateDevice.mutate({ id: device.id, updates: { value } })
              }
            />
          ))}
        </div>

        {filteredDevices.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            No devices in this room
          </div>
        )}
      </main>
    </div>
  );
}

function DeviceCard({
  device,
  onToggle,
  onValueChange,
}: {
  device: Device;
  onToggle: (isOn: boolean) => void;
  onValueChange: (value: number) => void;
}) {
  const Icon = iconMap[device.icon] || Activity;
  const isSensor = device.type === "sensor";

  return (
    <Card
      className={`transition-all ${
        device.isOn ? "border-primary/50 bg-card" : "bg-card/50"
      }`}
      data-testid={`card-device-${device.id}`}
    >
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <div
            className={`p-2 rounded-md ${
              device.isOn ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-sm font-medium">{device.name}</CardTitle>
            <p className="text-xs text-muted-foreground">{device.room}</p>
          </div>
        </div>
        {!isSensor && (
          <ToggleSwitch
            checked={device.isOn || false}
            onCheckedChange={onToggle}
            data-testid={`switch-device-${device.id}`}
          />
        )}
      </CardHeader>
      <CardContent>
        {device.type === "light" && device.isOn && (
          <div className="flex items-center gap-3">
            <Slider
              value={[device.value || 0]}
              max={100}
              step={1}
              onValueChange={([val]) => onValueChange(val)}
              className="flex-1"
              data-testid={`slider-device-${device.id}`}
            />
            <span className="text-sm text-muted-foreground w-10 text-right">
              {device.value}%
            </span>
          </div>
        )}

        {device.type === "climate" && (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold">
              {device.value}
              <span className="text-sm text-muted-foreground">{device.unit}</span>
            </span>
            {device.isOn && (
              <Badge variant="default" className="bg-primary">
                Active
              </Badge>
            )}
          </div>
        )}

        {device.type === "sensor" && (
          <div className="flex items-center justify-between">
            <span className="text-2xl font-semibold">
              {device.value}
              <span className="text-sm text-muted-foreground">{device.unit}</span>
            </span>
            <Badge variant="outline">Sensor</Badge>
          </div>
        )}

        {device.type === "switch" && (
          <div className="text-sm text-muted-foreground">
            {device.isOn ? "On" : "Off"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
