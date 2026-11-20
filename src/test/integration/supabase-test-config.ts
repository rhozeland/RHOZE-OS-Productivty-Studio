import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const addProjectIdFromUrl = (projectIds: Set<string>, url: string | undefined) => {
  if (!url) return;
  try {
    const hostname = new URL(url).hostname;
    if (hostname.endsWith(".supabase.co")) {
      projectIds.add(hostname.slice(0, -".supabase.co".length));
    }
  } catch {
    // Ignore malformed optional app environment URLs; only valid URLs can be guarded.
  }
};

const getApplicationProjectIds = (projectRoot: string) => {
  const configPath = resolve(projectRoot, "supabase/config.toml");
  const appProjectId = existsSync(configPath)
    ? readFileSync(configPath, "utf8").match(/^project_id\s*=\s*"([^"]+)"/m)?.[1]
    : undefined;
  const projectIds = new Set(appProjectId ? [appProjectId] : []);

  addProjectIdFromUrl(projectIds, process.env.VITE_SUPABASE_URL);

  const envFiles = readdirSync(projectRoot).filter(
    (fileName) => fileName === ".env" || fileName.startsWith(".env."),
  );
  for (const fileName of envFiles) {
    const envContents = readFileSync(resolve(projectRoot, fileName), "utf8");
    const configuredUrl = envContents.match(
      /^\s*VITE_SUPABASE_URL\s*=\s*["']?(https?:\/\/[^"'#\s]+)["']?/m,
    )?.[1];
    addProjectIdFromUrl(projectIds, configuredUrl);
  }

  return projectIds;
};

const isLoopbackHost = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";

export interface SupabaseTestConfig {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  enabled: boolean;
}

/**
 * Load integration credentials only when the explicit suite flag is enabled.
 * Mutating suites are restricted to local Supabase or a separately identified
 * dedicated project, and may never target the app's configured project.
 */
export const getSupabaseTestConfig = (
  runFlag: string,
  options: { projectRoot?: string } = {},
): SupabaseTestConfig => {
  const url = process.env.SUPABASE_TEST_URL ?? "";
  const anonKey = process.env.SUPABASE_TEST_ANON_KEY ?? "";
  const serviceRoleKey = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? "";
  const enabled = Boolean(url && anonKey && serviceRoleKey) && process.env[runFlag] === "1";

  if (!enabled) return { url, anonKey, serviceRoleKey, enabled: false };

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`${runFlag}=1 requires SUPABASE_TEST_URL to be a valid URL`);
  }

  const environment = process.env.SUPABASE_TEST_ENVIRONMENT;
  if (environment === "local") {
    if (!isLoopbackHost(parsedUrl.hostname)) {
      throw new Error(`${runFlag}=1 marked the target local, but ${parsedUrl.hostname} is not a loopback host`);
    }
  } else if (environment === "dedicated") {
    const expectedProject = process.env.SUPABASE_TEST_PROJECT_REF ?? "";
    const actualProject = parsedUrl.hostname.endsWith(".supabase.co")
      ? parsedUrl.hostname.slice(0, -".supabase.co".length)
      : "";
    if (!expectedProject || actualProject !== expectedProject) {
      throw new Error(`${runFlag}=1 requires SUPABASE_TEST_PROJECT_REF to match the dedicated Supabase URL`);
    }
    if (getApplicationProjectIds(options.projectRoot ?? process.cwd()).has(actualProject)) {
      throw new Error(`${runFlag}=1 refuses to mutate a Supabase project configured for the app`);
    }
  } else {
    throw new Error(`${runFlag}=1 requires SUPABASE_TEST_ENVIRONMENT=local or dedicated`);
  }

  return { url, anonKey, serviceRoleKey, enabled: true };
};
