import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

const MAX_BOOTSTRAP_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;
const BOOTSTRAP_RELOAD_KEY = "rhoze-bootstrap-module-reload";

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const isModuleFetchError = (error: unknown) =>
  error instanceof TypeError &&
  /Failed to fetch dynamically imported module/i.test(error.message);

const showBootstrapError = (error: unknown) => {
  const root = document.getElementById("root");

  if (!root) {
    return;
  }

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;background:hsl(222 47% 11%);color:hsl(210 40% 98%);font-family:system-ui,sans-serif;">
      <div style="max-width:420px;text-align:center;">
        <h1 style="margin:0 0 12px;font-size:20px;font-weight:700;">Rhozeland couldn't load</h1>
        <p style="margin:0;color:hsl(215 20% 75%);line-height:1.5;">Please refresh once more. If it keeps happening, the latest app update may still be propagating.</p>
      </div>
    </div>
  `;

  throw error;
};

async function bootstrapApp() {
  for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt += 1) {
    try {
      await import("./main-app");
      sessionStorage.removeItem(BOOTSTRAP_RELOAD_KEY);
      return;
    } catch (error) {
      const isLastAttempt = attempt === MAX_BOOTSTRAP_ATTEMPTS;

       if (isModuleFetchError(error) && !sessionStorage.getItem(BOOTSTRAP_RELOAD_KEY)) {
        sessionStorage.setItem(BOOTSTRAP_RELOAD_KEY, "1");
        window.location.reload();
        return;
      }

      if (isLastAttempt) {
        sessionStorage.removeItem(BOOTSTRAP_RELOAD_KEY);
        throw error;
      }

      await wait(RETRY_DELAY_MS);
    }
  }
}

void bootstrapApp().catch(showBootstrapError);
