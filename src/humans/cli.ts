import { Command } from "commander";

import { moveHuman, readHumans } from "../api/humans";
import { HabitatApiError } from "../api/client";
import type { StarterHuman } from "../kepler/types";

export type HumanCommandDependencies = {
  readHumans: typeof readHumans;
  moveHuman: typeof moveHuman;
};

const defaultDependencies: HumanCommandDependencies = { readHumans, moveHuman };

export function registerHumanCommands(
  program: Command,
  dependencies: Partial<HumanCommandDependencies> = {},
): void {
  const commandDependencies = { ...defaultDependencies, ...dependencies };
  const humanCommand = program.command("human").description("Inspect habitat humans.");

  humanCommand.command("move")
    .description("Move a human to a habitat module.")
    .argument("<human-id>", "Human id")
    .argument("<module-id>", "Destination module id")
    .action(async (humanId: string, moduleId: string) => {
      try {
        const { human } = await commandDependencies.moveHuman(humanId, moduleId);
        console.log(`Moved human "${human.id}" to module "${human.locationModuleId}".`);
      } catch (error) {
        if (error instanceof HabitatApiError && error.backendMessage) {
          throw new Error(error.backendMessage, { cause: error });
        }
        throw error;
      }
    });

  humanCommand
    .command("list")
    .description("List registered habitat humans.")
    .option("--json", "Print humans as JSON")
    .action(async (options: { json?: boolean }) => {
      const { humans } = await commandDependencies.readHumans();
      if (options.json) {
        console.log(JSON.stringify({ humans }, null, 2));
        return;
      }

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
