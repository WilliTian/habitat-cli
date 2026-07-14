import { describe, expect, test } from "bun:test";
import type { Context } from "hono";

import { BackendHttpError } from "./errors";
import { createBackendApp } from "./app";
import { formatHabitatApiLog, setHabitatApiSummary } from "./logging";

function formatLogSummary(summary: string, status = 200): string {
  const context = {
    req: { method: "GET", path: "/logging" },
    res: { status },
  } as unknown as Context;

  setHabitatApiSummary(context, summary);

  return formatHabitatApiLog(context);
}

describe("backend app", () => {
  test("returns structured JSON for backend errors", async () => {
    const app = createBackendApp({
      registration: {
        loadRegistrationState: async () => {
          throw new BackendHttpError(
            404,
            "registration_not_found",
            "No registration found.",
          );
        },
        readApiToken: () => undefined,
      },
    });

    const response = await app.request("/registration");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "registration_not_found",
        message: "No registration found.",
      },
    });
  });

  test("logs a prefixed Habitat route summary", async () => {
    const messages: string[] = [];
    const app = createBackendApp({
      logger: (message) => messages.push(message),
      registration: {
        loadRegistrationState: async () => undefined,
        readApiToken: () => undefined,
      },
    });

    await app.request("/registration");

    expect(messages).toEqual(["[habitat-api] GET /registration -> not registered"]);
  });

  test("logs only the safe status and code for backend errors", async () => {
    const messages: string[] = [];
    const app = createBackendApp({
      logger: (message) => messages.push(message),
      registration: {
        loadRegistrationState: async () => {
          throw new BackendHttpError(404, "registration_not_found", "secret detail");
        },
        readApiToken: () => "api-token-secret",
      },
    });

    await app.request("/registration");

    expect(messages).toEqual([
      "[habitat-api] GET /registration -> 404 registration_not_found",
    ]);
    expect(messages.join(" ")).not.toContain("secret");
    expect(messages.join(" ")).not.toContain("api-token");
  });

  test("replaces ANSI, control, and format characters in log summaries", () => {
    expect(formatLogSummary(" \u001b[31m Cygnus\u0000\u200b Seven \r")).toBe(
      "[habitat-api] GET /logging -> [31m Cygnus Seven",
    );
  });

  test("caps log summaries at 160 Unicode code points", () => {
    expect(formatLogSummary("🚀".repeat(161))).toBe(
      `[habitat-api] GET /logging -> ${"🚀".repeat(160)}`,
    );
  });

  test("falls back to the HTTP status when a sanitized summary is empty", () => {
    expect(formatLogSummary("\u0000\u001b\u200b", 201)).toBe(
      "[habitat-api] GET /logging -> 201",
    );
  });
});
