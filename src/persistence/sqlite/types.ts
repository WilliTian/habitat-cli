import type { HabitatInventoryResource } from "../../inventory/types";
import type { HabitatModule, ModuleRuntimeAttributes } from "../../modules/types";
import type { KeplerHabitatState, StarterModuleInstance } from "../../kepler/types";

export type RegistrationRow = {
  id: number;
  habitat_uuid: string;
  habitat_id: string;
  display_name: string;
  registered_at: string;
  refreshed_at: string | null;
  module_count: number | null;
  habitat_slug: string | null;
  catalog_version: string | null;
  status: string | null;
  last_seen_at: string | null;
  starter_modules_json: string;
};

export type ModuleRow = {
  id: string;
  blueprint_id: string;
  display_name: string;
  source: HabitatModule["source"];
  runtime_attributes_json: string;
  created_at: string;
  updated_at: string;
};

export type ModuleConnectionRow = {
  module_id: string;
  position: number;
  connected_to_module_id: string;
};

export type ModuleCapabilityRow = {
  module_id: string;
  position: number;
  capability: string;
};

export type InventoryRow = {
  resource_type: string;
  quantity: number;
  unit: string | null;
  updated_at: string;
};

export type RegistrationRecord = KeplerHabitatState & {
  habitat?: {
    id: string;
    habitatSlug: string;
    displayName: string;
    catalogVersion: string;
    status: string;
    lastSeenAt: string | null;
  };
};

export type StarterModulesJson = StarterModuleInstance[];
export type RuntimeAttributesJson = ModuleRuntimeAttributes;
export type InventoryResources = HabitatInventoryResource[];
