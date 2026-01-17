import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertDevice, type UpdateDeviceRequest } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useDevices() {
  return useQuery({
    queryKey: [api.devices.list.path],
    queryFn: async () => {
      const res = await fetch(api.devices.list.path);
      if (!res.ok) throw new Error("Failed to fetch devices");
      return api.devices.list.responses[200].parse(await res.json());
    },
  });
}

export function useDevice(id: number) {
  return useQuery({
    queryKey: [api.devices.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.devices.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch device");
      return api.devices.get.responses[200].parse(await res.json());
    },
  });
}

export function useCreateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertDevice) => {
      const validated = api.devices.create.input.parse(data);
      const res = await fetch(api.devices.create.path, {
        method: api.devices.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });
      
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.devices.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to create device");
      }
      return api.devices.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.devices.list.path] });
      toast({ title: "Success", description: "Device added successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error", 
        description: error instanceof Error ? error.message : "Failed to add device",
        variant: "destructive"
      });
    }
  });
}

export function useUpdateDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: number } & UpdateDeviceRequest) => {
      const validated = api.devices.update.input.parse(updates);
      const url = buildUrl(api.devices.update.path, { id });
      
      const res = await fetch(url, {
        method: api.devices.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validated),
      });

      if (!res.ok) {
        if (res.status === 400) {
          const error = api.devices.update.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        if (res.status === 404) throw new Error("Device not found");
        throw new Error("Failed to update device");
      }
      return api.devices.update.responses[200].parse(await res.json());
    },
    onMutate: async ({ id, ...updates }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: [api.devices.list.path] });
      const previousDevices = queryClient.getQueryData([api.devices.list.path]);

      queryClient.setQueryData([api.devices.list.path], (old: any[]) => {
        return old?.map((device) => 
          device.id === id ? { ...device, ...updates } : device
        );
      });

      return { previousDevices };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData([api.devices.list.path], context?.previousDevices);
      toast({ 
        title: "Error", 
        description: "Failed to update device",
        variant: "destructive"
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [api.devices.list.path] });
    },
  });
}

export function useDeleteDevice() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.devices.delete.path, { id });
      const res = await fetch(url, { method: api.devices.delete.method });
      if (res.status === 404) throw new Error("Device not found");
      if (!res.ok) throw new Error("Failed to delete device");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.devices.list.path] });
      toast({ title: "Success", description: "Device removed" });
    },
    onError: () => {
      toast({ 
        title: "Error", 
        description: "Failed to remove device",
        variant: "destructive"
      });
    }
  });
}
