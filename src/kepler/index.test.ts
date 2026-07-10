import { describe, expect, test } from "bun:test";

import {
  findBlueprint,
  formatBlueprint,
  formatBlueprintSummary,
  formatUnregisterKeplerHabitatResult,
  formatResourceTable,
  listBlueprints,
  listResources,
  readKeplerHabitatStatus,
  readSolarIrradiance,
  registerKeplerHabitat,
  unregisterKeplerHabitat,
} from "./index";
import { loadRegistrationState, saveRegistrationState } from "./state";
import type {
  BlueprintCatalogResponse,
  BlueprintResponse,
  HabitatRegistrationResponse,
  ResourceCatalogResponse,
  ProductionBlueprint,
  IndustryResource,
  SolarIrradianceResponse,
} from "./types";

function blueprintFixture(input: {
  blueprintId: string;
  displayName?: string;
}): ProductionBlueprint {
  return {
    id: input.blueprintId,
    blueprintId: input.blueprintId,
    displayName: input.displayName ?? `${input.blueprintId} Blueprint`,
    description: "Blueprint description",
    status: "published",
    output: {
      item: "survey-rover",
      quantity: 1,
    },
    inputs: {
      metal: 4,
      electronics: 2,
    },
    buildTicks: 120,
    repeatable: true,
  };
}

function resourceFixture(input: {
  resourceType: string;
  displayName?: string;
  kind?: string;
  rarity?: string;
  amount?: number;
}): IndustryResource {
  return {
    id: input.resourceType,
    resourceType: input.resourceType,
    displayName: input.displayName ?? `${input.resourceType} Resource`,
    kind: input.kind ?? "material",
    rarity: input.rarity ?? "common",
    ...(input.amount !== undefined ? { amount: input.amount } : {}),
  };
}

describe("blueprint catalog", () => {
  test("lists blueprints from the Kepler server", async () => {
    const blueprints = [
      blueprintFixture({ blueprintId: "survey-rover" }),
      blueprintFixture({ blueprintId: "battery-upgrade" }),
    ];
    const requests: string[] = [];

    const result = await listBlueprints({
      requestKeplerJson: async (path) => {
        requests.push(path);
        return {
          catalogVersion: "2026-07-08",
          blueprints,
        } satisfies BlueprintCatalogResponse;
      },
    });

    expect(result).toEqual(blueprints);
    expect(requests).toEqual(["/catalog/blueprints"]);
  });

  test("finds one blueprint from the Kepler server by exact blueprint id", async () => {
    const blueprint = blueprintFixture({ blueprintId: "survey-rover" });
    const requests: string[] = [];

    const result = await findBlueprint("survey-rover", {
      requestKeplerJson: async (path) => {
        requests.push(path);
        return {
          blueprint,
        } satisfies BlueprintResponse;
      },
    });

    expect(result).toEqual(blueprint);
    expect(requests).toEqual(["/catalog/blueprints/survey-rover"]);
  });

  test("trims the requested blueprint id before calling Kepler", async () => {
    const blueprint = blueprintFixture({ blueprintId: "survey-rover" });
    const requests: string[] = [];

    const result = await findBlueprint("  survey-rover  ", {
      requestKeplerJson: async (path) => {
        requests.push(path);
        return {
          blueprint,
        } satisfies BlueprintResponse;
      },
    });

    expect(result).toEqual(blueprint);
    expect(requests).toEqual(["/catalog/blueprints/survey-rover"]);
  });

  test("propagates Kepler request failures when listing blueprints", async () => {
    await expect(
      listBlueprints({
        requestKeplerJson: async () => {
          throw new Error("Kepler request failed with 401: Unauthorized");
        },
      }),
    ).rejects.toThrow("Kepler request failed with 401: Unauthorized");
  });

  test("formats a blueprint summary with id and display name", () => {
    const blueprint = blueprintFixture({ blueprintId: "survey-rover", displayName: "Survey Rover" });

    expect(formatBlueprintSummary(blueprint)).toBe("survey-rover Survey Rover");
  });

  test("formats blueprint details with core catalog fields", () => {
    const blueprint = {
      ...blueprintFixture({ blueprintId: "survey-rover", displayName: "Survey Rover" }),
      productionCost: {
        power: 6,
      },
      requiredFacility: {
        moduleType: "workshop-fabricator",
        minimumLevel: 1,
      },
      prerequisites: ["rover-production"],
      unlocks: ["surface-survey"],
      capabilities: ["surface-survey"],
      runtimeAttributes: {
        rangeKm: 20,
      },
    };
    const result = formatBlueprint(blueprint);

    expect(result).toContain("Survey Rover");
    expect(result).toContain("Overview");
    expect(result).toContain("blueprintId: survey-rover");
    expect(result).toContain("status: published");
    expect(result).toContain("buildTicks: 120");
    expect(result).toContain("Production");
    expect(result).toContain("output:");
    expect(result).toContain("item: survey-rover");
    expect(result).toContain("quantity: 1");
    expect(result).toContain("inputs:");
    expect(result).toContain("metal: 4");
    expect(result).toContain("electronics: 2");
    expect(result).toContain("productionCost:");
    expect(result).toContain("power: 6");
    expect(result).toContain("requiredFacility:");
    expect(result).toContain("moduleType: workshop-fabricator");
    expect(result).toContain("minimumLevel: 1");
    expect(result).toContain("Progression");
    expect(result).toContain("prerequisites: rover-production");
    expect(result).toContain("unlocks: surface-survey");
    expect(result).toContain("Runtime");
    expect(result).toContain("capabilities: surface-survey");
    expect(result).toContain("runtimeAttributes:");
    expect(result).toContain("rangeKm: 20");
  });
});

describe("resource catalog", () => {
  test("lists resources from the Kepler server", async () => {
    const resources = [
      resourceFixture({ resourceType: "water-ice", displayName: "Water Ice" }),
      resourceFixture({ resourceType: "ferrite", displayName: "Ferrite", rarity: "uncommon" }),
    ];
    const requests: string[] = [];

    const result = await listResources({
      requestKeplerJson: async (path) => {
        requests.push(path);
        return {
          catalogVersion: "2026-07-08",
          resources,
        } satisfies ResourceCatalogResponse;
      },
      loadInventory: async () => [
        { resourceType: "water-ice", quantity: 50 },
        { resourceType: "ferrite", quantity: 12 },
      ],
    });

    expect(result).toEqual([
      { ...resources[0], amount: 50 },
      { ...resources[1], amount: 12 },
    ]);
    expect(requests).toEqual(["/catalog/resources"]);
  });

  test("formats a resource table with catalog columns", () => {
    const result = formatResourceTable([
      resourceFixture({
        resourceType: "water-ice",
        displayName: "Water Ice",
        kind: "volatile",
        rarity: "common",
        amount: 50,
      }),
      resourceFixture({
        resourceType: "ferrite",
        displayName: "Ferrite",
        kind: "ore",
        rarity: "uncommon",
        amount: 12,
      }),
    ]);

    expect(result).toBe(
      [
        "RESOURCE TYPE   DISPLAY NAME   KIND       AMOUNT   RARITY",
        "ferrite         Ferrite        ore        12       uncommon",
        "water-ice       Water Ice      volatile   50       common",
      ].join("\n"),
    );
  });
});

describe("solar irradiance", () => {
  test("reads solar irradiance from the Kepler world endpoint", async () => {
    const requests: string[] = [];

    const result = await readSolarIrradiance({
      requestKeplerJson: async (path) => {
        requests.push(path);
        return {
          solarIrradiance: {
            wPerM2: 900,
            condition: "clear",
          },
        } satisfies SolarIrradianceResponse;
      },
    });

    expect(result).toEqual({
      wPerM2: 900,
      condition: "clear",
    });
    expect(requests).toEqual(["/world/solar-irradiance"]);
  });

  test("propagates Kepler request failures when reading solar irradiance", async () => {
    await expect(
      readSolarIrradiance({
        requestKeplerJson: async () => {
          throw new Error("Kepler request failed with 503: unavailable");
        },
      }),
    ).rejects.toThrow("Kepler request failed with 503: unavailable");
  });
});

describe("Kepler registration", () => {
  test("hydrates starter modules from registration blueprints without persisting blueprints", async () => {
    const savedStates: unknown[] = [];
    const replaceCalls: HabitatRegistrationResponse[] = [];

    const response: HabitatRegistrationResponse = {
      habitatId: "habitat-1",
      habitat: {
        id: "habitat-1",
        habitatSlug: "habitat-one",
        displayName: "Habitat One (Server)",
        catalogVersion: "2026-07-08",
        status: "registered",
        lastSeenAt: null,
      },
      starterModules: [
        {
          id: "habitat_1_command_module_1",
          blueprintId: "command-module",
          displayName: "Command Module",
          connectedTo: [],
          runtimeAttributes: {
            status: "active",
          },
          capabilities: ["habitat-command"],
        },
      ],
      blueprints: [
        {
          ...blueprintFixture({ blueprintId: "command-module", displayName: "Command Module" }),
          runtimeAttributes: {
            powerDrawKw: 1.5,
          },
        },
      ],
    };

    await registerKeplerHabitat(
      { displayName: "Habitat One" },
      {
        loadRegistrationState: async () => undefined,
        requestKeplerJson: async () => response,
        replaceModulesFromStarterModules: async (starterModules, blueprints) => {
          replaceCalls.push({ habitatId: "habitat-1", starterModules, blueprints });
          return [];
        },
        saveRegistrationState: async (keplerHabitat) => {
          savedStates.push(keplerHabitat);
        },
        createHabitatUuid: () => "uuid-1",
        now: () => "2026-07-08T00:00:00.000Z",
      },
    );

    expect(replaceCalls).toEqual([
      {
        habitatId: "habitat-1",
        starterModules: response.starterModules,
        blueprints: response.blueprints,
      },
    ]);
    expect(savedStates).toEqual([
      {
        displayName: "Habitat One (Server)",
        habitatUuid: "uuid-1",
        habitatId: "habitat-1",
        starterModules: response.starterModules,
        registeredAt: "2026-07-08T00:00:00.000Z",
        moduleCount: 1,
      },
    ]);
  });

  test("saved registration state excludes blueprints", async () => {
    await saveRegistrationState({
      displayName: "Habitat One",
      habitatUuid: "uuid-1",
      habitatId: "habitat-1",
      starterModules: [],
      registeredAt: "2026-07-08T00:00:00.000Z",
    });

    const result = await loadRegistrationState();

    expect(result).toEqual({
      displayName: "Habitat One",
      habitatUuid: "uuid-1",
      habitatId: "habitat-1",
      starterModules: [],
      moduleCount: undefined,
      habitat: undefined,
      registeredAt: "2026-07-08T00:00:00.000Z",
      refreshedAt: undefined,
    });
    expect("blueprints" in (result as object)).toBe(false);
  });

  test("status refresh updates the saved local habitat name from the server", async () => {
    const savedStates: unknown[] = [];

    const result = await readKeplerHabitatStatus({
      loadRegistrationState: async () => ({
        displayName: "Habitat One",
        habitatUuid: "uuid-1",
        habitatId: "habitat-1",
        starterModules: [],
        registeredAt: "2026-07-08T00:00:00.000Z",
      }),
      requestKeplerJson: async () => ({
        habitat: {
          id: "habitat-1",
          habitatSlug: "habitat-one",
          displayName: "Habitat One (Server)",
          catalogVersion: "2026-07-08",
          status: "registered",
          lastSeenAt: null,
        },
      }),
      loadModules: async () => [],
      saveRegistrationState: async (keplerHabitat) => {
        savedStates.push(keplerHabitat);
      },
      now: () => "2026-07-09T12:00:00.000Z",
    });

    expect(result?.displayName).toBe("Habitat One (Server)");
    expect(savedStates).toEqual([
      {
        displayName: "Habitat One (Server)",
        habitatUuid: "uuid-1",
        habitatId: "habitat-1",
        starterModules: [],
        registeredAt: "2026-07-08T00:00:00.000Z",
        habitat: {
          id: "habitat-1",
          habitatSlug: "habitat-one",
          displayName: "Habitat One (Server)",
          catalogVersion: "2026-07-08",
          status: "registered",
          lastSeenAt: null,
        },
        refreshedAt: "2026-07-09T12:00:00.000Z",
        moduleCount: 0,
      },
    ]);
  });

  test("unregister clears stale local registration when Kepler reports habitat_not_registered", async () => {
    const deleted: string[] = [];
    const resetInventoryCalls: string[] = [];

    const result = await unregisterKeplerHabitat({
      loadRegistrationState: async () => ({
        displayName: "Habitat One",
        habitatUuid: "uuid-1",
        habitatId: "habitat-1",
        starterModules: [],
        registeredAt: "2026-07-08T00:00:00.000Z",
      }),
      requestKeplerJson: async () => {
        throw new Error(
          'Kepler request failed with 404: {"error":{"code":"habitat_not_registered","message":"Habitat is not registered."}}',
        );
      },
      deleteModules: async () => {
        deleted.push("modules");
      },
      deleteRegistrationState: async () => {
        deleted.push("registration");
      },
      resetInventoryQuantities: async () => {
        resetInventoryCalls.push("inventory");
        return [];
      },
    });

    expect(result.keplerHabitat.displayName).toBe("Habitat One");
    expect(result.remoteHabitatDeleted).toBe(false);
    expect(deleted).toEqual(["modules", "registration"]);
    expect(resetInventoryCalls).toEqual(["inventory"]);
  });

  test("formats unregister output using the habitat name", () => {
    expect(
      formatUnregisterKeplerHabitatResult({
        keplerHabitat: {
          displayName: "Habitat One",
          habitatUuid: "uuid-1",
          habitatId: "habitat-1",
          starterModules: [],
          registeredAt: "2026-07-08T00:00:00.000Z",
        },
        remoteHabitatDeleted: true,
      }),
    ).toBe('Unregistered habitat named "Habitat One".');
  });

  test("formats stale unregister output using the habitat name", () => {
    expect(
      formatUnregisterKeplerHabitatResult({
        keplerHabitat: {
          displayName: "Habitat One",
          habitatUuid: "uuid-1",
          habitatId: "habitat-1",
          starterModules: [],
          registeredAt: "2026-07-08T00:00:00.000Z",
        },
        remoteHabitatDeleted: false,
      }),
    ).toBe(
      'Cleared stale local registration for habitat named "Habitat One"; it was already absent in Kepler.',
    );
  });
});
