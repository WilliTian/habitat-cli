import { requestHabitatApiJson } from "./client";
import type { EvaState } from "../eva/types";
export const readEva = () => requestHabitatApiJson<{ eva: EvaState }>("/eva");
export const deployEva = (humanId: string) => requestHabitatApiJson<{ eva: EvaState }>("/eva/deploy", { method: "POST", body: { humanId } });
export const moveEva = (x: number, y: number) => requestHabitatApiJson<{ eva: EvaState }>("/eva/move", { method: "POST", body: { x, y } });
export const dockEva = () => requestHabitatApiJson<{ eva: EvaState }>("/eva/dock", { method: "POST" });
