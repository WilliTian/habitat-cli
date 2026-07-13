import { describe, expect, test } from "bun:test";

import { openHabitatDatabase } from "./index";
import { loadInventoryFromSqlite, saveInventoryToSqlite } from "./inventory-repository";

describe("inventory sqlite repository", () => {
  test("round-trips inventory resources", () => {
    const database = openHabitatDatabase(":memory:");
    saveInventoryToSqlite(database, [
      {
        resourceType: "steel",
        quantity: 12,
        unit: "kg",
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
      {
        resourceType: "water",
        quantity: 4.5,
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
    ]);

    expect(loadInventoryFromSqlite(database)).toEqual([
      {
        resourceType: "steel",
        quantity: 12,
        unit: "kg",
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
      {
        resourceType: "water",
        quantity: 4.5,
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
    ]);
  });

  test("rolls back a failed collection replacement", () => {
    const database = openHabitatDatabase(":memory:");
    const original = {
      resourceType: "water",
      quantity: 4.5,
      updatedAt: "2026-07-10T00:00:00.000Z",
    };
    saveInventoryToSqlite(database, [original]);

    expect(() => saveInventoryToSqlite(database, [
      { ...original, resourceType: "steel" },
      { ...original, resourceType: "steel", quantity: 8 },
    ])).toThrow();

    expect(loadInventoryFromSqlite(database)).toEqual([original]);
  });
});
