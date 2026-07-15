import type { Hono } from "hono";

import { loadHumans, moveHuman } from "../humans/index";
import { BackendHttpError } from "./errors";
import { setHabitatApiSummary } from "./logging";

export type HumanRouteDependencies = {
  loadHumans: typeof loadHumans;
  moveHuman: typeof moveHuman;
};

const defaultDependencies: HumanRouteDependencies = { loadHumans, moveHuman };

export function registerHumanRoutes(
  app: Hono,
  dependencies: HumanRouteDependencies = defaultDependencies,
): void {
  const routeDependencies = { ...defaultDependencies, ...dependencies };

  app.get("/humans", async (context) => {
    const humans = await routeDependencies.loadHumans();
    setHabitatApiSummary(context, `${humans.length} human${humans.length === 1 ? "" : "s"}`);
    return context.json({ humans });
  });

  app.patch("/humans/:id", async (context) => {
    const body = await context.req.json().catch(() => undefined) as { locationModuleId?: unknown };
    if (typeof body?.locationModuleId !== "string" || body.locationModuleId.trim().length === 0) {
      throw new BackendHttpError(400, "invalid_human_move", "locationModuleId is required.");
    }
    try {
      const human = await routeDependencies.moveHuman(context.req.param("id"), body.locationModuleId);
      setHabitatApiSummary(context, `moved human ${human.id}`);
      return context.json({ human });
    } catch (error) {
      if (error instanceof Error && error.message.includes("was not found")) {
        throw new BackendHttpError(404, "human_or_module_not_found", error.message, { cause: error });
      }
      if (error instanceof Error && error.message.includes("crew capacity")) {
        throw new BackendHttpError(409, "module_crew_capacity", error.message, { cause: error });
      }
      throw error;
    }
  });
}
