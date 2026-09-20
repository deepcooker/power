from __future__ import annotations

import os
import ssl
import json
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Optional


class AutoDLError(RuntimeError):
    pass


class AutoDLClient:
    def __init__(self, token: Optional[str] = None, base_url: Optional[str] = None, timeout: int = 20):
        self.token = token or os.getenv("AUTODL_TOKEN") or os.getenv("AUTODL_API_TOKEN")
        self.base_url = (base_url or os.getenv("AUTODL_API_BASE_URL") or "https://api.autodl.com").rstrip("/")
        self.timeout = timeout

    @property
    def configured(self) -> bool:
        return bool(self.token)

    def _headers(self) -> Dict[str, str]:
        if not self.token:
            raise AutoDLError("AUTODL_TOKEN is not configured")
        return {
            "Authorization": self.token,
            "Content-Type": "application/json",
        }

    def _request(self, method: str, path: str, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = json.dumps(payload).encode("utf-8") if payload is not None else None
        request = urllib.request.Request(url, data=body, headers=self._headers(), method=method)
        try:
            raw, status, reason = self._urlopen(request)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            status = exc.code
            reason = exc.reason
        except urllib.error.URLError as exc:
            raise AutoDLError(f"AutoDL request failed: {exc}") from exc

        try:
            response_body = json.loads(raw) if raw else {}
        except ValueError as exc:
            raise AutoDLError(f"AutoDL returned non-json response: {status}") from exc

        if status >= 400:
            message = response_body.get("msg") or response_body.get("message") or response_body.get("detail") or reason
            raise AutoDLError(f"AutoDL HTTP {status}: {message}")
        return response_body

    def _request_query(self, method: str, path: str, query: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url}{path}?{urllib.parse.urlencode(query)}"
        request = urllib.request.Request(url, headers=self._headers(), method=method)
        try:
            raw, status, reason = self._urlopen(request)
        except urllib.error.HTTPError as exc:
            raw = exc.read().decode("utf-8", errors="replace")
            status = exc.code
            reason = exc.reason
        except urllib.error.URLError as exc:
            raise AutoDLError(f"AutoDL request failed: {exc}") from exc
        try:
            response_body = json.loads(raw) if raw else {}
        except ValueError as exc:
            raise AutoDLError(f"AutoDL returned non-json response: {status}") from exc
        if status >= 400:
            message = response_body.get("msg") or response_body.get("message") or response_body.get("detail") or reason
            raise AutoDLError(f"AutoDL HTTP {status}: {message}")
        return response_body

    def _urlopen(self, request: urllib.request.Request):
        try:
            with urllib.request.urlopen(request, timeout=self.timeout) as response:
                return response.read().decode("utf-8"), response.status, response.reason
        except urllib.error.URLError as exc:
            reason = getattr(exc, "reason", None)
            if isinstance(reason, ssl.SSLCertVerificationError):
                context = ssl._create_unverified_context()
                with urllib.request.urlopen(request, timeout=self.timeout, context=context) as response:
                    return response.read().decode("utf-8"), response.status, response.reason
            raise

    def get_balance(self) -> Dict[str, Any]:
        return self._request("POST", "/api/v1/dev/wallet/balance", {})

    def list_private_images(self, page_index: int = 1, page_size: int = 20) -> Dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/dev/image/private/list",
            {"page_index": page_index, "page_size": page_size},
        )

    def list_deployments(self, page_index: int = 1, page_size: int = 20) -> Dict[str, Any]:
        return self._request(
            "POST",
            "/api/v1/dev/deployment/list",
            {"page_index": page_index, "page_size": page_size},
        )

    def create_deployment(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", "/api/v1/dev/deployment", payload)

    def update_replica_num(self, deployment_uuid: str, replica_num: int) -> Dict[str, Any]:
        return self._request(
            "PUT",
            "/api/v1/dev/deployment/replica_num",
            {"deployment_uuid": deployment_uuid, "replica_num": replica_num},
        )

    def stop_container(
        self,
        deployment_container_uuid: str,
        decrease_one_replica_num: bool = True,
        no_cache: Optional[bool] = None,
        cmd_before_shutdown: Optional[str] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "deployment_container_uuid": deployment_container_uuid,
            "decrease_one_replica_num": decrease_one_replica_num,
        }
        if no_cache is not None:
            payload["no_cache"] = no_cache
        if cmd_before_shutdown:
            payload["cmd_before_shutdown"] = cmd_before_shutdown
        return self._request(
            "PUT",
            "/api/v1/dev/deployment/container/stop",
            payload,
        )

    def list_containers(
        self,
        deployment_uuid: Optional[str] = None,
        container_uuid: Optional[str] = None,
        released: bool = False,
        page_index: int = 1,
        page_size: int = 20,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {
            "released": released,
            "page_index": page_index,
            "page_size": page_size,
        }
        if deployment_uuid:
            payload["deployment_uuid"] = deployment_uuid
        if container_uuid:
            payload["container_uuid"] = container_uuid
        return self._request("POST", "/api/v1/dev/deployment/container/list", payload)

    def list_gpu_stock(
        self,
        region_sign: str,
        cuda_v_from: Optional[int] = None,
        cuda_v_to: Optional[int] = None,
        gpu_name_set: Optional[list[str]] = None,
    ) -> Dict[str, Any]:
        payload: Dict[str, Any] = {"region_sign": region_sign}
        if cuda_v_from is not None:
            payload["cuda_v_from"] = cuda_v_from
        if cuda_v_to is not None:
            payload["cuda_v_to"] = cuda_v_to
        if gpu_name_set:
            payload["gpu_name_set"] = gpu_name_set
        return self._request("POST", "/api/v1/dev/machine/region/gpu_stock", payload)

    def create_pro_instance(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", "/api/v1/dev/instance/pro/create", payload)

    def list_pro_instances(self, page_index: int = 1, page_size: int = 20) -> Dict[str, Any]:
        return self._request("POST", "/api/v1/dev/instance/pro/list", {"page_index": page_index, "page_size": page_size})

    def pro_instance_status(self, instance_uuid: str) -> Dict[str, Any]:
        return self._request_query("GET", "/api/v1/dev/instance/pro/status", {"instance_uuid": instance_uuid})

    def pro_instance_snapshot(self, instance_uuid: str) -> Dict[str, Any]:
        return self._request_query("GET", "/api/v1/dev/instance/pro/snapshot", {"instance_uuid": instance_uuid})

    def power_on_pro_instance(self, instance_uuid: str) -> Dict[str, Any]:
        return self._request("POST", "/api/v1/dev/instance/pro/power_on", {"instance_uuid": instance_uuid})

    def power_off_pro_instance(self, instance_uuid: str) -> Dict[str, Any]:
        return self._request("POST", "/api/v1/dev/instance/pro/power_off", {"instance_uuid": instance_uuid})


def autodl_config_status() -> Dict[str, Any]:
    client = AutoDLClient()
    return {
        "configured": client.configured,
        "baseUrl": client.base_url,
        "tokenSource": _token_source(),
    }


def _token_source() -> str:
    if os.getenv("AUTODL_TOKEN"):
        return "env:AUTODL_TOKEN"
    if os.getenv("AUTODL_API_TOKEN"):
        return "env:AUTODL_API_TOKEN"
    return ""
