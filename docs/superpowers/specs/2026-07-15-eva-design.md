# EVA exploration design

## Scope

Add local EVA state and commands for deploying one human from the active starter
basic suitport, moving one cardinal tile at a time within Kepler's current
sector, and docking at the origin.

## Architecture

The `eva` domain owns validation and state transitions. A singleton SQLite row
stores the deployed human ID, coordinates, carried resource quantities, and
maximum carrying capacity in kilograms. Registration initializes the row and
unregister clears it. The local Hono API exposes status, deploy, move, and dock
operations; the CLI calls only this API and supports human-readable and JSON
output.

Deployment uses persisted registration modules and humans. It identifies the
starter module by its live blueprint/capabilities, requires active status and
the selected human's current module location, and reads a valid carrying
capacity from the module's runtime attributes. No capacity or human values are
hard-coded.

Movement requires an exactly one-tile north/south/east/west destination and
queries Kepler's current-sector endpoint for bounds before persisting the new
coordinates. Docking is valid only at `(0,0)`, clears the deployed human, and
retains carried resources locally.

## Errors and transactions

Invalid human/module/capacity, occupied EVA, invalid movement, out-of-sector
coordinates, and invalid docking return the existing structured 4xx API errors.
Each successful state change is committed atomically in SQLite.
