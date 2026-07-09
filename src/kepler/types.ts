export type StarterModuleInstance = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: Record<string, unknown>;
  capabilities: string[];
};

export type ProductionBlueprint = {
  id: string;
  blueprintId: string;
  displayName: string;
  description: string;
  status: "draft" | "published";
  output: Record<string, unknown>;
  inputs: Record<string, unknown>;
  productionCost?: Record<string, unknown>;
  buildTicks: number;
  repeatable: boolean;
  prerequisites?: string[];
  unlocks?: string[];
  level?: number | null;
  target?: Record<string, unknown>;
  requiredFacility?: Record<string, unknown>;
  facilityLevel?: Record<string, unknown>;
  attachmentPoints?: Record<string, unknown>;
  attachmentRequirements?: Record<string, unknown>[];
  runtimeAttributes?: Record<string, unknown>;
  capabilities?: string[];
};

export type Habitat = {
  id: string;
  habitatSlug: string;
  displayName: string;
  catalogVersion: string;
  status: string;
  lastSeenAt: string | null;
};

export type HabitatRegistrationInput = {
  displayName: string;
};

export type HabitatRegistrationResponse = {
  habitatId: string;
  habitat?: Habitat;
  // Returned starter module instances become the initial local module state.
  starterModules: StarterModuleInstance[];
  // Returned blueprint definitions are used to hydrate local starter modules.
  blueprints: ProductionBlueprint[];
};

export type HabitatResponse = {
  habitat: Habitat;
};

export type BlueprintCatalogResponse = {
  catalogVersion: string;
  blueprints: ProductionBlueprint[];
};

export type BlueprintResponse = {
  blueprint: ProductionBlueprint;
};

export type IndustryResource = {
  id: string;
  resourceType: string;
  displayName: string;
  kind: string;
  rarity: string;
  amount?: number;
  description?: string;
  unit?: string;
};

export type ResourceCatalogResponse = {
  catalogVersion: string;
  resources: IndustryResource[];
};

export type KeplerHabitatState = {
  displayName: string;
  habitatUuid: string;
  habitatId: string;
  // Persist the starter module instances exactly as Kepler returns them.
  starterModules: StarterModuleInstance[];
  moduleCount?: number;
  habitat?: Habitat;
  registeredAt: string;
  refreshedAt?: string;
};

export type UnregisterKeplerHabitatResult = {
  keplerHabitat: KeplerHabitatState;
  remoteHabitatDeleted: boolean;
};
