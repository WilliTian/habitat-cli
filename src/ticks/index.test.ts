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

  test("advances active construction jobs without creating the output module early", () => {
    const modules = [
      moduleFixture({
        id: "fabricator",
        displayName: "Workshop Fabricator",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: {
            offline: 0,
            online: 1,
            active: 8,
          },
          constructionJob: {
            blueprintId: "small-solar-array",
            outputModuleId: "future-module-1",
            displayName: "Small Solar Array",
            buildTicks: 180,
            remainingTicks: 120,
            futureModule: {
              blueprintId: "small-solar-array",
              displayName: "Small Solar Array",
              runtimeAttributes: {
                status: "online",
                powerDrawKw: 0,
              },
              capabilities: ["power-generation"],
            },
          },
        },
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 30 });
    const [fabricator] = result.modules;

    expect(fabricator.runtimeAttributes.constructionJob).toMatchObject({
      outputModuleId: "future-module-1",
      remainingTicks: 90,
    });
    expect(result.modules).toHaveLength(1);
  });

  test("completes construction jobs when enough ticks pass", () => {
    const modules = [
      moduleFixture({
        id: "fabricator",
        displayName: "Workshop Fabricator",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: {
            offline: 0,
            online: 1,
            active: 8,
          },
          constructionJob: {
            blueprintId: "small-solar-array",
            outputModuleId: "future-module-1",
            displayName: "Small Solar Array",
            buildTicks: 180,
            remainingTicks: 20,
            futureModule: {
              blueprintId: "small-solar-array",
              displayName: "Small Solar Array",
              runtimeAttributes: {
                status: "online",
                powerDrawKw: 0,
                generationKw: 5,
              },
              capabilities: ["power-generation"],
            },
          },
        },
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 20 });
    const [fabricator, outputModule] = result.modules;

    expect(fabricator.runtimeAttributes.status).toBe("online");
    expect(fabricator.runtimeAttributes.constructionJob).toBeUndefined();
    expect(outputModule).toMatchObject({
      id: "future-module-1",
      blueprintId: "small-solar-array",
      displayName: "Small Solar Array",
      runtimeAttributes: {
        status: "online",
        powerDrawKw: 0,
        generationKw: 5,
      },
      capabilities: ["power-generation"],
      source: "local",
    });
  });

  test("offsets load with solar generation before draining batteries", () => {
    const modules = [
      moduleFixture({
        id: "load",
        displayName: "Load",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: 5,
        },
      }),
      moduleFixture({
        id: "solar",
        displayName: "Small Solar Array",
        runtimeAttributes: {
          status: "online",
          generationKw: 4,
        },
        capabilities: ["power-generation"],
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

    const result = applyPowerTicks({
      modules,
      tickCount: 3600,
      solarIrradiance: {
        wPerM2: 1,
        condition: "clear",
      },
    });

    expect(result.summary.activePowerDrawKw).toBe(5);
    expect(result.summary.solarGenerationKw).toBe(4);
    expect(result.summary.netPowerKw).toBe(1);
    expect(result.modules[2].runtimeAttributes.energyStoredKwh).toBe(9);
  });

  test("charges batteries when solar generation exceeds load", () => {
    const modules = [
      moduleFixture({
        id: "load",
        displayName: "Load",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: 2,
        },
      }),
      moduleFixture({
        id: "solar",
        displayName: "Small Solar Array",
        runtimeAttributes: {
          status: "online",
          generationKw: 5,
        },
        capabilities: ["power-generation"],
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          energyStoredKwh: 10,
          energyCapacityKwh: 12,
        },
      }),
    ];

    const result = applyPowerTicks({
      modules,
      tickCount: 3600,
      solarIrradiance: {
        wPerM2: 1,
        condition: "dust",
      },
    });

    expect(result.summary.solarIrradianceWPerM2).toBe(1);
    expect(result.summary.solarCondition).toBe("dust");
    expect(result.summary.netPowerKw).toBe(-3);
    expect(result.summary.energyChargedKwh).toBe(2);
    expect(result.summary.batteryCharges).toHaveLength(1);
    expect(result.summary.batteryCharges[0]).toMatchObject({
      moduleId: "battery",
      displayName: "Battery",
      beforeEnergyStoredKwh: 10,
      afterEnergyStoredKwh: 12,
      chargedKwh: 2,
    });
    expect(result.modules[2].runtimeAttributes.energyStoredKwh).toBe(12);
  });

  test("treats night as zero solar output", () => {
    const modules = [
      moduleFixture({
        id: "solar",
        displayName: "Small Solar Array",
        runtimeAttributes: {
          status: "online",
          generationKw: 5,
        },
        capabilities: ["power-generation"],
      }),
    ];

    const result = applyPowerTicks({
      modules,
      tickCount: 3600,
      solarIrradiance: {
        wPerM2: 900,
        condition: "night",
      },
    });

    expect(result.summary.solarGenerationKw).toBe(0);
  });

  test("does not overcharge batteries past capacity", () => {
    const modules = [
      moduleFixture({
        id: "solar",
        displayName: "Small Solar Array",
        runtimeAttributes: {
          status: "online",
          generationKw: 10,
        },
        capabilities: ["power-generation"],
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          currentEnergyKwh: 499,
          energyStorageKwh: 500,
        },
      }),
    ];

    const result = applyPowerTicks({
      modules,
      tickCount: 3600,
      solarIrradiance: {
        wPerM2: 1,
        condition: "clear",
      },
    });

    expect(result.summary.energyChargedKwh).toBe(1);
    expect(result.modules[1].runtimeAttributes.currentEnergyKwh).toBe(500);
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
