import type { Database } from "bun:sqlite";

import type { ProductionBlueprint, StarterModuleInstance } from "../../kepler/types";
import type { HabitatModule, ModuleRuntimeAttributes } from "../../modules/types";
import type { ModuleCapabilityRow, ModuleConnectionRow, ModuleRow } from "./types";

function hydrateRuntimeAttributes(value: string): ModuleRuntimeAttributes {
  return JSON.parse(value) as ModuleRuntimeAttributes;
}

export function loadModulesFromSqlite(database: Database): HabitatModule[] {
  const modules = database
    .query(
      `
      SELECT id, blueprint_id, display_name, source, runtime_attributes_json, created_at, updated_at
      FROM modules
      ORDER BY sort_index, id
      `,
    )
    .all() as ModuleRow[];

  const connections = database
    .query(
      `
      SELECT module_id, position, connected_to_module_id
      FROM module_connections
      ORDER BY module_id, position
      `,
    )
    .all() as ModuleConnectionRow[];

  const capabilities = database
    .query(
      `
      SELECT module_id, position, capability
      FROM module_capabilities
      ORDER BY module_id, position
      `,
    )
    .all() as ModuleCapabilityRow[];

  const connectionsByModuleId = groupConnections(connections);
  const capabilitiesByModuleId = groupCapabilities(capabilities);

  return modules.map((row) => ({
    id: row.id,
    blueprintId: row.blueprint_id,
    displayName: row.display_name,
    connectedTo: connectionsByModuleId.get(row.id) ?? [],
    runtimeAttributes: hydrateRuntimeAttributes(row.runtime_attributes_json),
    capabilities: capabilitiesByModuleId.get(row.id) ?? [],
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export function saveModulesToSqlite(database: Database, modules: HabitatModule[]): void {
  database.exec("DELETE FROM module_connections");
  database.exec("DELETE FROM module_capabilities");
  database.exec("DELETE FROM modules");

  const insertModule = database.query(
    `
    INSERT INTO modules (
      id,
      sort_index,
      blueprint_id,
      display_name,
      source,
      runtime_attributes_json,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
  );
  const insertConnection = database.query(
    "INSERT INTO module_connections (module_id, position, connected_to_module_id) VALUES (?, ?, ?)",
  );
  const insertCapability = database.query(
    "INSERT INTO module_capabilities (module_id, position, capability) VALUES (?, ?, ?)",
  );

  modules.forEach((module, index) => {
    insertModule.run(
      module.id,
      index,
      module.blueprintId,
      module.displayName,
      module.source,
      JSON.stringify(module.runtimeAttributes),
      module.createdAt,
      module.updatedAt,
    );

    module.connectedTo.forEach((connectedToModuleId, position) => {
      insertConnection.run(module.id, position, connectedToModuleId);
    });

    module.capabilities.forEach((capability, position) => {
      insertCapability.run(module.id, position, capability);
    });
  });
}

export function deleteModulesFromSqlite(database: Database): void {
  database.exec("DELETE FROM module_connections");
  database.exec("DELETE FROM module_capabilities");
  database.exec("DELETE FROM modules");
}

export function hydrateModulesFromStarterModuleRows(
  starterModules: StarterModuleInstance[],
  blueprints: ProductionBlueprint[] = [],
): HabitatModule[] {
  const now = new Date().toISOString();
  const blueprintsById = new Map(blueprints.map((blueprint) => [blueprint.blueprintId, blueprint]));

  return starterModules.map((starterModule) => ({
    id: starterModule.id,
    blueprintId: starterModule.blueprintId,
    displayName: starterModule.displayName,
    connectedTo: starterModule.connectedTo,
    runtimeAttributes: hydrateRuntimeAttributesFromBlueprint(
      starterModule.runtimeAttributes,
      blueprintsById.get(starterModule.blueprintId),
    ),
    capabilities: starterModule.capabilities,
    source: "starter",
    createdAt: now,
    updatedAt: now,
  }));
}

function hydrateRuntimeAttributesFromBlueprint(
  runtimeAttributes: Record<string, unknown>,
  blueprint: ProductionBlueprint | undefined,
): ModuleRuntimeAttributes {
  const merged = {
    ...(blueprint?.runtimeAttributes ?? {}),
    ...runtimeAttributes,
  } as ModuleRuntimeAttributes;

  if (
    merged.energyCapacityKwh !== undefined &&
    merged.energyStoredKwh === undefined &&
    merged.currentEnergyKwh === undefined
  ) {
    merged.energyStoredKwh = merged.energyCapacityKwh;
    merged.currentEnergyKwh = merged.energyCapacityKwh;
  }

  return merged;
}

function groupConnections(rows: ModuleConnectionRow[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const values = grouped.get(row.module_id) ?? [];
    values[row.position] = row.connected_to_module_id;
    grouped.set(row.module_id, values);
  }

  return grouped;
}

function groupCapabilities(rows: ModuleCapabilityRow[]): Map<string, string[]> {
  const grouped = new Map<string, string[]>();
  for (const row of rows) {
    const values = grouped.get(row.module_id) ?? [];
    values[row.position] = row.capability;
    grouped.set(row.module_id, values);
  }

  return grouped;
}
