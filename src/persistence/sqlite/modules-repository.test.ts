import { describe, expect, test } from "bun:test";

import { openHabitatDatabase } from "./index";
import { loadModulesFromSqlite, saveModulesToSqlite } from "./modules-repository";

describe("module sqlite repository", () => {
  test("round-trips modules, connections, and capabilities", () => {
    const database = openHabitatDatabase(":memory:");
    saveModulesToSqlite(database, [
      {
        id: "module-1",
        blueprintId: "command-module",
        displayName: "Command Module",
        connectedTo: ["module-2", "module-3"],
        runtimeAttributes: { status: "online", health: 100 },
        capabilities: ["habitat-command", "habitat-control"],
        source: "starter",
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
    ]);

    expect(loadModulesFromSqlite(database)).toEqual([
      {
        id: "module-1",
        blueprintId: "command-module",
        displayName: "Command Module",
        connectedTo: ["module-2", "module-3"],
        runtimeAttributes: { status: "online", health: 100 },
        capabilities: ["habitat-command", "habitat-control"],
        source: "starter",
        createdAt: "2026-07-10T00:00:00.000Z",
        updatedAt: "2026-07-10T00:00:00.000Z",
      },
    ]);
  });
});
