import { openHabitatDatabase, getHabitatDatabase } from "./sqlite";
import * as sqliteRegistration from "./sqlite/registration-repository";
import * as sqliteModules from "./sqlite/modules-repository";
import * as sqliteInventory from "./sqlite/inventory-repository";
import * as sqliteHumans from "./sqlite/humans-repository";
import type { KeplerHabitatState } from "../kepler/types";
import type { HabitatInventoryResource } from "../inventory/types";
import type { HabitatModule } from "../modules/types";
import type { StarterHuman } from "../kepler/types";

export function getPersistenceDatabase() {
  return getHabitatDatabase();
}

export type PersistenceAdapter = {
  kind: "sqlite";
  registration: {
    loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
    saveRegistrationState: (state: KeplerHabitatState) => Promise<void>;
    deleteRegistrationState: () => Promise<void>;
  };
  modules: {
    loadModules: () => Promise<HabitatModule[]>;
    saveModules: (modules: HabitatModule[]) => Promise<void>;
    deleteModules: () => Promise<void>;
  };
  inventory: {
    loadInventory: () => Promise<HabitatInventoryResource[]>;
    saveInventory: (resources: HabitatInventoryResource[]) => Promise<void>;
  };
  humans: {
    loadHumans: () => Promise<StarterHuman[]>;
    replaceHumans: (humans: StarterHuman[]) => Promise<void>;
  };
};

export function getPersistence(input: { databasePath?: string } = {}): PersistenceAdapter {
  const database = openHabitatDatabase(input.databasePath);

  return {
    kind: "sqlite",
    registration: {
      loadRegistrationState: async () => sqliteRegistration.loadRegistrationStateFromSqlite(database),
      saveRegistrationState: async (state) => sqliteRegistration.saveRegistrationStateToSqlite(database, state),
      deleteRegistrationState: async () => sqliteRegistration.deleteRegistrationStateFromSqlite(database),
    },
    modules: {
      loadModules: async () => sqliteModules.loadModulesFromSqlite(database),
      saveModules: async (modules) => sqliteModules.saveModulesToSqlite(database, modules),
      deleteModules: async () => sqliteModules.deleteModulesFromSqlite(database),
    },
    inventory: {
      loadInventory: async () => sqliteInventory.loadInventoryFromSqlite(database),
      saveInventory: async (resources) => sqliteInventory.saveInventoryToSqlite(database, resources),
    },
    humans: {
      loadHumans: async () => sqliteHumans.loadHumansFromSqlite(database),
      replaceHumans: async (humans) => sqliteHumans.replaceHumansFromSqlite(database, humans),
    },
  };
}
