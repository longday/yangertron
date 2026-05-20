import {
  BrowserWindow,
  Menu,
  MenuItem,
  type MenuItemConstructorOptions,
} from "electron";

import type { ProxyProfile } from "./state/proxy";

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
  proxyProfiles: ProxyProfile[];
  getSelectedProxyId(): string | null;
  onSelectProxy(proxyId: string | null): void | Promise<void>;
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

  const proxyMenuItems: MenuItemConstructorOptions[] = [
    {
      label: "Restart app to apply proxy changes",
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Direct connection",
      type: "radio",
      checked: options.getSelectedProxyId() === null,
      click: () => {
        void options.onSelectProxy(null);
      },
    },
  ];

  for (const profile of options.proxyProfiles) {
    proxyMenuItems.push({
      label: profile.id,
      type: "radio",
      checked: options.getSelectedProxyId() === profile.id,
      click: () => {
        void options.onSelectProxy(profile.id);
      },
    });
  }

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
      {
        label: "Proxy (restart required)",
        submenu: proxyMenuItems,
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
