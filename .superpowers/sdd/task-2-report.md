# Task 2 Report

Implemented the Task 2 contract changes in `src/ticks` only.

## What changed

- Added the solar input shape and battery charge type to `src/ticks/types.ts`.
- Extended `PowerTickInput` with optional `solarIrradiance`.
- Extended `PowerTickSummary` with solar generation, net power, irradiance, condition, charged energy, and battery charge tracking fields.
- Added four tick tests in `src/ticks/index.test.ts` covering:
  - solar generation offsetting load before battery drain,
  - surplus solar charging batteries,
  - night producing zero solar output,
  - charging capped at battery capacity.

## Verification

- Attempted `bun test src/ticks/index.test.ts`, but `bun` is not installed in this environment.
- Ran `npm exec --yes --package typescript -- tsc --noEmit`.
- Result: typecheck fails in `src/ticks/index.ts` because the production tick summary has not yet been updated to include the new solar and battery-charge fields. That is the expected implementation gap for this task boundary.

## Notes

- I did not modify files outside the task-owned `src/ticks/types.ts` and `src/ticks/index.test.ts`.
- The repository already contained unrelated modified and untracked files, which I left untouched.

## Task 2 Fix Follow-up

Updated the solar surplus test so it no longer only exercises `condition: "clear"`.

### What changed

- Switched the surplus-charging case to `condition: "dust"`.
- Added runtime assertions for `summary.solarIrradianceWPerM2` and `summary.solarCondition`.
- Added runtime assertions for the `summary.batteryCharges` entry so the battery-charge tracking shape is covered directly.

### Verification

- Ran `/home/willi/.bun/bin/bun test src/ticks/index.test.ts`.
- Result: the new assertions are in place, but the file still fails against the current `src/ticks/index.ts` implementation because the solar summary fields are not populated yet.
- Ran `/home/willi/.bun/bin/bun x tsc --noEmit`.
- Result: TypeScript still reports `src/ticks/index.ts` as missing the solar summary fields required by `PowerTickSummary`.

### Conclusion

- The test coverage gap identified in review is fixed.
- The remaining failure is the existing implementation gap in the tick simulation, not the new assertions.
