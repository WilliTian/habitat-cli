import type {
  KeplerHabitatState,
  UnregisterKeplerHabitatResult,
} from "./types";

export function formatKeplerHabitat(keplerHabitat: KeplerHabitatState): string {
  const lines = [
    `displayName: ${keplerHabitat.displayName}`,
    `habitatUuid: ${keplerHabitat.habitatUuid}`,
    `habitatId: ${keplerHabitat.habitatId}`,
    `starterModules: ${keplerHabitat.starterModules.length}`,
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

export function formatUnregisterKeplerHabitatResult(
  result: UnregisterKeplerHabitatResult,
): string {
  if (result.remoteHabitatDeleted) {
    return `Unregistered habitat named "${result.keplerHabitat.displayName}".`;
  }

  return `Cleared stale local registration for habitat named "${result.keplerHabitat.displayName}"; it was already absent in Kepler.`;
}
