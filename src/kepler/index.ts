import { randomUUID } from "node:crypto";

import { requestKeplerJson } from "./client";
import {
  deleteRegistrationState,
  loadRegistrationState,
  saveRegistrationState,
} from "./state";
import { loadInventory, resetInventoryQuantities } from "../inventory/index";
import type {
  BlueprintCatalogResponse,
  BlueprintResponse,
  HabitatRegistrationInput,
  HabitatRegistrationResponse,
  HabitatResponse,
  IndustryResource,
  KeplerHabitatState,
  ProductionBlueprint,
  ResourceCatalogResponse,
  SolarIrradianceReading,
  SolarIrradianceResponse,
  UnregisterKeplerHabitatResult,
  WorldScanInput,
  WorldScanResponse,
} from "./types";
import { deleteModules } from "../modules/index";
import { loadModules, replaceModulesFromStarterModules } from "../modules/index";
import { deleteHumans, replaceStarterHumans } from "../humans/index";
import { deleteEvaState } from "../eva/index";

function validateName(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedValue;
}

type RegisterKeplerHabitatDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  requestKeplerJson: typeof requestKeplerJson;
  replaceStarterHumans: typeof replaceStarterHumans;
  replaceModulesFromStarterModules: typeof replaceModulesFromStarterModules;
  deleteModules: typeof deleteModules;
  deleteHumans: typeof deleteHumans;
  deleteEvaState?: typeof deleteEvaState;
  deleteRegistrationState: typeof deleteRegistrationState;
  saveRegistrationState: typeof saveRegistrationState;
  createHabitatUuid: () => string;
  now: () => string;
};

type BlueprintCatalogDependencies = {
  requestKeplerJson: typeof requestKeplerJson;
};

type ResourceCatalogDependencies = BlueprintCatalogDependencies & {
  loadInventory: typeof loadInventory;
};

type SolarIrradianceDependencies = {
  requestKeplerJson: typeof requestKeplerJson;
};

type WorldScanDependencies = {
  requestKeplerJson: typeof requestKeplerJson;
};

type ReadKeplerHabitatStatusDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  requestKeplerJson: typeof requestKeplerJson;
  loadModules: typeof loadModules;
  saveRegistrationState: typeof saveRegistrationState;
  now: () => string;
};

type UnregisterKeplerHabitatDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  requestKeplerJson: typeof requestKeplerJson;
  deleteModules: typeof deleteModules;
  deleteHumans: typeof deleteHumans;
  deleteEvaState?: typeof deleteEvaState;
  deleteRegistrationState: typeof deleteRegistrationState;
  resetInventoryQuantities: typeof resetInventoryQuantities;
};

const defaultRegisterKeplerHabitatDependencies: RegisterKeplerHabitatDependencies = {
  loadRegistrationState,
  requestKeplerJson,
  replaceStarterHumans,
  replaceModulesFromStarterModules,
  deleteModules,
  deleteHumans,
  deleteEvaState,
  deleteRegistrationState,
  saveRegistrationState,
  createHabitatUuid: randomUUID,
  now: () => new Date().toISOString(),
};

const defaultBlueprintCatalogDependencies: BlueprintCatalogDependencies = {
  requestKeplerJson,
};

const defaultResourceCatalogDependencies: ResourceCatalogDependencies = {
  requestKeplerJson,
  loadInventory,
};

const defaultSolarIrradianceDependencies: SolarIrradianceDependencies = {
  requestKeplerJson,
};

const defaultWorldScanDependencies: WorldScanDependencies = {
  requestKeplerJson,
};

const defaultReadKeplerHabitatStatusDependencies: ReadKeplerHabitatStatusDependencies = {
  loadRegistrationState,
  requestKeplerJson,
  loadModules,
  saveRegistrationState,
  now: () => new Date().toISOString(),
};

const defaultUnregisterKeplerHabitatDependencies: UnregisterKeplerHabitatDependencies = {
  loadRegistrationState,
  requestKeplerJson,
  deleteModules,
  deleteHumans,
  deleteEvaState,
  deleteRegistrationState,
  resetInventoryQuantities,
};

export type {
  Habitat,
  HabitatRegistrationInput,
  IndustryResource,
  KeplerHabitatState,
  ProductionBlueprint,
  ResourceCatalogResponse,
  SolarCondition,
  SolarIrradianceReading,
  SolarIrradianceResponse,
  StarterModuleInstance,
  UnregisterKeplerHabitatResult,
  WorldScanInput,
  WorldScanProbability,
  WorldScanQuantityEstimate,
  WorldScanResponse,
  WorldScanTile,
} from "./types";
export {
  formatBlueprint,
  formatBlueprintSummary,
  formatBlueprintTable,
  formatKeplerHabitat,
  formatResourceTable,
  formatSolarIrradianceStatus,
  formatUnregisterKeplerHabitatResult,
} from "./format";

export async function registerKeplerHabitat(
  input: HabitatRegistrationInput,
  dependencies: RegisterKeplerHabitatDependencies = defaultRegisterKeplerHabitatDependencies,
): Promise<KeplerHabitatState> {
  const existingKeplerHabitat = await dependencies.loadRegistrationState();

  if (existingKeplerHabitat) {
    throw new Error(
      `A Kepler habitat is already registered for "${existingKeplerHabitat.displayName}". Run habitat unregister first.`,
    );
  }

  const displayName = validateName(input.displayName, "displayName");
  const habitatUuid = dependencies.createHabitatUuid();
  const response = await dependencies.requestKeplerJson<HabitatRegistrationResponse>("/habitats/register", {
    method: "POST",
    expectedStatus: 201,
    body: {
      displayName,
      habitatUuid,
    },
  });

  const keplerHabitat: KeplerHabitatState = {
    displayName: response.habitat?.displayName ?? displayName,
    habitatUuid,
    habitatId: response.habitatId,
    starterModules: response.starterModules,
    alertContract: response.contracts.alerts,
    registeredAt: dependencies.now(),
  };

  try {
    await dependencies.replaceModulesFromStarterModules(response.starterModules, response.blueprints);
    await dependencies.replaceStarterHumans(response.starterHumans);
    keplerHabitat.moduleCount = response.starterModules.length;
    await dependencies.saveRegistrationState(keplerHabitat);
  } catch (error) {
    await dependencies.deleteModules();
    await dependencies.deleteHumans();
    await dependencies.deleteEvaState?.();
    await dependencies.deleteRegistrationState();
    throw error;
  }
  return keplerHabitat;
}

export async function readKeplerHabitatStatus(
  dependencies: ReadKeplerHabitatStatusDependencies = defaultReadKeplerHabitatStatusDependencies,
): Promise<KeplerHabitatState | undefined> {
  const keplerHabitat = await dependencies.loadRegistrationState();

  if (!keplerHabitat) {
    return undefined;
  }

  const response = await dependencies.requestKeplerJson<HabitatResponse>(
    `/habitats/${encodeURIComponent(keplerHabitat.habitatId)}/registration`,
    {
      method: "GET",
      expectedStatus: 200,
    },
  );

  keplerHabitat.displayName = response.habitat.displayName;
  keplerHabitat.habitat = response.habitat;
  keplerHabitat.refreshedAt = dependencies.now();
  keplerHabitat.moduleCount = (await dependencies.loadModules()).length;
  await dependencies.saveRegistrationState(keplerHabitat);

  return keplerHabitat;
}

export async function unregisterKeplerHabitat(
  dependencies: UnregisterKeplerHabitatDependencies = defaultUnregisterKeplerHabitatDependencies,
): Promise<UnregisterKeplerHabitatResult> {
  const keplerHabitat = await dependencies.loadRegistrationState();

  if (!keplerHabitat) {
    throw new Error("No Kepler habitat registration was found.");
  }

  let remoteHabitatDeleted = true;

  try {
    await dependencies.requestKeplerJson<void>(
      `/habitats/${encodeURIComponent(keplerHabitat.habitatId)}`,
      {
        method: "DELETE",
        expectedStatus: 204,
      },
    );
  } catch (error) {
    if (!isHabitatNotRegisteredError(error)) {
      throw error;
    }

    remoteHabitatDeleted = false;
  }

  await dependencies.deleteModules();
  await dependencies.deleteHumans();
  await dependencies.deleteEvaState?.();
  await dependencies.resetInventoryQuantities();
  await dependencies.deleteRegistrationState();
  return {
    keplerHabitat,
    remoteHabitatDeleted,
  };
}

export async function listBlueprints(
  dependencies: BlueprintCatalogDependencies = defaultBlueprintCatalogDependencies,
): Promise<ProductionBlueprint[]> {
  const response = await dependencies.requestKeplerJson<BlueprintCatalogResponse>("/catalog/blueprints", {
    method: "GET",
    expectedStatus: 200,
  });
  return response.blueprints;
}

export async function findBlueprint(
  blueprintId: string,
  dependencies: BlueprintCatalogDependencies = defaultBlueprintCatalogDependencies,
): Promise<ProductionBlueprint | undefined> {
  const trimmedBlueprintId = validateName(blueprintId, "blueprintId");
  const response = await dependencies.requestKeplerJson<BlueprintResponse>(
    `/catalog/blueprints/${encodeURIComponent(trimmedBlueprintId)}`,
    {
      method: "GET",
      expectedStatus: 200,
    },
  );
  return response.blueprint;
}

export async function listResources(
  dependencies: ResourceCatalogDependencies = defaultResourceCatalogDependencies,
): Promise<IndustryResource[]> {
  const response = await dependencies.requestKeplerJson<ResourceCatalogResponse>("/catalog/resources", {
    method: "GET",
    expectedStatus: 200,
  });
  const inventory = await dependencies.loadInventory();
  return mergeResourcesWithInventory(response.resources, inventory);
}

export async function readSolarIrradiance(
  dependencies: SolarIrradianceDependencies = defaultSolarIrradianceDependencies,
): Promise<SolarIrradianceReading> {
  const response = await dependencies.requestKeplerJson<SolarIrradianceResponse>("/world/solar-irradiance", {
    method: "GET",
    expectedStatus: 200,
  });

  return response.solarIrradiance;
}

export async function scanWorldResources(
  input: WorldScanInput,
  dependencies: WorldScanDependencies = defaultWorldScanDependencies,
): Promise<WorldScanResponse> {
  const params = new URLSearchParams({
    habitatId: input.habitatId,
    x: String(input.x),
    y: String(input.y),
    sensorStrength: String(input.sensorStrength),
    radiusTiles: String(input.radiusTiles),
  });

  return dependencies.requestKeplerJson<WorldScanResponse>(`/world/scan?${params}`, {
    method: "GET",
    expectedStatus: 200,
  });
}

function isHabitatNotRegisteredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^Kepler request failed with 404(?:\b|:)/.test(error.message) &&
    error.message.includes('"code":"habitat_not_registered"')
  );
}

function mergeResourcesWithInventory(
  resources: IndustryResource[],
  inventory: { resourceType: string; quantity: number }[],
): IndustryResource[] {
  const inventoryByType = buildInventoryQuantityMap(inventory);

  return resources.map((resource) => ({
    ...resource,
    amount: inventoryByType.get(resource.resourceType) ?? 0,
  })) as IndustryResource[];
}

function buildInventoryQuantityMap(
  inventory: { resourceType: string; quantity: number }[],
): Map<string, number> {
  const inventoryByType = new Map<string, number>();

  for (const resource of inventory) {
    inventoryByType.set(
      resource.resourceType,
      (inventoryByType.get(resource.resourceType) ?? 0) + resource.quantity,
    );
  }

  return inventoryByType;
}
