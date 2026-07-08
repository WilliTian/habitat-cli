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
  // Returned starter module instances become the initial local module state.
  starterModules: StarterModuleInstance[];
  // Returned blueprint definitions stay as the published catalog for later builds.
  blueprints: ProductionBlueprint[];
};

export type HabitatResponse = {
  habitat: Habitat;
};

export type KeplerHabitatState = {
  displayName: string;
  habitatUuid: string;
  habitatId: string;
  // Persist the starter module instances exactly as Kepler returns them.
  starterModules: StarterModuleInstance[];
  // Persist the published blueprint catalog alongside the habitat state.
  blueprints: ProductionBlueprint[];
  moduleCount?: number;
  habitat?: Habitat;
  registeredAt: string;
  refreshedAt?: string;
};
