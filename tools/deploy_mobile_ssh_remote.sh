#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-47.103.49.82}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_DIR="${REMOTE_DIR:-/www/wwwroot/power}"
REMOTE_APP_DIR="${REMOTE_DIR}/mobile_ssh_console"
REMOTE_SERVICE="${REMOTE_SERVICE:-power-mobile-ssh.service}"
NGINX_CONF="${NGINX_CONF:-/www/server/panel/vhost/nginx/cloud.yaochuang.tech.conf}"
STAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="/tmp/mobile_ssh_console_${STAMP}.tar.gz"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

tar -czf "${ARCHIVE}" mobile_ssh_console
scp "${ARCHIVE}" "${REMOTE}:/tmp/$(basename "${ARCHIVE}")"

REMOTE_SCRIPT=$(cat <<'EOS'
set -euo pipefail
REMOTE_DIR="$1"
ARCHIVE_NAME="$2"
SERVICE_NAME="$3"
NGINX_CONF="$4"
APP_DIR="${REMOTE_DIR}/mobile_ssh_console"

mkdir -p "${REMOTE_DIR}"
cd "${REMOTE_DIR}"
rm -rf "${APP_DIR}"
tar -xzf "/tmp/${ARCHIVE_NAME}" -C "${REMOTE_DIR}"
rm -f "/tmp/${ARCHIVE_NAME}"

if [ -d "${APP_DIR}/venv" ]; then
  echo "keep existing venv"
else
  python3 -m venv "${APP_DIR}/venv"
fi
"${APP_DIR}/venv/bin/pip" install -q fastapi uvicorn

cp "${APP_DIR}/deploy/power-mobile-ssh.service" "/etc/systemd/system/${SERVICE_NAME}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"
systemctl restart "${SERVICE_NAME}"
sleep 1
systemctl --no-pager --full status "${SERVICE_NAME}" | sed -n '1,35p'

if ! grep -q "location \\^~ /ssh/" "${NGINX_CONF}"; then
  tmp_conf="$(mktemp)"
  awk -v insert_file="${APP_DIR}/deploy/nginx-location.conf" '
    /^}[[:space:]]*$/ && inserted == 0 {
      while ((getline line < insert_file) > 0) print line
      close(insert_file)
      inserted = 1
    }
    { print }
  ' "${NGINX_CONF}" > "${tmp_conf}"
  cp "${NGINX_CONF}" "${NGINX_CONF}.bak.$(date +%Y%m%d_%H%M%S)"
  cat "${tmp_conf}" > "${NGINX_CONF}"
  rm -f "${tmp_conf}"
else
  echo "nginx /ssh/ location already exists"
fi

/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload

curl -sS http://127.0.0.1:6112/api/health
EOS
)

ssh "${REMOTE}" "bash -s" -- "${REMOTE_DIR}" "$(basename "${ARCHIVE}")" "${REMOTE_SERVICE}" "${NGINX_CONF}" <<< "${REMOTE_SCRIPT}"

rm -f "${ARCHIVE}"
echo "mobile ssh console deployed: https://cloud.yaochuang.tech/ssh/"
