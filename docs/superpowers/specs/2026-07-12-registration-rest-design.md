# Registration REST Boundary Design

## Goal

Move registration, status refresh, and unregister behavior behind the Hono backend while preserving beginner-friendly CLI output. The backend is the only process that calls Kepler or reads and writes registration-related SQLite state.

## Ownership Boundary

The CLI owns command parsing and human-readable output. It sends JSON requests through the focused Habitat API client and does not import Kepler registration functions or SQLite state functions.

The Hono backend owns the registration HTTP routes. Its route handlers delegate to the existing registration domain functions, which already coordinate Kepler calls and SQLite persistence for registration, modules, and inventory.

The existing Kepler domain functions remain the source of registration rules. The REST layer does not duplicate checks such as preventing a second registration, refreshing saved status, or clearing stale local registration.

## HTTP Resources

### `POST /registration`

Request body:

```json
{
  "displayName": "Cygnus Seven"
}
```

The backend validates the JSON body, calls `registerKeplerHabitat`, persists the returned registration and starter modules through the existing domain flow, and responds with status `201`.

Response body:

```json
{
  "registration": {
    "habitatUuid": "...",
    "habitatId": "...",
    "displayName": "Cygnus Seven",
    "starterModules": [],
    "registeredAt": "...",
    "moduleCount": 0
  }
}
```

The registration object is the structured `KeplerHabitatState` needed by the CLI formatter. The API token is not needed in mutation or status responses.

### `GET /status`

The backend calls `readKeplerHabitatStatus`. When registration exists, that operation fetches current registration data from Kepler, updates the SQLite registration record, calculates the local module count, and returns the refreshed state.

Successful response body:

```json
{
  "registration": {
    "habitatUuid": "...",
    "habitatId": "...",
    "displayName": "Cygnus Seven",
    "starterModules": [],
    "registeredAt": "...",
    "moduleCount": 0,
    "habitat": {
      "id": "...",
      "displayName": "Cygnus Seven",
      "habitatSlug": "...",
      "status": "registered",
      "catalogVersion": "...",
      "lastSeenAt": null
    },
    "refreshedAt": "..."
  }
}
```

If there is no saved registration, the backend returns status `404` with a structured error rather than contacting Kepler.

### `DELETE /registration`

The backend calls `unregisterKeplerHabitat`. That operation asks Kepler to delete the habitat and then clears registration, modules, and inventory quantities in SQLite. If Kepler reports that the habitat is already absent, local state is still cleared.

Successful response body:

```json
{
  "registration": {
    "habitatUuid": "...",
    "habitatId": "...",
    "displayName": "Cygnus Seven",
    "starterModules": [],
    "registeredAt": "..."
  },
  "remoteHabitatDeleted": true
}
```

The route returns status `200` because the response contains a result the CLI uses to distinguish a normal deletion from stale local-state cleanup.

### `GET /registration`

The existing route remains a local resource read. It returns the saved registration summary or `{ "registration": null }` and does not refresh from Kepler. This is distinct from `GET /status`, which always performs a live refresh when local registration exists.

## Error Contract

Backend failures use JSON:

```json
{
  "error": {
    "code": "registration_not_found",
    "message": "No Kepler habitat registration was found."
  }
}
```

Malformed JSON or a missing/blank `displayName` returns `400`. Missing registration for status or unregister returns `404`. Existing registration conflicts return `409`. Kepler and unexpected failures return `502` and `500` respectively without terminal formatting.

The API client extracts nested backend error messages and turns connection failures or non-success responses into readable exceptions. Commander’s top-level error handler prints those messages and exits with status 1.

## CLI Behavior

`habitat register --name "Cygnus Seven"` sends `POST /registration`, then prints the existing registration success line and formatted habitat details.

`habitat status` sends `GET /status`, then prints the existing formatted habitat details. Missing registration is reported as a friendly error through the common CLI error path.

`habitat unregister` sends `DELETE /registration`, then prints the existing normal or stale-registration message based on `remoteHabitatDeleted`.

No command handler calls `fetch`, Kepler, or SQLite directly. HTTP details remain in `src/api/client.ts`, and resource-specific API calls remain in `src/api/registration.ts`.

## Testing

Hono route tests call the app in-process without binding a port. Dependencies are injected to prove that each route delegates to the correct domain operation, returns structured JSON and status codes, and maps known errors.

API client tests prove the paths, methods, request JSON, and response types for register, status, and unregister.

CLI tests use injected API operations and captured output so they prove human-readable messages without requiring a running server. Existing Kepler domain and SQLite repository tests continue to cover remote orchestration and persistence behavior.

Final verification runs all Bun tests, TypeScript checking, and an in-process registration route request.
