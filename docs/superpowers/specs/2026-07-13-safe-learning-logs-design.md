# Safe Learning Logs Design

## Goal

Make the backend terminal explain the CLI-to-Habitat and Habitat-to-Kepler request flow without logging credentials or payloads. Logs should be short enough for students to follow during normal CLI use.

## Log Contract

Each completed Habitat API request emits one line:

```text
[habitat-api] METHOD /path -> summary
```

Each Kepler request that receives a response emits one line:

```text
[kepler] METHOD /path -> status
```

Kepler requests that fail before receiving a response emit:

```text
[kepler] METHOD /path -> transport error
```

No log line may contain bearer tokens, API tokens, authorization headers, full request bodies, full response bodies, or raw error objects.

## Habitat API Summaries

Route handlers record a safe, domain-specific summary. Central middleware formats and emits the line after the response is complete. This keeps formatting consistent while allowing handlers to summarize data they already know without inspecting or serializing response bodies.

Examples include:

- `GET /registration -> not registered`
- `GET /registration -> registered as Cygnus Seven`
- `GET /modules -> 6 modules`
- `POST /modules -> created module module-123`
- `GET /inventory -> 3 resources`
- `GET /catalog/blueprints -> proxied to Kepler`
- `GET /solar/irradiance -> proxied to Kepler`

Failed requests use the HTTP status and safe backend error code:

```text
[habitat-api] GET /modules/missing -> 404 module_not_found
```

Unexpected failures use `500 internal_error`. Unknown routes fall back to the response status. Raw error messages are not part of the log contract.

## Components

`src/server/logging.ts` owns Habitat log formatting and request-scoped summary metadata. A small helper lets route handlers attach a summary to the Hono context without exposing it in HTTP headers or response JSON.

`src/server/app.ts` keeps the single logging middleware. It emits exactly one Habitat line per request using the attached summary or a status fallback.

The existing route modules attach summaries after successful domain operations. The backend error handler attaches safe status/code summaries for failures.

`src/kepler/client.ts` replaces the current outbound-plus-response pair with one response line. Its transport-error path logs one safe failure line. It continues to use only the URL pathname, never query data, headers, request bodies, response bodies, or tokens.

## Error Handling

Habitat API errors continue returning the existing structured JSON. Logging is observational and does not alter status codes or response bodies.

Kepler response logging occurs as soon as a response status is available, before response parsing. A malformed response therefore still records its actual HTTP status. Transport failures record no invented status.

## Testing

Tests will verify:

- registration summaries for registered and unregistered state;
- module and inventory count/action summaries;
- catalog and solar proxy summaries;
- safe status/code summaries for backend errors;
- exactly one Kepler completion line for successful and non-success responses;
- a transport-error Kepler line when no response exists;
- absence of tokens, authorization values, and request/response body contents;
- no changes to HTTP response contracts or CLI output.
