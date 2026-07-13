import { describe, expect, test } from "bun:test";

import { requestHabitatApiJson } from "./client";
import {
  readBlueprint,
  readBlueprintCatalog,
  readResourceCatalog,
} from "./catalog";
import type { ProductionBlueprint } from "../kepler/types";

function blueprintFixture(): ProductionBlueprint {
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
  };
}

function testOptions(
  fetchImpl: NonNullable<Parameters<typeof requestHabitatApiJson>[1]>["fetchImpl"],
): NonNullable<Parameters<typeof requestHabitatApiJson>[1]> {
  return {
    environment: { HABITAT_API_BASE_URL: "http://localhost:8787" },
    fetchImpl,
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

describe("catalog API", () => {
  test("requests the blueprint catalog", async () => {
    const blueprints = [blueprintFixture()];

    const result = await readBlueprintCatalog(testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/catalog/blueprints");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse({ blueprints }));
    }));

    expect(result).toEqual({ blueprints });
  });

  test("requests one encoded blueprint", async () => {
    const blueprint = blueprintFixture();

    const result = await readBlueprint("solar array", testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/catalog/blueprints/solar%20array");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse({ blueprint }));
    }));

    expect(result).toEqual({ blueprint });
  });

  test("requests the resource catalog", async () => {
    const resources = [{
      id: "ferrite",
      resourceType: "ferrite",
      displayName: "Ferrite",
      kind: "ore",
      rarity: "common",
      amount: 12,
    }];

    const result = await readResourceCatalog(testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/catalog/resources");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse({ resources }));
    }));

    expect(result).toEqual({ resources });
  });
});
