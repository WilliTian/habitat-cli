import { describe, expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { requestHabitatApiJson } from "../api/client";
import { registerInventoryCommands } from "./cli";
import { formatInventoryResource, formatInventoryTable } from "./format";
import type { HabitatInventoryResource } from "./types";

const resource: HabitatInventoryResource = {
  resourceType: "ferrite",
  quantity: 90,
  updatedAt: "2026-07-09T12:00:00.000Z",
};

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

  test("imports API operations and pure formatters", async () => {
    const source = await Bun.file(new URL("./cli.ts", import.meta.url)).text();

    expect(source).toContain('from "../api/inventory"');
    expect(source).toContain('from "./format"');
    expect(source).not.toContain('from "./index"');
    expect(source).not.toContain('from "./state"');
  });

  test("adds inventory quantity from the add command", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const adjustments: unknown[] = [];

    registerInventoryCommands(program, {
      adjustInventory: async (...input) => {
        adjustments.push(input);
        return { resource };
      },
    });

    await program.parseAsync(["inventory", "add", "ferrite", "90"], { from: "user" });

    expect(adjustments).toEqual([["ferrite", 90, undefined]]);
    expect(logSpy).toHaveBeenCalledWith(formatInventoryResource(resource));

    logSpy.mockRestore();
  });

  test("removes inventory by sending a negative adjustment", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const adjustments: unknown[] = [];

    registerInventoryCommands(program, {
      adjustInventory: async (...input) => {
        adjustments.push(input);
        return { resource: { ...resource, quantity: 50 } };
      },
    });

    await program.parseAsync(["inventory", "remove", "ferrite", "40"], { from: "user" });

    expect(adjustments).toEqual([["ferrite", -40, undefined]]);
    expect(logSpy).toHaveBeenCalledWith(formatInventoryResource({ ...resource, quantity: 50 }));
    logSpy.mockRestore();
  });

  test("remove preserves the overdraw message from an API 409", async () => {
    const program = new Command();

    registerInventoryCommands(program, {
      adjustInventory: (resourceType) => requestHabitatApiJson(
        `/inventory/${resourceType}`,
        {
          fetchImpl: async () => new Response(JSON.stringify({
            error: {
              code: "inventory_overdraw",
              message: "Cannot remove 11 steel; only 10 is available.",
            },
          }), { status: 409 }),
        },
      ),
    });

    await expect(
      program.parseAsync(["inventory", "remove", "steel", "11"], { from: "user" }),
    ).rejects.toMatchObject({
      message: "Cannot remove 11 steel; only 10 is available.",
    });
  });

  test("lists API-backed inventory and preserves empty output", async () => {
    const populated = new Command();
    const empty = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});

    registerInventoryCommands(populated, { readInventory: async () => ({ inventory: [resource] }) });
    registerInventoryCommands(empty, { readInventory: async () => ({ inventory: [] }) });

    await populated.parseAsync(["inventory", "list"], { from: "user" });
    await empty.parseAsync(["inventory", "list"], { from: "user" });

    expect(logSpy).toHaveBeenNthCalledWith(1, formatInventoryTable([resource]));
    expect(logSpy).toHaveBeenNthCalledWith(2, "No inventory resources found.");
    logSpy.mockRestore();
  });
});
