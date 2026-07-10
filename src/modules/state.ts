import type { ProductionBlueprint, StarterModuleInstance } from "../kepler/types";
import { getPersistenceDatabase } from "../persistence";
import {
  deleteModulesFromSqlite,
  hydrateModulesFromStarterModuleRows,
  loadModulesFromSqlite,
  saveModulesToSqlite,
} from "../persistence/sqlite/modules-repository";
import { withTransaction } from "../persistence/sqlite";
import type { HabitatModule } from "./types";

export async function loadModules(): Promise<HabitatModule[]> {
  return loadModulesFromSqlite(getPersistenceDatabase());
}

export async function saveModules(modules: HabitatModule[]): Promise<void> {
  const database = getPersistenceDatabase();
  withTransaction(database, () => {
    saveModulesToSqlite(database, modules);
  });
}

export async function deleteModules(): Promise<void> {
  const database = getPersistenceDatabase();
  withTransaction(database, () => {
    deleteModulesFromSqlite(database);
  });
}

export function hydrateModulesFromStarterModules(
  starterModules: StarterModuleInstance[],
  blueprints: ProductionBlueprint[] = [],
): HabitatModule[] {
  return hydrateModulesFromStarterModuleRows(starterModules, blueprints);
}
