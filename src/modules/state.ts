import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { HabitatModule } from "./types";

const habitatDataDirectoryUrl = new URL("../../.habitat/", import.meta.url);
const moduleStateFileUrl = new URL("../../.habitat/modules.json", import.meta.url);

type HabitatModuleState = {
  modules: HabitatModule[];
};

export async function loadModules(): Promise<HabitatModule[]> {
  try {
    const fileContents = await readFile(moduleStateFileUrl, "utf8");
    const data = JSON.parse(fileContents) as Partial<HabitatModuleState>;
    return data.modules ?? [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

export async function saveModules(modules: HabitatModule[]): Promise<void> {
  await mkdir(habitatDataDirectoryUrl, { recursive: true });
  await writeFile(moduleStateFileUrl, JSON.stringify({ modules }, null, 2) + "\n", "utf8");
}

export async function deleteModules(): Promise<void> {
  try {
    await writeFile(moduleStateFileUrl, JSON.stringify({ modules: [] }, null, 2) + "\n", "utf8");
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
