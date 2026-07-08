import { randomUUID } from "node:crypto";

import type { StarterModuleInstance } from "../kepler/types";
import { loadModules, saveModules } from "./state";
import type { HabitatModule, HabitatModuleCreateInput, HabitatModuleUpdateInput } from "./types";

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
): HabitatModule[] {
  const now = new Date().toISOString();
  return starterModules.map((starterModule) => ({
    id: starterModule.id,
    blueprintId: starterModule.blueprintId,
    displayName: starterModule.displayName,
    connectedTo: starterModule.connectedTo,
    runtimeAttributes: starterModule.runtimeAttributes,
    capabilities: starterModule.capabilities,
    source: "starter",
    createdAt: now,
    updatedAt: now,
  }));
}

export async function replaceModulesFromStarterModules(
  starterModules: StarterModuleInstance[],
): Promise<HabitatModule[]> {
  const modules = hydrateModulesFromStarterModules(starterModules);
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
  const matches = modules.filter((module) => module.id.startsWith(trimmedPrefix));

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
  return [
    `id: ${module.id}`,
    `blueprintId: ${module.blueprintId}`,
    `displayName: ${module.displayName}`,
    `source: ${module.source}`,
    `connectedTo: ${module.connectedTo.join(", ") || "null"}`,
    `capabilities: ${module.capabilities.join(", ") || "null"}`,
    `runtimeAttributes: ${JSON.stringify(module.runtimeAttributes)}`,
    `createdAt: ${module.createdAt}`,
    `updatedAt: ${module.updatedAt}`,
  ].join("\n");
}

export function formatModuleSummary(module: HabitatModule): string {
  return [
    `${shortModuleId(module.id)} ${module.displayName}`,
    `source: ${module.source}`,
  ].join(" | ");
}

function shortModuleId(id: string): string {
  return id.slice(0, 8);
}
