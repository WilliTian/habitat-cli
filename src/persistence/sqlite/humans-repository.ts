import type { Database } from "bun:sqlite";

import type { StarterHuman } from "../../kepler/types";
import { withTransaction } from "./index";
import type { HumanRow } from "./types";

export function loadHumansFromSqlite(database: Database): StarterHuman[] {
  const rows = database
    .query(
      `
      SELECT id, display_name, location_module_id
      FROM humans
      ORDER BY id
      `,
    )
    .all() as HumanRow[];

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    locationModuleId: row.location_module_id,
  }));
}

export function replaceHumansFromSqlite(database: Database, humans: StarterHuman[]): void {
  withTransaction(database, () => {
    database.exec("DELETE FROM humans");
    const insert = database.query(
      "INSERT INTO humans (id, display_name, location_module_id) VALUES (?, ?, ?)",
    );

    for (const human of humans) {
      insert.run(human.id, human.displayName, human.locationModuleId);
    }
  });
}
