import { describe, expect, test } from "bun:test";

import { applyPowerTicks, runPowerTicks } from "./index";
import type { HabitatModule } from "../modules/types";

function moduleFixture(input: {
  id: string;
  displayName: string;
  runtimeAttributes: Record<string, unknown>;
  capabilities?: string[];
}): HabitatModule {
  return {
    id: input.id,
    blueprintId: input.id,
    displayName: input.displayName,
    connectedTo: [],
    runtimeAttributes: input.runtimeAttributes,
    capabilities: input.capabilities ?? [],
    source: "starter",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
}

describe("applyPowerTicks", () => {
  test("drains active module power draw from batteries for one-second ticks", () => {
    const modules = [
      moduleFixture({
        id: "command",
        displayName: "Command Module",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: 3.6,
        },
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          energyStoredKwh: 10,
          energyCapacityKwh: 20,
        },
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 10 });

    expect(result.summary.tickCount).toBe(10);
    expect(result.summary.activePowerDrawKw).toBe(3.6);
    expect(result.summary.energyDemandKwh).toBeCloseTo(0.01);
    expect(result.modules[1].runtimeAttributes.energyStoredKwh).toBeCloseTo(9.99);
  });

  test("uses status-specific power draw and catalog battery energy fields", () => {
    const modules = [
      moduleFixture({
        id: "fabricator",
        displayName: "Workshop Fabricator",
        runtimeAttributes: {
          status: "online",
          powerDrawKw: {
            offline: 0,
            online: 1,
            active: 8,
            damaged: 1,
          },
        },
      }),
      moduleFixture({
        id: "battery",
        displayName: "Basic Battery",
        runtimeAttributes: {
          status: "offline",
          currentEnergyKwh: 500,
          energyStorageKwh: 500,
        },
        capabilities: ["power-storage"],
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 3600 });

    expect(result.summary.activePowerDrawKw).toBe(1);
    expect(result.summary.energyDemandKwh).toBe(1);
    expect(result.modules[1].runtimeAttributes.currentEnergyKwh).toBe(499);
  });

  test("ignores inactive module power draw", () => {
    const modules = [
      moduleFixture({
        id: "offline-pump",
        displayName: "Offline Pump",
        runtimeAttributes: {
          status: "offline",
          powerDrawKw: 360,
        },
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          energyStoredKwh: 5,
        },
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 10 });

    expect(result.summary.activePowerDrawKw).toBe(0);
    expect(result.summary.energyDemandKwh).toBe(0);
    expect(result.modules[1].runtimeAttributes.energyStoredKwh).toBe(5);
  });

  test("reports unmet energy when batteries run out", () => {
    const modules = [
      moduleFixture({
        id: "load",
        displayName: "Load",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: 7200,
        },
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          energyStoredKwh: 1,
        },
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 1 });

    expect(result.summary.energyDemandKwh).toBe(2);
    expect(result.summary.energyDrainedKwh).toBe(1);
    expect(result.summary.unmetEnergyKwh).toBe(1);
    expect(result.modules[1].runtimeAttributes.energyStoredKwh).toBe(0);
  });

  test("rejects non-positive tick counts", () => {
    expect(() => applyPowerTicks({ modules: [], tickCount: 0 })).toThrow(
      "Tick count must be a positive integer.",
    );
  });
});

describe("runPowerTicks", () => {
  test("loads modules, applies ticks, and saves updated modules", async () => {
    const savedModules: HabitatModule[][] = [];
    const modules = [
      moduleFixture({
        id: "load",
        displayName: "Load",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: 3.6,
        },
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          energyStoredKwh: 10,
        },
      }),
    ];

    const result = await runPowerTicks(10, {
      loadModules: async () => modules,
      saveModules: async (nextModules) => {
        savedModules.push(nextModules);
      },
    });

    expect(result.summary.energyDemandKwh).toBeCloseTo(0.01);
    expect(savedModules).toHaveLength(1);
    expect(savedModules[0][1].runtimeAttributes.energyStoredKwh).toBeCloseTo(9.99);
  });
});
