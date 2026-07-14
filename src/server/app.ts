import { Hono } from "hono";

import { backendErrorHandler } from "./errors";
import { formatHabitatApiLog } from "./logging";
import {
  registerRegistrationRoutes,
  type RegistrationRouteDependencies,
} from "./registration";
import {
  registerCatalogRoutes,
  type CatalogRouteDependencies,
} from "./catalog";
import {
  registerSolarRoutes,
  type SolarRouteDependencies,
} from "./solar";
import {
  registerModuleRoutes,
  type ModuleRouteDependencies,
} from "./modules";
import {
  registerInventoryRoutes,
  type InventoryRouteDependencies,
} from "./inventory";

type RequestLogger = (message: string) => void;

export type BackendAppDependencies = {
  registration?: RegistrationRouteDependencies;
  catalog?: CatalogRouteDependencies;
  solar?: SolarRouteDependencies;
  modules?: ModuleRouteDependencies;
  inventory?: InventoryRouteDependencies;
  logger?: RequestLogger;
};

export function createBackendApp(
  dependencies: BackendAppDependencies = {},
): Hono {
  const app = new Hono();
  const logger = dependencies.logger ?? console.log;

  app.use("*", async (context, next) => {
    await next();
    logger(formatHabitatApiLog(context));
  });
  app.onError(backendErrorHandler);

  registerRegistrationRoutes(app, dependencies.registration);
  registerCatalogRoutes(app, dependencies.catalog);
  registerSolarRoutes(app, dependencies.solar);
  registerModuleRoutes(app, dependencies.modules);
  registerInventoryRoutes(app, dependencies.inventory);

  return app;
}
