import { loadModules } from "../modules/state";
import type { HabitatModule } from "../modules/types";
import { resolvePowerDrawKw } from "../ticks/index";
import type { HabitatStatus } from "./types";

const ticksPerHour = 3600;

type HabitatStatusDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
};

const defaultDependencies: HabitatStatusDependencies = {
  loadModules,
};

export async function readHabitatStatus(
  dependencies: HabitatStatusDependencies = defaultDependencies,
): Promise<HabitatStatus> {
  const modules = await dependencies.loadModules();
  return buildHabitatStatus(modules);
}

export function buildHabitatStatus(modules: HabitatModule[]): HabitatStatus {
  const statusModules = modules.map((module) => ({
    id: module.id,
    displayName: module.displayName,
    state: getModuleState(module),
    powerDrawKw: resolvePowerDrawKw(module),
  }));

  const totalPowerDrawKw = statusModules.reduce(
    (total, module) => total + module.powerDrawKw,
    0,
  );

  return {
    modules: statusModules,
    totalPowerDrawKw,
    energyDemandPerTickKwh: totalPowerDrawKw / ticksPerHour,
  };
}

export function formatHabitatStatus(status: HabitatStatus): string {
  const lines = status.modules.map((module) =>
    [
      module.displayName,
      `state: ${module.state}`,
      `powerDrawKw: ${formatNumber(module.powerDrawKw)}`,
    ].join(" | "),
  );

  if (lines.length === 0) {
    lines.push("No local modules found.");
  }

  lines.push(`totalPowerDrawKw: ${formatNumber(status.totalPowerDrawKw)}`);
  lines.push(`energyDemandPerTickKwh: ${formatNumber(status.energyDemandPerTickKwh)}`);
  lines.push(
    `tickComparison: habitat tick 10 drains about ${formatNumber(
      status.energyDemandPerTickKwh * 10,
    )} kWh`,
  );

  return lines.join("\n");
}

function getModuleState(module: HabitatModule): string {
  const state = module.runtimeAttributes.status;
  return typeof state === "string" && state.trim().length > 0 ? state : "unknown";
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
