# World Resource Scan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only local Habitat API resource scan that supplies the saved registration's habitat ID to Kepler.

**Architecture:** A focused CLI API adapter calls `GET /world/scan` on the local Hono app. The route validates all scan values, loads the saved registration, then delegates to a Kepler domain operation that builds the Kepler query and returns the upstream response unchanged.

**Tech Stack:** TypeScript, Bun test, Hono, Commander, native `fetch` through the existing Habitat and Kepler clients.

## Global Constraints

- The runtime path is Habitat CLI -> local Habitat API -> Kepler World.
- The CLI must not import Kepler transport, use raw `fetch`, accept a habitat ID, or expose a Kepler token.
- The local API loads the saved registration and supplies `habitatId`.
- `x`, `y`, `sensorStrength`, and `radiusTiles` are required integers; sensor strength is 0–100 and radius is 0–5.
- The route is read-only and returns Kepler's successful response unchanged.
- Preserve the existing `502 kepler_request_failed` error contract.

---

### Task 1: Define Kepler scan types and domain request

**Files:**

- Modify: `src/kepler/types.ts`
- Modify: `src/kepler/index.ts`
- Modify: `src/kepler/index.test.ts`

**Interfaces:**

- Produces `WorldScanInput`, `WorldScanResponse`, and `scanWorldResources(input)`.
- Consumes the established `requestKeplerJson` dependency injection seam.

- [ ] **Step 1: Write the failing Kepler-domain test**

```ts
test("scans Kepler world tiles with the saved habitat id and scan inputs", async () => {
  const response = {
    scan: {
      modelVersion: "resource-probability-v2",
      origin: { x: 2, y: -1 }, sensorStrength: 40, radiusTiles: 1, tiles: [],
    },
  } satisfies WorldScanResponse;
  const requests: string[] = [];

  await expect(scanWorldResources(
    { habitatId: "habitat-1", x: 2, y: -1, sensorStrength: 40, radiusTiles: 1 },
    { requestKeplerJson: async (path) => { requests.push(path); return response; } },
  )).resolves.toEqual(response);

  expect(requests).toEqual([
    "/world/scan?habitatId=habitat-1&x=2&y=-1&sensorStrength=40&radiusTiles=1",
  ]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/kepler/index.test.ts`

Expected: FAIL with an import or undefined-symbol error for `scanWorldResources` or `WorldScanResponse`.

- [ ] **Step 3: Add exact Kepler response types and minimal operation**

```ts
export type WorldScanInput = {
  habitatId: string;
  x: number;
  y: number;
  sensorStrength: number;
  radiusTiles: number;
};

export type WorldScanResponse = {
  scan: {
    modelVersion: "resource-probability-v2";
    origin: { x: number; y: number };
    sensorStrength: number;
    radiusTiles: number;
    tiles: WorldScanTile[];
  };
};
```

Define `WorldScanTile`, `WorldScanProbability`, and nullable `WorldScanQuantityEstimate` with the fields in the approved contract. In `src/kepler/index.ts`, make `scanWorldResources` build query parameters in contract order and call:

```ts
return dependencies.requestKeplerJson<WorldScanResponse>(`/world/scan?${params}`, {
  method: "GET", expectedStatus: 200,
});
```

- [ ] **Step 4: Verify the focused Kepler-domain test passes**

Run: `bun test src/kepler/index.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain operation**

```bash
git add src/kepler/types.ts src/kepler/index.ts src/kepler/index.test.ts
git commit -m "feat: add Kepler world scan operation"
```

### Task 2: Add the local scan route and registration-backed forwarding

**Files:**

- Create: `src/server/world.ts`
- Create: `src/server/world.test.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/app.test.ts`

**Interfaces:**

- Consumes `scanWorldResources(input: WorldScanInput)` and `loadRegistrationState()`.
- Produces `registerWorldRoutes(app, dependencies)` and `GET /world/scan`.

- [ ] **Step 1: Write failing route tests**

```ts
test("GET /world/scan loads the registration and returns Kepler's response unchanged", async () => {
  const scan = { scan: { modelVersion: "resource-probability-v2", origin: { x: 1, y: 2 }, sensorStrength: 50, radiusTiles: 1, tiles: [] } };
  const inputs: unknown[] = [];
  const app = createBackendApp({ logger: () => {}, world: {
    loadRegistrationState: async () => registrationFixture(),
    scanWorldResources: async (input) => { inputs.push(input); return scan; },
  }});

  const response = await app.request("/world/scan?x=1&y=2&sensorStrength=50&radiusTiles=1");
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(scan);
  expect(inputs).toEqual([{ habitatId: "habitat-1", x: 1, y: 2, sensorStrength: 50, radiusTiles: 1 }]);
});
```

Also add cases for each missing/invalid/non-integer/bounds violation returning `400 invalid_world_scan`, no saved registration returning `404 registration_not_found`, and a Kepler failure returning `502 kepler_request_failed`. Add an app smoke test proving the route is registered.

- [ ] **Step 2: Run the route tests to verify they fail**

Run: `bun test src/server/world.test.ts src/server/app.test.ts`

Expected: FAIL because `world.ts` and `BackendAppDependencies.world` do not exist.

- [ ] **Step 3: Implement the route and app registration**

Create `registerWorldRoutes` with dependencies:

```ts
export type WorldRouteDependencies = {
  loadRegistrationState: () => Promise<KeplerHabitatState | undefined>;
  scanWorldResources: typeof scanWorldResources;
};
```

Parse `context.req.query()` with a helper that accepts only canonical integer strings, then enforce both inclusive bounds. On no registration, throw:

```ts
new BackendHttpError(404, "registration_not_found", "No Kepler habitat registration was found.")
```

Forward `{ habitatId: registration.habitatId, ...scanInput }`; return `context.json(scan)`. Translate errors beginning `Kepler request failed` or `Missing Kepler auth token` to the existing 502 error. Register this route in `createBackendApp` and add optional `world` dependencies to `BackendAppDependencies`.

- [ ] **Step 4: Verify local route tests pass**

Run: `bun test src/server/world.test.ts src/server/app.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the local API route**

```bash
git add src/server/world.ts src/server/world.test.ts src/server/app.ts src/server/app.test.ts
git commit -m "feat: proxy world resource scans through Habitat API"
```

### Task 3: Add the focused CLI-facing API adapter

**Files:**

- Create: `src/api/world.ts`
- Create: `src/api/world.test.ts`

**Interfaces:**

- Consumes `requestHabitatApiJson`.
- Produces `scanWorld(input, options?)`, with no Kepler transport dependency.

- [ ] **Step 1: Write a failing adapter test**

```ts
test("requests the local world scan endpoint with scan query parameters", async () => {
  const result = await scanWorld(
    { x: 2, y: -1, sensorStrength: 40, radiusTiles: 1 },
    testOptions((input, init) => {
      expect(input).toBe("http://localhost:8787/world/scan?x=2&y=-1&sensorStrength=40&radiusTiles=1");
      expect(init?.method).toBe("GET");
      return Promise.resolve(new Response(JSON.stringify({ scan: { tiles: [] } })));
    }),
  );
  expect(result).toEqual({ scan: { tiles: [] } });
});
```

- [ ] **Step 2: Run the adapter test to verify it fails**

Run: `bun test src/api/world.test.ts`

Expected: FAIL because `src/api/world.ts` does not exist.

- [ ] **Step 3: Implement the focused adapter**

```ts
export function scanWorld(input: WorldScanCommandInput, options?: HabitatApiRequestOptions) {
  const query = new URLSearchParams({
    x: String(input.x), y: String(input.y),
    sensorStrength: String(input.sensorStrength), radiusTiles: String(input.radiusTiles),
  });
  return requestHabitatApiJson<WorldScanResponse>(`/world/scan?${query}`, options);
}
```

Use an adapter-local input type that excludes `habitatId` and imports only scan response types.

- [ ] **Step 4: Verify the adapter test passes**

Run: `bun test src/api/world.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the CLI API adapter**

```bash
git add src/api/world.ts src/api/world.test.ts
git commit -m "feat: add local API world scan adapter"
```

### Task 4: Verify the completed read-only path

**Files:**

- Modify: no production files unless verification exposes a defect

**Interfaces:**

- Verifies CLI-facing code reaches only the local API adapter and the backend alone imports Kepler transport.

- [ ] **Step 1: Run the focused suites**

Run: `bun test src/kepler/index.test.ts src/server/world.test.ts src/server/app.test.ts src/api/world.test.ts`

Expected: PASS with no failures.

- [ ] **Step 2: Run the full suite and type check**

Run: `bun test && bun run check && git diff --check`

Expected: all tests pass, TypeScript exits 0, and diff check has no output.

- [ ] **Step 3: Confirm the CLI boundary remains transport-free**

Run: `rg -n "kepler/client|kepler/state|persistence|bun:sqlite|getPersistenceDatabase|fetch\\(" src/cli.ts src/**/cli.ts src/api`

Expected: no match in CLI entrypoints or `src/api`; `src/api/world.ts` uses only `requestHabitatApiJson`.

- [ ] **Step 4: Commit any verification-only corrections**

```bash
git add -u
git commit -m "test: verify world resource scan path"
```

