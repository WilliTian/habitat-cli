import { requestHabitatApiJson } from "./client";
import type { IndustryResource, ProductionBlueprint } from "../kepler/types";

type HabitatApiRequestOptions = NonNullable<Parameters<typeof requestHabitatApiJson>[1]>;

type BlueprintCatalogResource = {
  blueprints: ProductionBlueprint[];
};

type BlueprintResource = {
  blueprint: ProductionBlueprint;
};

type ResourceCatalogResource = {
  resources: IndustryResource[];
};

export async function readBlueprintCatalog(
  options?: HabitatApiRequestOptions,
): Promise<BlueprintCatalogResource> {
  return requestHabitatApiJson<BlueprintCatalogResource>("/catalog/blueprints", options);
}

export async function readBlueprint(
  blueprintId: string,
  options?: HabitatApiRequestOptions,
): Promise<BlueprintResource> {
  return requestHabitatApiJson<BlueprintResource>(
    `/catalog/blueprints/${encodeURIComponent(blueprintId)}`,
    options,
  );
}

export async function readResourceCatalog(
  options?: HabitatApiRequestOptions,
): Promise<ResourceCatalogResource> {
  return requestHabitatApiJson<ResourceCatalogResource>("/catalog/resources", options);
}
