import type { Database } from "bun:sqlite";

import type { HabitatInventoryResource } from "../../inventory/types";
import { withTransaction } from "./index";
import type { InventoryRow } from "./types";

export function loadInventoryFromSqlite(database: Database): HabitatInventoryResource[] {
  const rows = database
    .query(
      `
      SELECT resource_type, quantity, unit, updated_at
      FROM inventory_resources
      ORDER BY resource_type
      `,
    )
    .all() as InventoryRow[];

  return rows.map((row) => ({
    resourceType: row.resource_type,
    quantity: row.quantity,
    unit: row.unit ?? undefined,
    updatedAt: row.updated_at,
  }));
}

export function saveInventoryToSqlite(database: Database, resources: HabitatInventoryResource[]): void {
  withTransaction(database, () => {
    database.exec("DELETE FROM inventory_resources");
    const insert = database.query(
      "INSERT INTO inventory_resources (resource_type, quantity, unit, updated_at) VALUES (?, ?, ?, ?)",
    );

    for (const resource of resources) {
      insert.run(resource.resourceType, resource.quantity, resource.unit ?? null, resource.updatedAt);
    }
  });
}

export function deleteInventoryFromSqlite(database: Database): void {
  database.exec("DELETE FROM inventory_resources");
}
