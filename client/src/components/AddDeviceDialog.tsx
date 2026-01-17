import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDeviceSchema, ROOMS, DEVICE_TYPES, type InsertDevice } from "@shared/schema";
import { useCreateDevice } from "@/hooks/use-devices";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { z } from "zod";

const formSchema = insertDeviceSchema.extend({
  value: z.coerce.number().optional(),
});

export function AddDeviceDialog() {
  const [open, setOpen] = useState(false);
  const { mutate, isPending } = useCreateDevice();

  const form = useForm<InsertDevice>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      type: "switch",
      room: "Living Room",
      icon: "power",
      isOn: false,
      value: 0,
      unit: "",
    },
  });

  function onSubmit(data: InsertDevice) {
    mutate(data, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
          <Plus className="w-4 h-4" /> Add Device
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-card border-white/10 text-foreground">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Add New Device</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ceiling Fan" className="bg-secondary border-transparent focus:border-primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary border-transparent">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-white/10">
                        {DEVICE_TYPES.map((type) => (
                          <SelectItem key={type} value={type} className="capitalize cursor-pointer">
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="room"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Room</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-secondary border-transparent">
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-card border-white/10">
                        {ROOMS.map((room) => (
                          <SelectItem key={room} value={room} className="cursor-pointer">
                            {room}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icon (Lucide Name)</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="bg-secondary border-transparent">
                        <SelectValue placeholder="Select icon" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-card border-white/10 h-48">
                      {["lightbulb", "power", "thermometer", "activity", "fan", "tv", "wifi", "lock"].map((icon) => (
                        <SelectItem key={icon} value={icon} className="capitalize cursor-pointer">
                          {icon}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.watch("type") === "climate" && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Initial Value</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="20" className="bg-secondary border-transparent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit</FormLabel>
                      <FormControl>
                        <Input placeholder="°C" className="bg-secondary border-transparent" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isPending} className="bg-primary hover:bg-primary/90">
                {isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  "Add Device"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
