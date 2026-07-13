import { Hono } from "hono";

import { backendErrorHandler } from "./errors";
import {
  registerRegistrationRoutes,
  type RegistrationRouteDependencies,
} from "./registration";

type RequestLogger = (message: string) => void;

export type BackendAppDependencies = {
  registration?: RegistrationRouteDependencies;
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

  return app;
}
