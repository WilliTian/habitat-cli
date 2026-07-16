import { getPersistenceDatabase } from "../persistence";
import { loadEvaStateFromSqlite, saveEvaStateToSqlite, deleteEvaStateFromSqlite } from "../persistence/sqlite/eva-repository";
import { loadHumans } from "../humans";
import { loadModules } from "../modules";
import { loadRegistrationState } from "../kepler/state";
import { requestKeplerJson } from "../kepler/client";
import type { EvaState, WorldSector } from "./types";
import { withTransaction } from "../persistence/sqlite";
import { loadInventoryFromSqlite } from "../persistence/sqlite/inventory-repository";
import { loadHumansFromSqlite } from "../persistence/sqlite/humans-repository";

// Kepler currently exposes crew access and cargo-transfer rating for the
// starter suitport, but not a kilogram capacity. This is Habitat gameplay
// policy, not copied Kepler world state, and can be superseded by a live
// carryingCapacityKg runtime attribute when Kepler provides one.
export const defaultEvaCarryingCapacityKg = 20;

export const loadEvaState = async (): Promise<EvaState> => loadEvaStateFromSqlite(getPersistenceDatabase());
export const deleteEvaState = async (): Promise<void> => deleteEvaStateFromSqlite(getPersistenceDatabase());

function suitport() { return loadModules().then(ms => ms.find(m => m.blueprintId === "basic-suitport" && m.capabilities.includes("suitport-access"))); }
export async function deployEva(humanId: string): Promise<EvaState> {
  const state = await loadEvaState(); if (state.deployedHumanId) throw new Error("A human is already deployed.");
  const human = (await loadHumans()).find(h => h.id === humanId); if (!human) throw new Error(`Human "${humanId}" was not found.`);
  const module = await suitport(); if (!module || module.runtimeAttributes.status !== "active") throw new Error("The basic suitport is not active.");
  if (human.locationModuleId !== module.id) throw new Error(`Human "${humanId}" is not in the active basic suitport.`);
  const liveCapacity = module.runtimeAttributes.carryingCapacityKg;
  const capacity = typeof liveCapacity === "number" && liveCapacity >= 0
    ? liveCapacity
    : defaultEvaCarryingCapacityKg;
  const next = { ...state, deployedHumanId: humanId, x: 0, y: 0, carriedResources: {}, maxCarryingCapacityKg: capacity }; saveEvaStateToSqlite(getPersistenceDatabase(), next); return next;
}
async function sector(): Promise<WorldSector> { const reg = await loadRegistrationState(); if (!reg) throw new Error("No Kepler habitat registration was found."); const r = await requestKeplerJson<any>(`/world/sectors/current?habitatId=${encodeURIComponent(reg.habitatId)}`, { method: "GET", expectedStatus: 200 }); const s = r.sector ?? r; return { minX: s.minX ?? s.bounds?.minX, maxX: s.maxX ?? s.bounds?.maxX, minY: s.minY ?? s.bounds?.minY, maxY: s.maxY ?? s.bounds?.maxY }; }
export async function moveEva(x: number, y: number): Promise<EvaState> { const state = await loadEvaState(); if (!state.deployedHumanId) throw new Error("No human is deployed."); if (!Number.isInteger(x)||!Number.isInteger(y)||Math.abs(x-state.x)+Math.abs(y-state.y)!==1) throw new Error("EVA moves must be exactly one cardinal tile."); const s=await sector(); if(x<s.minX||x>s.maxX||y<s.minY||y>s.maxY) throw new Error("Destination is outside the current Kepler sector."); const next={...state,x,y}; saveEvaStateToSqlite(getPersistenceDatabase(),next); return next; }
export async function dockEva(): Promise<EvaState> {
  const database = getPersistenceDatabase();
  const state = loadEvaStateFromSqlite(database);
  if (!state.deployedHumanId) throw new Error("No human is deployed.");
  if (state.x !== 0 || state.y !== 0) throw new Error("EVA can dock only at (0, 0).");
  const suitport = (await loadModules()).find(module => module.blueprintId === "basic-suitport");
  if (!suitport) throw new Error("The basic suitport was not found.");
  const humans = loadHumansFromSqlite(database);
  const human = humans.find(candidate => candidate.id === state.deployedHumanId);
  if (!human) throw new Error(`Human "${state.deployedHumanId}" was not found.`);
  const inventory = loadInventoryFromSqlite(database);
  const timestamp = new Date().toISOString();
  withTransaction(database, () => {
    for (const [resourceType, quantity] of Object.entries(state.carriedResources)) {
      const existing = inventory.find(resource => resource.resourceType === resourceType);
      if (existing) {
        database.query("UPDATE inventory_resources SET quantity = ?, updated_at = ? WHERE resource_type = ?").run(existing.quantity + quantity, timestamp, resourceType);
      } else {
        database.query("INSERT INTO inventory_resources (resource_type, quantity, unit, updated_at) VALUES (?, ?, ?, ?)").run(resourceType, quantity, "kg", timestamp);
      }
    }
    database.query("UPDATE humans SET location_module_id = ? WHERE id = ?").run(suitport.id, human.id);
    database.query("UPDATE eva_state SET deployed_human_id = NULL, x = 0, y = 0, carried_resources_json = ? WHERE id = 1").run("{}");
  });
  return loadEvaStateFromSqlite(database);
}

export async function collectEva(quantityKg: number): Promise<EvaState> {
  if (!Number.isSafeInteger(quantityKg) || quantityKg <= 0) throw new Error("quantity-kg must be a positive whole number.");
  const state = await loadEvaState();
  if (!state.deployedHumanId) throw new Error("Deploy a human before collecting.");
  const carried = Object.values(state.carriedResources).reduce((sum, quantity) => sum + quantity, 0);
  if (carried + quantityKg > state.maxCarryingCapacityKg) throw new Error("Collection would exceed EVA carrying capacity.");
  const registration = await loadRegistrationState();
  if (!registration) throw new Error("No Kepler habitat registration was found.");
  const response = await requestKeplerJson<{ collection: { resourceType?: string; collectedKg?: number } }>("/world/collect", {
    method: "POST",
    expectedStatus: 200,
    body: { habitatId: registration.habitatId, x: state.x, y: state.y, quantityKg },
  });
  const resourceType = response.collection?.resourceType;
  const collectedKg = response.collection?.collectedKg;
  if (!resourceType || !Number.isFinite(collectedKg) || collectedKg <= 0) throw new Error("Kepler returned no collected material.");
  const next = { ...state, carriedResources: { ...state.carriedResources, [resourceType]: (state.carriedResources[resourceType] ?? 0) + collectedKg } };
  saveEvaStateToSqlite(getPersistenceDatabase(), next);
  return next;
}
