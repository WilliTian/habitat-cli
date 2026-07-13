import { describe, expect, test } from "bun:test";

import { requestHabitatApiJson } from "./client";
import {
  createRegistration,
  deleteRegistration,
  readRegistrationStatus,
} from "./registration";
import type { KeplerHabitatState } from "../kepler/types";

function habitatFixture(): KeplerHabitatState {
  return {
    displayName: "Cygnus Seven",
    habitatUuid: "uuid-7",
    habitatId: "habitat-7",
    starterModules: [],
    registeredAt: "2026-07-12T00:00:00.000Z",
  };
}

function testOptions(
  fetchImpl: NonNullable<Parameters<typeof requestHabitatApiJson>[1]>["fetchImpl"],
): NonNullable<Parameters<typeof requestHabitatApiJson>[1]> {
  return {
    environment: { HABITAT_API_BASE_URL: "http://localhost:8787" },
    fetchImpl,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("registration API", () => {
  test("posts a registration name", async () => {
    const result = await createRegistration("Cygnus Seven", testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/registration");
      expect(init?.method).toBe("POST");
      expect(init?.body).toBe(JSON.stringify({ displayName: "Cygnus Seven" }));
      return Promise.resolve(jsonResponse({ registration: habitatFixture() }, 201));
    }));

    expect(result.registration.displayName).toBe("Cygnus Seven");
  });

  test("reads the live registration status", async () => {
    const result = await readRegistrationStatus(testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/status");
      expect(init?.method).toBe("GET");
      return Promise.resolve(jsonResponse({ registration: habitatFixture() }, 200));
    }));

    expect(result.registration).toEqual(habitatFixture());
  });

  test("deletes a registration", async () => {
    const result = await deleteRegistration(testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/registration");
      expect(init?.method).toBe("DELETE");
      return Promise.resolve(jsonResponse({
        registration: habitatFixture(),
        remoteHabitatDeleted: false,
      }, 200));
    }));

    expect(result).toMatchObject({
      registration: { displayName: "Cygnus Seven" },
      remoteHabitatDeleted: false,
    });
  });
});
