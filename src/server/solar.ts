import type { Hono } from "hono";

import { readSolarIrradiance } from "../kepler/index";
import { BackendHttpError } from "./errors";

export type SolarRouteDependencies = {
  readSolarIrradiance: typeof readSolarIrradiance;
};

const defaultDependencies: SolarRouteDependencies = {
  readSolarIrradiance,
};

export function registerSolarRoutes(
  app: Hono,
  dependencies: SolarRouteDependencies = defaultDependencies,
): void {
  const routeDependencies = { ...defaultDependencies, ...dependencies };

  app.get("/solar/irradiance", async (context) => {
    try {
      const solarIrradiance = await routeDependencies.readSolarIrradiance();
      return context.json({ solarIrradiance });
    } catch (error) {
      throw translateSolarError(error);
    }
  });
}

function translateSolarError(error: unknown): Error {
  if (
    error instanceof Error &&
    (error.message.startsWith("Kepler request failed") ||
      error.message.startsWith("Missing Kepler auth token"))
  ) {
    return new BackendHttpError(502, "kepler_request_failed", error.message, {
      cause: error,
    });
  }

  return error instanceof Error ? error : new Error("Unknown solar error.", { cause: error });
}
