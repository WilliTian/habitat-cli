export type ModuleRuntimeAttributes = Record<string, unknown> & {
  // Kepler docs define runtime module state inside runtimeAttributes.
  status?: string;
  health?: number;
  powerDrawKw?: number | Record<string, number>;
  energyStoredKwh?: number;
  energyCapacityKwh?: number;
  currentEnergyKwh?: number;
  energyStorageKwh?: number;
};

export type HabitatModule = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: ModuleRuntimeAttributes;
  capabilities: string[];
  source: "starter" | "local";
  createdAt: string;
  updatedAt: string;
};

export type HabitatModuleCreateInput = {
  blueprintId: string;
  displayName: string;
  connectedTo?: string[];
  runtimeAttributes?: ModuleRuntimeAttributes;
  capabilities?: string[];
};

export type HabitatModuleUpdateInput = {
  blueprintId?: string;
  displayName?: string;
  connectedTo?: string[];
  runtimeAttributes?: ModuleRuntimeAttributes;
  capabilities?: string[];
};
