import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { HabitatInventoryResource } from "./types";

const habitatDataDirectoryUrl = new URL("../../.habitat/", import.meta.url);
const inventoryStateFileUrl = new URL("../../.habitat/inventory.json", import.meta.url);

type HabitatInventoryState = {
  resources: HabitatInventoryResource[];
};

export async function loadInventory(): Promise<HabitatInventoryResource[]> {
  try {
    const fileContents = await readFile(inventoryStateFileUrl, "utf8");
    const data = JSON.parse(fileContents) as Partial<HabitatInventoryState>;
    return data.resources ?? [];
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

export async function saveInventory(resources: HabitatInventoryResource[]): Promise<void> {
  await mkdir(habitatDataDirectoryUrl, { recursive: true });
  await writeFile(
    inventoryStateFileUrl,
    JSON.stringify({ resources }, null, 2) + "\n",
    "utf8",
  );
}

function isMissingFileError(error: unknown): error is NodeJS.ErrnoException {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ENOENT"
  );
}
