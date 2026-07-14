import type { Hono } from "hono";

import {
  createModule,
  deleteModule,
  findModuleByPrefix,
  listModules,
  updateModuleByPrefix,
} from "../modules/index";
import { saveModules } from "../modules/state";
import type {
  HabitatModule,
  HabitatModuleCreateInput,
  HabitatModuleUpdateInput,
} from "../modules/types";
import { BackendHttpError } from "./errors";
import { setHabitatApiSummary } from "./logging";
import { createMutationQueue } from "./mutation-queue";

export type ModuleRouteDependencies = {
  listModules: typeof listModules;
  saveModules: typeof saveModules;
  createModule: typeof createModule;
  findModuleByPrefix: typeof findModuleByPrefix;
  updateModuleByPrefix: typeof updateModuleByPrefix;
  deleteModule: typeof deleteModule;
};

const defaultDependencies: ModuleRouteDependencies = {
  listModules,
  saveModules,
  createModule,
  findModuleByPrefix,
  updateModuleByPrefix,
  deleteModule,
};

export function registerModuleRoutes(
  app: Hono,
  dependencies: ModuleRouteDependencies = defaultDependencies,
): void {
  const routeDependencies = { ...defaultDependencies, ...dependencies };
  const runMutation = createMutationQueue();

  app.get("/modules", async (context) => {
    try {
      const modules = await routeDependencies.listModules();
      setHabitatApiSummary(context, countLabel(modules.length, "module"));
      return context.json({ modules });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.put("/modules", async (context) => {
    const modules = await readModulesInput(context.req.json());

    try {
      return await runMutation(async () => {
        await routeDependencies.saveModules(modules);
        setHabitatApiSummary(context, `saved ${countLabel(modules.length, "module")}`);
        return context.json({ modules });
      });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.post("/modules", async (context) => {
    const input = await readModuleCreateInput(context.req.json());

    try {
      return await runMutation(async () => {
        const module = await routeDependencies.createModule(input);
        setHabitatApiSummary(context, `created module ${module.id}`);
        return context.json({ module }, 201);
      });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.get("/modules/:id", async (context) => {
    const prefix = context.req.param("id");

    try {
      const module = await routeDependencies.findModuleByPrefix(prefix);
      if (!module) {
        throw moduleNotFoundError(prefix);
      }

      setHabitatApiSummary(context, `module ${module.id}`);
      return context.json({ module });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.patch("/modules/:id", async (context) => {
    const prefix = context.req.param("id");
    const input = await readModuleUpdateInput(context.req.json());

    try {
      return await runMutation(async () => {
        const module = await routeDependencies.updateModuleByPrefix(prefix, input);
        setHabitatApiSummary(context, `updated module ${module.id}`);
        return context.json({ module });
      });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.delete("/modules/:id", async (context) => {
    const prefix = context.req.param("id");

    try {
      return await runMutation(async () => {
        const module = await routeDependencies.findModuleByPrefix(prefix);
        if (!module) {
          throw moduleNotFoundError(prefix);
        }

        await routeDependencies.deleteModule(module.id);
        setHabitatApiSummary(context, `deleted module ${module.id}`);
        return context.json({ module });
      });
    } catch (error) {
      throw translateModuleError(error);
    }
  });
}

function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

async function readModulesInput(json: Promise<unknown>): Promise<HabitatModule[]> {
  const body = await readJsonBody(json);

  if (
    !isObject(body) ||
    !Array.isArray(body.modules) ||
    !body.modules.every(isHabitatModule) ||
    new Set(body.modules.map((module) => module.id)).size !== body.modules.length
  ) {
    throw new BackendHttpError(
      400,
      "invalid_modules",
      "modules must be an array of valid modules with unique ids.",
    );
  }

  return body.modules;
}

async function readModuleCreateInput(
  json: Promise<unknown>,
): Promise<HabitatModuleCreateInput> {
  const body = await readJsonBody(json);

  if (!isModuleCreateInput(body)) {
    throw invalidModuleError();
  }

  return body;
}

async function readModuleUpdateInput(
  json: Promise<unknown>,
): Promise<HabitatModuleUpdateInput> {
  const body = await readJsonBody(json);

  if (!isModuleUpdateInput(body)) {
    throw invalidModuleError();
  }

  return body;
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

function isHabitatModule(value: unknown): value is HabitatModule {
  return (
    isObject(value) &&
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.blueprintId) &&
    isNonEmptyString(value.displayName) &&
    isStringArray(value.connectedTo) &&
    isObject(value.runtimeAttributes) &&
    isStringArray(value.capabilities) &&
    (value.source === "starter" || value.source === "local") &&
    isNonEmptyString(value.createdAt) &&
    isNonEmptyString(value.updatedAt)
  );
}

function isModuleCreateInput(value: unknown): value is HabitatModuleCreateInput {
  return (
    isObject(value) &&
    isNonEmptyString(value.blueprintId) &&
    isNonEmptyString(value.displayName) &&
    isOptionalStringArray(value.connectedTo) &&
    isOptionalObject(value.runtimeAttributes) &&
    isOptionalStringArray(value.capabilities)
  );
}

function isModuleUpdateInput(value: unknown): value is HabitatModuleUpdateInput {
  return (
    isObject(value) &&
    isOptionalNonEmptyString(value.blueprintId) &&
    isOptionalNonEmptyString(value.displayName) &&
    isOptionalStringArray(value.connectedTo) &&
    isOptionalObject(value.runtimeAttributes) &&
    isOptionalStringArray(value.capabilities)
  );
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isOptionalNonEmptyString(value: unknown): value is string | undefined {
  return value === undefined || isNonEmptyString(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || isStringArray(value);
}

function isOptionalObject(
  value: unknown,
): value is Record<string, unknown> | undefined {
  return value === undefined || isObject(value);
}

function invalidModuleError(): BackendHttpError {
  return new BackendHttpError(
    400,
    "invalid_module",
    "Request body contains invalid module fields.",
  );
}

function translateModuleError(error: unknown): Error {
  if (error instanceof BackendHttpError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return new Error("Unknown module error.", { cause: error });
  }

  if (error.message.startsWith("Module id ") && error.message.endsWith(" is ambiguous.")) {
    return new BackendHttpError(409, "module_id_ambiguous", error.message, { cause: error });
  }

  if (error.message.startsWith("Module ") && error.message.endsWith(" was not found.")) {
    return new BackendHttpError(404, "module_not_found", error.message, { cause: error });
  }

  if (error.message.endsWith(" is required.")) {
    return new BackendHttpError(400, "invalid_module", error.message, { cause: error });
  }

  return error;
}

function moduleNotFoundError(prefix: string): BackendHttpError {
  return new BackendHttpError(404, "module_not_found", `Module "${prefix}" was not found.`);
}
