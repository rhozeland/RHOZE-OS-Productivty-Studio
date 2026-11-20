import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { getSupabaseTestConfig } from "./supabase-test-config";

const runFlag = "RUN_SUPABASE_TEST_CONFIG_CHECK";
const configProjectId = "app-config-project";
let projectRoot: string;

const setDedicatedTarget = (projectId: string) => {
  vi.stubEnv("SUPABASE_TEST_URL", `https://${projectId}.supabase.co`);
  vi.stubEnv("SUPABASE_TEST_ANON_KEY", "test-anon");
  vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
  vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "dedicated");
  vi.stubEnv("SUPABASE_TEST_PROJECT_REF", projectId);
  vi.stubEnv(runFlag, "1");
};

describe("Supabase integration target safety", () => {
  beforeEach(() => {
    projectRoot = mkdtempSync(join(tmpdir(), "supabase-test-config-"));
    mkdirSync(resolve(projectRoot, "supabase"));
    writeFileSync(
      resolve(projectRoot, "supabase/config.toml"),
      `project_id = "${configProjectId}"\n`,
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    rmSync(projectRoot, { recursive: true, force: true });
  });

  it("does not enable a suite without its explicit run flag", () => {
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "local");
    vi.stubEnv(runFlag, "0");

    expect(getSupabaseTestConfig(runFlag, { projectRoot }).enabled).toBe(false);
  });

  it("accepts an explicitly declared loopback Supabase target", () => {
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "test-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "local");
    vi.stubEnv(runFlag, "1");

    expect(getSupabaseTestConfig(runFlag, { projectRoot }).enabled).toBe(true);
  });

  it("refuses the Supabase project configured in supabase/config.toml", () => {
    setDedicatedTarget(configProjectId);

    expect(() => getSupabaseTestConfig(runFlag, { projectRoot })).toThrow(
      /refuses to mutate a Supabase project configured for the app/,
    );
  });

  it("refuses the app project configured in process.env.VITE_SUPABASE_URL", () => {
    const projectId = "vite-runtime-project";
    vi.stubEnv("VITE_SUPABASE_URL", `https://${projectId}.supabase.co`);
    setDedicatedTarget(projectId);

    expect(() => getSupabaseTestConfig(runFlag, { projectRoot })).toThrow(
      /refuses to mutate a Supabase project configured for the app/,
    );
  });

  it.each([".env.local", ".env.development.local", ".env.test.local"])(
    "refuses the app project configured in %s",
    (fileName) => {
      const projectId = `configured-in-${fileName.replace(/[^a-z0-9]/gi, "-")}`;
      writeFileSync(
        resolve(projectRoot, fileName),
        `VITE_SUPABASE_URL=https://${projectId}.supabase.co\n`,
      );
      setDedicatedTarget(projectId);

      expect(() => getSupabaseTestConfig(runFlag, { projectRoot })).toThrow(
        /refuses to mutate a Supabase project configured for the app/,
      );
    },
  );

  it("accepts a dedicated remote project not configured for the app", () => {
    setDedicatedTarget("dedicated-test-project");

    expect(getSupabaseTestConfig(runFlag, { projectRoot }).enabled).toBe(true);
  });

  it("does not fall back to VITE_SUPABASE_URL when the test URL is missing", () => {
    vi.stubEnv("SUPABASE_TEST_URL", "");
    vi.stubEnv("VITE_SUPABASE_URL", "https://app-project.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "app-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "dedicated");
    vi.stubEnv("SUPABASE_TEST_PROJECT_REF", "app-project");
    vi.stubEnv(runFlag, "1");

    expect(getSupabaseTestConfig(runFlag, { projectRoot })).toMatchObject({
      url: "",
      enabled: false,
    });
  });

  it("does not fall back to VITE_SUPABASE_PUBLISHABLE_KEY when the test anon key is missing", () => {
    vi.stubEnv("SUPABASE_TEST_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_TEST_ANON_KEY", "");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "app-anon");
    vi.stubEnv("SUPABASE_TEST_SERVICE_ROLE_KEY", "test-service");
    vi.stubEnv("SUPABASE_TEST_ENVIRONMENT", "local");
    vi.stubEnv(runFlag, "1");

    expect(getSupabaseTestConfig(runFlag, { projectRoot })).toMatchObject({
      anonKey: "",
      enabled: false,
    });
  });
});
