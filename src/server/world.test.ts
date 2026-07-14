import { describe, expect, test } from "bun:test";

import { createBackendApp } from "./app";
import type { WorldRouteDependencies } from "./world";
import type { KeplerHabitatState, WorldScanResponse } from "../kepler/types";

function registrationFixture(): KeplerHabitatState {
  return {
    habitatId: "habitat-1",
    habitatUuid: "uuid-1",
    displayName: "Habitat One",
    starterModules: [],
    registeredAt: "2026-07-14T00:00:00.000Z",
  };
}

function worldDependencies(
  input: Partial<WorldRouteDependencies> = {},
): WorldRouteDependencies {
  return {
    loadRegistrationState: async () => registrationFixture(),
    scanWorldResources: async () => ({
      scan: {
        modelVersion: "resource-probability-v2",
        origin: { x: 1, y: 2 },
        sensorStrength: 50,
        radiusTiles: 1,
        tiles: [],
      },
    }),
    ...input,
  };
}

describe("world routes", () => {
  test("GET /world/scan loads the registration and returns Kepler's response unchanged", async () => {
    const scan = {
      scan: {
        modelVersion: "resource-probability-v2",
        origin: { x: 1, y: 2 },
        sensorStrength: 50,
        radiusTiles: 1,
        tiles: [],
      },
    } satisfies WorldScanResponse;
    const inputs: unknown[] = [];
    const app = createBackendApp({
      logger: () => {},
      world: worldDependencies({
        scanWorldResources: async (input) => {
          inputs.push(input);
          return scan;
        },
      }),
    });

    const response = await app.request("/world/scan?x=1&y=2&sensorStrength=50&radiusTiles=1");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(scan);
    expect(inputs).toEqual([
      { habitatId: "habitat-1", x: 1, y: 2, sensorStrength: 50, radiusTiles: 1 },
    ]);
  });

  test.each([
    ["missing x", "y=2&sensorStrength=50&radiusTiles=1"],
    ["invalid x", "x=one&y=2&sensorStrength=50&radiusTiles=1"],
    ["non-canonical x", "x=01&y=2&sensorStrength=50&radiusTiles=1"],
    ["missing y", "x=1&sensorStrength=50&radiusTiles=1"],
    ["invalid y", "x=1&y=two&sensorStrength=50&radiusTiles=1"],
    ["non-canonical y", "x=1&y=-0&sensorStrength=50&radiusTiles=1"],
    ["missing sensor strength", "x=1&y=2&radiusTiles=1"],
    ["invalid sensor strength", "x=1&y=2&sensorStrength=one&radiusTiles=1"],
    ["non-integer sensor strength", "x=1&y=2&sensorStrength=50.5&radiusTiles=1"],
    ["sensor strength below its bound", "x=1&y=2&sensorStrength=-1&radiusTiles=1"],
    ["sensor strength above its bound", "x=1&y=2&sensorStrength=101&radiusTiles=1"],
    ["missing radius", "x=1&y=2&sensorStrength=50"],
    ["invalid radius", "x=1&y=2&sensorStrength=50&radiusTiles=one"],
    ["non-integer radius", "x=1&y=2&sensorStrength=50&radiusTiles=1.5"],
    ["radius below its bound", "x=1&y=2&sensorStrength=50&radiusTiles=-1"],
    ["radius above its bound", "x=1&y=2&sensorStrength=50&radiusTiles=6"],
  ])("GET /world/scan rejects %s", async (_description, query) => {
    const app = createBackendApp({ logger: () => {}, world: worldDependencies() });

    const response = await app.request(`/world/scan?${query}`);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_world_scan",
        message: "x, y, sensorStrength, and radiusTiles must be valid scan values.",
      },
    });
  });

  test("GET /world/scan returns 404 without a saved registration", async () => {
    const app = createBackendApp({
      logger: () => {},
      world: worldDependencies({ loadRegistrationState: async () => undefined }),
    });

    const response = await app.request("/world/scan?x=1&y=2&sensorStrength=50&radiusTiles=1");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "registration_not_found",
        message: "No Kepler habitat registration was found.",
      },
    });
  });

  test("GET /world/scan maps Kepler failures to 502", async () => {
    const app = createBackendApp({
      logger: () => {},
      world: worldDependencies({
        scanWorldResources: async () => {
          throw new Error("Kepler request failed: transport error");
        },
      }),
    });

    const response = await app.request("/world/scan?x=1&y=2&sensorStrength=50&radiusTiles=1");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "kepler_request_failed",
        message: "Kepler request failed: transport error",
      },
    });
  });
});
