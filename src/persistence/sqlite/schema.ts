export const initialSchemaVersion = "2026-07-10-initial";

export const initialSchemaStatements = [
  `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS registration (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    habitat_uuid TEXT NOT NULL,
    habitat_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    registered_at TEXT NOT NULL,
    refreshed_at TEXT,
    module_count INTEGER,
    habitat_slug TEXT,
    catalog_version TEXT,
    status TEXT,
    last_seen_at TEXT,
    starter_modules_json TEXT NOT NULL,
    alert_contract_json TEXT
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    sort_index INTEGER NOT NULL,
    blueprint_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    source TEXT NOT NULL CHECK (source IN ('starter', 'local')),
    runtime_attributes_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS module_connections (
    module_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    connected_to_module_id TEXT NOT NULL,
    PRIMARY KEY (module_id, position),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS module_capabilities (
    module_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    capability TEXT NOT NULL,
    PRIMARY KEY (module_id, position),
    FOREIGN KEY (module_id) REFERENCES modules(id) ON DELETE CASCADE
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS inventory_resources (
    resource_type TEXT PRIMARY KEY,
    quantity REAL NOT NULL,
    unit TEXT,
    updated_at TEXT NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS humans (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    location_module_id TEXT NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS eva_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    deployed_human_id TEXT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    carried_resources_json TEXT NOT NULL,
    max_carrying_capacity_kg REAL NOT NULL
  )
  `,
  `
  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY, condition_key TEXT NOT NULL, severity TEXT NOT NULL, status TEXT NOT NULL,
    source TEXT NOT NULL, created_at TEXT NOT NULL, last_observed_at TEXT NOT NULL,
    occurrence_count INTEGER NOT NULL, human_id TEXT, module_id TEXT, message TEXT NOT NULL
  )
  `,
] as const;
