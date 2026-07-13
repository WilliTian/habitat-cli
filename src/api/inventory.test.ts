import { describe, expect, test } from "bun:test";

import { requestHabitatApiJson } from "./client";
import { adjustInventory, readInventory, replaceInventory } from "./inventory";
import type { HabitatInventoryResource } from "../inventory/types";

const inventory: HabitatInventoryResource[] = [{
  resourceType: "steel/alloy",
  quantity: 10,
  updatedAt: "2026-07-13T00:00:00.000Z",
}];

function options(
  fetchImpl: NonNullable<Parameters<typeof requestHabitatApiJson>[1]>["fetchImpl"],
): NonNullable<Parameters<typeof requestHabitatApiJson>[1]> {
  return { environment: { HABITAT_API_BASE_URL: "http://localhost:8787" }, fetchImpl };
}

function response(body: unknown): Response {
  return new Response(JSON.stringify(body));
}

describe("inventory API", () => {
  test("reads and replaces inventory resources", async () => {
    const read = await readInventory(options(async (input, init) => {
      expect(input).toBe("http://localhost:8787/inventory");
      expect(init?.method).toBe("GET");
      return response({ inventory });
    }));
    await replaceInventory(inventory, options(async (input, init) => {
      expect(input).toBe("http://localhost:8787/inventory");
      expect(init?.method).toBe("PUT");
      expect(init?.body).toBe(JSON.stringify({ inventory }));
      return response({ inventory });
    }));

    expect(read).toEqual({ inventory });
  });

  test("adjusts an encoded inventory resource", async () => {
    await adjustInventory("steel/alloy", -2, "kg", options(async (input, init) => {
      expect(input).toBe("http://localhost:8787/inventory/steel%2Falloy");
      expect(init?.method).toBe("PATCH");
      expect(init?.body).toBe(JSON.stringify({ quantityDelta: -2, unit: "kg" }));
      return response({ resource: inventory[0] });
    }));
  });
});
