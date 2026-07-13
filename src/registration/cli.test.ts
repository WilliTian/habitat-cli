import { expect, spyOn, test } from "bun:test";
import { Command } from "commander";

import { registerRegistrationCommands } from "./cli";
import * as kepler from "../kepler/index";
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

test("register sends the name to the Habitat API and formats the response", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const registerDomainSpy = spyOn(kepler, "registerKeplerHabitat").mockImplementation(async () => {
    throw new Error("Commander must not call the Kepler registration domain.");
  });
  const createCalls: string[] = [];

  registerRegistrationCommands(program, {
    createRegistration: async (displayName) => {
      createCalls.push(displayName);
      return { registration: habitatFixture() };
    },
  });

  await program.parseAsync(["register", "--name", "Cygnus Seven"], { from: "user" });

  expect(createCalls).toEqual(["Cygnus Seven"]);
  expect(registerDomainSpy).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith('Registered habitat "Cygnus Seven".');
  expect(logSpy).toHaveBeenCalledWith(kepler.formatKeplerHabitat(habitatFixture()));

  registerDomainSpy.mockRestore();
  logSpy.mockRestore();
});

test("status formats the live registration returned by the Habitat API", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const statusDomainSpy = spyOn(kepler, "readKeplerHabitatStatus").mockImplementation(async () => {
    throw new Error("Commander must not call the Kepler status domain.");
  });
  let statusCalls = 0;
  const registration = habitatFixture();

  registerRegistrationCommands(program, {
    readRegistrationStatus: async () => {
      statusCalls += 1;
      return { registration };
    },
  });

  await program.parseAsync(["status"], { from: "user" });

  expect(statusCalls).toBe(1);
  expect(statusDomainSpy).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith(kepler.formatKeplerHabitat(registration));

  statusDomainSpy.mockRestore();
  logSpy.mockRestore();
});

test("unregister formats the stale cleanup returned by the Habitat API", async () => {
  const program = new Command();
  const logSpy = spyOn(console, "log").mockImplementation(() => {});
  const unregisterDomainSpy = spyOn(kepler, "unregisterKeplerHabitat").mockImplementation(async () => {
    throw new Error("Commander must not call the Kepler unregister domain.");
  });
  let deleteCalls = 0;
  const registration = habitatFixture();

  registerRegistrationCommands(program, {
    deleteRegistration: async () => {
      deleteCalls += 1;
      return { registration, remoteHabitatDeleted: false };
    },
  });

  await program.parseAsync(["unregister"], { from: "user" });

  expect(deleteCalls).toBe(1);
  expect(unregisterDomainSpy).not.toHaveBeenCalled();
  expect(logSpy).toHaveBeenCalledWith(
    kepler.formatUnregisterKeplerHabitatResult({
      keplerHabitat: registration,
      remoteHabitatDeleted: false,
    }),
  );

  unregisterDomainSpy.mockRestore();
  logSpy.mockRestore();
});
