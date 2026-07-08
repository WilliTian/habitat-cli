import { Command } from "commander";
import {
  formatKeplerHabitat,
  readKeplerHabitatStatus,
  registerKeplerHabitat,
  unregisterKeplerHabitat,
} from "./kepler/index";
import { registerModuleCommands } from "./modules/cli";
import { registerTickCommands } from "./ticks/cli";

const program = new Command();

program
  .name("habitat")
  .description("Bun-powered Habitat CLI for Kepler")
  .version("0.1.0")
  .addHelpText(
    "after",
    `
Bun:
  bun run ./src/cli.ts --help
    Run the CLI directly with Bun.

  bun install
    Install dependencies with Bun.
`,
  );

program
  .command("register")
  .description("Register this habitat with Kepler.")
  .requiredOption("--name <name>", "Habitat display name")
  .action(async (options: { name: string }) => {
    const keplerHabitat = await registerKeplerHabitat({
      displayName: options.name,
    });

    console.log(`Registered habitat "${keplerHabitat.displayName}".`);
    console.log(formatKeplerHabitat(keplerHabitat));
  });

program
  .command("status")
  .description("Show the saved Kepler habitat registration and current status.")
  .action(async () => {
    const keplerHabitat = await readKeplerHabitatStatus();

    if (!keplerHabitat) {
      console.error("No Kepler habitat registration was found.");
      process.exit(1);
    }

    console.log(formatKeplerHabitat(keplerHabitat));
  });

registerModuleCommands(program);
registerTickCommands(program);

program
  .command("unregister")
  .description("Delete the registered habitat from Kepler.")
  .action(async () => {
    const keplerHabitat = await unregisterKeplerHabitat();
    console.log(`Unregistered habitat "${keplerHabitat.displayName}".`);
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error(message);
  process.exit(1);
});
