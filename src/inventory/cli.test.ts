import { describe, expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { registerInventoryCommands } from "./cli";
import * as inventory from "./index";

describe("inventory cli", () => {
  test("registers inventory list command", () => {
    const program = new Command();

    registerInventoryCommands(program);

    const inventoryCommand = program.commands.find((command) => command.name() === "inventory");
    const listCommand = inventoryCommand?.commands.find((command) => command.name() === "list");

    expect(inventoryCommand?.description()).toBe("Manage local habitat inventory.");
    expect(listCommand?.description()).toBe("List local habitat inventory resources.");
  });

  test("registers inventory add command", () => {
    const program = new Command();

    registerInventoryCommands(program);

    const inventoryCommand = program.commands.find((command) => command.name() === "inventory");
    const addCommand = inventoryCommand?.commands.find((command) => command.name() === "add");

    expect(addCommand?.description()).toBe("Add quantity to a local inventory resource.");
  });

  test("adds inventory quantity from the add command", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const addSpy = spyOn(inventory, "addInventoryResource").mockResolvedValue({
      resourceType: "ferrite",
      quantity: 90,
      updatedAt: "2026-07-09T12:00:00.000Z",
    });

    registerInventoryCommands(program);

    await program.parseAsync(["inventory", "add", "ferrite", "90"], { from: "user" });

    expect(addSpy).toHaveBeenCalledWith({
      resourceType: "ferrite",
      quantity: 90,
      unit: undefined,
    });
    expect(logSpy).toHaveBeenCalledWith(
      ["resourceType: ferrite", "quantity: 90", "unit: -", "updatedAt: 2026-07-09T12:00:00.000Z"].join("\n"),
    );

    addSpy.mockRestore();
    logSpy.mockRestore();
  });
});
