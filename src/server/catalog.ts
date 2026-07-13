import type { Hono } from "hono";

import {
  findBlueprint,
  listBlueprints,
  listResources,
} from "../kepler/index";
import { BackendHttpError } from "./errors";

export type CatalogRouteDependencies = {
  listBlueprints: typeof listBlueprints;
  findBlueprint: typeof findBlueprint;
  listResources: typeof listResources;
};

const defaultDependencies: CatalogRouteDependencies = {
  listBlueprints,
  findBlueprint,
  listResources,
};

export function registerCatalogRoutes(
  app: Hono,
  dependencies: CatalogRouteDependencies = defaultDependencies,
): void {
  const routeDependencies = { ...defaultDependencies, ...dependencies };

  app.get("/catalog/blueprints", async (context) => {
    try {
      const blueprints = await routeDependencies.listBlueprints();
      return context.json({ blueprints });
    } catch (error) {
      throw translateCatalogError(error);
    }
  });

  app.get("/catalog/blueprints/:blueprintId", async (context) => {
    const blueprintId = context.req.param("blueprintId");

    try {
      const blueprint = await routeDependencies.findBlueprint(blueprintId);

      if (!blueprint) {
        throw new BackendHttpError(
          404,
          "blueprint_not_found",
          `Blueprint "${blueprintId}" was not found.`,
        );
      }

      return context.json({ blueprint });
    } catch (error) {
      throw translateCatalogError(error);
    }
  });

  app.get("/catalog/resources", async (context) => {
    try {
      const resources = await routeDependencies.listResources();
      return context.json({ resources });
    } catch (error) {
      throw translateCatalogError(error);
    }
  });
}

function translateCatalogError(error: unknown): Error {
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

  return error instanceof Error ? error : new Error("Unknown catalog error.", { cause: error });
}
