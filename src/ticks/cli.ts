import { Command } from "commander";

import { applyPowerTicks, runPowerTicks } from "./index";
import type { PowerTickSummary } from "./types";
import type { HabitatModule } from "../modules/types";

export function registerTickCommands(program: Command): void {
  const tickCommand = program
    .command("tick")
    .description("Run local power simulation ticks.");

  tickCommand
    .argument("<count>", "Number of one-second ticks to run")
    .action(async (count: string) => {
      const result = await runPowerTicks(parseTickCount(count));
      console.log(formatPowerTickSummary(result.summary));
    });

  tickCommand
    .command("demo")
    .description("Run sample power ticks without changing local module state.")
    .argument("<count>", "Number of one-second ticks to run")
    .action((count: string) => {
      const result = applyPowerTicks({
        modules: createDemoModules(),
        tickCount: parseTickCount(count),
      });
      console.log(formatPowerTickSummary(result.summary));
    });
}

function parseTickCount(value: string): number {
  const tickCount = Number(value);

  if (!Number.isInteger(tickCount) || tickCount <= 0) {
    throw new Error("Tick count must be a positive integer.");
  }

  return tickCount;
}

export function formatPowerTickSummary(summary: PowerTickSummary): string {
  const lines = [
    `ticks: ${summary.tickCount}`,
    `activePowerDrawKw: ${formatNumber(summary.activePowerDrawKw)}`,
    `energyDemandKwh: ${formatNumber(summary.energyDemandKwh)}`,
    `energyDrainedKwh: ${formatNumber(summary.energyDrainedKwh)}`,
    `unmetEnergyKwh: ${formatNumber(summary.unmetEnergyKwh)}`,
  ];

  if (summary.batteryDrains.length === 0) {
    lines.push(
      summary.unmetEnergyKwh > 0
        ? "batteries: no usable battery energy available"
        : "batteries: none drained",
    );
  }

  for (const drain of summary.batteryDrains) {
    lines.push(
      `battery: ${drain.displayName} ${formatNumber(drain.beforeEnergyStoredKwh)} -> ${formatNumber(
        drain.afterEnergyStoredKwh,
      )} kWh`,
    );
  }

  return lines.join("\n");
}

function createDemoModules(): HabitatModule[] {
  const now = new Date().toISOString();

  return [
    {
      id: "demo-command-module",
      blueprintId: "command-module",
      displayName: "Demo Command Module",
      connectedTo: [],
      runtimeAttributes: {
        status: "active",
        powerDrawKw: 3.6,
      },
      capabilities: ["habitat-command"],
      source: "local",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "demo-battery",
      blueprintId: "battery",
      displayName: "Demo Battery",
      connectedTo: [],
      runtimeAttributes: {
        status: "active",
        energyStoredKwh: 10,
        energyCapacityKwh: 20,
      },
      capabilities: ["power-storage"],
      source: "local",
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
