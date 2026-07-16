import type { Hono } from "hono";

import { scanWorldResources } from "../kepler/index";
import { loadRegistrationState } from "../kepler/state";
import type { KeplerHabitatState, WorldScanInput } from "../kepler/types";
import { BackendHttpError } from "./errors";
import { setHabitatApiSummary } from "./logging";
import { loadEvaState } from "../eva";

export type WorldRouteDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  scanWorldResources: typeof scanWorldResources;
  loadEvaState?: typeof loadEvaState;
};

const defaultDependencies: WorldRouteDependencies = {
  loadRegistrationState,
  scanWorldResources,
  loadEvaState,
};

export function registerWorldRoutes(
  app: Hono,
  dependencies: WorldRouteDependencies = defaultDependencies,
): void {
  const routeDependencies = { ...defaultDependencies, ...dependencies };

  app.get("/world/scan", async (context) => {
    try {
      const scanInput = readWorldScanInput(context.req.query());
      const eva = await routeDependencies.loadEvaState!();
      if (!eva.deployedHumanId) {
        throw new BackendHttpError(409, "eva_human_not_deployed", "Deploy a human before scanning.");
      }
      const registration = await routeDependencies.loadRegistrationState();

      if (!registration) {
        throw new BackendHttpError(
          404,
          "registration_not_found",
          "No Kepler habitat registration was found.",
        );
      }

      const scan = await routeDependencies.scanWorldResources({
        habitatId: registration.habitatId,
        x: eva.x,
        y: eva.y,
        ...scanInput,
      });
      setHabitatApiSummary(context, "proxied to Kepler");
      return context.json(scan);
    } catch (error) {
      throw translateWorldError(error);
    }
  });
}

function readWorldScanInput(query: Record<string, string | undefined>): Omit<WorldScanInput, "habitatId"> {
  const x = readCanonicalInteger(query.x);
  const y = readCanonicalInteger(query.y);
  const sensorStrength = readCanonicalInteger(query.sensorStrength);
  const radiusTiles = readCanonicalInteger(query.radiusTiles);

  if (
    x === undefined ||
    y === undefined ||
    sensorStrength === undefined ||
    radiusTiles === undefined ||
    sensorStrength < 0 ||
    sensorStrength > 100 ||
    radiusTiles < 0 ||
    radiusTiles > 5
  ) {
    throw invalidWorldScanError();
  }

  return { x, y, sensorStrength, radiusTiles };
}

function readCanonicalInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^(?:0|-?[1-9]\d*)$/.test(value)) {
    return undefined;
  }

  const integer = Number(value);
  return Number.isSafeInteger(integer) ? integer : undefined;
}

function invalidWorldScanError(): BackendHttpError {
  return new BackendHttpError(
    400,
    "invalid_world_scan",
    "x, y, sensorStrength, and radiusTiles must be valid scan values.",
  );
}

function translateWorldError(error: unknown): Error {
  if (error instanceof BackendHttpError) {
    return error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("Kepler request failed") ||
      error.message.startsWith("Missing Kepler auth token"))
  ) {
    return new BackendHttpError(502, "kepler_request_failed", error.message, {
      cause: error,
    });
  }

  return error instanceof Error ? error : new Error("Unknown world scan error.", { cause: error });
}
