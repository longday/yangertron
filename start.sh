#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}" )" && pwd)"
cd "$ROOT_DIR"
pnpm install --frozen-lockfile

electron_pkg_json="$(node -p "require.resolve('electron/package.json')")"
electron_dir="$(dirname "$electron_pkg_json")"

if [[ ! -x "$electron_dir/dist/electron" ]]; then
	(cd "$electron_dir" && node install.js)
fi

pnpm exec vite build

cmd=(pnpm exec electron dist/main.js)

if [[ -f /etc/os-release ]] && grep -q '^ID=nixos' /etc/os-release; then
	export LD_LIBRARY_PATH="$HOME/.nix-profile/lib${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
	cmd=(steam-run "${cmd[@]}")
fi


exec "${cmd[@]}"
