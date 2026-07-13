import { Command } from "commander";

import { HabitatApiError } from "../api/client";
import { adjustInventory, readInventory } from "../api/inventory";
import { formatInventoryResource, formatInventoryTable } from "./format";

export type InventoryCommandDependencies = {
  readInventory: typeof readInventory;
  adjustInventory: typeof adjustInventory;
};

const defaultDependencies: InventoryCommandDependencies = {
  readInventory,
  adjustInventory,
};

async function printInventoryList(
  dependencies: InventoryCommandDependencies,
): Promise<void> {
  const { inventory: resources } = await dependencies.readInventory();

  if (resources.length === 0) {
    console.log("No inventory resources found.");
    return;
  }

  console.log(formatInventoryTable(resources));
}

export function registerInventoryCommands(
  program: Command,
  dependencies: Partial<InventoryCommandDependencies> = {},
): void {
  const commandDependencies = { ...defaultDependencies, ...dependencies };
  const inventoryCommand = program
    .command("inventory")
    .description("Manage local habitat inventory.");

  inventoryCommand
    .command("list")
    .description("List local habitat inventory resources.")
    .action(async () => {
      await printInventoryList(commandDependencies);
    });

  inventoryCommand
    .command("add")
    .description("Add quantity to a local inventory resource.")
    .argument("<resource-type>", "Resource type")
    .argument("<quantity>", "Quantity")
    .option("--unit <unit>", "Resource unit")
    .action(async (
      resourceType: string,
      quantity: string,
      options: { unit?: string },
    ) => {
      const { resource } = await runInventoryOperation(
        () => commandDependencies.adjustInventory(
          resourceType,
          parseQuantity(quantity),
          options.unit,
        ),
      );
      console.log(formatInventoryResource(resource));
    });

  inventoryCommand
    .command("remove")
    .description("Remove quantity from a local inventory resource.")
    .argument("<resource-type>", "Resource type")
    .argument("<quantity>", "Quantity")
    .action(async (resourceType: string, quantity: string) => {
      const { resource } = await runInventoryOperation(
        () => commandDependencies.adjustInventory(
          resourceType,
          -parseQuantity(quantity),
        ),
      );
      console.log(formatInventoryResource(resource));
    });
}

function parseQuantity(value: string): number {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantity must be greater than 0.");
  }

  return quantity;
}

async function runInventoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof HabitatApiError &&
      error.backendMessage &&
      [400, 409].includes(error.status)
    ) {
      throw new Error(error.backendMessage, { cause: error });
    }

    throw error;
  }
}
