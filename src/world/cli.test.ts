import { expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { registerWorldCommands } from "./cli";
import type { WorldScanResponse } from "../kepler/types";

const scanFixture = {
  scan: {
    modelVersion: "resource-probability-v2",
    origin: { x: 3, y: -2 },
    sensorStrength: 60,
    radiusTiles: 0,
    tiles: [
      {
        x: 3,
        y: -2,
        terrain: "flat",
        distanceTiles: 0,
        probabilities: [
          { resourceType: "ferrite", probabilityPct: 74 },
          { resourceType: null, probabilityPct: 26 },
        ],
        topCandidate: { resourceType: "ferrite", probabilityPct: 74 },
        quantityEstimate: {
          resourceType: "ferrite",
          unit: "kg",
          estimatedKg: 120,
          minimumKg: 80,
          maximumKg: 160,
          exact: false,
        },
      },
    ],
  },
} satisfies WorldScanResponse;

test("registers scan with the agreed options", () => {
  const program = new Command();
  registerWorldCommands(program, { scanWorld: async () => scanFixture });

  const scan = program.commands.find((command) => command.name() === "scan");

  expect(scan?.options.map((option) => option.long)).toEqual([
    "--x", "--y", "--strength", "--radius", "--json",
  ]);
});

test("prints unformatted scan JSON with --json", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const scanWorld = async () => scanFixture;
  registerWorldCommands(program, { scanWorld });

  await program.parseAsync(
    ["scan", "--x", "3", "--y", "-2", "--strength", "60", "--json"],
    { from: "user" },
  );

  expect(logSpy).toHaveBeenCalledWith(JSON.stringify(scanFixture, null, 2));
  logSpy.mockRestore();
});

test("passes parsed scan options to the local adapter", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const calls: unknown[] = [];
  registerWorldCommands(program, {
    scanWorld: async (input) => {
      calls.push(input);
      return scanFixture;
    },
  });

  await program.parseAsync(
    ["scan", "--x", "3", "--y", "-2", "--strength", "60", "--radius", "1"],
    { from: "user" },
  );

  expect(calls).toEqual([{ x: 3, y: -2, sensorStrength: 60, radiusTiles: 1 }]);
  logSpy.mockRestore();
});

test("rejects non-integer scan coordinates", async () => {
  const program = new Command().exitOverride();
  registerWorldCommands(program, { scanWorld: async () => scanFixture });

  await expect(
    program.parseAsync(["scan", "--x", "3.5", "--y", "-2", "--strength", "60"], {
      from: "user",
    }),
  ).rejects.toThrow("x must be an integer.");
});

test("rejects unsafe integer scan coordinates", async () => {
  const program = new Command().exitOverride();
  registerWorldCommands(program, { scanWorld: async () => scanFixture });

  await expect(
    program.parseAsync(
      ["scan", "--x", "9007199254740993", "--y", "-2", "--strength", "60"],
      { from: "user" },
    ),
  ).rejects.toThrow("x must be a safe integer.");
});

test("rejects scan strength and radius outside their allowed ranges", async () => {
  const program = new Command().exitOverride();
  registerWorldCommands(program, { scanWorld: async () => scanFixture });

  await expect(
    program.parseAsync(["scan", "--x", "3", "--y", "-2", "--strength", "101"], {
      from: "user",
    }),
  ).rejects.toThrow("strength must be between 0 and 100.");

  await expect(
    program.parseAsync(
      ["scan", "--x", "3", "--y", "-2", "--strength", "60", "--radius", "6"],
      { from: "user" },
    ),
  ).rejects.toThrow("radius must be between 0 and 5.");
});
