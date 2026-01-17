import { pgTable, text, serial, boolean, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const devices = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(), // 'light', 'switch', 'sensor', 'climate'
  room: text("room").notNull(), // 'Living Room', 'Kitchen', etc.
  isOn: boolean("is_on").default(false),
  value: integer("value"), // Brightness (0-100), Temperature, or Sensor value
  unit: text("unit"), // '°C', '%', etc.
  icon: text("icon").notNull(), // Lucide icon name
});

export const insertDeviceSchema = createInsertSchema(devices).omit({ id: true });

export type Device = typeof devices.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type UpdateDeviceRequest = Partial<InsertDevice>;

// Predefined rooms for organization
export const ROOMS = ["Living Room", "Kitchen", "Bedroom", "Office", "Entrance"];
export const DEVICE_TYPES = ["light", "switch", "sensor", "climate"];
