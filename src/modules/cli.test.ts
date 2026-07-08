import { describe, expect, test } from "bun:test";
import { Command } from "commander";

import { registerModuleCommands } from "./cli";

describe("module cli", () => {
  test("registers module status command", () => {
    const program = new Command();

    registerModuleCommands(program);

    const moduleCommand = program.commands.find((command) => command.name() === "module");
    const statusCommand = moduleCommand?.commands.find((command) => command.name() === "status");

    expect(statusCommand?.description()).toBe("Show local module states and power draw.");
  });

  test("registers module set-status command", () => {
    const program = new Command();

    registerModuleCommands(program);

    const moduleCommand = program.commands.find((command) => command.name() === "module");
    const setStatusCommand = moduleCommand?.commands.find(
      (command) => command.name() === "set-status",
    );

    expect(setStatusCommand?.description()).toBe("Set one local module runtime status.");
  });
});
