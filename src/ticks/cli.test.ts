import { describe, expect, test } from "bun:test";

import { formatPowerTickSummary } from "./cli";

describe("tick cli", () => {
  test("reports when there is no usable battery energy", () => {
    const output = formatPowerTickSummary({
      tickCount: 10,
      activePowerDrawKw: 3.6,
      energyDemandKwh: 0.01,
      energyDrainedKwh: 0,
      unmetEnergyKwh: 0.01,
      batteryDrains: [],
    });

    expect(output).toContain("batteries: no usable battery energy available");
  });
});
