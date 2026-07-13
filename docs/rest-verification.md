# REST Split Verification

Verified on 2026-07-13 with Bun 1.3.14.

## Automated Checks

- `bun test`: 186 tests passed, 0 failed, across 32 files with 503 expectations.
- `bun x tsc --noEmit`: passed with no TypeScript errors.
- `git diff --check`: passed.
- CLI-side import scan found no direct Kepler transport, SQLite state, or persistence imports in status, tick, construction, or command wiring.

## Real Server And Curl

The server ran at `http://127.0.0.1:18787` with isolated state at `/tmp/habitat-rest-verification-9405030.sqlite`.

Startup output:

```text
Habitat API listening on http://127.0.0.1:18787
```

Direct request:

```bash
curl --fail-with-body http://127.0.0.1:18787/registration
```

Observed JSON:

```json
{"registration":null}
```

After verification, the server process was stopped and port `18787` had no listener.

## CLI Results

All commands used `HABITAT_API_BASE_URL=http://127.0.0.1:18787`.

- `blueprint list` returned 18 formatted live Kepler blueprints.
- `blueprint show small-solar-array` returned the live production and runtime details.
- `resource list` returned the formatted live Kepler resource catalog.
- `solar status` reported clear sunlight and `900 W/m2`.
- `status` returned the expected friendly missing-registration error through the Habitat API.
- Empty `module list`, `inventory list`, and `power overview` produced their existing beginner-friendly output.
- Module list/show/create/update/delete completed through backend state; the temporary module was deleted.
- Inventory add/remove returned ferrite from 100 to 105 and back to 100.
- `power overview` reported 8 kW from the seeded workshop fabricator.
- `tick 60` read proxied solar data, calculated 0.133333 kWh demand, and persisted the module collection.
- Construction dry-run passed every readiness check.
- Construction start created job `small_solar_array_1`; status displayed 180 remaining ticks; cancel removed the active job.

The live `small-solar-array` blueprint requires ferrite, silicate glass, and conductive ore. Verification seeded those current catalog inputs instead of stale steel/electronics example values.

## Proxy Logs

Representative secret-free lines from `/tmp/habitat-api-rest-split.log`:

```text
Kepler GET /catalog/blueprints/small-solar-array outbound
Kepler GET /catalog/blueprints/small-solar-array 200
Habitat API GET /catalog/blueprints/small-solar-array 200
Kepler GET /world/solar-irradiance outbound
Kepler GET /world/solar-irradiance 200
Habitat API GET /solar/irradiance 200
Habitat API PUT /inventory 200
Habitat API PUT /modules 200
```

These lines prove that the CLI request reached the Habitat API and that the backend, not the CLI, made the corresponding Kepler request.

## Future Cleanup

- Move tick execution to `POST /ticks` so calculation and module persistence are one backend operation.
- Move construction start/cancel behind backend routes so module and inventory writes share one SQLite transaction.
- Move power overview and module status transitions behind backend domain resources.
- Replace broad collection `PUT` operations with versioned or operation-specific writes to prevent lost updates.
