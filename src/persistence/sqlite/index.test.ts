import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";

import { openHabitatDatabase } from "./index";

describe("sqlite bootstrap", () => {
  test("creates the expected local tables", () => {
    const database = openHabitatDatabase(":memory:");
    const tables = database
      .query("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual([
      "inventory_resources",
      "module_capabilities",
      "module_connections",
      "modules",
      "registration",
      "schema_migrations",
    ]);
  });

  test("uses delete journaling so the main database file stays self-contained", () => {
    const directory = mkdtempSync("/tmp/habitat-sqlite-");
    const path = join(directory, "state.sqlite");

    try {
      const database = openHabitatDatabase(path);
      const row = database.query("PRAGMA journal_mode").get() as { journal_mode: string };

      expect(row.journal_mode).toBe("delete");
      database.close();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
