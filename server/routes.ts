import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // GET /api/devices
  app.get(api.devices.list.path, async (_req, res) => {
    const devices = await storage.getDevices();
    res.json(devices);
  });

  // GET /api/devices/:id
  app.get(api.devices.get.path, async (req, res) => {
    const device = await storage.getDevice(Number(req.params.id));
    if (!device) {
      return res.status(404).json({ message: 'Device not found' });
    }
    res.json(device);
  });

  // POST /api/devices
  app.post(api.devices.create.path, async (req, res) => {
    try {
      const input = api.devices.create.input.parse(req.body);
      const device = await storage.createDevice(input);
      res.status(201).json(device);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // PATCH /api/devices/:id
  app.patch(api.devices.update.path, async (req, res) => {
    try {
      const input = api.devices.update.input.parse(req.body);
      const device = await storage.updateDevice(Number(req.params.id), input);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
      res.json(device);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  // DELETE /api/devices/:id
  app.delete(api.devices.delete.path, async (req, res) => {
    await storage.deleteDevice(Number(req.params.id));
    res.status(204).end();
  });

  // Initial Seed
  seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingDevices = await storage.getDevices();
  if (existingDevices.length === 0) {
    console.log("Seeding database with initial devices...");
    const seeds = [
      {
        name: "Living Room Light",
        type: "light",
        room: "Living Room",
        isOn: true,
        value: 80,
        icon: "lightbulb",
      },
      {
        name: "Living Room AC",
        type: "climate",
        room: "Living Room",
        isOn: true,
        value: 22,
        unit: "°C",
        icon: "thermometer",
      },
      {
        name: "Kitchen Light",
        type: "light",
        room: "Kitchen",
        isOn: false,
        value: 0,
        icon: "lightbulb",
      },
      {
        name: "Coffee Maker",
        type: "switch",
        room: "Kitchen",
        isOn: false,
        icon: "plug",
      },
      {
        name: "Bedroom Lamp",
        type: "light",
        room: "Bedroom",
        isOn: true,
        value: 30,
        icon: "lamp",
      },
      {
        name: "Bedroom Heater",
        type: "climate",
        room: "Bedroom",
        isOn: false,
        value: 18,
        unit: "°C",
        icon: "thermometer",
      },
      {
        name: "Front Door",
        type: "sensor",
        room: "Entrance",
        isOn: false,
        value: 0, // 0=closed
        icon: "door-closed",
      },
      {
        name: "Temperature",
        type: "sensor",
        room: "Entrance",
        isOn: true,
        value: 24,
        unit: "°C",
        icon: "thermometer-sun",
      },
    ];

    for (const seed of seeds) {
      await storage.createDevice(seed);
    }
    console.log("Seeding complete.");
  }
}
