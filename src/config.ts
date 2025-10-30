import path from "node:path";
import type { WindowBounds } from "./state/window";

export const APP_URL = "https://messenger.360.yandex.ru/";

export const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";

export const DEFAULT_WINDOW_BOUNDS: WindowBounds = { width: 1280, height: 800 };

export const resolveIconPaths = (appRoot: string) => ({
  iconPath: path.join(appRoot, "resources", "messenger.png"),
  trayBlueIconPath: path.join(appRoot, "resources", "tray-blue.png"),
  trayRedIconPath: path.join(appRoot, "resources", "tray-red.png"),
});
