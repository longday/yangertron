import { BrowserWindow, Menu, MenuItem } from "electron";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const STEP = 0.1;

export interface MessengerMenuOptions {
  isManagedModeEnabled(): boolean;
  onToggleManagedMode(enabled: boolean): void;
  isCloseToTrayEnabled(): boolean;
  onToggleCloseToTray(enabled: boolean): void;
  isShowOnStartupEnabled(): boolean;
  onToggleShowOnStartup(enabled: boolean): void;
}

export function ensureMessengerMenu(
  window: BrowserWindow,
  options: MessengerMenuOptions,
) {
  const menu = Menu.getApplicationMenu() ?? new Menu();

  if (menu.items.some((item) => item.label === "Messenger")) {
    return;
  }

  const adjustZoom = (delta: number) => {
    const current = window.webContents.getZoomFactor();
    const next = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Number((current + delta).toFixed(2))),
    );
    window.webContents.setZoomFactor(next);
  };

  const messengerItem = new MenuItem({
    label: "Messenger",
    submenu: [
      {
        label: "Managed Mode",
        type: "checkbox",
        checked: options.isManagedModeEnabled(),
        click: (menuItem) => {
          options.onToggleManagedMode(Boolean(menuItem.checked));
        },
      },
      {
        label: "Close to Tray",
        type: "checkbox",
        checked: options.isCloseToTrayEnabled(),
        click: (menuItem) => {
          options.onToggleCloseToTray(Boolean(menuItem.checked));
        },
      },
      {
        label: "Show on Startup",
        type: "checkbox",
        checked: options.isShowOnStartupEnabled(),
        click: (menuItem) => {
          options.onToggleShowOnStartup(Boolean(menuItem.checked));
        },
      },
      { type: "separator" },
      {
        label: "Zoom +10%",
        click: () => adjustZoom(STEP),
      },
      {
        label: "Zoom -10%",
        click: () => adjustZoom(-STEP),
      },
    ],
  });

  menu.append(messengerItem);
  Menu.setApplicationMenu(menu);
}
