# Deployment Record

## Deployed revision

- Git commit: `3cd2d45` (`Move Habitat database to project root`)

## Connectivity verification

- The Habitat API responded successfully when called locally on the LXC.
- The laptop CLI reached the LXC API through Tailscale. Running `habitat status` returned a registered habitat named `Cygnus Seven` with six starter modules and seven total modules.

## OpenClaw server request log

When the laptop ran `habitat status`, the server logged:

```text
[habitat-api] GET /status -> status refreshed for Cygnus Seven
```

## Manual-server shutdown behavior

After stopping the manually started API server, the laptop CLI failed with the expected connection error indicating that it could not reach the Habitat API and should start the server with `bun run server`.

## Network binding

The server uses `0.0.0.0` so it listens on all network interfaces on the LXC. Binding only to `localhost` or `127.0.0.1` would accept requests originating on the LXC itself but reject requests arriving remotely, including those routed through Tailscale.

## Local secrets and state

The checkout intentionally retains `.env` and the local SQLite state file (`state.sqlite`; sometimes referred to as `habitat.sqlite` in deployment instructions). They are required at runtime: `.env` supplies local configuration and the database preserves the habitat's local state. Git ignores both files so local secrets and mutable runtime state are not committed or pushed.
