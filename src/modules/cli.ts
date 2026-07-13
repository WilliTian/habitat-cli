import { Command } from "commander";

import {
  createModuleResource,
  deleteModuleResource,
  readModule,
  readModules,
  updateModuleResource,
} from "../api/modules";
import {
  formatModule,
  formatModuleSummary,
  formatModuleStatusUpdate,
} from "./format";
import { buildHabitatStatus, formatHabitatStatus } from "../status/format";
import { resolvePowerDrawKw } from "../ticks/power";

const validModuleStatuses = ["offline", "idle", "online", "active", "damaged"] as const;

type ModuleRuntimeStatus = (typeof validModuleStatuses)[number];

export type ModuleCommandDependencies = Partial<{
  readModules: typeof readModules;
  createModuleResource: typeof createModuleResource;
  readModule: typeof readModule;
  updateModuleResource: typeof updateModuleResource;
  deleteModuleResource: typeof deleteModuleResource;
}>;

type ResolvedModuleCommandDependencies = Required<ModuleCommandDependencies>;

const defaultDependencies: ResolvedModuleCommandDependencies = {
  readModules,
  createModuleResource,
  readModule,
  updateModuleResource,
  deleteModuleResource,
};

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

async function printModuleList(dependencies: ResolvedModuleCommandDependencies): Promise<void> {
  const { modules } = await dependencies.readModules();
  if (modules.length === 0) {
    console.log("No modules found.");
    return;
  }

  for (const module of modules) {
    console.log(formatModuleSummary(module));
  }
}

async function printModuleDetails(
  id: string,
  dependencies: ResolvedModuleCommandDependencies,
): Promise<void> {
  const { module } = await dependencies.readModule(id);
  console.log(formatModule(module));
}

export function registerModuleCommands(
  program: Command,
  dependencies: ModuleCommandDependencies = defaultDependencies,
): void {
  const commandDependencies: ResolvedModuleCommandDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };
  const moduleCommand = program.command("module").description("Manage local habitat modules.");

  moduleCommand
    .command("status")
    .description("Show local module states and power draw.")
    .action(async () => {
      const { modules } = await commandDependencies.readModules();
      console.log(formatHabitatStatus(buildHabitatStatus(modules)));
    });

  moduleCommand
    .command("set-status")
    .description("Set one local module runtime status.")
    .argument("<module-id>", "Module id")
    .argument("<status>", "Runtime status")
    .action(async (moduleId: string, status: string) => {
      const nextStatus = parseModuleRuntimeStatus(status);
      const { module: currentModule } = await commandDependencies.readModule(moduleId);
      const { module } = await commandDependencies.updateModuleResource(moduleId, {
        runtimeAttributes: {
          ...currentModule.runtimeAttributes,
          status: nextStatus,
        },
      });
      console.log(formatModuleStatusUpdate({
        module,
        status: nextStatus,
        powerDrawKw: resolvePowerDrawKw(module),
      }));
    });

  moduleCommand
    .command("list")
    .description("List local habitat modules.")
    .action(async () => {
      await printModuleList(commandDependencies);
    });

  moduleCommand
    .command("show")
    .description("Show one local habitat module.")
    .argument("<id>", "Module id")
    .action(async (id: string) => {
      await printModuleDetails(id, commandDependencies);
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
      const { module } = await commandDependencies.createModuleResource({
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
      const { module } = await commandDependencies.updateModuleResource(id, {
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
      const { module } = await commandDependencies.deleteModuleResource(id);
      console.log(`Deleted module "${module.id}".`);
    });
}

function parseModuleRuntimeStatus(status: string): ModuleRuntimeStatus {
  const trimmedStatus = status.trim();

  if (validModuleStatuses.includes(trimmedStatus as ModuleRuntimeStatus)) {
    return trimmedStatus as ModuleRuntimeStatus;
  }

  throw new Error("Status must be one of: offline, idle, online, active, damaged.");
}
