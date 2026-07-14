import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

import { resetHabitatDatabaseForTests, resolveHabitatDatabasePath } from "./sqlite";

describe("persistence selection", () => {
  afterEach(() => {
    delete process.env.HABITAT_SQLITE_PATH;
    resetHabitatDatabaseForTests();
  });

  test("uses the repository-root sqlite path regardless of cwd", () => {
    const tempDir = mkdtempSync("/tmp/habitat-cwd-test-");
    const previousCwd = process.cwd();
    const previousBunTest = process.env.BUN_TEST;
    const previousNodeEnv = process.env.NODE_ENV;
    process.chdir(tempDir);
    delete process.env.BUN_TEST;
    delete process.env.NODE_ENV;

    try {
      expect(resolveHabitatDatabasePath()).toBe(
        join(previousCwd, "state.sqlite"),
      );
    } finally {
      process.chdir(previousCwd);
      if (previousBunTest !== undefined) {
        process.env.BUN_TEST = previousBunTest;
      }
      if (previousNodeEnv !== undefined) {
        process.env.NODE_ENV = previousNodeEnv;
      }
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
