import { Command } from "commander";

import {
  findBlueprint,
  formatBlueprint,
  formatBlueprintTable,
  formatResourceTable,
  formatSolarIrradianceStatus,
  listBlueprints,
  listResources,
  readSolarIrradiance,
} from "./index";

async function printBlueprintList(): Promise<void> {
  const blueprints = await listBlueprints();
  console.log(formatBlueprintTable(blueprints));
}

async function printBlueprintDetails(blueprintId: string): Promise<void> {
  const blueprint = await findBlueprint(blueprintId);

  if (!blueprint) {
    console.error(`Blueprint "${blueprintId}" was not found.`);
    process.exit(1);
  }

  console.log(formatBlueprint(blueprint));
}

async function printResourceList(): Promise<void> {
  const resources = await listResources();
  console.log(formatResourceTable(resources));
}

async function printSolarStatus(): Promise<void> {
  const solarIrradiance = await readSolarIrradiance();
  console.log(formatSolarIrradianceStatus(solarIrradiance));
}

export function registerBlueprintCommands(program: Command): void {
  const blueprintCommand = program
    .command("blueprint")
    .description("Manage Kepler blueprints.");

  blueprintCommand
    .command("list")
    .description("List Kepler blueprints.")
    .action(async () => {
      await printBlueprintList();
    });

  blueprintCommand
    .command("show")
    .description("Show one Kepler blueprint.")
    .argument("<blueprint-id>", "Blueprint id")
    .action(async (blueprintId: string) => {
      await printBlueprintDetails(blueprintId);
    });

  const resourceCommand = program
    .command("resource")
    .description("Manage the Kepler resource catalog.");

  resourceCommand
    .command("list")
    .description("List Kepler resource catalog entries.")
    .action(async () => {
      await printResourceList();
    });

  const solarCommand = program
    .command("solar")
    .description("Show Kepler sunlight conditions.");

  solarCommand
    .command("status")
    .description("Show current solar irradiance from Kepler.")
    .action(async () => {
      await printSolarStatus();
    });
}
