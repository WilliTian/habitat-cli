import { readModules } from "../api/modules";
import type { HabitatModule } from "../modules/types";
import { buildHabitatStatus } from "./format";
import type { HabitatStatus } from "./types";

export { buildHabitatStatus, formatHabitatStatus } from "./format";

type HabitatStatusDependencies = {
  loadModules: () => Promise<HabitatModule[]>;
};

const defaultDependencies: HabitatStatusDependencies = {
  loadModules: async () => (await readModules()).modules,
};

export async function readHabitatStatus(
  dependencies: HabitatStatusDependencies = defaultDependencies,
): Promise<HabitatStatus> {
  const modules = await dependencies.loadModules();
  return buildHabitatStatus(modules);
}
