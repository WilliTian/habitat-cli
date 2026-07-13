import type { Hono } from "hono";

import {
  adjustInventoryResource,
  listInventory,
} from "../inventory/index";
import { saveInventory } from "../inventory/state";
import type { HabitatInventoryResource } from "../inventory/types";
import { BackendHttpError } from "./errors";

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

  app.get("/inventory", async (context) => {
    const inventory = await routeDependencies.listInventory();
    return context.json({ inventory });
  });

  app.put("/inventory", async (context) => {
    const inventory = await readInventoryCollection(context.req.json());
    await routeDependencies.saveInventory(inventory);
    return context.json({ inventory });
  });

  app.patch("/inventory/:resourceType", async (context) => {
    const input = await readAdjustment(context.req.json());

    try {
      const resource = await routeDependencies.adjustInventoryResource({
        resourceType: context.req.param("resourceType"),
        ...input,
      });
      return context.json({ resource });
    } catch (error) {
      throw translateInventoryError(error);
    }
  });
}

async function readInventoryCollection(
  json: Promise<unknown>,
): Promise<HabitatInventoryResource[]> {
  const body = await readJsonBody(json);

  if (!isObject(body) || !Array.isArray(body.inventory) || !body.inventory.every(isObject)) {
    throw new BackendHttpError(
      400,
      "invalid_inventory",
      "inventory must be an array of inventory resource objects.",
    );
  }

  return body.inventory as HabitatInventoryResource[];
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
