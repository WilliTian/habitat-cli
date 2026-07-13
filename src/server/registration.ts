import type { Hono } from "hono";

import { tryReadKeplerApiToken } from "../kepler/client";
import { loadRegistrationState } from "../kepler/state";
import type { KeplerHabitatState } from "../kepler/types";
import type { RegistrationResource } from "./types";

export type RegistrationRouteDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  readApiToken: () => string | undefined;
};

const defaultDependencies: RegistrationRouteDependencies = {
  loadRegistrationState,
  readApiToken: tryReadKeplerApiToken,
};

export function registerRegistrationRoutes(
  app: Hono,
  dependencies: RegistrationRouteDependencies = defaultDependencies,
): void {
  app.get("/registration", async (context) => {
    const registration = await dependencies.loadRegistrationState();

    return context.json(
      buildRegistrationResource(registration, dependencies.readApiToken()),
    );
  });
}

export function buildRegistrationResource(
  registration: KeplerHabitatState | undefined,
  apiToken: string | undefined,
): RegistrationResource {
  if (!registration) {
    return { registration: null };
  }

  return {
    registration: {
      habitatUuid: registration.habitatUuid,
      habitatId: registration.habitatId,
      displayName: registration.displayName,
      apiToken: apiToken ?? null,
    },
  };
}
