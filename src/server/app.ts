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

type RequestLogger = (message: string) => void;

export type BackendAppDependencies = {
  registration?: RegistrationRouteDependencies;
  catalog?: CatalogRouteDependencies;
  solar?: SolarRouteDependencies;
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

  return app;
}
