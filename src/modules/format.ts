import {
  formatConstructionJobLines,
  formatUsefulRuntimeAttributeLines,
  readBatteryDiagnostics,
  readModuleStatus,
} from "./diagnostics";
import type { HabitatModule } from "./types";

export type ModuleStatusUpdate = {
  module: HabitatModule;
  status: string;
  powerDrawKw: number;
};

export function formatModule(module: HabitatModule): string {
  const lines = [
    `id: ${module.id}`,
    `blueprintId: ${module.blueprintId}`,
    `displayName: ${module.displayName}`,
    `source: ${module.source}`,
    `connectedTo: ${module.connectedTo.join(", ") || "null"}`,
    `capabilities: ${module.capabilities.join(", ") || "null"}`,
  ];

  lines.push(`status: ${readModuleStatus(module)}`);
  appendBatteryLines(lines, module);
  lines.push(...formatConstructionJobLines(module));
  lines.push(...formatUsefulRuntimeAttributeLines(module));

  lines.push(`runtimeAttributes: ${JSON.stringify(module.runtimeAttributes)}`);
  lines.push(`createdAt: ${module.createdAt}`);
  lines.push(`updatedAt: ${module.updatedAt}`);

  return lines.join("\n");
}

export function formatModuleSummary(module: HabitatModule): string {
  return [
    `${shortModuleId(module.id)} ${module.displayName}`,
    `source: ${module.source}`,
    `status: ${readModuleStatus(module)}`,
  ].join(" | ");
}

export function formatModuleStatusUpdate(update: ModuleStatusUpdate): string {
  return [
    `moduleId: ${shortModuleId(update.module.id)}`,
    `status: ${update.status}`,
    `powerDrawKw: ${formatNumber(update.powerDrawKw)}`,
  ].join("\n");
}

export function shortModuleId(id: string): string {
  const keplerModuleSuffix = id.match(/^habitat_[^_]+_[^_]+_[^_]+_[^_]+_[^_]+_(.+)$/);
  if (keplerModuleSuffix) {
    return keplerModuleSuffix[1];
  }

  return id.slice(0, 8);
}

function appendBatteryLines(lines: string[], module: HabitatModule): void {
  const battery = readBatteryDiagnostics(module);

  if (!battery) {
    return;
  }

  lines.push(`batteryEnergyStoredKwh: ${formatNumber(battery.storedKwh)}`);

  if (battery.capacityKwh !== null) {
    lines.push(`batteryEnergyCapacityKwh: ${formatNumber(battery.capacityKwh)}`);
  }

  lines.push(`usableBatteryEnergyKwh: ${formatNumber(battery.usableKwh)}`);
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
