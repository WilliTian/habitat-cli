export type HabitatModule = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: Record<string, unknown>;
  capabilities: string[];
  source: "starter" | "local";
  createdAt: string;
  updatedAt: string;
};

export type HabitatModuleCreateInput = {
  blueprintId: string;
  displayName: string;
  connectedTo?: string[];
  runtimeAttributes?: Record<string, unknown>;
  capabilities?: string[];
};

export type HabitatModuleUpdateInput = {
  blueprintId?: string;
  displayName?: string;
  connectedTo?: string[];
  runtimeAttributes?: Record<string, unknown>;
  capabilities?: string[];
};
