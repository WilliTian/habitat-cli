const defaultBaseUrl = "https://planet.turingguild.com";

function getBaseUrl(): string {
  const rawBaseUrl = process.env.KEPLER_BASE_URL?.trim();

  if (!rawBaseUrl) {
    return defaultBaseUrl;
  }

  return rawBaseUrl.replace(/\/+$/, "");
}

function getToken(): string {
  const token =
    process.env.KEPLER_PLANET_TOKEN?.trim() ??
    process.env.KEPLER_WORLD_TOKEN?.trim() ??
    process.env.PLANET_TOKEN?.trim();

  if (!token) {
    throw new Error(
      "Missing Kepler auth token. Set KEPLER_PLANET_TOKEN in your environment or .env file.",
    );
  }

  return token;
}

export async function requestKeplerJson<T>(
  path: string,
  options: {
    method: "GET" | "POST" | "DELETE";
    body?: unknown;
    expectedStatus: number;
  },
): Promise<T> {
  const response = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${getToken()}`,
      Accept: "application/json",
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

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
