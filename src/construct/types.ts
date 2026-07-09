import type { ProductionBlueprint } from "../kepler/types";

export type ConstructResourceRequirement = {
  resourceType: string;
  requiredQuantity: number;
  availableQuantity: number;
};

export type ConstructCheckResult = {
  ok: boolean;
  details: string;
};

export type ConstructMissingPrerequisites = {
  missing: string[];
};

export type ConstructInventoryResult = {
  missing: ConstructResourceRequirement[];
};

export type ConstructFacilityResult = {
  exists: boolean;
  moduleType: string | null;
  matchingModuleIds: string[];
};

export type ConstructFutureModule = {
  blueprintId: string;
  displayName: string;
  runtimeAttributes: Record<string, unknown>;
  capabilities: string[];
};

export type ConstructJob = {
  blueprintId: string;
  outputModuleId: string;
  displayName: string;
  buildTicks: number;
  remainingTicks: number;
  futureModule: ConstructFutureModule;
};

export type ConstructDryRunReport = {
  blueprint: ProductionBlueprint;
  buildTicks: number;
  requiredFacility: ConstructFacilityResult;
  fabricatorAvailable: boolean;
  supplyCacheOnline: boolean;
  prerequisitesMet: ConstructMissingPrerequisites;
  inventorySufficient: ConstructInventoryResult;
  moduleToCreate: Record<string, unknown>;
  resourcesToSpend: ConstructResourceRequirement[];
  canStart: boolean;
};

export type ConstructStartReport = {
  blueprint: ProductionBlueprint;
  fabricatorId: string;
  fabricatorDisplayName: string;
  outputModuleId: string;
  buildTicks: number;
  remainingTicks: number;
  futureModule: ConstructFutureModule;
  resourcesSpent: ConstructResourceRequirement[];
};

export type ConstructionStatusRow = {
  fabricatorId: string;
  fabricatorDisplayName: string;
  blueprintId: string;
  displayName: string;
  outputModuleId: string;
  buildTicks: number;
  remainingTicks: number;
};
