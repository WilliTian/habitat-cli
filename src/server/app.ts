import { Hono } from "hono";

import {
  registerRegistrationRoutes,
  type RegistrationRouteDependencies,
} from "./registration";

export type BackendAppDependencies = {
  registration?: RegistrationRouteDependencies;
};

export function createBackendApp(
  dependencies: BackendAppDependencies = {},
): Hono {
  const app = new Hono();

  registerRegistrationRoutes(app, dependencies.registration);

  return app;
}
