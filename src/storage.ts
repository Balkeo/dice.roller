// src/storage.ts
import type { UserConfig } from "./types";
const KEY = "teal-dice:user-config";

export function loadUserConfig(): UserConfig | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as UserConfig;
  } catch { return null; }
}

export function saveUserConfig(cfg: UserConfig) {
  try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch {}
}
