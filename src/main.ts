import { app, BrowserWindow, type Session } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { createNavigationHelpers } from "./navigation";
import { createTrayManager } from "./tray";
import { createMainWindow } from "./window";
import { ensureMessengerMenu } from "./menu";
import { loadCustomCss } from "./mods/css";
import { createSettingsStore, type WindowBounds } from "./state/window";
import {
  loadProxyProfiles,
  loadSelectedProxyId,
  persistSelectedProxyId,
  type ProxyProfile,
} from "./state/proxy";
import { APP_URL, USER_AGENT, resolveIconPaths } from "./config";
import {
  loadWindowBounds,
  loadManagedMode,
  loadCloseToTray,
  loadShowOnStartup,
} from "./state/helpers";
import { log } from "./utils/logger";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");
const APP_ROOT = process.env.APP_ROOT;
process.env.VITE_PUBLIC = APP_ROOT;

const RUNTIME_DIR = path.join(APP_ROOT, ".runtime");
const PROXY_CONFIG_PATH = path.join(APP_ROOT, "proxy.yml");
mkdirSync(RUNTIME_DIR, { recursive: true });
app.setPath("userData", RUNTIME_DIR);

app.commandLine.appendSwitch("enable-features", "WebRTCPipeWireCapturer");

const settingsStore = createSettingsStore(RUNTIME_DIR);

const {
  iconPath: ICON_PATH,
  trayBlueIconPath: TRAY_BLUE_ICON_PATH,
  trayRedIconPath: TRAY_RED_ICON_PATH,
} = resolveIconPaths(APP_ROOT);

const navigation = createNavigationHelpers(APP_URL);
const proxyProfiles = loadProxyProfiles(PROXY_CONFIG_PATH);

let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let mainWindowPromise: Promise<BrowserWindow> | null = null;
let windowBounds: WindowBounds = loadWindowBounds(settingsStore);
let managedModeEnabled = loadManagedMode(settingsStore);
let closeToTrayEnabled = loadCloseToTray(settingsStore);
let showOnStartupEnabled = loadShowOnStartup(settingsStore);
let selectedProxyId = loadSelectedProxyId(settingsStore);
let activeProxyId: string | null = null;

const isKnownProxyProfile = (proxyId: string | null): proxyId is string => {
  return (
    proxyId !== null && proxyProfiles.some((profile) => profile.id === proxyId)
  );
};

if (!isKnownProxyProfile(selectedProxyId)) {
  if (selectedProxyId !== null) {
    log.warn(`[proxy] unknown stored profile id: ${selectedProxyId}`);
  }
  selectedProxyId = null;
  persistSelectedProxyId(settingsStore, null);
}

const hasNotifications = (): boolean => {
  const title = mainWindow?.getTitle() ?? "";
  const url = mainWindow?.webContents.getURL() ?? "";
  return navigation.isMain(url) && /\d/.test(title);
};

let updateTrayState: () => void = () => {};

const findProxyProfile = (proxyId: string | null): ProxyProfile | null => {
  if (!proxyId) {
    return null;
  }

  return proxyProfiles.find((profile) => profile.id === proxyId) ?? null;
};

const getActiveProxyProfile = (): ProxyProfile | null => {
  return findProxyProfile(activeProxyId);
};

const applyProxyProfile = async (
  session: Session,
  proxyId: string | null,
): Promise<boolean> => {
  const profile = findProxyProfile(proxyId);
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
};

const focusWindow = (window: BrowserWindow) => {
  window.show();
  window.focus();
};

app.on("login", (event, _webContents, _request, authInfo, callback) => {
  if (!authInfo.isProxy) {
    return;
  }

  const profile = getActiveProxyProfile();
  if (!profile?.username || profile.password === undefined) {
    return;
  }

  event.preventDefault();
  callback(profile.username, profile.password);
});

const ensureWindow = (): Promise<BrowserWindow> => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindowPromise ?? Promise.resolve(mainWindow);
  }

  const isManagedModeEnabled = () => managedModeEnabled;
  const isCloseToTrayEnabled = () => closeToTrayEnabled;
  const isShowOnStartupEnabled = () => showOnStartupEnabled;

  mainWindow = createMainWindow({
    preloadDir: __dirname,
    iconPath: ICON_PATH,
    userAgent: USER_AGENT,
    isInternalUrl: navigation.isInternal,
    openExternal: navigation.openExternal,
    shouldHideOnClose: () => isCloseToTrayEnabled() && !isQuitting,
    shouldShowOnReady: () => isShowOnStartupEnabled(),
    customCss: loadCustomCss(APP_ROOT),
    initialBounds: windowBounds,
    onBoundsChange: (bounds) => {
      windowBounds = bounds;
      settingsStore.set("windowBounds", bounds);
    },
    onReady: () => updateTrayState(),
    onTitleChange: () => updateTrayState(),
    onUrlChange: () => updateTrayState(),
    onClosed: () => {
      mainWindow = null;
      mainWindowPromise = null;
    },
    isManagedModeEnabled,
  });

  ensureMessengerMenu(mainWindow, {
    isManagedModeEnabled,
    onToggleManagedMode: (enabled) => {
      if (managedModeEnabled === enabled) {
        return;
      }

      managedModeEnabled = enabled;
      settingsStore.set("managedMode", enabled);

      const targetWindow = mainWindow;
      if (!targetWindow || targetWindow.isDestroyed()) {
        return;
      }

      targetWindow.webContents.reload();
    },
    isCloseToTrayEnabled,
    onToggleCloseToTray: (enabled) => {
      if (closeToTrayEnabled === enabled) {
        return;
      }

      closeToTrayEnabled = enabled;
      settingsStore.set("closeToTray", enabled);
    },
    isShowOnStartupEnabled,
    onToggleShowOnStartup: (enabled) => {
      if (showOnStartupEnabled === enabled) {
        return;
      }

      showOnStartupEnabled = enabled;
      settingsStore.set("showOnStartup", enabled);
    },
    proxyProfiles,
    getSelectedProxyId: () => selectedProxyId,
    onSelectProxy: (proxyId) => {
      const nextProxyId = isKnownProxyProfile(proxyId) ? proxyId : null;
      if (selectedProxyId === nextProxyId) {
        return;
      }

      selectedProxyId = nextProxyId;
      persistSelectedProxyId(settingsStore, nextProxyId);
    },
  });

  mainWindowPromise = (async () => {
    const targetWindow = mainWindow;
    if (!targetWindow || targetWindow.isDestroyed()) {
      throw new Error("Main window is unavailable during initialization");
    }

    await applyProxyProfile(targetWindow.webContents.session, selectedProxyId);
    await targetWindow.loadURL(APP_URL);

    return targetWindow;
  })();

  return mainWindowPromise;
};

const trayManager = createTrayManager({
  blueIconPath: TRAY_BLUE_ICON_PATH,
  redIconPath: TRAY_RED_ICON_PATH,
  fallbackIconPath: ICON_PATH,
  onShow: () => {
    void ensureWindow()
      .then((window) => {
        focusWindow(window);
      })
      .catch((error) => {
        log.error("[window] failed to show window", error);
      });
  },
  onHide: () => {
    mainWindow?.hide();
  },
  onToggle: () => {
    void ensureWindow()
      .then((window) => {
        if (window.isVisible()) {
          window.hide();
        } else {
          focusWindow(window);
        }
      })
      .catch((error) => {
        log.error("[window] failed to toggle window", error);
      });
  },
  onQuit: () => {
    isQuitting = true;
    trayManager.destroy();
    app.quit();
  },
});

updateTrayState = (): void => {
  trayManager.update({
    alert: hasNotifications(),
  });
};

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    isQuitting = true;
    app.quit();
    mainWindow = null;
  }
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void ensureWindow()
      .then((window) => {
        focusWindow(window);
      })
      .catch((error) => {
        log.error("[window] failed to activate window", error);
      });
    return;
  }

  if (mainWindow && !mainWindow.isDestroyed()) {
    focusWindow(mainWindow);
  }
});

const singleInstanceLock = app.requestSingleInstanceLock();

if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized() || !mainWindow.isVisible()) {
        mainWindow.restore();
      }
      focusWindow(mainWindow);
    } else {
      void ensureWindow()
        .then((window) => {
          focusWindow(window);
        })
        .catch((error) => {
          log.error("[window] failed to handle second instance", error);
        });
    }
  });

  app.whenReady().then(() => {
    void ensureWindow()
      .then(() => {
        trayManager.ensure();
        updateTrayState();
      })
      .catch((error) => {
        log.error("[window] failed during startup", error);
      });
  });
}
