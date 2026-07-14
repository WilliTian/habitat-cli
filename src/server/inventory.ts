import type { Hono } from "hono";

import {
  adjustInventoryResource,
  listInventory,
} from "../inventory/index";
import { saveInventory } from "../inventory/state";
import type { HabitatInventoryResource } from "../inventory/types";
import { BackendHttpError } from "./errors";
import { setHabitatApiSummary } from "./logging";
import { createMutationQueue } from "./mutation-queue";

export type InventoryRouteDependencies = {
  listInventory: typeof listInventory;
  saveInventory: typeof saveInventory;
  adjustInventoryResource: typeof adjustInventoryResource;
};

const defaultDependencies: InventoryRouteDependencies = {
  listInventory,
  saveInventory,
  adjustInventoryResource,
};

export function registerInventoryRoutes(
  app: Hono,
  dependencies: InventoryRouteDependencies = defaultDependencies,
): void {
  const routeDependencies = { ...defaultDependencies, ...dependencies };
  const runMutation = createMutationQueue();

  app.get("/inventory", async (context) => {
    const inventory = await routeDependencies.listInventory();
    setHabitatApiSummary(context, countLabel(inventory.length, "resource"));
    return context.json({ inventory });
  });

  app.put("/inventory", async (context) => {
    const inventory = await readInventoryCollection(context.req.json());
    return runMutation(async () => {
      await routeDependencies.saveInventory(inventory);
      setHabitatApiSummary(context, `saved ${countLabel(inventory.length, "resource")}`);
      return context.json({ inventory });
    });
  });

  app.patch("/inventory/:resourceType", async (context) => {
    const input = await readAdjustment(context.req.json());

    try {
      return await runMutation(async () => {
        const resource = await routeDependencies.adjustInventoryResource({
          resourceType: context.req.param("resourceType"),
          ...input,
        });
        setHabitatApiSummary(context, `${resource.resourceType} now ${resource.quantity}`);
        return context.json({ resource });
      });
    } catch (error) {
      throw translateInventoryError(error);
    }
  });
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

async function readInventoryCollection(
  json: Promise<unknown>,
): Promise<HabitatInventoryResource[]> {
  const body = await readJsonBody(json);

  if (
    !isObject(body) ||
    !Array.isArray(body.inventory) ||
    !body.inventory.every(isInventoryResource) ||
    !hasUniqueResourceTypes(body.inventory)
  ) {
    throw new BackendHttpError(
      400,
      "invalid_inventory",
      "inventory resources require a resourceType, a non-negative finite quantity, and an updatedAt timestamp.",
    );
  }

  return body.inventory as HabitatInventoryResource[];
}

function hasUniqueResourceTypes(resources: HabitatInventoryResource[]): boolean {
  return new Set(resources.map((resource) => resource.resourceType)).size === resources.length;
}

async function readAdjustment(json: Promise<unknown>): Promise<{
  quantityDelta: number;
  unit?: string;
}> {
  const body = await readJsonBody(json);

  if (
    !isObject(body) ||
    typeof body.quantityDelta !== "number" ||
    !Number.isFinite(body.quantityDelta) ||
    body.quantityDelta === 0 ||
    (body.unit !== undefined && typeof body.unit !== "string")
  ) {
    throw new BackendHttpError(
      400,
      "invalid_inventory_adjustment",
      "quantityDelta must be a finite non-zero number and unit must be a string when provided.",
    );
  }

  return { quantityDelta: body.quantityDelta, unit: body.unit };
}

async function readJsonBody(json: Promise<unknown>): Promise<unknown> {
  try {
    return await json;
  } catch {
    throw new BackendHttpError(400, "invalid_request", "Request body must be valid JSON.");
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isInventoryResource(value: unknown): value is HabitatInventoryResource {
  return (
    isObject(value) &&
    typeof value.resourceType === "string" &&
    value.resourceType.trim().length > 0 &&
    typeof value.quantity === "number" &&
    Number.isFinite(value.quantity) &&
    value.quantity >= 0 &&
    typeof value.updatedAt === "string" &&
    value.updatedAt.trim().length > 0 &&
    (value.unit === undefined || typeof value.unit === "string")
  );
}

function translateInventoryError(error: unknown): Error {
  if (!(error instanceof Error)) {
    return new Error("Unknown inventory error.", { cause: error });
  }

  if (error.message.startsWith("Cannot remove ")) {
    return new BackendHttpError(409, "inventory_overdraw", error.message, { cause: error });
  }

  if (
    error.message.startsWith("resourceType ") ||
    error.message.startsWith("quantityDelta ")
  ) {
    return new BackendHttpError(400, "invalid_inventory_adjustment", error.message, {
      cause: error,
    });
  }

  return error;
}
