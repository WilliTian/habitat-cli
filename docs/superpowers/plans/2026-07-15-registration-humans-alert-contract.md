# Registration Humans And Alert Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve Kepler-provided starter humans and the registration alert contract as typed local data without adding user-facing human or alert behavior.

**Architecture:** Model the additional fields from Kepler's registration response. Store starter humans in a dedicated SQLite table, store `contracts.alerts` as typed registration metadata, and wire both into the existing registration and unregister flows. Status refresh retains local registration metadata because Kepler's registration GET does not include these fields.

**Tech Stack:** TypeScript, Bun, Bun SQLite, Bun test.

## Global Constraints

- Kepler's registration response is the only source of starter-human and alert-contract values.
- Do not hard-code human lists, module IDs, or alert contracts in production code.
- A human has `id`, `displayName`, and `locationModuleId`.
- Do not add CLI commands, local Hono endpoints, dashboard UI, exploration, collection, or alert lifecycle behavior.
- Preserve existing SQLite databases with an additive registration-column migration.

---

## Files

- Modify `src/kepler/types.ts` for shared registration types.
- Modify `src/kepler/index.ts` and `src/kepler/index.test.ts` for registration flow.
- Create `src/humans/index.ts` as the human domain boundary.
- Create `src/persistence/sqlite/humans-repository.ts` and its test.
- Modify SQLite schema, bootstrap, row types, registration repository, persistence adapter, and registration repository tests.

### Task 1: Define the Kepler registration contract

**Files:**
- Modify: `src/kepler/types.ts`
- Test: `src/kepler/index.test.ts`

**Produces:** `StarterHuman`, `AlertContract`, `RegistrationContracts`, and expanded registration/state types.

- [ ] **Step 1: Write the failing domain test**

Extend the existing Kepler registration fixture with this response data:

```ts
starterHumans: [
  { id: "human-1", displayName: "Alex Rivera", locationModuleId: "habitat_1_command_module_1" },
],
contracts: {
  alerts: {
    schemaVersion: "1.0",
    schema: { type: "object", required: ["id", "severity"] },
  },
},
```

Expect the saved registration state to contain `alertContract: response.contracts.alerts`.

- [ ] **Step 2: Verify RED**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/kepler/index.test.ts`

Expected: failure because the registration response and state types do not define these fields.

- [ ] **Step 3: Add the minimal types**

Add to `src/kepler/types.ts`:

```ts
export type StarterHuman = {
  id: string;
  displayName: string;
  locationModuleId: string;
};

export type AlertContract = {
  schemaVersion: string;
  schema: Record<string, unknown>;
};

export type RegistrationContracts = {
  alerts: AlertContract;
};
```

Require `starterHumans` and `contracts` on `HabitatRegistrationResponse`; add `alertContract: AlertContract` to `KeplerHabitatState`.

- [ ] **Step 4: Verify the test now fails only on missing persistence wiring**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/kepler/index.test.ts`

Expected: failure because the registration operation does not yet save the alert contract or humans.

### Task 2: Add human SQLite storage

**Files:**
- Modify: `src/persistence/sqlite/schema.ts`
- Modify: `src/persistence/sqlite/types.ts`
- Create: `src/persistence/sqlite/humans-repository.ts`
- Test: `src/persistence/sqlite/humans-repository.test.ts`
- Modify: `src/persistence/index.ts`

**Produces:** `loadHumansFromSqlite(database)` and `replaceHumansFromSqlite(database, humans)`.

- [ ] **Step 1: Write failing repository tests**

Create tests that use `openHabitatDatabase(":memory:")` and assert:

```ts
replaceHumansFromSqlite(database, [
  { id: "human-1", displayName: "Alex Rivera", locationModuleId: "command-module-1" },
]);
expect(loadHumansFromSqlite(database)).toEqual([
  { id: "human-1", displayName: "Alex Rivera", locationModuleId: "command-module-1" },
]);
```

Then replace that collection with a different human and assert only the replacement remains.

- [ ] **Step 2: Verify RED**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/persistence/sqlite/humans-repository.test.ts`

Expected: failure because the table and repository do not exist.

- [ ] **Step 3: Implement focused human persistence**

Add this table to the initial schema:

```sql
CREATE TABLE IF NOT EXISTS humans (
  id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  location_module_id TEXT NOT NULL
)
```

Add `HumanRow` to SQLite types. Implement a repository that loads ordered by `id` and replaces the whole collection inside `withTransaction`: delete all rows, then insert each `StarterHuman`. Add the matching `humans` adapter to `getPersistence`.

- [ ] **Step 4: Verify GREEN**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/persistence/sqlite/humans-repository.test.ts`

Expected: 2 passing tests.

### Task 3: Preserve the alert contract in registration state

**Files:**
- Modify: `src/persistence/sqlite/schema.ts`
- Modify: `src/persistence/sqlite/index.ts`
- Modify: `src/persistence/sqlite/types.ts`
- Modify: `src/persistence/sqlite/registration-repository.ts`
- Test: `src/persistence/sqlite/registration-repository.test.ts`

**Produces:** alert-contract round-trip persistence and a compatible migration for old databases.

- [ ] **Step 1: Write the failing round-trip test**

Add this state fixture property to the existing registration repository test:

```ts
alertContract: {
  schemaVersion: "1.0",
  schema: { type: "object", properties: { severity: { enum: ["warning", "critical"] } } },
},
```

Keep the existing exact equality assertion.

- [ ] **Step 2: Verify RED**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/persistence/sqlite/registration-repository.test.ts`

Expected: failure because `alertContract` is not saved or loaded.

- [ ] **Step 3: Add compatible schema and repository support**

Add nullable `alert_contract_json TEXT` to the fresh `registration` table. In `applySchema`, add an idempotent migration named `2026-07-15-registration-alert-contract`: inspect `PRAGMA table_info(registration)`, run `ALTER TABLE registration ADD COLUMN alert_contract_json TEXT` only when absent, and record the migration. Select, decode, insert, and encode the `AlertContract` in the registration repository. Preserve `null` for legacy rows.

- [ ] **Step 4: Verify GREEN**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/persistence/sqlite/registration-repository.test.ts`

Expected: all registration repository tests pass with nested JSON preserved exactly.

### Task 4: Wire the registration domain

**Files:**
- Create: `src/humans/index.ts`
- Modify: `src/kepler/index.ts`
- Test: `src/kepler/index.test.ts`

**Produces:** registration writes Kepler-provided humans and alert contract; unregister clears humans.

- [ ] **Step 1: Finish failing domain tests**

Inject a `replaceStarterHumans` dependency into registration tests and expect it to receive `response.starterHumans`. Add a status-refresh test whose loaded state has an `alertContract` and assert that the saved refreshed state retains it. Add an unregister `deleteHumans` double and assert it is called.

- [ ] **Step 2: Verify RED**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/kepler/index.test.ts`

Expected: failure because the dependencies and operations do not exist.

- [ ] **Step 3: Implement minimal wiring**

Create `src/humans/index.ts` with `loadHumans`, `replaceStarterHumans`, and `deleteHumans`, delegating to the human repository and `getPersistenceDatabase()`. In `registerKeplerHabitat`, replace humans using `response.starterHumans` and save `alertContract: response.contracts.alerts`. Add `deleteHumans` to unregister and call it alongside module/registration cleanup. Leave status-refresh logic otherwise unchanged so it retains the loaded alert contract.

- [ ] **Step 4: Verify GREEN**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/kepler/index.test.ts`

Expected: all Kepler-domain tests pass.

### Task 5: Verify the completed change

**Files:**
- No production changes expected.

- [ ] **Step 1: Run targeted tests**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun test src/persistence/sqlite/humans-repository.test.ts src/persistence/sqlite/registration-repository.test.ts src/kepler/index.test.ts`

Expected: all targeted tests pass.

- [ ] **Step 2: Run the full suite**

Run: `PATH=/home/willi/.bun/bin:$PATH HABITAT_API_BASE_URL=http://localhost:8787 /home/willi/.bun/bin/bun test`

Expected: all tests pass; the explicit URL preserves the existing default-URL assertion despite `.env`.

- [ ] **Step 3: Run static checks**

Run: `PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun run check`

Expected: TypeScript check exits successfully.

- [ ] **Step 4: Check whitespace**

Run: `git diff --check`

Expected: no whitespace errors.
