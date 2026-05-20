import { readFileSync } from "node:fs";
import { parse } from "yaml";

import { log } from "../utils/logger";
import type { SettingsStore } from "./window";

export interface ProxyProfile {
  id: string;
  server: string;
  bypassRules?: string;
  username?: string;
  password?: string;
}

type ProxyConfigRecord = Record<string, unknown>;

const PROXY_SELECTION_KEY = "proxyProfileId";

const isPlainRecord = (value: unknown): value is ProxyConfigRecord => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const normalizeCredential = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  return value;
};

const normalizeProfile = (value: unknown): ProxyProfile | null => {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = normalizeString(value.id);
  const server = normalizeString(value.server);
  const bypassRules = normalizeString(value.bypassRules) ?? undefined;
  const username = normalizeCredential(value.username);
  const password = normalizeCredential(value.password);

  if (!id || !server) {
    return null;
  }

  return {
    id,
    server,
    bypassRules,
    username,
    password,
  };
};

export const loadSelectedProxyId = (store: SettingsStore): string | null => {
  const candidate = store.get<unknown>(PROXY_SELECTION_KEY, null);
  return normalizeString(candidate);
};

export const persistSelectedProxyId = (
  store: SettingsStore,
  proxyId: string | null,
): void => {
  store.set(PROXY_SELECTION_KEY, proxyId);
};

export const loadProxyProfiles = (configPath: string): ProxyProfile[] => {
  try {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = parse(raw);
    const profileEntries = Array.isArray(parsed)
      ? parsed
      : isPlainRecord(parsed)
        ? parsed.profiles
        : undefined;

    if (!Array.isArray(profileEntries)) {
      log.warn(`[proxy] expected a profiles list in ${configPath}`);
      return [];
    }

    const seenIds = new Set<string>();
    const profiles: ProxyProfile[] = [];

    for (const entry of profileEntries) {
      const profile = normalizeProfile(entry);
      if (!profile) {
        log.warn("[proxy] skipping invalid profile entry", entry);
        continue;
      }

      if (seenIds.has(profile.id)) {
        log.warn(`[proxy] skipping duplicate profile id: ${profile.id}`);
        continue;
      }

      seenIds.add(profile.id);
      profiles.push(profile);
    }

    return profiles;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") {
      log.warn(`[proxy] config file not found: ${configPath}`);
    } else {
      log.error("[proxy] failed to load proxy config", error);
    }

    return [];
  }
};
