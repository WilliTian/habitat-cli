import { describe, expect, test } from "bun:test";

import { requestKeplerJson } from "./client";

describe("Kepler client", () => {
  test("logs a single safe successful request result", async () => {
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

    expect(messages).toEqual(["[kepler] GET /base/habitats/123 -> 200"]);
    expect(messages.join(" ")).not.toContain("secret-token");
  });

  test("wraps rejected transport requests without exposing request secrets", async () => {
    const messages: string[] = [];

    const requestBodyValue = "secret-request-body-value";
    const request = requestKeplerJson("/habitats/123", {
      method: "POST",
      body: { note: requestBodyValue },
      expectedStatus: 200,
      environment: {
        KEPLER_BASE_URL: "https://kepler.example.test",
        KEPLER_PLANET_TOKEN: "secret-token",
      },
      fetchImpl: async (_input, init) => {
        expect(init?.body).toBe(JSON.stringify({ note: requestBodyValue }));
        throw new TypeError("network failed for Bearer secret-token with request body");
      },
      logger: (message) => messages.push(message),
    });

    await expect(request).rejects.toThrow("Kepler request failed: transport error");
    await expect(request).rejects.not.toThrow("secret-token");
    await expect(request).rejects.not.toThrow(requestBodyValue);
    expect(messages).toEqual(["[kepler] POST /habitats/123 -> transport error"]);
    expect(messages.join(" ")).not.toContain("secret-token");
    expect(messages.join(" ")).not.toContain(requestBodyValue);
  });

  test("logs only the status for non-success responses", async () => {
    const messages: string[] = [];

    const request = requestKeplerJson("/habitats/123", {
      method: "GET",
      expectedStatus: 200,
      environment: { KEPLER_PLANET_TOKEN: "secret-token" },
      fetchImpl: async () => new Response("private response body", { status: 503 }),
      logger: (message) => messages.push(message),
    });

    await expect(request).rejects.toThrow("Kepler request failed with 503");
    expect(messages).toEqual(["[kepler] GET /habitats/123 -> 503"]);
    expect(messages.join(" ")).not.toContain("private response body");
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
    await expect(request).rejects.toMatchObject({
      name: "KeplerRequestError",
      status: 503,
    });
  });

  test("wraps malformed successful JSON with request context", async () => {
    const request = requestKeplerJson("/catalog/blueprints", {
      method: "GET",
      expectedStatus: 200,
      environment: { KEPLER_PLANET_TOKEN: "secret-token" },
      fetchImpl: async () => new Response("not-json", { status: 200 }),
      logger: () => {},
    });

    await expect(request).rejects.toThrow(
      "Kepler request failed: invalid JSON response for /catalog/blueprints",
    );
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
