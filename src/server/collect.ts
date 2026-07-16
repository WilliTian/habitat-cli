import type { Hono } from "hono";
import { collectEva } from "../eva";
import { BackendHttpError } from "./errors";
export function registerCollectionRoutes(app: Hono): void {
  app.post("/collect", async c => {
    const body = await c.req.json().catch(() => ({})) as { quantityKg?: unknown };
    if (!Number.isSafeInteger(body.quantityKg) || (body.quantityKg as number) <= 0) throw new BackendHttpError(400, "invalid_collection", "quantityKg must be a positive whole number.");
    try { return c.json({ eva: await collectEva(body.quantityKg as number) }); }
    catch (error) { throw new BackendHttpError(409, "collection_rejected", error instanceof Error ? error.message : "Collection rejected.", { cause: error }); }
  });
}
