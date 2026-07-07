import { Command } from "commander";
import {
  formatRegistrationRecord,
  formatStatusRecord,
  readKeplerHabitatStatus,
  registerKeplerHabitat,
  unregisterKeplerHabitat,
} from "./kepler";

const program = new Command();

program
  .name("habitat")
  .description("Register and inspect a Kepler habitat for this lab.")
  .version("0.1.0")
  .showHelpAfterError("(run habitat --help for usage)")
  .addHelpText(
    "after",
    `
Kepler Registration:
  habitat register --name "<habitat name>"
    Register this CLI with Kepler and store the returned habitat record locally.

  habitat status
    Show the saved registration and refresh the current habitat status from Kepler.

  habitat unregister
    Delete the registered habitat from Kepler and remove the local record.
`,
  );

program
  .command("register")
  .description("Register this CLI with Kepler.")
  .requiredOption("--name <name>", "Habitat display name")
  .action(async (options: { name: string }) => {
    const keplerHabitat = await registerKeplerHabitat({
      displayName: options.name,
    });

    console.log(`Registered habitat "${keplerHabitat.displayName}".`);
    console.log(formatRegistrationRecord(keplerHabitat));
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

    console.log(formatStatusRecord(keplerHabitat));
  });

program
  .command("unregister")
  .description("Delete the registered Kepler habitat.")
  .action(async () => {
    const keplerHabitat = await unregisterKeplerHabitat();
    console.log(`Unregistered habitat "${keplerHabitat.displayName}".`);
  });

program.on("command:*", () => {
  console.error("That command doesn't exist yet.");
  console.error("Run habitat --help to see what's available.");
  process.exit(1);
});

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Something went wrong.";
  console.error(message);
  process.exit(1);
});
