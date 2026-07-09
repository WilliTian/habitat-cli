export type HabitatStatusModule = {
  id: string;
  displayName: string;
  status: string;
  powerDrawKw: number;
};

export type HabitatStatus = {
  modules: HabitatStatusModule[];
  totalPowerDrawKw: number;
  energyDemandPerTickKwh: number;
};
