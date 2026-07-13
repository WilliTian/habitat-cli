import { Command } from "commander";

import {
  readBlueprint,
  readBlueprintCatalog,
  readResourceCatalog,
} from "../api/catalog";
import { readSolarIrradianceResource } from "../api/solar";
import {
  formatBlueprint,
  formatBlueprintTable,
  formatResourceTable,
  formatSolarIrradianceStatus,
} from "./format";

export type BlueprintCommandDependencies = Partial<{
  readBlueprintCatalog: typeof readBlueprintCatalog;
  readBlueprint: typeof readBlueprint;
  readResourceCatalog: typeof readResourceCatalog;
  readSolarIrradianceResource: typeof readSolarIrradianceResource;
}>;

type ResolvedBlueprintCommandDependencies = Required<BlueprintCommandDependencies>;

const defaultDependencies: ResolvedBlueprintCommandDependencies = {
  readBlueprintCatalog,
  readBlueprint,
  readResourceCatalog,
  readSolarIrradianceResource,
};

async function printBlueprintList(
  dependencies: ResolvedBlueprintCommandDependencies,
): Promise<void> {
  const { blueprints } = await dependencies.readBlueprintCatalog();
  console.log(formatBlueprintTable(blueprints));
}

async function printBlueprintDetails(
  blueprintId: string,
  dependencies: ResolvedBlueprintCommandDependencies,
): Promise<void> {
  const { blueprint } = await dependencies.readBlueprint(blueprintId);
  console.log(formatBlueprint(blueprint));
}

async function printResourceList(
  dependencies: ResolvedBlueprintCommandDependencies,
): Promise<void> {
  const { resources } = await dependencies.readResourceCatalog();
  console.log(formatResourceTable(resources));
}

async function printSolarStatus(
  dependencies: ResolvedBlueprintCommandDependencies,
): Promise<void> {
  const { solarIrradiance } = await dependencies.readSolarIrradianceResource();
  console.log(formatSolarIrradianceStatus(solarIrradiance));
}

export function registerBlueprintCommands(
  program: Command,
  dependencies: BlueprintCommandDependencies = defaultDependencies,
): void {
  const commandDependencies: ResolvedBlueprintCommandDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };
  const blueprintCommand = program
    .command("blueprint")
    .description("Manage Kepler blueprints.");

  blueprintCommand
    .command("list")
    .description("List Kepler blueprints.")
    .action(async () => {
      await printBlueprintList(commandDependencies);
    });

  blueprintCommand
    .command("show")
    .description("Show one Kepler blueprint.")
    .argument("<blueprint-id>", "Blueprint id")
    .action(async (blueprintId: string) => {
      await printBlueprintDetails(blueprintId, commandDependencies);
    });

  const resourceCommand = program
    .command("resource")
    .description("Manage the Kepler resource catalog.");

  resourceCommand
    .command("list")
    .description("List Kepler resource catalog entries.")
    .action(async () => {
      await printResourceList(commandDependencies);
    });

  const solarCommand = program
    .command("solar")
    .description("Show Kepler sunlight conditions.");

  solarCommand
    .command("status")
    .description("Show current solar irradiance from Kepler.")
    .action(async () => {
      await printSolarStatus(commandDependencies);
    });
}
