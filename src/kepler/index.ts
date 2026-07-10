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
} from "./types";
import { deleteModules } from "../modules/index";
import { loadModules, replaceModulesFromStarterModules } from "../modules/index";

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
  replaceModulesFromStarterModules: typeof replaceModulesFromStarterModules;
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
  deleteRegistrationState: typeof deleteRegistrationState;
  resetInventoryQuantities: typeof resetInventoryQuantities;
};

const defaultRegisterKeplerHabitatDependencies: RegisterKeplerHabitatDependencies = {
  loadRegistrationState,
  requestKeplerJson,
  replaceModulesFromStarterModules,
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
} from "./types";

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
    registeredAt: dependencies.now(),
  };

  await dependencies.replaceModulesFromStarterModules(response.starterModules, response.blueprints);
  keplerHabitat.moduleCount = response.starterModules.length;
  await dependencies.saveRegistrationState(keplerHabitat);
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

export function formatKeplerHabitat(keplerHabitat: KeplerHabitatState): string {
  const lines = [
    `displayName: ${keplerHabitat.displayName}`,
    `habitatUuid: ${keplerHabitat.habitatUuid}`,
    `habitatId: ${keplerHabitat.habitatId}`,
    `starterModules: ${keplerHabitat.starterModules.length}`,
    `modules: ${keplerHabitat.moduleCount ?? keplerHabitat.starterModules.length}`,
  ];

  if (keplerHabitat.habitat) {
    lines.push(`habitatSlug: ${keplerHabitat.habitat.habitatSlug}`);
    lines.push(`status: ${keplerHabitat.habitat.status}`);
    lines.push(`catalogVersion: ${keplerHabitat.habitat.catalogVersion}`);
    lines.push(`lastSeenAt: ${keplerHabitat.habitat.lastSeenAt ?? "null"}`);
  }

  if (keplerHabitat.refreshedAt) {
    lines.push(`refreshedAt: ${keplerHabitat.refreshedAt}`);
  }

  return lines.join("\n");
}

export function formatUnregisterKeplerHabitatResult(
  result: UnregisterKeplerHabitatResult,
): string {
  if (result.remoteHabitatDeleted) {
    return `Unregistered habitat named "${result.keplerHabitat.displayName}".`;
  }

  return `Cleared stale local registration for habitat named "${result.keplerHabitat.displayName}"; it was already absent in Kepler.`;
}

export function formatBlueprintSummary(blueprint: ProductionBlueprint): string {
  return `${blueprint.blueprintId} ${blueprint.displayName}`;
}

export function formatBlueprintTable(blueprints: ProductionBlueprint[]): string {
  const rows = blueprints
    .slice()
    .sort((left, right) => left.blueprintId.localeCompare(right.blueprintId))
    .map((blueprint) => ({
      blueprintId: blueprint.blueprintId,
      displayName: blueprint.displayName,
    }));

  const blueprintIdWidth = Math.max(
    "BLUEPRINT ID".length,
    ...rows.map((row) => row.blueprintId.length),
  );
  const displayNameWidth = Math.max(
    "DISPLAY NAME".length,
    ...rows.map((row) => row.displayName.length),
  );

  const lines = [
    [
      "BLUEPRINT ID".padEnd(blueprintIdWidth),
      "DISPLAY NAME",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.blueprintId.padEnd(blueprintIdWidth),
        row.displayName,
      ].join("   "),
    );
  }

  return lines.join("\n");
}

export function formatResourceTable(
  resources: IndustryResource[],
  inventory: { resourceType: string; quantity: number }[] = [],
): string {
  const inventoryByType = buildInventoryQuantityMap(inventory);
  const rows = resources
    .slice()
    .sort((left, right) => left.resourceType.localeCompare(right.resourceType))
    .map((resource) => ({
      resourceType: resource.resourceType,
      displayName: resource.displayName,
      kind: resource.kind,
      amount: formatNumber(
        resource.amount ?? inventoryByType.get(resource.resourceType) ?? 0,
      ),
      rarity: resource.rarity,
    }));

  const resourceTypeWidth = Math.max(
    "RESOURCE TYPE".length,
    ...rows.map((row) => row.resourceType.length),
  );
  const displayNameWidth = Math.max(
    "DISPLAY NAME".length,
    ...rows.map((row) => row.displayName.length),
  );
  const kindWidth = Math.max(
    "KIND".length,
    ...rows.map((row) => row.kind.length),
  );
  const amountWidth = Math.max(
    "AMOUNT".length,
    ...rows.map((row) => row.amount.length),
  );

  const lines = [
    [
      "RESOURCE TYPE".padEnd(resourceTypeWidth),
      "DISPLAY NAME".padEnd(displayNameWidth),
      "KIND".padEnd(kindWidth),
      "AMOUNT".padEnd(amountWidth),
      "RARITY",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.resourceType.padEnd(resourceTypeWidth),
        row.displayName.padEnd(displayNameWidth),
        row.kind.padEnd(kindWidth),
        row.amount.padEnd(amountWidth),
        row.rarity,
      ].join("   "),
    );
  }

  return lines.join("\n");
}

function isHabitatNotRegisteredError(error: unknown): boolean {
  return (
    error instanceof Error &&
    /^Kepler request failed with 404(?:\b|:)/.test(error.message) &&
    error.message.includes('"code":"habitat_not_registered"')
  );
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
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

export function formatBlueprint(blueprint: ProductionBlueprint): string {
  const lines = [
    blueprint.displayName,
    "",
    "Overview",
    `blueprintId: ${blueprint.blueprintId}`,
    `id: ${blueprint.id}`,
    `status: ${blueprint.status}`,
    `buildTicks: ${blueprint.buildTicks}`,
    `repeatable: ${blueprint.repeatable}`,
    `description: ${blueprint.description}`,
    "",
    "Production",
  ];

  appendStructuredValue(lines, "output", blueprint.output);
  appendStructuredValue(lines, "inputs", blueprint.inputs);
  appendStructuredValue(lines, "productionCost", blueprint.productionCost ?? null);
  appendStructuredValue(lines, "requiredFacility", blueprint.requiredFacility ?? null);
  appendStructuredValue(lines, "target", blueprint.target ?? null);
  appendStructuredValue(lines, "facilityLevel", blueprint.facilityLevel ?? null);
  appendStructuredValue(lines, "attachmentPoints", blueprint.attachmentPoints ?? null);
  appendStructuredValue(lines, "attachmentRequirements", blueprint.attachmentRequirements ?? null);

  lines.push(
    "",
    "Progression",
    `prerequisites: ${formatStringList(blueprint.prerequisites)}`,
    `unlocks: ${formatStringList(blueprint.unlocks)}`,
    `level: ${blueprint.level ?? "null"}`,
    "",
    "Runtime",
    `capabilities: ${formatStringList(blueprint.capabilities)}`,
  );

  appendStructuredValue(lines, "runtimeAttributes", blueprint.runtimeAttributes ?? null);

  return lines.join("\n");
}

function appendStructuredValue(
  lines: string[],
  label: string,
  value: unknown,
  indent = "  ",
): void {
  lines.push(`${label}:`);
  appendStructuredChildLines(lines, value, indent);
}

function appendStructuredChildLines(
  lines: string[],
  value: unknown,
  indent: string,
): void {
  if (value === null || value === undefined) {
    lines.push(`${indent}null`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${indent}[]`);
      return;
    }

    for (const item of value) {
      if (isPlainObject(item) || Array.isArray(item)) {
        lines.push(`${indent}-`);
        appendStructuredChildLines(lines, item, `${indent}  `);
      } else {
        lines.push(`${indent}- ${String(item)}`);
      }
    }
    return;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      lines.push(`${indent}{}`);
      return;
    }

    for (const [key, childValue] of entries) {
      if (isPlainObject(childValue) || Array.isArray(childValue)) {
        lines.push(`${indent}${key}:`);
        appendStructuredChildLines(lines, childValue, `${indent}  `);
      } else {
        lines.push(`${indent}${key}: ${String(childValue)}`);
      }
    }
    return;
  }

  lines.push(`${indent}${String(value)}`);
}

function formatStringList(values?: string[]): string {
  return values && values.length > 0 ? values.join(", ") : "null";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
