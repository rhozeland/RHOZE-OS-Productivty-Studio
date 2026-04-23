import { useEffect, useState } from "react";

export interface ClaimLimits {
  min: number | null;
  max: number | null;
}

const STORAGE_KEY = "rhoze_claim_limits_v1";
const EVENT = "rhoze-claim-limits-changed";

export const DEFAULT_LIMITS: ClaimLimits = { min: null, max: null };

export const readClaimLimits = (): ClaimLimits => {
  if (typeof window === "undefined") return DEFAULT_LIMITS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIMITS;
    const parsed = JSON.parse(raw);
    const min =
      typeof parsed.min === "number" && isFinite(parsed.min) && parsed.min > 0 ? parsed.min : null;
    const max =
      typeof parsed.max === "number" && isFinite(parsed.max) && parsed.max > 0 ? parsed.max : null;
    return { min, max };
  } catch {
    return DEFAULT_LIMITS;
  }
};

export const writeClaimLimits = (limits: ClaimLimits) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(limits));
  window.dispatchEvent(new CustomEvent(EVENT));
};

export interface ClaimValidation {
  ok: boolean;
  reason: string;
}

export const validateClaim = (
  amount: number,
  limits: ClaimLimits = readClaimLimits()
): ClaimValidation => {
  if (limits.min != null && amount < limits.min) {
    return {
      ok: false,
      reason: `Amount is below your minimum claim of ${limits.min.toLocaleString()} $RHOZE.`,
    };
  }
  if (limits.max != null && amount > limits.max) {
    return {
      ok: false,
      reason: `Amount exceeds your maximum claim of ${limits.max.toLocaleString()} $RHOZE.`,
    };
  }
  return { ok: true, reason: "" };
};

export const useClaimLimits = (): ClaimLimits => {
  const [limits, setLimits] = useState<ClaimLimits>(() => readClaimLimits());
  useEffect(() => {
    const sync = () => setLimits(readClaimLimits());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return limits;
};
