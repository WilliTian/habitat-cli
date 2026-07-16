import type { StarterHuman } from "../kepler/types";
import { getPersistenceDatabase } from "../persistence";
import {
  loadHumansFromSqlite,
  replaceHumansFromSqlite,
} from "../persistence/sqlite/humans-repository";
import { findModuleByPrefix } from "../modules/index";

export async function loadHumans(): Promise<StarterHuman[]> {
  return loadHumansFromSqlite(getPersistenceDatabase());
}

export async function replaceStarterHumans(humans: StarterHuman[]): Promise<void> {
  replaceHumansFromSqlite(getPersistenceDatabase(), humans);
}

export async function deleteHumans(): Promise<void> {
  replaceHumansFromSqlite(getPersistenceDatabase(), []);
}

export async function moveHuman(humanId: string, moduleId: string): Promise<StarterHuman> {
  const humans = await loadHumans();
  const human = humans.find((candidate) => candidate.id === humanId);
  if (!human) throw new Error(`Human "${humanId}" was not found.`);

  const destination = await findModuleByPrefix(moduleId);
  if (!destination) throw new Error(`Module "${moduleId}" was not found.`);

  const capacity = destination.runtimeAttributes.crewCapacity;
  const occupants = humans.filter((candidate) => candidate.locationModuleId === destination.id && candidate.id !== humanId).length;
  if (typeof capacity === "number" && occupants >= capacity) {
    throw new Error(`Module "${moduleId}" has reached its crew capacity.`);
  }

  human.locationModuleId = destination.id;
  await replaceStarterHumans(humans);
  return human;
}
