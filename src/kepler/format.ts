import type {
  IndustryResource,
  KeplerHabitatState,
  ProductionBlueprint,
  SolarIrradianceReading,
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

export function formatSolarIrradianceStatus(
  reading: SolarIrradianceReading,
): string {
  return [
    `Sunlight is ${formatSolarCondition(reading.condition)} right now.`,
    `Solar irradiance: ${formatNumber(reading.wPerM2)} W/m2`,
  ].join("\n");
}

function formatSolarCondition(condition: SolarIrradianceReading["condition"]): string {
  switch (condition) {
    case "clear":
      return "clear";
    case "dust":
      return "dusty";
    case "storm":
      return "stormy";
    case "night":
      return "nighttime";
  }
}

export function formatBlueprintSummary(blueprint: ProductionBlueprint): string {
  return `${blueprint.blueprintId} ${blueprint.displayName}`;
}

export function formatBlueprintTable(blueprints: ProductionBlueprint[]): string {
  const rows = blueprints
    .slice()
    .sort((left, right) => left.blueprintId.localeCompare(right.blueprintId))
    .map((blueprint) => ({
      blueprintId: blueprint.blueprintId,
      displayName: blueprint.displayName,
    }));

  const blueprintIdWidth = Math.max(
    "BLUEPRINT ID".length,
    ...rows.map((row) => row.blueprintId.length),
  );

  const lines = [
    [
      "BLUEPRINT ID".padEnd(blueprintIdWidth),
      "DISPLAY NAME",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.blueprintId.padEnd(blueprintIdWidth),
        row.displayName,
      ].join("   "),
    );
  }

  return lines.join("\n");
}

export function formatResourceTable(
  resources: IndustryResource[],
  inventory: { resourceType: string; quantity: number }[] = [],
): string {
  const inventoryByType = buildInventoryQuantityMap(inventory);
  const rows = resources
    .slice()
    .sort((left, right) => left.resourceType.localeCompare(right.resourceType))
    .map((resource) => ({
      resourceType: resource.resourceType,
      displayName: resource.displayName,
      kind: resource.kind,
      amount: formatNumber(
        resource.amount ?? inventoryByType.get(resource.resourceType) ?? 0,
      ),
      rarity: resource.rarity,
    }));

  const resourceTypeWidth = Math.max(
    "RESOURCE TYPE".length,
    ...rows.map((row) => row.resourceType.length),
  );
  const displayNameWidth = Math.max(
    "DISPLAY NAME".length,
    ...rows.map((row) => row.displayName.length),
  );
  const kindWidth = Math.max(
    "KIND".length,
    ...rows.map((row) => row.kind.length),
  );
  const amountWidth = Math.max(
    "AMOUNT".length,
    ...rows.map((row) => row.amount.length),
  );

  const lines = [
    [
      "RESOURCE TYPE".padEnd(resourceTypeWidth),
      "DISPLAY NAME".padEnd(displayNameWidth),
      "KIND".padEnd(kindWidth),
      "AMOUNT".padEnd(amountWidth),
      "RARITY",
    ].join("   "),
  ];

  for (const row of rows) {
    lines.push(
      [
        row.resourceType.padEnd(resourceTypeWidth),
        row.displayName.padEnd(displayNameWidth),
        row.kind.padEnd(kindWidth),
        row.amount.padEnd(amountWidth),
        row.rarity,
      ].join("   "),
    );
  }

  return lines.join("\n");
}

export function formatBlueprint(blueprint: ProductionBlueprint): string {
  const lines = [
    blueprint.displayName,
    "",
    "Overview",
    `blueprintId: ${blueprint.blueprintId}`,
    `id: ${blueprint.id}`,
    `status: ${blueprint.status}`,
    `buildTicks: ${blueprint.buildTicks}`,
    `repeatable: ${blueprint.repeatable}`,
    `description: ${blueprint.description}`,
    "",
    "Production",
  ];

  appendStructuredValue(lines, "output", blueprint.output);
  appendStructuredValue(lines, "inputs", blueprint.inputs);
  appendStructuredValue(lines, "productionCost", blueprint.productionCost ?? null);
  appendStructuredValue(lines, "requiredFacility", blueprint.requiredFacility ?? null);
  appendStructuredValue(lines, "target", blueprint.target ?? null);
  appendStructuredValue(lines, "facilityLevel", blueprint.facilityLevel ?? null);
  appendStructuredValue(lines, "attachmentPoints", blueprint.attachmentPoints ?? null);
  appendStructuredValue(lines, "attachmentRequirements", blueprint.attachmentRequirements ?? null);

  lines.push(
    "",
    "Progression",
    `prerequisites: ${formatStringList(blueprint.prerequisites)}`,
    `unlocks: ${formatStringList(blueprint.unlocks)}`,
    `level: ${blueprint.level ?? "null"}`,
    "",
    "Runtime",
    `capabilities: ${formatStringList(blueprint.capabilities)}`,
  );

  appendStructuredValue(lines, "runtimeAttributes", blueprint.runtimeAttributes ?? null);

  return lines.join("\n");
}

function appendStructuredValue(
  lines: string[],
  label: string,
  value: unknown,
  indent = "  ",
): void {
  lines.push(`${label}:`);
  appendStructuredChildLines(lines, value, indent);
}

function appendStructuredChildLines(
  lines: string[],
  value: unknown,
  indent: string,
): void {
  if (value === null || value === undefined) {
    lines.push(`${indent}null`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      lines.push(`${indent}[]`);
      return;
    }

    for (const item of value) {
      if (isPlainObject(item) || Array.isArray(item)) {
        lines.push(`${indent}-`);
        appendStructuredChildLines(lines, item, `${indent}  `);
      } else {
        lines.push(`${indent}- ${String(item)}`);
      }
    }
    return;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value);

    if (entries.length === 0) {
      lines.push(`${indent}{}`);
      return;
    }

    for (const [key, childValue] of entries) {
      if (isPlainObject(childValue) || Array.isArray(childValue)) {
        lines.push(`${indent}${key}:`);
        appendStructuredChildLines(lines, childValue, `${indent}  `);
      } else {
        lines.push(`${indent}${key}: ${String(childValue)}`);
      }
    }
    return;
  }

  lines.push(`${indent}${String(value)}`);
}

function formatStringList(values?: string[]): string {
  return values && values.length > 0 ? values.join(", ") : "null";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function buildInventoryQuantityMap(
  inventory: { resourceType: string; quantity: number }[],
): Map<string, number> {
  const inventoryByType = new Map<string, number>();

  for (const resource of inventory) {
    inventoryByType.set(
      resource.resourceType,
      (inventoryByType.get(resource.resourceType) ?? 0) + resource.quantity,
    );
  }

  return inventoryByType;
}
