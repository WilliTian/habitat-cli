import { describe, expect, test } from "bun:test";

import { createBackendApp } from "./app";
import type { CatalogRouteDependencies } from "./catalog";
import type { IndustryResource, ProductionBlueprint } from "../kepler/types";
import { requestKeplerJson } from "../kepler/client";

function blueprintFixture(
  input: Partial<ProductionBlueprint> = {},
): ProductionBlueprint {
  return {
    id: "small-solar-array",
    blueprintId: "small-solar-array",
    displayName: "Small Solar Array",
    description: "Collects solar energy.",
    status: "published",
    output: {},
    inputs: {},
    buildTicks: 120,
    repeatable: true,
    ...input,
  };
}

function resourceFixture(
  input: Partial<IndustryResource> = {},
): IndustryResource {
  return {
    id: "ferrite",
    resourceType: "ferrite",
    displayName: "Ferrite",
    kind: "ore",
    rarity: "common",
    amount: 12,
    ...input,
  };
}

function catalogDependencies(
  input: Partial<CatalogRouteDependencies> = {},
): CatalogRouteDependencies {
  return {
    listBlueprints: async () => [blueprintFixture()],
    findBlueprint: async () => blueprintFixture(),
    listResources: async () => [resourceFixture()],
    ...input,
  };
}

describe("catalog routes", () => {
  test("GET /catalog/blueprints delegates to Kepler domain data", async () => {
    const blueprints = [blueprintFixture()];
    const app = createBackendApp({
      logger: () => {},
      catalog: catalogDependencies({ listBlueprints: async () => blueprints }),
    });

    const response = await app.request("/catalog/blueprints");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ blueprints });
  });

  test("GET /catalog/blueprints/:blueprintId decodes the requested id", async () => {
    const requestedIds: string[] = [];
    const blueprint = blueprintFixture({ blueprintId: "solar array" });
    const app = createBackendApp({
      logger: () => {},
      catalog: catalogDependencies({
        findBlueprint: async (blueprintId) => {
          requestedIds.push(blueprintId);
          return blueprint;
        },
      }),
    });

    const response = await app.request("/catalog/blueprints/solar%20array");

    expect(response.status).toBe(200);
    expect(requestedIds).toEqual(["solar array"]);
    expect(await response.json()).toEqual({ blueprint });
  });

  test("GET /catalog/blueprints/:blueprintId returns 404 when absent", async () => {
    const app = createBackendApp({
      logger: () => {},
      catalog: catalogDependencies({ findBlueprint: async () => undefined }),
    });

    const response = await app.request("/catalog/blueprints/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "blueprint_not_found",
        message: 'Blueprint "missing" was not found.',
      },
    });
  });

  test("GET /catalog/resources returns resources merged by the domain", async () => {
    const resources = [resourceFixture()];
    const app = createBackendApp({
      logger: () => {},
      catalog: catalogDependencies({ listResources: async () => resources }),
    });

    const response = await app.request("/catalog/resources");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ resources });
  });

  test("GET /catalog/blueprints maps Kepler transport failures to 502", async () => {
    const app = createBackendApp({
      logger: () => {},
      catalog: catalogDependencies({
        listBlueprints: async () => {
          throw new Error("Kepler request failed: transport error");
        },
      }),
    });

    const response = await app.request("/catalog/blueprints");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "kepler_request_failed",
        message: "Kepler request failed: transport error",
      },
    });
  });

  test("GET /catalog/blueprints/:id maps a Kepler 404 to a resource 404", async () => {
    const app = createBackendApp({
      logger: () => {},
      catalog: catalogDependencies({
        findBlueprint: async () => requestKeplerJson<ProductionBlueprint>(
          "/catalog/blueprints/missing",
          {
            method: "GET",
            expectedStatus: 200,
            environment: { KEPLER_PLANET_TOKEN: "secret-token" },
            fetchImpl: async () => new Response("not found", { status: 404 }),
            logger: () => {},
          },
        ),
      }),
    });

    const response = await app.request("/catalog/blueprints/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "blueprint_not_found",
        message: 'Blueprint "missing" was not found.',
      },
    });
  });
});
