import { db } from "./db";
import { devices, type Device, type InsertDevice, type UpdateDeviceRequest } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getDevices(): Promise<Device[]>;
  getDevice(id: number): Promise<Device | undefined>;
  createDevice(device: InsertDevice): Promise<Device>;
  updateDevice(id: number, updates: UpdateDeviceRequest): Promise<Device>;
  deleteDevice(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getDevices(): Promise<Device[]> {
    return await db.select().from(devices).orderBy(devices.id);
  }

  async getDevice(id: number): Promise<Device | undefined> {
    const [device] = await db.select().from(devices).where(eq(devices.id, id));
    return device;
  }

  async createDevice(insertDevice: InsertDevice): Promise<Device> {
    const [device] = await db.insert(devices).values(insertDevice).returning();
    return device;
  }

  async updateDevice(id: number, updates: UpdateDeviceRequest): Promise<Device> {
    const [updated] = await db
      .update(devices)
      .set(updates)
      .where(eq(devices.id, id))
      .returning();
    return updated;
  }

  async deleteDevice(id: number): Promise<void> {
    await db.delete(devices).where(eq(devices.id, id));
  }
}

export const storage = new DatabaseStorage();
