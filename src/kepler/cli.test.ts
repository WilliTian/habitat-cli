import { describe, expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import {
  formatSolarIrradianceStatus,
} from "./format";
import { registerBlueprintCommands } from "./index";
import * as keplerService from "./service";

describe("blueprint cli", () => {
  test("registers blueprint list command", () => {
    const program = new Command();

    registerBlueprintCommands(program);

    const blueprintCommand = program.commands.find((command) => command.name() === "blueprint");
    const listCommand = blueprintCommand?.commands.find((command) => command.name() === "list");

    expect(listCommand?.description()).toBe("List Kepler blueprints.");
  });

  test("registers blueprint show command", () => {
    const program = new Command();

    registerBlueprintCommands(program);

    const blueprintCommand = program.commands.find((command) => command.name() === "blueprint");
    const showCommand = blueprintCommand?.commands.find((command) => command.name() === "show");

    expect(showCommand?.description()).toBe("Show one Kepler blueprint.");
  });

  test("prints blueprint list as a two-column table", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const listBlueprintsSpy = spyOn(keplerService, "listBlueprints").mockResolvedValue([
      {
        id: "survey-rover",
        blueprintId: "survey-rover",
        displayName: "Survey Rover",
        description: "",
        status: "published",
        output: {},
        inputs: {},
        buildTicks: 120,
        repeatable: true,
      },
      {
        id: "basic-battery",
        blueprintId: "basic-battery",
        displayName: "Basic Battery",
        description: "",
        status: "published",
        output: {},
        inputs: {},
        buildTicks: 60,
        repeatable: true,
      },
    ]);

    registerBlueprintCommands(program);

    await program.parseAsync(["node", "habitat", "blueprint", "list"]);

    expect(listBlueprintsSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      [
        "BLUEPRINT ID    DISPLAY NAME",
        "basic-battery   Basic Battery",
        "survey-rover    Survey Rover",
      ].join("\n"),
    );

    listBlueprintsSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe("resource cli", () => {
  test("registers resource list command", () => {
    const program = new Command();

    registerBlueprintCommands(program);

    const resourceCommand = program.commands.find((command) => command.name() === "resource");
    const listCommand = resourceCommand?.commands.find((command) => command.name() === "list");

    expect(resourceCommand?.description()).toBe("Manage the Kepler resource catalog.");
    expect(listCommand?.description()).toBe("List Kepler resource catalog entries.");
  });

  test("prints resource list as a four-column table", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const listResourcesSpy = spyOn(keplerService, "listResources").mockResolvedValue([
      {
        id: "water-ice",
        resourceType: "water-ice",
        displayName: "Water Ice",
        kind: "volatile",
        rarity: "common",
        amount: 50,
      },
      {
        id: "ferrite",
        resourceType: "ferrite",
        displayName: "Ferrite",
        kind: "ore",
        rarity: "uncommon",
        amount: 12,
      },
    ]);

    registerBlueprintCommands(program);

    await program.parseAsync(["node", "habitat", "resource", "list"]);

    expect(listResourcesSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      [
        "RESOURCE TYPE   DISPLAY NAME   KIND       AMOUNT   RARITY",
        "ferrite         Ferrite        ore        12       uncommon",
        "water-ice       Water Ice      volatile   50       common",
      ].join("\n"),
    );

    listResourcesSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe("solar cli", () => {
  test("formats solar status in beginner-friendly language", () => {
    const output = formatSolarIrradianceStatus({
      wPerM2: 900,
      condition: "clear",
    });

    expect(output).toBe(
      [
        "Sunlight is clear right now.",
        "Solar irradiance: 900 W/m2",
      ].join("\n"),
    );
  });

  test("registers solar status command", () => {
    const program = new Command();

    registerBlueprintCommands(program);

    const solarCommand = program.commands.find((command) => command.name() === "solar");
    const statusCommand = solarCommand?.commands.find((command) => command.name() === "status");

    expect(solarCommand?.description()).toBe("Show Kepler sunlight conditions.");
    expect(statusCommand?.description()).toBe("Show current solar irradiance from Kepler.");
  });

  test("prints current solar status", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const readSolarIrradianceSpy = spyOn(keplerService, "readSolarIrradiance").mockResolvedValue({
      wPerM2: 250,
      condition: "dust",
    });

    registerBlueprintCommands(program);

    await program.parseAsync(["node", "habitat", "solar", "status"]);

    expect(readSolarIrradianceSpy).toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      [
        "Sunlight is dusty right now.",
        "Solar irradiance: 250 W/m2",
      ].join("\n"),
    );

    readSolarIrradianceSpy.mockRestore();
    logSpy.mockRestore();
  });
});
