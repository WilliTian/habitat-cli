import { expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { buildHabitatStatus } from "./format";
import { registerPowerCommands } from "./cli";
import type { HabitatModule } from "../modules/types";

const module: HabitatModule = {
  id: "command",
  blueprintId: "command",
  displayName: "Command Module",
  connectedTo: [],
  runtimeAttributes: { status: "active", powerDrawKw: 3.6 },
  capabilities: [],
  source: "starter",
  createdAt: "2026-07-13T00:00:00.000Z",
  updatedAt: "2026-07-13T00:00:00.000Z",
};

test("power overview formats API-backed module state", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});

  registerPowerCommands(program, {
    readStatus: async () => buildHabitatStatus([module]),
  });
  await program.parseAsync(["power", "overview"], { from: "user" });

  expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("totalPowerDrawKw: 3.6"));
  logSpy.mockRestore();
});
