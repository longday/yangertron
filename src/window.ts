import {
  BrowserWindow,
  nativeImage,
  desktopCapturer,
  type Session,
} from "electron";
import path from "node:path";

import { installAnalyticsBlocker } from "./utils/ublock";
import { log } from "./utils/logger";

type NavigationPhase = "start" | "finish" | "in-page";

export interface MainWindowOptions {
  appUrl: string;
  preloadDir: string;
  iconPath: string;
  userAgent: string;
  isInternalUrl: (url: string) => boolean;
  openExternal: (url: string) => void;
  shouldHideOnClose: () => boolean;
  shouldShowOnReady: () => boolean;
  onReady?: () => void;
  onTitleChange?: (title: string) => void;
  onUrlChange?: (url: string) => void;
  onClosed?: () => void;
  customCss?: string;
  initialBounds?: {
    width: number;
    height: number;
  };
  onBoundsChange?: (bounds: { width: number; height: number }) => void;
  isManagedModeEnabled: () => boolean;
}

const hookedSessions = new WeakSet<Session>();
const permissionHandledSessions = new WeakSet<Session>();

function configureMediaPermissions(session: Session) {
  if (permissionHandledSessions.has(session)) {
    return;
  }

  session.setPermissionCheckHandler(() => true);

  session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });

  session.setDisplayMediaRequestHandler((request, callback) => {
    void (async () => {
      try {
        type DisplayMediaRequest = {
          video?: {
            mandatorySources?: string[];
          };
        };

        const videoRequest = (request as DisplayMediaRequest).video;
        const requestedTypes = Array.isArray(videoRequest?.mandatorySources)
          ? videoRequest!.mandatorySources.filter(
              (type): type is "screen" | "window" =>
                type === "screen" || type === "window",
            )
          : [];

        const captureTypes: ("screen" | "window")[] = requestedTypes.length
          ? requestedTypes
          : ["screen", "window"];

        const sources = await desktopCapturer.getSources({
          types: captureTypes,
          fetchWindowIcons: true,
          thumbnailSize: { width: 0, height: 0 },
        });

        const preferred = sources.find((source) =>
          source.id.startsWith("screen:"),
        );
        const fallback = sources[0];

        const target = preferred ?? fallback;

        if (!target) {
          log.error("[permissions] no desktop capture sources available");
          callback({});
          return;
        }

        callback({
          video: target,
        });
      } catch (error) {
        log.error(
          "[permissions] failed to fulfill display media request",
          error,
        );
        callback({});
      }
    })();
  });

  permissionHandledSessions.add(session);
}

function applyUserAgent(session: Session, userAgent: string) {
  if (hookedSessions.has(session)) {
    return;
  }

  session.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      cancel: false,
      requestHeaders: {
        ...details.requestHeaders,
        "User-Agent": userAgent,
      },
    });
  });

  hookedSessions.add(session);
}

function logNavigation(phase: NavigationPhase, url: string) {
  if (!url) {
    return;
  }

  log.info(`[nav] ${phase} → ${url}`);
}

export function createMainWindow(options: MainWindowOptions) {
  const iconImage = nativeImage.createFromPath(options.iconPath);
  if (iconImage.isEmpty()) {
    log.warn(`[window] icon file not found or invalid: ${options.iconPath}`);
  }

  // eslint-disable-next-line electron/default-value-changed
  const browserWindow = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    icon: iconImage.isEmpty() ? undefined : iconImage,
    width: options.initialBounds?.width,
    height: options.initialBounds?.height,
    webPreferences: {
      preload: path.join(options.preloadDir, "preload.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  const { session } = browserWindow.webContents;
  applyUserAgent(session, options.userAgent);
  installAnalyticsBlocker(session, options.isManagedModeEnabled);
  configureMediaPermissions(session);
  browserWindow.webContents.setUserAgent(options.userAgent);

  let customCssKey: string | null = null;

  const hideToTray = () => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    browserWindow.setSkipTaskbar(true);
    browserWindow.hide();
  };

  const markVisible = () => {
    if (browserWindow.isDestroyed()) {
      return;
    }

    browserWindow.setSkipTaskbar(false);
    if (!iconImage.isEmpty()) {
      browserWindow.setIcon(iconImage);
    }
  };

  const ensureCustomCss = () => {
    if (!options.customCss) {
      return;
    }

    if (!options.isManagedModeEnabled()) {
      if (customCssKey) {
        browserWindow.webContents
          .removeInsertedCSS(customCssKey)
          .catch((error) => {
            log.error("[css] failed to remove custom stylesheet", error);
          });
        customCssKey = null;
      }
      return;
    }

    if (customCssKey) {
      return;
    }

    browserWindow.webContents
      .insertCSS(options.customCss)
      .then((key) => {
        customCssKey = key;
      })
      .catch((error) => {
        log.error("[css] failed to insert custom stylesheet", error);
      });
  };

  browserWindow.on("closed", () => {
    options.onClosed?.();
  });

  browserWindow.on("resize", () => {
    if (!browserWindow.isDestroyed()) {
      const [width, height] = browserWindow.getSize();
      options.onBoundsChange?.({ width, height });
    }
  });

  browserWindow.on("close", (event) => {
    if (!options.shouldHideOnClose()) {
      return;
    }

    event.preventDefault();
    hideToTray();
  });

  browserWindow.on("show", markVisible);
  browserWindow.on("restore", markVisible);

  browserWindow.webContents.on("page-title-updated", (_event, title) => {
    options.onTitleChange?.(title);
  });

  browserWindow.webContents.on("did-finish-load", () => {
    if (!browserWindow.isVisible() && options.shouldShowOnReady()) {
      browserWindow.show();
      browserWindow.focus();
    }
    options.onReady?.();
    browserWindow.webContents.send(
      "main-process-message",
      new Date().toLocaleString(),
    );
    ensureCustomCss();
  });

  browserWindow.webContents.on("dom-ready", () => {
    ensureCustomCss();
  });

  browserWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription, validatedURL) => {
      log.error("Failed to load URL", {
        errorCode,
        errorDescription,
        validatedURL,
      });
    },
  );

  browserWindow.webContents.on(
    "did-start-navigation",
    (_event, url, _isInPlace, isMainFrame) => {
      if (isMainFrame) {
        logNavigation("start", url);
      }
    },
  );

  browserWindow.webContents.on("did-navigate", (_event, url) => {
    logNavigation("finish", url);
    options.onUrlChange?.(url);
    ensureCustomCss();
  });

  browserWindow.webContents.on(
    "did-navigate-in-page",
    (_event, url, isMainFrame) => {
      if (isMainFrame) {
        logNavigation("in-page", url);
        options.onUrlChange?.(url);
        ensureCustomCss();
      }
    },
  );

  browserWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!options.isManagedModeEnabled()) {
      return { action: "allow" };
    }

    if (options.isInternalUrl(url)) {
      if (url && url !== "about:blank") {
        browserWindow.loadURL(url);
      }
      return { action: "deny" };
    }

    options.openExternal(url);
    return { action: "deny" };
  });

  browserWindow.webContents.on("will-navigate", (event, url) => {
    if (!options.isManagedModeEnabled()) {
      return;
    }

    if (options.isInternalUrl(url)) {
      return;
    }

    event.preventDefault();
    options.openExternal(url);
  });

  browserWindow.loadURL(options.appUrl);

  return browserWindow;
}
