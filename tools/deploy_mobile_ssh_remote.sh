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

python3 - "${NGINX_CONF}" <<'PY'
from pathlib import Path
import sys

conf = Path(sys.argv[1])
lines = conf.read_text().splitlines()

# Keep the script idempotent by removing any old /ssh/ location first,
# including accidental insertions into non-HTTPS server blocks.
clean = []
i = 0
while i < len(lines):
    if "location ^~ /ssh/" in lines[i]:
        depth = 0
        while i < len(lines):
            depth += lines[i].count("{") - lines[i].count("}")
            i += 1
            if depth <= 0:
                break
        continue
    clean.append(lines[i])

location = [
    "    location ^~ /ssh/ {",
    "        proxy_pass http://127.0.0.1:6112/;",
    "        proxy_http_version 1.1;",
    "        proxy_set_header Host $host;",
    "        proxy_set_header X-Real-IP $remote_addr;",
    "        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
    "        proxy_set_header X-Forwarded-Proto $scheme;",
    "        proxy_read_timeout 120s;",
    "        proxy_send_timeout 120s;",
    "    }",
    "",
]

inside_cloud_ssl = False
inserted = False
out = []
for line in clean:
    if line.strip() == "server":
        inside_cloud_ssl = False
    if "server_name cloud.yaochuang.tech;" in line:
        recent = "\n".join(out[-8:] + [line])
        inside_cloud_ssl = "listen 443" in recent
    if inside_cloud_ssl and not inserted and line.strip() == "location = / {":
        out.extend(location)
        inserted = True
    out.append(line)

if not inserted:
    raise SystemExit("failed to insert /ssh/ location into cloud.yaochuang.tech ssl server block")

backup = conf.with_name(f"{conf.name}.bak")
backup.write_text(conf.read_text())
conf.write_text("\n".join(out) + "\n")
PY

/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload

curl -sS http://127.0.0.1:6112/api/health
EOS
)

ssh "${REMOTE}" "bash -s" -- "${REMOTE_DIR}" "$(basename "${ARCHIVE}")" "${REMOTE_SERVICE}" "${NGINX_CONF}" <<< "${REMOTE_SCRIPT}"

rm -f "${ARCHIVE}"
echo "mobile ssh console deployed: https://cloud.yaochuang.tech/ssh/"
