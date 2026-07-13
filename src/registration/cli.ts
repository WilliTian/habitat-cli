import { Command } from "commander";

import {
  createRegistration,
  deleteRegistration,
  readRegistrationStatus,
} from "../api/registration";
import {
  formatKeplerHabitat,
  formatUnregisterKeplerHabitatResult,
} from "../kepler/format";

export type RegistrationCommandDependencies = {
  createRegistration: typeof createRegistration;
  readRegistrationStatus: typeof readRegistrationStatus;
  deleteRegistration: typeof deleteRegistration;
};

const defaultDependencies: RegistrationCommandDependencies = {
  createRegistration,
  readRegistrationStatus,
  deleteRegistration,
};

export function registerRegistrationCommands(
  program: Command,
  dependencies: Partial<RegistrationCommandDependencies> = {},
): void {
  const commandDependencies: RegistrationCommandDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };

  program
    .command("register")
    .description("Register this habitat with Kepler.")
    .requiredOption("--name <name>", "Habitat display name")
    .action(async (options: { name: string }) => {
      const result = await commandDependencies.createRegistration(options.name);

      console.log(`Registered habitat "${result.registration.displayName}".`);
      console.log(formatKeplerHabitat(result.registration));
    });

  program
    .command("status")
    .description("Show the saved Kepler habitat registration and current status.")
    .action(async () => {
      const result = await commandDependencies.readRegistrationStatus();
      console.log(formatKeplerHabitat(result.registration));
    });

  program
    .command("unregister")
    .description("Delete the registered habitat from Kepler.")
    .action(async () => {
      const result = await commandDependencies.deleteRegistration();
      console.log(
        formatUnregisterKeplerHabitatResult({
          keplerHabitat: result.registration,
          remoteHabitatDeleted: result.remoteHabitatDeleted,
        }),
      );
    });
}
