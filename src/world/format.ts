import type { WorldScanTile } from "../kepler/types";

export function formatSingleTileScan(tile: WorldScanTile, sensorStrength: number): string {
  const lines = [
    `coordinates: (${tile.x}, ${tile.y})`,
    `sensorStrength: ${sensorStrength}`,
    `terrain: ${tile.terrain}`,
    `distanceTiles: ${tile.distanceTiles}`,
    "probabilities:",
    ...tile.probabilities.map(
      (probability) => `  ${formatResourceType(probability.resourceType)}: ${probability.probabilityPct}%`,
    ),
    `probabilityTotal: ${formatProbabilityTotal(tile)}%`,
    `topCandidate: ${formatResourceType(tile.topCandidate.resourceType)} (${tile.topCandidate.probabilityPct}%)`,
  ];

  if (tile.topCandidate.resourceType === null || tile.quantityEstimate === null) {
    lines.push("quantityEstimate: none");
  } else {
    lines.push(
      "quantityEstimate:",
      `  resourceType: ${tile.quantityEstimate.resourceType}`,
      `  estimatedKg: ${tile.quantityEstimate.estimatedKg}`,
      `  minimumKg: ${tile.quantityEstimate.minimumKg}`,
      `  maximumKg: ${tile.quantityEstimate.maximumKg}`,
      `  exact: ${tile.quantityEstimate.exact}`,
    );
  }

  return lines.join("\n");
}

export function formatScanSummary(tiles: WorldScanTile[], sensorStrength: number): string {
  const rows = tiles.map((tile) => ({
    coordinates: `(${tile.x}, ${tile.y})`,
    distance: String(tile.distanceTiles),
    terrain: tile.terrain,
    topCandidate: `${formatResourceType(tile.topCandidate.resourceType)} (${tile.topCandidate.probabilityPct}%)`,
    estimatedQuantity: tile.topCandidate.resourceType === null || tile.quantityEstimate === null
      ? "none"
      : `${tile.quantityEstimate.estimatedKg} ${tile.quantityEstimate.unit}`,
  }));
  const widths = {
    coordinates: Math.max("COORDINATES".length, ...rows.map((row) => row.coordinates.length)),
    distance: Math.max("DISTANCE".length, ...rows.map((row) => row.distance.length)),
    terrain: Math.max("TERRAIN".length, ...rows.map((row) => row.terrain.length)),
    topCandidate: Math.max("TOP CANDIDATE".length, ...rows.map((row) => row.topCandidate.length)),
    estimatedQuantity: Math.max(
      "ESTIMATED QUANTITY".length,
      ...rows.map((row) => row.estimatedQuantity.length),
    ),
  };
  const formatRow = (row: typeof rows[number]) => [
    row.coordinates.padEnd(widths.coordinates),
    row.distance.padEnd(widths.distance),
    row.terrain.padEnd(widths.terrain),
    row.topCandidate.padEnd(widths.topCandidate),
    row.estimatedQuantity.padEnd(widths.estimatedQuantity),
  ].join("   ");

  return [
    `sensorStrength: ${sensorStrength}`,
    [
      "COORDINATES".padEnd(widths.coordinates),
      "DISTANCE".padEnd(widths.distance),
      "TERRAIN".padEnd(widths.terrain),
      "TOP CANDIDATE".padEnd(widths.topCandidate),
      "ESTIMATED QUANTITY".padEnd(widths.estimatedQuantity),
    ].join("   "),
    ...rows.map(formatRow),
  ].join("\n");
}

function formatProbabilityTotal(tile: WorldScanTile): string {
  return Number(tile.probabilities.reduce(
    (total, probability) => total + probability.probabilityPct,
    0,
  ).toFixed(6)).toString();
}

function formatResourceType(resourceType: string | null): string {
  return resourceType ?? "none";
}
