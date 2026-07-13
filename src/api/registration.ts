import { requestHabitatApiJson } from "./client";
import type {
  RegistrationResource,
  RegistrationStateResource,
  UnregisterResource,
} from "./types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

export async function createRegistration(
  displayName: string,
  options?: HabitatApiRequestOptions,
): Promise<RegistrationStateResource> {
  return requestHabitatApiJson<RegistrationStateResource>("/registration", {
    ...options,
    method: "POST",
    body: { displayName },
  });
}

export async function readRegistrationStatus(
  options?: HabitatApiRequestOptions,
): Promise<RegistrationStateResource> {
  return requestHabitatApiJson<RegistrationStateResource>("/status", options);
}

export async function deleteRegistration(
  options?: HabitatApiRequestOptions,
): Promise<UnregisterResource> {
  return requestHabitatApiJson<UnregisterResource>("/registration", {
    ...options,
    method: "DELETE",
  });
}

export async function readRegistrationResource(
  options?: HabitatApiRequestOptions,
): Promise<RegistrationResource> {
  return requestHabitatApiJson<RegistrationResource>("/registration", options);
}
