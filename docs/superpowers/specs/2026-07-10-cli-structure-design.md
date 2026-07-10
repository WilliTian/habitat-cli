# CLI Structure Refactor Design

## Goal

Refactor the Habitat CLI into a thinner, more traditional shape where:

- `src/cli.ts` remains the top-level bootstrap
- each feature folder's `index.ts` is the command-wiring entrypoint for that feature
- behavior moves out of feature `index.ts` files into smaller focused modules

The intent is to simplify navigation, reduce catch-all files, and align the codebase with the repository guidance that entrypoints should focus on orchestration rather than implementation details.

## Current Problems

The current top-level CLI entrypoint is already reasonably thin, but several feature `index.ts` files mix multiple responsibilities:

- command-facing orchestration
- domain behavior
- persistence coordination
- output formatting
- helper utilities

The largest concentration of mixed concerns is in:

- `src/kepler/index.ts`
- `src/modules/index.ts`
- `src/construct/index.ts`
- `src/ticks/index.ts`

This makes the code harder to scan because the public surface, domain workflows, and CLI formatting are bundled together in the same files.

## Recommended Approach

Keep `src/cli.ts` as the application bootstrap and make each feature folder's `index.ts` the command registration file for that feature.

This preserves the current CLI entry model while moving each feature toward a structure like:

```text
src/
  cli.ts
  kepler/
    index.ts
    service.ts
    client.ts
    state.ts
    format.ts
    types.ts
  modules/
    index.ts
    service.ts
    state.ts
    diagnostics.ts
    format.ts
    types.ts
  inventory/
    index.ts
    service.ts
    state.ts
    format.ts
    types.ts
  construct/
    index.ts
    service.ts
    format.ts
    types.ts
  ticks/
    index.ts
    service.ts
    format.ts
    types.ts
```

This is intentionally conservative. It changes file boundaries and imports without changing command names, persisted data shape, or user-visible behavior unless needed to preserve the refactor.

## Architecture

### Top-level bootstrap

`src/cli.ts` should own only:

- creating the Commander program
- setting CLI metadata and help text
- registering each feature entrypoint
- top-level parse and global error handling

It should not own feature behavior beyond the existing top-level habitat registration commands unless those are also moved into a dedicated feature wiring module later.

### Feature entrypoints

Each feature `index.ts` should own only:

- importing feature services and formatters
- defining Commander commands, arguments, and options
- calling the relevant service functions
- printing formatted output

Feature `index.ts` files should not contain core business logic, state mutation logic, or HTTP client implementation.

### Service modules

Each `service.ts` should own the actual feature behavior. Typical responsibilities:

- validating feature-specific inputs
- coordinating state and external dependencies
- performing domain operations
- returning structured data for formatting

Service modules are the primary place for business logic and should be written to remain testable with dependency injection where that pattern already exists.

### Formatting modules

Each `format.ts` should own CLI output rendering only:

- table formatting
- status text formatting
- human-readable summaries

Formatting should not reach into persistence or external APIs.

### State modules

Existing `state.ts` files remain the persistence-facing layer:

- SQLite load/save/delete behavior stays there
- service modules call state modules instead of repository code directly

This keeps persistence centralized and avoids leaking SQLite repository details across features.

## Feature-by-Feature Refactor

### Kepler

Target structure:

- `index.ts`: wire `blueprint`, `resource`, and `solar` commands
- `service.ts`: registration/status/unregister workflows plus blueprint/resource/solar reads
- `client.ts`: shared Kepler HTTP transport
- `state.ts`: persisted registration state
- `format.ts`: habitat, blueprint, resource, and solar output formatting

Notes:

- `register`, `status`, and `unregister` currently live in `src/cli.ts`; they can continue calling Kepler service functions from there in the first pass
- blueprint catalog data remains remote Kepler data, not local module state

### Modules

Target structure:

- `index.ts`: wire `module` commands
- `service.ts`: local module CRUD, lookup, hydration from starter modules, and runtime status updates
- `state.ts`: persisted module state
- `diagnostics.ts`: runtime interpretation helpers
- `format.ts`: module and module-status rendering

Notes:

- the service layer should continue to own starter module hydration because that behavior belongs to local module state, not Kepler catalog state
- diagnostics stay separate because they are already a good focused boundary

### Inventory

Target structure:

- `index.ts`: wire `inventory` commands
- `service.ts`: list, add, reset operations
- `state.ts`: persisted inventory state
- `format.ts`: inventory table rendering

Notes:

- inventory is already small, so this is mostly a consistency refactor

### Construct

Target structure:

- `index.ts`: wire `construct` and `construction` commands
- `service.ts`: dry-run evaluation, start, cancel, and status workflows
- `format.ts`: construction report rendering
- `types.ts`: unchanged role as shared types

Notes:

- construction logic should remain its own feature because it coordinates blueprint reads, modules, and inventory
- no state module is needed unless construction gets dedicated persisted state outside module runtime attributes

### Ticks

Target structure:

- `index.ts`: wire `tick` commands
- `service.ts`: power simulation, solar generation, battery drain/charge, and construction advancement
- `format.ts`: tick summary output
- `types.ts`: unchanged role as shared types

Notes:

- tick simulation currently contains both core power logic and construction job advancement; that can stay together initially because both are part of habitat tick behavior
- if the file remains too large after extraction, a later pass can split battery logic or construction advancement helpers further

## Migration Strategy

The refactor should be done incrementally with behavior preserved after each step.

Suggested order:

1. Move formatting code into `format.ts` files without changing logic.
2. Move domain behavior from feature `index.ts` into `service.ts`.
3. Convert feature `cli.ts` files into feature `index.ts` command wiring files.
4. Update top-level `src/cli.ts` imports to point at feature `index.ts` files.
5. Run tests after each feature move or after each small batch of moves.

This order keeps command surfaces stable while shrinking the large feature files in the lowest-risk sequence.

## Error Handling

Error-handling behavior should remain materially the same:

- service functions throw errors with user-facing messages
- feature `index.ts` wiring may continue to handle missing records with `console.error` and `process.exit(1)` where that is the established CLI behavior
- top-level parse error handling remains in `src/cli.ts`

The refactor should not introduce a broad new error model unless tests show the current one is inconsistent.

## Testing

The refactor should preserve the existing test suite and update imports as needed.

Test expectations:

- existing feature tests continue to pass
- any tests that imported old file paths are updated to the new structure
- no command behavior should change as a side effect of the file moves

If a large file split reveals missing direct tests for formatting or service behavior, add narrow tests only where they clarify ownership or protect a risky extraction.

## Non-Goals

This refactor does not aim to:

- rename commands
- change persisted SQLite schemas
- change local state semantics
- alter starter module hydration behavior
- separate construction jobs from module runtime attributes
- redesign the Kepler client contract

Those changes can be considered later, but they are outside the scope of this structural cleanup.

## Success Criteria

The refactor is successful if:

- `src/cli.ts` remains small and focused on app bootstrap
- each feature `index.ts` is primarily command wiring
- business logic lives in `service.ts` or similarly focused modules
- formatting lives in dedicated formatter modules
- persistence stays behind `state.ts`
- tests still pass with no user-visible CLI regressions

## Implementation Notes

Two practical constraints should guide the implementation:

- preserve the current exported types and function names when possible to minimize churn
- avoid large all-at-once rewrites; prefer moving one feature at a time while keeping the program runnable

This should produce the simpler traditional layout the user asked for without introducing unnecessary risk.
