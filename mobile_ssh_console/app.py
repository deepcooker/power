import json
import os
import shlex
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"

app = FastAPI(title="LingQu Mobile SSH Console", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CommandRequest(BaseModel):
    command: str
    cwd: Optional[str] = "~"
    target: Optional[str] = None


def ok(data):
    return {"err_code": 0, "data": data}


def parse_ssh_target(target: Optional[str]):
    raw = (target or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="ssh target is required")
    parts = shlex.split(raw)
    if parts and parts[0] == "ssh":
        parts = parts[1:]
    if not parts:
        raise HTTPException(status_code=400, detail="ssh target is required")
    return parts


def run_ssh(target: Optional[str], remote_command: str, timeout: int = 25):
    args = ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=8", *parse_ssh_target(target), remote_command]
    return subprocess.run(args, capture_output=True, text=True, timeout=timeout)


def remote_cd_command(cwd: str):
    if cwd == "~":
        return "cd ~"
    if cwd.startswith("~/"):
        return f"cd ~/{shlex.quote(cwd[2:])}"
    return f"cd {shlex.quote(cwd)}"


@app.get("/api/health")
async def health():
    return ok({"service": "mobile-ssh-console", "status": "ok"})


@app.post("/api/session/test")
async def session_test(payload: CommandRequest):
    cwd = payload.cwd or "~"
    completed = run_ssh(payload.target, f"{remote_cd_command(cwd)} && pwd", timeout=12)
    return ok(
        {
            "target": payload.target,
            "cwd": cwd,
            "exit_code": completed.returncode,
            "stdout": completed.stdout[-4000:],
            "stderr": completed.stderr[-4000:],
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.post("/api/terminal/run")
async def terminal_run(payload: CommandRequest):
    command = payload.command.strip()
    if not command:
        raise HTTPException(status_code=400, detail="command is required")
    cwd = payload.cwd or "~"
    try:
        completed = run_ssh(payload.target, f"{remote_cd_command(cwd)} && {command}")
        return ok(
            {
                "command": command,
                "cwd": cwd,
                "target": payload.target,
                "exit_code": completed.returncode,
                "stdout": completed.stdout[-24000:],
                "stderr": completed.stderr[-12000:],
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        )
    except subprocess.TimeoutExpired as exc:
        return ok(
            {
                "command": command,
                "cwd": cwd,
                "target": payload.target,
                "exit_code": 124,
                "stdout": (exc.stdout or "")[-24000:],
                "stderr": ((exc.stderr or "") + "\ncommand timed out after 25s")[-12000:],
                "finished_at": datetime.now(timezone.utc).isoformat(),
            }
        )


@app.get("/api/files")
async def files(path: str = Query(default="~"), target: str = Query(...)):
    script = r"""
import json, os, sys
path = os.path.expanduser(sys.argv[1] or "~")
if os.path.isfile(path):
    path = os.path.dirname(path)
path = os.path.abspath(path)
items = []
for name in os.listdir(path):
    child = os.path.join(path, name)
    try:
        stat = os.stat(child)
    except OSError:
        continue
    items.append({
        "name": name,
        "path": child,
        "type": "dir" if os.path.isdir(child) else "file",
        "size": stat.st_size,
        "modified": __import__("datetime").datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
    })
items.sort(key=lambda item: (item["type"] != "dir", item["name"].lower()))
parent = os.path.dirname(path) if os.path.dirname(path) != path else None
print(json.dumps({"path": path, "root": "/", "parent": parent, "items": items[:300]}, ensure_ascii=False))
"""
    completed = run_ssh(target, f"python3 -c {shlex.quote(script)} {shlex.quote(path)}")
    if completed.returncode != 0:
        raise HTTPException(status_code=400, detail=completed.stderr[-1200:] or "failed to list remote files")
    return ok(json.loads(completed.stdout))


@app.get("/api/files/read")
async def file_read(path: str = Query(...), target: str = Query(...)):
    script = r"""
import json, os, sys
path = os.path.abspath(os.path.expanduser(sys.argv[1]))
if not os.path.isfile(path):
    raise SystemExit("file not found")
if os.path.getsize(path) > 1024 * 1024:
    raise SystemExit("file is larger than 1MB")
with open(path, "r", encoding="utf-8", errors="replace") as file:
    content = file.read(200000)
print(json.dumps({"path": path, "content": content}, ensure_ascii=False))
"""
    completed = run_ssh(target, f"python3 -c {shlex.quote(script)} {shlex.quote(path)}")
    if completed.returncode != 0:
        raise HTTPException(status_code=400, detail=completed.stderr[-1200:] or "failed to read remote file")
    return ok(json.loads(completed.stdout))


app.mount("/assets", StaticFiles(directory=STATIC_DIR), name="assets")


@app.get("/")
async def index():
    return FileResponse(STATIC_DIR / "index.html")


if __name__ == "__main__":
    uvicorn.run(
        app="app:app",
        host=os.getenv("HOST", "127.0.0.1"),
        port=int(os.getenv("PORT", "6112")),
        workers=1,
        reload=False,
    )
