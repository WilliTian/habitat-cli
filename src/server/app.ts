import { Hono } from "hono";

import { backendErrorHandler } from "./errors";
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
    logger(`Habitat API ${context.req.method} ${context.req.path} ${context.res.status}`);
  });
  app.onError(backendErrorHandler);

  registerRegistrationRoutes(app, dependencies.registration);
  registerCatalogRoutes(app, dependencies.catalog);
  registerSolarRoutes(app, dependencies.solar);
  registerModuleRoutes(app, dependencies.modules);
  registerInventoryRoutes(app, dependencies.inventory);

  return app;
}
