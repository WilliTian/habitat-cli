import { loadModules, saveModules } from "../modules/state";
import type { HabitatModule } from "../modules/types";
import type { BatteryDrain, PowerTickInput, PowerTickResult } from "./types";

const ticksPerHour = 3600;

type PowerTickDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
  saveModules: (modules: HabitatModule[]) => Promise<void>;
};

const defaultDependencies: PowerTickDependencies = {
  loadModules,
  saveModules,
};

export async function runPowerTicks(
  tickCount: number,
  dependencies: PowerTickDependencies = defaultDependencies,
): Promise<PowerTickResult> {
  const modules = await dependencies.loadModules();
  const result = applyPowerTicks({ modules, tickCount });
  await dependencies.saveModules(result.modules);
  return result;
}

export function applyPowerTicks(input: PowerTickInput): PowerTickResult {
  const tickCount = validateTickCount(input.tickCount);
  const timestamp = input.now ?? new Date().toISOString();
  const modules = input.modules.map((module) => ({
    ...module,
    runtimeAttributes: { ...module.runtimeAttributes },
  }));

  const activePowerDrawKw = modules.reduce((total, module) => {
    return total + resolvePowerDrawKw(module);
  }, 0);

  const energyDemandKwh = (activePowerDrawKw * tickCount) / ticksPerHour;
  const batteryDrains: BatteryDrain[] = [];
  let remainingDemandKwh = energyDemandKwh;

  for (const module of modules) {
    if (remainingDemandKwh <= 0 || !isBatteryModule(module)) {
      continue;
    }

    const beforeEnergyStoredKwh = getBatteryEnergyKwh(module);
    const drainedKwh = Math.min(beforeEnergyStoredKwh, remainingDemandKwh);
    const afterEnergyStoredKwh = beforeEnergyStoredKwh - drainedKwh;

    setBatteryEnergyKwh(module, afterEnergyStoredKwh);
    remainingDemandKwh -= drainedKwh;

    batteryDrains.push({
      moduleId: module.id,
      displayName: module.displayName,
      beforeEnergyStoredKwh,
      afterEnergyStoredKwh,
      drainedKwh,
    });
  }

  const energyDrainedKwh = energyDemandKwh - remainingDemandKwh;
  const nextModules = advanceConstructionJobs(modules, tickCount, timestamp);

  return {
    modules: nextModules,
    summary: {
      tickCount,
      activePowerDrawKw,
      energyDemandKwh,
      energyDrainedKwh,
      unmetEnergyKwh: remainingDemandKwh,
      batteryDrains,
    },
  };
}

function validateTickCount(tickCount: number): number {
  if (!Number.isInteger(tickCount) || tickCount <= 0) {
    throw new Error("Tick count must be a positive integer.");
  }

  return tickCount;
}

export function resolvePowerDrawKw(module: HabitatModule): number {
  const { powerDrawKw, status } = module.runtimeAttributes;

  if (typeof powerDrawKw === "number") {
    if (status === "offline") {
      return 0;
    }

    return powerDrawKw > 0 ? powerDrawKw : 0;
  }

  if (
    typeof status === "string" &&
    powerDrawKw !== undefined &&
    powerDrawKw !== null &&
    typeof powerDrawKw === "object"
  ) {
    const statusPowerDrawKw = powerDrawKw[status];
    return typeof statusPowerDrawKw === "number" && statusPowerDrawKw > 0
      ? statusPowerDrawKw
      : 0;
  }

  return 0;
}

function isBatteryModule(module: HabitatModule): module is HabitatModule & {
  runtimeAttributes: HabitatModule["runtimeAttributes"] &
    ({ energyStoredKwh: number } | { currentEnergyKwh: number });
} {
  return getBatteryEnergyKwh(module) > 0;
}

function getBatteryEnergyKwh(module: HabitatModule): number {
  if (typeof module.runtimeAttributes.energyStoredKwh === "number") {
    return module.runtimeAttributes.energyStoredKwh;
  }

  if (typeof module.runtimeAttributes.currentEnergyKwh === "number") {
    return module.runtimeAttributes.currentEnergyKwh;
  }

  return 0;
}

function setBatteryEnergyKwh(module: HabitatModule, value: number): void {
  if (typeof module.runtimeAttributes.energyStoredKwh === "number") {
    module.runtimeAttributes.energyStoredKwh = value;
    return;
  }

  module.runtimeAttributes.currentEnergyKwh = value;
}

function advanceConstructionJobs(
  modules: HabitatModule[],
  tickCount: number,
  timestamp: string,
): HabitatModule[] {
  const completedModules: HabitatModule[] = [];

  for (const module of modules) {
    const constructionJob = readConstructionJob(module);

    if (!constructionJob) {
      continue;
    }

    const remainingTicks = constructionJob.remainingTicks - tickCount;

    if (remainingTicks > 0) {
      module.runtimeAttributes = {
        ...module.runtimeAttributes,
        constructionJob: {
          ...constructionJob,
          remainingTicks,
        },
      };
      module.updatedAt = timestamp;
      continue;
    }

    const { constructionJob: _constructionJob, ...runtimeAttributes } =
      module.runtimeAttributes;
    module.runtimeAttributes = {
      ...runtimeAttributes,
      status: "online",
    };
    module.updatedAt = timestamp;
    completedModules.push(createConstructedModule(constructionJob, timestamp));
  }

  return [...modules, ...completedModules];
}

function readConstructionJob(
  module: HabitatModule,
): ConstructionJob | undefined {
  const value = module.runtimeAttributes.constructionJob;

  if (!isConstructionJob(value)) {
    return undefined;
  }

  return value;
}

function isConstructionJob(value: unknown): value is ConstructionJob {
  return (
    isPlainObject(value) &&
    typeof value.outputModuleId === "string" &&
    typeof value.remainingTicks === "number" &&
    isPlainObject(value.futureModule) &&
    typeof value.futureModule.blueprintId === "string" &&
    typeof value.futureModule.displayName === "string" &&
    isPlainObject(value.futureModule.runtimeAttributes) &&
    Array.isArray(value.futureModule.capabilities)
  );
}

function createConstructedModule(
  constructionJob: ConstructionJob,
  timestamp: string,
): HabitatModule {
  return {
    id: constructionJob.outputModuleId,
    blueprintId: constructionJob.futureModule.blueprintId,
    displayName: constructionJob.futureModule.displayName,
    connectedTo: [],
    runtimeAttributes: {
      ...constructionJob.futureModule.runtimeAttributes,
    },
    capabilities: [...constructionJob.futureModule.capabilities],
    source: "local",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ConstructionJob = {
  outputModuleId: string;
  remainingTicks: number;
  futureModule: {
    blueprintId: string;
    displayName: string;
    runtimeAttributes: Record<string, unknown>;
    capabilities: string[];
  };
};
