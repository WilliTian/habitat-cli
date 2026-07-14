import { createBackendApp } from "./app";

const defaultServerHost = "0.0.0.0";
const defaultServerPort = 8787;

type ServerEnvironment = NodeJS.ProcessEnv;

export type HabitatServerConfig = {
  hostname: string;
  port: number;
};

export function resolveHabitatServerConfig(
  environment: ServerEnvironment = process.env,
): HabitatServerConfig {
  return {
    hostname: resolveServerHost(environment),
    port: resolveServerPort(environment),
  };
}

export function startHabitatServer(
  environment: ServerEnvironment = process.env,
): Bun.Server {
  const app = createBackendApp();
  const config = resolveHabitatServerConfig(environment);

  return Bun.serve({
    hostname: config.hostname,
    port: config.port,
    fetch: app.fetch,
  });
}

export function formatHabitatServerAddress(config: HabitatServerConfig): string {
  return `http://${config.hostname}:${config.port}`;
}

function resolveServerHost(environment: ServerEnvironment): string {
  const value = environment.HABITAT_API_HOST?.trim();
  return value && value.length > 0 ? value : defaultServerHost;
}

function resolveServerPort(environment: ServerEnvironment): number {
  const value = environment.HABITAT_API_PORT?.trim();

  if (!value) {
    return defaultServerPort;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("HABITAT_API_PORT must be an integer between 1 and 65535.");
  }

  return port;
}

if (import.meta.main) {
  const config = resolveHabitatServerConfig();
  startHabitatServer();
  console.log(`Habitat API listening on ${formatHabitatServerAddress(config)}`);
}
