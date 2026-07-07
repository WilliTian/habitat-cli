import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

export type StarterModuleInstance = {
  id: string;
  blueprintId: string;
  displayName: string;
  connectedTo: string[];
  runtimeAttributes: Record<string, unknown>;
  capabilities: string[];
};

export type ProductionBlueprint = {
  id: string;
  blueprintId: string;
  displayName: string;
  description: string;
  status: "draft" | "published";
  output: Record<string, unknown>;
  inputs: Record<string, unknown>;
  buildTicks: number;
  repeatable: boolean;
  prerequisites?: string[];
  unlocks?: string[];
  level?: number | null;
  target?: Record<string, unknown>;
  requiredFacility?: Record<string, unknown>;
  facilityLevel?: Record<string, unknown>;
  attachmentPoints?: Record<string, unknown>;
  attachmentRequirements?: Record<string, unknown>[];
  runtimeAttributes?: Record<string, unknown>;
  capabilities?: string[];
};

export type Habitat = {
  id: string;
  habitatSlug: string;
  displayName: string;
  catalogVersion: string;
  status: string;
  lastSeenAt: string | null;
};

export type HabitatRegistrationInput = {
  displayName: string;
  habitatUuid?: string;
};

export type HabitatRegistrationResponse = {
  habitatId: string;
  starterModules: StarterModuleInstance[];
  blueprints: ProductionBlueprint[];
};

export type HabitatResponse = {
  habitat: Habitat;
};

export type KeplerHabitatState = {
  displayName: string;
  habitatUuid: string;
  habitatId: string;
  starterModules: StarterModuleInstance[];
  blueprints: ProductionBlueprint[];
  habitat?: Habitat;
  registeredAt: string;
  refreshedAt?: string;
};

const defaultBaseUrl = "https://planet.turingguild.com";
const dataDirectoryUrl = new URL("../data/", import.meta.url);
const registrationDataFileUrl = new URL("../data/kepler-registration.json", import.meta.url);

function getBaseUrl(): string {
  const rawBaseUrl = process.env.KEPLER_BASE_URL?.trim();

  if (!rawBaseUrl) {
    return defaultBaseUrl;
  }

  return rawBaseUrl.replace(/\/+$/, "");
}

function getToken(): string {
  const token =
    process.env.KEPLER_PLANET_TOKEN?.trim() ??
    process.env.KEPLER_WORLD_TOKEN?.trim() ??
    process.env.PLANET_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Missing Kepler auth token. Set KEPLER_PLANET_TOKEN in your environment or .env file.",
    );
  }

  return token;
}

async function requestKeplerJson<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "DELETE";
    body?: unknown;
    expectedStatus: number;
  },
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const responseText = await response.text();

  if (response.status !== options.expectedStatus) {
    const suffix = responseText.trim().length > 0 ? `: ${responseText.trim()}` : "";
    throw new Error(`Kepler request failed with ${response.status}${suffix}`);
  }

  if (responseText.trim().length === 0) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

async function loadRegistrationState(): Promise<KeplerHabitatState | undefined> {
  try {
    const fileContents = await readFile(registrationDataFileUrl, "utf8");
    const data = JSON.parse(fileContents) as { keplerHabitat?: KeplerHabitatState };
    return data.keplerHabitat;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }

    throw error;
  }
}

async function saveRegistrationState(keplerHabitat: KeplerHabitatState): Promise<void> {
  await mkdir(dataDirectoryUrl, { recursive: true });
  await writeFile(
    registrationDataFileUrl,
    JSON.stringify({ keplerHabitat }, null, 2) + "\n",
    "utf8",
  );
}

async function deleteRegistrationState(): Promise<void> {
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

function validateName(value: string, fieldName: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error(`${fieldName} is required.`);
  }

  return trimmedValue;
}

function formatUuidFromHex(hex: string): string {
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function deriveHabitatUuid(displayName: string): string {
  const normalizedDisplayName = displayName.trim().toLowerCase();
  const source = `${getBaseUrl()}:${normalizedDisplayName}`;
  const hash = createHash("sha256").update(source).digest("hex");
  const hex = hash.slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = (((Number.parseInt(hex[16] ?? "0", 16) & 0x3) | 0x8).toString(16));
  return formatUuidFromHex(hex.join(""));
}

export async function registerKeplerHabitat(
  input: HabitatRegistrationInput,
): Promise<KeplerHabitatState> {
  const displayName = validateName(input.displayName, "displayName");
  const habitatUuid =
    input.habitatUuid !== undefined ? validateName(input.habitatUuid, "habitatUuid") : deriveHabitatUuid(displayName);

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

  await deleteRegistrationState();
  return keplerHabitat;
}

export function formatRegistrationRecord(keplerHabitat: KeplerHabitatState): string {
  const lines = [
    `displayName: ${keplerHabitat.displayName}`,
    `habitatUuid: ${keplerHabitat.habitatUuid}`,
    `habitatId: ${keplerHabitat.habitatId}`,
    `starterModules: ${keplerHabitat.starterModules.length}`,
    `blueprints: ${keplerHabitat.blueprints.length}`,
  ];

  if (keplerHabitat.habitat) {
    lines.push(`status: ${keplerHabitat.habitat.status}`);
    lines.push(`habitatSlug: ${keplerHabitat.habitat.habitatSlug}`);
    lines.push(`catalogVersion: ${keplerHabitat.habitat.catalogVersion}`);
    lines.push(`lastSeenAt: ${keplerHabitat.habitat.lastSeenAt ?? "null"}`);
  }

  return lines.join("\n");
}

export function formatStatusRecord(keplerHabitat: KeplerHabitatState): string {
  const lines = [
    `displayName: ${keplerHabitat.displayName}`,
    `habitatUuid: ${keplerHabitat.habitatUuid}`,
    `habitatId: ${keplerHabitat.habitatId}`,
    `starterModules: ${keplerHabitat.starterModules.length}`,
    `blueprints: ${keplerHabitat.blueprints.length}`,
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
