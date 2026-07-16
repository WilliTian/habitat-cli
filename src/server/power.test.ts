import { describe, expect, test } from "bun:test";
import { createBackendApp } from "./app";

const module = {
  id: "battery-1", blueprintId: "battery", displayName: "Battery", connectedTo: [], capabilities: ["power-storage"], source: "local" as const,
  runtimeAttributes: { status: "online", energyStoredKwh: 10, energyCapacityKwh: 20 }, createdAt: "now", updatedAt: "now",
};
const dependencies = {
  listModules: async () => [module],
  saveModules: async () => {},
  readSolarIrradiance: async () => ({ wPerM2: 0, condition: "night" as const }),
};

describe("power routes", () => {
  test("returns a power snapshot", async () => {
    const response = await createBackendApp({ logger: () => {}, power: dependencies }).request("/power");
    expect(response.status).toBe(200);
    expect((await response.json()).summary.solarCondition).toBe("night");
  });

  test("advances and persists valid ticks", async () => {
    let saved = false;
    const response = await createBackendApp({ logger: () => {}, power: { ...dependencies, saveModules: async () => { saved = true; } } }).request("/ticks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickCount: 60 }),
    });
    expect(response.status).toBe(200);
    expect(saved).toBe(true);
    expect((await response.json()).summary.tickCount).toBe(60);
  });

  test("rejects non-positive ticks", async () => {
    const response = await createBackendApp({ logger: () => {}, power: dependencies }).request("/ticks", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickCount: 0 }),
    });
    expect(response.status).toBe(400);
  });
});
