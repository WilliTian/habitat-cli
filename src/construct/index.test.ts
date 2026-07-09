import { describe, expect, test } from "bun:test";

import {
  evaluateConstructionDryRun,
  formatConstructionDryRun,
  formatConstructionStart,
  formatConstructionStatus,
  readConstructionStatus,
  startConstruction,
} from "./index";
import type { HabitatModule } from "../modules/types";
import type { HabitatInventoryResource } from "../inventory/types";
import type { ProductionBlueprint } from "../kepler/types";

function blueprintFixture(): ProductionBlueprint {
  return {
    id: "small-solar-array",
    blueprintId: "small-solar-array",
    displayName: "Small Solar Array",
    description: "Compact solar generation array",
    status: "published",
    output: {
      moduleType: "small-solar-array",
      quantity: 1,
    },
    inputs: {
      steel: 12,
      electronics: 4,
    },
    buildTicks: 180,
    repeatable: true,
    requiredFacility: {
      moduleType: "workshop-fabricator",
    },
    prerequisites: ["solar-construction"],
  };
}

function mixedInputsBlueprintFixture(): ProductionBlueprint {
  return {
    ...blueprintFixture(),
    inputs: {
      steel: 12,
      electronics: 4,
      notes: "ignore me",
      nested: { quantity: 9 },
      disabled: false,
    },
  };
}

function moduleFixture(input: {
  id?: string;
  blueprintId: string;
  displayName: string;
  status?: string;
  capabilities?: string[];
  runtimeAttributes?: Record<string, unknown>;
}): HabitatModule {
  return {
    id: input.id ?? `${input.blueprintId}-1`,
    blueprintId: input.blueprintId,
    displayName: input.displayName,
    connectedTo: [],
    runtimeAttributes: {
      ...(input.status ? { status: input.status } : {}),
      ...(input.runtimeAttributes ?? {}),
    },
    capabilities: input.capabilities ?? [],
    source: "starter",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
}

function resourceFixture(input: {
  resourceType: string;
  quantity: number;
}): HabitatInventoryResource {
  return {
    resourceType: input.resourceType,
    quantity: input.quantity,
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
}

describe("construct dry-run", () => {
  test("reports all checks passing when construction can start", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: ["solar-construction"],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(true);
    expect(report.requiredFacility.exists).toBe(true);
    expect(report.fabricatorAvailable).toBe(true);
    expect(report.supplyCacheOnline).toBe(true);
    expect(report.prerequisitesMet.missing).toEqual([]);
    expect(report.inventorySufficient.missing).toEqual([]);
    expect(report.resourcesToSpend).toEqual([
      { resourceType: "electronics", requiredQuantity: 4, availableQuantity: 4 },
      { resourceType: "steel", requiredQuantity: 12, availableQuantity: 12 },
    ]);
    expect(formatConstructionDryRun(report)).toContain("canStart: yes");
    expect(formatConstructionDryRun(report)).toContain(
      ["resourcesToSpend:", "RESOURCE TYPE   REQUIRED   AVAILABLE", "electronics     4          4", "steel           12         12"].join("\n"),
    );
  });

  test("accepts prerequisites from any local module capability", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "relay-node",
          displayName: "Relay Node",
          status: "online",
          capabilities: ["solar-construction"],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(true);
    expect(report.prerequisitesMet.missing).toEqual([]);
  });

  test("reports a missing required facility", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "relay-node",
          displayName: "Relay Node",
          status: "online",
          capabilities: ["solar-construction"],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(false);
    expect(report.requiredFacility.exists).toBe(false);
    expect(report.fabricatorAvailable).toBe(false);
    expect(report.supplyCacheOnline).toBe(true);
    expect(report.prerequisitesMet.missing).toEqual([]);
    expect(report.inventorySufficient.missing).toEqual([]);
  });

  test("reports an unavailable fabricator", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "offline",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "relay-node",
          displayName: "Relay Node",
          status: "online",
          capabilities: ["solar-construction"],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(false);
    expect(report.requiredFacility.exists).toBe(true);
    expect(report.fabricatorAvailable).toBe(false);
    expect(report.supplyCacheOnline).toBe(true);
    expect(report.prerequisitesMet.missing).toEqual([]);
    expect(report.inventorySufficient.missing).toEqual([]);
  });

  test("reports an offline supply cache", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "offline",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "relay-node",
          displayName: "Relay Node",
          status: "online",
          capabilities: ["solar-construction"],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(false);
    expect(report.requiredFacility.exists).toBe(true);
    expect(report.fabricatorAvailable).toBe(true);
    expect(report.supplyCacheOnline).toBe(false);
    expect(report.prerequisitesMet.missing).toEqual([]);
    expect(report.inventorySufficient.missing).toEqual([]);
  });

  test("reports unmet prerequisites", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "relay-node",
          displayName: "Relay Node",
          status: "online",
          capabilities: ["thermal-control"],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(false);
    expect(report.requiredFacility.exists).toBe(true);
    expect(report.fabricatorAvailable).toBe(true);
    expect(report.supplyCacheOnline).toBe(true);
    expect(report.prerequisitesMet.missing).toEqual(["solar-construction"]);
    expect(report.inventorySufficient.missing).toEqual([]);
  });

  test("reports insufficient inventory", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          blueprintId: "relay-node",
          displayName: "Relay Node",
          status: "online",
          capabilities: ["solar-construction"],
        }),
      ],
      loadInventory: async () => [resourceFixture({ resourceType: "steel", quantity: 6 })],
    });

    expect(report.canStart).toBe(false);
    expect(report.requiredFacility.exists).toBe(true);
    expect(report.fabricatorAvailable).toBe(true);
    expect(report.supplyCacheOnline).toBe(true);
    expect(report.prerequisitesMet.missing).toEqual([]);
    expect(report.inventorySufficient.missing).toEqual([
      { resourceType: "electronics", requiredQuantity: 4, availableQuantity: 0 },
      { resourceType: "steel", requiredQuantity: 12, availableQuantity: 6 },
    ]);
    expect(formatConstructionDryRun(report)).toContain(
      [
        "missingResources:",
        "RESOURCE TYPE   REQUIRED   AVAILABLE",
        "electronics     4          0",
        "steel           12         6",
      ].join("\n"),
    );
  });

  test("treats only numeric top-level blueprint inputs as required resources", async () => {
    const report = await evaluateConstructionDryRun("small-solar-array", {
      findBlueprint: async () => mixedInputsBlueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          capabilities: ["solar-construction"],
        }),
        moduleFixture({
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
    });

    expect(report.canStart).toBe(true);
    expect(report.resourcesToSpend).toEqual([
      { resourceType: "electronics", requiredQuantity: 4, availableQuantity: 4 },
      { resourceType: "steel", requiredQuantity: 12, availableQuantity: 12 },
    ]);
    expect(report.inventorySufficient.missing).toEqual([]);
  });

  test("maps a live Kepler 404 to a blueprint not found error", async () => {
    await expect(
      evaluateConstructionDryRun("missing-blueprint", {
        findBlueprint: async () => {
          throw new Error("Kepler request failed with 404: Not Found");
        },
        loadModules: async () => [],
        loadInventory: async () => [],
      }),
    ).rejects.toThrow('Blueprint "missing-blueprint" was not found.');
  });

  test("preserves non-404 Kepler failures from live blueprint lookup", async () => {
    await expect(
      evaluateConstructionDryRun("small-solar-array", {
        findBlueprint: async () => {
          throw new Error("Kepler request failed with 401: Unauthorized");
        },
        loadModules: async () => [],
        loadInventory: async () => [],
      }),
    ).rejects.toThrow("Kepler request failed with 401: Unauthorized");
  });

  test("starts construction by reserving an output module id and attaching a job to the first operational fabricator", async () => {
    const savedModules: HabitatModule[][] = [];
    const savedInventory: HabitatInventoryResource[][] = [];

    const report = await startConstruction("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          id: "fabricator-offline",
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator Offline",
          status: "offline",
          capabilities: [],
        }),
        moduleFixture({
          id: "fabricator-active",
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          id: "supply-cache-1",
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: ["solar-construction"],
        }),
        moduleFixture({
          id: "small_solar_array_1",
          blueprintId: "small-solar-array",
          displayName: "Existing Small Solar Array",
          status: "online",
          capabilities: [],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
        resourceFixture({ resourceType: "water", quantity: 3 }),
      ],
      saveModules: async (modules) => {
        savedModules.push(modules);
      },
      saveInventory: async (inventory) => {
        savedInventory.push(inventory);
      },
      now: () => "2026-07-09T12:00:00.000Z",
    });

    expect(report.outputModuleId).toBe("small_solar_array_2");
    expect(report.fabricatorId).toBe("fabricator-active");
    expect(report.fabricatorDisplayName).toBe("Workshop Fabricator");
    expect(report.buildTicks).toBe(180);
    expect(report.remainingTicks).toBe(180);
    expect(report.futureModule).toEqual({
      blueprintId: "small-solar-array",
      displayName: "Small Solar Array",
      runtimeAttributes: {},
      capabilities: [],
    });
    expect(report.resourcesSpent).toEqual([
      { resourceType: "electronics", requiredQuantity: 4, availableQuantity: 4 },
      { resourceType: "steel", requiredQuantity: 12, availableQuantity: 12 },
    ]);
    expect(formatConstructionStart(report)).toContain("outputModuleId: small_solar_array_2");

    expect(savedInventory).toHaveLength(1);
    expect(savedInventory[0]).toEqual([
      { resourceType: "steel", quantity: 0, updatedAt: "2026-07-09T12:00:00.000Z" },
      { resourceType: "electronics", quantity: 0, updatedAt: "2026-07-09T12:00:00.000Z" },
      { resourceType: "water", quantity: 3, updatedAt: "2026-07-08T00:00:00.000Z" },
    ]);

    expect(savedModules).toHaveLength(1);
    expect(savedModules[0]).toHaveLength(4);

    const selectedFabricator = savedModules[0].find((module) => module.id === "fabricator-active");
    expect(selectedFabricator).toBeDefined();
    expect(selectedFabricator?.runtimeAttributes).toEqual({
      status: "active",
        constructionJob: {
          blueprintId: "small-solar-array",
          outputModuleId: "small_solar_array_2",
          displayName: "Small Solar Array",
          buildTicks: 180,
          remainingTicks: 180,
        futureModule: {
          blueprintId: "small-solar-array",
          displayName: "Small Solar Array",
          runtimeAttributes: {},
          capabilities: [],
        },
      },
    });
    expect(savedModules[0].some((module) => module.id === "small_solar_array_2")).toBe(false);
  });

  test("reserves the next slug id when another construction job already holds a future module id", async () => {
    const report = await startConstruction("small-solar-array", {
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          id: "fabricator-active",
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "online",
          capabilities: [],
        }),
        moduleFixture({
          id: "fabricator-busy",
          blueprintId: "workshop-fabricator",
          displayName: "Busy Fabricator",
          status: "active",
          capabilities: [],
          runtimeAttributes: {
            constructionJob: {
              blueprintId: "small-solar-array",
              outputModuleId: "small_solar_array_2",
              displayName: "Small Solar Array",
              buildTicks: 180,
              remainingTicks: 90,
              futureModule: {
                blueprintId: "small-solar-array",
                displayName: "Small Solar Array",
                runtimeAttributes: {},
                capabilities: [],
              },
            },
          },
        }),
        moduleFixture({
          id: "supply-cache-1",
          blueprintId: "supply-cache",
          displayName: "Supply Cache",
          status: "online",
          capabilities: ["solar-construction"],
        }),
        moduleFixture({
          id: "small_solar_array_1",
          blueprintId: "small-solar-array",
          displayName: "Existing Small Solar Array",
          status: "online",
          capabilities: [],
        }),
      ],
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 12 }),
        resourceFixture({ resourceType: "electronics", quantity: 4 }),
      ],
      saveModules: async () => {},
      saveInventory: async () => {},
      now: () => "2026-07-09T12:00:00.000Z",
    });

    expect(report.outputModuleId).toBe("small_solar_array_3");
  });

  test("rejects starting construction when the selected fabricator already has a job", async () => {
    await expect(
      startConstruction("small-solar-array", {
        findBlueprint: async () => blueprintFixture(),
        loadModules: async () => [
          moduleFixture({
            id: "fabricator-active",
            blueprintId: "workshop-fabricator",
            displayName: "Workshop Fabricator",
            status: "active",
            runtimeAttributes: {
              constructionJob: {
                blueprintId: "previous-job",
                outputModuleId: "output-module-0",
                displayName: "Previous Job",
                buildTicks: 20,
                remainingTicks: 10,
                futureModule: {
                  blueprintId: "previous-job",
                  displayName: "Previous Job",
                  runtimeAttributes: {},
                  capabilities: [],
                },
              },
            },
            capabilities: [],
          }),
          moduleFixture({
            id: "fabricator-backup",
            blueprintId: "workshop-fabricator",
            displayName: "Backup Fabricator",
            status: "online",
            capabilities: [],
          }),
          moduleFixture({
            id: "supply-cache-1",
            blueprintId: "supply-cache",
            displayName: "Supply Cache",
            status: "online",
            capabilities: ["solar-construction"],
          }),
        ],
        loadInventory: async () => [
          resourceFixture({ resourceType: "steel", quantity: 12 }),
          resourceFixture({ resourceType: "electronics", quantity: 4 }),
        ],
        saveModules: async () => {},
        saveInventory: async () => {},
        now: () => "2026-07-09T12:00:00.000Z",
      }),
    ).rejects.toThrow('Fabricator "fabricator-active" already has an active construction job.');
  });

  test("formats construction status as a terminal-readable table", async () => {
    const output = formatConstructionStatus([
      {
        fabricatorId: "fabricator",
        fabricatorDisplayName: "Workshop Fabricator",
        blueprintId: "small-solar-array",
        displayName: "Small Solar Array",
        outputModuleId: "future-module-1",
        buildTicks: 180,
        remainingTicks: 120,
      },
    ]);

    expect(output).toBe(
      [
        "FABRICATOR   JOB BLUEPRINT       FUTURE MODULE       REMAINING   TOTAL",
        "fabricator   small-solar-array   Small Solar Array   120         180",
      ].join("\n"),
    );
  });

  test("formats empty construction status output", async () => {
    expect(formatConstructionStatus([])).toBe("No active construction jobs.");
  });

  test("reads construction status rows from local modules", async () => {
    const rows = await readConstructionStatus({
      findBlueprint: async () => blueprintFixture(),
      loadModules: async () => [
        moduleFixture({
          id: "fabricator-1",
          blueprintId: "workshop-fabricator",
          displayName: "Workshop Fabricator",
          status: "active",
          runtimeAttributes: {
            constructionJob: {
              blueprintId: "small-solar-array",
              outputModuleId: "future-module-1",
              displayName: "Small Solar Array",
              buildTicks: 180,
              remainingTicks: 120,
              futureModule: {
                blueprintId: "small-solar-array",
                displayName: "Small Solar Array",
                runtimeAttributes: {},
                capabilities: [],
              },
            },
          },
        }),
      ],
      loadInventory: async () => [],
    });

    expect(rows).toEqual([
      {
        fabricatorId: "fabricat",
        fabricatorDisplayName: "Workshop Fabricator",
        blueprintId: "small-solar-array",
        displayName: "Small Solar Array",
        outputModuleId: "future-module-1",
        buildTicks: 180,
        remainingTicks: 120,
      },
    ]);
  });
});
