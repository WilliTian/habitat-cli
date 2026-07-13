import { requestHabitatApiJson } from "./client";
import type { SolarIrradianceReading } from "../kepler/types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

type SolarIrradianceResource = {
  solarIrradiance: SolarIrradianceReading;
};

export async function readSolarIrradianceResource(
  options?: HabitatApiRequestOptions,
): Promise<SolarIrradianceResource> {
  return requestHabitatApiJson<SolarIrradianceResource>("/solar/irradiance", options);
}
