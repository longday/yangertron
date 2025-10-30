#!/usr/bin/env bash
set -euo pipefail

APP_ID="yangertron"
APP_NAME="Yangertron"
DESKTOP_DIR="${HOME}/.local/share/applications"
ICONS_DIR="${HOME}/.local/share/icons"
DESKTOP_FILE="${DESKTOP_DIR}/${APP_ID}.desktop"
ICON_FILE="${ICONS_DIR}/${APP_ID}.png"

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
EXEC_PATH="${REPO_ROOT}/start.sh"
ICON_SOURCE="${REPO_ROOT}/resources/messenger.png"

function ensure_file_exists() {
  local path="$1"
  local description="$2"
  if [[ ! -f "$path" ]]; then
    echo "error: ${description} не найден по пути $path" >&2
    exit 1
  fi
}

ensure_file_exists "${EXEC_PATH}" "start.sh"
ensure_file_exists "${ICON_SOURCE}" "messenger.png"

mkdir -p "${DESKTOP_DIR}" "${ICONS_DIR}"

if ! cmp -s "${ICON_SOURCE}" "${ICON_FILE}"; then
  install -m 0644 "${ICON_SOURCE}" "${ICON_FILE}"
fi

tmp_file="${DESKTOP_FILE}.tmp"
cat > "${tmp_file}" <<EOF
[Desktop Entry]
Type=Application
Version=1.5
Name=${APP_NAME}
Comment=Launch ${APP_NAME}
Exec="${EXEC_PATH}"
Icon=${ICON_FILE}
Terminal=false
Categories=Network;InstantMessaging;
StartupNotify=true
Keywords=Messenger;Chat;
EOF

mv "${tmp_file}" "${DESKTOP_FILE}"

echo "Desktop entry создан/обновлен: ${DESKTOP_FILE}"
echo "Иконка: ${ICON_FILE}"
