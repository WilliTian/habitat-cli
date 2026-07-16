export type EvaState = {
  deployedHumanId: string | null;
  x: number;
  y: number;
  carriedResources: Record<string, number>;
  maxCarryingCapacityKg: number;
};

export type WorldSector = { minX: number; maxX: number; minY: number; maxY: number };
