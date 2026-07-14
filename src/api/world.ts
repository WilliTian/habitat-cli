import { requestHabitatApiJson } from "./client";
import type { WorldScanResponse } from "../kepler/types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

export type WorldScanCommandInput = {
  x: number;
  y: number;
  sensorStrength: number;
  radiusTiles: number;
};

export function scanWorld(
  input: WorldScanCommandInput,
  options?: HabitatApiRequestOptions,
): Promise<WorldScanResponse> {
  const query = new URLSearchParams({
    x: String(input.x),
    y: String(input.y),
    sensorStrength: String(input.sensorStrength),
    radiusTiles: String(input.radiusTiles),
  });

  return requestHabitatApiJson<WorldScanResponse>(`/world/scan?${query}`, options);
}
