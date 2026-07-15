import type { StarterHuman } from "../kepler/types";
import { getPersistenceDatabase } from "../persistence";
import {
  loadHumansFromSqlite,
  replaceHumansFromSqlite,
} from "../persistence/sqlite/humans-repository";

export async function loadHumans(): Promise<StarterHuman[]> {
  return loadHumansFromSqlite(getPersistenceDatabase());
}

export async function replaceStarterHumans(humans: StarterHuman[]): Promise<void> {
  replaceHumansFromSqlite(getPersistenceDatabase(), humans);
}

export async function deleteHumans(): Promise<void> {
  replaceHumansFromSqlite(getPersistenceDatabase(), []);
}
