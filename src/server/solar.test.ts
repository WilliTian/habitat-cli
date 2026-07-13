import { describe, expect, test } from "bun:test";

import { createBackendApp } from "./app";
import type { SolarRouteDependencies } from "./solar";

function solarDependencies(
  input: Partial<SolarRouteDependencies> = {},
): SolarRouteDependencies {
  return {
    readSolarIrradiance: async () => ({ wPerM2: 900, condition: "clear" }),
    ...input,
  };
}

describe("solar routes", () => {
  test("GET /solar/irradiance returns the Kepler solar reading", async () => {
    const solarIrradiance = { wPerM2: 250, condition: "dust" } as const;
    const app = createBackendApp({
      logger: () => {},
      solar: solarDependencies({ readSolarIrradiance: async () => solarIrradiance }),
    });

    const response = await app.request("/solar/irradiance");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ solarIrradiance });
  });
});
