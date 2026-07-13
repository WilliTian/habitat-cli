import { requestHabitatApiJson } from "./client";
import type {
  HabitatModule,
  HabitatModuleCreateInput,
  HabitatModuleUpdateInput,
} from "../modules/types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

export type ModulesResource = {
  modules: HabitatModule[];
};

export type ModuleResource = {
  module: HabitatModule;
};

export async function readModules(
  options?: HabitatApiRequestOptions,
): Promise<ModulesResource> {
  return requestHabitatApiJson<ModulesResource>("/modules", options);
}

export async function replaceModules(
  modules: HabitatModule[],
  options?: HabitatApiRequestOptions,
): Promise<ModulesResource> {
  return requestHabitatApiJson<ModulesResource>("/modules", {
    ...options,
    method: "PUT",
    body: { modules },
  });
}

export async function createModuleResource(
  input: HabitatModuleCreateInput,
  options?: HabitatApiRequestOptions,
): Promise<ModuleResource> {
  return requestHabitatApiJson<ModuleResource>("/modules", {
    ...options,
    method: "POST",
    body: input,
  });
}

export async function readModule(
  id: string,
  options?: HabitatApiRequestOptions,
): Promise<ModuleResource> {
  return requestHabitatApiJson<ModuleResource>(modulePath(id), options);
}

export async function updateModuleResource(
  id: string,
  input: HabitatModuleUpdateInput,
  options?: HabitatApiRequestOptions,
): Promise<ModuleResource> {
  return requestHabitatApiJson<ModuleResource>(modulePath(id), {
    ...options,
    method: "PATCH",
    body: input,
  });
}

export async function deleteModuleResource(
  id: string,
  options?: HabitatApiRequestOptions,
): Promise<ModuleResource> {
  return requestHabitatApiJson<ModuleResource>(modulePath(id), {
    ...options,
    method: "DELETE",
  });
}

function modulePath(id: string): string {
  return `/modules/${encodeURIComponent(id)}`;
}
