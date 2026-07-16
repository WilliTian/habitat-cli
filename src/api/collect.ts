import { requestHabitatApiJson } from "./client";
import type { EvaState } from "../eva/types";
export function collectResource(quantityKg: number): Promise<{ eva: EvaState }> {
  return requestHabitatApiJson("/collect", { method: "POST", body: { quantityKg } });
}
