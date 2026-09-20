#!/usr/bin/env bash
set -euo pipefail

BRAND_NAME="${LINGQU_BRAND_NAME:-灵渠}"
BASE_DIR="${LINGQU_BASE_DIR:-/opt/lingqu}"
PORT="${LINGQU_JUPYTER_PORT:-6006}"
TOKEN="${LINGQU_JUPYTER_TOKEN:-lingqu-jupyter-token}"
BASE_URL="${LINGQU_JUPYTER_BASE_URL:-/}"
RESET_WORKSPACE="${LINGQU_RESET_WORKSPACE:-0}"
RESET_DATA="${LINGQU_RESET_DATA:-0}"
ENABLE_DOCKER="${LINGQU_ENABLE_DOCKER:-1}"

DATA_REAL=""
for candidate in /root/autodl-tmp /data /root/data; do
  if [ -d "$candidate" ]; then
    DATA_REAL="$candidate"
    break
  fi
done
if [ -z "$DATA_REAL" ]; then
  DATA_REAL="/root/lingqu-data"
  mkdir -p "$DATA_REAL"
fi

SHARE_REAL=""
for candidate in /root/autodl-fs /autodl-fs /root/autodl-tmp/autodl-fs /mnt/autodl-fs /root/autodl-tmp/fs /fs; do
  if [ -d "$candidate" ]; then
    SHARE_REAL="$candidate"
    break
  fi
done
if [ -z "$SHARE_REAL" ]; then
  SHARE_REAL="$BASE_DIR/share-placeholder"
fi

mkdir -p "$BASE_DIR/bin"

if [ "$RESET_DATA" = "1" ] && [ -n "$DATA_REAL" ] && [ -d "$DATA_REAL" ]; then
  find "$DATA_REAL" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi

if [ "$RESET_WORKSPACE" = "1" ] && [ -d "$DATA_REAL/.lingqu-workspace" ]; then
  find "$DATA_REAL/.lingqu-workspace" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
fi

mkdir -p \
  "$BASE_DIR/rootfs/etc/profile.d" \
  "$BASE_DIR/rootfs/root" \
  "$BASE_DIR/rootfs/usr/local/bin" \
  "$BASE_DIR/rootfs/opt" \
  "$BASE_DIR/rootfs/workspace" \
  "$BASE_DIR/rootfs/data" \
  "$BASE_DIR/rootfs/output" \
  "$BASE_DIR/rootfs/system" \
  "$BASE_DIR/rootfs/share" \
  "$BASE_DIR/system-workspace" \
  "$BASE_DIR/share-placeholder" \
  "$DATA_REAL/.lingqu-workspace" \
  "$DATA_REAL/output"

if [ "$RESET_WORKSPACE" != "1" ] && [ "$RESET_DATA" != "1" ] && [ -d "$DATA_REAL/jupyter-workspace" ] && [ ! -e "$DATA_REAL/.lingqu-workspace/.migrated_from_jupyter_workspace" ]; then
  cp -an "$DATA_REAL/jupyter-workspace/." "$DATA_REAL/.lingqu-workspace/" 2>/dev/null || true
  touch "$DATA_REAL/.lingqu-workspace/.migrated_from_jupyter_workspace"
fi

ln -sfnT "$DATA_REAL" "$BASE_DIR/data"
ln -sfnT "$DATA_REAL/.lingqu-workspace" "$BASE_DIR/workspace"
ln -sfnT "$DATA_REAL/output" "$BASE_DIR/output"
ln -sfnT "$SHARE_REAL" "$BASE_DIR/share"
if [ -d /root/miniconda3 ]; then
  ln -sfnT /root/miniconda3 "$BASE_DIR/conda"
elif [ -d /opt/conda ]; then
  ln -sfnT /opt/conda "$BASE_DIR/conda"
fi

if ! command -v proot >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y proot
  else
    echo "proot is required but apt-get is unavailable" >&2
    exit 1
  fi
fi

if [ "$ENABLE_DOCKER" = "1" ] && ! command -v docker >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y docker.io
  fi
fi

if [ "$ENABLE_DOCKER" = "1" ] && command -v docker >/dev/null 2>&1; then
  cat > /usr/local/bin/lingqu-dockerd-start <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
mkdir -p /root/autodl-tmp/.lingqu-docker /var/run /opt/lingqu
if [ -S /var/run/docker.sock ] && docker info >/dev/null 2>&1; then
  exit 0
fi
pkill dockerd 2>/dev/null || true
nohup dockerd \
  --host=unix:///var/run/docker.sock \
  --data-root=/root/autodl-tmp/.lingqu-docker \
  --exec-root=/tmp/lingqu-docker-exec \
  --pidfile=/tmp/lingqu-docker.pid \
  --storage-driver=vfs \
  --iptables=false \
  --bridge=none \
  --ip-forward=false \
  --ip-masq=false \
  > /opt/lingqu/dockerd.log 2>&1 &
for _ in $(seq 1 30); do
  if docker info >/dev/null 2>&1; then
    exit 0
  fi
  sleep 1
done
tail -80 /opt/lingqu/dockerd.log >&2 || true
exit 1
EOF
  chmod +x /usr/local/bin/lingqu-dockerd-start
  /usr/local/bin/lingqu-dockerd-start || true
fi

cat > "$BASE_DIR/bin/refresh-resource-cache.py" <<'PY'
#!/usr/bin/env python3
import os
import subprocess

out = "/opt/lingqu/resource.env"

def shell(cmd):
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return ""

def disk_line(path):
    line = shell(f"df -h {path} | tail -n 1")
    parts = line.split()
    if len(parts) >= 5:
        return f"{parts[4]} {parts[2]}/{parts[1]}"
    return "-"

def memory_gb():
    candidates = [
        "/sys/fs/cgroup/memory.max",
        "/sys/fs/cgroup/memory/memory.limit_in_bytes",
    ]
    for path in candidates:
        try:
            raw = open(path).read().strip()
            if raw and raw != "max":
                value = int(raw)
                if 0 < value < 1 << 60:
                    return str(round(value / 1024 ** 3))
        except Exception:
            pass
    try:
        with open("/proc/meminfo") as f:
            for line in f:
                if line.startswith("MemTotal:"):
                    return str(round(int(line.split()[1]) / 1024 ** 2))
    except Exception:
        pass
    return "-"

def gpu_info():
    text = shell("nvidia-smi --query-gpu=name --format=csv,noheader")
    names = [x.strip() for x in text.splitlines() if x.strip()]
    if not names:
        return "未检测到 GPU"
    first = names[0]
    return f"{first}, {len(names)}"

def quote(value):
    return "'" + str(value).replace("'", "'\"'\"'") + "'"

values = {
    "CPU_CORES": shell("nproc") or "-",
    "MEM_GB": memory_gb(),
    "GPU_INFO": gpu_info(),
    "SYSTEM_LINE": disk_line("/"),
    "DATA_LINE": disk_line("/root/autodl-tmp") if os.path.exists("/root/autodl-tmp") else disk_line("/data"),
    "SHARE_LINE": disk_line("/root/autodl-fs") if os.path.exists("/root/autodl-fs") else "未挂载共享存储",
}

os.makedirs(os.path.dirname(out), exist_ok=True)
with open(out, "w") as f:
    for key, value in values.items():
        f.write(f"{key}={quote(value)}\n")
PY
chmod +x "$BASE_DIR/bin/refresh-resource-cache.py"
"$BASE_DIR/bin/refresh-resource-cache.py" || true

cat > "$BASE_DIR/rootfs/etc/lingqu-welcome.sh" <<'EOF'
#!/usr/bin/env sh
[ -r /opt/lingqu-resource.env ] && . /opt/lingqu-resource.env
CPU_CORES=${CPU_CORES:--}
MEM_GB=${MEM_GB:--}
GPU_INFO=${GPU_INFO:-未检测到 GPU}
SYSTEM_LINE=${SYSTEM_LINE:--}
DATA_LINE=${DATA_LINE:--}
SHARE_LINE=${SHARE_LINE:-未挂载共享存储}

cat <<WELCOME
+---------------------------------------------灵渠 GPU 工作区---------------------------------------------+
目录说明:
╔════════════╦════════════╦════╦══════════════════════════════════════════════════════════╗
║目录        ║名称        ║速度║说明                                                      ║
╠════════════╬════════════╬════╬══════════════════════════════════════════════════════════╣
║/workspace  ║项目工作区  ║快  ║Jupyter 文件区，建议存放代码、Notebook 和项目文件。        ║
║/data       ║数据盘      ║快  ║适合存放数据集、模型权重和中间产物。                      ║
║/output     ║输出结果    ║快  ║建议保存任务结果、导出文件和可下载产物。                  ║
║/system     ║系统盘空间  ║一般║适合安装依赖和放少量工具文件，会随镜像一起保存。          ║
║/share      ║共享存储    ║一般║同区域共享目录；未开通时为空目录。                        ║
╚════════════╩════════════╩════╩══════════════════════════════════════════════════════════╝
CPU ：${CPU_CORES} 核心
内存：${MEM_GB} GB
GPU ：${GPU_INFO}
存储：
  系统盘 /       ：${SYSTEM_LINE}
  数据盘 /data   ：${DATA_LINE}
  共享盘 /share  ：${SHARE_LINE}
+----------------------------------------------------------------------------------------------------------+
常用命令:
  cd /workspace          进入项目工作区
  cd /data               进入数据盘
  cd /system             进入系统盘工作目录
  cd /share              进入共享存储
  df -h                  查看磁盘
  nvidia-smi             查看 GPU
  conda env list         查看 Conda 环境

WELCOME
EOF
chmod +x "$BASE_DIR/rootfs/etc/lingqu-welcome.sh"

cat > "$BASE_DIR/rootfs/etc/passwd" <<'EOF'
root:x:0:0:root:/root:/bin/bash
lingqu:x:0:0:lingqu:/workspace:/bin/bash
EOF

cat > "$BASE_DIR/rootfs/etc/group" <<'EOF'
root:x:0:
lingqu:x:0:
EOF

cat > "$BASE_DIR/bin/sudo" <<'EOF'
#!/usr/bin/env bash
while [ "$#" -gt 0 ]; do
  case "$1" in
    -S|-n|-E|-H|-k|-K|-v|-l) shift ;;
    -u|-g|-p) shift 2 ;;
    --) shift; break ;;
    -*) shift ;;
    *) break ;;
  esac
done
if [ "$#" -eq 0 ]; then
  exec /bin/bash
fi
exec "$@"
EOF
chmod +x "$BASE_DIR/bin/sudo"

cat > "$BASE_DIR/rootfs/etc/lingqu-bashrc" <<'EOF'
[ -r /etc/lingqu-welcome.sh ] && /etc/lingqu-welcome.sh
export HOME=/workspace
export PATH=/opt/lingqu-bin:/opt/conda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PS1='lingqu@gpu-workspace:$PWD\$ '
cd /workspace 2>/dev/null || cd /
EOF

cat > /usr/local/bin/lingqu-shell <<EOF
#!/usr/bin/env bash
BIND_ARGS=()
for path in /bin /usr /lib /lib64 /dev /proc /sys /var/run /run; do
  [ -e "\$path" ] && BIND_ARGS+=("-b" "\$path")
done
[ -e /usr/bin/nvidia-smi ] && BIND_ARGS+=("-b" "/usr/bin/nvidia-smi:/usr/bin/nvidia-smi")
[ -e "$BASE_DIR/conda" ] && BIND_ARGS+=("-b" "$BASE_DIR/conda:/opt/conda")
exec proot \\
  -r "$BASE_DIR/rootfs" \\
  "\${BIND_ARGS[@]}" \\
  -b "$BASE_DIR/data:/data" \\
  -b "$BASE_DIR/workspace:/workspace" \\
  -b "$BASE_DIR/output:/output" \\
  -b "$BASE_DIR/system-workspace:/system" \\
  -b "$BASE_DIR/share:/share" \\
  -b "$BASE_DIR/resource.env:/opt/lingqu-resource.env" \\
  -b "$BASE_DIR/bin:/opt/lingqu-bin" \\
  -w /workspace \\
  /usr/bin/env -i HOME=/workspace USER=lingqu LOGNAME=lingqu SHELL=/bin/bash TERM="\${TERM:-xterm-256color}" PATH=/opt/lingqu-bin:/opt/conda/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \\
  /bin/bash --rcfile /etc/lingqu-bashrc "\$@"
EOF
chmod +x /usr/local/bin/lingqu-shell

JUPYTER_BIN=""
for candidate in /root/miniconda3/bin/jupyter-lab /opt/conda/bin/jupyter-lab /usr/local/bin/jupyter-lab; do
  if [ -x "$candidate" ]; then
    JUPYTER_BIN="$candidate"
    break
  fi
done
if [ -z "$JUPYTER_BIN" ]; then
  echo "jupyter-lab not found; white-label shell installed, jupyter not started" >&2
  exit 0
fi

cat > "$BASE_DIR/jupyter_6006_config.py" <<EOF
c.ServerApp.ip = "0.0.0.0"
c.ServerApp.port = $PORT
c.ServerApp.open_browser = False
c.ServerApp.allow_root = True
c.ServerApp.root_dir = "$BASE_DIR/workspace"
c.ServerApp.base_url = "$BASE_URL"
c.NotebookApp.base_url = "$BASE_URL"
c.ServerApp.token = "$TOKEN"
c.ServerApp.password = ""
c.ServerApp.allow_origin = "*"
c.ServerApp.allow_remote_access = True
c.ServerApp.terminado_settings = {"shell_command": ["/usr/local/bin/lingqu-shell"]}
EOF

if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -ti :"$PORT" || true)"
  [ -n "$pids" ] && kill $pids 2>/dev/null || true
elif command -v fuser >/dev/null 2>&1; then
  fuser -k "$PORT/tcp" 2>/dev/null || true
else
  pkill -f "jupyter-lab.*--port[= ]$PORT" 2>/dev/null || true
  pkill -f "jupyter-lab.*--config=$BASE_DIR/jupyter_6006_config.py" 2>/dev/null || true
fi

nohup "$JUPYTER_BIN" --allow-root --config="$BASE_DIR/jupyter_6006_config.py" > "$BASE_DIR/jupyter_6006.log" 2>&1 &
echo "$!" > "$BASE_DIR/jupyter_6006.pid"

cat > "$BASE_DIR/WHITE_LABEL_STATUS" <<EOF
brand=$BRAND_NAME
data_real=$DATA_REAL
workspace=$DATA_REAL/.lingqu-workspace
output=$DATA_REAL/output
system=$BASE_DIR/system-workspace
share=$SHARE_REAL
reset_workspace=$RESET_WORKSPACE
reset_data=$RESET_DATA
jupyter_port=$PORT
jupyter_base_url=$BASE_URL
jupyter_token=$TOKEN
installed_at=$(date '+%Y-%m-%d %H:%M:%S')
EOF

echo "Lingqu white-label bootstrap installed."
echo "Jupyter: port=$PORT base=$BASE_URL token=$TOKEN"
