#!/usr/bin/env bash
set -euo pipefail

CERT_DIR="/www/server/panel/vhost/letsencrypt/yaochuang.tech"
CERT_FILE="${CERT_DIR}/fullchain.pem"
ACME_CLIENT="/www/server/panel/class/acme_v2.py"
PANEL_PYTHON="/www/server/panel/pyenv/bin/python3"
WEB_ROOT="/www/wwwroot/power"
DOMAINS="yaochuang.tech,www.yaochuang.tech,cloud.yaochuang.tech"
RENEW_BEFORE_DAYS="${RENEW_BEFORE_DAYS:-30}"
LOCK_FILE="/var/lock/renew-yaochuang-cert.lock"
NGINX_BIN="/www/server/nginx/sbin/nginx"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  log "Another renewal check is running; exiting."
  exit 0
fi

required_sans_present() {
  local cert_text
  cert_text="$(openssl x509 -in "${CERT_FILE}" -noout -ext subjectAltName 2>/dev/null || true)"
  [[ "${cert_text}" == *"DNS:yaochuang.tech"* ]] &&
    [[ "${cert_text}" == *"DNS:www.yaochuang.tech"* ]] &&
    [[ "${cert_text}" == *"DNS:cloud.yaochuang.tech"* ]]
}

if [[ -s "${CERT_FILE}" ]] &&
  openssl x509 -checkend "$((RENEW_BEFORE_DAYS * 86400))" -noout -in "${CERT_FILE}" >/dev/null 2>&1 &&
  required_sans_present; then
  log "Certificate is valid for more than ${RENEW_BEFORE_DAYS} days; no renewal needed."
  exit 0
fi

log "Renewing certificate for ${DOMAINS}."
"${PANEL_PYTHON}" -u "${ACME_CLIENT}" \
  --domain "${DOMAINS}" \
  --type http \
  --path "${WEB_ROOT}"

if ! openssl x509 -checkend 2592000 -noout -in "${CERT_FILE}" >/dev/null 2>&1; then
  log "Renewal did not produce a certificate valid for at least 30 days."
  exit 1
fi

if ! required_sans_present; then
  log "Renewed certificate does not cover all required domains."
  exit 1
fi

"${NGINX_BIN}" -t
"${NGINX_BIN}" -s reload
log "Certificate renewed and nginx reloaded successfully."
openssl x509 -in "${CERT_FILE}" -noout -subject -issuer -dates -ext subjectAltName
