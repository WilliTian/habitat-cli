import { describe, expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { registerModuleCommands } from "./cli";
import { formatModule, formatModuleStatusUpdate, formatModuleSummary } from "./format";
import type { HabitatModule } from "./types";

function moduleFixture(input: Partial<HabitatModule> = {}): HabitatModule {
  return {
    id: "module-12345678",
    blueprintId: "command-module",
    displayName: "Command Module",
    connectedTo: [],
    runtimeAttributes: { status: "online", powerDrawKw: 1.5 },
    capabilities: ["habitat-command"],
    source: "local",
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...input,
  };
}

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

test("imports API operations and pure helpers without backend-owned modules", async () => {
  const source = await Bun.file(new URL("./cli.ts", import.meta.url)).text();

  expect(source).toContain('from "../api/modules"');
  expect(source).toContain('from "./format"');
  expect(source).not.toContain('from "./index"');
  expect(source).not.toContain('from "./state"');
  expect(source).not.toContain('from "../status/index"');
  expect(source).not.toContain('from "../ticks/index"');
});

test("status formats modules read through the API", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const module = moduleFixture();

  registerModuleCommands(program, { readModules: async () => ({ modules: [module] }) });

  await program.parseAsync(["module", "status"], { from: "user" });

  expect(logSpy).toHaveBeenCalledWith([
    "Command Module | status: online | powerDrawKw: 1.5",
    "totalPowerDrawKw: 1.5",
    "energyDemandPerTickKwh: 0.000417",
    "tickComparison: habitat tick 10 drains about 0.004167 kWh",
  ].join("\n"));
  logSpy.mockRestore();
});

test("list prints the existing empty message from API-backed module state", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});

  registerModuleCommands(program, { readModules: async () => ({ modules: [] }) });

  await program.parseAsync(["module", "list"], { from: "user" });

  expect(logSpy).toHaveBeenCalledWith("No modules found.");
  logSpy.mockRestore();
});

test("list formats API-backed modules", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const module = moduleFixture();

  registerModuleCommands(program, { readModules: async () => ({ modules: [module] }) });

  await program.parseAsync(["module", "list"], { from: "user" });

  expect(logSpy).toHaveBeenCalledWith(formatModuleSummary(module));
  logSpy.mockRestore();
});

test("show propagates a missing module response", async () => {
  const program = new Command();

  registerModuleCommands(program, {
    readModule: async () => {
      throw new Error('Module "missing" was not found.');
    },
  });

  await expect(program.parseAsync(["module", "show", "missing"], { from: "user" })).rejects.toThrow(
    'Module "missing" was not found.',
  );
});

test("create sends parsed command options to the module API", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const module = moduleFixture();
  const inputs: unknown[] = [];

  registerModuleCommands(program, {
    createModuleResource: async (input) => {
      inputs.push(input);
      return { module };
    },
  });

  await program.parseAsync([
    "module",
    "create",
    "--blueprint-id",
    "command-module",
    "--name",
    "Command Module",
    "--connected-to",
    "airlock",
    "--capability",
    "habitat-command",
    "--runtime-attribute",
    "health=100",
  ], { from: "user" });

  expect(inputs).toEqual([{
    blueprintId: "command-module",
    displayName: "Command Module",
    connectedTo: ["airlock"],
    capabilities: ["habitat-command"],
    runtimeAttributes: { health: "100" },
  }]);
  expect(logSpy).toHaveBeenCalledWith(formatModule(module));
  logSpy.mockRestore();
});

test("update sends only supplied fields to the module API", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const module = moduleFixture({ displayName: "Updated Command Module" });
  const updates: unknown[] = [];

  registerModuleCommands(program, {
    updateModuleResource: async (id, input) => {
      updates.push({ id, input });
      return { module };
    },
  });

  await program.parseAsync([
    "module",
    "update",
    "module-12",
    "--name",
    "Updated Command Module",
  ], { from: "user" });

  expect(updates).toEqual([{
    id: "module-12",
    input: { displayName: "Updated Command Module", connectedTo: undefined, capabilities: undefined, runtimeAttributes: undefined },
  }]);
  expect(logSpy).toHaveBeenCalledWith(formatModule(module));
  logSpy.mockRestore();
});

test("delete preserves the confirmation using the API response", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const module = moduleFixture();
  const ids: string[] = [];

  registerModuleCommands(program, {
    deleteModuleResource: async (id) => {
      ids.push(id);
      return { module };
    },
  });

  await program.parseAsync(["module", "delete", "module-12"], { from: "user" });

  expect(ids).toEqual(["module-12"]);
  expect(logSpy).toHaveBeenCalledWith('Deleted module "module-12345678".');
  logSpy.mockRestore();
});

test("set-status reads, patches, and formats the updated API module", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const current = moduleFixture({
    runtimeAttributes: { status: "online", powerDrawKw: { online: 1.5, active: 8 } },
  });
  const updated = moduleFixture({
    runtimeAttributes: { status: "active", powerDrawKw: { online: 1.5, active: 8 } },
  });
  const updates: unknown[] = [];

  registerModuleCommands(program, {
    readModule: async () => ({ module: current }),
    updateModuleResource: async (id, input) => {
      updates.push({ id, input });
      return { module: updated };
    },
  });

  await program.parseAsync(["module", "set-status", "module-12", "active"], { from: "user" });

  expect(updates).toEqual([{
    id: "module-12",
    input: { runtimeAttributes: { status: "active", powerDrawKw: { online: 1.5, active: 8 } } },
  }]);
  expect(logSpy).toHaveBeenCalledWith(formatModuleStatusUpdate({
    module: updated,
    status: "active",
    powerDrawKw: 8,
  }));
  logSpy.mockRestore();
});
