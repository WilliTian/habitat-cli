import type { HabitatInventoryResource } from "./types";
import { getPersistenceDatabase } from "../persistence";
import {
  deleteInventoryFromSqlite,
  loadInventoryFromSqlite,
  saveInventoryToSqlite,
} from "../persistence/sqlite/inventory-repository";

export async function loadInventory(): Promise<HabitatInventoryResource[]> {
  return loadInventoryFromSqlite(getPersistenceDatabase());
}

export async function saveInventory(resources: HabitatInventoryResource[]): Promise<void> {
  saveInventoryToSqlite(getPersistenceDatabase(), resources);
}

export async function deleteInventory(): Promise<void> {
  deleteInventoryFromSqlite(getPersistenceDatabase());
}
