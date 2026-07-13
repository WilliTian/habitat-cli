import { describe, expect, test } from "bun:test";

import { BackendHttpError } from "./errors";
import { createBackendApp } from "./app";

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

  test("logs the final request status without response data", async () => {
    const messages: string[] = [];
    const app = createBackendApp({ logger: (message) => messages.push(message) });

    await app.request("/registration");

    expect(messages).toEqual(["Habitat API GET /registration 200"]);
  });
});
