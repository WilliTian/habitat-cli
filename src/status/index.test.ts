import { describe, expect, test } from "bun:test";

import { buildHabitatStatus, formatHabitatStatus, readHabitatStatus } from "./index";
import type { HabitatModule } from "../modules/types";

function moduleFixture(input: {
  id: string;
  displayName: string;
  status: string;
  powerDrawKw?: number | Record<string, number>;
  runtimeAttributes?: Record<string, unknown>;
}): HabitatModule {
  return {
    id: input.id,
    blueprintId: input.id,
    displayName: input.displayName,
    connectedTo: [],
    runtimeAttributes: {
      status: input.status,
      ...(input.powerDrawKw !== undefined ? { powerDrawKw: input.powerDrawKw } : {}),
      ...(input.runtimeAttributes ?? {}),
    },
    capabilities: [],
    source: "starter",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
}

describe("habitat status", () => {
  test("reads modules through its injected API adapter", async () => {
    const modules = [moduleFixture({
      id: "command",
      displayName: "Command Module",
      status: "active",
      powerDrawKw: 3.6,
    })];

    const status = await readHabitatStatus({ loadModules: async () => modules });

    expect(status.totalPowerDrawKw).toBe(3.6);
  });

  test("default adapter imports the Habitat API instead of persistence", async () => {
    const source = await Bun.file(new URL("./index.ts", import.meta.url)).text();

    expect(source).toContain('from "../api/modules"');
    expect(source).not.toContain('from "../modules/state"');
  });

  test("shows local module state and power draw for that state", () => {
    const status = buildHabitatStatus([
      moduleFixture({
        id: "command",
        displayName: "Command Module",
        status: "active",
        powerDrawKw: {
          offline: 0,
          online: 2,
          active: 2,
          damaged: 2,
        },
      }),
      moduleFixture({
        id: "fabricator",
        displayName: "Workshop Fabricator",
        status: "online",
        powerDrawKw: {
          offline: 0,
          online: 1,
          active: 8,
          damaged: 1,
        },
      }),
      moduleFixture({
        id: "cache",
        displayName: "Supply Cache",
        status: "offline",
        powerDrawKw: {
          offline: 0,
          online: 0,
          active: 0,
          damaged: 0,
        },
      }),
    ]);

    expect(status.modules).toEqual([
      {
        id: "command",
        displayName: "Command Module",
        status: "active",
        powerDrawKw: 2,
      },
      {
        id: "fabricator",
        displayName: "Workshop Fabricator",
        status: "online",
        powerDrawKw: 1,
      },
      {
        id: "cache",
        displayName: "Supply Cache",
        status: "offline",
        powerDrawKw: 0,
      },
    ]);
    expect(status.totalPowerDrawKw).toBe(3);
    expect(status.energyDemandPerTickKwh).toBeCloseTo(3 / 3600);
  });

  test("formats a summary that compares directly with tick battery drain", () => {
    const output = formatHabitatStatus(
      buildHabitatStatus([
        moduleFixture({
          id: "command",
          displayName: "Command Module",
          status: "active",
          powerDrawKw: 3.6,
        }),
      ]),
    );

    expect(output).toContain("Command Module | status: active | powerDrawKw: 3.6");
    expect(output).toContain("totalPowerDrawKw: 3.6");
    expect(output).toContain("energyDemandPerTickKwh: 0.001");
    expect(output).toContain("tickComparison: habitat tick 10 drains about 0.01 kWh");
  });
});
