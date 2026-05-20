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

pnpm run build:app

cmd=(pnpm exec electron dist/main.js)

if [[ -f /etc/os-release ]] && grep -q '^ID=nixos' /etc/os-release; then
	if command -v nix-build >/dev/null 2>&1; then
		NSS_LIB="$(nix-build '<nixpkgs>' --no-out-link -A nss.out 2>/dev/null || true)/lib"
		NSPR_LIB="$(nix-build '<nixpkgs>' --no-out-link -A nspr.out 2>/dev/null || true)/lib"
		export LD_LIBRARY_PATH="$NSS_LIB:$NSPR_LIB${LD_LIBRARY_PATH:+:${LD_LIBRARY_PATH}}"
	fi
	cmd=(steam-run "${cmd[@]}")
fi

exec "${cmd[@]}"
