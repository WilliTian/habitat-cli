import type { Hono } from "hono";
import { BackendHttpError } from "./errors";
import { loadEvaState, deployEva, moveEva, dockEva } from "../eva";
export function registerEvaRoutes(app: Hono): void {
  app.get("/eva", async c => c.json({ eva: await loadEvaState() }));
  app.post("/eva/deploy", async c => { const b=await c.req.json().catch(()=>({})) as any; if(typeof b.humanId!=="string") throw new BackendHttpError(400,"invalid_eva_deploy","humanId is required."); try{return c.json({eva:await deployEva(b.humanId)});}catch(e){throw new BackendHttpError(409,"eva_invalid_state",e instanceof Error?e.message:"EVA operation failed.",{cause:e});} });
  app.post("/eva/move", async c => { const b=await c.req.json().catch(()=>({})) as any; if(!Number.isInteger(b.x)||!Number.isInteger(b.y)) throw new BackendHttpError(400,"invalid_eva_move","integer x and y are required."); try{return c.json({eva:await moveEva(b.x,b.y)});}catch(e){throw new BackendHttpError(409,"eva_invalid_move",e instanceof Error?e.message:"EVA move failed.",{cause:e});} });
  app.post("/eva/dock", async c => { try{return c.json({eva:await dockEva()});}catch(e){throw new BackendHttpError(409,"eva_invalid_dock",e instanceof Error?e.message:"EVA docking failed.",{cause:e});} });
}
