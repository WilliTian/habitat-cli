import type { Context } from "hono";

import { setHabitatApiSummary } from "./logging";

export class BackendHttpError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 500 | 502,
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "BackendHttpError";
  }
}

export function backendErrorHandler(error: Error, context: Context) {
  if (error instanceof BackendHttpError) {
    setHabitatApiSummary(context, `${error.status} ${error.code}`);
    return context.json(
      { error: { code: error.code, message: error.message } },
      error.status,
    );
  }

  setHabitatApiSummary(context, "500 internal_error");
  return context.json(
    {
      error: {
        code: "internal_error",
        message: "The Habitat API could not complete the request.",
      },
    },
    500,
  );
}
