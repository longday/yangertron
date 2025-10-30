import type { Session } from "electron";

import { log } from "./logger";

interface BlockRule {
  match(url: URL): boolean;
  reason: string;
}

const blockedHosts = [
  "metrika.yandex.ru",
  "mc.yandex.ru",
  "mc.webvisor.org",
  "an.yandex.ru",
];

const blockedPathFragments = [
  /\/metrika\//i,
  /\/analytics\//i,
  /\/collect/i,
  /\/watch/i,
];

const rules: BlockRule[] = [
  {
    match: (url) =>
      blockedHosts.some(
        (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
      ),
    reason: "blocked-host",
  },
  {
    match: (url) =>
      blockedPathFragments.some((pattern) => pattern.test(url.pathname)),
    reason: "blocked-path",
  },
];

const blockedSchemes = new Set(["http:", "https:"]);

const hookedSessions = new WeakSet<Session>();

const truncateUrl = (value: string, limit = 100): string => {
  if (value.length <= limit) {
    return value;
  }

  return `${value.slice(0, limit - 1)}…`;
};

const decodeUrl = (value: string): string => {
  try {
    return decodeURI(value);
  } catch (error) {
    log.warn("[ublock] failed to decode url", truncateUrl(value), error);
    return value;
  }
};

export function installAnalyticsBlocker(
  session: Session,
  isManagedModeEnabled: () => boolean,
) {
  if (hookedSessions.has(session)) {
    return;
  }

  session.webRequest.onBeforeRequest(
    { urls: ["*://*/*"] },
    (details, callback) => {
      if (!isManagedModeEnabled()) {
        callback({ cancel: false });
        return;
      }

      const { url: rawUrl, resourceType } = details;
      if (!rawUrl) {
        callback({ cancel: false });
        return;
      }

      try {
        const url = new URL(rawUrl);
        if (!blockedSchemes.has(url.protocol)) {
          callback({ cancel: false });
          return;
        }

        if (resourceType === "mainFrame" || resourceType === "subFrame") {
          callback({ cancel: false });
          return;
        }

        const matchedRule = rules.find((rule) => rule.match(url));
        if (matchedRule) {
          log.info(
            `[ublock] cancel ${truncateUrl(decodeUrl(rawUrl))} (${matchedRule.reason})`,
          );
          callback({ cancel: true });
          return;
        }
      } catch (error) {
        log.warn(
          "[ublock] failed to parse url",
          truncateUrl(decodeUrl(rawUrl)),
          error,
        );
      }

      callback({ cancel: false });
    },
  );

  hookedSessions.add(session);
}
