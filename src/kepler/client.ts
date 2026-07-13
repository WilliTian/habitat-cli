const defaultBaseUrl = "https://planet.turingguild.com";

type KeplerEnvironment = NodeJS.ProcessEnv;

type RequestLogger = (message: string) => void;

type KeplerRequestOptions = {
  method: "GET" | "POST" | "DELETE";
  body?: unknown;
  expectedStatus: number;
  environment?: KeplerEnvironment;
  fetchImpl?: typeof fetch;
  logger?: RequestLogger;
};

function getBaseUrl(environment: KeplerEnvironment = process.env): string {
  const rawBaseUrl = environment.KEPLER_BASE_URL?.trim();

  if (!rawBaseUrl) {
    return defaultBaseUrl;
  }

  return rawBaseUrl.replace(/\/+$/, "");
}

export function readKeplerApiToken(
  environment: KeplerEnvironment = process.env,
): string {
  const token =
    environment.KEPLER_PLANET_TOKEN?.trim() ??
    environment.KEPLER_WORLD_TOKEN?.trim() ??
    environment.PLANET_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Missing Kepler auth token. Set KEPLER_PLANET_TOKEN in your environment or .env file.",
    );
  }

  return token;
}

export function tryReadKeplerApiToken(): string | undefined {
  try {
    return readKeplerApiToken();
  } catch {
    return undefined;
  }
}

export async function requestKeplerJson<T>(
  path: string,
  options: KeplerRequestOptions,
): Promise<T> {
  const url = new URL(`${getBaseUrl(options.environment)}${path}`);
  const fetchImpl = options.fetchImpl ?? fetch;
  const logger = options.logger ?? console.log;

  logger(`Kepler ${options.method} ${url.pathname} outbound`);

  const requestInit = {
    method: options.method,
    headers: {
      Authorization: `Bearer ${readKeplerApiToken(options.environment)}`,
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  };
  let response: Response;

  try {
    response = await fetchImpl(url.toString(), requestInit);
  } catch {
    throw new Error("Kepler request failed: transport error");
  }

  logger(`Kepler ${options.method} ${url.pathname} ${response.status}`);

  const responseText = await response.text();

  if (response.status !== options.expectedStatus) {
    const suffix = responseText.trim().length > 0 ? `: ${responseText.trim()}` : "";
    throw new Error(`Kepler request failed with ${response.status}${suffix}`);
  }

  if (responseText.trim().length === 0) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}
