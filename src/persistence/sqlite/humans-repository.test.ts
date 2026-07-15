import { describe, expect, test } from "bun:test";

import { openHabitatDatabase } from "./index";
import { loadHumansFromSqlite, replaceHumansFromSqlite } from "./humans-repository";

describe("human sqlite repository", () => {
  test("round-trips humans", () => {
    const database = openHabitatDatabase(":memory:");
    replaceHumansFromSqlite(database, [
      { id: "human-1", displayName: "Alex Rivera", locationModuleId: "command-module-1" },
    ]);

    expect(loadHumansFromSqlite(database)).toEqual([
      { id: "human-1", displayName: "Alex Rivera", locationModuleId: "command-module-1" },
    ]);
  });

  test("replaces the whole human collection", () => {
    const database = openHabitatDatabase(":memory:");
    replaceHumansFromSqlite(database, [
      { id: "human-1", displayName: "Alex Rivera", locationModuleId: "command-module-1" },
    ]);
    replaceHumansFromSqlite(database, [
      { id: "human-2", displayName: "Sam Chen", locationModuleId: "habitat-module-1" },
    ]);

    expect(loadHumansFromSqlite(database)).toEqual([
      { id: "human-2", displayName: "Sam Chen", locationModuleId: "habitat-module-1" },
    ]);
  });
});
