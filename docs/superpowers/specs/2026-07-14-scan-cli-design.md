# Scan CLI Design

## Goal

Expose the existing local world-scan API with:

```text
habitat scan --x 3 --y -2 --strength 60
```

## Behavior

`scan` requires integer `--x`, `--y`, and `--strength` options. `--radius`
is an integer from 0 through 5 and defaults to 0. `--json` writes the exact
local API response as formatted JSON.

The command calls only `scanWorld` from `src/api/world.ts`; it does not read
registration state, attach a habitat ID, use Kepler credentials, or issue raw
HTTP requests.

For radius 0, terminal output shows the one tile's coordinates, terrain and
distance, every resource probability, top candidate, and the nullable quantity
estimate. For a larger radius, output shows one summary row per tile with
coordinates, distance, terrain, top candidate, confidence, and estimated
quantity.

## Validation

CLI validation produces friendly errors for missing/non-integer coordinates,
strength outside 0–100, and radius outside 0–5. The local API remains the
authoritative validation boundary.

## Verification

Add command and formatting tests before implementation. Run the full suite,
type check, and an isolated running Habitat service with a stubbed Kepler scan
response; invoke the real command through that service.
