import { describe, expect, test } from "bun:test";

import { createBackendApp } from "./app";
import type { RegistrationRouteDependencies } from "./registration";
import type { KeplerHabitatState } from "../kepler/types";

function habitatFixture(
  input: Partial<KeplerHabitatState> = {},
): KeplerHabitatState {
  return {
    displayName: "Cygnus Seven",
    habitatUuid: "uuid-7",
    habitatId: "habitat-7",
    starterModules: [],
    registeredAt: "2026-07-12T00:00:00.000Z",
    ...input,
  };
}

function registrationDependencies(
  input: Partial<RegistrationRouteDependencies> = {},
): RegistrationRouteDependencies {
  return {
    loadRegistrationState: async () => undefined,
    readApiToken: () => undefined,
    registerHabitat: async (registration) => habitatFixture({
      displayName: registration.displayName,
    }),
    readStatus: async () => habitatFixture(),
    unregisterHabitat: async () => ({
      keplerHabitat: habitatFixture(),
      remoteHabitatDeleted: true,
    }),
    ...input,
  };
}

describe("registration routes", () => {
  test("POST /registration registers through the backend", async () => {
    const registeredNames: string[] = [];
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        registerHabitat: async (input) => {
          registeredNames.push(input.displayName);
          return habitatFixture({ displayName: input.displayName });
        },
      }),
    });

    const response = await app.request("/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Cygnus Seven" }),
    });

    expect(response.status).toBe(201);
    expect(registeredNames).toEqual(["Cygnus Seven"]);
    expect(await response.json()).toEqual({
      registration: habitatFixture(),
    });
  });

  test("GET /status returns the refreshed registration", async () => {
    const status = habitatFixture({ refreshedAt: "2026-07-12T01:00:00.000Z" });
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({ readStatus: async () => status }),
    });

    const response = await app.request("/status");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ registration: status });
  });

  test("GET /status returns 404 when no registration exists", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({ readStatus: async () => undefined }),
    });

    const response = await app.request("/status");

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "registration_not_found",
        message: "No Kepler habitat registration was found.",
      },
    });
  });

  test("DELETE /registration returns a successful unregister result", async () => {
    const registration = habitatFixture();
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        unregisterHabitat: async () => ({
          keplerHabitat: registration,
          remoteHabitatDeleted: true,
        }),
      }),
    });

    const response = await app.request("/registration", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      registration,
      remoteHabitatDeleted: true,
    });
  });

  test("DELETE /registration returns a stale unregister result", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        unregisterHabitat: async () => ({
          keplerHabitat: habitatFixture(),
          remoteHabitatDeleted: false,
        }),
      }),
    });

    const response = await app.request("/registration", { method: "DELETE" });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      registration: { displayName: "Cygnus Seven" },
      remoteHabitatDeleted: false,
    });
  });

  test("POST /registration rejects malformed JSON", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies(),
    });

    const response = await app.request("/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "Request body must be valid JSON.",
      },
    });
  });

  test("POST /registration rejects a blank display name", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies(),
    });

    const response = await app.request("/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "  " }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "invalid_display_name",
        message: "displayName is required.",
      },
    });
  });

  test("POST /registration maps duplicate registration errors to 409", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        registerHabitat: async () => {
          throw new Error(
            'A Kepler habitat is already registered for "Cygnus Seven". Run habitat unregister first.',
          );
        },
      }),
    });

    const response = await app.request("/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Cygnus Eight" }),
    });

    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      error: { code: "registration_exists" },
    });
  });

  test("DELETE /registration maps missing registration errors to 404", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        unregisterHabitat: async () => {
          throw new Error("No Kepler habitat registration was found.");
        },
      }),
    });

    const response = await app.request("/registration", { method: "DELETE" });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: { code: "registration_not_found" },
    });
  });

  test("POST /registration maps domain validation errors to 400", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        registerHabitat: async () => {
          throw new Error("displayName is required.");
        },
      }),
    });

    const response = await app.request("/registration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Cygnus Seven" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "invalid_display_name" },
    });
  });

  test("GET /status maps Kepler request errors to 502", async () => {
    const app = createBackendApp({
      logger: () => {},
      registration: registrationDependencies({
        readStatus: async () => {
          throw new Error("Kepler request failed with 503: unavailable");
        },
      }),
    });

    const response = await app.request("/status");

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      error: { code: "kepler_request_failed" },
    });
  });
});
