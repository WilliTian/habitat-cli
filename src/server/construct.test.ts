import { describe, expect, test } from "bun:test";
import { createBackendApp } from "./app";

const deps = { findBlueprint: async () => undefined, loadModules: async () => [], saveModules: async () => {}, loadInventory: async () => [], saveInventory: async () => {} };
describe("construction routes", () => {
  test("lists construction jobs through the domain", async () => {
    const response = await createBackendApp({ logger: () => {}, construction: deps }).request("/construction");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ construction: [] });
  });
  test("rejects missing blueprint ids", async () => {
    const response = await createBackendApp({ logger: () => {}, construction: deps }).request("/construction", { method: "POST", body: "{}", headers: { "Content-Type": "application/json" } });
    expect(response.status).toBe(400);
  });
});
