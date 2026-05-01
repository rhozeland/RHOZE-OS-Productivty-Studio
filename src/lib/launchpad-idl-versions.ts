/**
 * Launchpad IDL versions — store multiple IDL+programId pairs per network
 * (devnet / mainnet-beta) and switch the active one on the fly.
 *
 * Storage shape (localStorage key "launchpad-idl-versions"):
 *   {
 *     versions: IdlVersion[],
 *     activeByNetwork: { devnet: id|null, "mainnet-beta": id|null }
 *   }
 *
 * The legacy single-slot keys ("launchpad-idl-json", "launchpad-program-id")
 * are mirrored from the active version of the *current* network so the
 * existing on-chain client keeps working without changes.
 */
import { validateLaunchpadIdl } from "./launchpad-idl-validator";

export type LaunchpadNetwork = "devnet" | "mainnet-beta";

export interface IdlVersion {
  id: string;                 // local uuid
  network: LaunchpadNetwork;
  label: string;              // user-friendly name, e.g. "v0.3 with graduation fix"
  programId: string;          // base58
  idlJson: string;            // raw JSON text (so we can re-validate / re-edit)
  createdAt: number;          // epoch ms
  notes?: string;             // optional free text
}

interface VersionsState {
  versions: IdlVersion[];
  activeByNetwork: Record<LaunchpadNetwork, string | null>;
}

const LS_VERSIONS = "launchpad-idl-versions";
const LS_LEGACY_IDL = "launchpad-idl-json";
const LS_LEGACY_PID = "launchpad-program-id";

const EMPTY_STATE: VersionsState = {
  versions: [],
  activeByNetwork: { devnet: null, "mainnet-beta": null },
};

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export const subscribeVersions = (cb: () => void): (() => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};

const readState = (): VersionsState => {
  if (typeof window === "undefined") return { ...EMPTY_STATE };
  try {
    const raw = window.localStorage.getItem(LS_VERSIONS);
    if (!raw) return { ...EMPTY_STATE, activeByNetwork: { ...EMPTY_STATE.activeByNetwork } };
    const parsed = JSON.parse(raw) as Partial<VersionsState>;
    return {
      versions: Array.isArray(parsed.versions) ? parsed.versions.filter(isVersion) : [],
      activeByNetwork: {
        devnet: parsed.activeByNetwork?.devnet ?? null,
        "mainnet-beta": parsed.activeByNetwork?.["mainnet-beta"] ?? null,
      },
    };
  } catch {
    return { ...EMPTY_STATE, activeByNetwork: { ...EMPTY_STATE.activeByNetwork } };
  }
};

const isVersion = (v: unknown): v is IdlVersion => {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    (r.network === "devnet" || r.network === "mainnet-beta") &&
    typeof r.label === "string" &&
    typeof r.programId === "string" &&
    typeof r.idlJson === "string" &&
    typeof r.createdAt === "number"
  );
};

const writeState = (state: VersionsState): void => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LS_VERSIONS, JSON.stringify(state));
  notify();
};

const newId = (): string => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
};

/** Mirror the active version for `network` into the legacy single-slot keys. */
const syncLegacyMirror = (network: LaunchpadNetwork): void => {
  if (typeof window === "undefined") return;
  const state = readState();
  const activeId = state.activeByNetwork[network];
  const active = state.versions.find((v) => v.id === activeId) ?? null;
  if (active) {
    window.localStorage.setItem(LS_LEGACY_IDL, active.idlJson);
    window.localStorage.setItem(LS_LEGACY_PID, active.programId);
  } else {
    window.localStorage.removeItem(LS_LEGACY_IDL);
    window.localStorage.removeItem(LS_LEGACY_PID);
  }
};

// ---------- Public API ----------

export const getCurrentNetwork = (): LaunchpadNetwork => {
  const env = (import.meta.env.VITE_LAUNCHPAD_NETWORK as LaunchpadNetwork | undefined) ?? "devnet";
  return env === "mainnet-beta" ? "mainnet-beta" : "devnet";
};

export const listVersions = (network?: LaunchpadNetwork): IdlVersion[] => {
  const state = readState();
  return network ? state.versions.filter((v) => v.network === network) : state.versions;
};

export const getActiveVersionId = (network: LaunchpadNetwork): string | null =>
  readState().activeByNetwork[network];

export const getActiveVersion = (network: LaunchpadNetwork): IdlVersion | null => {
  const state = readState();
  const id = state.activeByNetwork[network];
  return id ? state.versions.find((v) => v.id === id) ?? null : null;
};

export interface SaveVersionInput {
  network: LaunchpadNetwork;
  label: string;
  programId: string;
  idlJson: string;
  notes?: string;
  activate?: boolean; // default true
}

export const saveVersion = (input: SaveVersionInput): IdlVersion => {
  const label = input.label.trim() || `Untitled ${new Date().toLocaleDateString()}`;
  const programId = input.programId.trim();
  if (!programId) throw new Error("Program ID is required.");
  const validation = validateLaunchpadIdl(input.idlJson);
  if (!validation.ok) {
    const blockers = validation.issues.filter((i) => i.severity === "error");
    throw new Error(
      `Invalid IDL — fix the following before saving:\n${blockers.map((i) => `• ${i.field}: ${i.message}`).join("\n")}`,
    );
  }

  const state = readState();
  const version: IdlVersion = {
    id: newId(),
    network: input.network,
    label,
    programId,
    idlJson: input.idlJson.trim(),
    notes: input.notes?.trim() || undefined,
    createdAt: Date.now(),
  };
  state.versions.unshift(version);
  if (input.activate !== false) {
    state.activeByNetwork[input.network] = version.id;
  }
  writeState(state);
  if (input.activate !== false) syncLegacyMirror(input.network);
  return version;
};

export const updateVersion = (
  id: string,
  patch: Partial<Pick<IdlVersion, "label" | "notes" | "programId" | "idlJson">>,
): IdlVersion => {
  const state = readState();
  const idx = state.versions.findIndex((v) => v.id === id);
  if (idx < 0) throw new Error("Version not found.");
  const next: IdlVersion = { ...state.versions[idx] };
  if (patch.label !== undefined) next.label = patch.label.trim() || next.label;
  if (patch.notes !== undefined) next.notes = patch.notes.trim() || undefined;
  if (patch.programId !== undefined) {
    const pid = patch.programId.trim();
    if (!pid) throw new Error("Program ID cannot be empty.");
    next.programId = pid;
  }
  if (patch.idlJson !== undefined) {
    const v = validateLaunchpadIdl(patch.idlJson);
    if (!v.ok) {
      const blockers = v.issues.filter((i) => i.severity === "error");
      throw new Error(
        `Invalid IDL — ${blockers.map((i) => `${i.field}: ${i.message}`).join("; ")}`,
      );
    }
    next.idlJson = patch.idlJson.trim();
  }
  state.versions[idx] = next;
  writeState(state);
  // If this version is currently active, refresh the legacy mirror.
  if (state.activeByNetwork[next.network] === id) syncLegacyMirror(next.network);
  return next;
};

export const deleteVersion = (id: string): void => {
  const state = readState();
  const target = state.versions.find((v) => v.id === id);
  if (!target) return;
  state.versions = state.versions.filter((v) => v.id !== id);
  // If we deleted the active one, clear the active pointer for that network.
  if (state.activeByNetwork[target.network] === id) {
    state.activeByNetwork[target.network] = null;
  }
  writeState(state);
  syncLegacyMirror(target.network);
};

export const activateVersion = (id: string): IdlVersion | null => {
  const state = readState();
  const target = state.versions.find((v) => v.id === id);
  if (!target) return null;
  state.activeByNetwork[target.network] = id;
  writeState(state);
  syncLegacyMirror(target.network);
  return target;
};

export const deactivateNetwork = (network: LaunchpadNetwork): void => {
  const state = readState();
  state.activeByNetwork[network] = null;
  writeState(state);
  syncLegacyMirror(network);
};

/** Called once at boot to ensure the legacy mirror reflects current state. */
export const hydrateLegacyMirror = (): void => {
  const state = readState();
  // Only overwrite the legacy keys if at least one version exists for the
  // current network — preserves any pre-versions paste the user may already
  // have in localStorage.
  const network = getCurrentNetwork();
  if (state.versions.some((v) => v.network === network)) {
    syncLegacyMirror(network);
  }
};
