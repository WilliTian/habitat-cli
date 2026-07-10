import { describe, expect, test } from "bun:test";

import { openHabitatDatabase } from "./index";
import {
  deleteRegistrationStateFromSqlite,
  loadRegistrationStateFromSqlite,
  saveRegistrationStateToSqlite,
} from "./registration-repository";

describe("registration sqlite repository", () => {
  test("round-trips the local registration record", () => {
    const database = openHabitatDatabase(":memory:");
    const state = {
      displayName: "Habitat Alpha",
      habitatUuid: "uuid-1",
      habitatId: "habitat-1",
      starterModules: [
        {
          id: "starter-1",
          blueprintId: "command-module",
          displayName: "Command Module",
          connectedTo: [],
          runtimeAttributes: { status: "online" },
          capabilities: ["habitat-command"],
        },
      ],
      moduleCount: 1,
      habitat: {
        id: "habitat-1",
        habitatSlug: "habitat-alpha",
        displayName: "Habitat Alpha",
        catalogVersion: "2026-07-10",
        status: "registered",
        lastSeenAt: "2026-07-10T00:00:00.000Z",
      },
      registeredAt: "2026-07-10T00:00:00.000Z",
      refreshedAt: "2026-07-10T01:00:00.000Z",
    };

    saveRegistrationStateToSqlite(database, state);

    expect(loadRegistrationStateFromSqlite(database)).toEqual(state);

    deleteRegistrationStateFromSqlite(database);
    expect(loadRegistrationStateFromSqlite(database)).toBeUndefined();
  });
});
