import { describe, expect, test } from "bun:test";

import { requestHabitatApiJson } from "./client";
import { readSolarIrradianceResource } from "./solar";

function testOptions(
  fetchImpl: NonNullable<Parameters<typeof requestHabitatApiJson>[1]>["fetchImpl"],
): NonNullable<Parameters<typeof requestHabitatApiJson>[1]> {
  return {
    environment: { HABITAT_API_BASE_URL: "http://localhost:8787" },
    fetchImpl,
  };
}

describe("solar API", () => {
  test("requests the solar irradiance resource", async () => {
    const solarIrradiance = { wPerM2: 250, condition: "dust" } as const;

    const result = await readSolarIrradianceResource(testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/solar/irradiance");
      expect(init?.method).toBe("GET");
      return Promise.resolve(new Response(JSON.stringify({ solarIrradiance }), {
        headers: { "Content-Type": "application/json" },
      }));
    }));

    expect(result).toEqual({ solarIrradiance });
  });
});
