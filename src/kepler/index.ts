import { randomUUID } from "node:crypto";

import { requestKeplerJson } from "./client";
import {
  deleteRegistrationState,
  loadRegistrationState,
  saveRegistrationState,
} from "./state";
import type {
  HabitatRegistrationInput,
  HabitatRegistrationResponse,
  HabitatResponse,
  KeplerHabitatState,
} from "./types";
import {
  deleteModules,
} from "../modules/index";
import { loadModules, replaceModulesFromStarterModules } from "../modules/index";

function validateName(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedValue;
}

export type {
  Habitat,
  HabitatRegistrationInput,
  KeplerHabitatState,
  ProductionBlueprint,
  StarterModuleInstance,
} from "./types";

export async function registerKeplerHabitat(
  input: HabitatRegistrationInput,
): Promise<KeplerHabitatState> {
  const existingKeplerHabitat = await loadRegistrationState();

  if (existingKeplerHabitat) {
    throw new Error(
      `A Kepler habitat is already registered for "${existingKeplerHabitat.displayName}". Run habitat unregister first.`,
    );
  }

  const displayName = validateName(input.displayName, "displayName");
  const habitatUuid = randomUUID();
  const response = await requestKeplerJson<HabitatRegistrationResponse>("/habitats/register", {
    method: "POST",
    expectedStatus: 201,
    body: {
      displayName,
      habitatUuid,
    },
  });

  const keplerHabitat: KeplerHabitatState = {
    displayName,
    habitatUuid,
    habitatId: response.habitatId,
    starterModules: response.starterModules,
    blueprints: response.blueprints,
    registeredAt: new Date().toISOString(),
  };

  await replaceModulesFromStarterModules(response.starterModules);
  keplerHabitat.moduleCount = response.starterModules.length;
  await saveRegistrationState(keplerHabitat);
  return keplerHabitat;
}

export async function readKeplerHabitatStatus(): Promise<KeplerHabitatState | undefined> {
  const keplerHabitat = await loadRegistrationState();

  if (!keplerHabitat) {
    return undefined;
  }

  const response = await requestKeplerJson<HabitatResponse>(
    `/habitats/${encodeURIComponent(keplerHabitat.habitatId)}/registration`,
    {
      method: "GET",
      expectedStatus: 200,
    },
  );

  keplerHabitat.habitat = response.habitat;
  keplerHabitat.refreshedAt = new Date().toISOString();
  keplerHabitat.moduleCount = (await loadModules()).length;
  await saveRegistrationState(keplerHabitat);

  return keplerHabitat;
}

export async function unregisterKeplerHabitat(): Promise<KeplerHabitatState> {
  const keplerHabitat = await loadRegistrationState();

  if (!keplerHabitat) {
    throw new Error("No Kepler habitat registration was found.");
  }

  await requestKeplerJson<void>(`/habitats/${encodeURIComponent(keplerHabitat.habitatId)}`, {
    method: "DELETE",
    expectedStatus: 204,
  });

  await deleteModules();
  await deleteRegistrationState();
  return keplerHabitat;
}

export function formatKeplerHabitat(keplerHabitat: KeplerHabitatState): string {
  const lines = [
    `displayName: ${keplerHabitat.displayName}`,
    `habitatUuid: ${keplerHabitat.habitatUuid}`,
    `habitatId: ${keplerHabitat.habitatId}`,
    `starterModules: ${keplerHabitat.starterModules.length}`,
    `blueprints: ${keplerHabitat.blueprints.length}`,
    `modules: ${keplerHabitat.moduleCount ?? keplerHabitat.starterModules.length}`,
  ];

  if (keplerHabitat.habitat) {
    lines.push(`habitatSlug: ${keplerHabitat.habitat.habitatSlug}`);
    lines.push(`status: ${keplerHabitat.habitat.status}`);
    lines.push(`catalogVersion: ${keplerHabitat.habitat.catalogVersion}`);
    lines.push(`lastSeenAt: ${keplerHabitat.habitat.lastSeenAt ?? "null"}`);
  }

  if (keplerHabitat.refreshedAt) {
    lines.push(`refreshedAt: ${keplerHabitat.refreshedAt}`);
  }

  return lines.join("\n");
}
