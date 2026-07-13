import { requestHabitatApiJson } from "./client";
import type { HabitatInventoryResource } from "../inventory/types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

export type InventoryResource = {
  inventory: HabitatInventoryResource[];
};

export type InventoryItemResource = {
  resource: HabitatInventoryResource;
};

export function readInventory(
  options?: HabitatApiRequestOptions,
): Promise<InventoryResource> {
  return requestHabitatApiJson<InventoryResource>("/inventory", options);
}

export function replaceInventory(
  inventory: HabitatInventoryResource[],
  options?: HabitatApiRequestOptions,
): Promise<InventoryResource> {
  return requestHabitatApiJson<InventoryResource>("/inventory", {
    ...options,
    method: "PUT",
    body: { inventory },
  });
}

export function adjustInventory(
  resourceType: string,
  quantityDelta: number,
  unit?: string,
  options?: HabitatApiRequestOptions,
): Promise<InventoryItemResource> {
  return requestHabitatApiJson<InventoryItemResource>(
    `/inventory/${encodeURIComponent(resourceType)}`,
    {
      ...options,
      method: "PATCH",
      body: { quantityDelta, unit },
    },
  );
}
