# Yangertron

Yangertron (**YAN**dex messen**GER** elec**TRON**) is an unofficial Yandex 360 Messenger desktop client built with Electron and Vite.

## Project status

Production mode builds and packaged installers are planned for a future release. For now, the project ships only with the developer workflow described below.

## Develop and run locally

The repository assumes a recent Node.js LTS release and `pnpm` are installed on your machine. The `start.sh` helper script takes care of installing dependencies, building the renderer, and launching Electron.

```bash
./start.sh
```

The script reuses the existing Electron install when available and falls back to `steam-run` automatically on NixOS.

## Next steps

- Package production-ready builds with `electron-builder` once the application stabilises.
- Publish installers for supported platforms after the production pipeline is in place.
