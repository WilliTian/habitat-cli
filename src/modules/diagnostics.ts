import type { HabitatModule } from "./types";

export type ModuleBatteryDiagnostics = {
  storedKwh: number;
  capacityKwh: number | null;
  usableKwh: number;
};

export function readModuleStatus(module: HabitatModule): string {
  const status = module.runtimeAttributes.status;
  return typeof status === "string" && status.trim().length > 0 ? status.trim() : "unknown";
}

export function readBatteryDiagnostics(
  module: HabitatModule,
): ModuleBatteryDiagnostics | undefined {
  const storedKwh = readStoredBatteryEnergyKwh(module);
  const capacityKwh = readBatteryCapacityKwh(module);

  if (storedKwh === null && capacityKwh === null) {
    return undefined;
  }

  return {
    storedKwh: storedKwh ?? 0,
    capacityKwh,
    usableKwh: Math.max(storedKwh ?? 0, 0),
  };
}

export function hasConstructionJob(module: HabitatModule): boolean {
  return isPlainObject(module.runtimeAttributes.constructionJob);
}

export function formatConstructionJobLines(module: HabitatModule): string[] {
  const job = module.runtimeAttributes.constructionJob;

  if (!isPlainObject(job)) {
    return [];
  }

  const lines = ["activeConstructionJob:"];

  if (typeof job.blueprintId === "string") {
    lines.push(`  blueprintId: ${job.blueprintId}`);
  }

  if (typeof job.displayName === "string") {
    lines.push(`  displayName: ${job.displayName}`);
  }

  if (typeof job.outputModuleId === "string") {
    lines.push(`  outputModuleId: ${job.outputModuleId}`);
  }

  if (typeof job.remainingTicks === "number") {
    lines.push(`  remainingTicks: ${formatNumber(job.remainingTicks)}`);
  }

  if (typeof job.buildTicks === "number") {
    lines.push(`  buildTicks: ${formatNumber(job.buildTicks)}`);
  }

  return lines;
}

export function formatUsefulRuntimeAttributeLines(module: HabitatModule): string[] {
  const ignoredKeys = new Set([
    "status",
    "constructionJob",
    "energyStoredKwh",
    "energyCapacityKwh",
    "currentEnergyKwh",
    "energyStorageKwh",
  ]);

  return Object.entries(module.runtimeAttributes)
    .filter(([key, value]) => !ignoredKeys.has(key) && isDisplayableRuntimeValue(value))
    .map(([key, value]) => `${key}: ${String(value)}`);
}

function readStoredBatteryEnergyKwh(module: HabitatModule): number | null {
  if (typeof module.runtimeAttributes.energyStoredKwh === "number") {
    return module.runtimeAttributes.energyStoredKwh;
  }

  if (typeof module.runtimeAttributes.currentEnergyKwh === "number") {
    return module.runtimeAttributes.currentEnergyKwh;
  }

  return null;
}

function readBatteryCapacityKwh(module: HabitatModule): number | null {
  if (typeof module.runtimeAttributes.energyCapacityKwh === "number") {
    return module.runtimeAttributes.energyCapacityKwh;
  }

  if (typeof module.runtimeAttributes.energyStorageKwh === "number") {
    return module.runtimeAttributes.energyStorageKwh;
  }

  return null;
}

function isDisplayableRuntimeValue(value: unknown): boolean {
  return (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
