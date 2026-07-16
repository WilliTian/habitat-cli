# Habitat Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a React/TypeScript operations dashboard backed only by Hono REST, including authoritative power telemetry and tick execution.

**Architecture:** Hono gains a read-only power resource and serialized tick mutation resource, both using the existing tick domain code and persistence boundary. A Vite React application uses a typed browser API client and focused registration, telemetry, time-control, and module-list components; React contains no Habitat rules.

**Tech Stack:** Bun, TypeScript, Hono, Bun test, Vite, React, React DOM, CSS custom properties.

## Global Constraints

- The browser uses only Hono REST, never SQLite or Kepler.
- Server/domain code owns tick validation, power calculations, and persistence.
- Scope is registration, modules, power, solar, and ticks only.
- The dashboard supports light/dark themes, loading/empty/API-error states, and unregister confirmation.

---

## File structure

- `src/server/power.ts` and `src/server/power.test.ts`: Hono `GET /power` and `POST /ticks`.
- `src/ticks/index.ts`: reusable pure current-state power summary.
- `src/server/app.ts`: power route registration.
- `src/api/power.ts` and `src/api/power.test.ts`: typed REST wrappers.
- `web/`: Vite React application; `src/api.ts` owns browser requests and `src/dashboard.tsx` owns presentation state.

### Task 1: Establish authoritative power resources

**Files:** Create `src/server/power.ts`, `src/server/power.test.ts`; modify `src/server/app.ts`, `src/ticks/index.ts`.

**Interfaces:** `GET /power -> { summary: PowerTickSummary }`. `POST /ticks` accepts `{ tickCount: number }` and returns `PowerTickResult`. Route dependencies are `listModules`, `saveModules`, and `readSolarIrradiance`.

- [ ] **Step 1: Write failing route tests**

```ts
test("gets a summary without persisting", async () => {
  const saveModules = mock(async () => {});
  const app = createBackendApp({ power: { listModules: async () => [battery], saveModules, readSolarIrradiance: async () => sun } });
  expect((await app.request("/power")).status).toBe(200);
  expect(saveModules).not.toHaveBeenCalled();
});
test("persists tick result", async () => {
  const app = createBackendApp({ power: dependencies });
  const response = await app.request("/ticks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickCount: 60 }) });
  expect((await response.json()).summary.tickCount).toBe(60);
});
test.each([0, -1, 1.5, "60"])("rejects %p", async tickCount => {
  const response = await createBackendApp().request("/ticks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tickCount }) });
  expect(response.status).toBe(400);
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test src/server/power.test.ts`

Expected: missing route/module failures.

- [ ] **Step 3: Implement minimal routes**

```ts
app.get("/power", async c => {
  const [modules, solarIrradiance] = await Promise.all([deps.listModules(), deps.readSolarIrradiance()]);
  return c.json({ summary: readPowerSummary({ modules, solarIrradiance }) });
});
app.post("/ticks", async c => runMutation(async () => {
  const { tickCount } = await readTickInput(c.req.json());
  const [modules, solarIrradiance] = await Promise.all([deps.listModules(), deps.readSolarIrradiance()]);
  const result = applyPowerTicks({ modules, tickCount, solarIrradiance });
  await deps.saveModules(result.modules);
  return c.json(result);
}));
```

`readTickInput` rejects anything other than a safe integer greater than zero with `invalid_tick_count`; use the existing `BackendHttpError` and Kepler-error translation conventions.

- [ ] **Step 4: Verify GREEN**

Run: `bun test src/server/power.test.ts && bun test src/server/app.test.ts`

Expected: both command segments exit 0.

- [ ] **Step 5: Commit**

Run: `git add src/server/power.ts src/server/power.test.ts src/server/app.ts src/ticks/index.ts && git commit -m "feat: expose power and tick REST resources"`

### Task 2: Add typed REST wrappers

**Files:** Create `src/api/power.ts`, `src/api/power.test.ts`.

**Interfaces:** `readPowerResource(options?) -> Promise<{summary: PowerTickSummary}>`; `runPowerTicksResource(tickCount, options?) -> Promise<PowerTickResult>`.

- [ ] **Step 1: Write failing API client tests**

```ts
test("gets power", async () => {
  await readPowerResource({ fetchImpl });
  expect(fetchImpl).toHaveBeenCalledWith("http://localhost:8787/power", expect.anything());
});
test("posts ticks", async () => {
  await runPowerTicksResource(600, { fetchImpl });
  expect(fetchImpl).toHaveBeenCalledWith("http://localhost:8787/ticks", expect.objectContaining({ method: "POST", body: JSON.stringify({ tickCount: 600 }) }));
});
```

- [ ] **Step 2: Verify RED**

Run: `bun test src/api/power.test.ts`

Expected: missing module/export failures.

- [ ] **Step 3: Implement thin wrappers**

```ts
export const readPowerResource = (options?: Options) => requestHabitatApiJson<PowerResource>("/power", options);
export const runPowerTicksResource = (tickCount: number, options?: Options) => requestHabitatApiJson<PowerTickResult>("/ticks", { ...options, method: "POST", body: { tickCount } });
```

- [ ] **Step 4: Verify and commit**

Run: `bun test src/api/power.test.ts && bun run check && git add src/api/power.ts src/api/power.test.ts && git commit -m "feat: add power REST client"`

Expected: tests and type check exit 0 before the commit command.

### Task 3: Scaffold browser client and dashboard state

**Files:** Create `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`, `web/index.html`, `web/src/main.tsx`, `web/src/api.ts`, `web/src/api.test.ts`, `web/src/types.ts`, `web/src/dashboard.tsx`.

**Interfaces:** Browser `api` exposes `loadDashboard`, `register`, `unregister`, `setModuleStatus`, and `runTicks`; `Dashboard` owns loading, action, refresh, and error state.

- [ ] **Step 1: Write failing browser client tests**

```ts
test("uses the Hono base URL", async () => {
  await api.runTicks(3600);
  expect(fetch).toHaveBeenCalledWith("http://localhost:8787/ticks", expect.objectContaining({ method: "POST" }));
});
test("shows structured API error text", async () => {
  fetch.mockResolvedValue(new Response(JSON.stringify({ error: { message: "invalid" } }), { status: 400 }));
  await expect(api.runTicks(0)).rejects.toThrow("invalid");
});
```

- [ ] **Step 2: Verify RED**

Run: `cd web && bun test src/api.test.ts`

Expected: missing app/client failures.

- [ ] **Step 3: Implement configuration and API client**

`VITE_HABITAT_API_BASE_URL` defaults to `http://localhost:8787`. `loadDashboard` requests `/registration`, `/modules`, and `/power`; updates use exactly the routes in the design. Status mutation copies the authoritative current `runtimeAttributes` and changes only `status`.

- [ ] **Step 4: Verify and commit**

Run: `cd web && bun test src/api.test.ts && bun run build && git add web && git commit -m "feat: scaffold Habitat dashboard"`

Expected: tests/build exit 0 before committing.

### Task 4: Build dashboard components and visual system

**Files:** Create `web/src/components/registration-panel.tsx`, `power-grid.tsx`, `time-controls.tsx`, `modules-list.tsx`, `web/src/dashboard.test.tsx`, `web/src/styles.css`; modify `web/src/dashboard.tsx`, `web/src/main.tsx`.

**Interfaces:** `RegistrationPanel` calls registration actions; `PowerGrid` renders API fields; `TimeControls` calls `onAdvance(tickCount)`; `ModulesList` calls `onStatusChange(module, status)`.

- [ ] **Step 1: Write failing interaction tests**

```tsx
test("renders registration form for an unregistered Habitat", async () => {
  render(<Dashboard api={unregisteredApi} />);
  expect(await screen.findByRole("textbox", { name: "Habitat name" })).toBeVisible();
});
test("confirms unregister before the delete request", async () => {
  render(<Dashboard api={registeredApi} />);
  await user.click(await screen.findByRole("button", { name: "Unregister habitat" }));
  expect(screen.getByText("This removes the Habitat registration.")).toBeVisible();
  expect(registeredApi.unregister).not.toHaveBeenCalled();
});
test("disables a tick button during mutation", async () => {
  render(<Dashboard api={pendingTickApi} />);
  await user.click(await screen.findByRole("button", { name: "Advance 60 ticks" }));
  expect(screen.getByRole("button", { name: "Advance 60 ticks" })).toBeDisabled();
});
```

- [ ] **Step 2: Verify RED**

Run: `cd web && bun test src/dashboard.test.tsx`

Expected: missing component failures.

- [ ] **Step 3: Implement components**

Use fourth-slide direction: restrained technical console, card grid, thin borders, restrained accent, high-contrast type. Theme tokens use `[data-theme="dark"]`, a system-preference default, and an explicit toggle. Render skeletons, no-module empty state, recoverable page API error, local mutation errors, all five tick controls, and an accessible two-stage unregister confirmation. Never calculate power values in React.

- [ ] **Step 4: Verify and commit**

Run: `cd web && bun test src/dashboard.test.tsx && bun run build && git add web/src && git commit -m "feat: add Habitat operations dashboard"`

Expected: tests/build exit 0 before committing.

### Task 5: Whole-project verification

- [ ] **Step 1: Run backend verification**

Run: `bun test && bun run check`

Expected: full Bun suite and TypeScript check exit 0.

- [ ] **Step 2: Run frontend verification**

Run: `cd web && bun test && bun run build`

Expected: all UI tests and Vite build exit 0.

- [ ] **Step 3: Inspect the running UI**

Start Hono and Vite, then inspect light/dark desktop and 390px layouts. Exercise registration, unregister confirmation, module status update, all preset ticks, invalid custom tick, no modules, and API errors.

- [ ] **Step 4: Commit verification fixes when present**

Run: `git add src/server src/ticks src/api web && git commit -m "fix: polish Habitat dashboard"`

Expected: create this commit only if the preceding verification added a fix.
