import type { Session } from "electron";

import {
  loadProxyProfiles,
  loadSelectedProxyId,
  persistSelectedProxyId,
  type ProxyProfile,
} from "../state/proxy";
import type { SettingsStore } from "../state/window";
import { log } from "../utils/logger";

interface CreateProxyRuntimeOptions {
  configPath: string;
  settingsStore: SettingsStore;
}

interface ProxyAuthInfo {
  isProxy: boolean;
}

type ProxyLoginCallback = (username: string, password: string) => void;

export interface ProxyRuntime {
  readonly profiles: ProxyProfile[];
  getSelectedProxyId(): string | null;
  selectProxyForNextLaunch(proxyId: string | null): void;
  applyToSession(session: Session): Promise<boolean>;
  handleLogin(authInfo: ProxyAuthInfo, callback: ProxyLoginCallback): boolean;
}

export const createProxyRuntime = (
  options: CreateProxyRuntimeOptions,
): ProxyRuntime => {
  const profiles = loadProxyProfiles(options.configPath);
  let selectedProxyId = loadSelectedProxyId(options.settingsStore);
  let activeProxyId: string | null = null;

  const isKnownProxyProfile = (proxyId: string | null): proxyId is string => {
    return (
      proxyId !== null && profiles.some((profile) => profile.id === proxyId)
    );
  };

  const findProxyProfile = (proxyId: string | null): ProxyProfile | null => {
    if (!proxyId) {
      return null;
    }

    return profiles.find((profile) => profile.id === proxyId) ?? null;
  };

  if (!isKnownProxyProfile(selectedProxyId)) {
    if (selectedProxyId !== null) {
      log.warn(`[proxy] unknown stored profile id: ${selectedProxyId}`);
    }
    selectedProxyId = null;
    persistSelectedProxyId(options.settingsStore, null);
  }

  return {
    profiles,
    getSelectedProxyId: () => selectedProxyId,
    selectProxyForNextLaunch: (proxyId) => {
      const nextProxyId = isKnownProxyProfile(proxyId) ? proxyId : null;
      if (selectedProxyId === nextProxyId) {
        return;
      }

      selectedProxyId = nextProxyId;
      persistSelectedProxyId(options.settingsStore, nextProxyId);
    },
    applyToSession: async (session) => {
      const profile = findProxyProfile(selectedProxyId);
      const nextActiveProxyId = profile?.id ?? null;

      try {
        if (profile) {
          await session.setProxy({
            mode: "fixed_servers",
            proxyRules: profile.server,
            proxyBypassRules: profile.bypassRules,
          });
          log.info(`[proxy] applied profile: ${profile.id}`);
        } else {
          await session.setProxy({ mode: "direct" });
          log.info("[proxy] using direct connection");
        }

        await session.closeAllConnections();
        activeProxyId = nextActiveProxyId;
        return true;
      } catch (error) {
        log.error("[proxy] failed to apply proxy settings", error);
        return false;
      }
    },
    handleLogin: (authInfo, callback) => {
      if (!authInfo.isProxy) {
        return false;
      }

      const profile = findProxyProfile(activeProxyId);
      if (!profile?.username || profile.password === undefined) {
        return false;
      }

      callback(profile.username, profile.password);
      return true;
    },
  };
};
