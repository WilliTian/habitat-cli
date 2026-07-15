import type { Hono } from "hono";

import { loadHumans } from "../humans/index";
import { setHabitatApiSummary } from "./logging";

export type HumanRouteDependencies = {
  loadHumans: typeof loadHumans;
};

const defaultDependencies: HumanRouteDependencies = { loadHumans };

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
}
