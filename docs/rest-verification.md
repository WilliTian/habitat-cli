# REST Split Verification

Verified on 2026-07-13 with Bun 1.3.14.

## Automated Checks

Commands:

```bash
bun test
bun run check
git diff --check
rg -n "kepler/client|kepler/state|persistence|modules/state|inventory/state|bun:sqlite|getPersistenceDatabase|fetch\\(" \
  src/cli.ts src/**/cli.ts src/status/index.ts src/ticks/index.ts src/construct/index.ts src/api
```

Observed results:

- `bun test`: 196 tests passed, 0 failed, across 32 files with 524 expectations.
- `bun run check`: exited successfully with no TypeScript errors.
- `git diff --check`: exited successfully with no whitespace errors.
- The CLI boundary scan printed no matches. CLI entrypoints, simulations, and API adapters do not import Kepler transport, SQLite state, or persistence, and do not issue raw `fetch` calls.

## Real Server And Direct REST

The main workflow used isolated state and a non-default port so verification did not alter normal project state:

```bash
HABITAT_SQLITE_PATH=/tmp/habitat-rest-verification-9405030.sqlite \
HABITAT_API_HOST=127.0.0.1 \
HABITAT_API_PORT=18787 \
bun run server 2>&1 | tee /tmp/habitat-api-rest-split.log
```

Observed startup output:

```text
Habitat API listening on http://127.0.0.1:18787
```

The direct route check ran from another terminal:

```bash
curl --fail-with-body http://127.0.0.1:18787/registration
```

Observed JSON:

```json
{"registration":null}
```

`GET /registration` includes `apiToken` when registration exists, as required by the lab contract. The API has no authentication, so do not set `HABITAT_API_HOST=0.0.0.0` on an untrusted network; any client that can reach the port can read that resource.

## Read-Only CLI Workflow

Commands:

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

Observed results:

- `blueprint list` returned 18 formatted live Kepler blueprints.
- `blueprint show small-solar-array` returned live production and runtime details.
- `resource list` returned the formatted live Kepler resource catalog.
- `solar status` reported clear sunlight and `900 W/m2`.
- `status` returned the expected friendly missing-registration error through the Habitat API.
- Empty module, inventory, and power commands retained their beginner-friendly output.

## State-Changing CLI Workflow

The live `small-solar-array` blueprint required ferrite, silicate glass, and conductive ore. The isolated backend was seeded with those current catalog inputs rather than the stale steel/electronics examples in the original checklist:

```bash
curl --fail-with-body -X PUT http://127.0.0.1:18787/modules \
  -H 'Content-Type: application/json' \
  --data '{"modules":[{"id":"workshop-fabricator-1","blueprintId":"workshop-fabricator","displayName":"Workshop Fabricator","connectedTo":[],"runtimeAttributes":{"status":"active","powerDrawKw":{"offline":0,"online":1,"active":8}},"capabilities":[],"source":"local","createdAt":"2026-07-13T00:00:00.000Z","updatedAt":"2026-07-13T00:00:00.000Z"},{"id":"supply-cache-1","blueprintId":"supply-cache","displayName":"Supply Cache","connectedTo":[],"runtimeAttributes":{"status":"online"},"capabilities":["solar-construction"],"source":"local","createdAt":"2026-07-13T00:00:00.000Z","updatedAt":"2026-07-13T00:00:00.000Z"}]}'

curl --fail-with-body -X PUT http://127.0.0.1:18787/inventory \
  -H 'Content-Type: application/json' \
  --data '{"inventory":[{"resourceType":"ferrite","quantity":100,"unit":"kg","updatedAt":"2026-07-13T00:00:00.000Z"},{"resourceType":"silicate-glass","quantity":100,"unit":"kg","updatedAt":"2026-07-13T00:00:00.000Z"},{"resourceType":"conductive-ore","quantity":100,"unit":"kg","updatedAt":"2026-07-13T00:00:00.000Z"}]}'
```

Commands:

```bash
export HABITAT_API_BASE_URL=http://127.0.0.1:18787
bun run ./src/cli.ts module list
bun run ./src/cli.ts module show workshop-fabricator-1
bun run ./src/cli.ts module create --blueprint-id rest-verification --name "REST Verification Module"
bun run ./src/cli.ts module update workshop-fabricator-1 --name "Workshop Fabricator"
bun run ./src/cli.ts module delete 087fd109-dcfd-4322-bd1d-f6b05ec8ef62
bun run ./src/cli.ts inventory add ferrite 5 --unit kg
bun run ./src/cli.ts inventory remove ferrite 5
bun run ./src/cli.ts inventory list
bun run ./src/cli.ts power overview
bun run ./src/cli.ts tick 60
bun run ./src/cli.ts construct small-solar-array --dry-run
bun run ./src/cli.ts construct small-solar-array
bun run ./src/cli.ts construction status
bun run ./src/cli.ts construction cancel workshop-fabricator-1
```

Observed results:

- Module list/show/create/update/delete completed through backend state. Create returned module id `087fd109-dcfd-4322-bd1d-f6b05ec8ef62`, which was then deleted.
- Inventory add/remove changed ferrite from 100 to 105 and back to 100.
- `power overview` reported 8 kW from the seeded workshop fabricator.
- `tick 60` read proxied solar data, calculated 0.133333 kWh demand, and persisted the module collection.
- Construction dry-run passed every readiness check.
- Construction start created job `small_solar_array_1`; status displayed 180 remaining ticks; cancel removed the active job.

## Correlated Proxy Evidence

A final isolated run used a fresh log and state file. After server readiness was checked, these client commands were the only requests made:

```bash
HABITAT_SQLITE_PATH=/tmp/habitat-rest-correlated.sqlite \
HABITAT_API_HOST=127.0.0.1 \
HABITAT_API_PORT=18831 \
bun run server > /tmp/habitat-api-correlated.log 2>&1

curl --fail-with-body http://127.0.0.1:18831/registration
HABITAT_API_BASE_URL=http://127.0.0.1:18831 bun run ./src/cli.ts solar status
rg -n "Habitat API|Kepler" /tmp/habitat-api-correlated.log
```

Observed CLI output:

```text
Sunlight is clear right now.
Solar irradiance: 900 W/m2
```

That historical run predated the final safe logging format. The equivalent current
request portion, confirmed by the Safe Learning Logs run below, is:

```text
[habitat-api] GET /registration -> not registered
[kepler] GET /world/solar-irradiance -> 200
[habitat-api] GET /solar/irradiance -> proxied to Kepler
```

The contiguous solar lines correlate the CLI command with both the Habitat API
request and the backend's single Kepler completion line. No token or response body
was logged.

## Shutdown Check

The server process started for each run was stopped, then the listening port was checked:

```bash
lsof -nP -iTCP:18787 -sTCP:LISTEN
lsof -nP -iTCP:18831 -sTCP:LISTEN
```

Both checks printed no listener.

## Safe Learning Logs

Automated verification completed on 2026-07-13 with Bun 1.3.14:

```bash
bun test src/kepler/client.test.ts
bun test
bun run check
git diff --check
```

Observed results:

- The focused Kepler client suite passed: 6 tests, 0 failures, and 18 expectations.
- The complete suite passed: 207 tests, 0 failures, and 543 expectations across 32 files.
- TypeScript checking and `git diff --check` both exited successfully.
- The Kepler tests assert one `[kepler] METHOD /path -> result` line per transported request and exclude token, request-body, and non-success response-body values from emitted messages.

The isolated server verification used the following commands:

```bash
HABITAT_SQLITE_PATH=/tmp/habitat-safe-logs.sqlite \
HABITAT_API_HOST=127.0.0.1 \
HABITAT_API_PORT=18834 \
bun run server 2>&1 | tee /tmp/habitat-safe-logs.log

HABITAT_API_BASE_URL=http://127.0.0.1:18834 bun run ./src/cli.ts module list
HABITAT_API_BASE_URL=http://127.0.0.1:18834 bun run ./src/cli.ts solar status
rg -n "\\[habitat-api\\]|\\[kepler\\]" /tmp/habitat-safe-logs.log
```

Observed lines:

```text
[habitat-api] GET /registration -> not registered
[habitat-api] GET /modules -> 0 modules
[kepler] GET /world/solar-irradiance -> 200
[habitat-api] GET /solar/irradiance -> proxied to Kepler
```

The forbidden-marker scan used this exact command:

```bash
rg -ni "authorization|bearer|apitoken|api-token-secret|secret detail|request body|response body" /tmp/habitat-safe-logs.log
```

It printed no matches. After stopping the server, the listener check used this exact command:

```bash
lsof -nP -iTCP:18834 -sTCP:LISTEN
```

It printed no listener.

## Future Cleanup

- Move tick execution to `POST /ticks` so calculation and module persistence are one backend operation.
- Move construction start/cancel behind backend routes so module and inventory writes share one SQLite transaction.
- Move power overview and module status transitions behind backend domain resources.
- Replace broad collection `PUT` operations with versioned or operation-specific writes to prevent lost updates.
