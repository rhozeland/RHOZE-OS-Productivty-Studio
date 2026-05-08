import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

const MAX_BOOTSTRAP_ATTEMPTS = 20;
const RETRY_DELAY_MS = 300;

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function bootstrapApp() {
  for (let attempt = 1; attempt <= MAX_BOOTSTRAP_ATTEMPTS; attempt += 1) {
    try {
      await import("./main-app");
      return;
    } catch (error) {
      const isLastAttempt = attempt === MAX_BOOTSTRAP_ATTEMPTS;

      if (isLastAttempt) {
        throw error;
      }

      await wait(RETRY_DELAY_MS);
    }
  }
}

void bootstrapApp();
