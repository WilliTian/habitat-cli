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

  program
    .command("construction")
    .description("Inspect local habitat construction jobs.")
    .command("status")
    .description("Show active construction jobs and remaining build time.")
    .action(async () => {
      const rows = await construct.readConstructionStatus();
      console.log(construct.formatConstructionStatus(rows));
    });
}
