import type { HabitatModule } from "../modules/types";

export function resolvePowerDrawKw(module: HabitatModule): number {
  const { powerDrawKw, status } = module.runtimeAttributes;

  if (typeof powerDrawKw === "number") {
    if (status === "offline") {
      return 0;
    }

    return powerDrawKw > 0 ? powerDrawKw : 0;
  }

  if (
    typeof status === "string" &&
    powerDrawKw !== undefined &&
    powerDrawKw !== null &&
    typeof powerDrawKw === "object"
  ) {
    const statusPowerDrawKw = powerDrawKw[status];
    return typeof statusPowerDrawKw === "number" && statusPowerDrawKw > 0
      ? statusPowerDrawKw
      : 0;
  }

  return 0;
}
