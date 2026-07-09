import { Command } from "commander";

import { addInventoryResource, formatInventoryTable, listInventory } from "./index";

async function printInventoryList(): Promise<void> {
  const resources = await listInventory();

  if (resources.length === 0) {
    console.log("No inventory resources found.");
    return;
  }

  console.log(formatInventoryTable(resources));
}

export function registerInventoryCommands(program: Command): void {
  const inventoryCommand = program
    .command("inventory")
    .description("Manage local habitat inventory.");

  inventoryCommand
    .command("list")
    .description("List local habitat inventory resources.")
    .action(async () => {
      await printInventoryList();
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
      const resource = await addInventoryResource({
        resourceType,
        quantity: parseQuantity(quantity),
        unit: options.unit,
      });

      console.log(
        [
          `resourceType: ${resource.resourceType}`,
          `quantity: ${resource.quantity}`,
          `unit: ${resource.unit ?? "-"}`,
          `updatedAt: ${resource.updatedAt}`,
        ].join("\n"),
      );
    });
}

function parseQuantity(value: string): number {
  const quantity = Number(value);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("quantity must be greater than 0.");
  }

  return quantity;
}
