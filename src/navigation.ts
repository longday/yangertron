import { shell } from "electron";

import { log } from "./utils/logger";

export interface NavigationHelpers {
  normalizePathname(pathname: string): string;
  isInternal(url: string): boolean;
  isMain(url: string): boolean;
  openExternal(url: string): void;
}

function normalizePathname(pathname: string) {
  if (!pathname) {
    return "/";
  }

  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "" ? "/" : normalized;
}

export function createNavigationHelpers(appUrl: string): NavigationHelpers {
  const mainUrl = new URL(appUrl);
  const mainHost = mainUrl.host;
  const mainPathname = normalizePathname(mainUrl.pathname);

  const isInternal = (url: string) => {
    try {
      const { protocol, hostname } = new URL(url);

      if (protocol === "about:" || protocol === "chrome:") {
        return true;
      }

      if (hostname === "localhost" || hostname === "127.0.0.1") {
        return true;
      }

      return hostname === mainHost || hostname.endsWith(`.${mainHost}`);
    } catch (_error) {
      return false;
    }
  };

  const isMain = (url: string) => {
    try {
      const parsed = new URL(url);
      if (parsed.host !== mainHost) {
        return false;
      }

      return normalizePathname(parsed.pathname) === mainPathname;
    } catch (_error) {
      return false;
    }
  };

  const openWithShell = (url: string) => {
    log.info("Attempting to open external URL via shell", { url });

    shell
      .openExternal(url)
      .then(() => {
        log.info("shell.openExternal handed off to system", { url });
      })
      .catch((error) => {
        log.error("shell.openExternal failed", { url, error });
      });
  };

  const openExternal = (url: string) => {
    if (!url) {
      log.warn("openExternal called without a URL");
      return;
    }

    openWithShell(url);
  };

  return {
    normalizePathname,
    isInternal,
    isMain,
    openExternal,
  };
}
