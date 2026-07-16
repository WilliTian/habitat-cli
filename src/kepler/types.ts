export type StarterModuleInstance = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: Record<string, unknown>;
  capabilities: string[];
};

export type StarterHuman = {
  id: string;
  displayName: string;
  locationModuleId: string;
};

export type AlertContract = {
  schemaVersion: string;
  schema: Record<string, unknown>;
};
export type HabitatAlert = {
  id: string; conditionKey: string; severity: string; status: "open" | "acknowledged" | "resolved"; source: string;
  createdAt: string; lastObservedAt: string; occurrenceCount: number; humanId?: string; moduleId?: string; message: string;
};

export type RegistrationContracts = {
  alerts: AlertContract;
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
  starterHumans: StarterHuman[];
  contracts: RegistrationContracts;
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

export type SolarCondition = "clear" | "dust" | "storm" | "night";

export type SolarIrradianceReading = {
  wPerM2: number;
  condition: SolarCondition;
};

export type SolarIrradianceResponse = {
  solarIrradiance: SolarIrradianceReading;
};

export type WorldScanInput = {
  habitatId: string;
  x: number;
  y: number;
  sensorStrength: number;
  radiusTiles: number;
};

export type WorldScanProbability = {
  resourceType: string | null;
  probabilityPct: number;
};

export type WorldScanQuantityEstimate = {
  resourceType: string;
  unit: "kg";
  estimatedKg: number;
  minimumKg: number;
  maximumKg: number;
  exact: boolean;
};

export type WorldScanTile = {
  x: number;
  y: number;
  terrain: "flat";
  distanceTiles: number;
  probabilities: WorldScanProbability[];
  topCandidate: WorldScanProbability;
  quantityEstimate: WorldScanQuantityEstimate | null;
};

export type WorldScanResponse = {
  scan: {
    modelVersion: "resource-probability-v2";
    origin: { x: number; y: number };
    sensorStrength: number;
    radiusTiles: number;
    tiles: WorldScanTile[];
  };
};

export type KeplerHabitatState = {
  displayName: string;
  habitatUuid: string;
  habitatId: string;
  // Persist the starter module instances exactly as Kepler returns them.
  starterModules: StarterModuleInstance[];
  alertContract?: AlertContract;
  moduleCount?: number;
  habitat?: Habitat;
  registeredAt: string;
  refreshedAt?: string;
};

export type UnregisterKeplerHabitatResult = {
  keplerHabitat: KeplerHabitatState;
  remoteHabitatDeleted: boolean;
};
