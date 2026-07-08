# Power Ticks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `habitat tick <count>` command that advances local power simulation by a requested number of one-second ticks.

**Architecture:** Keep `src/cli.ts` thin by adding a focused `ticks` feature folder. Tick logic reads local modules, treats module runtime attributes as the mutable state source, computes active module power draw in kW, converts it to kWh for the requested number of one-second ticks, drains local battery modules, saves modules, and prints a summary.

**Tech Stack:** Bun, TypeScript, Commander, existing JSON state files under `.habitat`.

## Global Constraints

- One simulation tick represents one simulated second.
- Runtime module power is stored as `runtimeAttributes.powerDrawKw`.
- Power draw is a kW rate, not energy consumed during one tick.
- Convert power demand to one-second energy by dividing by `3600`.
- Module runtime state lives inside `runtimeAttributes`.
- `src/cli.ts` stays focused on command wiring.
- No Kepler network call is required for power ticks.
- Tick behavior is power-only: no construction, unlocks, rover jobs, events, alerts, or resource simulation.

---

## File Structure

- Create `src/ticks/types.ts`
  - Defines tick input, battery state fields, and tick summary types.
- Create `src/ticks/index.ts`
  - Contains pure power tick calculation and the persistence wrapper.
- Create `src/ticks/cli.ts`
  - Wires `habitat tick <count>` into Commander and formats the summary.
- Create `src/ticks/index.test.ts`
  - Tests power-only tick calculation against real module-shaped objects.
- Modify `src/cli.ts`
  - Imports and calls `registerTickCommands(program)`.
- Modify `src/modules/types.ts`
  - Extends `ModuleRuntimeAttributes` with battery energy fields.

---

### Task 1: Define Power Tick Types

**Files:**
- Modify: `src/modules/types.ts`
- Create: `src/ticks/types.ts`
- Test: `src/ticks/index.test.ts`

**Interfaces:**
- Consumes: `HabitatModule`, `ModuleRuntimeAttributes`
- Produces:
  - `PowerTickInput`
  - `PowerTickSummary`
  - battery runtime fields `energyStoredKwh` and `energyCapacityKwh`

- [ ] **Step 1: Write the failing test**

Create `src/ticks/index.test.ts` with this first test:

```ts
import { describe, expect, test } from "bun:test";

import { applyPowerTicks } from "./index";
import type { HabitatModule } from "../modules/types";

function moduleFixture(input: {
  id: string;
  displayName: string;
  runtimeAttributes: Record<string, unknown>;
  capabilities?: string[];
}): HabitatModule {
  return {
    id: input.id,
    blueprintId: input.id,
    displayName: input.displayName,
    connectedTo: [],
    runtimeAttributes: input.runtimeAttributes,
    capabilities: input.capabilities ?? [],
    source: "starter",
    createdAt: "2026-07-08T00:00:00.000Z",
    updatedAt: "2026-07-08T00:00:00.000Z",
  };
}

describe("applyPowerTicks", () => {
  test("drains active module power draw from batteries for one-second ticks", () => {
    const modules = [
      moduleFixture({
        id: "command",
        displayName: "Command Module",
        runtimeAttributes: {
          status: "active",
          powerDrawKw: 3.6,
        },
      }),
      moduleFixture({
        id: "battery",
        displayName: "Battery",
        runtimeAttributes: {
          status: "active",
          energyStoredKwh: 10,
          energyCapacityKwh: 20,
        },
      }),
    ];

    const result = applyPowerTicks({ modules, tickCount: 10 });

    expect(result.summary.tickCount).toBe(10);
    expect(result.summary.activePowerDrawKw).toBe(3.6);
    expect(result.summary.energyDemandKwh).toBeCloseTo(0.01);
    expect(result.modules[1].runtimeAttributes.energyStoredKwh).toBeCloseTo(9.99);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
/home/willi/.bun/bin/bun test src/ticks/index.test.ts
```

Expected: FAIL because `src/ticks/index.ts` and `applyPowerTicks` do not exist.

- [ ] **Step 3: Add type definitions**

Update `src/modules/types.ts`:

```ts
export type ModuleRuntimeAttributes = Record<string, unknown> & {
  // Kepler docs define runtime module state inside runtimeAttributes.
  status?: string;
  health?: number;
  powerDrawKw?: number;
  energyStoredKwh?: number;
  energyCapacityKwh?: number;
};
```

Create `src/ticks/types.ts`:

```ts
import type { HabitatModule } from "../modules/types";

export type PowerTickInput = {
  modules: HabitatModule[];
  tickCount: number;
};

export type BatteryDrain = {
  moduleId: string;
  displayName: string;
  beforeEnergyStoredKwh: number;
  afterEnergyStoredKwh: number;
  drainedKwh: number;
};

export type PowerTickSummary = {
  tickCount: number;
  activePowerDrawKw: number;
  energyDemandKwh: number;
  energyDrainedKwh: number;
  unmetEnergyKwh: number;
  batteryDrains: BatteryDrain[];
};

export type PowerTickResult = {
  modules: HabitatModule[];
  summary: PowerTickSummary;
};
```

- [ ] **Step 4: Add minimal implementation**

Create `src/ticks/index.ts`:

```ts
import type { HabitatModule } from "../modules/types";
import type { BatteryDrain, PowerTickInput, PowerTickResult } from "./types";

const ticksPerHour = 3600;

export function applyPowerTicks(input: PowerTickInput): PowerTickResult {
  const tickCount = validateTickCount(input.tickCount);
  const modules = input.modules.map((module) => ({
    ...module,
    runtimeAttributes: { ...module.runtimeAttributes },
  }));

  const activePowerDrawKw = modules.reduce((total, module) => {
    if (!isActiveModule(module)) {
      return total;
    }

    const powerDrawKw = module.runtimeAttributes.powerDrawKw;
    return typeof powerDrawKw === "number" && powerDrawKw > 0 ? total + powerDrawKw : total;
  }, 0);

  const energyDemandKwh = (activePowerDrawKw * tickCount) / ticksPerHour;
  const batteryDrains: BatteryDrain[] = [];
  let remainingDemandKwh = energyDemandKwh;

  for (const module of modules) {
    if (remainingDemandKwh <= 0 || !isBatteryModule(module)) {
      continue;
    }

    const beforeEnergyStoredKwh = module.runtimeAttributes.energyStoredKwh;
    const drainedKwh = Math.min(beforeEnergyStoredKwh, remainingDemandKwh);
    const afterEnergyStoredKwh = beforeEnergyStoredKwh - drainedKwh;

    module.runtimeAttributes.energyStoredKwh = afterEnergyStoredKwh;
    remainingDemandKwh -= drainedKwh;

    batteryDrains.push({
      moduleId: module.id,
      displayName: module.displayName,
      beforeEnergyStoredKwh,
      afterEnergyStoredKwh,
      drainedKwh,
    });
  }

  const energyDrainedKwh = energyDemandKwh - remainingDemandKwh;

  return {
    modules,
    summary: {
      tickCount,
      activePowerDrawKw,
      energyDemandKwh,
      energyDrainedKwh,
      unmetEnergyKwh: remainingDemandKwh,
      batteryDrains,
    },
  };
}

function validateTickCount(tickCount: number): number {
  if (!Number.isInteger(tickCount) || tickCount <= 0) {
    throw new Error("Tick count must be a positive integer.");
  }

  return tickCount;
}

function isActiveModule(module: HabitatModule): boolean {
  return module.runtimeAttributes.status === "active";
}

function isBatteryModule(module: HabitatModule): module is HabitatModule & {
  runtimeAttributes: HabitatModule["runtimeAttributes"] & { energyStoredKwh: number };
} {
  return (
    module.runtimeAttributes.status === "active" &&
    typeof module.runtimeAttributes.energyStoredKwh === "number" &&
    module.runtimeAttributes.energyStoredKwh > 0
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
/home/willi/.bun/bin/bun test src/ticks/index.test.ts
```

Expected: PASS.

---

### Task 2: Add Power Tick Edge Rules

**Files:**
- Modify: `src/ticks/index.test.ts`
- Modify: `src/ticks/index.ts`

**Interfaces:**
- Consumes: `applyPowerTicks(input: PowerTickInput): PowerTickResult`
- Produces: deterministic rules for inactive modules, invalid counts, and depleted batteries

- [ ] **Step 1: Add failing tests for edge rules**

Append these tests inside the existing `describe("applyPowerTicks", ...)` block:

```ts
test("ignores inactive module power draw", () => {
  const modules = [
    moduleFixture({
      id: "offline-pump",
      displayName: "Offline Pump",
      runtimeAttributes: {
        status: "offline",
        powerDrawKw: 360,
      },
    }),
    moduleFixture({
      id: "battery",
      displayName: "Battery",
      runtimeAttributes: {
        status: "active",
        energyStoredKwh: 5,
      },
    }),
  ];

  const result = applyPowerTicks({ modules, tickCount: 10 });

  expect(result.summary.activePowerDrawKw).toBe(0);
  expect(result.summary.energyDemandKwh).toBe(0);
  expect(result.modules[1].runtimeAttributes.energyStoredKwh).toBe(5);
});

test("reports unmet energy when batteries run out", () => {
  const modules = [
    moduleFixture({
      id: "load",
      displayName: "Load",
      runtimeAttributes: {
        status: "active",
        powerDrawKw: 7200,
      },
    }),
    moduleFixture({
      id: "battery",
      displayName: "Battery",
      runtimeAttributes: {
        status: "active",
        energyStoredKwh: 1,
      },
    }),
  ];

  const result = applyPowerTicks({ modules, tickCount: 1 });

  expect(result.summary.energyDemandKwh).toBe(2);
  expect(result.summary.energyDrainedKwh).toBe(1);
  expect(result.summary.unmetEnergyKwh).toBe(1);
  expect(result.modules[1].runtimeAttributes.energyStoredKwh).toBe(0);
});

test("rejects non-positive tick counts", () => {
  expect(() => applyPowerTicks({ modules: [], tickCount: 0 })).toThrow(
    "Tick count must be a positive integer.",
  );
});
```

- [ ] **Step 2: Run tests to verify behavior**

Run:

```bash
/home/willi/.bun/bin/bun test src/ticks/index.test.ts
```

Expected: PASS if Task 1 implementation already covers these edge rules. If any test fails, update only `src/ticks/index.ts` until all tests pass.

- [ ] **Step 3: Run typecheck**

Run:

```bash
PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun run check
```

Expected: PASS.

---

### Task 3: Persist Power Ticks Against Local Module State

**Files:**
- Modify: `src/ticks/index.ts`
- Modify: `src/ticks/index.test.ts`

**Interfaces:**
- Consumes:
  - `loadModules(): Promise<HabitatModule[]>`
  - `saveModules(modules: HabitatModule[]): Promise<void>`
  - `applyPowerTicks(input: PowerTickInput): PowerTickResult`
- Produces:
  - `runPowerTicks(tickCount: number): Promise<PowerTickResult>`

- [ ] **Step 1: Add the persistence wrapper test**

Append this import at the top of `src/ticks/index.test.ts`:

```ts
import { runPowerTicks } from "./index";
```

Then add this test:

```ts
test("runPowerTicks loads modules, applies ticks, and saves updated modules", async () => {
  const savedModules: HabitatModule[][] = [];
  const modules = [
    moduleFixture({
      id: "load",
      displayName: "Load",
      runtimeAttributes: {
        status: "active",
        powerDrawKw: 3.6,
      },
    }),
    moduleFixture({
      id: "battery",
      displayName: "Battery",
      runtimeAttributes: {
        status: "active",
        energyStoredKwh: 10,
      },
    }),
  ];

  const result = await runPowerTicks(10, {
    loadModules: async () => modules,
    saveModules: async (nextModules) => {
      savedModules.push(nextModules);
    },
  });

  expect(result.summary.energyDemandKwh).toBeCloseTo(0.01);
  expect(savedModules).toHaveLength(1);
  expect(savedModules[0][1].runtimeAttributes.energyStoredKwh).toBeCloseTo(9.99);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
/home/willi/.bun/bin/bun test src/ticks/index.test.ts
```

Expected: FAIL because `runPowerTicks` does not exist.

- [ ] **Step 3: Add persistence dependency type and wrapper**

Update `src/ticks/index.ts` imports:

```ts
import { loadModules, saveModules } from "../modules/state";
import type { HabitatModule } from "../modules/types";
import type { BatteryDrain, PowerTickInput, PowerTickResult } from "./types";
```

Add this type and function above `applyPowerTicks`:

```ts
type PowerTickDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
  saveModules: (modules: HabitatModule[]) => Promise<void>;
};

const defaultDependencies: PowerTickDependencies = {
  loadModules,
  saveModules,
};

export async function runPowerTicks(
  tickCount: number,
  dependencies: PowerTickDependencies = defaultDependencies,
): Promise<PowerTickResult> {
  const modules = await dependencies.loadModules();
  const result = applyPowerTicks({ modules, tickCount });
  await dependencies.saveModules(result.modules);
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
/home/willi/.bun/bin/bun test src/ticks/index.test.ts
```

Expected: PASS.

---

### Task 4: Add `habitat tick <count>` CLI Command

**Files:**
- Create: `src/ticks/cli.ts`
- Modify: `src/cli.ts`

**Interfaces:**
- Consumes:
  - `runPowerTicks(tickCount: number): Promise<PowerTickResult>`
- Produces:
  - `registerTickCommands(program: Command): void`
  - CLI command `habitat tick <count>`

- [ ] **Step 1: Create CLI formatter and command wiring**

Create `src/ticks/cli.ts`:

```ts
import { Command } from "commander";

import { runPowerTicks } from "./index";
import type { PowerTickSummary } from "./types";

export function registerTickCommands(program: Command): void {
  program
    .command("tick")
    .description("Run local power simulation ticks.")
    .argument("<count>", "Number of one-second ticks to run")
    .action(async (count: string) => {
      const result = await runPowerTicks(parseTickCount(count));
      console.log(formatPowerTickSummary(result.summary));
    });
}

function parseTickCount(value: string): number {
  const tickCount = Number(value);

  if (!Number.isInteger(tickCount) || tickCount <= 0) {
    throw new Error("Tick count must be a positive integer.");
  }

  return tickCount;
}

export function formatPowerTickSummary(summary: PowerTickSummary): string {
  const lines = [
    `ticks: ${summary.tickCount}`,
    `activePowerDrawKw: ${formatNumber(summary.activePowerDrawKw)}`,
    `energyDemandKwh: ${formatNumber(summary.energyDemandKwh)}`,
    `energyDrainedKwh: ${formatNumber(summary.energyDrainedKwh)}`,
    `unmetEnergyKwh: ${formatNumber(summary.unmetEnergyKwh)}`,
  ];

  for (const drain of summary.batteryDrains) {
    lines.push(
      `battery: ${drain.displayName} ${formatNumber(drain.beforeEnergyStoredKwh)} -> ${formatNumber(
        drain.afterEnergyStoredKwh,
      )} kWh`,
    );
  }

  return lines.join("\n");
}

function formatNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}
```

- [ ] **Step 2: Wire command into the root CLI**

Modify `src/cli.ts`:

```ts
import { registerTickCommands } from "./ticks/cli";
```

Then call it after `registerModuleCommands(program);`:

```ts
registerTickCommands(program);
```

- [ ] **Step 3: Run typecheck**

Run:

```bash
PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun run check
```

Expected: PASS.

---

### Task 5: Verify CLI Behavior End To End

**Files:**
- No source file changes expected.

**Interfaces:**
- Consumes:
  - `habitat tick <count>`
  - local `.habitat/modules.json`
- Produces: verified command behavior

- [ ] **Step 1: Run focused tests**

Run:

```bash
/home/willi/.bun/bin/bun test src/ticks/index.test.ts src/modules/index.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
PATH=/home/willi/.bun/bin:$PATH /home/willi/.bun/bin/bun run check
```

Expected: PASS.

- [ ] **Step 3: Inspect command help**

Run:

```bash
/home/willi/.bun/bin/bun run ./src/cli.ts --help
```

Expected: output includes a `tick` command.

- [ ] **Step 4: Manually verify a local tick**

Use existing local module state if available. The test scenario requires at least one active module with `runtimeAttributes.powerDrawKw` and one active battery module with `runtimeAttributes.energyStoredKwh`.

Run:

```bash
/home/willi/.bun/bin/bun run ./src/cli.ts tick 60
```

Expected: output includes `ticks: 60`, a positive `energyDemandKwh` when active power draw exists, and battery lines showing stored kWh decreasing.

---

## Self-Review

- Spec coverage: The plan covers power-only tick behavior, one-second tick math, module runtime attributes, battery drain, CLI tick count, persistence, and verification.
- Placeholder scan: No placeholders remain.
- Type consistency: `PowerTickInput`, `PowerTickResult`, `PowerTickSummary`, `runPowerTicks`, and `registerTickCommands` are defined before they are consumed.
