export type HabitatStatusModule = {
  id: string;
  displayName: string;
  state: string;
  powerDrawKw: number;
};

export type HabitatStatus = {
  modules: HabitatStatusModule[];
  totalPowerDrawKw: number;
  energyDemandPerTickKwh: number;
};
