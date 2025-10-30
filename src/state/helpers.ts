import type { SettingsStore, WindowBounds } from "./window";
import { DEFAULT_WINDOW_BOUNDS } from "../config";

const isWindowBounds = (value: unknown): value is WindowBounds => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.width === "number" &&
    typeof record.height === "number" &&
    Number.isFinite(record.width) &&
    Number.isFinite(record.height) &&
    record.width > 0 &&
    record.height > 0
  );
};

export const loadWindowBounds = (store: SettingsStore): WindowBounds => {
  const candidate = store.get<unknown>("windowBounds", undefined);
  if (isWindowBounds(candidate)) {
    return {
      width: candidate.width,
      height: candidate.height,
    };
  }

  return { ...DEFAULT_WINDOW_BOUNDS };
};

export const loadManagedMode = (store: SettingsStore): boolean => {
  const candidate = store.get("managedMode", false);
  return typeof candidate === "boolean" ? candidate : false;
};

export const loadCloseToTray = (store: SettingsStore): boolean => {
  const candidate = store.get("closeToTray", true);
  return typeof candidate === "boolean" ? candidate : true;
};

export const loadShowOnStartup = (store: SettingsStore): boolean => {
  const candidate = store.get("showOnStartup", false);
  return typeof candidate === "boolean" ? candidate : false;
};
