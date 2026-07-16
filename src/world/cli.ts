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
    .requiredOption("--strength <0-100>", "Effective sensor strength")
    .option("--radius <0-5>", "Scan radius", "0")
    .option("--json", "Print the complete JSON response")
    .action(async (options: ScanCommandOptions) => {
      const scan = await commandDependencies.scanWorld({
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
        console.log(formatSingleTileScan(tile, scan.scan.sensorStrength));
        return;
      }

      console.log(formatScanSummary(scan.scan.tiles, scan.scan.sensorStrength));
    });
}

type ScanCommandOptions = {
  strength: string;
  radius: string;
  json?: boolean;
};

function parseIntegerOption(value: string, name: string): number {
  if (!/^-?\d+$/.test(value)) {
    throw new Error(`${name} must be an integer.`);
  }

  const integer = Number(value);
  if (!Number.isSafeInteger(integer)) {
    throw new Error(`${name} must be a safe integer.`);
  }

  return integer;
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
