import type { Hono } from "hono";
import { findBlueprint } from "../kepler/index";
import { loadInventory, saveInventory } from "../inventory/state";
import { loadModules, saveModules } from "../modules/state";
import { cancelConstruction, evaluateConstructionDryRun, readConstructionStatus, startConstruction } from "../construct/index";
import { BackendHttpError } from "./errors";
import { createMutationQueue } from "./mutation-queue";

export type ConstructionRouteDependencies = {
  findBlueprint: typeof findBlueprint;
  loadModules: typeof loadModules;
  saveModules: typeof saveModules;
  loadInventory: typeof loadInventory;
  saveInventory: typeof saveInventory;
};
const defaults: ConstructionRouteDependencies = { findBlueprint, loadModules, saveModules, loadInventory, saveInventory };

export function registerConstructionRoutes(app: Hono, dependencies: Partial<ConstructionRouteDependencies> = {}): void {
  const deps = { ...defaults, ...dependencies };
  const runMutation = createMutationQueue();
  const constructDeps = () => ({ findBlueprint: deps.findBlueprint, loadModules: deps.loadModules, loadInventory: deps.loadInventory });
  const startDeps = () => ({ ...constructDeps(), saveModules: deps.saveModules, saveInventory: deps.saveInventory, now: () => new Date().toISOString() });
  app.get("/construction", async (c) => c.json({ construction: await readConstructionStatus(constructDeps()) }));
  app.post("/construction/dry-run", async (c) => { const body = await c.req.json().catch(() => ({})) as { blueprintId?: unknown }; if (typeof body.blueprintId !== "string" || !body.blueprintId.trim()) throw invalidBlueprint(); return c.json({ report: await evaluateConstructionDryRun(body.blueprintId, constructDeps()) }); });
  app.post("/construction", async (c) => { const body = await c.req.json().catch(() => ({})) as { blueprintId?: unknown }; if (typeof body.blueprintId !== "string" || !body.blueprintId.trim()) throw invalidBlueprint(); const blueprintId = body.blueprintId; try { return await runMutation(async () => c.json({ construction: await startConstruction(blueprintId, startDeps()) }, 201)); } catch (e) { throw constructionError(e); } });
  app.delete("/construction/:fabricatorId", async (c) => { try { return await runMutation(async () => c.json({ construction: await cancelConstruction(c.req.param("fabricatorId"), { loadModules: deps.loadModules, saveModules: deps.saveModules, now: () => new Date().toISOString() }) })); } catch (e) { throw constructionError(e); } });
}
function invalidBlueprint(): BackendHttpError { return new BackendHttpError(400, "invalid_blueprint_id", "blueprintId is required."); }
function constructionError(error: unknown): Error { if (error instanceof BackendHttpError) return error; const message = error instanceof Error ? error.message : "Construction failed."; return new BackendHttpError(message.includes("not found") ? 404 : 409, message.includes("not found") ? "construction_not_found" : "construction_invalid_state", message, { cause: error }); }
