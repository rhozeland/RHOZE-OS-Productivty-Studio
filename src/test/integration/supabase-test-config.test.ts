import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getSupabaseTestConfig } from "./supabase-test-config";

const runFlag = "RUN_SUPABASE_TEST_CONFIG_CHECK";
const projectId = readFileSync(resolve(process.cwd(), "supabase/config.toml"), "utf8")
  .match(/^project_id\s*=\s*"([^"]+)"/m)?.[1] ?? "";

describe("Supabase integration target safety", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("does not enable a suite without its explicit run flag", () => {
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "local");
    vi.stubEnv(runFlag, "0");

    expect(getSupabaseTestConfig(runFlag).enabled).toBe(false);
  });

  it("accepts an explicitly declared loopback Supabase target", () => {
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "local");
    vi.stubEnv(runFlag, "1");

    expect(getSupabaseTestConfig(runFlag).enabled).toBe(true);
  });

  it("refuses the Supabase project configured for the app", () => {
    vi.stubEnv("SUPABASE_TEST_URL", `https://${projectId}.supabase.co`);
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "dedicated");
    vi.stubEnv("SUPABASE_TEST_PROJECT_REF", projectId);
    vi.stubEnv(runFlag, "1");

    expect(() => getSupabaseTestConfig(runFlag)).toThrow(/refuses to mutate a Supabase project configured for the app/);
  });
});
