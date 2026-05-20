#!/usr/bin/env bash
set -euo pipefail

REMOTE_HOST="${REMOTE_HOST:-47.103.49.82}"
REMOTE_USER="${REMOTE_USER:-root}"
REMOTE="${REMOTE_USER}@${REMOTE_HOST}"
REMOTE_DIR="${REMOTE_DIR:-/www/wwwroot/power}"
REMOTE_SERVICE="${REMOTE_SERVICE:-power-compute.service}"
BRANCH="${BRANCH:-main}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPORT_DIR="${ROOT_DIR}/deploy_reports"
STAMP="$(date +%Y%m%d_%H%M%S)"
ARCHIVE="/tmp/power_deploy_${STAMP}.tar.gz"
REPORT="${REPORT_DIR}/DEPLOY_${STAMP}.md"

mkdir -p "${REPORT_DIR}"

log() {
  printf '[%s] %s\n' "$(date '+%F %T')" "$*"
}

run_capture() {
  local label="$1"
  shift
  log "${label}"
  {
    printf '\n## %s\n\n```text\n' "${label}"
    "$@" 2>&1
    printf '```\n'
  } >> "${REPORT}"
}

cd "${ROOT_DIR}"

cat > "${REPORT}" <<EOF
# Power 自动发布总结

- 时间：$(date '+%F %T')
- 本地目录：${ROOT_DIR}
- 远端：${REMOTE}
- 远端目录：${REMOTE_DIR}
- 分支：${BRANCH}

EOF

run_capture "拉取最新代码" git pull --ff-only origin "${BRANCH}"

COMMIT="$(git rev-parse --short HEAD)"
COMMIT_FULL="$(git rev-parse HEAD)"
{
  printf '\n## Git 版本\n\n'
  printf -- '- short：`%s`\n' "${COMMIT}"
  printf -- '- full：`%s`\n' "${COMMIT_FULL}"
} >> "${REPORT}"

run_capture "安装前端依赖" bash -lc 'cd a9_compute_admin && npm ci'
run_capture "构建前端" bash -lc 'cd a9_compute_admin && npm run build'

log "打包发布文件 ${ARCHIVE}"
tar \
  --exclude='.git' \
  --exclude='a9_compute_admin/node_modules' \
  --exclude='__pycache__' \
  --exclude='logs' \
  --exclude='.ipynb_checkpoints' \
  --exclude='deploy_reports' \
  --exclude='DEPLOY_HANDOFF_SENSITIVE.md' \
  -czf "${ARCHIVE}" .

run_capture "上传发布包" scp "${ARCHIVE}" "${REMOTE}:/tmp/$(basename "${ARCHIVE}")"

REMOTE_SCRIPT=$(cat <<'EOS'
set -euo pipefail
REMOTE_DIR="$1"
ARCHIVE_NAME="$2"
SERVICE_NAME="$3"

mkdir -p "${REMOTE_DIR}"
cd "${REMOTE_DIR}"

if [ -d venv ]; then
  echo "keep existing venv"
else
  echo "create venv"
  python3 -m venv venv
fi

find "${REMOTE_DIR}" -mindepth 1 -maxdepth 1 ! -name venv -exec rm -rf {} +
tar -xzf "/tmp/${ARCHIVE_NAME}" -C "${REMOTE_DIR}"
rm -f "/tmp/${ARCHIVE_NAME}"

"${REMOTE_DIR}/venv/bin/pip" install -q fastapi uvicorn

systemctl restart "${SERVICE_NAME}"
sleep 1
systemctl --no-pager --full status "${SERVICE_NAME}" | sed -n '1,35p'

/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload

curl -sS http://127.0.0.1:6111/api/health
EOS
)

run_capture "远端解包并重启服务" ssh "${REMOTE}" "bash -s" -- "${REMOTE_DIR}" "$(basename "${ARCHIVE}")" "${REMOTE_SERVICE}" <<< "${REMOTE_SCRIPT}"

run_capture "公网 HTTP 验证" env -u HTTP_PROXY -u HTTPS_PROXY -u ALL_PROXY -u http_proxy -u https_proxy -u all_proxy bash -lc "
curl -sS -I http://${REMOTE_HOST}/compute | sed -n '1,12p'
echo
curl -sS http://${REMOTE_HOST}/api/health
"

rm -f "${ARCHIVE}"

{
  printf '\n## 访问地址\n\n'
  printf -- '- 首页：http://%s/compute\n' "${REMOTE_HOST}"
  printf -- '- 应用市场：http://%s/compute/app/market\n' "${REMOTE_HOST}"
  printf -- '- 健康检查：http://%s/api/health\n' "${REMOTE_HOST}"
  printf '\n## 结论\n\n发布脚本执行完成。若上方公网 HTTP 验证为 `200 OK` 且 health 返回 `status: ok`，发布成功。\n'
} >> "${REPORT}"

log "发布总结已生成：${REPORT}"
printf '%s\n' "${REPORT}"
