import { requestHabitatApiJson } from "./client";
import type { StarterHuman } from "../kepler/types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

export type HumansResource = {
  humans: StarterHuman[];
};

export function readHumans(
  options?: HabitatApiRequestOptions,
): Promise<HumansResource> {
  return requestHabitatApiJson<HumansResource>("/humans", options);
}

export type HumanResource = { human: StarterHuman };

export function moveHuman(humanId: string, moduleId: string, options?: HabitatApiRequestOptions): Promise<HumanResource> {
  return requestHabitatApiJson<HumanResource>(`/humans/${encodeURIComponent(humanId)}`, {
    ...options,
    method: "PATCH",
    body: { locationModuleId: moduleId },
  });
}
