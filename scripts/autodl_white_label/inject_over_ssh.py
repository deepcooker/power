#!/usr/bin/env python3
import argparse
import base64
import os
import shlex
import sys
from pathlib import Path

import pexpect


def main() -> int:
    parser = argparse.ArgumentParser(description="Inject Lingqu white-label bootstrap into a running GPU container over SSH.")
    parser.add_argument("--host", required=True, help="SSH host, for example connect.nmb2.seetacloud.com")
    parser.add_argument("--port", required=True, type=int, help="SSH port")
    parser.add_argument("--user", default="root")
    parser.add_argument("--password", default=os.getenv("LINGQU_SSH_PASSWORD", ""))
    parser.add_argument("--token", default=os.getenv("LINGQU_JUPYTER_TOKEN", "lingqu-jupyter-token"))
    parser.add_argument("--brand", default=os.getenv("LINGQU_BRAND_NAME", "灵渠"))
    parser.add_argument("--jupyter-port", default=os.getenv("LINGQU_JUPYTER_PORT", "6006"))
    parser.add_argument("--reset-workspace", action="store_true", help="Clear /workspace before starting Jupyter.")
    parser.add_argument("--reset-data", action="store_true", help="Clear the data disk before creating /workspace, /data and /output.")
    parser.add_argument("--script", default=str(Path(__file__).with_name("lingqu-autodl-bootstrap.sh")))
    parser.add_argument("--timeout", default=240, type=int)
    args = parser.parse_args()

    if not args.password:
        print("missing --password or LINGQU_SSH_PASSWORD", file=sys.stderr)
        return 2

    script_path = Path(args.script)
    if not script_path.exists():
        print(f"script not found: {script_path}", file=sys.stderr)
        return 2

    encoded = base64.b64encode(script_path.read_bytes()).decode()
    remote = f"/tmp/lingqu-autodl-bootstrap-{os.getpid()}.sh"
    remote_cmd = "; ".join(
        [
            f"printf %s {shlex.quote(encoded)} | base64 -d > {shlex.quote(remote)}",
            f"chmod +x {shlex.quote(remote)}",
            "export LINGQU_BRAND_NAME=" + shlex.quote(args.brand),
            "export LINGQU_JUPYTER_PORT=" + shlex.quote(str(args.jupyter_port)),
            "export LINGQU_JUPYTER_TOKEN=" + shlex.quote(args.token),
            "export LINGQU_RESET_WORKSPACE=" + ("1" if args.reset_workspace else "0"),
            "export LINGQU_RESET_DATA=" + ("1" if args.reset_data else "0"),
            f"bash {shlex.quote(remote)}",
            "rc=$?",
            "cat /opt/lingqu/WHITE_LABEL_STATUS 2>/dev/null || true",
            f"rm -f {shlex.quote(remote)}",
            "exit $rc",
        ]
    )

    ssh_cmd = (
        f"ssh -o StrictHostKeyChecking=no "
        f"-o UserKnownHostsFile=/tmp/lingqu_autodl_known_hosts "
        f"-p {args.port} {shlex.quote(args.user)}@{shlex.quote(args.host)} {shlex.quote(remote_cmd)}"
    )
    child = pexpect.spawn(ssh_cmd, encoding="utf-8", timeout=args.timeout)
    child.logfile_read = sys.stdout
    while True:
        idx = child.expect(["password:", "yes/no", pexpect.EOF, pexpect.TIMEOUT])
        if idx == 0:
            child.sendline(args.password)
        elif idx == 1:
            child.sendline("yes")
        elif idx == 2:
            return child.exitstatus or 0
        else:
            print("timeout waiting for remote bootstrap", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
