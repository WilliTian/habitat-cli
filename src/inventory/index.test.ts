import { describe, expect, test } from "bun:test";

import {
  addInventoryResource,
  adjustInventoryResource,
  formatInventoryTable,
  listInventory,
  resetInventoryQuantities,
} from "./index";
import type { HabitatInventoryResource } from "./types";

function resourceFixture(input: {
  resourceType: string;
  quantity: number;
  unit?: string;
  updatedAt?: string;
}): HabitatInventoryResource {
  return {
    resourceType: input.resourceType,
    quantity: input.quantity,
    unit: input.unit,
    updatedAt: input.updatedAt ?? "2026-07-08T00:00:00.000Z",
  };
}

describe("inventory", () => {
  test("lists local inventory resources from state", async () => {
    const resources = [
      resourceFixture({
        resourceType: "steel",
        quantity: 12,
      }),
    ];

    const result = await listInventory({
      loadInventory: async () => resources,
    });

    expect(result).toEqual(resources);
  });

  test("formats an inventory table with multiple resource types", () => {
    const output = formatInventoryTable([
      resourceFixture({
        resourceType: "water",
        quantity: 50,
        unit: "L",
      }),
      resourceFixture({
        resourceType: "steel",
        quantity: 12,
      }),
      resourceFixture({
        resourceType: "oxygen",
        quantity: 8.5,
        unit: "kg",
      }),
    ]);

    expect(output).toBe(
      [
        "RESOURCE TYPE   QUANTITY   UNIT",
        "oxygen          8.5        kg",
        "steel           12         -",
        "water           50         L",
      ].join("\n"),
    );
  });

  test("adds quantity to an existing resource type", async () => {
    const savedResources: HabitatInventoryResource[][] = [];

    const result = await addInventoryResource(
      {
        resourceType: "steel",
        quantity: 5,
      },
      {
        loadInventory: async () => [
          resourceFixture({ resourceType: "steel", quantity: 12 }),
          resourceFixture({ resourceType: "water", quantity: 50, unit: "L" }),
        ],
        saveInventory: async (resources) => {
          savedResources.push(resources);
        },
        now: () => "2026-07-09T12:00:00.000Z",
      },
    );

    expect(result).toEqual({
      resourceType: "steel",
      quantity: 17,
      updatedAt: "2026-07-09T12:00:00.000Z",
    });
    expect(savedResources).toHaveLength(1);
    expect(savedResources[0]).toEqual([
      { resourceType: "steel", quantity: 17, updatedAt: "2026-07-09T12:00:00.000Z" },
      { resourceType: "water", quantity: 50, unit: "L", updatedAt: "2026-07-08T00:00:00.000Z" },
    ]);
  });

  test("removes inventory without allowing a negative balance", async () => {
    const savedResources: HabitatInventoryResource[][] = [];
    const dependencies = {
      loadInventory: async () => [
        resourceFixture({ resourceType: "steel", quantity: 10 }),
      ],
      saveInventory: async (resources: HabitatInventoryResource[]) => {
        savedResources.push(resources);
      },
      now: () => "2026-07-09T12:00:00.000Z",
    };

    const resource = await adjustInventoryResource(
      { resourceType: "steel", quantityDelta: -4 },
      dependencies,
    );

    expect(resource.quantity).toBe(6);
    expect(savedResources[0]?.[0]?.quantity).toBe(6);
    await expect(adjustInventoryResource(
      { resourceType: "steel", quantityDelta: -11 },
      dependencies,
    )).rejects.toThrow("Cannot remove 11 steel; only 10 is available.");
  });

  test("resets all inventory quantities to zero", async () => {
    const savedResources: HabitatInventoryResource[][] = [];

    const result = await resetInventoryQuantities(
      {
        loadInventory: async () => [
          resourceFixture({ resourceType: "steel", quantity: 12 }),
          resourceFixture({ resourceType: "water", quantity: 50, unit: "L" }),
        ],
        saveInventory: async (resources) => {
          savedResources.push(resources);
        },
        now: () => "2026-07-09T12:00:00.000Z",
      },
    );

    expect(result).toEqual([
      { resourceType: "steel", quantity: 0, updatedAt: "2026-07-09T12:00:00.000Z" },
      { resourceType: "water", quantity: 0, unit: "L", updatedAt: "2026-07-09T12:00:00.000Z" },
    ]);
    expect(savedResources).toHaveLength(1);
    expect(savedResources[0]).toEqual(result);
  });
});
