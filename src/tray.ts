import { Menu, Tray, app, nativeImage } from "electron";

export type TrayVariant = "blue" | "red";

export interface TrayManagerOptions {
  blueIconPath: string;
  redIconPath: string;
  fallbackIconPath: string;
  onShow: () => void;
  onHide: () => void;
  onToggle: () => void;
  onQuit: () => void;
}

export interface TrayUpdatePayload {
  alert: boolean;
}

export interface TrayManager {
  ensure(): Tray;
  update(payload: TrayUpdatePayload): void;
  destroy(): void;
  currentVariant(): TrayVariant;
}

export function createTrayManager(options: TrayManagerOptions): TrayManager {
  let tray: Tray | null = null;
  let currentVariant: TrayVariant = "blue";
  const trayIcons: Record<TrayVariant, Electron.NativeImage> = {
    blue: nativeImage.createEmpty(),
    red: nativeImage.createEmpty(),
  };
  let fallbackIcon = nativeImage.createEmpty();

  const resizeForTray = (icon: Electron.NativeImage): Electron.NativeImage => {
    const targetSize = process.platform === "darwin" ? 22 : 64;
    const resized = icon.resize({
      width: targetSize,
      height: targetSize,
      quality: "best",
    });

    if (process.platform === "darwin") {
      resized.setTemplateImage(true);
    }

    return resized;
  };

  const loadIcon = (iconPath: string, options: { original?: boolean } = {}) => {
    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      return icon;
    }
    if (options.original) {
      return icon;
    }
    const resized = resizeForTray(icon);
    return resized;
  };

  const refreshIcons = () => {
    trayIcons.blue = loadIcon(options.blueIconPath);
    trayIcons.red = loadIcon(options.redIconPath);
    const baseFallback = nativeImage.createFromPath(options.fallbackIconPath);
    fallbackIcon = baseFallback.isEmpty()
      ? baseFallback
      : resizeForTray(baseFallback);
  };

  const resolveIcon = (variant: TrayVariant) => {
    const preferred = trayIcons[variant];
    if (!preferred.isEmpty()) {
      return preferred;
    }

    return fallbackIcon.isEmpty() ? preferred : fallbackIcon;
  };

  const setTrayIcon = (variant: TrayVariant) => {
    if (!tray) {
      return;
    }

    const image = resolveIcon(variant);
    const icon = image.isEmpty() ? fallbackIcon : image;
    tray.setImage(icon);
    const tooltipMessage =
      variant === "red"
        ? "Yandex Messenger — new notifications"
        : "Yandex Messenger";
    tray.setToolTip(tooltipMessage);
    currentVariant = variant;
  };

  const ensure = () => {
    if (tray) {
      return tray;
    }
    refreshIcons();
    const image = resolveIcon("blue");
    tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image);
    tray.setToolTip("Yandex Messenger");
    currentVariant = "blue";

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show Window",
        click: options.onShow,
      },
      {
        label: "Hide Window",
        click: options.onHide,
      },
      { type: "separator" },
      {
        label: "Quit",
        click: options.onQuit,
      },
    ]);

    tray.setContextMenu(contextMenu);
    tray.on("click", options.onToggle);
    setTrayIcon("blue");
    return tray;
  };

  const update = ({ alert }: TrayUpdatePayload) => {
    if (!tray) {
      ensure();
    }
    if (alert) {
      app.dock?.setBadge("•");
    } else {
      app.dock?.setBadge("");
    }
    const nextVariant: TrayVariant = alert ? "red" : "blue";
    if (currentVariant !== nextVariant) {
      setTrayIcon(nextVariant);
    }
  };

  const destroy = () => {
    tray?.destroy();
    tray = null;
  };

  app.dock?.setIcon(loadIcon(options.blueIconPath, { original: true }));

  return {
    ensure,
    update,
    destroy,
    currentVariant: () => currentVariant,
  };
}
