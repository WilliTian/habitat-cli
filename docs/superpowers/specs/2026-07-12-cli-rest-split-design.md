# CLI REST Split Design

## Goal

Make the Hono backend the only process that calls Kepler or reads and writes SQLite. Preserve readable CLI output and the existing power, tick, and construction behavior while allowing those simulation algorithms to remain in the CLI for this lab.

This design extends the registration boundary in `2026-07-12-registration-rest-design.md` to Kepler catalog and solar reads plus local module and inventory state.

## Runtime Boundary

The CLI owns Commander wiring, command-level parsing and validation, simulation calculations, and terminal formatting. It talks to one configurable Habitat API base URL through focused API client modules.

The Hono backend owns HTTP routing, request validation, Kepler transport, and SQLite persistence. Backend route handlers delegate to existing domain functions rather than duplicating domain rules.

The Kepler client and SQLite state modules must not be imported by CLI command modules or by the default dependencies of CLI-owned power, tick, and construction workflows.

## Kepler Proxy Resources

The backend proxies Kepler data without embedding catalog fixtures or fallback values.

### `GET /catalog/blueprints`

Calls the official Kepler blueprint catalog endpoint and returns:

```json
{
  "blueprints": []
}
```

### `GET /catalog/blueprints/:blueprintId`

Calls the official Kepler endpoint for the requested blueprint. A successful response is:

```json
{
  "blueprint": {}
}
```

The route returns `404` when Kepler reports that the blueprint does not exist.

### `GET /catalog/resources`

Calls the official Kepler resource catalog endpoint and merges catalog entries with inventory quantities using the existing domain behavior. It returns:

```json
{
  "resources": []
}
```

Because the merge reads local inventory, this operation also remains backend-owned.

### `GET /solar/irradiance`

Calls the official Kepler solar irradiance endpoint and returns:

```json
{
  "solarIrradiance": {
    "wPerM2": 0,
    "condition": "night"
  }
}
```

The CLI uses these resources for `blueprint list`, `blueprint show`, `resource list`, and `solar status`, then applies the existing terminal formatters.

## Module Resources

### `GET /modules`

Loads SQLite module state and returns `{ "modules": [...] }`.

### `PUT /modules`

Accepts `{ "modules": [...] }`, replaces the full SQLite module collection, and returns the saved collection. This route supports CLI-owned tick and construction calculations.

### `POST /modules`

Accepts a module creation input, delegates to the existing module domain function, persists through SQLite, and returns `{ "module": {...} }` with status `201`.

### `GET /modules/:id`

Resolves an exact ID or the existing beginner-friendly short/prefix ID. It returns `{ "module": {...} }`, `404` for no match, and `409` for an ambiguous prefix.

### `PATCH /modules/:id`

Accepts the existing partial module update input, resolves the ID or prefix, saves the update, and returns `{ "module": {...} }`.

### `DELETE /modules/:id`

Resolves the ID or prefix, deletes the module, and returns the deleted module in `{ "module": {...} }` so the CLI can preserve its confirmation message.

The CLI module list, show, create, update, delete, status, and set-status behavior use these routes and retain the current formatters and command-level parsing.

## Inventory Resources

### `GET /inventory`

Loads SQLite inventory state and returns `{ "inventory": [...] }`.

### `PUT /inventory`

Accepts `{ "inventory": [...] }`, replaces the full SQLite inventory collection, and returns the saved collection. This route supports CLI-owned construction calculations and rollback.

### `PATCH /inventory/:resourceType`

Accepts a signed adjustment:

```json
{
  "quantityDelta": 10,
  "unit": "kg"
}
```

A positive delta supports `inventory add`; a negative delta supports `inventory remove`. The backend rejects zero, non-finite, or overdraw adjustments and returns `{ "resource": {...} }` after persisting the new quantity. Resource types are URL encoded by the API client.

The CLI keeps parsing the positive command quantity. It negates that value for `inventory remove` before calling the API.

## CLI-Owned Simulation

### Power Overview

Add `habitat power overview` as command wiring over the existing habitat status calculation. The calculation receives modules from `GET /modules`; the CLI prints the existing readable power and per-module status output.

The existing `habitat module status` command remains available and uses the same HTTP-backed calculation.

### Tick

`habitat tick 60` concurrently reads `GET /modules` and `GET /solar/irradiance`, applies the existing power tick algorithm locally, and persists the resulting modules through `PUT /modules`. Output remains unchanged.

### Construction

Construction dry-run reads one blueprint, modules, and inventory through the API. It performs no writes.

Construction start preserves the current sequence: calculate locally, write inventory through `PUT /inventory`, then write modules through `PUT /modules`. If the module write fails, the CLI attempts to restore the prior inventory through `PUT /inventory` before reporting the error.

Construction status reads modules through `GET /modules`. Construction cancel writes the updated module collection through `PUT /modules`.

This two-request construction update is not fully atomic if connectivity fails during the sequence. A future backend cleanup must move construction start and cancellation behind backend domain routes so both SQLite collections can be changed in one transaction.

## API Client Structure

`src/api/client.ts` remains the only raw HTTP transport module. Focused modules provide typed operations for registration, catalog, solar, modules, and inventory.

The shared client reads `HABITAT_API_BASE_URL`, defaults to `http://localhost:8787`, serializes request bodies as JSON, parses JSON responses, and converts backend and connection failures into readable errors.

CLI command files import focused API functions and domain formatters. They do not import `requestKeplerJson`, `src/*/state.ts`, SQLite repositories, or persistence adapters.

Pure Kepler, module, and inventory terminal formatters that currently share files with transport or persistence-aware functions move into focused formatter modules. This keeps CLI imports free of backend-owned implementation modules while preserving output text.

The default dependencies for tick, construction, and habitat status calculations change from direct Kepler and state functions to focused API functions. Their pure calculation functions and dependency-injection signatures remain available for existing tests.

## Error Contract

Backend errors use:

```json
{
  "error": {
    "code": "module_not_found",
    "message": "Module \"missing\" was not found."
  }
}
```

Malformed JSON and invalid fields return `400`. Missing resources return `404`. Ambiguous IDs, duplicate registration, and conflicting state return `409`. Kepler transport and response failures return `502`. Unexpected failures return `500`.

The backend validates all JSON inputs even where Commander performs equivalent validation. The API client extracts nested `error.message` values and the top-level CLI handler prints only the friendly message before exiting with status 1.

## Logging

Hono middleware logs one line for each request containing the `Habitat API` label, method, path, and response status.

The Kepler transport logs an outbound line and response line containing the `Kepler` label, method, URL path, and response status. It never logs authorization headers, API tokens, or full response bodies.

Together these logs make proxy behavior observable when a CLI catalog or solar command runs against the real backend.

## Test Strategy

Development follows test-first cycles for each boundary.

Hono route tests invoke `app.request` without binding a port. Injected dependencies prove route delegation, JSON response shapes, status codes, validation, and error mapping.

API client tests prove paths, methods, URL encoding, request JSON, response parsing, nested backend errors, and connection messages.

CLI tests inject focused API operations or HTTP-backed adapters and capture output. They prove that command behavior and beginner-friendly terminal formatting remain intact.

Existing Kepler, module, inventory, tick, construction, persistence, and formatter tests remain regression coverage for domain behavior.

## Observable Verification

Completion requires execution, not code inspection alone:

1. Run all Bun tests and TypeScript checking.
2. Start `bun run server` in a real background terminal on an available localhost port.
3. Run CLI registration, catalog, solar, module, inventory, power, tick, and construction commands in a separate process using `HABITAT_API_BASE_URL`.
4. Call at least one backend route directly with `curl` and inspect its JSON response.
5. Run at least one Kepler-backed CLI command and capture both the `Habitat API` and `Kepler` log lines.
6. Stop only the server process started for verification.

Commands requiring valid Kepler registration or suitable construction state may return a domain-level result based on the configured lab environment. Verification must still show that the request crossed the Habitat API boundary, and successful workflows must be exercised where the available state permits.

## Future Backend Cleanup

A later pass should move `tick` to `POST /ticks`, construction dry-run/start/status/cancel to construction resources and domain operations, power overview to a backend-computed status resource, and module status transitions to backend domain methods. That pass would eliminate broad collection replacement, provide transactional construction updates, reduce lost-update risk, and make the backend the authoritative simulation engine rather than only the transport and persistence owner.
