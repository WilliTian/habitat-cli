import { Command } from "commander";

import { scanWorld } from "../api/world";
import { formatScanSummary, formatSingleTileScan } from "./format";

export type WorldCommandDependencies = {
  scanWorld: typeof scanWorld;
};

const defaultDependencies: WorldCommandDependencies = { scanWorld };

export function registerWorldCommands(
  program: Command,
  dependencies: Partial<WorldCommandDependencies> = {},
): void {
  const commandDependencies = { ...defaultDependencies, ...dependencies };

  program
    .command("scan")
    .description("Scan nearby world resources.")
    .requiredOption("--x <integer>", "Current x coordinate")
    .requiredOption("--y <integer>", "Current y coordinate")
    .requiredOption("--strength <0-100>", "Effective sensor strength")
    .option("--radius <0-5>", "Scan radius", "0")
    .option("--json", "Print the complete JSON response")
    .action(async (options: ScanCommandOptions) => {
      const scan = await commandDependencies.scanWorld({
        x: parseIntegerOption(options.x, "x"),
        y: parseIntegerOption(options.y, "y"),
        sensorStrength: parseBoundedIntegerOption(options.strength, "strength", 0, 100),
        radiusTiles: parseBoundedIntegerOption(options.radius, "radius", 0, 5),
      });

      if (options.json) {
        console.log(JSON.stringify(scan, null, 2));
        return;
      }

      if (scan.scan.radiusTiles === 0) {
        const [tile] = scan.scan.tiles;
        if (tile === undefined) {
          throw new Error("Scan returned no tile for radius 0.");
        }
        console.log(formatSingleTileScan(tile));
        return;
      }

      console.log(formatScanSummary(scan.scan.tiles));
    });
}

type ScanCommandOptions = {
  x: string;
  y: string;
  strength: string;
  radius: string;
  json?: boolean;
};

function parseIntegerOption(value: string, name: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${name} must be an integer.`);
  }

  return Number(value);
}

function parseBoundedIntegerOption(
  value: string,
  name: string,
  minimum: number,
  maximum: number,
): number {
  const parsed = parseIntegerOption(value, name);
  if (parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be between ${minimum} and ${maximum}.`);
  }

  return parsed;
}
