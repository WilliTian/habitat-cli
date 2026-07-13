import { loadInventory, saveInventory } from "./state";
import type { HabitatInventoryResource } from "./types";

export { formatInventoryResource, formatInventoryTable } from "./format";

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

export type InventoryAdjustmentInput = {
  resourceType: string;
  quantityDelta: number;
  unit?: string;
};

export async function addInventoryResource(
  input: InventoryAddInput,
  dependencies: InventoryMutationDependencies = defaultMutationDependencies,
): Promise<HabitatInventoryResource> {
  return adjustInventoryResource({
    resourceType: input.resourceType,
    quantityDelta: validateQuantity(input.quantity),
    unit: input.unit,
  }, dependencies);
}

export async function adjustInventoryResource(
  input: InventoryAdjustmentInput,
  dependencies: InventoryMutationDependencies = defaultMutationDependencies,
): Promise<HabitatInventoryResource> {
  const resourceType = validateResourceType(input.resourceType);
  const quantityDelta = validateQuantityDelta(input.quantityDelta);
  const unit = normalizeUnit(input.unit);
  const resources = await dependencies.loadInventory();
  const existingResource = resources.find((resource) => resource.resourceType === resourceType);
  const timestamp = dependencies.now();

  if (existingResource) {
    if (existingResource.quantity + quantityDelta < 0) {
      throw new Error(
        `Cannot remove ${Math.abs(quantityDelta)} ${resourceType}; only ${existingResource.quantity} is available.`,
      );
    }

    existingResource.quantity += quantityDelta;
    existingResource.updatedAt = timestamp;
    if (existingResource.unit === undefined && unit !== undefined) {
      existingResource.unit = unit;
    }

    await dependencies.saveInventory(resources);
    return existingResource;
  }

  if (quantityDelta < 0) {
    throw new Error(
      `Cannot remove ${Math.abs(quantityDelta)} ${resourceType}; only 0 is available.`,
    );
  }

  const resource: HabitatInventoryResource = {
    resourceType,
    quantity: quantityDelta,
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

function validateQuantityDelta(value: number): number {
  if (!Number.isFinite(value) || value === 0) {
    throw new Error("quantityDelta must be a finite non-zero number.");
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
