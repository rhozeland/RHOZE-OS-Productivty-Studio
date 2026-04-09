import { Buffer } from "buffer";
globalThis.Buffer = Buffer;

import("./main-app").then(() => {});
