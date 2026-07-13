import { Command } from "commander";

import { formatHabitatStatus } from "./format";
import { readHabitatStatus } from "./index";

export type PowerCommandDependencies = {
  readStatus: typeof readHabitatStatus;
};

const defaultDependencies: PowerCommandDependencies = {
  readStatus: readHabitatStatus,
};

export function registerPowerCommands(
  program: Command,
  dependencies: Partial<PowerCommandDependencies> = {},
): void {
  const commandDependencies = { ...defaultDependencies, ...dependencies };
  const powerCommand = program.command("power").description("Inspect habitat power usage.");

  powerCommand
    .command("overview")
    .description("Show module power draw and per-tick demand.")
    .action(async () => {
      const status = await commandDependencies.readStatus();
      console.log(formatHabitatStatus(status));
    });
}
