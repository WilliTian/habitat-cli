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

  test("GET /solar/irradiance maps Kepler transport failures to 502", async () => {
    const app = createBackendApp({
      logger: () => {},
      solar: solarDependencies({
        readSolarIrradiance: async () => {
          throw new Error("Kepler request failed: transport error");
        },
      }),
    });

    const response = await app.request("/solar/irradiance");

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "kepler_request_failed",
        message: "Kepler request failed: transport error",
      },
    });
  });
});
