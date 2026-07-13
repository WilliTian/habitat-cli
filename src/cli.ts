import { Command } from "commander";
import { registerConstructCommands } from "./construct/cli";
import { registerInventoryCommands } from "./inventory/cli";
import { registerBlueprintCommands } from "./kepler/cli";
import { registerModuleCommands } from "./modules/cli";
import { registerRegistrationCommands } from "./registration/cli";
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

registerRegistrationCommands(program);
registerModuleCommands(program);
registerInventoryCommands(program);
registerBlueprintCommands(program);
registerConstructCommands(program);
registerTickCommands(program);

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error(message);
  process.exit(1);
});
