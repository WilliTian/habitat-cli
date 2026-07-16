import type { Hono } from "hono";
import { readSolarIrradiance } from "../kepler/index";
import { loadModules, saveModules } from "../modules/state";
import { applyPowerTicks, readPowerSummary } from "../ticks/index";
import type { HabitatModule } from "../modules/types";
import { BackendHttpError } from "./errors";
import { setHabitatApiSummary } from "./logging";
import { createMutationQueue } from "./mutation-queue";

export type PowerRouteDependencies = {
  listModules: typeof loadModules;
  saveModules: typeof saveModules;
  readSolarIrradiance: typeof readSolarIrradiance;
};

const defaults: PowerRouteDependencies = { listModules: loadModules, saveModules, readSolarIrradiance };

export function registerPowerRoutes(app: Hono, dependencies: Partial<PowerRouteDependencies> = {}): void {
  const deps = { ...defaults, ...dependencies };
  const runMutation = createMutationQueue();

  app.get("/power", async (context) => {
    const [modules, solarIrradiance] = await Promise.all([deps.listModules(), deps.readSolarIrradiance()]);
    setHabitatApiSummary(context, "power snapshot");
    return context.json({ summary: readPowerSummary({ modules, solarIrradiance }) });
  });

  app.post("/ticks", async (context) => {
    const input = await readTickInput(context.req.json());
    return runMutation(async () => {
      const [modules, solarIrradiance] = await Promise.all([deps.listModules(), deps.readSolarIrradiance()]);
      const result = applyPowerTicks({ modules, tickCount: input.tickCount, solarIrradiance });
      await deps.saveModules(result.modules);
      setHabitatApiSummary(context, `advanced ${input.tickCount} ticks`);
      return context.json(result);
    });
  });
}

async function readTickInput(json: Promise<unknown>): Promise<{ tickCount: number }> {
  let body: unknown;
  try { body = await json; } catch { throw invalidTickError(); }
  if (typeof body !== "object" || body === null || !("tickCount" in body) || typeof body.tickCount !== "number" || !Number.isSafeInteger(body.tickCount) || body.tickCount <= 0) {
    throw invalidTickError();
  }
  return { tickCount: body.tickCount };
}

function invalidTickError(): BackendHttpError {
  return new BackendHttpError(400, "invalid_tick_count", "tickCount must be a positive whole number.");
}
