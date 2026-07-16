import type { Database } from "bun:sqlite";
import { withTransaction } from "./index";
import type { EvaState } from "../../eva/types";

const empty: EvaState = { deployedHumanId: null, x: 0, y: 0, carriedResources: {}, maxCarryingCapacityKg: 0 };

export function loadEvaStateFromSqlite(database: Database): EvaState {
  const row = database.query("SELECT deployed_human_id, x, y, carried_resources_json, max_carrying_capacity_kg FROM eva_state WHERE id = 1").get() as any;
  if (!row) return empty;
  return { deployedHumanId: row.deployed_human_id, x: row.x, y: row.y, carriedResources: JSON.parse(row.carried_resources_json), maxCarryingCapacityKg: row.max_carrying_capacity_kg };
}

export function saveEvaStateToSqlite(database: Database, state: EvaState): void {
  withTransaction(database, () => database.query("INSERT OR REPLACE INTO eva_state (id, deployed_human_id, x, y, carried_resources_json, max_carrying_capacity_kg) VALUES (1, ?, ?, ?, ?, ?)").run(state.deployedHumanId, state.x, state.y, JSON.stringify(state.carriedResources), state.maxCarryingCapacityKg));
}

export function deleteEvaStateFromSqlite(database: Database): void { database.exec("DELETE FROM eva_state"); }
