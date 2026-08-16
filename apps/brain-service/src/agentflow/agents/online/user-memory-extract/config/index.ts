import { getBrainServiceConfig } from "@fambrain/brain-config";
import type { UserMemoryAutoLearnConfig } from "../interface";

const envFlag = (name: string, defaultOn: boolean): boolean => {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return defaultOn;
  const s = raw.trim().toLowerCase();
  if (s === "1" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "false" || s === "no") return false;
  return defaultOn;
};

const envFloat = (name: string, fallback: number): number => {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
};

let cached: UserMemoryAutoLearnConfig | null = null;

export const resetUserMemoryAutoLearnConfigCache = (): void => {
  cached = null;
};

export const getUserMemoryAutoLearnConfig = (): UserMemoryAutoLearnConfig => {
  if (cached) return cached;
  const { ollama } = getBrainServiceConfig();
  const fromEnv = process.env.OLLAMA_MODEL_USER_MEMORY_EXTRACT?.trim();
  cached = {
    enabled: envFlag("USER_MEMORY_AUTO_LEARN_ENABLED", false),
    minConfidence: envFloat("USER_MEMORY_AUTO_LEARN_MIN_CONFIDENCE", 0.85),
    ollamaModel:
      fromEnv || ollama.models.intakeCoordinator || ollama.models.default,
  };
  return cached;
};
