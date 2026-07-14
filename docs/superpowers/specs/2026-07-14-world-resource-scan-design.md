# World Resource Scan Design

## Goal

Add a read-only resource scan path that keeps the transport boundary intact:

```text
Habitat CLI -> local Habitat API -> Kepler World
```

Students supply scan coordinates, sensor strength, and radius. The local API
loads the saved registration and supplies its `habitatId`; neither the command
nor its arguments expose a Kepler token or habitat ID.

## Request Flow

1. The CLI calls a focused `src/api/world.ts` adapter.
2. The adapter sends `GET /world/scan` to the local Habitat API using the
   existing `requestHabitatApiJson` transport.
3. The Habitat API validates `x`, `y`, `sensorStrength`, and `radiusTiles`.
4. The route loads the saved registration. When absent, it returns
   `404 registration_not_found` without contacting Kepler.
5. The Kepler domain operation combines the registration's `habitatId` with
   the validated scan inputs and calls Kepler's `GET /world/scan` through the
   existing `requestKeplerJson` transport.
6. The local route returns Kepler's JSON response unchanged on success.

## Components

- `src/api/world.ts`: typed local API adapter. It contains no raw `fetch`.
- `src/server/world.ts`: local `GET /world/scan` route, query validation,
  registration lookup, response wrapping, request summary, and existing-style
  Kepler error translation.
- `src/kepler/index.ts`: `scanWorldResources` operation, following the
  existing catalog and solar operations. It builds encoded query parameters
  and delegates to `requestKeplerJson`.
- `src/kepler/types.ts`: exact TypeScript representation of the Kepler scan
  response: scan metadata and tiles with terrain, distance, probabilities,
  top candidate, and nullable quantity estimate.
- `src/server/app.ts`: route registration.

## Validation And Errors

- `x` and `y` must be integer query parameters.
- `sensorStrength` must be an integer from 0 through 100.
- `radiusTiles` must be an integer from 0 through 5.
- Invalid or missing values return `400 invalid_world_scan`.
- A missing saved registration returns `404 registration_not_found`.
- Kepler transport, status, and JSON failures return the established
  `502 kepler_request_failed` response.

The API does not persist scan results or infer resource truth. Kepler retains
authority over hidden resources and quantities, and its response is passed
through unchanged.

## Tests

- API-adapter tests verify path/query construction through the existing client.
- Server-route tests verify valid forwarding, complete validation, missing
  registration, and Kepler error translation.
- Kepler-domain tests verify the endpoint, complete query parameters, expected
  status, and unchanged response.
- App tests verify the route is registered.
