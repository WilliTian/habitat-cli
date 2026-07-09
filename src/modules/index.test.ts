import { describe, expect, test } from "bun:test";

import {
  formatModule,
  formatModuleSummary,
  formatModuleStatusUpdate,
  hydrateModulesFromStarterModules,
  setModuleStatus,
} from "./index";
import type { ProductionBlueprint } from "../kepler/types";

function blueprintFixture(input: {
  blueprintId: string;
  runtimeAttributes?: Record<string, unknown>;
  capabilities?: string[];
}): ProductionBlueprint {
  return {
    id: input.blueprintId,
    blueprintId: input.blueprintId,
    displayName: `${input.blueprintId} Blueprint`,
    description: "",
    status: "published",
    output: {},
    inputs: {},
    buildTicks: 0,
    repeatable: true,
    runtimeAttributes: input.runtimeAttributes,
    capabilities: input.capabilities,
  };
}

describe("module runtime state", () => {
  test("hydrates starter module runtime state from Kepler runtimeAttributes", () => {
    const [module] = hydrateModulesFromStarterModules([
      {
        id: "habitat_1_command_module_1",
        blueprintId: "command-module",
        displayName: "Command Module",
        connectedTo: [],
        runtimeAttributes: {
          health: 100,
          status: "active",
          crewCapacity: 2,
          powerDrawKw: 1.5,
        },
        capabilities: ["habitat-command"],
      },
    ]);

    expect(module.runtimeAttributes).toEqual({
      health: 100,
      status: "active",
      crewCapacity: 2,
      powerDrawKw: 1.5,
    });
  });

  test("hydrates starter modules with blueprint runtime attributes", () => {
    const [module] = hydrateModulesFromStarterModules(
      [
        {
          id: "habitat_1_command_module_1",
          blueprintId: "command-module",
          displayName: "Command Module",
          connectedTo: [],
          runtimeAttributes: {
            health: 100,
            status: "active",
          },
          capabilities: ["habitat-command"],
        },
      ],
      [
        blueprintFixture({
          blueprintId: "command-module",
          runtimeAttributes: {
            crewCapacity: 2,
            powerDrawKw: 1.5,
          },
        }),
      ],
    );

    expect(module.runtimeAttributes).toEqual({
      crewCapacity: 2,
      powerDrawKw: 1.5,
      health: 100,
      status: "active",
    });
  });

  test("initializes battery stored energy from blueprint capacity", () => {
    const [module] = hydrateModulesFromStarterModules(
      [
        {
          id: "habitat_1_battery_1",
          blueprintId: "battery",
          displayName: "Battery",
          connectedTo: [],
          runtimeAttributes: {
            status: "active",
          },
          capabilities: ["power-storage"],
        },
      ],
      [
        blueprintFixture({
          blueprintId: "battery",
          runtimeAttributes: {
            energyCapacityKwh: 20,
          },
          capabilities: ["power-storage"],
        }),
      ],
    );

    expect(module.runtimeAttributes.energyCapacityKwh).toBe(20);
    expect(module.runtimeAttributes.energyStoredKwh).toBe(20);
  });

  test("formats module status from runtimeAttributes", () => {
    const module = {
      id: "habitat_1_command_module_1",
      blueprintId: "command-module",
      displayName: "Command Module",
      connectedTo: [],
      runtimeAttributes: {
        health: 100,
        status: "active",
        powerDrawKw: 1.5,
      },
      capabilities: ["habitat-command"],
      source: "starter" as const,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    };

    expect(formatModule(module)).toContain("status: active");
    expect(formatModule(module)).toContain("health: 100");
    expect(formatModule(module)).toContain("powerDrawKw: 1.5");
    expect(formatModuleSummary(module)).toContain("status: active");
  });

  test("formats active construction job details for fabricators", () => {
    const module = {
      id: "workshop_fabricator_1",
      blueprintId: "workshop-fabricator",
      displayName: "Workshop Fabricator",
      connectedTo: [],
      runtimeAttributes: {
        status: "online",
        powerDrawKw: {
          offline: 0,
          online: 1,
          active: 8,
        },
        constructionJob: {
          blueprintId: "small-solar-array",
          outputModuleId: "small_solar_array_1",
          displayName: "Small Solar Array",
          buildTicks: 180,
          remainingTicks: 120,
          futureModule: {
            blueprintId: "small-solar-array",
            displayName: "Small Solar Array",
            runtimeAttributes: {
              status: "online",
              generationKw: 5,
            },
            capabilities: ["power-generation"],
          },
        },
      },
      capabilities: ["basic-fabrication"],
      source: "local" as const,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    };

    expect(formatModuleSummary(module)).toContain("status: online");
    expect(formatModule(module)).toContain("activeConstructionJob:");
    expect(formatModule(module)).toContain("blueprintId: small-solar-array");
    expect(formatModule(module)).toContain("outputModuleId: small_solar_array_1");
    expect(formatModule(module)).toContain("remainingTicks: 120");
    expect(formatModule(module)).toContain("buildTicks: 180");
  });

  test("formats battery details for battery modules", () => {
    const module = {
      id: "basic_battery_1",
      blueprintId: "basic-battery",
      displayName: "Basic Battery",
      connectedTo: [],
      runtimeAttributes: {
        status: "online",
        currentEnergyKwh: 320,
        energyStorageKwh: 500,
      },
      capabilities: ["power-storage"],
      source: "local" as const,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    };

    expect(formatModule(module)).toContain("batteryEnergyStoredKwh: 320");
    expect(formatModule(module)).toContain("batteryEnergyCapacityKwh: 500");
    expect(formatModule(module)).toContain("usableBatteryEnergyKwh: 320");
  });

  test("formats useful runtime attributes for completed solar arrays", () => {
    const module = {
      id: "small_solar_array_1",
      blueprintId: "small-solar-array",
      displayName: "Small Solar Array",
      connectedTo: [],
      runtimeAttributes: {
        status: "online",
        powerDrawKw: 0,
        generationKw: 5,
        health: 100,
      },
      capabilities: ["power-generation"],
      source: "local" as const,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    };

    expect(formatModule(module)).toContain("status: online");
    expect(formatModule(module)).toContain("generationKw: 5");
    expect(formatModule(module)).toContain("capabilities: power-generation");
  });

  test("formats Kepler module ids with the meaningful suffix", () => {
    const module = {
      id: "habitat_f6e59444_2f34_4e6c_bc33_1cd9b4545c07_basic_suitport_1",
      blueprintId: "basic-suitport",
      displayName: "Basic Suitport",
      connectedTo: [],
      runtimeAttributes: {
        status: "online",
      },
      capabilities: ["suitport-access"],
      source: "starter" as const,
      createdAt: "2026-07-08T00:00:00.000Z",
      updatedAt: "2026-07-08T00:00:00.000Z",
    };

    expect(formatModuleSummary(module)).toContain("basic_suitport_1 Basic Suitport");
  });

  test("sets only runtime status and reports current power draw", async () => {
    const savedModules: unknown[] = [];
    const modules = [
      {
        id: "fabricator-module-1",
        blueprintId: "workshop-fabricator",
        displayName: "Workshop Fabricator",
        connectedTo: ["command"],
        runtimeAttributes: {
          status: "online",
          health: 100,
          powerDrawKw: {
            offline: 0,
            idle: 1,
            online: 1,
            active: 8,
            damaged: 1,
          },
        },
        capabilities: ["basic-fabrication"],
        source: "starter" as const,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z",
      },
    ];

    const result = await setModuleStatus("fab", "active", {
      loadModules: async () => modules,
      saveModules: async (nextModules) => {
        savedModules.push(nextModules);
      },
    });

    expect(result.module.runtimeAttributes).toEqual({
      status: "active",
      health: 100,
      powerDrawKw: {
        offline: 0,
        idle: 1,
        online: 1,
        active: 8,
        damaged: 1,
      },
    });
    expect(result.module.updatedAt).toBe("2026-07-08T00:00:00.000Z");
    expect(result.powerDrawKw).toBe(8);
    expect(formatModuleStatusUpdate(result)).toBe(
      ["moduleId: fabricat", "status: active", "powerDrawKw: 8"].join("\n"),
    );
    expect(savedModules).toHaveLength(1);
  });

  test("sets status by Kepler module suffix", async () => {
    const modules = [
      {
        id: "habitat_f6e59444_2f34_4e6c_bc33_1cd9b4545c07_basic_suitport_1",
        blueprintId: "basic-suitport",
        displayName: "Basic Suitport",
        connectedTo: [],
        runtimeAttributes: {
          status: "online",
          powerDrawKw: {
            offline: 0,
            online: 0.5,
            active: 2,
            damaged: 0.5,
          },
        },
        capabilities: ["suitport-access"],
        source: "starter" as const,
        createdAt: "2026-07-08T00:00:00.000Z",
        updatedAt: "2026-07-08T00:00:00.000Z",
      },
    ];

    const result = await setModuleStatus("basic_suitport_1", "active", {
      loadModules: async () => modules,
      saveModules: async () => {},
    });

    expect(formatModuleStatusUpdate(result)).toBe(
      ["moduleId: basic_suitport_1", "status: active", "powerDrawKw: 2"].join("\n"),
    );
  });

  test("rejects unsupported runtime status values", async () => {
    await expect(
      setModuleStatus("fabricator", "sleeping", {
        loadModules: async () => [],
        saveModules: async () => {},
      }),
    ).rejects.toThrow('Status must be one of: offline, idle, online, active, damaged.');
  });
});
