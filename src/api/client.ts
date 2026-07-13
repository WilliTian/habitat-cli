const defaultApiBaseUrl = "http://localhost:8787";

type HabitatApiMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

type HabitatApiEnvironment = NodeJS.ProcessEnv;

type HabitatApiRequestOptions = {
  method?: HabitatApiMethod;
  body?: unknown;
  headers?: HeadersInit;
  fetchImpl?: typeof fetch;
  environment?: HabitatApiEnvironment;
};

type ErrorResponseBody = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

type NestedErrorResponse = {
  message?: unknown;
};

export class HabitatApiError extends Error {
  readonly backendMessage?: string;
  readonly status: number;
  readonly path: string;

  constructor(input: {
    backendMessage?: string;
    message: string;
    path: string;
    status: number;
  }) {
    super(input.message);
    this.name = "HabitatApiError";
    this.backendMessage = input.backendMessage;
    this.status = input.status;
    this.path = input.path;
  }
}

export function readHabitatApiBaseUrl(
  environment: HabitatApiEnvironment = process.env,
): string {
  const value = environment.HABITAT_API_BASE_URL?.trim();

  if (!value) {
    return defaultApiBaseUrl;
  }

  return value.replace(/\/+$/, "");
}

export async function requestHabitatApiJson<T>(
  path: string,
  options: HabitatApiRequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const method = options.method ?? "GET";
  const baseUrl = readHabitatApiBaseUrl(options.environment);
  const url = `${baseUrl}${normalizeApiPath(path)}`;

  let response: Response;

  try {
    response = await fetchImpl(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch (error) {
    throw new Error(
      `Could not reach the Habitat API at ${baseUrl}. Start the server with "bun run server" and try again.`,
      { cause: error },
    );
  }

  if (!response.ok) {
    throw await createHabitatApiError(path, response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseText = await response.text();

  if (responseText.trim().length === 0) {
    return undefined as T;
  }

  return JSON.parse(responseText) as T;
}

async function createHabitatApiError(
  path: string,
  response: Response,
): Promise<HabitatApiError> {
  const responseText = await response.text();
  const errorMessage = extractErrorMessage(responseText);
  const pathLabel = normalizeApiPath(path);
  const message = errorMessage
    ? `Habitat API request failed for ${pathLabel}: ${errorMessage}`
    : `Habitat API request failed for ${pathLabel} with ${response.status} ${response.statusText}.`;

  return new HabitatApiError({
    backendMessage: errorMessage,
    message,
    path: pathLabel,
    status: response.status,
  });
}

function extractErrorMessage(responseText: string): string | undefined {
  const trimmed = responseText.trim();

  if (trimmed.length === 0) {
    return undefined;
  }

  try {
    const body = JSON.parse(trimmed) as ErrorResponseBody;
    const message = firstString(
      body.error,
      readNestedErrorMessage(body.error),
      body.message,
      body.details,
    );
    return message?.trim() || trimmed;
  } catch {
    return trimmed;
  }
}

function readNestedErrorMessage(error: unknown): unknown {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return (error as NestedErrorResponse).message;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function normalizeApiPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}
