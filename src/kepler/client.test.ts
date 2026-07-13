import { describe, expect, test } from "bun:test";

import { requestKeplerJson } from "./client";

describe("Kepler client", () => {
  test("logs safe outbound and response request details", async () => {
    const messages: string[] = [];

    await requestKeplerJson<{ habitatUuid: string }>("/habitats/123", {
      method: "GET",
      expectedStatus: 200,
      environment: {
        KEPLER_BASE_URL: "https://kepler.example.test/base/",
        KEPLER_PLANET_TOKEN: "secret-token",
      },
      fetchImpl: async (input, init) => {
        expect(input).toBe("https://kepler.example.test/base/habitats/123");
        expect((init?.headers as Record<string, string>).Authorization).toBe(
          "Bearer secret-token",
        );

        return new Response(JSON.stringify({ habitatUuid: "123" }), { status: 200 });
      },
      logger: (message) => messages.push(message),
    });

    expect(messages).toEqual([
      "Kepler GET /base/habitats/123 outbound",
      "Kepler GET /base/habitats/123 200",
    ]);
    expect(messages.join(" ")).not.toContain("secret-token");
  });

  test("wraps rejected transport requests without exposing request secrets", async () => {
    const messages: string[] = [];

    const request = requestKeplerJson("/habitats/123", {
      method: "GET",
      expectedStatus: 200,
      environment: {
        KEPLER_BASE_URL: "https://kepler.example.test",
        KEPLER_PLANET_TOKEN: "secret-token",
      },
      fetchImpl: async () => {
        throw new TypeError("network failed for Bearer secret-token with request body");
      },
      logger: (message) => messages.push(message),
    });

    await expect(request).rejects.toThrow("Kepler request failed: transport error");
    await expect(request).rejects.not.toThrow("secret-token");
    expect(messages).toEqual(["Kepler GET /habitats/123 outbound"]);
    expect(messages.join(" ")).not.toContain("secret-token");
  });

  test("preserves HTTP status failure details", async () => {
    const request = requestKeplerJson("/habitats/123", {
      method: "GET",
      expectedStatus: 200,
      environment: { KEPLER_PLANET_TOKEN: "secret-token" },
      fetchImpl: async () => new Response("unavailable", { status: 503 }),
      logger: () => {},
    });

    await expect(request).rejects.toThrow("Kepler request failed with 503: unavailable");
  });

  test("preserves token validation errors outside the transport boundary", async () => {
    const request = requestKeplerJson("/habitats/123", {
      method: "GET",
      expectedStatus: 200,
      environment: {},
      fetchImpl: async () => new Response(null, { status: 200 }),
      logger: () => {},
    });

    await expect(request).rejects.toThrow("Missing Kepler auth token");
  });
});
