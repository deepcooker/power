#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import api
from autodl_client import AutoDLClient


def update_white_label(task_id: int, **values):
    task = api.provision_task_detail(task_id)
    if not task:
        return
    result = task.get("result") or {}
    result["whiteLabel"] = {**(result.get("whiteLabel") or {}), **values}
    api.db_exec(
        "UPDATE cd_provision_task SET result_json=%s, err_msg=%s WHERE task_id=%s",
        (json.dumps(result, ensure_ascii=False), values.get("error", "")[:500], task_id),
    )


def main() -> int:
    task_id = int(sys.argv[1])
    task = api.provision_task_detail(task_id)
    if not task:
        return 2
    result = task.get("result") or {}
    white_label = result.get("whiteLabel") or {}
    deployment_uuid = result.get("providerDeploymentUuid") or task.get("deploymentUuid")
    target_container = white_label.get("containerUuid")
    rows = (AutoDLClient().list_containers(deployment_uuid=deployment_uuid, page_size=20).get("data") or {}).get("list") or []
    container = next((row for row in rows if row.get("uuid") == target_container and row.get("status") == "running"), None)
    if not container:
        update_white_label(task_id, status="failed", error="运行中的目标容器不存在")
        return 1
    info = container.get("info") or {}
    host = info.get("proxy_host")
    ssh_command = info.get("ssh_command") or ""
    password = info.get("root_password")
    try:
        port = int(ssh_command.split("-p", 1)[1].strip().split()[0])
    except (IndexError, ValueError):
        port = 0
    if not host or not port or not password:
        update_white_label(task_id, status="failed", error="供应商未返回完整 SSH 信息")
        return 1

    env = {**os.environ, "LINGQU_SSH_PASSWORD": password, "LINGQU_JUPYTER_TOKEN": white_label["token"]}
    command = [
        sys.executable,
        str(Path(__file__).with_name("inject_over_ssh.py")),
        "--host", host,
        "--port", str(port),
        "--user", "root",
        "--brand", "灵渠",
        "--reset-data",
        "--timeout", "360",
    ]
    completed = subprocess.run(command, cwd=str(ROOT), env=env, text=True, timeout=420)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    if completed.returncode:
        update_white_label(task_id, status="failed", error=f"白标注入退出码 {completed.returncode}", finishedAt=now)
        return completed.returncode
    update_white_label(task_id, status="installed", error="", finishedAt=now, baseUrl="/", port=6006)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
