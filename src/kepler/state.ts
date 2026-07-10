import type { KeplerHabitatState } from "./types";
import {
  deleteRegistrationStateFromSqlite,
  loadRegistrationStateFromSqlite,
  saveRegistrationStateToSqlite,
} from "../persistence/sqlite/registration-repository";
import { getPersistenceDatabase } from "../persistence";

export async function loadRegistrationState(): Promise<KeplerHabitatState | undefined> {
  return loadRegistrationStateFromSqlite(getPersistenceDatabase());
}

export async function saveRegistrationState(keplerHabitat: KeplerHabitatState): Promise<void> {
  saveRegistrationStateToSqlite(getPersistenceDatabase(), keplerHabitat);
}

export async function deleteRegistrationState(): Promise<void> {
  deleteRegistrationStateFromSqlite(getPersistenceDatabase());
}
