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

  app.get("/modules", async (context) => {
    try {
      const modules = await routeDependencies.listModules();
      return context.json({ modules });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.put("/modules", async (context) => {
    const modules = await readModulesInput(context.req.json());

    try {
      await routeDependencies.saveModules(modules);
      return context.json({ modules });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.post("/modules", async (context) => {
    const input = await readModuleInput<HabitatModuleCreateInput>(context.req.json());

    try {
      const module = await routeDependencies.createModule(input);
      return context.json({ module }, 201);
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

      return context.json({ module });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.patch("/modules/:id", async (context) => {
    const prefix = context.req.param("id");
    const input = await readModuleInput<HabitatModuleUpdateInput>(context.req.json());

    try {
      const module = await routeDependencies.updateModuleByPrefix(prefix, input);
      return context.json({ module });
    } catch (error) {
      throw translateModuleError(error);
    }
  });

  app.delete("/modules/:id", async (context) => {
    const prefix = context.req.param("id");

    try {
      const module = await routeDependencies.findModuleByPrefix(prefix);
      if (!module) {
        throw moduleNotFoundError(prefix);
      }

      await routeDependencies.deleteModule(module.id);
      return context.json({ module });
    } catch (error) {
      throw translateModuleError(error);
    }
  });
}

async function readModulesInput(json: Promise<unknown>): Promise<HabitatModule[]> {
  const body = await readJsonBody(json);

  if (!isObject(body) || !Array.isArray(body.modules) || !body.modules.every(isObject)) {
    throw new BackendHttpError(
      400,
      "invalid_modules",
      "modules must be an array of module objects.",
    );
  }

  return body.modules as HabitatModule[];
}

async function readModuleInput<T>(json: Promise<unknown>): Promise<T> {
  const body = await readJsonBody(json);

  if (!isObject(body)) {
    throw new BackendHttpError(400, "invalid_module", "Request body must be a module object.");
  }

  return body as T;
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
