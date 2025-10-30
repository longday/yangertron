import { app, BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { createNavigationHelpers } from "./navigation";
import { createTrayManager } from "./tray";
import { createMainWindow } from "./window";
import { ensureMessengerMenu } from "./menu";
import { loadCustomCss } from "./mods/css";
import { createSettingsStore, type WindowBounds } from "./state/window";
import { APP_URL, USER_AGENT, resolveIconPaths } from "./config";
import {
  loadWindowBounds,
  loadManagedMode,
  loadCloseToTray,
  loadShowOnStartup,
} from "./state/helpers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.APP_ROOT = path.join(__dirname, "..");
const APP_ROOT = process.env.APP_ROOT;
process.env.VITE_PUBLIC = APP_ROOT;

const RUNTIME_DIR = path.join(APP_ROOT, ".runtime");
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

let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let windowBounds: WindowBounds = loadWindowBounds(settingsStore);
let managedModeEnabled = loadManagedMode(settingsStore);
let closeToTrayEnabled = loadCloseToTray(settingsStore);
let showOnStartupEnabled = loadShowOnStartup(settingsStore);

const hasNotifications = (): boolean => {
  const title = mainWindow?.getTitle() ?? "";
  const url = mainWindow?.webContents.getURL() ?? "";
  return navigation.isMain(url) && /\d/.test(title);
};

let updateTrayState: () => void = () => {};

const ensureWindow = (): BrowserWindow => {
  if (mainWindow) {
    return mainWindow;
  }

  const isManagedModeEnabled = () => managedModeEnabled;
  const isCloseToTrayEnabled = () => closeToTrayEnabled;
  const isShowOnStartupEnabled = () => showOnStartupEnabled;

  mainWindow = createMainWindow({
    appUrl: APP_URL,
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
  });

  return mainWindow!;
};

const trayManager = createTrayManager({
  blueIconPath: TRAY_BLUE_ICON_PATH,
  redIconPath: TRAY_RED_ICON_PATH,
  fallbackIconPath: ICON_PATH,
  onShow: () => {
    const window = ensureWindow();
    window.show();
    window.focus();
  },
  onHide: () => {
    mainWindow?.hide();
  },
  onToggle: () => {
    const window = ensureWindow();
    if (window.isVisible()) {
      window.hide();
    } else {
      window.show();
      window.focus();
    }
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
    ensureWindow();
  }

  mainWindow?.show();
  mainWindow?.focus();
});

app.whenReady().then(() => {
  ensureWindow();
  trayManager.ensure();
  updateTrayState();
});
