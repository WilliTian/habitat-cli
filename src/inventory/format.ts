import type { HabitatInventoryResource } from "./types";

export function formatInventoryTable(resources: HabitatInventoryResource[]): string {
  const rows = resources
    .slice()
    .sort((left, right) => left.resourceType.localeCompare(right.resourceType))
    .map((resource) => ({
      resourceType: resource.resourceType,
      quantity: formatNumber(resource.quantity),
      unit: resource.unit ?? "-",
    }));

  const resourceTypeWidth = Math.max(
    "RESOURCE TYPE".length,
    ...rows.map((row) => row.resourceType.length),
  );
  const quantityWidth = Math.max(
    "QUANTITY".length,
    ...rows.map((row) => row.quantity.length),
  );

  const lines = [[
    "RESOURCE TYPE".padEnd(resourceTypeWidth),
    "QUANTITY".padEnd(quantityWidth),
    "UNIT",
  ].join("   ")];

  for (const row of rows) {
    lines.push([
      row.resourceType.padEnd(resourceTypeWidth),
      row.quantity.padEnd(quantityWidth),
      row.unit,
    ].join("   "));
  }

  return lines.join("\n");
}

export function formatInventoryResource(resource: HabitatInventoryResource): string {
  return [
    `resourceType: ${resource.resourceType}`,
    `quantity: ${formatNumber(resource.quantity)}`,
    `unit: ${resource.unit ?? "-"}`,
    `updatedAt: ${resource.updatedAt}`,
  ].join("\n");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
