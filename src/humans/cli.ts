import { Command } from "commander";

import { readHumans } from "../api/humans";
import type { StarterHuman } from "../kepler/types";

export type HumanCommandDependencies = {
  readHumans: typeof readHumans;
};

const defaultDependencies: HumanCommandDependencies = { readHumans };

export function registerHumanCommands(
  program: Command,
  dependencies: Partial<HumanCommandDependencies> = {},
): void {
  const commandDependencies = { ...defaultDependencies, ...dependencies };
  const humanCommand = program.command("human").description("Inspect habitat humans.");

  humanCommand
    .command("list")
    .description("List registered habitat humans.")
    .action(async () => {
      const { humans } = await commandDependencies.readHumans();
      console.log(formatHumanList(humans));
    });
}

function formatHumanList(humans: StarterHuman[]): string {
  if (humans.length === 0) {
    return "No humans found.";
  }

  return humans
    .map((human) => [
      `id: ${human.id}`,
      `displayName: ${human.displayName}`,
      `locationModuleId: ${human.locationModuleId}`,
    ].join("\n"))
    .join("\n\n");
}
