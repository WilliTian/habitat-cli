import { describe, expect, test } from "bun:test";

import type { HabitatInventoryResource } from "../inventory/types";
import { createBackendApp } from "./app";
import type { InventoryRouteDependencies } from "./inventory";

const resource: HabitatInventoryResource = {
  resourceType: "steel",
  quantity: 10,
  updatedAt: "2026-07-13T00:00:00.000Z",
};

function dependencies(
  input: Partial<InventoryRouteDependencies> = {},
): InventoryRouteDependencies {
  return {
    listInventory: async () => [resource],
    saveInventory: async () => {},
    adjustInventoryResource: async () => resource,
    ...input,
  };
}

function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

describe("inventory routes", () => {
  test("GET /inventory returns SQLite-backed inventory", async () => {
    const app = createBackendApp({ logger: () => {}, inventory: dependencies() });

    const response = await app.request("/inventory");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ inventory: [resource] });
  });

  test("PUT /inventory replaces SQLite-backed inventory", async () => {
    const saved: HabitatInventoryResource[][] = [];
    const app = createBackendApp({
      logger: () => {},
      inventory: dependencies({ saveInventory: async (value) => { saved.push(value); } }),
    });

    const response = await app.request(
      "/inventory",
      jsonRequest("PUT", { inventory: [resource] }),
    );

    expect(response.status).toBe(200);
    expect(saved).toEqual([[resource]]);
    expect(await response.json()).toEqual({ inventory: [resource] });
  });

  test("PATCH /inventory/:resourceType applies a signed delta", async () => {
    const adjustments: unknown[] = [];
    const app = createBackendApp({
      logger: () => {},
      inventory: dependencies({
        adjustInventoryResource: async (input) => {
          adjustments.push(input);
          return { ...resource, quantity: 8 };
        },
      }),
    });

    const response = await app.request(
      "/inventory/steel",
      jsonRequest("PATCH", { quantityDelta: -2 }),
    );

    expect(response.status).toBe(200);
    expect(adjustments).toEqual([{ resourceType: "steel", quantityDelta: -2, unit: undefined }]);
    expect(await response.json()).toEqual({ resource: { ...resource, quantity: 8 } });
  });

  test("maps inventory overdraw to 409 and invalid quantity to 400", async () => {
    const overdrawApp = createBackendApp({
      logger: () => {},
      inventory: dependencies({
        adjustInventoryResource: async () => {
          throw new Error("Cannot remove 11 steel; only 10 is available.");
        },
      }),
    });
    const invalidApp = createBackendApp({ logger: () => {}, inventory: dependencies() });

    const overdraw = await overdrawApp.request(
      "/inventory/steel",
      jsonRequest("PATCH", { quantityDelta: -11 }),
    );
    const invalid = await invalidApp.request(
      "/inventory/steel",
      jsonRequest("PATCH", { quantityDelta: 0 }),
    );

    expect(overdraw.status).toBe(409);
    expect(invalid.status).toBe(400);
  });

  test("PUT /inventory rejects resources that violate inventory invariants", async () => {
    const saved: HabitatInventoryResource[][] = [];
    const app = createBackendApp({
      logger: () => {},
      inventory: dependencies({ saveInventory: async (value) => { saved.push(value); } }),
    });

    const response = await app.request(
      "/inventory",
      jsonRequest("PUT", {
        inventory: [{ ...resource, resourceType: " ", quantity: -1 }],
      }),
    );

    expect(response.status).toBe(400);
    expect(saved).toHaveLength(0);
  });

  test("PUT /inventory rejects duplicate resource types before saving", async () => {
    const saved: HabitatInventoryResource[][] = [];
    const app = createBackendApp({
      logger: () => {},
      inventory: dependencies({ saveInventory: async (value) => { saved.push(value); } }),
    });

    const response = await app.request(
      "/inventory",
      jsonRequest("PUT", { inventory: [resource, { ...resource, quantity: 5 }] }),
    );

    expect(response.status).toBe(400);
    expect(saved).toHaveLength(0);
  });

  test("serializes concurrent inventory mutations", async () => {
    let quantity = 0;
    const app = createBackendApp({
      logger: () => {},
      inventory: dependencies({
        adjustInventoryResource: async ({ quantityDelta }) => {
          const previousQuantity = quantity;
          await new Promise((resolve) => setTimeout(resolve, 0));
          quantity = previousQuantity + quantityDelta;
          return { ...resource, quantity };
        },
      }),
    });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => app.request(
        "/inventory/steel",
        jsonRequest("PATCH", { quantityDelta: 1 }),
      )),
    );

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(quantity).toBe(10);
  });
});
