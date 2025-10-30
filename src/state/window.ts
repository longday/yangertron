import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

import { log } from "../utils/logger";

export interface WindowBounds {
  width: number;
  height: number;
}

type SettingsRecord = Record<string, unknown>;

export interface SettingsStore {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  all(): SettingsRecord;
}

const SETTINGS_FILE_NAME = "settings.json";

export function createSettingsStore(runtimeDir: string): SettingsStore {
  const statePath = path.join(runtimeDir, SETTINGS_FILE_NAME);
  let cache = loadFromDisk(statePath);

  const persist = () => {
    try {
      writeFileSync(statePath, JSON.stringify(cache), { encoding: "utf-8" });
    } catch (error) {
      log.error("[settings] failed to save", error);
    }
  };

  const get = <T>(key: string, fallback: T): T => {
    const value = cache[key];
    return value === undefined ? fallback : (value as T);
  };

  const set = <T>(key: string, value: T): void => {
    cache = {
      ...cache,
      [key]: value,
    };
    persist();
  };

  const all = (): SettingsRecord => ({ ...cache });

  return { get, set, all };
}

function loadFromDisk(statePath: string): SettingsRecord {
  try {
    const raw = readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (isPlainRecord(parsed)) {
      return parsed;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      log.warn("[settings] failed to load", error);
    }
  }

  return {};
}

function isPlainRecord(value: unknown): value is SettingsRecord {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
