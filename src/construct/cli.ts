import { Command } from "commander";

import * as construct from "./index";

export function registerConstructCommands(program: Command): void {
  program
    .command("construct")
    .description("Plan or start habitat construction from live Kepler blueprints.")
    .argument("<blueprint-id>", "Blueprint id")
    .option("--dry-run", "Report readiness without changing local state")
    .action(async (blueprintId: string, options: { dryRun?: boolean }) => {
      if (options.dryRun) {
        const report = await construct.evaluateConstructionDryRun(blueprintId);
        console.log(construct.formatConstructionDryRun(report));
        return;
      }

      const report = await construct.startConstruction(blueprintId);
      console.log(construct.formatConstructionStart(report));
    });

  const constructionCommand = program
    .command("construction")
    .description("Inspect local habitat construction jobs.");

  constructionCommand
    .command("status")
    .description("Show active construction jobs and remaining build time.")
    .action(async () => {
      const rows = await construct.readConstructionStatus();
      console.log(construct.formatConstructionStatus(rows));
    });

  constructionCommand
    .command("cancel")
    .description("Cancel one active construction job on a fabricator.")
    .argument("<fabricator-id>", "Fabricator id")
    .action(async (fabricatorId: string) => {
      const report = await construct.cancelConstruction(fabricatorId);
      console.log(construct.formatCancelConstruction(report));
    });
}
