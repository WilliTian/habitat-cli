import { expect, test } from "bun:test";

import { requestHabitatApiJson } from "./client";
import { scanWorld } from "./world";

function testOptions(
  fetchImpl: NonNullable<Parameters<typeof requestHabitatApiJson>[1]>["fetchImpl"],
): NonNullable<Parameters<typeof requestHabitatApiJson>[1]> {
  return {
    environment: { HABITAT_API_BASE_URL: "http://localhost:8787" },
    fetchImpl,
  };
}

test("requests the local world scan endpoint with scan query parameters", async () => {
  const result = await scanWorld(
    { x: 2, y: -1, sensorStrength: 40, radiusTiles: 1 },
    testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/world/scan?x=2&y=-1&sensorStrength=40&radiusTiles=1");
      expect(init?.method).toBe("GET");
      return Promise.resolve(new Response(JSON.stringify({ scan: { tiles: [] } })));
    }),
  );

  expect(result).toEqual({ scan: { tiles: [] } });
});
