## TypeScript Structure

Keep `src/cli.ts` thin. Put behavior in focused feature folders.

- `index.ts` is the feature entrypoint
- `client.ts` handles API calls
- `state.ts` handles local persisted state
- `types.ts` holds shared types
- separate unrelated command groups into their own folder

## Kepler Data Model

`starterModules` hydrate local module records during registration.
`blueprints` stay as published catalog data.
Store both in local Kepler state alongside habitat identifiers.

## Module Commands

`habitat module` manages only local module records, hydrated from Kepler `starterModules` and then CRUDed from the persisted module store.
