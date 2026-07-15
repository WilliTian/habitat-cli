# Registration Humans And Alert Contract Design

## Goal

Preserve Kepler registration data needed for later human features without
adding human commands, HTTP routes, dashboard views, exploration behavior,
collection behavior, or local alert instances.

## Scope

The registration flow will retain two additional parts of Kepler's
authoritative `POST /habitats/register` response:

- `starterHumans`, whose entries contain an id, display name, and current
  module location.
- `contracts.alerts`, whose schema version and JSON Schema describe Kepler's
  shared alert contract.

The program will model and persist those values. It will not invent defaults
or copy live response values into production code.

## Data Model

`StarterHuman` is the common registration representation:

```ts
type StarterHuman = {
  id: string;
  displayName: string;
  locationModuleId: string;
};
```

`AlertContract` preserves the server-defined alert contract as opaque JSON:

```ts
type AlertContract = {
  schemaVersion: string;
  schema: Record<string, unknown>;
};
```

`HabitatRegistrationResponse` adds `starterHumans` and `contracts.alerts`.
`KeplerHabitatState` retains the alert contract as registration metadata.
The alert contract is not an alert instance and does not create an alerts
table in this change.

## SQLite Storage

The database adds a `humans` table with one row per known human:

- `id` is the primary key and preserves Kepler's human id.
- `display_name` preserves the current display name.
- `location_module_id` preserves the current module location.

A focused humans repository owns replacing and loading the collection. The
registration operation replaces the stored starter-human collection directly
from Kepler's registration response, alongside the existing starter-module
hydration. The table is intentionally separate from the registration JSON so
future human operations can query and update individual people without a
schema redesign.

The `registration` table adds `alert_contract_json`, storing the exact alert
contract supplied by Kepler. It is nullable only for compatibility with
existing local databases that predate this feature; newly registered habitats
always save the returned contract.

## Flow And Boundaries

```text
Kepler POST /habitats/register
  -> typed HabitatRegistrationResponse
  -> replace starter modules
  -> replace starter humans
  -> save registration metadata and contracts.alerts
```

`GET /habitats/{habitatId}/registration` does not return starter humans or
contracts, so Habitat status refreshes must retain the locally saved values
instead of clearing or fabricating them.

The existing CLI and local Hono responses remain unchanged. They continue to
return the current `KeplerHabitatState` view intended for existing command
formatters; no human or alert resource is exposed until the corresponding
feature is designed.

## Error Handling

The registration response is trusted after Kepler has accepted it. SQLite
replace operations use the existing database transaction pattern where
appropriate. A failed persistence operation causes registration to fail;
there is no partial local human collection reported as successful.

## Testing

Tests use fixtures that represent the Kepler contract without embedding live
registration values. They prove:

- human repository round trips and collection replacement;
- registration maps Kepler-provided starter humans and alert contract into
  local persistence;
- registration-state persistence round trips the alert contract;
- status refresh retains stored alert contract and humans because its Kepler
  response cannot supply them.

No tests add CLI commands, HTTP routes, dashboard behavior, exploration,
collection, or alert lifecycle logic.
