import { describe, expect, test } from "bun:test";

import {
  formatHabitatServerAddress,
  resolveHabitatServerConfig,
} from "./index";

describe("server configuration", () => {
  test("defaults to localhost-safe development settings", () => {
    expect(resolveHabitatServerConfig({})).toEqual({
      hostname: "127.0.0.1",
      port: 8787,
    });
  });

  test("uses explicit host and port overrides", () => {
    expect(
      resolveHabitatServerConfig({
        HABITAT_API_HOST: "0.0.0.0",
        HABITAT_API_PORT: "9000",
      }),
    ).toEqual({
      hostname: "0.0.0.0",
      port: 9000,
    });
  });

  test("rejects invalid port values", () => {
    expect(() =>
      resolveHabitatServerConfig({
        HABITAT_API_PORT: "not-a-port",
      }),
    ).toThrow("HABITAT_API_PORT must be an integer between 1 and 65535.");
  });

  test("formats the listening address", () => {
    expect(
      formatHabitatServerAddress({
        hostname: "127.0.0.1",
        port: 8787,
      }),
    ).toBe("http://127.0.0.1:8787");
  });
});
