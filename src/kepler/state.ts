import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { KeplerHabitatState } from "./types";

const habitatDataDirectoryUrl = new URL("../../.habitat/", import.meta.url);
const registrationDataFileUrl = new URL("../../.habitat/kepler-registration.json", import.meta.url);

export async function loadRegistrationState(): Promise<KeplerHabitatState | undefined> {
  try {
    const fileContents = await readFile(registrationDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { keplerHabitat?: Record<string, unknown> };
    return normalizeRegistrationState(data.keplerHabitat);
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

function normalizeRegistrationState(
  value: Record<string, unknown> | undefined,
): KeplerHabitatState | undefined {
  if (!value) {
    return undefined;
  }

  return {
    displayName: String(value.displayName),
    habitatUuid: String(value.habitatUuid),
    habitatId: String(value.habitatId),
    starterModules: Array.isArray(value.starterModules) ? (value.starterModules as KeplerHabitatState["starterModules"]) : [],
    moduleCount: typeof value.moduleCount === "number" ? value.moduleCount : undefined,
    habitat: typeof value.habitat === "object" && value.habitat !== null ? (value.habitat as KeplerHabitatState["habitat"]) : undefined,
    registeredAt: String(value.registeredAt),
    refreshedAt: typeof value.refreshedAt === "string" ? value.refreshedAt : undefined,
  };
}

export async function saveRegistrationState(keplerHabitat: KeplerHabitatState): Promise<void> {
  await mkdir(habitatDataDirectoryUrl, { recursive: true });
  await writeFile(
    registrationDataFileUrl,
    JSON.stringify({ keplerHabitat }, null, 2) + "\n",
    "utf8",
  );
}

export async function deleteRegistrationState(): Promise<void> {
  try {
    await writeFile(registrationDataFileUrl, JSON.stringify({}, null, 2) + "\n", "utf8");
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
