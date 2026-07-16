import { requestHabitatApiJson } from "./client"; import type { HabitatAlert } from "../kepler/types";
export const readAlerts=()=>requestHabitatApiJson<{alerts:HabitatAlert[]}>("/alerts"); export const acknowledgeAlert=(id:string)=>requestHabitatApiJson<{alert:HabitatAlert}>(`/alerts/${encodeURIComponent(id)}/acknowledge`,{method:"POST"});
