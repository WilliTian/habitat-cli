import { describe, expect, test } from "bun:test";

import { requestHabitatApiJson } from "./client";
import {
  createModuleResource,
  deleteModuleResource,
  readModule,
  readModules,
  replaceModules,
  updateModuleResource,
} from "./modules";
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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
  });
}

function testOptions(
  fetchImpl: NonNullable<Parameters<typeof requestHabitatApiJson>[1]>["fetchImpl"],
): NonNullable<Parameters<typeof requestHabitatApiJson>[1]> {
  return {
    environment: { HABITAT_API_BASE_URL: "http://localhost:8787" },
    fetchImpl,
  };
}

describe("module API", () => {
  test("reads module resources", async () => {
    const modules = [moduleFixture()];

    const result = await readModules(testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/modules");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse({ modules }));
    }));

    expect(result).toEqual({ modules });
  });

  test("replaces module resources", async () => {
    const modules = [moduleFixture()];

    await replaceModules(modules, testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/modules");
      expect(init?.method).toBe("PUT");
      expect(init?.body).toBe(JSON.stringify({ modules }));
      return Promise.resolve(jsonResponse({ modules }));
    }));
  });

  test("creates a module resource", async () => {
    const module = moduleFixture();
    const input = { blueprintId: "command-module", displayName: "Command Module" };

    const result = await createModuleResource(input, testOptions((request, init) => {
      expect(request).toBe("http://localhost:8787/modules");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify(input));
      return Promise.resolve(jsonResponse({ module }));
    }));

    expect(result).toEqual({ module });
  });

  test("reads an encoded module id", async () => {
    const module = moduleFixture();

    await readModule("module/a", testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/modules/module%2Fa");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse({ module }));
    }));
  });

  test("patches an encoded module id", async () => {
    const module = moduleFixture({ displayName: "Updated Module" });
    const input = { displayName: "Updated Module" };

    await updateModuleResource("module/a", input, testOptions((request, init) => {
      expect(request).toBe("http://localhost:8787/modules/module%2Fa");
      expect(init?.method).toBe("PATCH");
      expect(init?.body).toBe(JSON.stringify(input));
      return Promise.resolve(jsonResponse({ module }));
    }));
  });

  test("deletes an encoded module id", async () => {
    await deleteModuleResource("module/a", testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/modules/module%2Fa");
      expect(init?.method).toBe("DELETE");
      return Promise.resolve(jsonResponse({ module: moduleFixture() }));
    }));
  });
});
