# CLI REST Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Hono the exclusive owner of Kepler transport and SQLite persistence while preserving the CLI's registration, catalog, solar, module, inventory, power, tick, and construction behavior.

**Architecture:** Resource-shaped Hono routes delegate to the existing domain functions and return typed JSON. Focused CLI API modules call those routes; pure formatters and simulation functions remain local, with HTTP-backed default dependencies replacing direct Kepler and SQLite imports.

**Tech Stack:** TypeScript, Bun, Hono, Commander.js, Bun SQLite, Bun test

## Global Constraints

- Use Bun for dependency, script, test, and TypeScript commands.
- `src/api/client.ts` is the only CLI module that calls raw `fetch`.
- The backend is the only process that imports Kepler transport or SQLite state/persistence modules.
- The CLI retains beginner-friendly terminal formatting; backend responses remain structured JSON.
- Do not hard-code catalog or solar data.
- Keep tick and construction calculations in the CLI for this lab, but route all state and Kepler reads through HTTP.
- Log Habitat API requests and Kepler requests without logging tokens, authorization headers, or response bodies.
- Preserve unrelated worktree changes in `AGENTS.md`, `scripts/`, and `skills/`.

---

### Task 1: Shared Backend Errors, API Errors, and Request Logging

**Files:**
- Create: `src/server/errors.ts`
- Modify: `src/server/app.ts`
- Modify: `src/api/client.ts`
- Modify: `src/kepler/client.ts`
- Test: `src/server/app.test.ts`
- Test: `src/api/client.test.ts`
- Test: `src/kepler/client.test.ts`

**Interfaces:**
- Produces: `BackendHttpError`, `backendErrorHandler`, and structured `{ error: { code, message } }` responses.
- Produces: nested backend error extraction in `requestHabitatApiJson<T>()`.
- Produces: one `Habitat API METHOD PATH STATUS` line and outbound/response `Kepler METHOD PATH STATUS` lines.

- [ ] **Step 1: Write failing structured-error and logging tests**

```ts
test("returns structured JSON for backend errors", async () => {
  const app = createBackendApp({
    registration: {
      loadRegistrationState: async () => {
        throw new BackendHttpError(404, "registration_not_found", "No registration found.");
      },
      readApiToken: () => undefined,
    },
  });
  const response = await app.request("/registration");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "registration_not_found", message: "No registration found." },
  });
});

test("extracts a nested backend error message", async () => {
  await expect(requestHabitatApiJson("/modules", {
    fetchImpl: async () => new Response(JSON.stringify({
      error: { code: "module_not_found", message: "Module not found." },
    }), { status: 404 }),
  })).rejects.toThrow("Module not found.");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `bun test src/server/app.test.ts src/api/client.test.ts src/kepler/client.test.ts`

Expected: FAIL because `BackendHttpError`, nested error extraction, and request logging are absent.

- [ ] **Step 3: Implement the shared error contract and safe logging**

```ts
export class BackendHttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 500 | 502,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BackendHttpError";
  }
}

export function backendErrorHandler(error: Error, context: Context) {
  if (error instanceof BackendHttpError) {
    return context.json({ error: { code: error.code, message: error.message } }, error.status);
  }
  console.error(error);
  return context.json({
    error: { code: "internal_error", message: "The Habitat API could not complete the request." },
  }, 500);
}
```

Register Hono middleware in `createBackendApp` that records the method/path before `await next()` and logs the final status afterward. Update API error parsing to recognize a string `error`, nested `error.message`, top-level `message`, or plain text. Add injectable logging to `requestKeplerJson` tests and log only method, URL pathname, and status.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `bun test src/server/app.test.ts src/api/client.test.ts src/kepler/client.test.ts`

Expected: all focused tests pass with no token values in captured logs.

- [ ] **Step 5: Commit the shared infrastructure**

```bash
git add src/server/errors.ts src/server/app.ts src/server/app.test.ts src/api/client.ts src/api/client.test.ts src/kepler/client.ts src/kepler/client.test.ts
git commit -m "feat: add REST errors and proxy logging"
```

---

### Task 2: Registration Routes, Client Operations, and CLI Wiring

**Files:**
- Modify: `src/server/registration.ts`
- Modify: `src/server/types.ts`
- Create: `src/server/registration.test.ts`
- Modify: `src/api/registration.ts`
- Modify: `src/api/types.ts`
- Create: `src/api/registration.test.ts`
- Create: `src/registration/cli.ts`
- Create: `src/registration/cli.test.ts`
- Modify: `src/cli.ts`

**Interfaces:**
- Consumes: `registerKeplerHabitat`, `readKeplerHabitatStatus`, and `unregisterKeplerHabitat` only in backend route defaults.
- Produces: `POST /registration`, `GET /status`, and `DELETE /registration`.
- Produces: `createRegistration`, `readRegistrationStatus`, and `deleteRegistration` API functions.
- Produces: `registerRegistrationCommands(program, dependencies?)` for CLI wiring and tests.

- [ ] **Step 1: Write failing Hono route tests**

```ts
test("POST /registration registers through the backend", async () => {
  const app = createBackendApp({ registration: {
    loadRegistrationState: async () => undefined,
    readApiToken: () => undefined,
    registerHabitat: async (input) => habitatFixture({ displayName: input.displayName }),
    readStatus: async () => habitatFixture(),
    unregisterHabitat: async () => ({ keplerHabitat: habitatFixture(), remoteHabitatDeleted: true }),
  }});
  const response = await app.request("/registration", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName: "Cygnus Seven" }),
  });
  expect(response.status).toBe(201);
  expect(await response.json()).toMatchObject({
    registration: { displayName: "Cygnus Seven" },
  });
});
```

Add tests for live `GET /status`, missing status `404`, unregister success, stale unregister result, malformed JSON `400`, blank name `400`, and known duplicate/missing domain errors.

- [ ] **Step 2: Run registration route tests and verify RED**

Run: `bun test src/server/registration.test.ts`

Expected: FAIL because mutation and status routes do not exist.

- [ ] **Step 3: Implement registration routes and error mapping**

Extend `RegistrationRouteDependencies` with:

```ts
registerHabitat: typeof registerKeplerHabitat;
readStatus: typeof readKeplerHabitatStatus;
unregisterHabitat: typeof unregisterKeplerHabitat;
```

Return `{ registration: state }` for registration/status and `{ registration: result.keplerHabitat, remoteHabitatDeleted }` for delete. Translate known duplicate, missing, validation, and Kepler request errors into `BackendHttpError` statuses from the design.

- [ ] **Step 4: Verify backend registration routes are GREEN**

Run: `bun test src/server/registration.test.ts`

Expected: all route tests pass in-process without binding a port.

- [ ] **Step 5: Write failing API and CLI tests**

```ts
test("posts a registration name", async () => {
  const result = await createRegistration("Cygnus Seven", testOptions(({ input, init }) => {
    expect(input).toBe("http://localhost:8787/registration");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(JSON.stringify({ displayName: "Cygnus Seven" }));
    return jsonResponse({ registration: habitatFixture() }, 201);
  }));
  expect(result.registration.displayName).toBe("Cygnus Seven");
});
```

CLI tests must parse `register`, `status`, and `unregister` with injected API functions, assert current human-readable output, and assert no Kepler domain function is invoked.

- [ ] **Step 6: Run API and CLI tests and verify RED**

Run: `bun test src/api/registration.test.ts src/registration/cli.test.ts`

Expected: FAIL because the API mutations and focused registration command module are absent.

- [ ] **Step 7: Implement API operations and move Commander wiring**

```ts
export async function createRegistration(displayName: string): Promise<RegistrationStateResource> {
  return requestHabitatApiJson("/registration", { method: "POST", body: { displayName } });
}
export async function readRegistrationStatus(): Promise<RegistrationStateResource> {
  return requestHabitatApiJson("/status");
}
export async function deleteRegistration(): Promise<UnregisterResource> {
  return requestHabitatApiJson("/registration", { method: "DELETE" });
}
```

Move only registration command setup from `src/cli.ts` into `src/registration/cli.ts`. Keep terminal formatting in the CLI and use API response types that include full `KeplerHabitatState`.

- [ ] **Step 8: Verify registration end-to-end in-process**

Run: `bun test src/server/registration.test.ts src/api/registration.test.ts src/registration/cli.test.ts`

Expected: all registration tests pass.

- [ ] **Step 9: Commit registration migration**

```bash
git add src/server/registration.ts src/server/types.ts src/server/registration.test.ts src/api/registration.ts src/api/types.ts src/api/registration.test.ts src/registration/cli.ts src/registration/cli.test.ts src/cli.ts
git commit -m "feat: move registration through Habitat API"
```

---

### Task 3: Catalog and Solar Proxy Routes and CLI Clients

**Files:**
- Create: `src/server/catalog.ts`
- Create: `src/server/catalog.test.ts`
- Create: `src/server/solar.ts`
- Create: `src/server/solar.test.ts`
- Modify: `src/server/app.ts`
- Create: `src/api/catalog.ts`
- Create: `src/api/catalog.test.ts`
- Create: `src/api/solar.ts`
- Create: `src/api/solar.test.ts`
- Create: `src/kepler/format.ts`
- Modify: `src/kepler/index.ts`
- Modify: `src/kepler/cli.ts`
- Modify: `src/kepler/cli.test.ts`

**Interfaces:**
- Produces: catalog and solar Hono routes from the design.
- Produces: `readBlueprintCatalog`, `readBlueprint`, `readResourceCatalog`, and `readSolarIrradianceResource` API operations.
- Produces: pure formatter exports in `src/kepler/format.ts` with no Kepler client import.

- [ ] **Step 1: Write failing Hono proxy tests**

```ts
test("GET /catalog/blueprints delegates to Kepler domain data", async () => {
  const app = createBackendApp({ catalog: {
    listBlueprints: async () => [blueprintFixture()],
    findBlueprint: async () => blueprintFixture(),
    listResources: async () => [resourceFixture()],
  }});
  const response = await app.request("/catalog/blueprints");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ blueprints: [blueprintFixture()] });
});
```

Add route tests for encoded blueprint IDs, blueprint not found, resource catalog, solar response, and Kepler error mapping to `502`.

- [ ] **Step 2: Run route tests and verify RED**

Run: `bun test src/server/catalog.test.ts src/server/solar.test.ts`

Expected: FAIL because catalog and solar route modules are absent.

- [ ] **Step 3: Implement thin catalog and solar routes**

Use injectable dependencies with defaults from `src/kepler/index.ts`. Routes only wrap domain results in `{ blueprints }`, `{ blueprint }`, `{ resources }`, or `{ solarIrradiance }`; they do not contain catalog values.

- [ ] **Step 4: Verify proxy routes are GREEN**

Run: `bun test src/server/catalog.test.ts src/server/solar.test.ts`

Expected: all proxy route tests pass.

- [ ] **Step 5: Write failing API and CLI transport tests**

```ts
test("requests one encoded blueprint", async () => {
  await readBlueprint("solar array", testOptions(({ input }) => {
    expect(input).toBe("http://localhost:8787/catalog/blueprints/solar%20array");
    return jsonResponse({ blueprint: blueprintFixture() });
  }));
});
```

Update CLI tests so injected API operations feed existing formatters for blueprint list/show, resource list, and solar status.

- [ ] **Step 6: Run API and CLI tests and verify RED**

Run: `bun test src/api/catalog.test.ts src/api/solar.test.ts src/kepler/cli.test.ts`

Expected: FAIL because CLI defaults still call Kepler domain functions.

- [ ] **Step 7: Implement API modules and isolate pure formatters**

Move `formatBlueprintTable`, `formatBlueprint`, `formatResourceTable`, and `formatSolarIrradianceStatus` unchanged into `src/kepler/format.ts`; re-export them from `src/kepler/index.ts` for compatibility. Change `src/kepler/cli.ts` defaults to focused API functions while preserving dependency injection for tests.

- [ ] **Step 8: Verify catalog and solar CLI behavior**

Run: `bun test src/server/catalog.test.ts src/server/solar.test.ts src/api/catalog.test.ts src/api/solar.test.ts src/kepler/cli.test.ts src/kepler/index.test.ts`

Expected: all tests pass and formatter snapshots/text remain unchanged.

- [ ] **Step 9: Commit Kepler read migration**

```bash
git add src/server/catalog.ts src/server/catalog.test.ts src/server/solar.ts src/server/solar.test.ts src/server/app.ts src/api/catalog.ts src/api/catalog.test.ts src/api/solar.ts src/api/solar.test.ts src/kepler/format.ts src/kepler/index.ts src/kepler/cli.ts src/kepler/cli.test.ts
git commit -m "feat: proxy catalog and solar through Habitat API"
```

---

### Task 4: Module Resource Routes and CLI Operations

**Files:**
- Create: `src/server/modules.ts`
- Create: `src/server/modules.test.ts`
- Modify: `src/server/app.ts`
- Create: `src/api/modules.ts`
- Create: `src/api/modules.test.ts`
- Create: `src/modules/format.ts`
- Modify: `src/modules/index.ts`
- Modify: `src/modules/cli.ts`
- Modify: `src/modules/cli.test.ts`

**Interfaces:**
- Produces: list, replace, create, read, patch, and delete module routes.
- Produces: `readModules`, `replaceModules`, `createModuleResource`, `readModule`, `updateModuleResource`, and `deleteModuleResource` API operations.
- Produces: formatter-only imports for CLI module output.

- [ ] **Step 1: Write failing module route tests**

```ts
test("PUT /modules replaces SQLite-backed state", async () => {
  let saved: HabitatModule[] = [];
  const app = createBackendApp({ modules: moduleDependencies({
    saveModules: async (modules) => { saved = modules; },
  }) });
  const modules = [moduleFixture()];
  const response = await app.request("/modules", jsonRequest("PUT", { modules }));
  expect(response.status).toBe(200);
  expect(saved).toEqual(modules);
  expect(await response.json()).toEqual({ modules });
});
```

Add tests for list, create `201`, prefix show, ambiguous prefix `409`, missing `404`, partial update, delete returning the deleted module, and invalid collection/body `400`.

- [ ] **Step 2: Run module route tests and verify RED**

Run: `bun test src/server/modules.test.ts`

Expected: FAIL because module routes are absent.

- [ ] **Step 3: Implement module routes with domain delegation**

Use backend defaults from `src/modules/index.ts` and `src/modules/state.ts`. Validate arrays and object inputs at the route boundary. Resolve prefixes through `findModuleByPrefix`; capture the module before deletion so the response can include it.

- [ ] **Step 4: Verify module routes are GREEN**

Run: `bun test src/server/modules.test.ts`

Expected: all module route tests pass.

- [ ] **Step 5: Write failing module API and CLI tests**

```ts
test("deletes an encoded module id", async () => {
  await deleteModuleResource("module/a", testOptions(({ input, init }) => {
    expect(input).toBe("http://localhost:8787/modules/module%2Fa");
    expect(init?.method).toBe("DELETE");
    return jsonResponse({ module: moduleFixture() });
  }));
});
```

CLI tests cover list empty/non-empty, show missing, create options, partial update, delete confirmation, status update, and preserved formatted output with injected API dependencies.

- [ ] **Step 6: Run module API and CLI tests and verify RED**

Run: `bun test src/api/modules.test.ts src/modules/cli.test.ts`

Expected: FAIL because the focused client and HTTP-backed command defaults are absent.

- [ ] **Step 7: Implement module API operations and CLI migration**

```ts
export const readModules = () => requestHabitatApiJson<ModulesResource>("/modules");
export const replaceModules = (modules: HabitatModule[]) =>
  requestHabitatApiJson<ModulesResource>("/modules", { method: "PUT", body: { modules } });
```

Implement the item operations with encoded IDs. Move pure module formatting functions to `src/modules/format.ts` and re-export for compatibility. The CLI must call API operations only and keep runtime-attribute parsing locally.

- [ ] **Step 8: Verify module behavior and regressions**

Run: `bun test src/server/modules.test.ts src/api/modules.test.ts src/modules/cli.test.ts src/modules/index.test.ts`

Expected: all module tests pass.

- [ ] **Step 9: Commit module migration**

```bash
git add src/server/modules.ts src/server/modules.test.ts src/server/app.ts src/api/modules.ts src/api/modules.test.ts src/modules/format.ts src/modules/index.ts src/modules/cli.ts src/modules/cli.test.ts
git commit -m "feat: move module state through Habitat API"
```

---

### Task 5: Inventory Resource Routes and Add/Remove CLI Operations

**Files:**
- Modify: `src/inventory/index.ts`
- Modify: `src/inventory/index.test.ts`
- Create: `src/server/inventory.ts`
- Create: `src/server/inventory.test.ts`
- Modify: `src/server/app.ts`
- Create: `src/api/inventory.ts`
- Create: `src/api/inventory.test.ts`
- Create: `src/inventory/format.ts`
- Modify: `src/inventory/cli.ts`
- Modify: `src/inventory/cli.test.ts`

**Interfaces:**
- Produces: `adjustInventoryResource({ resourceType, quantityDelta, unit? })` domain operation.
- Produces: inventory list, replace, and signed-adjustment Hono routes.
- Produces: `readInventory`, `replaceInventory`, and `adjustInventory` API operations.

- [ ] **Step 1: Write a failing domain test for removal**

```ts
test("removes inventory without allowing a negative balance", async () => {
  const saved: HabitatInventoryResource[][] = [];
  const resource = await adjustInventoryResource(
    { resourceType: "steel", quantityDelta: -4 },
    inventoryDependencies([{ resourceType: "steel", quantity: 10, updatedAt: oldTime }], saved),
  );
  expect(resource.quantity).toBe(6);
  await expect(adjustInventoryResource(
    { resourceType: "steel", quantityDelta: -11 },
    inventoryDependencies([{ resourceType: "steel", quantity: 10, updatedAt: oldTime }], saved),
  )).rejects.toThrow("Cannot remove 11 steel; only 10 is available.");
});
```

- [ ] **Step 2: Run the inventory domain test and verify RED**

Run: `bun test src/inventory/index.test.ts`

Expected: FAIL because signed adjustment is absent.

- [ ] **Step 3: Implement signed inventory adjustment**

Validate a non-empty resource type and a finite non-zero delta. Positive deltas create or increment resources; negative deltas require an existing resource and sufficient quantity. Reuse `addInventoryResource` by delegating its positive behavior to the new operation.

- [ ] **Step 4: Verify inventory domain behavior is GREEN**

Run: `bun test src/inventory/index.test.ts`

Expected: add, remove, overdraw, and existing inventory tests pass.

- [ ] **Step 5: Write failing inventory route, API, and CLI tests**

```ts
test("PATCH /inventory/:resourceType applies a signed delta", async () => {
  const app = createBackendApp({ inventory: inventoryRouteDependencies() });
  const response = await app.request("/inventory/steel", jsonRequest("PATCH", {
    quantityDelta: -2,
  }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ resource: { resourceType: "steel" } });
});
```

Add tests for GET, PUT, positive adjustment, remove command negation, overdraw `409`, invalid quantity `400`, empty inventory output, and unchanged add output.

- [ ] **Step 6: Run inventory boundary tests and verify RED**

Run: `bun test src/server/inventory.test.ts src/api/inventory.test.ts src/inventory/cli.test.ts`

Expected: FAIL because routes, client operations, and remove command are absent.

- [ ] **Step 7: Implement inventory routes, client, formatter split, and CLI migration**

```ts
export const adjustInventory = (
  resourceType: string,
  quantityDelta: number,
  unit?: string,
) => requestHabitatApiJson<InventoryItemResource>(
  `/inventory/${encodeURIComponent(resourceType)}`,
  { method: "PATCH", body: { quantityDelta, unit } },
);
```

Move `formatInventoryTable` to `src/inventory/format.ts`. Add `inventory remove <resource-type> <quantity>` using the same positive parser as add and pass `-quantity` to the API.

- [ ] **Step 8: Verify inventory behavior and regressions**

Run: `bun test src/inventory/index.test.ts src/server/inventory.test.ts src/api/inventory.test.ts src/inventory/cli.test.ts`

Expected: all inventory tests pass.

- [ ] **Step 9: Commit inventory migration**

```bash
git add src/inventory/index.ts src/inventory/index.test.ts src/server/inventory.ts src/server/inventory.test.ts src/server/app.ts src/api/inventory.ts src/api/inventory.test.ts src/inventory/format.ts src/inventory/cli.ts src/inventory/cli.test.ts
git commit -m "feat: move inventory state through Habitat API"
```

---

### Task 6: HTTP-Backed Power and Tick Workflows

**Files:**
- Modify: `src/status/index.ts`
- Modify: `src/status/index.test.ts`
- Create: `src/status/cli.ts`
- Create: `src/status/cli.test.ts`
- Modify: `src/modules/cli.ts`
- Modify: `src/ticks/index.ts`
- Modify: `src/ticks/index.test.ts`
- Modify: `src/ticks/cli.test.ts`
- Modify: `src/cli.ts`

**Interfaces:**
- Consumes: `readModules`, `replaceModules`, and `readSolarIrradianceResource` API operations.
- Produces: HTTP-backed defaults for `readHabitatStatus` and `runPowerTicks`.
- Produces: `registerPowerCommands(program, dependencies?)` with `power overview`.

- [ ] **Step 1: Write failing default-adapter and power command tests**

```ts
test("power overview formats API-backed module state", async () => {
  const program = new Command();
  const log = mockConsoleLog();
  registerPowerCommands(program, {
    readStatus: async () => buildHabitatStatus([moduleFixture()]),
  });
  await program.parseAsync(["power", "overview"], { from: "user" });
  expect(log).toHaveBeenCalledWith(expect.stringContaining("totalPowerDrawKw:"));
});
```

Add a tick test that injects HTTP-shaped adapters, verifies modules and solar are read, and verifies exactly one final module collection is saved.

- [ ] **Step 2: Run power and tick tests and verify RED**

Run: `bun test src/status/index.test.ts src/status/cli.test.ts src/ticks/index.test.ts src/ticks/cli.test.ts`

Expected: FAIL because power command wiring and API-backed defaults are absent.

- [ ] **Step 3: Replace default state dependencies with API adapters**

```ts
const defaultDependencies: PowerTickDependencies = {
  loadModules: async () => (await readModules()).modules,
  saveModules: async (modules) => { await replaceModules(modules); },
  readSolarIrradiance: async () =>
    (await readSolarIrradianceResource()).solarIrradiance,
};
```

Apply the equivalent `readModules` adapter to `readHabitatStatus`. Add focused `power overview` command wiring and make `module status` reuse the same status API-backed calculation.

- [ ] **Step 4: Verify power and tick behavior is GREEN**

Run: `bun test src/status/index.test.ts src/status/cli.test.ts src/modules/cli.test.ts src/ticks/index.test.ts src/ticks/cli.test.ts`

Expected: all tests pass and tick summary output is unchanged.

- [ ] **Step 5: Commit simulation adapter migration**

```bash
git add src/status/index.ts src/status/index.test.ts src/status/cli.ts src/status/cli.test.ts src/modules/cli.ts src/ticks/index.ts src/ticks/index.test.ts src/ticks/cli.test.ts src/cli.ts
git commit -m "feat: run power and ticks through API state"
```

---

### Task 7: HTTP-Backed Construction Workflows

**Files:**
- Modify: `src/construct/index.ts`
- Modify: `src/construct/index.test.ts`
- Modify: `src/construct/cli.test.ts`

**Interfaces:**
- Consumes: `readBlueprint`, `readModules`, `replaceModules`, `readInventory`, and `replaceInventory`.
- Preserves: `evaluateConstructionDryRun`, `startConstruction`, `readConstructionStatus`, and `cancelConstruction` public signatures and formatting.

- [ ] **Step 1: Write failing tests for API-shaped default adapters and rollback**

```ts
test("restores inventory when the module API write fails", async () => {
  const savedInventory: HabitatInventoryResource[][] = [];
  await expect(startConstruction("small-solar-array", {
    findBlueprint: async () => blueprintFixture(),
    loadModules: async () => constructionModules(),
    loadInventory: async () => constructionInventory(),
    saveInventory: async (inventory) => { savedInventory.push(inventory); },
    saveModules: async () => { throw new Error("module API unavailable"); },
    now: () => fixedTime,
  })).rejects.toThrow("module API unavailable");
  expect(savedInventory).toHaveLength(2);
  expect(savedInventory[1]).toEqual(constructionInventory());
});
```

Add dependency-wiring tests for dry-run reads, construction status reads, start writes, and cancel writes.

- [ ] **Step 2: Run construction tests and verify RED where defaults are inspected**

Run: `bun test src/construct/index.test.ts src/construct/cli.test.ts`

Expected: FAIL because production defaults still import Kepler and SQLite-backed functions.

- [ ] **Step 3: Replace construction defaults with focused API adapters**

```ts
const defaultDependencies: ConstructDependencies = {
  findBlueprint: async (blueprintId) => (await readBlueprint(blueprintId)).blueprint,
  loadModules: async () => (await readModules()).modules,
  loadInventory: async () => (await readInventory()).inventory,
};

const defaultStartDependencies: ConstructStartDependencies = {
  ...defaultDependencies,
  saveModules: async (modules) => { await replaceModules(modules); },
  saveInventory: async (inventory) => { await replaceInventory(inventory); },
  now: () => new Date().toISOString(),
};
```

Use the same module adapters for cancellation. Keep pure construction logic and output formatters unchanged.

- [ ] **Step 4: Verify construction behavior is GREEN**

Run: `bun test src/construct/index.test.ts src/construct/cli.test.ts src/ticks/index.test.ts`

Expected: all construction and construction-advancing tick tests pass.

- [ ] **Step 5: Prove the CLI tree has no direct transport or persistence imports**

Run: `rg -n 'from "../(kepler/client|.*state|persistence)|from "./(kepler/client|.*state|persistence)' src/cli.ts src/*/cli.ts src/status/index.ts src/ticks/index.ts src/construct/index.ts`

Expected: no matches. Imports of focused `src/api/*`, pure formatters, types, and calculations are allowed.

- [ ] **Step 6: Commit construction migration**

```bash
git add src/construct/index.ts src/construct/index.test.ts src/construct/cli.test.ts
git commit -m "feat: run construction through API state"
```

---

### Task 8: Full Automated and Real-Process Verification

**Files:**
- Modify: `src/server/index.test.ts` only if startup logging needs coverage.
- Create: `docs/rest-verification.md` containing the exact commands and observed results from this environment.

**Interfaces:**
- Consumes: complete server and CLI behavior from Tasks 1-7.
- Produces: observable evidence for direct REST, CLI-to-Habitat API, and Habitat API-to-Kepler traffic.

- [ ] **Step 1: Run the complete automated suite**

Run: `bun test`

Expected: zero failures across all test files.

- [ ] **Step 2: Run TypeScript and patch checks**

Run: `bun run check`

Expected: exit status 0 with no TypeScript errors.

Run: `git diff --check`

Expected: exit status 0.

- [ ] **Step 3: Start a real local server and capture its PID/log**

Run in terminal one:

```bash
HABITAT_SQLITE_PATH=/tmp/habitat-rest-verification.sqlite HABITAT_API_HOST=127.0.0.1 HABITAT_API_PORT=18787 bun run server 2>&1 | tee /tmp/habitat-api-rest-split.log
```

Expected: `Habitat API listening on http://127.0.0.1:18787`. The temporary SQLite path keeps verification mutations out of the normal project state.

- [ ] **Step 4: Call a backend route directly**

Run in terminal two:

```bash
curl --fail-with-body http://127.0.0.1:18787/registration
```

Expected: structured JSON containing a `registration` property.

- [ ] **Step 5: Exercise real CLI commands through the server**

Run with `HABITAT_API_BASE_URL=http://127.0.0.1:18787`:

```bash
export HABITAT_API_BASE_URL=http://127.0.0.1:18787
bun run ./src/cli.ts blueprint list
bun run ./src/cli.ts blueprint show small-solar-array
bun run ./src/cli.ts resource list
bun run ./src/cli.ts solar status
bun run ./src/cli.ts status
bun run ./src/cli.ts module list
bun run ./src/cli.ts inventory list
bun run ./src/cli.ts power overview
```

Expected: catalog and solar commands print formatted live Kepler data; local-state commands print empty-state output; status prints the friendly missing-registration error through the API.

- [ ] **Step 6: Exercise reversible state-changing CLI workflows**

Seed the isolated backend with construction-capable state through the collection routes:

```bash
curl --fail-with-body -X PUT http://127.0.0.1:18787/modules -H 'Content-Type: application/json' --data '{"modules":[{"id":"workshop-fabricator-1","blueprintId":"workshop-fabricator","displayName":"Workshop Fabricator","connectedTo":[],"runtimeAttributes":{"status":"active","powerDrawKw":{"offline":0,"online":1,"active":8}},"capabilities":[],"source":"local","createdAt":"2026-07-12T00:00:00.000Z","updatedAt":"2026-07-12T00:00:00.000Z"},{"id":"supply-cache-1","blueprintId":"supply-cache","displayName":"Supply Cache","connectedTo":[],"runtimeAttributes":{"status":"online"},"capabilities":["solar-construction"],"source":"local","createdAt":"2026-07-12T00:00:00.000Z","updatedAt":"2026-07-12T00:00:00.000Z"}]}'
curl --fail-with-body -X PUT http://127.0.0.1:18787/inventory -H 'Content-Type: application/json' --data '{"inventory":[{"resourceType":"steel","quantity":100,"unit":"kg","updatedAt":"2026-07-12T00:00:00.000Z"},{"resourceType":"electronics","quantity":100,"unit":"units","updatedAt":"2026-07-12T00:00:00.000Z"}]}'
```

Run with `HABITAT_API_BASE_URL=http://127.0.0.1:18787`:

```bash
export HABITAT_API_BASE_URL=http://127.0.0.1:18787
bun run ./src/cli.ts module list
bun run ./src/cli.ts module show workshop-fabricator-1
bun run ./src/cli.ts module create --blueprint-id rest-verification --name "REST Verification Module" | tee /tmp/rest-module-create.txt
bun run ./src/cli.ts module update workshop-fabricator-1 --name "Workshop Fabricator"
created_module_id="$(sed -n 's/^id: //p' /tmp/rest-module-create.txt)"
bun run ./src/cli.ts module delete "$created_module_id"
bun run ./src/cli.ts inventory add steel 5 --unit kg
bun run ./src/cli.ts inventory remove steel 5
bun run ./src/cli.ts inventory list
bun run ./src/cli.ts power overview
bun run ./src/cli.ts tick 60
bun run ./src/cli.ts construct small-solar-array --dry-run
bun run ./src/cli.ts construct small-solar-array
bun run ./src/cli.ts construction status
bun run ./src/cli.ts construction cancel workshop-fabricator-1
```

Expected: create/show/update/delete preserve readable output; inventory returns to its prior quantity; tick persists module state; construction starts, appears in status, and is cancelled through API-backed state.

- [ ] **Step 7: Confirm two-layer proxy logs**

Run: `rg -n "Habitat API|Kepler" /tmp/habitat-api-rest-split.log`

Expected: a Kepler-backed CLI command produces at least one `Habitat API` request/response line and corresponding `Kepler` outbound/response lines.

- [ ] **Step 8: Stop the verification server**

Send Control-C only to the terminal process started in Step 3. Confirm port 18787 is no longer listening.

- [ ] **Step 9: Record evidence and future cleanup discussion**

Write `docs/rest-verification.md` with the server address, direct curl JSON shape, CLI commands and outcomes, representative redacted Habitat API/Kepler log lines, automated test totals, and these future moves:

```md
- Move tick execution to `POST /ticks` so calculation and module persistence are one backend operation.
- Move construction start/cancel behind backend routes so module and inventory writes share one SQLite transaction.
- Move power overview and module status transitions behind backend domain resources.
- Replace broad collection `PUT` operations with versioned or operation-specific writes to prevent lost updates.
```

- [ ] **Step 10: Commit verification evidence**

```bash
git add docs/rest-verification.md src/server/index.test.ts
git commit -m "test: verify CLI REST split end to end"
```
