import { describe, expect, test } from "bun:test";

import {
  HabitatApiError,
  readHabitatApiBaseUrl,
  requestHabitatApiJson,
} from "./client";

describe("api client", () => {
  test("defaults the Habitat API base URL to localhost", () => {
    expect(readHabitatApiBaseUrl({})).toBe("http://localhost:8787");
  });

  test("trims a configured Habitat API base URL", () => {
    expect(
      readHabitatApiBaseUrl({
        HABITAT_API_BASE_URL: "http://class-server:8787/",
      }),
    ).toBe("http://class-server:8787");
  });

  test("sends and parses JSON responses", async () => {
    const result = await requestHabitatApiJson<{ registration: null }>(
      "/registration",
      {
        environment: {
          HABITAT_API_BASE_URL: "http://localhost:8787",
        },
        fetchImpl: async (input, init) => {
          expect(input).toBe("http://localhost:8787/registration");
          expect(init?.method).toBe("GET");
          expect((init?.headers as Record<string, string>).Accept).toBe("application/json");

          return new Response(JSON.stringify({ registration: null }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          });
        },
      },
    );

    expect(result).toEqual({ registration: null });
  });

  test("turns backend JSON errors into friendly CLI errors", async () => {
    await expect(
      requestHabitatApiJson("/registration", {
        fetchImpl: async () =>
          new Response(JSON.stringify({ error: "No registration found." }), {
            status: 404,
            statusText: "Not Found",
            headers: {
              "Content-Type": "application/json",
            },
          }),
      }),
    ).rejects.toEqual(
      new HabitatApiError({
        backendMessage: "No registration found.",
        message: "Habitat API request failed for /registration: No registration found.",
        path: "/registration",
        status: 404,
      }),
    );
  });

  test("extracts a nested backend error message", async () => {
    await expect(
      requestHabitatApiJson("/modules", {
        fetchImpl: async () =>
          new Response(
            JSON.stringify({
              error: { code: "module_not_found", message: "Module not found." },
            }),
            { status: 404 },
          ),
      }),
    ).rejects.toEqual(
      new HabitatApiError({
        backendMessage: "Module not found.",
        message: "Habitat API request failed for /modules: Module not found.",
        path: "/modules",
        status: 404,
      }),
    );
  });

  test("turns connection failures into a startup hint", async () => {
    await expect(
      requestHabitatApiJson("/registration", {
        fetchImpl: async () => {
          throw new Error("connect ECONNREFUSED");
        },
      }),
    ).rejects.toThrow(
      'Could not reach the Habitat API at http://localhost:8787. Start the server with "bun run server" and try again.',
    );
  });

  test("turns malformed successful JSON into a friendly CLI error", async () => {
    await expect(
      requestHabitatApiJson("/modules", {
        fetchImpl: async () => new Response("not-json", { status: 200 }),
      }),
    ).rejects.toThrow("Habitat API returned invalid JSON for /modules.");
  });
});
