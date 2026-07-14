# Safe Learning Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit concise, safe terminal logs that show CLI-to-Habitat routes and Habitat-to-Kepler response statuses.

**Architecture:** Route handlers attach safe summaries to request-scoped context metadata owned by a focused logging module. One Hono middleware emits the standardized Habitat line, while the Kepler client emits one completion or transport-failure line per request.

**Tech Stack:** TypeScript, Bun, Hono, `bun:test`

## Global Constraints

- Habitat lines use `[habitat-api] METHOD /path -> summary`.
- Kepler lines use `[kepler] METHOD /path -> status` or `-> transport error`.
- Never log bearer tokens, API tokens, authorization headers, full request bodies, full response bodies, or raw error objects.
- Preserve all HTTP response bodies, status codes, and beginner-friendly CLI output.
- Use Bun for installation, scripts, and tests.
- Do not modify or commit the unrelated `AGENTS.md`, `scripts/`, or `skills/` workspace changes.

---

### Task 1: Central Habitat API Log Formatting

**Files:**
- Create: `src/server/logging.ts`
- Modify: `src/server/app.ts`
- Modify: `src/server/errors.ts`
- Modify: `src/server/registration.ts`
- Test: `src/server/app.test.ts`

**Interfaces:**
- Produces: `setHabitatApiSummary(context: Context, summary: string): void`
- Produces: `formatHabitatApiLog(context: Context): string`
- Consumes: the existing `BackendAppDependencies.logger` callback.

- [ ] **Step 1: Write failing middleware and error-summary tests**

Replace the old status-only logging test and add a safe error-code assertion:

```ts
test("logs a prefixed Habitat route summary", async () => {
  const messages: string[] = [];
  const app = createBackendApp({ logger: (message) => messages.push(message) });

  await app.request("/registration");

  expect(messages).toEqual(["[habitat-api] GET /registration -> not registered"]);
});

test("logs only the safe status and code for backend errors", async () => {
  const messages: string[] = [];
  const app = createBackendApp({
    logger: (message) => messages.push(message),
    registration: {
      loadRegistrationState: async () => {
        throw new BackendHttpError(404, "registration_not_found", "secret detail");
      },
      readApiToken: () => "api-token-secret",
    },
  });

  await app.request("/registration");

  expect(messages).toEqual([
    "[habitat-api] GET /registration -> 404 registration_not_found",
  ]);
  expect(messages.join(" ")).not.toContain("secret");
  expect(messages.join(" ")).not.toContain("api-token");
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `bun test src/server/app.test.ts`

Expected: FAIL because current output is `Habitat API GET /registration 200` and no request summary API exists.

- [ ] **Step 3: Add request-scoped summaries and centralized formatting**

Create `src/server/logging.ts`:

```ts
import type { Context } from "hono";

const summaries = new WeakMap<object, string>();

export function setHabitatApiSummary(context: Context, summary: string): void {
  summaries.set(context, summary);
}

export function formatHabitatApiLog(context: Context): string {
  const summary = summaries.get(context) ?? String(context.res.status);
  return `[habitat-api] ${context.req.method} ${context.req.path} -> ${summary}`;
}
```

Update the middleware in `src/server/app.ts`:

```ts
app.use("*", async (context, next) => {
  await next();
  logger(formatHabitatApiLog(context));
});
```

Update `backendErrorHandler` so known and unexpected failures attach safe summaries before returning JSON:

```ts
if (error instanceof BackendHttpError) {
  setHabitatApiSummary(context, `${error.status} ${error.code}`);
  return context.json({ error: { code: error.code, message: error.message } }, error.status);
}

setHabitatApiSummary(context, "500 internal_error");
```

Remove `console.error(error)` so raw errors cannot leak credentials or payloads.

- [ ] **Step 4: Add the registration summary needed by the middleware test**

In `GET /registration`, after loading state:

```ts
setHabitatApiSummary(
  context,
  registration ? `registered as ${registration.displayName}` : "not registered",
);
```

- [ ] **Step 5: Run focused tests and type checking**

Run: `bun test src/server/app.test.ts src/server/registration.test.ts`

Expected: PASS with one Habitat line per request and unchanged JSON assertions.

Run: `bun run check`

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/server/logging.ts src/server/app.ts src/server/errors.ts src/server/app.test.ts src/server/registration.ts
git commit -m "feat: add safe Habitat API request logs"
```

---

### Task 2: Route-Owned Domain Summaries

**Files:**
- Modify: `src/server/registration.ts`
- Modify: `src/server/modules.ts`
- Modify: `src/server/inventory.ts`
- Modify: `src/server/catalog.ts`
- Modify: `src/server/solar.ts`
- Test: `src/server/registration.test.ts`
- Test: `src/server/modules.test.ts`
- Test: `src/server/inventory.test.ts`
- Test: `src/server/catalog.test.ts`
- Test: `src/server/solar.test.ts`

**Interfaces:**
- Consumes: `setHabitatApiSummary(context, summary)` from Task 1.
- Produces: safe summaries for every successful registered route.

- [ ] **Step 1: Write failing summary tests for each route family**

Use each test app's injected logger and existing dependency fixtures. Assert representative output:

```ts
expect(messages).toContain("[habitat-api] GET /modules -> 1 module");
expect(messages).toContain("[habitat-api] PUT /modules -> saved 1 module");
expect(messages).toContain("[habitat-api] GET /inventory -> 1 resource");
expect(messages).toContain(
  "[habitat-api] PATCH /inventory/steel -> steel now 8",
);
expect(messages).toContain(
  "[habitat-api] GET /catalog/blueprints -> proxied to Kepler",
);
expect(messages).toContain(
  "[habitat-api] GET /solar/irradiance -> proxied to Kepler",
);
```

Add registration mutation assertions:

```ts
expect(messages).toContain(
  "[habitat-api] POST /registration -> registered Cygnus Seven",
);
expect(messages).toContain(
  "[habitat-api] DELETE /registration -> unregistered Cygnus Seven",
);
```

- [ ] **Step 2: Run route tests and verify RED**

Run:

```bash
bun test src/server/registration.test.ts src/server/modules.test.ts \
  src/server/inventory.test.ts src/server/catalog.test.ts src/server/solar.test.ts
```

Expected: FAIL because successful routes currently have only the Task 1 fallback or registration read summary.

- [ ] **Step 3: Attach registration summaries**

Set summaries only after successful operations:

```ts
setHabitatApiSummary(context, `registered ${registration.displayName}`);
setHabitatApiSummary(context, `status refreshed for ${registration.displayName}`);
setHabitatApiSummary(
  context,
  result.remoteHabitatDeleted
    ? `unregistered ${result.keplerHabitat.displayName}`
    : `cleared stale registration for ${result.keplerHabitat.displayName}`,
);
```

- [ ] **Step 4: Attach module and inventory summaries with singular/plural helpers**

Add local helpers such as:

```ts
function countLabel(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}
```

Set module summaries for list, replace, create, show, update, and delete. Set inventory summaries for list, replace, and adjustment. Use only counts, resource types, quantities, and module IDs already returned by the operation; never serialize the input or response object.

- [ ] **Step 5: Attach proxy summaries**

After successful catalog or solar domain calls:

```ts
setHabitatApiSummary(context, "proxied to Kepler");
```

Do not attach the proxy summary before the call; failures must retain the safe status/error-code summary from the error handler.

- [ ] **Step 6: Run route tests and full type checking**

Run the five route test files from Step 2.

Expected: PASS with unchanged response assertions and the new summary assertions.

Run: `bun run check`

Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/server/registration.ts src/server/registration.test.ts \
  src/server/modules.ts src/server/modules.test.ts \
  src/server/inventory.ts src/server/inventory.test.ts \
  src/server/catalog.ts src/server/catalog.test.ts \
  src/server/solar.ts src/server/solar.test.ts
git commit -m "feat: summarize Habitat API route outcomes"
```

---

### Task 3: Single-Line Kepler Logs And Verification

**Files:**
- Modify: `src/kepler/client.ts`
- Modify: `src/kepler/client.test.ts`
- Modify: `docs/rest-verification.md`

**Interfaces:**
- Consumes: the existing `KeplerRequestOptions.logger` callback.
- Produces: exactly one `[kepler] METHOD /path -> result` line for each request attempt that reaches transport.

- [ ] **Step 1: Replace Kepler log expectations with the new safe contract**

Update the successful request test:

```ts
expect(messages).toEqual(["[kepler] GET /base/habitats/123 -> 200"]);
expect(messages.join(" ")).not.toContain("secret-token");
```

Update the transport failure test:

```ts
expect(messages).toEqual(["[kepler] GET /habitats/123 -> transport error"]);
expect(messages.join(" ")).not.toContain("request body");
```

Add a non-success response test that returns a secret-bearing body but asserts the log contains only status:

```ts
const messages: string[] = [];
const request = requestKeplerJson("/habitats/123", {
  method: "GET",
  expectedStatus: 200,
  environment: { KEPLER_PLANET_TOKEN: "secret-token" },
  fetchImpl: async () => new Response("private response body", { status: 503 }),
  logger: (message) => messages.push(message),
});

await expect(request).rejects.toThrow("Kepler request failed with 503");
expect(messages).toEqual(["[kepler] GET /habitats/123 -> 503"]);
expect(messages.join(" ")).not.toContain("private response body");
```

- [ ] **Step 2: Run the Kepler client test and verify RED**

Run: `bun test src/kepler/client.test.ts`

Expected: FAIL because the current implementation emits separate outbound and response lines with the old prefix.

- [ ] **Step 3: Emit one safe Kepler result line**

Remove the outbound log. After `fetchImpl` resolves, emit:

```ts
logger(`[kepler] ${options.method} ${url.pathname} -> ${response.status}`);
```

In the fetch rejection catch, emit before throwing:

```ts
logger(`[kepler] ${options.method} ${url.pathname} -> transport error`);
```

Do not interpolate request headers, body values, response text, tokens, or error objects into either line.

- [ ] **Step 4: Run focused and full automated verification**

Run: `bun test src/kepler/client.test.ts`

Expected: PASS.

Run: `bun test`

Expected: all tests pass with zero failures.

Run: `bun run check`

Expected: exit 0.

Run: `git diff --check`

Expected: exit 0.

- [ ] **Step 5: Verify with a real server and CLI**

Start an isolated server in terminal one:

```bash
HABITAT_SQLITE_PATH=/tmp/habitat-safe-logs.sqlite \
HABITAT_API_HOST=127.0.0.1 \
HABITAT_API_PORT=18833 \
bun run server 2>&1 | tee /tmp/habitat-safe-logs.log
```

Run in terminal two:

```bash
HABITAT_API_BASE_URL=http://127.0.0.1:18833 bun run ./src/cli.ts module list
HABITAT_API_BASE_URL=http://127.0.0.1:18833 bun run ./src/cli.ts solar status
rg -n "\\[habitat-api\\]|\\[kepler\\]" /tmp/habitat-safe-logs.log
```

Expected representative lines:

```text
[habitat-api] GET /modules -> 0 modules
[kepler] GET /world/solar-irradiance -> 200
[habitat-api] GET /solar/irradiance -> proxied to Kepler
```

Confirm the log does not contain token values, `Authorization`, full JSON request bodies, or full JSON response bodies. Stop the server and confirm port 18833 has no listener.

- [ ] **Step 6: Record the observed logging evidence**

Update `docs/rest-verification.md` with the exact real-process commands, representative safe lines, final test totals, and the secret-exclusion check. Do not copy token values or payload bodies into the document.

- [ ] **Step 7: Commit**

```bash
git add src/kepler/client.ts src/kepler/client.test.ts docs/rest-verification.md
git commit -m "feat: add safe Kepler request logs"
```
