import { getPersistenceDatabase } from "../persistence";
import { loadEvaStateFromSqlite, saveEvaStateToSqlite, deleteEvaStateFromSqlite } from "../persistence/sqlite/eva-repository";
import { loadHumans } from "../humans";
import { loadModules } from "../modules";
import { loadRegistrationState } from "../kepler/state";
import { requestKeplerJson } from "../kepler/client";
import type { EvaState, WorldSector } from "./types";

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
export async function dockEva(): Promise<EvaState> { const state=await loadEvaState(); if(!state.deployedHumanId) throw new Error("No human is deployed."); if(state.x!==0||state.y!==0) throw new Error("EVA can dock only at (0, 0)."); const next={...state,deployedHumanId:null}; saveEvaStateToSqlite(getPersistenceDatabase(),next); return next; }
