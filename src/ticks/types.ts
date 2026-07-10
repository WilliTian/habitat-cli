import type { SolarCondition } from "../kepler/types";
import type { HabitatModule } from "../modules/types";

export type TickSolarInput = {
  wPerM2: number;
  condition: SolarCondition;
};

export type PowerTickInput = {
  modules: HabitatModule[];
  tickCount: number;
  solarIrradiance?: TickSolarInput;
  now?: string;
};

export type BatteryDrain = {
  moduleId: string;
  displayName: string;
  beforeEnergyStoredKwh: number;
  afterEnergyStoredKwh: number;
  drainedKwh: number;
};

export type BatteryCharge = {
  moduleId: string;
  displayName: string;
  beforeEnergyStoredKwh: number;
  afterEnergyStoredKwh: number;
  chargedKwh: number;
};

export type PowerTickSummary = {
  tickCount: number;
  activePowerDrawKw: number;
  solarGenerationKw: number;
  netPowerKw: number;
  solarIrradianceWPerM2: number;
  solarCondition: SolarCondition;
  energyDemandKwh: number;
  energyChargedKwh: number;
  energyDrainedKwh: number;
  unmetEnergyKwh: number;
  batteryDrains: BatteryDrain[];
  batteryCharges: BatteryCharge[];
};

export type PowerTickResult = {
  modules: HabitatModule[];
  summary: PowerTickSummary;
};
