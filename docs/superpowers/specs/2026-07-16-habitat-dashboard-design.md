# Habitat dashboard design

## Goal

Add an initial React and TypeScript operator dashboard for Habitat. It presents registration, module operation, and power telemetry, and lets an operator register, unregister, change a module between online and offline, and advance simulation time. It deliberately excludes construction, inventory, crew, and other later workflows.

## REST contract

The browser talks only to the existing Hono server. It never opens SQLite, calls Kepler, or reimplements Habitat calculations.

Existing routes used by the dashboard:

- `GET /registration`, `POST /registration`, and `DELETE /registration`
- `GET /modules` and `PATCH /modules/:id`
- `GET /solar/irradiance`

New, consistent resource routes:

- `GET /power` returns a server-calculated `PowerTickSummary` for the current module state and current solar irradiance without persisting changes.
- `POST /ticks` accepts `{ tickCount: positive whole number }`, runs the existing tick domain logic, persists the resulting modules, and returns `{ modules, summary }`.

Both new routes use the existing structured error response format. The tick route is serialized with the existing mutation queue so concurrent module or tick updates do not overwrite each other.

## UI

The Vite React application is served separately during development and reads an `VITE_HABITAT_API_BASE_URL` setting, defaulting to the local Hono server. It follows the fourth-slide presentation direction: a calm, high-contrast operations console, strong typography, low-glare dark surfaces, thin technical borders, compact telemetry cards, and a matching light theme. Theme choice follows the system preference and has an explicit operator toggle.

The page contains:

- A header with Habitat name, registration badge, theme switch, and refresh action.
- A registration panel that shows an empty state and name entry when unregistered, or a clearly guarded unregister action when registered. Unregister requires an in-context confirmation before the DELETE request.
- A power grid for generation, consumption, net power, stored battery energy, solar irradiance, and solar condition. Values are rendered only from API responses.
- A time-control panel with 1, 60, 600, and 3,600 tick shortcuts plus a positive whole-number custom input. Controls are disabled while a tick is in flight.
- A modules list with each module’s current status, real power usage, and an online/offline control. A status update sends the module’s authoritative current runtime attributes with only `status` changed.

Loading skeletons, no-module empty state, API error panel with retry, disabled mutation controls, and concise mutation feedback make unavailable or transitional states clear.

## Data flow

On initial load and refresh, the dashboard concurrently reads registration, modules, and power. The power endpoint reads solar as needed on the server. Successful registration, module updates, ticks, or unregistering refresh the affected dashboard resources. Errors stay local to the affected action where possible; initial-load failures show a recoverable page-level error.

## Testing and verification

Server tests cover validation, calculation delegation, persistence, and error mapping for `/power` and `/ticks`. Client unit tests cover API request formation and pure display/validation helpers. The completed app is type-checked, tested, built, and visually inspected in both themes at desktop and narrow viewport widths.
