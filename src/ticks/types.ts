import type { HabitatModule } from "../modules/types";

export type PowerTickInput = {
  modules: HabitatModule[];
  tickCount: number;
  now?: string;
};

export type BatteryDrain = {
  moduleId: string;
  displayName: string;
  beforeEnergyStoredKwh: number;
  afterEnergyStoredKwh: number;
  drainedKwh: number;
};

export type PowerTickSummary = {
  tickCount: number;
  activePowerDrawKw: number;
  energyDemandKwh: number;
  energyDrainedKwh: number;
  unmetEnergyKwh: number;
  batteryDrains: BatteryDrain[];
};

export type PowerTickResult = {
  modules: HabitatModule[];
  summary: PowerTickSummary;
};
