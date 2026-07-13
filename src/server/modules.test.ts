import { describe, expect, test } from "bun:test";

import { createBackendApp } from "./app";
import type { ModuleRouteDependencies } from "./modules";
import type { HabitatModule } from "../modules/types";

function moduleFixture(input: Partial<HabitatModule> = {}): HabitatModule {
  return {
    id: "module-12345678",
    blueprintId: "command-module",
    displayName: "Command Module",
    connectedTo: [],
    runtimeAttributes: { status: "online" },
    capabilities: ["habitat-command"],
    source: "local",
    createdAt: "2026-07-13T00:00:00.000Z",
    updatedAt: "2026-07-13T00:00:00.000Z",
    ...input,
  };
}

function moduleDependencies(
  input: Partial<ModuleRouteDependencies> = {},
): ModuleRouteDependencies {
  const module = moduleFixture();

  return {
    listModules: async () => [module],
    saveModules: async () => {},
    createModule: async () => module,
    findModuleByPrefix: async () => module,
    updateModuleByPrefix: async () => module,
    deleteModule: async () => {},
    ...input,
  };
}

function jsonRequest(method: string, body: unknown): Request {
  return new Request("http://localhost/modules", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("module routes", () => {
  test("PUT /modules replaces SQLite-backed state", async () => {
    let saved: HabitatModule[] = [];
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        saveModules: async (modules) => {
          saved = modules;
        },
      }),
    });
    const modules = [moduleFixture()];

    const response = await app.request("/modules", jsonRequest("PUT", { modules }));

    expect(response.status).toBe(200);
    expect(saved).toEqual(modules);
    expect(await response.json()).toEqual({ modules });
  });

  test("GET /modules lists saved modules", async () => {
    const modules = [moduleFixture()];
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({ listModules: async () => modules }),
    });

    const response = await app.request("/modules");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ modules });
  });

  test("POST /modules creates a module resource", async () => {
    const module = moduleFixture();
    const created: unknown[] = [];
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        createModule: async (input) => {
          created.push(input);
          return module;
        },
      }),
    });
    const input = { blueprintId: "command-module", displayName: "Command Module" };

    const response = await app.request("/modules", jsonRequest("POST", input));

    expect(response.status).toBe(201);
    expect(created).toEqual([input]);
    expect(await response.json()).toEqual({ module });
  });

  test("GET /modules/:id resolves a module prefix", async () => {
    const module = moduleFixture();
    const prefixes: string[] = [];
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        findModuleByPrefix: async (prefix) => {
          prefixes.push(prefix);
          return module;
        },
      }),
    });

    const response = await app.request("/modules/module-12");

    expect(response.status).toBe(200);
    expect(prefixes).toEqual(["module-12"]);
    expect(await response.json()).toEqual({ module });
  });

  test("GET /modules/:id returns 409 for an ambiguous prefix", async () => {
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        findModuleByPrefix: async () => {
          throw new Error('Module id "module" is ambiguous.');
        },
      }),
    });

    const response = await app.request("/modules/module");

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: {
        code: "module_id_ambiguous",
        message: 'Module id "module" is ambiguous.',
      },
    });
  });

  test("GET /modules/:id returns 404 when a prefix is absent", async () => {
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({ findModuleByPrefix: async () => undefined }),
    });

    const response = await app.request("/modules/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "module_not_found",
        message: 'Module "missing" was not found.',
      },
    });
  });

  test("PATCH /modules/:id updates supplied module fields", async () => {
    const module = moduleFixture({ displayName: "Updated Command Module" });
    const updates: unknown[] = [];
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        updateModuleByPrefix: async (_prefix, input) => {
          updates.push(input);
          return module;
        },
      }),
    });

    const response = await app.request(
      "/modules/module-12",
      jsonRequest("PATCH", { displayName: "Updated Command Module" }),
    );

    expect(response.status).toBe(200);
    expect(updates).toEqual([{ displayName: "Updated Command Module" }]);
    expect(await response.json()).toEqual({ module });
  });

  test("DELETE /modules/:id returns the deleted module", async () => {
    const module = moduleFixture();
    const deleted: string[] = [];
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        findModuleByPrefix: async () => module,
        deleteModule: async (id) => {
          deleted.push(id);
        },
      }),
    });

    const response = await app.request("/modules/module-12", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(deleted).toEqual([module.id]);
    expect(await response.json()).toEqual({ module });
  });

  test("module routes reject invalid collections and bodies", async () => {
    const app = createBackendApp({ logger: () => {}, modules: moduleDependencies() });

    const replaceResponse = await app.request(
      "/modules",
      jsonRequest("PUT", { modules: {} }),
    );
    const createResponse = await app.request("/modules", jsonRequest("POST", []));

    expect(replaceResponse.status).toBe(400);
    expect(createResponse.status).toBe(400);
  });

  test("module routes reject invalid field schemas before mutation", async () => {
    let mutationCount = 0;
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        saveModules: async () => { mutationCount += 1; },
        createModule: async () => {
          mutationCount += 1;
          return moduleFixture();
        },
        updateModuleByPrefix: async () => {
          mutationCount += 1;
          return moduleFixture();
        },
      }),
    });

    const replaceResponse = await app.request(
      "/modules",
      jsonRequest("PUT", { modules: [moduleFixture({ runtimeAttributes: "bad" as never })] }),
    );
    const createResponse = await app.request(
      "/modules",
      jsonRequest("POST", {
        blueprintId: "command-module",
        displayName: "Command Module",
        connectedTo: "module-2",
      }),
    );
    const updateResponse = await app.request(
      "/modules/module-12",
      jsonRequest("PATCH", { capabilities: [1] }),
    );

    expect(replaceResponse.status).toBe(400);
    expect(createResponse.status).toBe(400);
    expect(updateResponse.status).toBe(400);
    expect(mutationCount).toBe(0);
  });

  test("PUT /modules rejects duplicate module ids", async () => {
    let saved = false;
    const module = moduleFixture();
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({ saveModules: async () => { saved = true; } }),
    });

    const response = await app.request(
      "/modules",
      jsonRequest("PUT", { modules: [module, { ...module, displayName: "Duplicate" }] }),
    );

    expect(response.status).toBe(400);
    expect(saved).toBe(false);
  });

  test("serializes concurrent module mutations", async () => {
    let createdCount = 0;
    const app = createBackendApp({
      logger: () => {},
      modules: moduleDependencies({
        createModule: async () => {
          const previousCount = createdCount;
          await new Promise((resolve) => setTimeout(resolve, 0));
          createdCount = previousCount + 1;
          return moduleFixture({ id: `module-${createdCount}` });
        },
      }),
    });

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => app.request(
        "/modules",
        jsonRequest("POST", {
          blueprintId: "command-module",
          displayName: "Command Module",
        }),
      )),
    );

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(createdCount).toBe(10);
  });
});
