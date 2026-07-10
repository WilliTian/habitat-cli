import type { Database } from "bun:sqlite";

import type { KeplerHabitatState } from "../../kepler/types";
import type { RegistrationRow } from "./types";

export function loadRegistrationStateFromSqlite(database: Database): KeplerHabitatState | undefined {
  const row = database
    .query(
      `
      SELECT
        id,
        habitat_uuid,
        habitat_id,
        display_name,
        registered_at,
        refreshed_at,
        module_count,
        habitat_slug,
        catalog_version,
        status,
        last_seen_at,
        starter_modules_json
      FROM registration
      WHERE id = 1
      `,
    )
    .get() as RegistrationRow | undefined;

  if (!row) {
    return undefined;
  }

  const starterModules = JSON.parse(row.starter_modules_json) as KeplerHabitatState["starterModules"];
  const habitat = buildHabitat(row);

  return {
    displayName: row.display_name,
    habitatUuid: row.habitat_uuid,
    habitatId: row.habitat_id,
    starterModules,
    moduleCount: row.module_count ?? undefined,
    habitat,
    registeredAt: row.registered_at,
    refreshedAt: row.refreshed_at ?? undefined,
  };
}

export function saveRegistrationStateToSqlite(
  database: Database,
  keplerHabitat: KeplerHabitatState,
): void {
  database
    .query("DELETE FROM registration WHERE id = 1")
    .run();

  const habitat = keplerHabitat.habitat;
  database
    .query(
      `
      INSERT INTO registration (
        id,
        habitat_uuid,
        habitat_id,
        display_name,
        registered_at,
        refreshed_at,
        module_count,
        habitat_slug,
        catalog_version,
        status,
        last_seen_at,
        starter_modules_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      1,
      keplerHabitat.habitatUuid,
      keplerHabitat.habitatId,
      keplerHabitat.displayName,
      keplerHabitat.registeredAt,
      keplerHabitat.refreshedAt ?? null,
      keplerHabitat.moduleCount ?? null,
      habitat?.habitatSlug ?? null,
      habitat?.catalogVersion ?? null,
      habitat?.status ?? null,
      habitat?.lastSeenAt ?? null,
      JSON.stringify(keplerHabitat.starterModules),
    );
}

export function deleteRegistrationStateFromSqlite(database: Database): void {
  database.query("DELETE FROM registration WHERE id = 1").run();
}

function buildHabitat(row: RegistrationRow): KeplerHabitatState["habitat"] {
  if (!row.habitat_slug || !row.catalog_version || !row.status) {
    return undefined;
  }

  return {
    id: row.habitat_id,
    habitatSlug: row.habitat_slug,
    displayName: row.display_name,
    catalogVersion: row.catalog_version,
    status: row.status,
    lastSeenAt: row.last_seen_at,
  };
}
