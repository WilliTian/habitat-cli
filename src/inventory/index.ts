import { loadInventory, saveInventory } from "./state";
import type { HabitatInventoryResource } from "./types";

type InventoryDependencies = {
  loadInventory: () => Promise<HabitatInventoryResource[]>;
};

type InventoryMutationDependencies = InventoryDependencies & {
  saveInventory: (resources: HabitatInventoryResource[]) => Promise<void>;
  now: () => string;
};

const defaultDependencies: InventoryDependencies = {
  loadInventory,
};

const defaultMutationDependencies: InventoryMutationDependencies = {
  loadInventory,
  saveInventory,
  now: () => new Date().toISOString(),
};

export async function listInventory(
  dependencies: InventoryDependencies = defaultDependencies,
): Promise<HabitatInventoryResource[]> {
  return dependencies.loadInventory();
}

export type InventoryAddInput = {
  resourceType: string;
  quantity: number;
  unit?: string;
};

export async function addInventoryResource(
  input: InventoryAddInput,
  dependencies: InventoryMutationDependencies = defaultMutationDependencies,
): Promise<HabitatInventoryResource> {
  const resourceType = validateResourceType(input.resourceType);
  const quantity = validateQuantity(input.quantity);
  const unit = normalizeUnit(input.unit);
  const resources = await dependencies.loadInventory();
  const existingResource = resources.find((resource) => resource.resourceType === resourceType);
  const timestamp = dependencies.now();

  if (existingResource) {
    existingResource.quantity += quantity;
    existingResource.updatedAt = timestamp;
    if (existingResource.unit === undefined && unit !== undefined) {
      existingResource.unit = unit;
    }

    await dependencies.saveInventory(resources);
    return existingResource;
  }

  const resource: HabitatInventoryResource = {
    resourceType,
    quantity,
    ...(unit !== undefined ? { unit } : {}),
    updatedAt: timestamp,
  };

  resources.push(resource);
  await dependencies.saveInventory(resources);
  return resource;
}

export async function resetInventoryQuantities(
  dependencies: InventoryMutationDependencies = defaultMutationDependencies,
): Promise<HabitatInventoryResource[]> {
  const resources = await dependencies.loadInventory();
  const timestamp = dependencies.now();
  const nextResources = resources.map((resource) => ({
    ...resource,
    quantity: 0,
    updatedAt: timestamp,
  }));

  await dependencies.saveInventory(nextResources);
  return nextResources;
}

export function formatInventoryTable(resources: HabitatInventoryResource[]): string {
  const rows = resources
    .slice()
    .sort((left, right) => left.resourceType.localeCompare(right.resourceType))
    .map((resource) => ({
      resourceType: resource.resourceType,
      quantity: formatNumber(resource.quantity),
      unit: resource.unit ?? "-",
    }));

  const resourceTypeWidth = Math.max(
    "RESOURCE TYPE".length,
    ...rows.map((row) => row.resourceType.length),
  );
  const quantityWidth = Math.max(
    "QUANTITY".length,
    ...rows.map((row) => row.quantity.length),
  );

  const lines = [
    [
      "RESOURCE TYPE".padEnd(resourceTypeWidth),
      "QUANTITY".padEnd(quantityWidth),
      "UNIT",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.resourceType.padEnd(resourceTypeWidth),
        row.quantity.padEnd(quantityWidth),
        row.unit,
      ].join("   "),
    );
  }

  return lines.join("\n");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function validateResourceType(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error("resourceType is required.");
  }

  return trimmedValue;
}

function validateQuantity(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("quantity must be greater than 0.");
  }

  return value;
}

function normalizeUnit(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
}

export { loadInventory, saveInventory } from "./state";
export type { HabitatInventoryResource } from "./types";
