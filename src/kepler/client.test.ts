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
});
