import { Command } from "commander";

import {
  createModule,
  deleteModule,
  findModuleByPrefix,
  formatModule,
  formatModuleSummary,
  formatModuleStatusUpdate,
  listModules,
  setModuleStatus,
  updateModuleByPrefix,
  updateModule,
} from "./index";
import { formatHabitatStatus, readHabitatStatus } from "../status/index";

function collectOptionValues(value: string, values: string[]): string[] {
  values.push(value);
  return values;
}

function parseRuntimeAttributes(values: string[]): Record<string, unknown> | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const runtimeAttributes: Record<string, unknown> = {};

  for (const value of values) {
    const separatorIndex = value.indexOf("=");

    if (separatorIndex <= 0) {
      throw new Error(`Runtime attribute "${value}" must be in key=value format.`);
    }

    const key = value.slice(0, separatorIndex).trim();
    const rawValue = value.slice(separatorIndex + 1);

    if (key.length === 0) {
      throw new Error(`Runtime attribute "${value}" must include a non-empty key.`);
    }

    runtimeAttributes[key] = rawValue;
  }

  return runtimeAttributes;
}

async function printModuleList(): Promise<void> {
  const modules = await listModules();
  if (modules.length === 0) {
    console.log("No modules found.");
    return;
  }

  for (const module of modules) {
    console.log(formatModuleSummary(module));
  }
}

async function printModuleDetails(id: string): Promise<void> {
  const module = await findModuleByPrefix(id);
  if (!module) {
    console.error(`Module "${id}" was not found.`);
    process.exit(1);
  }

  console.log(formatModule(module));
}

export function registerModuleCommands(program: Command): void {
  const moduleCommand = program.command("module").description("Manage local habitat modules.");

  moduleCommand
    .command("status")
    .description("Show local module states and power draw.")
    .action(async () => {
      const status = await readHabitatStatus();
      console.log(formatHabitatStatus(status));
    });

  moduleCommand
    .command("set-status")
    .description("Set one local module runtime status.")
    .argument("<module-id>", "Module id")
    .argument("<status>", "Runtime status")
    .action(async (moduleId: string, status: string) => {
      const update = await setModuleStatus(moduleId, status);
      console.log(formatModuleStatusUpdate(update));
    });

  moduleCommand
    .command("list")
    .description("List local habitat modules.")
    .action(async () => {
      await printModuleList();
    });

  moduleCommand
    .command("show")
    .description("Show one local habitat module.")
    .argument("<id>", "Module id")
    .action(async (id: string) => {
      await printModuleDetails(id);
    });

  moduleCommand
    .command("create")
    .description("Create a local habitat module.")
    .requiredOption("--blueprint-id <blueprintId>", "Blueprint id")
    .requiredOption("--name <name>", "Module display name")
    .option("--connected-to <moduleId>", "Module id this module connects to", collectOptionValues, [])
    .option("--capability <name>", "Capability name", collectOptionValues, [])
    .option("--runtime-attribute <key=value>", "Runtime attribute entry", collectOptionValues, [])
    .action(async (options: {
      blueprintId: string;
      name: string;
      connectedTo: string[];
      capability: string[];
      runtimeAttribute: string[];
    }) => {
      const module = await createModule({
        blueprintId: options.blueprintId,
        displayName: options.name,
        connectedTo: options.connectedTo,
        capabilities: options.capability,
        runtimeAttributes: parseRuntimeAttributes(options.runtimeAttribute),
      });

      console.log(formatModule(module));
    });

  moduleCommand
    .command("update")
    .description("Update a local habitat module.")
    .argument("<id>", "Module id")
    .option("--blueprint-id <blueprintId>", "Blueprint id")
    .option("--name <name>", "Module display name")
    .option("--connected-to <moduleId>", "Module id this module connects to", collectOptionValues, [])
    .option("--capability <name>", "Capability name", collectOptionValues, [])
    .option("--runtime-attribute <key=value>", "Runtime attribute entry", collectOptionValues, [])
    .action(async (id: string, options: {
      blueprintId?: string;
      name?: string;
      connectedTo: string[];
      capability: string[];
      runtimeAttribute: string[];
    }) => {
      const module = await updateModuleByPrefix(id, {
        blueprintId: options.blueprintId,
        displayName: options.name,
        connectedTo: options.connectedTo.length > 0 ? options.connectedTo : undefined,
        capabilities: options.capability.length > 0 ? options.capability : undefined,
        runtimeAttributes:
          options.runtimeAttribute.length > 0
            ? parseRuntimeAttributes(options.runtimeAttribute)
            : undefined,
      });

      console.log(formatModule(module));
    });

  moduleCommand
    .command("delete")
    .description("Delete a local habitat module.")
    .argument("<id>", "Module id")
    .action(async (id: string) => {
      const module = await findModuleByPrefix(id);
      if (!module) {
        console.error(`Module "${id}" was not found.`);
        process.exit(1);
      }

      await deleteModule(module.id);
      console.log(`Deleted module "${module.id}".`);
    });
}
