import { describe, expect, test } from "bun:test";

import { formatPowerTickSummary } from "./cli";

describe("tick cli", () => {
  test("reports when there is no usable battery energy", () => {
    const output = formatPowerTickSummary({
      tickCount: 10,
      activePowerDrawKw: 3.6,
      solarGenerationKw: 0,
      solarEnergyGeneratedKwh: 0,
      netPowerKw: 3.6,
      solarIrradianceWPerM2: 0,
      solarCondition: "night",
      solarChargingStatus: "no sunlight is available",
      grossEnergyDemandKwh: 0.01,
      energyDemandKwh: 0.01,
      energyChargedKwh: 0,
      energyDrainedKwh: 0,
      unmetEnergyKwh: 0.01,
      batteryDrains: [],
      batteryCharges: [],
    });

    expect(output).toContain("batteries: no usable battery energy available");
  });

  test("formats solar generation and charging details", () => {
    const output = formatPowerTickSummary({
      tickCount: 3600,
      activePowerDrawKw: 2,
      solarGenerationKw: 5,
      solarEnergyGeneratedKwh: 2,
      netPowerKw: -3,
      solarIrradianceWPerM2: 900,
      solarCondition: "clear",
      solarChargingStatus: "charged 2 kWh into batteries",
      grossEnergyDemandKwh: 0,
      energyDemandKwh: 0,
      energyChargedKwh: 2,
      energyDrainedKwh: 0,
      unmetEnergyKwh: 0,
      batteryDrains: [],
      batteryCharges: [
        {
          moduleId: "battery",
          displayName: "Battery",
          beforeEnergyStoredKwh: 10,
          afterEnergyStoredKwh: 12,
          chargedKwh: 2,
        },
      ],
    });

    expect(output).toContain("solarIrradianceWPerM2: 900");
    expect(output).toContain("solarCondition: clear");
    expect(output).toContain("solarGenerationKw: 5");
    expect(output).toContain("solarEnergyGeneratedKwh: 2");
    expect(output).toContain("netPowerKw: -3");
    expect(output).toContain("solarChargingStatus: charged 2 kWh into batteries");
    expect(output).toContain("energyChargedKwh: 2");
    expect(output).toContain("batteryCharge: Battery 10 -> 12 kWh");
  });
});
