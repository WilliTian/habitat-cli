import { randomUUID } from "node:crypto";

import type { ProductionBlueprint, StarterModuleInstance } from "../kepler/types";
import { loadModules, saveModules } from "./state";
import type { HabitatModule, HabitatModuleCreateInput, HabitatModuleUpdateInput } from "./types";
import { resolvePowerDrawKw } from "../ticks/index";

const validModuleStatuses = ["offline", "idle", "online", "active", "damaged"] as const;

export type ModuleRuntimeStatus = (typeof validModuleStatuses)[number];

type ModuleStateDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
  saveModules: (modules: HabitatModule[]) => Promise<void>;
};

const defaultModuleStateDependencies: ModuleStateDependencies = {
  loadModules,
  saveModules,
};

export type ModuleStatusUpdate = {
  module: HabitatModule;
  status: ModuleRuntimeStatus;
  powerDrawKw: number;
};

function validateName(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedValue;
}

function normalizeStringList(values?: string[]): string[] {
  return (values ?? [])
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function createModuleRecord(
  input: HabitatModuleCreateInput,
  source: HabitatModule["source"],
): HabitatModule {
  const now = new Date().toISOString();

  return {
    id: randomUUID(),
    blueprintId: validateName(input.blueprintId, "blueprintId"),
    displayName: validateName(input.displayName, "displayName"),
    connectedTo: normalizeStringList(input.connectedTo),
    runtimeAttributes: input.runtimeAttributes ?? {},
    capabilities: normalizeStringList(input.capabilities),
    source,
    createdAt: now,
    updatedAt: now,
  };
}

export function hydrateModulesFromStarterModules(
  starterModules: StarterModuleInstance[],
  blueprints: ProductionBlueprint[] = [],
): HabitatModule[] {
  const now = new Date().toISOString();
  const blueprintsByBlueprintId = new Map(
    blueprints.map((blueprint) => [blueprint.blueprintId, blueprint]),
  );

  return starterModules.map((starterModule) => ({
    id: starterModule.id,
    blueprintId: starterModule.blueprintId,
    displayName: starterModule.displayName,
    connectedTo: starterModule.connectedTo,
    runtimeAttributes: hydrateRuntimeAttributes(
      blueprintsByBlueprintId.get(starterModule.blueprintId),
      starterModule,
    ),
    capabilities: starterModule.capabilities,
    source: "starter",
    createdAt: now,
    updatedAt: now,
  }));
}

export async function replaceModulesFromStarterModules(
  starterModules: StarterModuleInstance[],
  blueprints: ProductionBlueprint[] = [],
): Promise<HabitatModule[]> {
  const modules = hydrateModulesFromStarterModules(starterModules, blueprints);
  await saveModules(modules);
  return modules;
}

export async function listModules(): Promise<HabitatModule[]> {
  return loadModules();
}

export async function findModule(id: string): Promise<HabitatModule | undefined> {
  const modules = await loadModules();
  return modules.find((module) => module.id === id);
}

export async function findModuleByPrefix(prefix: string): Promise<HabitatModule | undefined> {
  const trimmedPrefix = prefix.trim();

  if (trimmedPrefix.length === 0) {
    throw new Error("Module id is required.");
  }

  const modules = await loadModules();
  const matches = findModulesByPrefix(modules, trimmedPrefix);

  if (matches.length === 0) {
    return undefined;
  }

  if (matches.length > 1) {
    throw new Error(`Module id "${prefix}" is ambiguous.`);
  }

  return matches[0];
}

export async function createModule(input: HabitatModuleCreateInput): Promise<HabitatModule> {
  const modules = await loadModules();
  const module = createModuleRecord(input, "local");
  modules.push(module);
  await saveModules(modules);
  return module;
}

export async function updateModule(
  id: string,
  input: HabitatModuleUpdateInput,
): Promise<HabitatModule> {
  const modules = await loadModules();
  const module = modules.find((item) => item.id === id);

  if (!module) {
    throw new Error(`Module "${id}" was not found.`);
  }

  if (input.blueprintId !== undefined) {
    module.blueprintId = validateName(input.blueprintId, "blueprintId");
  }

  if (input.displayName !== undefined) {
    module.displayName = validateName(input.displayName, "displayName");
  }

  if (input.connectedTo !== undefined) {
    module.connectedTo = normalizeStringList(input.connectedTo);
  }

  if (input.runtimeAttributes !== undefined) {
    module.runtimeAttributes = input.runtimeAttributes;
  }

  if (input.capabilities !== undefined) {
    module.capabilities = normalizeStringList(input.capabilities);
  }

  module.updatedAt = new Date().toISOString();
  await saveModules(modules);
  return module;
}

export async function updateModuleByPrefix(
  prefix: string,
  input: HabitatModuleUpdateInput,
): Promise<HabitatModule> {
  const module = await findModuleByPrefix(prefix);

  if (!module) {
    throw new Error(`Module "${prefix}" was not found.`);
  }

  return updateModule(module.id, input);
}

export async function setModuleStatus(
  prefix: string,
  status: string,
  dependencies: ModuleStateDependencies = defaultModuleStateDependencies,
): Promise<ModuleStatusUpdate> {
  const nextStatus = parseModuleRuntimeStatus(status);
  const trimmedPrefix = prefix.trim();

  if (trimmedPrefix.length === 0) {
    throw new Error("Module id is required.");
  }

  const modules = await dependencies.loadModules();
  const matches = findModulesByPrefix(modules, trimmedPrefix);

  if (matches.length === 0) {
    throw new Error(`Module "${prefix}" was not found.`);
  }

  if (matches.length > 1) {
    throw new Error(`Module id "${prefix}" is ambiguous.`);
  }

  const module = matches[0];
  module.runtimeAttributes = {
    ...module.runtimeAttributes,
    status: nextStatus,
  };

  await dependencies.saveModules(modules);

  return {
    module,
    status: nextStatus,
    powerDrawKw: resolvePowerDrawKw(module),
  };
}

export async function deleteModule(id: string): Promise<void> {
  const modules = await loadModules();
  const nextModules = modules.filter((module) => module.id !== id);

  if (nextModules.length === modules.length) {
    throw new Error(`Module "${id}" was not found.`);
  }

  await saveModules(nextModules);
}

export { loadModules } from "./state";
export { deleteModules } from "./state";

export function formatModule(module: HabitatModule): string {
  const lines = [
    `id: ${module.id}`,
    `blueprintId: ${module.blueprintId}`,
    `displayName: ${module.displayName}`,
    `source: ${module.source}`,
    `connectedTo: ${module.connectedTo.join(", ") || "null"}`,
    `capabilities: ${module.capabilities.join(", ") || "null"}`,
  ];

  appendRuntimeStateLines(lines, module);

  lines.push(`runtimeAttributes: ${JSON.stringify(module.runtimeAttributes)}`);
  lines.push(`createdAt: ${module.createdAt}`);
  lines.push(`updatedAt: ${module.updatedAt}`);

  return lines.join("\n");
}

export function formatModuleSummary(module: HabitatModule): string {
  const lines = [
    `${shortModuleId(module.id)} ${module.displayName}`,
    `source: ${module.source}`,
  ];

  const status = module.runtimeAttributes.status;
  if (typeof status === "string" && status.trim().length > 0) {
    lines.push(`status: ${status}`);
  }

  return lines.join(" | ");
}

export function formatModuleStatusUpdate(update: ModuleStatusUpdate): string {
  return [
    `moduleId: ${shortModuleId(update.module.id)}`,
    `status: ${update.status}`,
    `powerDrawKw: ${formatNumber(update.powerDrawKw)}`,
  ].join("\n");
}

function shortModuleId(id: string): string {
  const keplerModuleSuffix = id.match(/^habitat_[^_]+_[^_]+_[^_]+_[^_]+_[^_]+_(.+)$/);
  if (keplerModuleSuffix) {
    return keplerModuleSuffix[1];
  }

  return id.slice(0, 8);
}

function findModulesByPrefix(modules: HabitatModule[], prefix: string): HabitatModule[] {
  return modules.filter(
    (module) => module.id.startsWith(prefix) || shortModuleId(module.id).startsWith(prefix),
  );
}

function parseModuleRuntimeStatus(status: string): ModuleRuntimeStatus {
  const trimmedStatus = status.trim();

  if (isModuleRuntimeStatus(trimmedStatus)) {
    return trimmedStatus;
  }

  throw new Error("Status must be one of: offline, idle, online, active, damaged.");
}

function isModuleRuntimeStatus(status: string): status is ModuleRuntimeStatus {
  return validModuleStatuses.includes(status as ModuleRuntimeStatus);
}

function hydrateRuntimeAttributes(
  blueprint: ProductionBlueprint | undefined,
  starterModule: StarterModuleInstance,
): HabitatModule["runtimeAttributes"] {
  const runtimeAttributes = {
    ...(blueprint?.runtimeAttributes ?? {}),
    ...starterModule.runtimeAttributes,
  };

  if (
    typeof runtimeAttributes.energyCapacityKwh === "number" &&
    runtimeAttributes.energyStoredKwh === undefined
  ) {
    runtimeAttributes.energyStoredKwh = runtimeAttributes.energyCapacityKwh;
  }

  return runtimeAttributes;
}

function appendRuntimeStateLines(lines: string[], module: HabitatModule): void {
  const { status, health, powerDrawKw } = module.runtimeAttributes;

  if (typeof status === "string" && status.trim().length > 0) {
    lines.push(`status: ${status}`);
  }

  if (typeof health === "number") {
    lines.push(`health: ${health}`);
  }

  if (typeof powerDrawKw === "number") {
    lines.push(`powerDrawKw: ${powerDrawKw}`);
  }
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
