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
import { Plus, Loader2, Settings } from "lucide-react";
import { getColorSettings, dialogContentStyle, dialogHeaderStyle, DIALOG_CONTENT_CLASS, DIALOG_HEADER_CLASS, DIALOG_TITLE_STYLE } from "@/lib/dialogStyles";
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

  const cs = getColorSettings();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
          <Plus className="w-4 h-4" /> Add Device
        </Button>
      </DialogTrigger>
      <DialogContent className={`sm:max-w-[425px] ${DIALOG_CONTENT_CLASS}`} style={dialogContentStyle(cs)}>
        <div className={DIALOG_HEADER_CLASS} style={dialogHeaderStyle(cs)}>
          <Settings className="text-white" style={{ width: '15px', height: '15px' }} />
          <h2 className="font-normal text-white" style={DIALOG_TITLE_STYLE}>ADD NEW DEVICE</h2>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 px-4 py-3">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Device Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Ceiling Fan" className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-[11px]" {...field} />
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
                        <SelectTrigger className="bg-white/5 border-white/15 text-white text-[11px]">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                        <SelectTrigger className="bg-white/5 border-white/15 text-white text-[11px]">
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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
                      <SelectTrigger className="bg-white/5 border-white/15 text-white text-[11px]">
                        <SelectValue placeholder="Select icon" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="h-48">
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
                        <Input type="number" placeholder="20" className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-[11px]" {...field} />
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
                        <Input placeholder="°C" className="bg-white/5 border-white/15 text-white placeholder:text-white/30 text-[11px]" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-3 border-t border-white/20">
              <Button type="button" variant="outline" className="border-white/30 text-white hover:bg-white/10 text-xs h-8" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8">
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
