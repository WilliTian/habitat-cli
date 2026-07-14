import type { Hono } from "hono";

import { tryReadKeplerApiToken } from "../kepler/client";
import {
  readKeplerHabitatStatus,
  registerKeplerHabitat,
  unregisterKeplerHabitat,
} from "../kepler/index";
import { loadRegistrationState } from "../kepler/state";
import type { KeplerHabitatState } from "../kepler/types";
import { BackendHttpError } from "./errors";
import { setHabitatApiSummary } from "./logging";
import type {
  RegistrationResource,
  RegistrationStateResource,
  UnregisterResource,
} from "./types";

export type RegistrationRouteDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  readApiToken: () => string | undefined;
  registerHabitat?: typeof registerKeplerHabitat;
  readStatus?: typeof readKeplerHabitatStatus;
  unregisterHabitat?: typeof unregisterKeplerHabitat;
};

type ResolvedRegistrationRouteDependencies = Required<RegistrationRouteDependencies>;

const defaultDependencies: ResolvedRegistrationRouteDependencies = {
  loadRegistrationState,
  readApiToken: tryReadKeplerApiToken,
  registerHabitat: registerKeplerHabitat,
  readStatus: readKeplerHabitatStatus,
  unregisterHabitat: unregisterKeplerHabitat,
};

export function registerRegistrationRoutes(
  app: Hono,
  dependencies: RegistrationRouteDependencies = defaultDependencies,
): void {
  const routeDependencies: ResolvedRegistrationRouteDependencies = {
    ...defaultDependencies,
    ...dependencies,
  };

  app.get("/registration", async (context) => {
    const registration = await routeDependencies.loadRegistrationState();
    setHabitatApiSummary(
      context,
      registration ? `registered as ${registration.displayName}` : "not registered",
    );

    return context.json(
      buildRegistrationResource(registration, routeDependencies.readApiToken()),
    );
  });

  app.post("/registration", async (context) => {
    const input = await readRegistrationInput(context.req.json());

    try {
      const registration = await routeDependencies.registerHabitat(input);
      setHabitatApiSummary(context, `registered ${registration.displayName}`);
      return context.json<RegistrationStateResource>({ registration }, 201);
    } catch (error) {
      throw translateRegistrationError(error);
    }
  });

  app.get("/status", async (context) => {
    try {
      const registration = await routeDependencies.readStatus();

      if (!registration) {
        throw registrationNotFoundError();
      }

      setHabitatApiSummary(context, `status refreshed for ${registration.displayName}`);
      return context.json<RegistrationStateResource>({ registration });
    } catch (error) {
      throw translateRegistrationError(error);
    }
  });

  app.delete("/registration", async (context) => {
    try {
      const result = await routeDependencies.unregisterHabitat();
      setHabitatApiSummary(
        context,
        result.remoteHabitatDeleted
          ? `unregistered ${result.keplerHabitat.displayName}`
          : `cleared stale registration for ${result.keplerHabitat.displayName}`,
      );
      return context.json<UnregisterResource>({
        registration: result.keplerHabitat,
        remoteHabitatDeleted: result.remoteHabitatDeleted,
      });
    } catch (error) {
      throw translateRegistrationError(error);
    }
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

async function readRegistrationInput(json: Promise<unknown>): Promise<{ displayName: string }> {
  let body: unknown;

  try {
    body = await json;
  } catch {
    throw new BackendHttpError(
      400,
      "invalid_request",
      "Request body must be valid JSON.",
    );
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("displayName" in body) ||
    typeof body.displayName !== "string" ||
    body.displayName.trim().length === 0
  ) {
    throw new BackendHttpError(400, "invalid_display_name", "displayName is required.");
  }

  return { displayName: body.displayName };
}

function translateRegistrationError(error: unknown): Error {
  if (error instanceof BackendHttpError) {
    return error;
  }

  if (!(error instanceof Error)) {
    return new Error("Unknown registration error.", { cause: error });
  }

  if (error.message === "No Kepler habitat registration was found.") {
    return registrationNotFoundError();
  }

  if (error.message.startsWith("A Kepler habitat is already registered for ")) {
    return new BackendHttpError(409, "registration_exists", error.message, { cause: error });
  }

  if (error.message === "displayName is required.") {
    return new BackendHttpError(400, "invalid_display_name", error.message, { cause: error });
  }

  if (
    error.message.startsWith("Kepler request failed") ||
    error.message.startsWith("Missing Kepler auth token")
  ) {
    return new BackendHttpError(502, "kepler_request_failed", error.message, { cause: error });
  }

  return error;
}

function registrationNotFoundError(): BackendHttpError {
  return new BackendHttpError(
    404,
    "registration_not_found",
    "No Kepler habitat registration was found.",
  );
}
