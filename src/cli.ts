import { Command } from "commander";
import {
  createBatteryBank,
  createDartLaunchPlatform,
  createFabricator,
  createResearchLab,
  createRover,
  createSolarPanel,
  constructFabricator,
  deleteDartLaunchPlatform,
  deleteSolarPanel,
  deleteBatteryBank,
  deleteFabricator,
  deleteResearchLab,
  deleteRover,
  findRover,
  findSolarPanel,
  findBatteryBank,
  formatDartLaunchPlatform,
  formatBatteryBank,
  formatBatteryBankSummary,
  formatFabricator,
  formatResearchLab,
  formatRover,
  formatRoverSummary,
  formatSolarPanel,
  formatSolarPanelSummary,
  launchDart,
  listRovers,
  listSolarPanels,
  listBatteryBanks,
  loadDart,
  moveRover,
  readDartLaunchPlatform,
  readFabricator,
  readResearchLab,
  updateDartLaunchPlatform,
  updateFabricator,
  updateResearchLabProgress,
  updateSolarPanel,
  updateBatteryBank,
} from "./storage";

const program = new Command();

program
  .name("habitat")
  .description(
    "Habitat CLI for managing persisted habitat resources from the command line. Use a resource command such as batteryBank, solarPanel, researchLab, rover, dart, or fabricator, then use a subcommand like create, list, show, status, update, move, load, launch, construct, or delete.",
  )
  .version("0.1.0")
  .showHelpAfterError("(run habitat --help for usage)")
  .addHelpText(
    "after",
    `
Discovery Guide:
  habitat <resource> --help
    Show the commands, arguments, and examples for one resource.

Available Resources:
  batteryBank   Create, list, show, update, and delete battery banks.
  solarPanel    Create, list, show, update, and delete solar panels.
  researchLab   Create, inspect status, update progress, and delete the research lab.
  rover         Create, list, inspect status, move, and delete rovers.
  dart          Create, inspect status, load, launch, update, and delete the dart launch platform.
  fabricator    Create, read, update, construct, and delete the fabricator.

Common Patterns:
  habitat batteryBank create --name HomePack --chargeLevel 72 --capacity 1000 --efficiency 92 --health 95
  habitat solarPanel show RoofArray
  habitat rover move Scout1 --location Crater --speed 15
  habitat fabricator construct --timeLeftConstructing 120 --powerUse 50
`,
  );

const batteryBankCommand = program
  .command("batteryBank")
  .description("Manage named battery bank records.")
  .showHelpAfterError("(run habitat batteryBank --help for usage)")
  .addHelpText(
    "after",
    `
Examples:
  habitat batteryBank create --name HomePack --chargeLevel 72 --capacity 1000 --efficiency 92 --health 95
  habitat batteryBank list
  habitat batteryBank show HomePack
  habitat batteryBank update HomePack --chargeLevel 80 --health 96
  habitat batteryBank delete HomePack
`,
  );

batteryBankCommand.on("command:*", () => {
  console.error("That batteryBank command doesn't exist yet.");
  console.error("Run habitat batteryBank --help to see what's available.");
  process.exit(1);
});

batteryBankCommand
  .command("create")
  .description("Create a battery bank.")
  .requiredOption("--name <name>", "Battery bank name")
  .requiredOption("--chargeLevel <number>", "Current charge level")
  .requiredOption("--capacity <number>", "Battery bank capacity")
  .requiredOption("--efficiency <number>", "Battery bank efficiency")
  .requiredOption("--health <number>", "Battery bank health")
  .action(async (options) => {
    const batteryBank = await createBatteryBank({
      name: options.name,
      chargeLevel: options.chargeLevel,
      capacity: options.capacity,
      efficiency: options.efficiency,
      health: options.health,
    });

    console.log(`Created battery bank "${batteryBank.name}".`);
    console.log(formatBatteryBank(batteryBank));
  });

batteryBankCommand
  .command("list")
  .description("List battery banks.")
  .action(async () => {
    const batteryBanks = await listBatteryBanks();

    if (batteryBanks.length === 0) {
      console.log("No battery banks found.");
      return;
    }

    for (const batteryBank of batteryBanks) {
      console.log(formatBatteryBankSummary(batteryBank));
    }
  });

batteryBankCommand
  .command("show")
  .description("Show one battery bank.")
  .argument("<name>", "Battery bank name")
  .action(async (name) => {
    const batteryBank = await findBatteryBank(name);

    if (!batteryBank) {
      console.error(`Battery bank "${name}" was not found.`);
      process.exit(1);
    }

    console.log(formatBatteryBank(batteryBank));
  });

batteryBankCommand
  .command("update")
  .description("Update a battery bank.")
  .argument("<name>", "Battery bank name")
  .option("--name <newName>", "New battery bank name")
  .option("--chargeLevel <number>", "Updated charge level")
  .option("--capacity <number>", "Updated capacity")
  .option("--efficiency <number>", "Updated efficiency")
  .option("--health <number>", "Updated health")
  .action(async (name, options) => {
    const hasUpdates =
      options.name !== undefined ||
      options.chargeLevel !== undefined ||
      options.capacity !== undefined ||
      options.efficiency !== undefined ||
      options.health !== undefined;

    if (!hasUpdates) {
      console.error("Provide at least one field to update.");
      process.exit(1);
    }

    const batteryBank = await updateBatteryBank(name, {
      name: options.name,
      chargeLevel: options.chargeLevel,
      capacity: options.capacity,
      efficiency: options.efficiency,
      health: options.health,
    });

    console.log(`Updated battery bank "${batteryBank.name}".`);
    console.log(formatBatteryBank(batteryBank));
  });

batteryBankCommand
  .command("delete")
  .description("Delete a battery bank.")
  .argument("<name>", "Battery bank name")
  .action(async (name) => {
    await deleteBatteryBank(name);
    console.log(`Deleted battery bank "${name}".`);
  });

const solarPanelCommand = program
  .command("solarPanel")
  .description("Manage named solar panel records.")
  .showHelpAfterError("(run habitat solarPanel --help for usage)")
  .addHelpText(
    "after",
    `
Examples:
  habitat solarPanel create --name RoofArray --efficiency 21.5 --panelOn true
  habitat solarPanel list
  habitat solarPanel show RoofArray
  habitat solarPanel update RoofArray --efficiency 22 --panelOn false
  habitat solarPanel delete RoofArray
`,
  );

solarPanelCommand.on("command:*", () => {
  console.error("That solarPanel command doesn't exist yet.");
  console.error("Run habitat solarPanel --help to see what's available.");
  process.exit(1);
});

solarPanelCommand
  .command("create")
  .description("Create a solar panel.")
  .requiredOption("--name <name>", "Solar panel name")
  .requiredOption("--efficiency <number>", "Solar panel efficiency")
  .requiredOption("--panelOn <true|false>", "Whether the panel is on")
  .action(async (options) => {
    const solarPanel = await createSolarPanel({
      name: options.name,
      efficiency: options.efficiency,
      panelOn: options.panelOn,
    });

    console.log(`Created solar panel "${solarPanel.name}".`);
    console.log(formatSolarPanel(solarPanel));
  });

solarPanelCommand
  .command("list")
  .description("List solar panels.")
  .action(async () => {
    const solarPanels = await listSolarPanels();

    if (solarPanels.length === 0) {
      console.log("No solar panels found.");
      return;
    }

    for (const solarPanel of solarPanels) {
      console.log(formatSolarPanelSummary(solarPanel));
    }
  });

solarPanelCommand
  .command("show")
  .description("Show one solar panel.")
  .argument("<name>", "Solar panel name")
  .action(async (name) => {
    const solarPanel = await findSolarPanel(name);

    if (!solarPanel) {
      console.error(`Solar panel "${name}" was not found.`);
      process.exit(1);
    }

    console.log(formatSolarPanel(solarPanel));
  });

solarPanelCommand
  .command("update")
  .description("Update a solar panel.")
  .argument("<name>", "Solar panel name")
  .option("--name <newName>", "New solar panel name")
  .option("--efficiency <number>", "Updated efficiency")
  .option("--panelOn <true|false>", "Updated on/off state")
  .action(async (name, options) => {
    const hasUpdates =
      options.name !== undefined ||
      options.efficiency !== undefined ||
      options.panelOn !== undefined;

    if (!hasUpdates) {
      console.error("Provide at least one field to update.");
      process.exit(1);
    }

    const solarPanel = await updateSolarPanel(name, {
      name: options.name,
      efficiency: options.efficiency,
      panelOn: options.panelOn,
    });

    console.log(`Updated solar panel "${solarPanel.name}".`);
    console.log(formatSolarPanel(solarPanel));
  });

solarPanelCommand
  .command("delete")
  .description("Delete a solar panel.")
  .argument("<name>", "Solar panel name")
  .action(async (name) => {
    await deleteSolarPanel(name);
    console.log(`Deleted solar panel "${name}".`);
  });

const researchLabCommand = program
  .command("researchLab")
  .description("Manage the single persisted research lab record.")
  .showHelpAfterError("(run habitat researchLab --help for usage)")
  .addHelpText(
    "after",
    `
Examples:
  habitat researchLab create --progress 10 --labOn true --powerUse 40 --currentProject SoilStudy
  habitat researchLab status
  habitat researchLab updateProgress --progress 25 --currentProject IceCore
  habitat researchLab delete
`,
  );

researchLabCommand.on("command:*", () => {
  console.error("That researchLab command doesn't exist yet.");
  console.error("Run habitat researchLab --help to see what's available.");
  process.exit(1);
});

researchLabCommand
  .command("create")
  .description("Create the research lab record.")
  .requiredOption("--progress <number>", "Research progress")
  .requiredOption("--labOn <true|false>", "Whether the lab is on")
  .requiredOption("--powerUse <number>", "Lab power use")
  .requiredOption("--currentProject <name>", "Current project name")
  .action(async (options) => {
    const researchLab = await createResearchLab({
      progress: options.progress,
      labOn: options.labOn,
      powerUse: options.powerUse,
      currentProject: options.currentProject,
    });

    console.log("Created research lab.");
    console.log(formatResearchLab(researchLab));
  });

researchLabCommand
  .command("status")
  .description("Show the research lab status.")
  .action(async () => {
    const researchLab = await readResearchLab();

    if (!researchLab) {
      console.error("Research lab was not found.");
      process.exit(1);
    }

    console.log(formatResearchLab(researchLab));
  });

researchLabCommand
  .command("updateProgress")
  .description("Update research lab progress and related fields.")
  .option("--progress <number>", "Updated progress")
  .option("--labOn <true|false>", "Updated on/off state")
  .option("--powerUse <number>", "Updated power use")
  .option("--currentProject <name>", "Updated current project")
  .action(async (options) => {
    const hasUpdates =
      options.progress !== undefined ||
      options.labOn !== undefined ||
      options.powerUse !== undefined ||
      options.currentProject !== undefined;

    if (!hasUpdates) {
      console.error("Provide at least one field to update.");
      process.exit(1);
    }

    const researchLab = await updateResearchLabProgress({
      progress: options.progress,
      labOn: options.labOn,
      powerUse: options.powerUse,
      currentProject: options.currentProject,
    });

    console.log("Updated research lab.");
    console.log(formatResearchLab(researchLab));
  });

researchLabCommand
  .command("delete")
  .description("Delete the research lab record.")
  .action(async () => {
    await deleteResearchLab();
    console.log("Deleted research lab.");
  });

const roverCommand = program
  .command("rover")
  .description("Manage named rover records.")
  .showHelpAfterError("(run habitat rover --help for usage)")
  .addHelpText(
    "after",
    `
Examples:
  habitat rover create --name Scout1 --health 95 --speed 12 --location Ridge
  habitat rover list
  habitat rover status Scout1
  habitat rover move Scout1 --location Crater --speed 15
  habitat rover delete Scout1
`,
  );

roverCommand.on("command:*", () => {
  console.error("That rover command doesn't exist yet.");
  console.error("Run habitat rover --help to see what's available.");
  process.exit(1);
});

roverCommand
  .command("create")
  .description("Create a rover.")
  .requiredOption("--name <name>", "Rover name")
  .requiredOption("--health <number>", "Rover health")
  .requiredOption("--speed <number>", "Rover speed")
  .requiredOption("--location <name>", "Rover location")
  .action(async (options) => {
    const rover = await createRover({
      name: options.name,
      health: options.health,
      speed: options.speed,
      location: options.location,
    });

    console.log(`Created rover "${rover.name}".`);
    console.log(formatRover(rover));
  });

roverCommand
  .command("list")
  .description("List rovers.")
  .action(async () => {
    const rovers = await listRovers();

    if (rovers.length === 0) {
      console.log("No rovers found.");
      return;
    }

    for (const rover of rovers) {
      console.log(formatRoverSummary(rover));
    }
  });

roverCommand
  .command("status")
  .description("Show rover status.")
  .argument("<name>", "Rover name")
  .action(async (name) => {
    const rover = await findRover(name);

    if (!rover) {
      console.error(`Rover "${name}" was not found.`);
      process.exit(1);
    }

    console.log(formatRover(rover));
  });

roverCommand
  .command("move")
  .description("Move a rover.")
  .argument("<name>", "Rover name")
  .requiredOption("--location <name>", "New rover location")
  .option("--speed <number>", "Updated rover speed")
  .option("--health <number>", "Updated rover health")
  .option("--name <newName>", "New rover name")
  .action(async (name, options) => {
    const rover = await moveRover(name, {
      name: options.name,
      location: options.location,
      speed: options.speed,
      health: options.health,
    });

    console.log(`Moved rover "${rover.name}".`);
    console.log(formatRover(rover));
  });

roverCommand
  .command("delete")
  .description("Delete a rover.")
  .argument("<name>", "Rover name")
  .action(async (name) => {
    await deleteRover(name);
    console.log(`Deleted rover "${name}".`);
  });

const dartCommand = program
  .command("dart")
  .description("Manage the single persisted dart launch platform record.")
  .showHelpAfterError("(run habitat dart --help for usage)")
  .addHelpText(
    "after",
    `
Examples:
  habitat dart create --dartLoaded false --location BayA --dartLoadAmount 0
  habitat dart status
  habitat dart load --dartLoadAmount 3
  habitat dart launch
  habitat dart delete
`,
  );

dartCommand.on("command:*", () => {
  console.error("That dart command doesn't exist yet.");
  console.error("Run habitat dart --help to see what's available.");
  process.exit(1);
});

dartCommand
  .command("create")
  .description("Create the dart launch platform record.")
  .requiredOption("--dartLoaded <true|false>", "Whether a dart is loaded")
  .requiredOption("--location <name>", "Platform location")
  .requiredOption("--dartLoadAmount <number>", "Dart load amount")
  .action(async (options) => {
    const dartLaunchPlatform = await createDartLaunchPlatform({
      dartLoaded: options.dartLoaded,
      location: options.location,
      dartLoadAmount: options.dartLoadAmount,
    });

    console.log("Created dart launch platform.");
    console.log(formatDartLaunchPlatform(dartLaunchPlatform));
  });

dartCommand
  .command("status")
  .description("Show dart launch platform status.")
  .action(async () => {
    const dartLaunchPlatform = await readDartLaunchPlatform();

    if (!dartLaunchPlatform) {
      console.error("Dart launch platform was not found.");
      process.exit(1);
    }

    console.log(formatDartLaunchPlatform(dartLaunchPlatform));
  });

dartCommand
  .command("load")
  .description("Load a dart.")
  .requiredOption("--dartLoadAmount <number>", "Dart load amount")
  .action(async (options) => {
    const dartLaunchPlatform = await loadDart(options.dartLoadAmount);
    console.log("Loaded dart.");
    console.log(formatDartLaunchPlatform(dartLaunchPlatform));
  });

dartCommand
  .command("launch")
  .description("Launch a dart.")
  .action(async () => {
    const dartLaunchPlatform = await launchDart();
    console.log("Launched dart.");
    console.log(formatDartLaunchPlatform(dartLaunchPlatform));
  });

dartCommand
  .command("update")
  .description("Update dart launch platform fields.")
  .option("--dartLoaded <true|false>", "Updated loaded state")
  .option("--location <name>", "Updated platform location")
  .option("--dartLoadAmount <number>", "Updated dart load amount")
  .action(async (options) => {
    const hasUpdates =
      options.dartLoaded !== undefined ||
      options.location !== undefined ||
      options.dartLoadAmount !== undefined;

    if (!hasUpdates) {
      console.error("Provide at least one field to update.");
      process.exit(1);
    }

    const dartLaunchPlatform = await updateDartLaunchPlatform({
      dartLoaded: options.dartLoaded,
      location: options.location,
      dartLoadAmount: options.dartLoadAmount,
    });

    console.log("Updated dart launch platform.");
    console.log(formatDartLaunchPlatform(dartLaunchPlatform));
  });

dartCommand
  .command("delete")
  .description("Delete the dart launch platform record.")
  .action(async () => {
    await deleteDartLaunchPlatform();
    console.log("Deleted dart launch platform.");
  });

const fabricatorCommand = program
  .command("fabricator")
  .description("Manage the single persisted fabricator record.")
  .showHelpAfterError("(run habitat fabricator --help for usage)")
  .addHelpText(
    "after",
    `
Examples:
  habitat fabricator create --fabricatorOn false --powerUse 20 --timeLeftConstructing 0
  habitat fabricator read
  habitat fabricator update --fabricatorOn true --powerUse 35
  habitat fabricator construct --timeLeftConstructing 120 --powerUse 50
  habitat fabricator delete
`,
  );

fabricatorCommand.on("command:*", () => {
  console.error("That fabricator command doesn't exist yet.");
  console.error("Run habitat fabricator --help to see what's available.");
  process.exit(1);
});

fabricatorCommand
  .command("create")
  .description("Create the fabricator record.")
  .requiredOption("--fabricatorOn <true|false>", "Whether the fabricator is on")
  .requiredOption("--powerUse <number>", "Fabricator power use")
  .requiredOption("--timeLeftConstructing <number>", "Time left constructing")
  .action(async (options) => {
    const fabricator = await createFabricator({
      fabricatorOn: options.fabricatorOn,
      powerUse: options.powerUse,
      timeLeftConstructing: options.timeLeftConstructing,
    });

    console.log("Created fabricator.");
    console.log(formatFabricator(fabricator));
  });

fabricatorCommand
  .command("read")
  .description("Read the fabricator status.")
  .action(async () => {
    const fabricator = await readFabricator();

    if (!fabricator) {
      console.error("Fabricator was not found.");
      process.exit(1);
    }

    console.log(formatFabricator(fabricator));
  });

fabricatorCommand
  .command("update")
  .description("Update fabricator fields.")
  .option("--fabricatorOn <true|false>", "Updated on/off state")
  .option("--powerUse <number>", "Updated power use")
  .option("--timeLeftConstructing <number>", "Updated time left constructing")
  .action(async (options) => {
    const hasUpdates =
      options.fabricatorOn !== undefined ||
      options.powerUse !== undefined ||
      options.timeLeftConstructing !== undefined;

    if (!hasUpdates) {
      console.error("Provide at least one field to update.");
      process.exit(1);
    }

    const fabricator = await updateFabricator({
      fabricatorOn: options.fabricatorOn,
      powerUse: options.powerUse,
      timeLeftConstructing: options.timeLeftConstructing,
    });

    console.log("Updated fabricator.");
    console.log(formatFabricator(fabricator));
  });

fabricatorCommand
  .command("construct")
  .description("Start or update constructing work.")
  .requiredOption("--timeLeftConstructing <number>", "New time left constructing")
  .option("--powerUse <number>", "Updated power use")
  .action(async (options) => {
    const fabricator = await constructFabricator(
      options.timeLeftConstructing,
      options.powerUse,
    );

    console.log("Updated fabricator construction.");
    console.log(formatFabricator(fabricator));
  });

fabricatorCommand
  .command("delete")
  .description("Delete the fabricator record.")
  .action(async () => {
    await deleteFabricator();
    console.log("Deleted fabricator.");
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
