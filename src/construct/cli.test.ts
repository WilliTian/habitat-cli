import { describe, expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { registerConstructCommands } from "./cli";
import * as construct from "./index";
import type {
  CancelConstructionReport,
  ConstructDryRunReport,
  ConstructStartReport,
} from "./types";

function dryRunReportFixture(): ConstructDryRunReport {
  return {
    blueprint: {
      id: "small-solar-array",
      blueprintId: "small-solar-array",
      displayName: "Small Solar Array",
      description: "Compact solar generation array",
      status: "published",
      output: {},
      inputs: {},
      buildTicks: 180,
      repeatable: true,
    },
    buildTicks: 180,
    requiredFacility: {
      exists: true,
      moduleType: null,
      matchingModuleIds: [],
    },
    fabricatorAvailable: true,
    supplyCacheOnline: true,
    prerequisitesMet: {
      missing: [],
    },
    inventorySufficient: {
      missing: [],
    },
    moduleToCreate: {},
    resourcesToSpend: [],
    canStart: true,
  };
}

function startReportFixture(): ConstructStartReport {
  return {
    blueprint: {
      id: "small-solar-array",
      blueprintId: "small-solar-array",
      displayName: "Small Solar Array",
      description: "Compact solar generation array",
      status: "published",
      output: {},
      inputs: {},
      buildTicks: 180,
      repeatable: true,
    },
    fabricatorId: "fabricator-1",
    fabricatorDisplayName: "Workshop Fabricator",
    outputModuleId: "small_solar_array_1",
    buildTicks: 180,
    remainingTicks: 180,
    futureModule: {
      blueprintId: "small-solar-array",
      displayName: "Small Solar Array",
      runtimeAttributes: {},
      capabilities: [],
    },
    resourcesSpent: [],
  };
}

function cancelReportFixture(): CancelConstructionReport {
  return {
    fabricatorId: "fabricator-1",
    fabricatorDisplayName: "Workshop Fabricator",
    cancelled: true,
    displayName: "Small Solar Array",
  };
}

describe("construct cli", () => {
  test("imports construction behavior without direct API or persistence access", async () => {
    const source = await Bun.file(new URL("./cli.ts", import.meta.url)).text();

    expect(source).toContain('from "./index"');
    expect(source).not.toContain('from "../api/');
    expect(source).not.toContain('/state"');
    expect(source).not.toContain("persistence");
  });

  test("starts construction when --dry-run is not provided", async () => {
    const program = new Command();
    const errorSpy = spyOn(console, "error").mockImplementation(() => {});
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const startSpy = spyOn(construct, "startConstruction").mockResolvedValue(startReportFixture());
    const formatStartSpy = spyOn(construct, "formatConstructionStart").mockReturnValue(
      "formatted start",
    );

    registerConstructCommands(program);

    await program.parseAsync(["construct", "small-solar-array"], { from: "user" });

    expect(startSpy).toHaveBeenCalledWith("small-solar-array");
    expect(formatStartSpy).toHaveBeenCalledWith(startReportFixture());
    expect(logSpy).toHaveBeenCalledWith("formatted start");

    formatStartSpy.mockRestore();
    startSpy.mockRestore();
    logSpy.mockRestore();
    errorSpy.mockRestore();
  });

  test("runs the dry-run evaluator and formatter when --dry-run is provided", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const evaluateSpy = spyOn(construct, "evaluateConstructionDryRun").mockResolvedValue(
      dryRunReportFixture(),
    );
    const formatSpy = spyOn(construct, "formatConstructionDryRun").mockReturnValue(
      "formatted dry run",
    );

    registerConstructCommands(program);

    await program.parseAsync(["construct", "small-solar-array", "--dry-run"], {
      from: "user",
    });

    expect(evaluateSpy).toHaveBeenCalledWith("small-solar-array");
    expect(formatSpy).toHaveBeenCalledWith(dryRunReportFixture());
    expect(logSpy).toHaveBeenCalledWith("formatted dry run");

    formatSpy.mockRestore();
    evaluateSpy.mockRestore();
    logSpy.mockRestore();
  });

  test("runs construction status output", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const readSpy = spyOn(construct, "readConstructionStatus").mockResolvedValue([]);
    const formatSpy = spyOn(construct, "formatConstructionStatus").mockReturnValue(
      "No active construction jobs.",
    );

    registerConstructCommands(program);

    await program.parseAsync(["construction", "status"], { from: "user" });

    expect(readSpy).toHaveBeenCalled();
    expect(formatSpy).toHaveBeenCalledWith([]);
    expect(logSpy).toHaveBeenCalledWith("No active construction jobs.");

    formatSpy.mockRestore();
    readSpy.mockRestore();
    logSpy.mockRestore();
  });

  test("runs construction cancel output", async () => {
    const program = new Command();
    const logSpy = spyOn(console, "log").mockImplementation(() => {});
    const cancelSpy = spyOn(construct, "cancelConstruction").mockResolvedValue(
      cancelReportFixture(),
    );
    const formatSpy = spyOn(construct, "formatCancelConstruction").mockReturnValue(
      "cancelled construction",
    );

    registerConstructCommands(program);

    await program.parseAsync(["construction", "cancel", "workshop-fabricator-1"], {
      from: "user",
    });

    expect(cancelSpy).toHaveBeenCalledWith("workshop-fabricator-1");
    expect(formatSpy).toHaveBeenCalledWith(cancelReportFixture());
    expect(logSpy).toHaveBeenCalledWith("cancelled construction");

    formatSpy.mockRestore();
    cancelSpy.mockRestore();
    logSpy.mockRestore();
  });

  test("registers construction status command", () => {
    const program = new Command();

    registerConstructCommands(program);

    const constructionCommand = program.commands.find((command) => command.name() === "construction");
    const statusCommand = constructionCommand?.commands.find((command) => command.name() === "status");
    const cancelCommand = constructionCommand?.commands.find((command) => command.name() === "cancel");

    expect(constructionCommand?.description()).toBe("Inspect local habitat construction jobs.");
    expect(statusCommand?.description()).toBe("Show active construction jobs and remaining build time.");
    expect(cancelCommand?.description()).toBe("Cancel one active construction job on a fabricator.");
  });
});
