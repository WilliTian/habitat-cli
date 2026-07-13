import type { RegistrationResource } from "./types";
import { requestHabitatApiJson } from "./client";

export async function readRegistrationResource(): Promise<RegistrationResource> {
  return requestHabitatApiJson<RegistrationResource>("/registration");
}
