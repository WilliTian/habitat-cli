import { readBlueprint } from "../api/catalog";
import { HabitatApiError } from "../api/client";
import { readInventory, replaceInventory } from "../api/inventory";
import { readModules, replaceModules } from "../api/modules";
import type { HabitatInventoryResource } from "../inventory/types";
import type { ProductionBlueprint } from "../kepler/types";
import type { HabitatModule } from "../modules/types";
import type {
  CancelConstructionReport,
  ConstructDryRunReport,
  ConstructFacilityResult,
  ConstructInventoryResult,
  ConstructJob,
  ConstructResourceRequirement,
  ConstructStartReport,
  ConstructionStatusRow,
} from "./types";

export type ConstructDependencies = {
  findBlueprint: (blueprintId: string) => Promise<ProductionBlueprint | undefined>;
  loadModules: () => Promise<HabitatModule[]>;
  loadInventory: () => Promise<HabitatInventoryResource[]>;
};

export type ConstructStartDependencies = ConstructDependencies & {
  saveModules: (modules: HabitatModule[]) => Promise<void>;
  saveInventory: (inventory: HabitatInventoryResource[]) => Promise<void>;
  createOutputModuleId?: (blueprintId: string, modules: HabitatModule[]) => string;
  now: () => string;
};

export type CancelConstructionDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
  saveModules: (modules: HabitatModule[]) => Promise<void>;
  now: () => string;
};

export type ConstructionApiOperations = {
  readBlueprint: typeof readBlueprint;
  readModules: typeof readModules;
  replaceModules: typeof replaceModules;
  readInventory: typeof readInventory;
  replaceInventory: typeof replaceInventory;
};

const defaultApiOperations: ConstructionApiOperations = {
  readBlueprint,
  readModules,
  replaceModules,
  readInventory,
  replaceInventory,
};

export function createConstructionApiDependencies(
  operations: ConstructionApiOperations = defaultApiOperations,
): {
  construct: ConstructDependencies;
  start: ConstructStartDependencies;
  cancel: CancelConstructionDependencies;
} {
  const construct: ConstructDependencies = {
    findBlueprint: async (blueprintId) =>
      (await operations.readBlueprint(blueprintId)).blueprint,
    loadModules: async () => (await operations.readModules()).modules,
    loadInventory: async () => (await operations.readInventory()).inventory,
  };

  return {
    construct,
    start: {
      ...construct,
      saveModules: async (modules) => { await operations.replaceModules(modules); },
      saveInventory: async (inventory) => { await operations.replaceInventory(inventory); },
      now: () => new Date().toISOString(),
    },
    cancel: {
      loadModules: construct.loadModules,
      saveModules: async (modules) => { await operations.replaceModules(modules); },
      now: () => new Date().toISOString(),
    },
  };
}

const defaultApiDependencies = createConstructionApiDependencies();
const defaultDependencies = defaultApiDependencies.construct;
const defaultStartDependencies = defaultApiDependencies.start;
const defaultCancelDependencies = defaultApiDependencies.cancel;

export async function evaluateConstructionDryRun(
  blueprintId: string,
  dependencies: ConstructDependencies = defaultDependencies,
): Promise<ConstructDryRunReport> {
  const evaluation = await evaluateConstruction(blueprintId, dependencies);

  return {
    blueprint: evaluation.blueprint,
    buildTicks: evaluation.blueprint.buildTicks,
    requiredFacility: evaluation.requiredFacility,
    fabricatorAvailable: evaluation.fabricatorAvailable,
    supplyCacheOnline: evaluation.supplyCacheOnline,
    prerequisitesMet: evaluation.prerequisitesMet,
    inventorySufficient: evaluation.inventorySufficient,
    moduleToCreate: evaluation.blueprint.output,
    resourcesToSpend: evaluation.resourcesToSpend,
    canStart: evaluation.canStart,
  };
}

export async function startConstruction(
  blueprintId: string,
  dependencies: ConstructStartDependencies = defaultStartDependencies,
): Promise<ConstructStartReport> {
  const evaluation = await evaluateConstruction(blueprintId, dependencies);

  if (!evaluation.canStart) {
    throw new Error(formatConstructionStartFailure(evaluation));
  }

  const fabricator = evaluation.selectedFabricator;

  if (!fabricator) {
    throw new Error("No operational workshop fabricator is available.");
  }

  if (hasConstructionJob(fabricator)) {
    throw new Error(
      `Fabricator "${fabricator.id}" already has an active construction job.`,
    );
  }

  const outputModuleId = createOutputModuleId(
    evaluation.blueprint.blueprintId,
    evaluation.modules,
    dependencies.createOutputModuleId,
  );
  const futureModule = createFutureModule(evaluation.blueprint);
  const constructionJob = createConstructionJob(
    evaluation.blueprint,
    outputModuleId,
    futureModule,
  );
  const timestamp = dependencies.now();
  const nextInventory = spendConstructionResources(
    evaluation.inventory,
    evaluation.resourcesToSpend,
    timestamp,
  );
  const nextModules = attachConstructionJob(
    evaluation.modules,
    fabricator.id,
    constructionJob,
    timestamp,
  );

  await dependencies.saveInventory(nextInventory);

  try {
    await dependencies.saveModules(nextModules);
  } catch (error) {
    await dependencies.saveInventory(evaluation.inventory);
    throw error;
  }

  return {
    blueprint: evaluation.blueprint,
    fabricatorId: fabricator.id,
    fabricatorDisplayName: fabricator.displayName,
    outputModuleId,
    buildTicks: evaluation.blueprint.buildTicks,
    remainingTicks: evaluation.blueprint.buildTicks,
    futureModule,
    resourcesSpent: evaluation.resourcesToSpend,
  };
}

export async function readConstructionStatus(
  dependencies: ConstructDependencies = defaultDependencies,
): Promise<ConstructionStatusRow[]> {
  const modules = await dependencies.loadModules();

  return modules.flatMap((module) => {
    const job = readConstructionJob(module);

    if (!job) {
      return [];
    }

    return [
      {
        fabricatorId: shortModuleId(module.id),
        fabricatorDisplayName: module.displayName,
        blueprintId: job.blueprintId,
        displayName: job.displayName,
        outputModuleId: job.outputModuleId,
        buildTicks: job.buildTicks,
        remainingTicks: job.remainingTicks,
      },
    ];
  });
}

export async function cancelConstruction(
  fabricatorId: string,
  dependencies: CancelConstructionDependencies = defaultCancelDependencies,
): Promise<CancelConstructionReport> {
  const modules = await dependencies.loadModules();
  const trimmedFabricatorId = fabricatorId.trim();

  if (trimmedFabricatorId.length === 0) {
    throw new Error("Fabricator id is required.");
  }

  const matches = modules.filter(
    (module) =>
      module.id.startsWith(trimmedFabricatorId) ||
      shortModuleId(module.id).startsWith(trimmedFabricatorId),
  );

  if (matches.length === 0) {
    throw new Error(`Module "${fabricatorId}" was not found.`);
  }

  if (matches.length > 1) {
    throw new Error(`Module id "${fabricatorId}" is ambiguous.`);
  }

  const fabricator = matches[0];

  if (fabricator.blueprintId !== "workshop-fabricator") {
    throw new Error(`Module "${fabricatorId}" is not a workshop fabricator.`);
  }

  const constructionJob = readConstructionJob(fabricator);

  if (!constructionJob) {
    return {
      fabricatorId: fabricator.id,
      fabricatorDisplayName: fabricator.displayName,
      cancelled: false,
    };
  }

  const timestamp = dependencies.now();
  const nextModules = clearConstructionJob(modules, fabricator.id, timestamp);
  await dependencies.saveModules(nextModules);

  return {
    fabricatorId: fabricator.id,
    fabricatorDisplayName: fabricator.displayName,
    cancelled: true,
    displayName: constructionJob.displayName,
  };
}

async function loadBlueprintForConstruction(
  blueprintId: string,
  dependencies: ConstructDependencies,
): Promise<ProductionBlueprint | undefined> {
  try {
    return await dependencies.findBlueprint(blueprintId);
  } catch (error) {
    if (isBlueprintNotFound(error)) {
      throw new Error(`Blueprint "${blueprintId}" was not found.`);
    }

    throw error;
  }
}

async function evaluateConstruction(
  blueprintId: string,
  dependencies: ConstructDependencies,
): Promise<ConstructionEvaluation> {
  const blueprint = await loadBlueprintForConstruction(blueprintId, dependencies);

  if (!blueprint) {
    throw new Error(`Blueprint "${blueprintId}" was not found.`);
  }

  const [modules, inventory] = await Promise.all([
    dependencies.loadModules(),
    dependencies.loadInventory(),
  ]);

  const requiredFacility = evaluateRequiredFacility(blueprint, modules);
  const selectedFabricator = selectConstructionFabricator(modules);
  const fabricatorAvailable = Boolean(selectedFabricator);
  const supplyCacheOnline = hasOperationalModule(modules, "supply-cache");
  const prerequisitesMet = evaluatePrerequisites(blueprint, modules);
  const resourcesToSpend = evaluateRequiredResources(blueprint, inventory);
  const inventorySufficient: ConstructInventoryResult = {
    missing: resourcesToSpend.filter(
      (requirement) => requirement.availableQuantity < requirement.requiredQuantity,
    ),
  };

  return {
    blueprint,
    modules,
    inventory,
    requiredFacility,
    selectedFabricator,
    fabricatorAvailable,
    supplyCacheOnline,
    prerequisitesMet,
    inventorySufficient,
    resourcesToSpend,
    canStart:
      requiredFacility.exists &&
      fabricatorAvailable &&
      supplyCacheOnline &&
      prerequisitesMet.missing.length === 0 &&
      inventorySufficient.missing.length === 0,
  };
}

export function formatConstructionDryRun(report: ConstructDryRunReport): string {
  const lines = [
    `blueprintId: ${report.blueprint.blueprintId}`,
    `displayName: ${report.blueprint.displayName}`,
    `buildTicks: ${report.buildTicks}`,
    `requiredFacilityExists: ${formatYesNo(report.requiredFacility.exists)}`,
    `fabricatorAvailable: ${formatYesNo(report.fabricatorAvailable)}`,
    `supplyCacheOnline: ${formatYesNo(report.supplyCacheOnline)}`,
    `prerequisitesMet: ${formatYesNo(report.prerequisitesMet.missing.length === 0)}`,
    `missingPrerequisites: ${formatStringList(report.prerequisitesMet.missing)}`,
    `inventorySufficient: ${formatYesNo(report.inventorySufficient.missing.length === 0)}`,
    `moduleToCreate: ${JSON.stringify(report.moduleToCreate)}`,
    "resourcesToSpend:",
    formatResourceRequirementsTable(report.resourcesToSpend),
    `canStart: ${formatYesNo(report.canStart)}`,
  ];

  if (report.requiredFacility.moduleType) {
    lines.splice(4, 0, `requiredFacilityType: ${report.requiredFacility.moduleType}`);
  }

  if (report.inventorySufficient.missing.length > 0) {
    lines.splice(
      lines.length - 3,
      0,
      "missingResources:",
      formatResourceRequirementsTable(report.inventorySufficient.missing),
    );
  }

  return lines.join("\n");
}

export function formatConstructionStart(report: ConstructStartReport): string {
  return [
    `blueprintId: ${report.blueprint.blueprintId}`,
    `displayName: ${report.blueprint.displayName}`,
    `fabricatorId: ${report.fabricatorId}`,
    `fabricatorDisplayName: ${report.fabricatorDisplayName}`,
    `outputModuleId: ${report.outputModuleId}`,
    `buildTicks: ${report.buildTicks}`,
    `remainingTicks: ${report.remainingTicks}`,
    `futureModuleBlueprintId: ${report.futureModule.blueprintId}`,
    `futureModuleDisplayName: ${report.futureModule.displayName}`,
    `futureModuleRuntimeAttributes: ${JSON.stringify(report.futureModule.runtimeAttributes)}`,
    `futureModuleCapabilities: ${formatStringList(report.futureModule.capabilities)}`,
    "resourcesSpent:",
    formatResourceRequirementsTable(report.resourcesSpent),
  ].join("\n");
}

export function formatConstructionStatus(rows: ConstructionStatusRow[]): string {
  if (rows.length === 0) {
    return "No active construction jobs.";
  }

  const fabricatorWidth = Math.max(
    "FABRICATOR".length,
    ...rows.map((row) => row.fabricatorId.length),
  );
  const blueprintWidth = Math.max(
    "JOB BLUEPRINT".length,
    ...rows.map((row) => row.blueprintId.length),
  );
  const displayWidth = Math.max(
    "FUTURE MODULE".length,
    ...rows.map((row) => row.displayName.length),
  );
  const remainingWidth = Math.max(
    "REMAINING".length,
    ...rows.map((row) => String(row.remainingTicks).length),
  );

  const lines = [
    [
      "FABRICATOR".padEnd(fabricatorWidth),
      "JOB BLUEPRINT".padEnd(blueprintWidth),
      "FUTURE MODULE".padEnd(displayWidth),
      "REMAINING".padEnd(remainingWidth),
      "TOTAL",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.fabricatorId.padEnd(fabricatorWidth),
        row.blueprintId.padEnd(blueprintWidth),
        row.displayName.padEnd(displayWidth),
        String(row.remainingTicks).padEnd(remainingWidth),
        String(row.buildTicks),
      ].join("   "),
    );
  }

  return lines.join("\n");
}

export function formatCancelConstruction(report: CancelConstructionReport): string {
  if (!report.cancelled) {
    return `Fabricator "${report.fabricatorDisplayName}" has no active construction job to cancel.`;
  }

  return `Cancelled construction of "${report.displayName}" on fabricator "${report.fabricatorDisplayName}". Spent materials were not refunded.`;
}

const readyStatuses = new Set(["online", "active"]);

function evaluateRequiredFacility(
  blueprint: ProductionBlueprint,
  modules: HabitatModule[],
): ConstructFacilityResult {
  const moduleType =
    typeof blueprint.requiredFacility?.moduleType === "string"
      ? blueprint.requiredFacility.moduleType
      : null;

  if (!moduleType) {
    return {
      exists: true,
      moduleType: null,
      matchingModuleIds: [],
    };
  }

  const matches = modules.filter((module) => module.blueprintId === moduleType);

  return {
    exists: matches.length > 0,
    moduleType,
    matchingModuleIds: matches.map((module) => module.id),
  };
}

function hasOperationalModule(modules: HabitatModule[], blueprintId: string): boolean {
  return modules.some(
    (module) =>
      module.blueprintId === blueprintId &&
      readyStatuses.has(readModuleStatus(module)),
  );
}

function selectConstructionFabricator(modules: HabitatModule[]): HabitatModule | undefined {
  return modules.find(
    (module) =>
      module.blueprintId === "workshop-fabricator" &&
      readyStatuses.has(readModuleStatus(module)),
  );
}

function evaluatePrerequisites(
  blueprint: ProductionBlueprint,
  modules: HabitatModule[],
): { missing: string[] } {
  const capabilities = new Set(
    modules.flatMap((module) => module.capabilities.map((capability) => capability.trim())),
  );
  const prerequisites = (blueprint.prerequisites ?? [])
    .map((value) => value.trim())
    .filter(Boolean);

  return {
    missing: prerequisites.filter((prerequisite) => !capabilities.has(prerequisite)),
  };
}

function evaluateRequiredResources(
  blueprint: ProductionBlueprint,
  inventory: HabitatInventoryResource[],
): ConstructResourceRequirement[] {
  const inventoryByType = new Map(
    inventory.map((resource) => [resource.resourceType, resource.quantity]),
  );

  return Object.entries(blueprint.inputs)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number")
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([resourceType, requiredQuantity]) => ({
      resourceType,
      requiredQuantity,
      availableQuantity: inventoryByType.get(resourceType) ?? 0,
    }));
}

function readModuleStatus(module: HabitatModule): string {
  const status = module.runtimeAttributes.status;
  return typeof status === "string" ? status.trim() : "";
}

function hasConstructionJob(module: HabitatModule): boolean {
  return module.runtimeAttributes.constructionJob != null;
}

function readConstructionJob(module: HabitatModule): ConstructJob | undefined {
  const job = module.runtimeAttributes.constructionJob;

  if (isConstructionJob(job)) {
    return job;
  }

  return undefined;
}

function isConstructionJob(value: unknown): value is ConstructJob {
  if (!isPlainObject(value)) {
    return false;
  }

  return (
    typeof value.blueprintId === "string" &&
    typeof value.outputModuleId === "string" &&
    typeof value.displayName === "string" &&
    typeof value.buildTicks === "number" &&
    typeof value.remainingTicks === "number" &&
    isPlainObject(value.futureModule) &&
    typeof value.futureModule.blueprintId === "string" &&
    typeof value.futureModule.displayName === "string" &&
    isPlainObject(value.futureModule.runtimeAttributes) &&
    Array.isArray(value.futureModule.capabilities)
  );
}

function shortModuleId(id: string): string {
  const keplerModuleSuffix = id.match(/^habitat_[^_]+_[^_]+_[^_]+_[^_]+_[^_]+_(.+)$/);
  if (keplerModuleSuffix) {
    return keplerModuleSuffix[1];
  }

  return id.slice(0, 8);
}

function formatYesNo(value: boolean): string {
  return value ? "yes" : "no";
}

function formatStringList(values: string[]): string {
  return values.length > 0 ? values.join(", ") : "none";
}

function isBlueprintNotFound(error: unknown): boolean {
  return (
    (error instanceof HabitatApiError && error.status === 404) ||
    (error instanceof Error && /^Kepler request failed with 404(?:\b|:)/.test(error.message))
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatResourceRequirementsTable(
  requirements: ConstructResourceRequirement[],
): string {
  const rows = requirements.map((requirement) => ({
    resourceType: requirement.resourceType,
    required: formatNumber(requirement.requiredQuantity),
    available: formatNumber(requirement.availableQuantity),
  }));

  const resourceTypeWidth = Math.max(
    "RESOURCE TYPE".length,
    ...rows.map((row) => row.resourceType.length),
  );
  const requiredWidth = Math.max(
    "REQUIRED".length,
    ...rows.map((row) => row.required.length),
  );

  const lines = [
    [
      "RESOURCE TYPE".padEnd(resourceTypeWidth),
      "REQUIRED".padEnd(requiredWidth),
      "AVAILABLE",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.resourceType.padEnd(resourceTypeWidth),
        row.required.padEnd(requiredWidth),
        row.available,
      ].join("   "),
    );
  }

  return lines.join("\n");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

type ConstructionEvaluation = {
  blueprint: ProductionBlueprint;
  modules: HabitatModule[];
  inventory: HabitatInventoryResource[];
  requiredFacility: ConstructFacilityResult;
  selectedFabricator: HabitatModule | undefined;
  fabricatorAvailable: boolean;
  supplyCacheOnline: boolean;
  prerequisitesMet: { missing: string[] };
  inventorySufficient: ConstructInventoryResult;
  resourcesToSpend: ConstructResourceRequirement[];
  canStart: boolean;
};

function createFutureModule(blueprint: ProductionBlueprint): {
  blueprintId: string;
  displayName: string;
  runtimeAttributes: Record<string, unknown>;
  capabilities: string[];
} {
  return {
    blueprintId: blueprint.blueprintId,
    displayName: blueprint.displayName,
    runtimeAttributes: { ...(blueprint.runtimeAttributes ?? {}) },
    capabilities: [...(blueprint.capabilities ?? [])],
  };
}

function createConstructionJob(
  blueprint: ProductionBlueprint,
  outputModuleId: string,
  futureModule: ReturnType<typeof createFutureModule>,
): ConstructJob {
  return {
    blueprintId: blueprint.blueprintId,
    outputModuleId,
    displayName: blueprint.displayName,
    buildTicks: blueprint.buildTicks,
    remainingTicks: blueprint.buildTicks,
    futureModule,
  };
}

function attachConstructionJob(
  modules: HabitatModule[],
  fabricatorId: string,
  constructionJob: ConstructJob,
  updatedAt: string,
): HabitatModule[] {
  return modules.map((module) => {
    if (module.id !== fabricatorId) {
      return module;
    }

    return {
      ...module,
      runtimeAttributes: {
        ...module.runtimeAttributes,
        status: "active",
        constructionJob,
      },
      updatedAt,
    };
  });
}

function clearConstructionJob(
  modules: HabitatModule[],
  fabricatorId: string,
  updatedAt: string,
): HabitatModule[] {
  return modules.map((module) => {
    if (module.id !== fabricatorId) {
      return module;
    }

    const { constructionJob: _constructionJob, ...runtimeAttributes } =
      module.runtimeAttributes;

    return {
      ...module,
      runtimeAttributes: {
        ...runtimeAttributes,
        status: "online",
      },
      updatedAt,
    };
  });
}

function spendConstructionResources(
  inventory: HabitatInventoryResource[],
  resourcesSpent: ConstructResourceRequirement[],
  updatedAt: string,
): HabitatInventoryResource[] {
  const remainingSpend = new Map(
    resourcesSpent.map((resource) => [resource.resourceType, resource.requiredQuantity]),
  );

  return inventory.map((resource) => {
    const amountToSpend = remainingSpend.get(resource.resourceType) ?? 0;

    if (amountToSpend <= 0) {
      return resource;
    }

    const spent = Math.min(resource.quantity, amountToSpend);
    remainingSpend.set(resource.resourceType, amountToSpend - spent);

    return {
      ...resource,
      quantity: resource.quantity - spent,
      updatedAt,
    };
  });
}

function formatConstructionStartFailure(evaluation: ConstructionEvaluation): string {
  const reasons: string[] = [];

  if (!evaluation.requiredFacility.exists) {
    reasons.push("Required facility is missing.");
  }

  if (!evaluation.fabricatorAvailable) {
    reasons.push("No operational workshop fabricator is available.");
  }

  if (!evaluation.supplyCacheOnline) {
    reasons.push("Supply cache is offline.");
  }

  if (evaluation.prerequisitesMet.missing.length > 0) {
    reasons.push(`Missing prerequisites: ${evaluation.prerequisitesMet.missing.join(", ")}.`);
  }

  if (evaluation.inventorySufficient.missing.length > 0) {
    reasons.push(
      `Insufficient inventory: ${evaluation.inventorySufficient.missing
        .map((resource) => `${resource.resourceType} (${resource.availableQuantity}/${resource.requiredQuantity})`)
        .join(", ")}.`,
    );
  }

  if (reasons.length === 0) {
    return "Construction cannot start.";
  }

  return ["Construction cannot start.", ...reasons].join("\n");
}

function createOutputModuleId(
  blueprintId: string,
  modules: HabitatModule[],
  override?: (blueprintId: string, modules: HabitatModule[]) => string,
): string {
  if (override) {
    return override(blueprintId, modules);
  }

  const slug = toModuleIdSlug(blueprintId);
  const reservedIds = new Set<string>();

  for (const module of modules) {
    reservedIds.add(module.id);

    const constructionJob = readConstructionJob(module);
    if (constructionJob) {
      reservedIds.add(constructionJob.outputModuleId);
    }
  }

  let index = 1;

  while (reservedIds.has(`${slug}_${index}`)) {
    index += 1;
  }

  return `${slug}_${index}`;
}

function toModuleIdSlug(blueprintId: string): string {
  return blueprintId
    .trim()
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
}
