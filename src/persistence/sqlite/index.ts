import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Database } from "bun:sqlite";

import { initialSchemaStatements, initialSchemaVersion } from "./schema";

let sharedDatabase: Database | undefined;
const registrationAlertContractMigration = "2026-07-15-registration-alert-contract";

const projectRootPath = fileURLToPath(new URL("../../../", import.meta.url));

export function resolveHabitatDatabasePath(): string {
  if (process.env.HABITAT_SQLITE_PATH?.trim()) {
    return process.env.HABITAT_SQLITE_PATH.trim();
  }

  if (process.env.BUN_TEST || process.env.NODE_ENV === "test") {
    return process.env.HABITAT_TEST_SQLITE_PATH?.trim() || "/tmp/habitat-cli-test.sqlite";
  }

  return join(projectRootPath, "state.sqlite");
}

export function openHabitatDatabase(path = resolveHabitatDatabasePath()): Database {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }

  const database = new Database(path);
  database.exec("PRAGMA foreign_keys = ON;");
  database.exec("PRAGMA journal_mode = DELETE;");
  applySchema(database);
  return database;
}

export function getHabitatDatabase(): Database {
  if (!sharedDatabase) {
    sharedDatabase = openHabitatDatabase();
  }

  return sharedDatabase;
}

export function resetHabitatDatabaseForTests(): void {
  sharedDatabase = undefined;
}

export function applySchema(database: Database): void {
  for (const statement of initialSchemaStatements) {
    database.exec(statement);
  }

  database
    .query("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
    .run(initialSchemaVersion, new Date().toISOString());

  applyRegistrationAlertContractMigration(database);
}

function applyRegistrationAlertContractMigration(database: Database): void {
  if (hasAppliedMigration(database, registrationAlertContractMigration)) {
    return;
  }

  const columns = database.query("PRAGMA table_info(registration)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "alert_contract_json")) {
    database.exec("ALTER TABLE registration ADD COLUMN alert_contract_json TEXT");
  }

  markMigrationApplied(database, registrationAlertContractMigration);
}

export function withTransaction<T>(database: Database, work: () => T): T {
  return database.transaction(work)();
}

export function hasAppliedMigration(database: Database, version: string): boolean {
  const row = database
    .query("SELECT 1 FROM schema_migrations WHERE version = ? LIMIT 1")
    .get(version);
  return row != null;
}

export function markMigrationApplied(database: Database, version: string): void {
  database
    .query("INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)")
    .run(version, new Date().toISOString());
}
