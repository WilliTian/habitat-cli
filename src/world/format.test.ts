import { expect, test } from "bun:test";

import { formatScanSummary, formatSingleTileScan } from "./format";
import type { WorldScanTile } from "../kepler/types";

const tile: WorldScanTile = {
  x: 3,
  y: -2,
  terrain: "flat",
  distanceTiles: 0,
  probabilities: [
    { resourceType: "ferrite", probabilityPct: 74 },
    { resourceType: null, probabilityPct: 26 },
  ],
  topCandidate: { resourceType: "ferrite", probabilityPct: 74 },
  quantityEstimate: {
    resourceType: "ferrite",
    unit: "kg",
    estimatedKg: 120,
    minimumKg: 80,
    maximumKg: 160,
    exact: false,
  },
};

test("formats one tile with every probability and quantity estimate", () => {
  const formatted = formatSingleTileScan(tile);

  expect(formatted).toContain("ferrite");
  expect(formatted).toContain("none: 26%");
  expect(formatted).toContain("estimatedKg: 120");
  expect(formatted).toContain("minimumKg: 80");
  expect(formatted).toContain("maximumKg: 160");
});

test("labels a missing single-tile quantity estimate as none", () => {
  expect(formatSingleTileScan({ ...tile, quantityEstimate: null })).toContain(
    "quantityEstimate: none",
  );
});

test("formats a multi-tile summary table", () => {
  const formatted = formatScanSummary([tile, { ...tile, x: 4, distanceTiles: 1 }]);

  expect(formatted).toContain("TOP CANDIDATE");
  expect(formatted).toContain("ESTIMATED QUANTITY");
  expect(formatted).toContain("ferrite (74%)");
  expect(formatted).toContain("120 kg");
});
