import { readModules, replaceModules } from "../api/modules";
import { readSolarIrradianceResource } from "../api/solar";
import type { HabitatModule } from "../modules/types";
import { resolvePowerDrawKw } from "./power";
import type {
  BatteryCharge,
  BatteryDrain,
  PowerTickInput,
  PowerTickResult,
  TickSolarInput,
} from "./types";

const ticksPerHour = 3600;
const fullSunIrradianceWPerM2 = 900;
const solarEfficiency = 0.5;

export { resolvePowerDrawKw } from "./power";

type PowerTickDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
  saveModules: (modules: HabitatModule[]) => Promise<void>;
  readSolarIrradiance: () => Promise<TickSolarInput>;
};

const defaultDependencies: PowerTickDependencies = {
  loadModules: async () => (await readModules()).modules,
  saveModules: async (modules) => { await replaceModules(modules); },
  readSolarIrradiance: async () =>
    (await readSolarIrradianceResource()).solarIrradiance,
};

export async function runPowerTicks(
  tickCount: number,
  dependencies: PowerTickDependencies = defaultDependencies,
): Promise<PowerTickResult> {
  const [modules, solarIrradiance] = await Promise.all([
    dependencies.loadModules(),
    dependencies.readSolarIrradiance(),
  ]);
  const result = applyPowerTicks({ modules, tickCount, solarIrradiance });
  await dependencies.saveModules(result.modules);
  return result;
}

export function applyPowerTicks(input: PowerTickInput): PowerTickResult {
  const tickCount = validateTickCount(input.tickCount);
  const timestamp = input.now ?? new Date().toISOString();
  const solarIrradiance = input.solarIrradiance ?? {
    wPerM2: 0,
    condition: "night" as const,
  };
  const modules = input.modules.map((module) => ({
    ...module,
    runtimeAttributes: { ...module.runtimeAttributes },
  }));

  const activePowerDrawKw = modules.reduce((total, module) => {
    return total + resolvePowerDrawKw(module);
  }, 0);

  const solarGenerationKw = modules.reduce((total, module) => {
    return total + resolveSolarGenerationKw(module, solarIrradiance);
  }, 0);
  const netPowerKw = activePowerDrawKw - solarGenerationKw;
  const grossEnergyDemandKwh = (activePowerDrawKw * tickCount) / ticksPerHour;
  const solarEnergyGeneratedKwh = (solarGenerationKw * tickCount) / ticksPerHour;
  const energyDemandKwh = Math.max(
    grossEnergyDemandKwh - solarEnergyGeneratedKwh,
    0,
  );
  const solarSurplusEnergyKwh = Math.max(
    solarEnergyGeneratedKwh - grossEnergyDemandKwh,
    0,
  );
  const batteryDrains: BatteryDrain[] = [];
  const batteryCharges: BatteryCharge[] = [];
  let remainingDemandKwh = energyDemandKwh;
  let remainingSolarSurplusEnergyKwh = solarSurplusEnergyKwh;

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

  for (const module of modules) {
    if (remainingSolarSurplusEnergyKwh <= 0 || !isChargeableBatteryModule(module)) {
      continue;
    }

    const beforeEnergyStoredKwh = getBatteryEnergyKwh(module);
    const capacityKwh = getBatteryCapacityKwh(module);
    if (capacityKwh === null) {
      continue;
    }
    const availableCapacityKwh = Math.max(capacityKwh - beforeEnergyStoredKwh, 0);
    const chargedKwh = Math.min(availableCapacityKwh, remainingSolarSurplusEnergyKwh);

    if (chargedKwh <= 0) {
      continue;
    }

    const afterEnergyStoredKwh = beforeEnergyStoredKwh + chargedKwh;
    setBatteryEnergyKwh(module, afterEnergyStoredKwh);
    remainingSolarSurplusEnergyKwh -= chargedKwh;

    batteryCharges.push({
      moduleId: module.id,
      displayName: module.displayName,
      beforeEnergyStoredKwh,
      afterEnergyStoredKwh,
      chargedKwh,
    });
  }

  const energyDrainedKwh = energyDemandKwh - remainingDemandKwh;
  const energyChargedKwh = solarSurplusEnergyKwh - remainingSolarSurplusEnergyKwh;
  const nextModules = advanceConstructionJobs(modules, tickCount, timestamp);

  return {
    modules: nextModules,
    summary: {
      tickCount,
      activePowerDrawKw,
      solarGenerationKw,
      solarEnergyGeneratedKwh,
      netPowerKw,
      solarIrradianceWPerM2: solarIrradiance.wPerM2,
      solarCondition: solarIrradiance.condition,
      solarChargingStatus: resolveSolarChargingStatus({
        modules,
        solarIrradiance,
        solarGenerationKw,
        solarEnergyGeneratedKwh,
        grossEnergyDemandKwh,
        energyChargedKwh,
      }),
      energyDemandKwh,
      grossEnergyDemandKwh,
      energyChargedKwh,
      energyDrainedKwh,
      unmetEnergyKwh: remainingDemandKwh,
      batteryDrains,
      batteryCharges,
    },
  };
}

function validateTickCount(tickCount: number): number {
  if (!Number.isInteger(tickCount) || tickCount <= 0) {
    throw new Error("Tick count must be a positive integer.");
  }

  return tickCount;
}

export function resolveSolarGenerationKw(
  module: HabitatModule,
  solarIrradiance: TickSolarInput,
): number {
  const powerGenerationKw = resolvePowerGenerationKw(module);

  if (
    module.runtimeAttributes.status !== "online" ||
    solarIrradiance.condition === "night" ||
    powerGenerationKw <= 0 ||
    !hasSolarGenerationCapability(module)
  ) {
    return 0;
  }

  const solarMultiplier = Math.max(solarIrradiance.wPerM2, 0) / fullSunIrradianceWPerM2;
  return powerGenerationKw * solarMultiplier * solarEfficiency;
}

function hasSolarGenerationCapability(module: HabitatModule): boolean {
  return (
    module.capabilities.includes("power-generation") ||
    module.capabilities.includes("solar-generation")
  );
}

function resolvePowerGenerationKw(module: HabitatModule): number {
  const { powerGenerationKw, generationKw } = module.runtimeAttributes;

  if (typeof powerGenerationKw === "number") {
    return powerGenerationKw;
  }

  if (typeof generationKw === "number") {
    return generationKw;
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

function getBatteryCapacityKwh(module: HabitatModule): number | null {
  if (typeof module.runtimeAttributes.energyCapacityKwh === "number") {
    return module.runtimeAttributes.energyCapacityKwh;
  }

  if (typeof module.runtimeAttributes.energyStorageKwh === "number") {
    return module.runtimeAttributes.energyStorageKwh;
  }

  return null;
}

function setBatteryEnergyKwh(module: HabitatModule, value: number): void {
  if (typeof module.runtimeAttributes.energyStoredKwh === "number") {
    module.runtimeAttributes.energyStoredKwh = value;
    return;
  }

  module.runtimeAttributes.currentEnergyKwh = value;
}

function isChargeableBatteryModule(module: HabitatModule): boolean {
  const capacityKwh = getBatteryCapacityKwh(module);

  return (
    module.runtimeAttributes.status === "online" &&
    capacityKwh !== null &&
    getBatteryEnergyKwh(module) < capacityKwh
  );
}

function resolveSolarChargingStatus(input: {
  modules: HabitatModule[];
  solarIrradiance: TickSolarInput;
  solarGenerationKw: number;
  solarEnergyGeneratedKwh: number;
  grossEnergyDemandKwh: number;
  energyChargedKwh: number;
}): string {
  if (input.energyChargedKwh > 0) {
    return `charged ${formatSummaryNumber(input.energyChargedKwh)} kWh into batteries`;
  }

  if (input.solarIrradiance.condition === "night" || input.solarIrradiance.wPerM2 <= 0) {
    return "no sunlight is available";
  }

  if (!input.modules.some((module) => resolveSolarGenerationKw(module, input.solarIrradiance) > 0)) {
    return "no online solar modules are generating power";
  }

  if (input.solarEnergyGeneratedKwh <= input.grossEnergyDemandKwh) {
    return "solar power was used by active modules";
  }

  if (!input.modules.some(hasOnlineBatteryCapacity)) {
    return "no online batteries can accept charge";
  }

  if (input.solarEnergyGeneratedKwh <= 0 || input.solarGenerationKw <= 0) {
    return "no solar power was generated";
  }

  return "solar power was generated but no battery charge was added";
}

function hasOnlineBatteryCapacity(module: HabitatModule): boolean {
  const capacityKwh = getBatteryCapacityKwh(module);

  return (
    module.runtimeAttributes.status === "online" &&
    capacityKwh !== null &&
    getBatteryEnergyKwh(module) < capacityKwh
  );
}

function formatSummaryNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
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
