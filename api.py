from __future__ import annotations

import json
import os
import secrets
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import uvicorn
import pymysql
from fastapi import Depends, FastAPI, Header, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles

from autodl_client import AutoDLClient, AutoDLError, autodl_config_status
from busi.user.sp_user import user_router
from mysqldbpoolnew import get_connection


ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT / "a9_compute_admin" / "dist"
WORKFLOW_RUNS_FILE = Path(os.getenv("WORKFLOW_RUNS_FILE", str(ROOT / "runtime_data" / "workflow_runs.json")))
WORKFLOW_CASES_FILE = Path(os.getenv("WORKFLOW_CASES_FILE", str(ROOT / "runtime_data" / "workflow_cases.json")))
WHITE_LABEL_WORKER = ROOT / "scripts" / "autodl_white_label" / "inject_task_worker.py"

app = FastAPI(title="A9 Compute Admin API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def compute_api_prefix_middleware(request, call_next):
    path = request.scope.get("path") or ""
    if path.startswith("/compute/api/") or path == "/compute/api":
        request.scope["path"] = path[len("/compute") :]
    return await call_next(request)

app.include_router(user_router, prefix="/api/user", tags=["Users-用户中心"])


def ok(data):
    return {"err_code": 0, "data": data}


def provider_error(message: str, code: int = 502):
    return {"err_code": code, "err_desc": message, "data": None}


def require_admin_token(token: Optional[str] = Header(None)):
    if not token:
        raise HTTPException(status_code=401, detail="缺少token")
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT user_name, status FROM cd_sp_user WHERE token=%s", (token,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=401, detail="无效的token")
        user_name, status = row
        if status == -1:
            raise HTTPException(status_code=429, detail="用户已被锁定")
        if user_name != "root":
            raise HTTPException(status_code=403, detail="需要管理员权限")
        return user_name
    finally:
        cursor.close()
        conn.close()


def current_sp_user_id(token: Optional[str] = Header(None)):
    if not token:
        return 1
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT sp_user_id, status FROM cd_sp_user WHERE token=%s", (token,))
        row = cursor.fetchone()
        if not row:
            return 1
        sp_user_id, status = row
        if status == -1:
            raise HTTPException(status_code=429, detail="用户已被锁定")
        return int(sp_user_id or 1)
    finally:
        cursor.close()
        conn.close()


LINGQU_PRICE_MARKUP = float(os.getenv("LINGQU_PRICE_MARKUP", "1.18"))
LINGQU_DAILY_DISCOUNT = float(os.getenv("LINGQU_DAILY_DISCOUNT", "0.92"))
LINGQU_WEEKLY_DISCOUNT = float(os.getenv("LINGQU_WEEKLY_DISCOUNT", "0.86"))
LINGQU_MONTHLY_DISCOUNT = float(os.getenv("LINGQU_MONTHLY_DISCOUNT", "0.78"))
AUTODL_PROVISION_DRY_RUN = os.getenv("AUTODL_PROVISION_DRY_RUN", "1") != "0"
AUTO_EXECUTE_PROVISION_ON_CREATE = os.getenv("AUTO_EXECUTE_PROVISION_ON_CREATE", "1") != "0"
AUTODL_DEFAULT_START_CMD = "grep -q '/root/miniconda3/bin' /root/.bashrc || echo 'export PATH=/root/miniconda3/bin:$PATH' >> /root/.bashrc; sleep infinity"
AUTODL_DEFAULT_CUDA_V_FROM = int(os.getenv("AUTODL_DEFAULT_CUDA_V_FROM", "118"))
AUTODL_DEFAULT_CUDA_V_TO = int(os.getenv("AUTODL_DEFAULT_CUDA_V_TO", "128"))
AUTODL_PRO_DEFAULT_IMAGE_UUID = os.getenv("AUTODL_PRO_DEFAULT_IMAGE_UUID", "base-image-l2t43iu6uk")
AUTODL_PRO_DEFAULT_GPU_SPEC_UUID = os.getenv("AUTODL_PRO_DEFAULT_GPU_SPEC_UUID", "4090D")
AUTODL_PRO_DEFAULT_DATA_CENTER_LIST = [
    item.strip() for item in os.getenv("AUTODL_PRO_DEFAULT_DATA_CENTER_LIST", "bj-B2").split(",") if item.strip()
]


AUTODL_ELASTIC_REGION_BASE = [
    {"name": "西北企业区", "dataCenter": "westDC2", "recommended": True},
    {"name": "西北B区", "dataCenter": "westDC3", "recommended": False},
    {"name": "北京A区", "dataCenter": "beijingDC1", "recommended": False},
    {"name": "北京B区", "dataCenter": "beijingDC2", "recommended": False},
    {"name": "L20专区", "dataCenter": "beijingDC4", "alias": "原北京C区", "recommended": False},
    {"name": "V100专区", "dataCenter": "beijingDC3", "alias": "原华南A区", "recommended": False},
    {"name": "佛山区", "dataCenter": "foshanDC1", "recommended": False},
    {"name": "重庆A区", "dataCenter": "chongqingDC1", "recommended": False},
    {"name": "3090专区", "dataCenter": "yangzhouDC1", "recommended": False},
    {"name": "内蒙B区", "dataCenter": "neimengDC3", "recommended": False},
]

AUTODL_PRO_REGION_BASE = [
    {"name": "北京B区", "dataCenter": "bj-B2", "elasticDataCenter": "beijingDC2", "recommended": True},
    {"name": "北京A区", "dataCenter": "bj-B1", "elasticDataCenter": "beijingDC1", "recommended": False},
    {"name": "西北B区", "dataCenter": "westDC3", "elasticDataCenter": "westDC3", "recommended": False},
]

AUTODL_PUBLIC_IMAGE_BASE = [
    {"imageUuid": "base-image-l2t43iu6uk", "framework": "TensorRT", "description": "cuda11.8-cudnn8-devel-ubuntu20.04-py38-torch2.0.0"},
    {"imageUuid": "base-image-l2843iu23k", "framework": "TensorRT", "description": "cuda11.8-cudnn8-devel-ubuntu20.04-py38-trt8.5.1"},
    {"imageUuid": "base-image-mbr2n4urrc", "framework": "Miniconda", "description": "cuda11.6-cudnn8-devel-ubuntu20.04-py38"},
    {"imageUuid": "base-image-h041hn36yt", "framework": "Miniconda", "description": "cuda11.1-cudnn8-devel-ubuntu18.04-py38"},
    {"imageUuid": "base-image-qkkhitpik5", "framework": "Miniconda", "description": "cuda10.2-cudnn7-devel-ubuntu18.04-py38"},
    {"imageUuid": "base-image-7bn8iqhkb5", "framework": "Miniconda", "description": "cudagl11.3-cudnn8-devel-ubuntu20.04-py38"},
    {"imageUuid": "base-image-k0vep6kyq8", "framework": "Miniconda", "description": "cuda9.0-cudnn7-devel-ubuntu16.04-py36"},
    {"imageUuid": "base-image-4bpg0tt88l", "framework": "TensorFlow", "description": "cuda11.4-py38-tf1.15.5"},
]

AUTODL_CUDA_VERSION_BASE = [
    {"cuda": "11.8", "value": 118},
    {"cuda": "12.0", "value": 120},
    {"cuda": "12.1", "value": 121},
    {"cuda": "12.2", "value": 122},
]

AUTODL_DATA_CENTERS = {item["dataCenter"]: item["name"] for item in AUTODL_ELASTIC_REGION_BASE}
AUTODL_PRO_DATA_CENTERS = {item["dataCenter"]: item["name"] for item in AUTODL_PRO_REGION_BASE}
AUTODL_STOCK_CACHE_TTL_SECONDS = int(os.getenv("AUTODL_STOCK_CACHE_TTL_SECONDS", "600"))
_AUTODL_STOCK_CACHE: Dict[str, Dict[str, Any]] = {}


def round_money(value: float) -> float:
    return round(float(value) + 1e-9, 2)


def autodl_region_name(region_sign: str, pro: bool = False) -> str:
    if not region_sign:
        return ""
    if pro:
        return AUTODL_PRO_DATA_CENTERS.get(region_sign, AUTODL_DATA_CENTERS.get(region_sign, region_sign))
    return AUTODL_DATA_CENTERS.get(region_sign, AUTODL_PRO_DATA_CENTERS.get(region_sign, region_sign))


def autodl_region_sign(region_name: str) -> str:
    for item in AUTODL_ELASTIC_REGION_BASE:
        if item["name"] == region_name:
            return item["dataCenter"]
    return ""


def parse_autodl_gpu_stock(payload: dict, gpu_name: str) -> dict:
    rows = payload.get("data")
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        return {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        info = row.get(gpu_name)
        if isinstance(info, dict):
            return info
        for key, value in row.items():
            if key == gpu_name and isinstance(value, dict):
                return value
    return {}


def parse_autodl_gpu_stock_list(payload: dict) -> list[dict]:
    rows = payload.get("data")
    if isinstance(rows, dict):
        rows = [rows]
    if not isinstance(rows, list):
        return []
    items = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        for gpu_name, info in row.items():
            if not isinstance(info, dict):
                continue
            items.append(
                {
                    "gpuName": gpu_name,
                    "total": int(info.get("total_gpu_num") or 0),
                    "available": int(info.get("idle_gpu_num") or 0),
                    "chipCorp": info.get("chip_corp") or "",
                    "cpuArch": info.get("cpu_arch") or "",
                }
            )
    return items


def cached_autodl_gpu_stock(region_sign: str, gpu_name: str) -> dict:
    cache_key = f"{region_sign}:{gpu_name}:{AUTODL_DEFAULT_CUDA_V_FROM}:{AUTODL_DEFAULT_CUDA_V_TO}"
    now = time.time()
    cached = _AUTODL_STOCK_CACHE.get(cache_key)
    if cached and now - float(cached.get("at", 0)) < AUTODL_STOCK_CACHE_TTL_SECONDS:
        return cached.get("stock") or {}
    response = AutoDLClient(timeout=8).list_gpu_stock(
        region_sign=region_sign,
        cuda_v_from=AUTODL_DEFAULT_CUDA_V_FROM,
        cuda_v_to=AUTODL_DEFAULT_CUDA_V_TO,
        gpu_name_set=[gpu_name],
    )
    stock = parse_autodl_gpu_stock(response, gpu_name)
    _AUTODL_STOCK_CACHE[cache_key] = {"at": now, "stock": stock}
    return stock


def cached_autodl_region_gpu_stock(region_sign: str) -> list[dict]:
    cache_key = f"{region_sign}:ALL:{AUTODL_DEFAULT_CUDA_V_FROM}:{AUTODL_DEFAULT_CUDA_V_TO}"
    now = time.time()
    cached = _AUTODL_STOCK_CACHE.get(cache_key)
    if cached and now - float(cached.get("at", 0)) < AUTODL_STOCK_CACHE_TTL_SECONDS:
        return cached.get("items") or []
    response = AutoDLClient(timeout=8).list_gpu_stock(
        region_sign=region_sign,
        cuda_v_from=AUTODL_DEFAULT_CUDA_V_FROM,
        cuda_v_to=AUTODL_DEFAULT_CUDA_V_TO,
    )
    items = parse_autodl_gpu_stock_list(response)
    _AUTODL_STOCK_CACHE[cache_key] = {"at": now, "items": items}
    return items


def apply_realtime_gpu_stock(resources: list[dict]) -> list[dict]:
    updated: list[dict] = []
    for resource in resources:
        item = dict(resource)
        if item.get("provider_mode") != "autodl_elastic":
            updated.append(item)
            continue
        region_sign = item.get("region_sign") or autodl_region_sign(item.get("region") or "")
        gpu_name = item.get("gpu_model") or ""
        if not region_sign or not gpu_name:
            updated.append(item)
            continue
        item["region_sign"] = region_sign
        try:
            stock = cached_autodl_gpu_stock(region_sign, gpu_name)
            if stock:
                item["available"] = int(stock.get("idle_gpu_num") or 0)
                item["total"] = int(stock.get("total_gpu_num") or 0)
                item["chip_corp"] = stock.get("chip_corp") or ""
                item["cpu_arch"] = stock.get("cpu_arch") or ""
                item["stock_source"] = "autodl_gpu_stock"
                item["stock_synced_at"] = datetime.now(timezone.utc).isoformat()
        except AutoDLError as exc:
            item["stock_error"] = str(exc)
        updated.append(item)
    return updated


def lingqu_pricing(provider_hourly_cost: float, original_hourly_cost: Optional[float] = None):
    cost = float(provider_hourly_cost or 0)
    original_cost = float(original_hourly_cost or cost or 0)
    hourly = round_money(cost * LINGQU_PRICE_MARKUP)
    original_hourly = round_money(original_cost * LINGQU_PRICE_MARKUP)
    daily = round_money(hourly * 24 * LINGQU_DAILY_DISCOUNT)
    weekly = round_money(hourly * 24 * 7 * LINGQU_WEEKLY_DISCOUNT)
    monthly = round_money(hourly * 24 * 30 * LINGQU_MONTHLY_DISCOUNT)
    return {
        "hourly_price": hourly,
        "original_hourly_price": original_hourly if original_hourly > hourly else None,
        "daily_price": daily,
        "weekly_price": weekly,
        "monthly_price": monthly,
        "provider_hourly_cost": round_money(cost),
        "provider_original_hourly_cost": round_money(original_cost),
        "pricing_policy": {
            "currency": "CNY",
            "markup": LINGQU_PRICE_MARKUP,
            "dailyDiscount": LINGQU_DAILY_DISCOUNT,
            "weeklyDiscount": LINGQU_WEEKLY_DISCOUNT,
            "monthlyDiscount": LINGQU_MONTHLY_DISCOUNT,
            "owner": "lingqu",
        },
    }


def apply_lingqu_pricing(resource: dict, expose_cost: bool = False):
    provider_cost = resource.get("provider_hourly_cost", resource.get("hourly_price", 0))
    provider_original_cost = resource.get("provider_original_hourly_cost", resource.get("original_hourly_price", provider_cost))
    priced = {**resource, **lingqu_pricing(provider_cost, provider_original_cost)}
    if not expose_cost:
        priced.pop("provider_hourly_cost", None)
        priced.pop("provider_original_hourly_cost", None)
        priced.pop("pricing_policy", None)
    if priced.get("discount_label") and not priced.get("original_hourly_price"):
        priced["discount_label"] = ""
    return priced


def parse_autodl_time(value):
    if not value:
        return ""
    if isinstance(value, dict):
        if not value.get("Valid"):
            return ""
        value = value.get("Time", "")
    if not isinstance(value, str):
        return str(value)
    return value.replace("T", " ").replace("+08:00", "").replace("Z", "")[:19]


def autodl_deployment_to_view(item: dict):
    template = item.get("template") or {}
    regions = template.get("region_sign_list") or template.get("dc_list") or []
    gpus = template.get("gpu_name_set") or []
    starting = int(item.get("starting_num") or 0)
    running = int(item.get("running_num") or 0)
    replica = int(item.get("replica_num") or 0)
    finished = int(item.get("finished_num") or 0)
    status_map = {"running": "部署中", "stopped": "已停止", "finished": "已完成"}
    return {
        "id": item.get("uuid") or str(item.get("id") or ""),
        "providerId": item.get("id"),
        "name": item.get("name") or "",
        "type": item.get("deployment_type") or "ReplicaSet",
        "region": " / ".join(regions) if regions else "未指定",
        "gpu": " / ".join(gpus) if gpus else "未指定",
        "gpuCount": template.get("gpu_num") or 1,
        "imageUuid": item.get("image_uuid") or template.get("image_uuid") or "",
        "imageName": template.get("image_name") or "",
        "copies": [starting, running, replica, finished],
        "startingNum": starting,
        "runningNum": running,
        "replicaNum": replica,
        "finishedNum": finished,
        "status": status_map.get(item.get("status"), item.get("status") or "未知"),
        "rawStatus": item.get("status") or "",
        "pack": "无",
        "currentCostText": money_text((float(item.get("price_estimates") or 0) / 1000)) + "/时",
        "created": parse_autodl_time(item.get("created_at")),
        "updated": parse_autodl_time(item.get("updated_at")),
        "reuseContainer": bool(item.get("reuse_container")),
        "serviceProtocol": template.get("service_6006_port_protocol") or template.get("service_port_protocol") or "http",
    }


def autodl_container_to_instance(item: dict):
    info = item.get("info") or {}
    deployment = item.get("deployment") or {}
    template = deployment.get("template") or item.get("template") or {}
    uuid = item.get("uuid") or item.get("container_uuid") or str(item.get("id") or "")
    status = item.get("status") or ""
    status_map = {"running": "运行中", "starting": "启动中", "stopped": "已停止", "finished": "已完成", "failed": "异常"}
    region = item.get("region_sign") or info.get("region_sign") or "弹性部署"
    machine = item.get("machine_alias") or item.get("machine_name") or item.get("node_name") or "-"
    gpu_names = template.get("gpu_name_set") or []
    gpu_count = template.get("gpu_num") or item.get("gpu_num") or 1
    gpu_text = f"{' / '.join(gpu_names) if gpu_names else 'GPU'} * {gpu_count}卡"
    quick_tools = []
    for name, key in [
        ("WebUI-6006", "service_6006_port_url"),
        ("AutoPanel-6008", "service_6008_port_url"),
        ("服务入口", "service_url"),
    ]:
        if info.get(key):
            quick_tools.append(name)
    if not quick_tools:
        quick_tools = ["实例监控"]
    return {
        "id": uuid,
        "displayId": uuid,
        "name": deployment.get("name") or item.get("name") or uuid,
        "region": autodl_region_name(item.get("data_center") or region) or region,
        "machine": machine,
        "status": status_map.get(status, status or "未知"),
        "rawStatus": status,
        "gpu": gpu_text,
        "health": "正常" if status == "running" else "等待中" if status == "starting" else "已停止",
        "billing": "按量计费",
        "release_time": "关机15天后释放",
        "system_disk_usage": "0.00%",
        "data_disk_usage": "0.00%",
        "quick_tools": quick_tools,
        "serviceUrl": info.get("service_url") or "",
        "service6006Url": info.get("service_6006_port_url") or "",
        "service6008Url": info.get("service_6008_port_url") or "",
        "sshCommand": info.get("ssh_command") or "",
        "rootPassword": info.get("root_password") or "",
        "providerDeploymentUuid": item.get("deployment_uuid") or "",
        "providerPricePerHour": round_money((float(item.get("price") or 0) / 1000)),
        "providerDataCenter": item.get("data_center") or "",
        "created": parse_autodl_time(item.get("created_at")),
        "updated": parse_autodl_time(item.get("updated_at")),
    }


def db_rows(query: str, params: tuple = ()):
    conn = get_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
    finally:
        conn.close()


def db_one(query: str, params: tuple = ()):
    rows = db_rows(query, params)
    return rows[0] if rows else None


def db_exec(query: str, params: tuple = ()):
    conn = get_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(query, params)
        conn.commit()
    finally:
        conn.close()


def ensure_app_instance_type_column():
    row = db_one(
        """
        SELECT COUNT(*) AS count
        FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cd_app_instance' AND COLUMN_NAME='instance_type'
        """
    )
    if int((row or {}).get("count") or 0) == 0:
        db_exec("ALTER TABLE cd_app_instance ADD COLUMN instance_type VARCHAR(32) NOT NULL DEFAULT 'task' AFTER billing_mode")


def ensure_provider_binding_table():
    db_exec(
        """
        CREATE TABLE IF NOT EXISTS cd_provider_binding (
            binding_id BIGINT PRIMARY KEY AUTO_INCREMENT,
            product_type VARCHAR(32) NOT NULL,
            product_id VARCHAR(128) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'autodl',
            deployment_uuid VARCHAR(64) NOT NULL DEFAULT '',
            image_uuid VARCHAR(64) NOT NULL DEFAULT '',
            image_name VARCHAR(255) NOT NULL DEFAULT '',
            gpu_name_set_json TEXT,
            region_sign_list_json TEXT,
            cmd TEXT,
            service_ports_json TEXT,
            billing_mode VARCHAR(64) NOT NULL DEFAULT '',
            price_text VARCHAR(64) NOT NULL DEFAULT '',
            status VARCHAR(32) NOT NULL DEFAULT 'draft',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_product_provider (product_type, product_id, provider)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def provider_binding_from_row(row):
    return {
        "id": row["binding_id"],
        "productType": row["product_type"],
        "productId": row["product_id"],
        "provider": row["provider"],
        "deploymentUuid": row["deployment_uuid"],
        "imageUuid": row["image_uuid"],
        "imageName": row["image_name"],
        "gpuNameSet": parse_tags(row.get("gpu_name_set_json")),
        "regionSignList": parse_tags(row.get("region_sign_list_json")),
        "cmd": row["cmd"] or "",
        "servicePorts": parse_tags(row.get("service_ports_json")),
        "billingMode": row["billing_mode"] or "",
        "priceText": row["price_text"] or "",
        "status": row["status"],
        "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
        "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
    }


def provider_binding_rows(product_type: str = "", product_id: str = ""):
    ensure_provider_binding_table()
    where = "1=1"
    params: list = []
    if product_type:
        where += " AND product_type=%s"
        params.append(product_type)
    if product_id:
        where += " AND product_id=%s"
        params.append(product_id)
    rows = db_rows(
        f"""
        SELECT *
        FROM cd_provider_binding
        WHERE {where}
        ORDER BY updated_at DESC, binding_id DESC
        """,
        tuple(params),
    )
    return [provider_binding_from_row(row) for row in rows]


def active_provider_binding(product_type: str, product_id: str):
    try:
        rows = provider_binding_rows(product_type=product_type, product_id=product_id)
        return next((item for item in rows if item["status"] == "active"), None)
    except Exception:
        return None


def validate_provider_binding(binding: dict, policy: Optional[dict] = None):
    errors = []
    warnings = []
    if not binding.get("imageUuid") and not binding.get("deploymentUuid"):
        errors.append("缺少 imageUuid 或 deploymentUuid")
    if not binding.get("gpuNameSet"):
        warnings.append("未配置 GPU 型号，将使用请求默认值")
    if not binding.get("regionSignList"):
        warnings.append("未配置调度地区，将由 AutoDL 自动匹配或使用请求默认值")
    if not binding.get("cmd"):
        warnings.append(f"未配置启动命令，将使用 {AUTODL_DEFAULT_START_CMD}")
    if not binding.get("servicePorts"):
        warnings.append("未配置服务端口")
    if binding.get("status") != "active":
        errors.append("绑定未启用")
    if policy and policy.get("status") not in {"active", "default"}:
        warnings.append("价格策略未启用")
    return {"ready": len(errors) == 0, "errors": errors, "warnings": warnings}


def save_provider_binding(payload: ProviderBindingRequest):
    ensure_provider_binding_table()
    db_exec(
        """
        INSERT INTO cd_provider_binding
        (product_type, product_id, provider, deployment_uuid, image_uuid, image_name, gpu_name_set_json,
         region_sign_list_json, cmd, service_ports_json, billing_mode, price_text, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          deployment_uuid=VALUES(deployment_uuid),
          image_uuid=VALUES(image_uuid),
          image_name=VALUES(image_name),
          gpu_name_set_json=VALUES(gpu_name_set_json),
          region_sign_list_json=VALUES(region_sign_list_json),
          cmd=VALUES(cmd),
          service_ports_json=VALUES(service_ports_json),
          billing_mode=VALUES(billing_mode),
          price_text=VALUES(price_text),
          status=VALUES(status)
        """,
        (
            payload.productType,
            payload.productId,
            payload.provider,
            payload.deploymentUuid,
            payload.imageUuid,
            payload.imageName,
            json.dumps(payload.gpuNameSet, ensure_ascii=False),
            json.dumps(payload.regionSignList, ensure_ascii=False),
            payload.cmd,
            json.dumps(payload.servicePorts, ensure_ascii=False),
            payload.billingMode,
            payload.priceText,
            payload.status,
        ),
    )
    rows = provider_binding_rows(payload.productType, payload.productId)
    return rows[0] if rows else None


def ensure_price_policy_table():
    db_exec(
        """
        CREATE TABLE IF NOT EXISTS cd_price_policy (
            policy_id BIGINT PRIMARY KEY AUTO_INCREMENT,
            product_type VARCHAR(32) NOT NULL,
            product_id VARCHAR(128) NOT NULL,
            billing_mode VARCHAR(64) NOT NULL DEFAULT '按次',
            base_coin DECIMAL(10,2) NOT NULL DEFAULT 0,
            quality_extra_coin DECIMAL(10,2) NOT NULL DEFAULT 0,
            duration_extra_coin DECIMAL(10,2) NOT NULL DEFAULT 0,
            image_extra_coin DECIMAL(10,2) NOT NULL DEFAULT 0,
            price_text VARCHAR(64) NOT NULL DEFAULT '',
            status VARCHAR(32) NOT NULL DEFAULT 'active',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY uniq_price_product_mode (product_type, product_id, billing_mode)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def price_policy_from_row(row):
    return {
        "id": row["policy_id"],
        "productType": row["product_type"],
        "productId": row["product_id"],
        "billingMode": row["billing_mode"],
        "baseCoin": float(row["base_coin"] or 0),
        "qualityExtraCoin": float(row["quality_extra_coin"] or 0),
        "durationExtraCoin": float(row["duration_extra_coin"] or 0),
        "imageExtraCoin": float(row["image_extra_coin"] or 0),
        "priceText": row["price_text"] or "",
        "status": row["status"],
        "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
        "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
    }


def default_price_policy(product_type: str, product_id: str, mode: str = ""):
    base = 5 if mode == "text_to_image" else 18 if mode == "text_to_video" else 12
    for template in WORKFLOW_TEMPLATES:
        if product_type == "workflow" and template["id"] == product_id:
            base = 5 if template["mode"] == "text_to_image" else 18 if template["mode"] == "text_to_video" else 12
            return {
                "id": 0,
                "productType": product_type,
                "productId": product_id,
                "billingMode": "按次",
                "baseCoin": float(base),
                "qualityExtraCoin": 4.0,
                "durationExtraCoin": 6.0,
                "imageExtraCoin": 2.0 if template["mode"] == "text_to_image" else 0.0,
                "priceText": template["priceText"],
                "status": "default",
                "createdAt": "",
                "updatedAt": "",
            }
    return {
        "id": 0,
        "productType": product_type,
        "productId": product_id,
        "billingMode": "按次",
        "baseCoin": float(base),
        "qualityExtraCoin": 4.0,
        "durationExtraCoin": 6.0,
        "imageExtraCoin": 2.0 if mode == "text_to_image" else 0.0,
        "priceText": f"{base}算力币/次",
        "status": "default",
        "createdAt": "",
        "updatedAt": "",
    }


def price_policy_rows(product_type: str = "", product_id: str = ""):
    ensure_price_policy_table()
    where = "1=1"
    params: list = []
    if product_type:
        where += " AND product_type=%s"
        params.append(product_type)
    if product_id:
        where += " AND product_id=%s"
        params.append(product_id)
    rows = db_rows(
        f"""
        SELECT *
        FROM cd_price_policy
        WHERE {where}
        ORDER BY updated_at DESC, policy_id DESC
        """,
        tuple(params),
    )
    return [price_policy_from_row(row) for row in rows]


def active_price_policy(product_type: str, product_id: str, mode: str = ""):
    try:
        ensure_price_policy_table()
        row = db_one(
            """
            SELECT *
            FROM cd_price_policy
            WHERE product_type=%s AND product_id=%s AND status='active'
            ORDER BY updated_at DESC, policy_id DESC
            LIMIT 1
            """,
            (product_type, product_id),
        )
        if row:
            return price_policy_from_row(row)
    except Exception:
        pass
    return default_price_policy(product_type, product_id, mode)


def save_price_policy(payload: PricePolicyRequest):
    ensure_price_policy_table()
    price_text = payload.priceText or f"{payload.baseCoin:g}算力币/次"
    db_exec(
        """
        INSERT INTO cd_price_policy
        (product_type, product_id, billing_mode, base_coin, quality_extra_coin, duration_extra_coin,
         image_extra_coin, price_text, status)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE
          base_coin=VALUES(base_coin),
          quality_extra_coin=VALUES(quality_extra_coin),
          duration_extra_coin=VALUES(duration_extra_coin),
          image_extra_coin=VALUES(image_extra_coin),
          price_text=VALUES(price_text),
          status=VALUES(status)
        """,
        (
            payload.productType,
            payload.productId,
            payload.billingMode,
            payload.baseCoin,
            payload.qualityExtraCoin,
            payload.durationExtraCoin,
            payload.imageExtraCoin,
            price_text,
            payload.status,
        ),
    )
    rows = price_policy_rows(payload.productType, payload.productId)
    return rows[0] if rows else None


def ensure_provision_task_table():
    db_exec(
        """
        CREATE TABLE IF NOT EXISTS cd_provision_task (
            task_id BIGINT PRIMARY KEY AUTO_INCREMENT,
            task_no VARCHAR(64) NOT NULL UNIQUE,
            product_type VARCHAR(32) NOT NULL,
            product_id VARCHAR(128) NOT NULL,
            target_id VARCHAR(128) NOT NULL,
            provider VARCHAR(32) NOT NULL DEFAULT 'autodl',
            deployment_uuid VARCHAR(64) NOT NULL DEFAULT '',
            image_uuid VARCHAR(64) NOT NULL DEFAULT '',
            image_name VARCHAR(255) NOT NULL DEFAULT '',
            status VARCHAR(32) NOT NULL DEFAULT 'queued',
            billing_mode VARCHAR(64) NOT NULL DEFAULT '',
            price_text VARCHAR(64) NOT NULL DEFAULT '',
            request_json TEXT,
            binding_json TEXT,
            policy_json TEXT,
            result_json TEXT,
            err_msg VARCHAR(512) NOT NULL DEFAULT '',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            KEY idx_target (target_id),
            KEY idx_product (product_type, product_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """
    )


def provision_task_from_row(row):
    return {
        "id": row["task_id"],
        "taskNo": row["task_no"],
        "productType": row["product_type"],
        "productId": row["product_id"],
        "targetId": row["target_id"],
        "provider": row["provider"],
        "deploymentUuid": row["deployment_uuid"],
        "imageUuid": row["image_uuid"],
        "imageName": row["image_name"],
        "status": row["status"],
        "billingMode": row["billing_mode"],
        "priceText": row["price_text"],
        "request": parse_tags(row.get("request_json")),
        "binding": parse_tags(row.get("binding_json")),
        "policy": parse_tags(row.get("policy_json")),
        "result": parse_tags(row.get("result_json")),
        "errMsg": row["err_msg"] or "",
        "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
        "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
    }


def provision_task_rows(limit: int = 50, status: str = ""):
    ensure_provision_task_table()
    where = "1=1"
    params: list = []
    if status:
        where += " AND status=%s"
        params.append(status)
    params.append(max(1, min(limit, 200)))
    rows = db_rows(
        f"""
        SELECT *
        FROM cd_provision_task
        WHERE {where}
        ORDER BY task_id DESC
        LIMIT %s
        """,
        tuple(params),
    )
    return [provision_task_from_row(row) for row in rows]


def provision_task_detail(task_id: int):
    ensure_provision_task_table()
    row = db_one("SELECT * FROM cd_provision_task WHERE task_id=%s", (task_id,))
    return provision_task_from_row(row) if row else None


def create_provision_task(product_type: str, product_id: str, target_id: str, request_payload: dict, binding: Optional[dict], policy: Optional[dict], status: str = "queued"):
    ensure_provision_task_table()
    task_no = f"PT-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    binding = binding or {}
    policy = policy or {}
    db_exec(
        """
        INSERT INTO cd_provision_task
        (task_no, product_type, product_id, target_id, provider, deployment_uuid, image_uuid, image_name,
         status, billing_mode, price_text, request_json, binding_json, policy_json, result_json)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            task_no,
            product_type,
            product_id,
            target_id,
            binding.get("provider") or "autodl",
            binding.get("deploymentUuid") or "",
            binding.get("imageUuid") or "",
            binding.get("imageName") or "",
            status,
            policy.get("billingMode") or binding.get("billingMode") or "",
            policy.get("priceText") or binding.get("priceText") or "",
            json.dumps(request_payload, ensure_ascii=False),
            json.dumps(binding, ensure_ascii=False),
            json.dumps(policy, ensure_ascii=False),
            json.dumps({"mode": "local-record", "next": "connect_autodl_create"}, ensure_ascii=False),
        ),
    )
    row = db_one("SELECT * FROM cd_provision_task WHERE task_no=%s", (task_no,))
    return provision_task_from_row(row) if row else None


def task_region_sign(request_payload: dict) -> str:
    value = str(request_payload.get("regionSign") or "").strip()
    if value:
        return value
    region = str(request_payload.get("region") or "").strip()
    return autodl_region_sign(region) or region


def autodl_payload_from_task(task: dict):
    binding = task.get("binding") or {}
    request_payload = task.get("request") or {}
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    requested_region = task_region_sign(request_payload)
    requested_gpu = str(request_payload.get("gpuModel") or "").strip()
    regions = [requested_region] if requested_region else (binding.get("regionSignList") or [])
    gpus = [requested_gpu] if requested_gpu else (binding.get("gpuNameSet") or [])
    cuda_v = int(request_payload.get("cudaV") or AUTODL_DEFAULT_CUDA_V_FROM)
    template = {
        "gpu_name_set": gpus or [request_payload.get("gpuModel") or "RTX 4090"],
        "gpu_num": int(request_payload.get("gpuCount") or 1),
        "cuda_v_from": cuda_v,
        "cuda_v_to": max(cuda_v, int(request_payload.get("cudaVTo") or AUTODL_DEFAULT_CUDA_V_TO)),
        "cpu_num_from": 1,
        "cpu_num_to": 256,
        "memory_size_from": 1,
        "memory_size_to": 256,
        "cmd": binding.get("cmd") or AUTODL_DEFAULT_START_CMD,
        "price_from": 0,
        "price_to": 9000,
        "image_uuid": str(binding.get("imageUuid") or ""),
    }
    if regions:
        template["dc_list"] = regions
    payload = {
        "name": f"lingqu-{task['productType']}-{task['targetId']}-{timestamp}"[:80],
        "deployment_type": "ReplicaSet",
        "replica_num": 1,
        "reuse_container": True,
        "reuse_container_scope": "all",
        "container_template": template,
    }
    return payload


def deployment_image_uuid(item: dict):
    return item.get("image_uuid") or (item.get("template") or {}).get("image_uuid") or (item.get("setting") or {}).get("image_uuid")


def deployment_template(item: dict) -> dict:
    return item.get("container_template") or item.get("template") or item.get("setting") or {}


def reusable_deployment_for_binding(binding: dict, request_payload: Optional[dict] = None):
    image_uuid = binding.get("imageUuid")
    if not image_uuid:
        return None
    request_payload = request_payload or {}
    requested_region = task_region_sign(request_payload)
    requested_gpu = str(request_payload.get("gpuModel") or "").strip()

    def matches_request(item: dict) -> bool:
        template = deployment_template(item)
        regions = template.get("dc_list") or template.get("region_sign_list") or []
        gpus = template.get("gpu_name_set") or []
        if requested_region and regions and requested_region not in regions:
            return False
        if requested_gpu and gpus and requested_gpu not in gpus:
            return False
        return True

    deployments = AutoDLClient().list_deployments(page_size=100).get("data", {}).get("list", [])
    candidates = [
        item
        for item in deployments
        if deployment_image_uuid(item) == image_uuid and item.get("status") != "stopped" and item.get("deployment_type") == "ReplicaSet" and matches_request(item)
    ]
    if not candidates:
        return None
    return sorted(candidates, key=lambda item: int(item.get("id") or 0), reverse=True)[0]


def scale_payload_from_deployment(item: dict):
    current_replica = int((item or {}).get("replica_num") or 0)
    return {"deployment_uuid": item["uuid"], "replica_num": current_replica + 1, "current_replica_num": current_replica}


def next_replica_payload(deployment_uuid: str):
    deployments = AutoDLClient().list_deployments(page_size=100).get("data", {}).get("list", [])
    current = next((item for item in deployments if item.get("uuid") == deployment_uuid), None)
    if not current:
        return {"deployment_uuid": deployment_uuid, "replica_num": 1, "current_replica_num": 0}
    return scale_payload_from_deployment(current)


def execute_provision_task(task_id: int, force_real: bool = False):
    task = provision_task_detail(task_id)
    if not task:
        return None
    if task["status"] not in {"queued", "local", "failed"}:
        return task
    binding = task.get("binding") or {}
    if not binding:
        result = {"mode": "local-record", "reason": "no active provider binding"}
        db_exec(
            "UPDATE cd_provision_task SET status='local', result_json=%s, err_msg='' WHERE task_id=%s",
            (json.dumps(result, ensure_ascii=False), task_id),
        )
        return provision_task_detail(task_id)
    dry_run = AUTODL_PROVISION_DRY_RUN and not force_real
    action = "scale_replicaset" if binding.get("deploymentUuid") else "create_deployment"
    try:
        if action == "scale_replicaset":
            payload = {"deployment_uuid": binding["deploymentUuid"], "replica_num": 1}
            if not dry_run:
                payload = next_replica_payload(binding["deploymentUuid"])
                response = AutoDLClient().update_replica_num(binding["deploymentUuid"], payload["replica_num"])
            else:
                response = {"code": "DryRun", "msg": "", "data": {"action": action, "payload": payload}}
        else:
            payload = autodl_payload_from_task(task)
            image_uuid = payload["container_template"].get("image_uuid")
            if not image_uuid:
                raise AutoDLError("缺少 imageUuid，不能创建 AutoDL 部署")
            reusable = reusable_deployment_for_binding(binding, task.get("request") or {})
            if reusable:
                action = "reuse_image_scale_replicaset"
                payload = scale_payload_from_deployment(reusable)
                response = {"code": "DryRun", "msg": "", "data": {"action": action, "payload": payload}} if dry_run else AutoDLClient().update_replica_num(reusable["uuid"], payload["replica_num"])
            else:
                response = {"code": "DryRun", "msg": "", "data": {"action": action, "payload": payload}} if dry_run else AutoDLClient().create_deployment(payload)
        response_data = response.get("data") if isinstance(response, dict) else {}
        provider_deployment_uuid = (
            binding.get("deploymentUuid")
            or payload.get("deployment_uuid")
            or (response_data or {}).get("uuid")
            or (response_data or {}).get("deployment_uuid")
            or (response_data or {}).get("deploymentUuid")
            or ""
        )
        result = {"dryRun": dry_run, "action": action, "payload": payload, "response": response, "providerDeploymentUuid": provider_deployment_uuid}
        next_status = "dry_run" if dry_run else "submitted"
        db_exec(
            "UPDATE cd_provision_task SET status=%s, result_json=%s, err_msg='' WHERE task_id=%s",
            (next_status, json.dumps(result, ensure_ascii=False), task_id),
        )
    except Exception as exc:
        result = {"dryRun": dry_run, "action": action, "error": str(exc)}
        db_exec(
            "UPDATE cd_provision_task SET status='failed', result_json=%s, err_msg=%s WHERE task_id=%s",
            (json.dumps(result, ensure_ascii=False), str(exc)[:500], task_id),
        )
    return provision_task_detail(task_id)


def sync_provision_task_status(task_id: int):
    task = provision_task_detail(task_id)
    if not task:
        return None
    result = task.get("result") or {}
    binding = task.get("binding") or {}
    deployment_uuid = result.get("providerDeploymentUuid") or task.get("deploymentUuid") or binding.get("deploymentUuid")
    if not deployment_uuid:
        db_exec(
            "UPDATE cd_provision_task SET err_msg=%s WHERE task_id=%s",
            ("缺少 deploymentUuid，无法同步 AutoDL 容器状态", task_id),
        )
        return provision_task_detail(task_id)
    try:
        payload = AutoDLClient().list_containers(deployment_uuid=deployment_uuid, released=False, page_size=20)
        data = payload.get("data") or {}
        rows = data.get("list") or []
        containers = [autodl_container_to_instance(row) for row in rows]
        white_label = result.get("whiteLabel") or {}
        if white_label.get("status") == "installed" and white_label.get("token"):
            for container in containers:
                if container.get("id") != white_label.get("containerUuid"):
                    continue
                token = white_label["token"]
                for key in ("serviceUrl", "service6006Url"):
                    base_url = str(container.get(key) or "").rstrip("/")
                    if base_url:
                        container[key] = f"{base_url}/?token={token}"
        active_container = next((item for item in containers if item["rawStatus"] in {"running", "starting"}), containers[0] if containers else None)
        running = len([item for item in containers if item["rawStatus"] == "running"])
        starting = len([item for item in containers if item["rawStatus"] == "starting"])
        failed = len([item for item in containers if item["rawStatus"] == "failed"])
        next_status = "running" if running > 0 else "starting" if starting > 0 else "failed" if failed > 0 else task["status"]
        merged_result = {
            **result,
            "providerContainerUuid": (active_container or {}).get("id") or result.get("providerContainerUuid") or "",
            "sync": {
                "deploymentUuid": deployment_uuid,
                "total": data.get("result_total", len(containers)),
                "running": running,
                "starting": starting,
                "failed": failed,
                "containers": containers[:5],
                "syncedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
            },
        }
        db_exec(
            "UPDATE cd_provision_task SET status=%s, result_json=%s, err_msg='' WHERE task_id=%s",
            (next_status, json.dumps(merged_result, ensure_ascii=False), task_id),
        )
        if next_status == "running" and active_container:
            maybe_start_white_label_injection(task_id, active_container)
    except Exception as exc:
        merged_result = {**result, "syncError": str(exc)}
        db_exec(
            "UPDATE cd_provision_task SET result_json=%s, err_msg=%s WHERE task_id=%s",
            (json.dumps(merged_result, ensure_ascii=False), str(exc)[:500], task_id),
        )
    return provision_task_detail(task_id)


def maybe_start_white_label_injection(task_id: int, active_container: dict):
    task = provision_task_detail(task_id)
    if not task or task.get("productType") != "market_app" or not WHITE_LABEL_WORKER.exists():
        return
    request_payload = task.get("request") or {}
    if request_payload.get("skipWhiteLabel"):
        return
    result = task.get("result") or {}
    container_uuid = active_container.get("id") or ""
    white_label = result.get("whiteLabel") or {}
    if white_label.get("containerUuid") == container_uuid and white_label.get("status") in {"installing", "installed"}:
        return
    token = secrets.token_hex(16)
    result["whiteLabel"] = {
        "status": "installing",
        "containerUuid": container_uuid,
        "token": token,
        "startedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
    }
    db_exec(
        "UPDATE cd_provision_task SET result_json=%s, err_msg='' WHERE task_id=%s",
        (json.dumps(result, ensure_ascii=False), task_id),
    )
    log_dir = ROOT / "runtime_data" / "white_label"
    log_dir.mkdir(parents=True, exist_ok=True)
    with (log_dir / f"task-{task_id}.log").open("ab") as output:
        subprocess.Popen(
            [sys.executable, str(WHITE_LABEL_WORKER), str(task_id)],
            cwd=str(ROOT),
            stdin=subprocess.DEVNULL,
            stdout=output,
            stderr=subprocess.STDOUT,
            start_new_session=True,
        )


def stop_provision_task(task_id: int, force_real: bool = False):
    task = provision_task_detail(task_id)
    if not task:
        return None
    result = task.get("result") or {}
    container_uuid = result.get("providerContainerUuid")
    if not container_uuid:
        synced = sync_provision_task_status(task_id)
        task = synced or task
        result = task.get("result") or {}
        container_uuid = result.get("providerContainerUuid")
    if not container_uuid:
        db_exec(
            "UPDATE cd_provision_task SET err_msg=%s WHERE task_id=%s",
            ("缺少 providerContainerUuid，无法停止 AutoDL 容器", task_id),
        )
        return provision_task_detail(task_id)
    dry_run = AUTODL_PROVISION_DRY_RUN and not force_real
    payload = {"deployment_container_uuid": container_uuid, "decrease_one_replica_num": True}
    try:
        response = {"code": "DryRun", "msg": "", "data": {"action": "stop_container", "payload": payload}} if dry_run else AutoDLClient().stop_container(container_uuid, True)
        merged_result = {**result, "stop": {"dryRun": dry_run, "payload": payload, "response": response, "stoppedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")}}
        db_exec(
            "UPDATE cd_provision_task SET status=%s, result_json=%s, err_msg='' WHERE task_id=%s",
            ("dry_run" if dry_run else "stopped", json.dumps(merged_result, ensure_ascii=False), task_id),
        )
    except Exception as exc:
        merged_result = {**result, "stopError": str(exc)}
        db_exec(
            "UPDATE cd_provision_task SET result_json=%s, err_msg=%s WHERE task_id=%s",
            (json.dumps(merged_result, ensure_ascii=False), str(exc)[:500], task_id),
        )
    return provision_task_detail(task_id)


def preview_provision_task(task_id: int):
    task = provision_task_detail(task_id)
    if not task:
        return None
    binding = task.get("binding") or {}
    if not binding:
        return {"task": task, "ready": False, "reason": "no active provider binding", "action": "local"}
    action = "scale_replicaset" if binding.get("deploymentUuid") else "create_deployment"
    payload = {"deployment_uuid": binding["deploymentUuid"], "replica_num": 1} if action == "scale_replicaset" else autodl_payload_from_task(task)
    reusable = None
    if action == "create_deployment":
        try:
            reusable = reusable_deployment_for_binding(binding, task.get("request") or {})
        except Exception:
            reusable = None
        if reusable:
            action = "reuse_image_scale_replicaset"
            payload = scale_payload_from_deployment(reusable)
    validation = validate_provider_binding(binding, task.get("policy") or {})
    ready = validation["ready"] and bool(binding.get("deploymentUuid") or payload.get("container_template", {}).get("image_uuid"))
    if action == "reuse_image_scale_replicaset":
        ready = validation["ready"] and bool(payload.get("deployment_uuid"))
    return {"task": task, "ready": ready, "action": action, "payload": payload, "reusableDeployment": reusable, "validation": validation, "dryRun": AUTODL_PROVISION_DRY_RUN}


def execute_queued_provision_tasks(limit: int = 20, force_real: bool = False):
    tasks = provision_task_rows(limit=limit, status="queued")
    results = []
    for task in tasks:
        result = execute_provision_task(int(task["id"]), force_real=force_real)
        if result:
            results.append(result)
    return {"items": results, "summary": {"total": len(results), "dryRun": len([item for item in results if item["status"] == "dry_run"]), "submitted": len([item for item in results if item["status"] == "submitted"]), "failed": len([item for item in results if item["status"] == "failed"])}}


def sync_submitted_provision_tasks(limit: int = 50):
    tasks = [item for item in provision_task_rows(limit=limit) if item["status"] in {"submitted", "starting", "running"}]
    results = []
    for task in tasks:
        result = sync_provision_task_status(int(task["id"]))
        if result:
            results.append(result)
    return {
        "items": results,
        "summary": {
            "total": len(results),
            "running": len([item for item in results if item["status"] == "running"]),
            "starting": len([item for item in results if item["status"] == "starting"]),
            "failed": len([item for item in results if item["status"] == "failed"]),
        },
    }


def maybe_execute_created_task(task: Optional[dict], binding: Optional[dict]):
    if not task or not binding or not AUTO_EXECUTE_PROVISION_ON_CREATE:
        return task
    if task.get("status") != "queued":
        return task
    return execute_provision_task(int(task["id"])) or task


def refresh_provision_task_bindings(limit: int = 100):
    tasks = [item for item in provision_task_rows(limit=limit) if item["status"] in {"local", "queued", "failed"}]
    refreshed = []
    for task in tasks:
        binding = active_provider_binding(task["productType"], task["productId"])
        policy = active_price_policy(task["productType"], task["productId"])
        if not binding:
            continue
        validation = validate_provider_binding(binding, policy)
        status = "queued" if validation["ready"] else "local"
        result = {"mode": "binding-refreshed", "validation": validation, "next": "dry_run"}
        db_exec(
            """
            UPDATE cd_provision_task
            SET provider=%s, deployment_uuid=%s, image_uuid=%s, image_name=%s, status=%s,
                billing_mode=%s, price_text=%s, binding_json=%s, policy_json=%s, result_json=%s, err_msg=%s
            WHERE task_id=%s
            """,
            (
                binding.get("provider") or "autodl",
                binding.get("deploymentUuid") or "",
                binding.get("imageUuid") or "",
                binding.get("imageName") or "",
                status,
                policy.get("billingMode") or binding.get("billingMode") or "",
                policy.get("priceText") or binding.get("priceText") or "",
                json.dumps(binding, ensure_ascii=False),
                json.dumps(policy, ensure_ascii=False),
                json.dumps(result, ensure_ascii=False),
                "; ".join(validation["errors"]),
                task["id"],
            ),
        )
        refreshed.append(provision_task_detail(int(task["id"])))
    return {"items": [item for item in refreshed if item], "summary": {"total": len(refreshed), "queued": len([item for item in refreshed if item and item["status"] == "queued"])}}


def provider_container_snapshot():
    bindings = [item for item in provider_binding_rows() if item["status"] == "active" and item.get("deploymentUuid")]
    items = []
    errors = []
    for binding in bindings:
        try:
            payload = AutoDLClient().list_containers(deployment_uuid=binding["deploymentUuid"], released=False, page_size=20)
            data = payload.get("data") or {}
            rows = data.get("list") or []
            containers = [autodl_container_to_instance(row) for row in rows]
            items.append(
                {
                    "productType": binding["productType"],
                    "productId": binding["productId"],
                    "deploymentUuid": binding["deploymentUuid"],
                    "imageName": binding["imageName"],
                    "total": data.get("result_total", len(containers)),
                    "running": len([item for item in containers if item["rawStatus"] == "running"]),
                    "starting": len([item for item in containers if item["rawStatus"] == "starting"]),
                    "stopped": len([item for item in containers if item["rawStatus"] in {"stopped", "finished"}]),
                    "containers": containers[:5],
                }
            )
        except AutoDLError as exc:
            errors.append({"deploymentUuid": binding["deploymentUuid"], "errMsg": str(exc)})
    return {"items": items, "errors": errors, "summary": {"bindings": len(bindings), "snapshots": len(items), "errors": len(errors)}}


def owned_provider_deployments(sp_user_id: int = 1):
    ensure_provision_task_table()
    rows = db_rows(
        """
        SELECT p.result_json, p.target_id
        FROM cd_provision_task p
        JOIN cd_app_instance i ON i.instance_id=p.target_id AND i.sp_user_id=%s
        WHERE p.product_type='market_app' AND p.status IN ('submitted','starting','running')
        ORDER BY p.updated_at DESC
        """,
        (sp_user_id,),
    )
    deployments = set()
    containers = set()
    for row in rows:
        result = parse_tags(row.get("result_json"))
        deployment_uuid = result.get("providerDeploymentUuid") or ""
        container_uuid = result.get("providerContainerUuid") or ""
        if deployment_uuid:
            deployments.add(deployment_uuid)
        if container_uuid:
            containers.add(container_uuid)
    return deployments, containers


def live_autodl_instances(limit: int = 20, sp_user_id: int = 1):
    owned_deployments, owned_containers = owned_provider_deployments(sp_user_id)
    if not owned_deployments and not owned_containers:
        return []
    try:
        rows = AutoDLClient().list_containers(released=False, page_size=limit).get("data", {}).get("list", [])
    except Exception:
        return []
    rows = [
        row
        for row in rows
        if row.get("status") in {"running", "starting"}
        and ((row.get("uuid") in owned_containers) if owned_containers else (row.get("deployment_uuid") in owned_deployments))
    ]
    items = [autodl_container_to_instance(row) for row in rows]
    return [
        {
            **item,
            "name": item.get("name") or item.get("providerDeploymentUuid") or "AutoDL 弹性实例",
            "billing": f"按量计费 ￥{item.get('providerPricePerHour', 0):g}/时",
            "release_time": "关机15天后释放",
            "system_disk_usage": item.get("system_disk_usage") or "0.00%",
            "data_disk_usage": item.get("data_disk_usage") or "0.00%",
            "quick_tools": [
                label
                for label, url in [
                    ("6006", item.get("service6006Url")),
                    ("6008", item.get("service6008Url")),
                    ("服务入口", item.get("serviceUrl")),
                    ("SSH", item.get("sshCommand")),
                ]
                if url
            ] or item.get("quick_tools", []),
        }
        for item in items
    ]


def latest_provision_task_by_target(target_id: str):
    ensure_provision_task_table()
    row = db_one(
        """
        SELECT *
        FROM cd_provision_task
        WHERE target_id=%s
        ORDER BY task_id DESC
        LIMIT 1
        """,
        (target_id,),
    )
    return provision_task_from_row(row) if row else None


def sync_owned_task_quietly(task: Optional[dict]):
    if not task or task.get("status") not in {"submitted", "starting", "running"}:
        return task
    try:
        return sync_provision_task_status(int(task["id"])) or task
    except Exception:
        return task


def compute_instance_view_from_app_instance(instance: dict, sync_live: bool = True):
    task = latest_provision_task_by_target(instance["id"])
    if sync_live:
        task = sync_owned_task_quietly(task)
    result = (task or {}).get("result") or {}
    task_status = (task or {}).get("status") or ""
    instance_type = instance.get("instanceType") or "task"
    if instance_type == "development":
        pro_uuid = result.get("providerProInstanceUuid") or ""
        pro_status = result.get("proStatus") or task_status or instance.get("status")
        pro_snapshot = result.get("proSnapshot") or {}
        if sync_live and pro_uuid:
            try:
                pro_status_payload = AutoDLClient().pro_instance_status(pro_uuid)
                pro_snapshot_payload = AutoDLClient().pro_instance_snapshot(pro_uuid)
                pro_status = pro_status_payload.get("data") or pro_status
                pro_snapshot = pro_snapshot_payload.get("data") or pro_snapshot
                merged_result = {**result, "providerProInstanceUuid": pro_uuid, "proStatus": pro_status, "proSnapshot": pro_snapshot}
                db_exec("UPDATE cd_provision_task SET status=%s, result_json=%s, err_msg='' WHERE task_id=%s", ("running" if pro_status == "running" else "stopped" if pro_status == "shutdown" else "starting", json.dumps(merged_result, ensure_ascii=False), task["id"]))
                result = merged_result
            except Exception:
                pass
        pro_status_map = {"running": "运行中", "starting": "启动中", "shutdown": "已关机", "shutting_down": "关机中", "failed": "异常"}
        status_text = pro_status_map.get(pro_status, instance.get("statusText") or "未知")
        service6006 = pro_snapshot.get("service_6006_domain") or ""
        service6008 = pro_snapshot.get("service_6008_domain") or ""
        jupyter = pro_snapshot.get("jupyter_domain") or ""
        quick_tools = [
            label for label, url in [("JupyterLab", jupyter), ("6006", service6006), ("6008", service6008), ("SSH", pro_snapshot.get("ssh_command"))] if url
        ]
        payg = float(pro_snapshot.get("payg_price") or 0) / 1000
        price = round_money(payg * LINGQU_PRICE_MARKUP) if payg else 0
        return {
            "id": instance["id"],
            "displayId": pro_uuid or instance["id"],
            "name": instance.get("instanceName") or instance.get("appName") or instance["id"],
            "region": autodl_region_name(pro_snapshot.get("region_sign") or instance.get("region") or "", pro=True) or instance.get("region") or "Pro资源",
            "machine": pro_uuid or "容器实例Pro",
            "status": status_text,
            "rawStatus": pro_status,
            "instanceType": "development",
            "instanceTypeText": "开发型",
            "gpu": f"{pro_snapshot.get('snapshot_gpu_alias_name') or instance.get('gpuModel') or 'GPU'} * {instance.get('gpuCount') or 1}卡",
            "health": "正常" if pro_status == "running" else "已关机" if pro_status == "shutdown" else "等待启动",
            "billing": f"{instance.get('billingMode') or '按量计费'}" + (f" ￥{price:g}/时" if price else (f" {instance.get('priceText')}" if instance.get("priceText") else "")),
            "release_time": "关机保留，15天未开机可能释放",
            "system_disk_usage": f"{int((pro_snapshot.get('expand_system_disk_size') or pro_snapshot.get('system_init_disk_size') or instance.get('systemDiskGb', 30) * 1024**3) / 1024**3)}GB",
            "data_disk_usage": "Pro系统盘保留",
            "quick_tools": quick_tools,
            "serviceUrl": f"https://{jupyter}" if jupyter else "",
            "service6006Url": f"https://{service6006}" if service6006 else "",
            "service6008Url": f"https://{service6008}" if service6008 else "",
            "sshCommand": pro_snapshot.get("ssh_command") or "",
            "rootPassword": pro_snapshot.get("root_password") or "",
            "providerDeploymentUuid": "",
            "providerContainerUuid": "",
            "providerProInstanceUuid": pro_uuid,
            "provisionTaskId": (task or {}).get("id") or 0,
            "providerPricePerHour": price,
            "providerDataCenter": pro_snapshot.get("region_sign") or "",
        }
    sync_info = result.get("sync") or {}
    containers = sync_info.get("containers") or []
    live = next((item for item in containers if item.get("rawStatus") in {"running", "starting"}), containers[0] if containers else {})
    if task_status == "stopped" or result.get("stop"):
        live = {}
        raw_status = "stopped"
    else:
        raw_status = live.get("rawStatus") or task_status or instance.get("status")
    status_map = {
        "running": "运行中",
        "starting": "调度中",
        "submitted": "调度中",
        "pending": "待调度",
        "dry_run": "预检完成",
        "stopped": "已停止",
        "released": "已释放",
        "failed": "异常",
        "local": "待配置",
        "queued": "待调度",
    }
    status_text = status_map.get(raw_status, instance.get("statusText") or "未知")
    health = "正常" if raw_status == "running" else "等待启动" if raw_status in {"starting", "submitted", "queued", "pending"} else "已停止" if raw_status in {"stopped", "released"} else "异常" if raw_status == "failed" else "待配置"
    price_text = instance.get("priceText") or "按量计费"
    billing = price_text if price_text.startswith("按") else f"{instance.get('billingMode') or '按量计费'} {price_text}".strip()
    quick_tools = [
        label
        for label, url in [
            ("6006", live.get("service6006Url")),
            ("6008", live.get("service6008Url")),
            ("服务入口", live.get("serviceUrl")),
            ("SSH", live.get("sshCommand")),
        ]
        if url
    ]
    if not quick_tools and raw_status in {"running", "starting", "submitted"}:
        quick_tools = ["实例监控"]
    machine = live.get("machine") or ""
    raw_region = instance.get("region") or live.get("region") or live.get("providerDataCenter") or ""
    region_name = autodl_region_name(raw_region) or raw_region or "弹性资源"
    provider_container_uuid = result.get("providerContainerUuid") or live.get("id") or ""
    provider_deployment_uuid = result.get("providerDeploymentUuid") or (task or {}).get("deploymentUuid") or ""
    return {
        "id": instance["id"],
        "displayId": provider_container_uuid or provider_deployment_uuid or instance["id"],
        "name": instance.get("instanceName") or instance.get("appName") or instance["id"],
        "region": region_name,
        "machine": machine,
        "status": status_text,
        "rawStatus": raw_status,
        "instanceType": "task",
        "instanceTypeText": "任务型",
        "gpu": f"{instance.get('gpuModel') or 'GPU'} * {instance.get('gpuCount') or 1}卡",
        "health": health,
        "billing": billing,
        "release_time": "停止即释放数据，请先同步结果" if raw_status in {"running", "starting", "submitted", "queued", "pending"} else "已停止/已释放",
        "system_disk_usage": f"{instance.get('systemDiskGb') or 30}GB",
        "data_disk_usage": f"{instance.get('dataDiskGb') or 50}GB",
        "quick_tools": quick_tools,
        "serviceUrl": live.get("serviceUrl") or "",
        "service6006Url": live.get("service6006Url") or "",
        "service6008Url": live.get("service6008Url") or "",
        "sshCommand": live.get("sshCommand") or "",
        "rootPassword": live.get("rootPassword") or "",
        "providerDeploymentUuid": provider_deployment_uuid,
        "providerContainerUuid": provider_container_uuid,
        "provisionTaskId": (task or {}).get("id") or 0,
        "providerPricePerHour": round_money(float(live.get("providerPricePerHour") or 0) * LINGQU_PRICE_MARKUP),
        "providerDataCenter": live.get("providerDataCenter") or "",
    }


def compute_instance_views(sp_user_id: int = 1, sync_live: bool = False):
    items = []
    for item in app_instance_rows("all", sp_user_id):
        task = latest_provision_task_by_target(item["id"])
        if not task or task.get("productType") != "market_app":
            continue
        items.append(compute_instance_view_from_app_instance(item, sync_live=sync_live))
    return items


def parse_tags(tags):
    if not tags:
        return []
    if isinstance(tags, list):
        return tags
    try:
        return json.loads(tags)
    except Exception:
        return []


WORKFLOW_TEMPLATES = [
    {
        "id": "ltx-video",
        "title": "LTX2.3 图生视频",
        "mode": "image_to_video",
        "category": "图生视频",
        "cover": "https://admin-yaochuang-tech.oss-cn-shanghai.aliyuncs.com/compute/workflows/workflow-ltx-video.png",
        "summary": "上传角色图，一键生成电影感运镜短片",
        "priceText": "12算力币/次",
        "runCount": "8.6k",
        "tags": ["精选", "角色", "短视频"],
    },
    {
        "id": "wan-video",
        "title": "Wan2.2 文生视频",
        "mode": "text_to_video",
        "category": "文生视频",
        "cover": "https://admin-yaochuang-tech.oss-cn-shanghai.aliyuncs.com/compute/workflows/workflow-wan-video.png",
        "summary": "输入剧情提示词，生成高质感商业视频镜头",
        "priceText": "18算力币/次",
        "runCount": "6.9k",
        "tags": ["热门", "剧情", "商业"],
    },
    {
        "id": "product-video",
        "title": "商品图动态展示",
        "mode": "image_to_video",
        "category": "商品营销",
        "cover": "https://admin-yaochuang-tech.oss-cn-shanghai.aliyuncs.com/compute/workflows/workflow-product-video.png",
        "summary": "电商主图转 5 秒卖点视频，适合批量投放",
        "priceText": "9算力币/次",
        "runCount": "5.1k",
        "tags": ["商用", "电商", "批量"],
    },
    {
        "id": "avatar-video",
        "title": "数字人口播片段",
        "mode": "image_to_video",
        "category": "数字人",
        "cover": "https://admin-yaochuang-tech.oss-cn-shanghai.aliyuncs.com/compute/workflows/workflow-avatar.png",
        "summary": "上传人像和口播文案，生成竖版短视频",
        "priceText": "15算力币/次",
        "runCount": "4.8k",
        "tags": ["新", "数字人", "口播"],
    },
    {
        "id": "cyber-style",
        "title": "赛博风格转绘",
        "mode": "text_to_image",
        "category": "风格化",
        "cover": "https://admin-yaochuang-tech.oss-cn-shanghai.aliyuncs.com/compute/workflows/workflow-cyber-style.png",
        "summary": "普通照片转赛博朋克风图像和视频封面",
        "priceText": "6算力币/次",
        "runCount": "9.2k",
        "tags": ["爆款", "风格化", "封面"],
    },
    {
        "id": "comic-storyboard",
        "title": "漫画分镜生成",
        "mode": "text_to_image",
        "category": "图像设计",
        "cover": "https://admin-yaochuang-tech.oss-cn-shanghai.aliyuncs.com/compute/workflows/workflow-comic-storyboard.png",
        "summary": "提示词生成连续分镜，支持二次编辑",
        "priceText": "5算力币/次",
        "runCount": "3.7k",
        "tags": ["精选", "分镜", "漫画"],
    },
]

DEFAULT_WORKFLOW_RUNS = [
    {
        "id": "WF-240518",
        "templateId": "ltx-video",
        "title": "LTX2.3 图生视频",
        "status": "succeeded",
        "statusText": "生成成功",
        "mode": "image_to_video",
        "durationText": "00:01:48",
        "costText": "12算力币",
        "createdAt": "2026-05-20 17:18",
        "prompt": "电影感镜头，人物回头，柔和光线，浅景深，细节丰富",
        "ratio": "9:16",
        "quality": "1080P",
        "seed": "238471",
        "resultType": "video",
    },
    {
        "id": "WF-240519",
        "templateId": "product-video",
        "title": "商品图动态展示",
        "status": "running",
        "statusText": "生成中",
        "mode": "image_to_video",
        "durationText": "00:00:36",
        "costText": "9算力币",
        "createdAt": "2026-05-20 17:11",
        "prompt": "玻璃质感产品，慢速环绕，金色高光，电商主图展示",
        "ratio": "1:1",
        "quality": "1080P",
        "seed": "884120",
        "resultType": "video",
    },
    {
        "id": "WF-240520",
        "templateId": "wan-video",
        "title": "Wan2.2 文生视频",
        "status": "queued",
        "statusText": "排队中",
        "mode": "text_to_video",
        "durationText": "-",
        "costText": "18算力币",
        "createdAt": "2026-05-20 17:02",
        "prompt": "城市雨夜，霓虹反射，人物穿过街道，电影感推镜",
        "ratio": "16:9",
        "quality": "1080P",
        "seed": "random",
        "resultType": "video",
    },
    {
        "id": "WF-240521",
        "templateId": "cyber-style",
        "title": "赛博风格转绘",
        "status": "failed",
        "statusText": "生成失败",
        "mode": "text_to_image",
        "durationText": "00:00:52",
        "costText": "0算力币",
        "createdAt": "2026-05-20 16:44",
        "prompt": "赛博朋克角色头像，霓虹光，未来城市背景",
        "ratio": "1:1",
        "quality": "1080P",
        "seed": "238471",
        "resultType": "image",
    },
]


def load_workflow_runs():
    try:
        if WORKFLOW_RUNS_FILE.exists():
            data = json.loads(WORKFLOW_RUNS_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return list(DEFAULT_WORKFLOW_RUNS)


def save_workflow_runs():
    try:
        WORKFLOW_RUNS_FILE.parent.mkdir(parents=True, exist_ok=True)
        WORKFLOW_RUNS_FILE.write_text(json.dumps(WORKFLOW_RUNS, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


def load_workflow_cases():
    try:
        if WORKFLOW_CASES_FILE.exists():
            data = json.loads(WORKFLOW_CASES_FILE.read_text(encoding="utf-8"))
            if isinstance(data, list):
                return data
    except Exception:
        pass
    return []


def save_workflow_cases():
    try:
        WORKFLOW_CASES_FILE.parent.mkdir(parents=True, exist_ok=True)
        WORKFLOW_CASES_FILE.write_text(json.dumps(PUBLISHED_WORKFLOW_CASES, ensure_ascii=False, indent=2), encoding="utf-8")
    except Exception:
        pass


WORKFLOW_RUNS = load_workflow_runs()
PUBLISHED_WORKFLOW_CASES = load_workflow_cases()


class WorkflowRunRequest(BaseModel):
    templateId: str
    mode: str
    prompt: str
    negativePrompt: Optional[str] = None
    ratio: str = "9:16"
    quality: str = "1080P"
    durationSeconds: Optional[int] = 6
    imageCount: Optional[int] = 1
    styleStrength: Optional[str] = "medium"
    seed: Optional[str] = None


class WorkflowCreateRequest(BaseModel):
    templateId: str
    title: str
    category: str
    visibility: str = "private"
    source: str = "official_template"


class WorkflowShareRequest(BaseModel):
    templateId: str
    permission: str = "run"
    expiresInDays: int = 7


class WorkflowStatusRequest(BaseModel):
    status: str


class WorkflowDeleteRunsRequest(BaseModel):
    ids: List[str]


class WorkflowPublishRequest(BaseModel):
    runId: Optional[str] = None
    templateId: str
    title: str
    destination: str = "personal"
    cover: str = "middle"
    tags: List[str] = []
    prompt: str = ""
    ratio: str = "9:16"
    quality: str = "1080P"


class RechargeRequest(BaseModel):
    amount: float
    payChannel: str = "微信支付"


class InvoiceRequest(BaseModel):
    amount: float
    invoiceType: str = "个人普通发票"
    title: str = "灵渠用户"
    content: str = "算力服务费"
    email: str = "finance@example.com"


class ContractRequest(BaseModel):
    contractType: str = "算力服务合同"
    subject: str = "耀创科技"
    amount: float = 0
    email: str = "finance@yaochuang.tech"


class SubAccountRequest(BaseModel):
    accountName: str = "ops@yaochuang.tech"
    roleName: str = "运维"
    permissionScope: str = "实例/镜像/账单只读"
    status: str = "启用"


class AccountSettingRequest(BaseModel):
    messageNotify: bool = True
    defaultRegion: str = "重庆A区"
    releaseReminder: bool = True


class AppInstanceCreateRequest(BaseModel):
    appId: str = "APP-ZIMAGE-WAN"
    instanceName: str = ""
    gpuModel: str = "RTX 5090-32G"
    region: str = "北京B区"
    gpuCount: int = 1
    billingMode: str = "按量计费"
    boot: bool = True
    instanceType: str = "task"


class AppInstanceActionRequest(BaseModel):
    action: str
    instanceName: Optional[str] = None


class AppInstanceBatchActionRequest(BaseModel):
    action: str = "boot"
    ids: List[str] = []


class AppCreateRequest(BaseModel):
    name: str = "Zimage-Wan-Ltx2.3-训练器"
    author: str = "灵渠"
    summary: str = "内置训练脚本、依赖环境、WebUI 服务和示例配置。"
    category: str = "AI-Toolkit / LORA"
    tags: List[str] = ["AI-Toolkit", "训练", "LORA", "Z-Image"]
    version: str = "v0.1"
    status: str = "draft"


class AppUpdateRequest(BaseModel):
    name: str
    summary: str
    category: str
    tags: List[str] = []


class AppVersionRequest(BaseModel):
    version: str = "v7"
    note: str = "更新应用配置和服务端口。"


class ProviderBindingRequest(BaseModel):
    productType: str = "market_app"
    productId: str
    provider: str = "autodl"
    deploymentUuid: str = ""
    imageUuid: str
    imageName: str = ""
    gpuNameSet: List[str] = []
    regionSignList: List[str] = []
    cmd: str = AUTODL_DEFAULT_START_CMD
    servicePorts: List[str] = ["6006", "6008"]
    billingMode: str = "按次/按量"
    priceText: str = ""
    status: str = "draft"


class PricePolicyRequest(BaseModel):
    productType: str = "workflow"
    productId: str
    billingMode: str = "按次"
    baseCoin: float = 0
    qualityExtraCoin: float = 0
    durationExtraCoin: float = 0
    imageExtraCoin: float = 0
    priceText: str = ""
    status: str = "active"


class ApiTokenCreateRequest(BaseModel):
    tokenName: str = "prod-chat-agent"
    permissionScope: str = "全部模型"
    dailyQuota: str = "￥500.00 / 日"


class ModelSettingRequest(BaseModel):
    defaultModel: str = "DeepSeek-V4-Pro"
    dailyBudget: str = "￥500.00 / 日"
    concurrencyLimit: str = "自动弹性"
    callbackUrl: str = "https://example.com/model/callback"
    dailyReport: bool = True
    autoRetry: bool = True
    ipWhitelist: bool = False


def money_text(value):
    sign = "+" if value > 0 else ""
    return f"{sign}￥{value:.2f}"


def ledger_type_text(biz_type: str, amount_cny: float, amount_coin: float):
    if biz_type == "recharge":
        return "充值", "余额充值", "微信支付"
    if biz_type == "workflow_run":
        return "支出", "工作流生成", "算力币"
    if biz_type == "storage":
        return "支出", "存储服务", "余额"
    if amount_cny < 0 or amount_coin < 0:
        return "支出", "应用实例", "余额"
    return "收入", "账户入账", "余额"


def wallet_summary(sp_user_id: int = 1):
    row = db_one(
        """
        SELECT balance_cny, frozen_cny, compute_coin
        FROM cd_wallet_account
        WHERE sp_user_id=%s
        """,
        (sp_user_id,),
    )
    if not row:
        return {"balanceCny": 0, "frozenCny": 0, "computeCoin": 0, "monthExpenseCny": 0, "invoiceableCny": 0}
    month = db_one(
        """
        SELECT COALESCE(SUM(ABS(amount_cny)),0) AS total
        FROM cd_wallet_ledger
        WHERE sp_user_id=%s AND amount_cny < 0 AND DATE_FORMAT(created_at, '%%Y-%%m') = DATE_FORMAT(NOW(), '%%Y-%%m')
        """,
        (sp_user_id,),
    )
    invoiceable = db_one(
        """
        SELECT COALESCE(SUM(amount_cny),0) AS total
        FROM cd_wallet_ledger
        WHERE sp_user_id=%s AND biz_type='recharge' AND amount_cny > 0
        """,
        (sp_user_id,),
    )
    return {
        "balanceCny": float(row["balance_cny"] or 0),
        "frozenCny": float(row["frozen_cny"] or 0),
        "computeCoin": float(row["compute_coin"] or 0),
        "monthExpenseCny": float(month["total"] or 0),
        "invoiceableCny": float(invoiceable["total"] or 0),
    }


def wallet_ledger_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT ledger_id, biz_type, biz_id, amount_cny, amount_coin, balance_after_cny, note, created_at
        FROM cd_wallet_ledger
        WHERE sp_user_id=%s
        ORDER BY created_at DESC, ledger_id DESC
        """,
        (sp_user_id,),
    )
    items = []
    for row in rows:
        amount_cny = float(row["amount_cny"] or 0)
        amount_coin = float(row["amount_coin"] or 0)
        income_type, trade_type, channel = ledger_type_text(row["biz_type"], amount_cny, amount_coin)
        amount_text = f"{amount_coin:+.2f}算力币" if amount_coin else money_text(amount_cny)
        items.append(
            {
                "id": f"LEDGER{int(row['ledger_id']):08d}",
                "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
                "incomeType": income_type,
                "tradeType": trade_type,
                "channel": channel,
                "amountText": amount_text,
                "balanceText": f"￥{float(row['balance_after_cny'] or 0):.2f}",
                "note": row["note"] or row["biz_id"] or "",
                "bizType": row["biz_type"],
                "bizId": row["biz_id"] or "",
            }
        )
    return items


def wallet_order_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT order_id, order_type, status, amount_cny, pay_channel, note, created_at
        FROM cd_order
        WHERE sp_user_id=%s
        ORDER BY created_at DESC
        """,
        (sp_user_id,),
    )
    return [
        {
            "orderNo": row["order_id"],
            "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
            "orderType": "充值订单" if row["order_type"] == "recharge" else row["order_type"],
            "status": "已支付" if row["status"] == "paid" else row["status"],
            "amount": f"￥{float(row['amount_cny'] or 0):.2f}",
            "payChannel": row["pay_channel"],
            "action": "详情",
        }
        for row in rows
    ]


def wallet_invoice_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT invoice_id, invoice_type, title, content, amount_cny, email, status, created_at
        FROM cd_invoice
        WHERE sp_user_id=%s
        ORDER BY created_at DESC
        """,
        (sp_user_id,),
    )
    return [
        {
            "invoiceNo": row["invoice_id"],
            "createdAt": row["created_at"].strftime("%Y-%m-%d") if row.get("created_at") else "",
            "type": row["invoice_type"],
            "content": row["content"],
            "amount": f"￥{float(row['amount_cny'] or 0):.2f}",
            "status": row["status"],
            "action": "申请开票" if row["status"] == "待开票" else "下载",
        }
        for row in rows
    ]


def wallet_coupon_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT coupon_id, coupon_name, discount_text, scope_text, valid_until, status
        FROM cd_coupon
        WHERE sp_user_id=%s
        ORDER BY status DESC, valid_until DESC
        """,
        (sp_user_id,),
    )
    return [
        {
            "couponNo": row["coupon_id"],
            "name": row["coupon_name"],
            "discount": row["discount_text"],
            "scope": row["scope_text"],
            "validUntil": row["valid_until"].strftime("%Y-%m-%d") if row.get("valid_until") else "",
            "status": row["status"],
            "action": "立即使用" if row["status"] == "可用" else "查看",
        }
        for row in rows
    ]


def wallet_contract_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT contract_id, contract_type, subject, amount_cny, status, created_at
        FROM cd_contract
        WHERE sp_user_id=%s
        ORDER BY created_at DESC
        """,
        (sp_user_id,),
    )
    return [
        {
            "contractNo": row["contract_id"],
            "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
            "contractType": row["contract_type"],
            "subject": row["subject"],
            "amount": f"￥{float(row['amount_cny'] or 0):.2f}",
            "status": row["status"],
            "action": "签署" if row["status"] == "待签署" else "下载",
        }
        for row in rows
    ]


def add_wallet_ledger(sp_user_id: int, biz_type: str, biz_id: str, amount_cny: float, amount_coin: float, note: str):
    conn = get_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                """
                INSERT INTO cd_wallet_account (sp_user_id, balance_cny, frozen_cny, compute_coin)
                VALUES (%s,0,0,0)
                ON DUPLICATE KEY UPDATE updated_at=updated_at
                """,
                (sp_user_id,),
            )
            cursor.execute(
                """
                UPDATE cd_wallet_account
                SET balance_cny = balance_cny + %s,
                    compute_coin = compute_coin + %s
                WHERE sp_user_id=%s
                """,
                (amount_cny, amount_coin, sp_user_id),
            )
            cursor.execute("SELECT balance_cny FROM cd_wallet_account WHERE sp_user_id=%s", (sp_user_id,))
            balance_after = cursor.fetchone()["balance_cny"]
            cursor.execute(
                """
                INSERT INTO cd_wallet_ledger
                (sp_user_id, biz_type, biz_id, amount_cny, amount_coin, balance_after_cny, note)
                VALUES (%s,%s,%s,%s,%s,%s,%s)
                """,
                (sp_user_id, biz_type, biz_id, amount_cny, amount_coin, balance_after, note),
            )
        conn.commit()
    finally:
        conn.close()


def account_profile(sp_user_id: int = 1):
    row = db_one(
        """
        SELECT sp_user_id, user_name, email, mobile, head_url, nick_name, status, last_login_time
        FROM cd_sp_user
        WHERE sp_user_id=%s
        """,
        (sp_user_id,),
    )
    if not row:
        return {}
    return {
        "userId": row["sp_user_id"],
        "userName": row["user_name"],
        "email": row["email"] or "",
        "mobile": row["mobile"] or row["user_name"],
        "headUrl": row["head_url"] or "",
        "nickName": row["nick_name"] or row["user_name"],
        "status": row["status"],
        "lastLoginTime": row["last_login_time"].strftime("%Y-%m-%d %H:%M:%S") if row.get("last_login_time") else "",
    }


def account_security_rows(sp_user_id: int = 1):
    profile = account_profile(sp_user_id)
    mobile = profile.get("mobile") or ""
    masked_mobile = f"{mobile[:3]}****{mobile[-4:]}" if len(mobile) >= 7 else mobile
    return [
        {"key": "password", "title": "登录密码", "desc": "安全性高的密码可以使账号更安全。建议您定期更换密码，设置一个包含字母和数字且长度超过8位的密码", "status": "已设置", "action": "修改", "ok": True},
        {"key": "phone", "title": "手机绑定", "desc": f"您已绑定了手机{masked_mobile}您的手机号可以直接用于登录、找回密码等", "status": "已绑定" if mobile else "未绑定", "action": "修改" if mobile else "绑定", "ok": bool(mobile)},
        {"key": "realname", "title": "实名认证", "desc": "实名认证后可以使用更完整的功能，如打开实例的自定义服务等", "status": "已认证", "action": "查看", "ok": True},
        {"key": "wechat", "title": "微信绑定", "desc": "您已绑定微信，可快速扫码登录", "status": "已绑定", "action": "解绑", "ok": True},
        {"key": "email", "title": "邮箱绑定", "desc": "绑定邮箱后可接收系统消息，如余额不足、实例即将到期、实例即将释放等消息", "status": "已绑定" if profile.get("email") else "未绑定", "action": "修改" if profile.get("email") else "绑定", "ok": bool(profile.get("email"))},
    ]


def account_access_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT login_ip, login_region, login_method, status, created_at
        FROM cd_access_log
        WHERE sp_user_id=%s
        ORDER BY created_at DESC
        """,
        (sp_user_id,),
    )
    return [
        {
            "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
            "loginIp": row["login_ip"],
            "loginRegion": row["login_region"] or "",
            "loginMethod": row["login_method"],
            "status": row["status"],
        }
        for row in rows
    ]


def account_sub_rows(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT sub_account_id, account_name, role_name, permission_scope, status, created_at
        FROM cd_sub_account
        WHERE sp_user_id=%s
        ORDER BY created_at DESC
        """,
        (sp_user_id,),
    )
    return [
        {
            "id": row["sub_account_id"],
            "accountName": row["account_name"],
            "roleName": row["role_name"],
            "permissionScope": row["permission_scope"],
            "status": row["status"],
            "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
            "action": "编辑",
        }
        for row in rows
    ]


def account_setting(sp_user_id: int = 1):
    row = db_one(
        """
        SELECT message_notify, default_region, release_reminder
        FROM cd_account_setting
        WHERE sp_user_id=%s
        """,
        (sp_user_id,),
    )
    if not row:
        return {"messageNotify": True, "defaultRegion": "重庆A区", "releaseReminder": True}
    return {"messageNotify": bool(row["message_notify"]), "defaultRegion": row["default_region"], "releaseReminder": bool(row["release_reminder"])}


def app_item_rows(tab: str = "mine", sp_user_id: int = 1):
    where = "sp_user_id=%s"
    params: list = [sp_user_id]
    if tab == "favorites":
        where += " AND is_favorite=1"
    elif tab == "recent":
        where += " AND last_used_at IS NOT NULL"
    elif tab == "drafts":
        where += " AND status='draft'"
    else:
        where += " AND status='published'"
    rows = db_rows(
        f"""
        SELECT app_id, app_name, author_name, version, category_text, status, is_favorite, last_used_at, updated_at
        FROM cd_app_item
        WHERE {where}
        ORDER BY COALESCE(last_used_at, updated_at) DESC
        """,
        tuple(params),
    )
    return [
        {
            "id": row["app_id"],
            "name": row["app_name"],
            "author": row["author_name"],
            "version": row["version"],
            "category": row["category_text"],
            "status": row["status"],
            "isFavorite": bool(row["is_favorite"]),
            "updatedAt": (row.get("last_used_at") or row.get("updated_at")).strftime("%Y-%m-%d %H:%M:%S") if (row.get("last_used_at") or row.get("updated_at")) else "",
            "action": "管理" if tab == "mine" else "继续使用" if tab == "recent" else "查看",
        }
        for row in rows
    ]


def app_market_rows(section: str = "all", query: str = "", tag: str = "", sp_user_id: int = 1):
    where = "sp_user_id=%s AND status IN ('published','favorite')"
    params: list = [sp_user_id]
    if section == "base":
        where += " AND is_base=1"
    query_terms = [term for term in query.replace("/", " ").replace("-", " ").split() if term]
    if query_terms:
        term_clauses = []
        for term in query_terms:
            term_clauses.append("(app_name LIKE %s OR author_name LIKE %s OR category_text LIKE %s OR summary LIKE %s)")
            like = f"%{term}%"
            params.extend([like, like, like, like])
        where += " AND (" + " OR ".join(term_clauses) + ")"
    if tag:
        where += " AND (category_text LIKE %s OR JSON_CONTAINS(tags_json, JSON_QUOTE(%s)))"
        params.extend([f"%{tag}%", tag])
    order_by = "download_count DESC, favorite_count DESC" if section == "weekly" else "updated_at DESC"
    rows = db_rows(
        f"""
        SELECT app_id, app_name, author_name, version, category_text, summary, badge_text, cover_tone,
               favorite_count, runtime_text, download_count, tags_json, is_base, status, is_favorite, updated_at
        FROM cd_app_item
        WHERE {where}
        ORDER BY {order_by}
        """,
        tuple(params),
    )
    return [
        {
            "id": row["app_id"],
            "name": row["app_name"],
            "author": row["author_name"],
            "version": row["version"],
            "category": row["category_text"],
            "summary": row["summary"],
            "badge": row["badge_text"],
            "coverTone": row["cover_tone"],
            "favoriteCount": row["favorite_count"],
            "runtimeText": row["runtime_text"],
            "downloadCount": row["download_count"],
            "tags": parse_tags(row.get("tags_json")),
            "isBase": bool(row["is_base"]),
            "status": row["status"],
            "isFavorite": bool(row["is_favorite"]),
            "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
        }
        for row in rows
    ]


def app_detail(app_id: str = "", sp_user_id: int = 1):
    if app_id:
        row = db_one(
            """
            SELECT app_id, app_name, author_name, version, category_text, summary, badge_text, cover_tone,
                   favorite_count, runtime_text, download_count, tags_json, is_base, status, is_favorite, updated_at
            FROM cd_app_item
            WHERE sp_user_id=%s AND app_id=%s
            """,
            (sp_user_id, app_id),
        )
        item = {
            "id": row["app_id"],
            "name": row["app_name"],
            "author": row["author_name"],
            "version": row["version"],
            "category": row["category_text"],
            "summary": row["summary"],
            "badge": row["badge_text"],
            "coverTone": row["cover_tone"],
            "favoriteCount": row["favorite_count"],
            "runtimeText": row["runtime_text"],
            "downloadCount": row["download_count"],
            "tags": parse_tags(row.get("tags_json")),
            "isBase": bool(row["is_base"]),
            "status": row["status"],
            "isFavorite": bool(row["is_favorite"]),
            "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
        } if row else None
    else:
        rows = app_market_rows(sp_user_id=sp_user_id)
        item = rows[0] if rows else None
    if not item:
        return None
    tag_list = item["tags"] or [part.strip() for part in item["category"].split("/") if part.strip()]
    major_tags = tag_list[:4] if tag_list else ["应用", "工作流"]
    version = item["version"]
    updated_date = item["updatedAt"][:10] if item["updatedAt"] else "2026-05-21"
    detail_id = f"{item['id']}:{version}"
    return {
        **item,
        "appKey": detail_id,
        "startCommand": AUTODL_DEFAULT_START_CMD,
        "serviceTips": "开机后稍等片刻，等程序自动运行后，点击 WebUI-6006 即可打开应用界面。",
        "docLines": [
            f"{item['name']} 已内置运行脚本、依赖环境和示例配置。",
            f"适合 {item['category']} 场景，可直接创建实例后进入 WebUI 服务。",
            "服务端口默认提供 JupyterLab、SSH、WebUI-6006 和 WebUI-6008。",
            "页面展示开发者文档、启动日志、外部教程和常用运维入口。",
        ],
        "versions": [
            [version, updated_date, item["summary"], "当前版本"],
            ["v" + str(max(int("".join(ch for ch in version if ch.isdigit()) or "2") - 1, 1)), "2026-04-18", "优化启动脚本和服务端口检测", "可创建"],
            ["v1", "2026-03-26", "首次公开发布，保留基础镜像和示例配置", "历史版本"],
        ],
        "reviews": [
            [item["author"], "★★★★★", f"{item['name']} 启动清晰，适合快速复现 {major_tags[0]} 流程。", "2026-05-18"],
            ["AI-Train", "★★★★☆", f"分类和标签比较完整，建议继续补充 {major_tags[-1]} 示例。", "2026-05-16"],
            ["灵渠用户", "★★★★★", "创建实例后入口清楚，WebUI 服务能直接找到。", "2026-05-12"],
        ],
        "services": [
            ["JupyterLab", "8888", "系统服务", "可访问"],
            ["WebUI-6006", "6006", "应用服务", "可访问"],
            ["WebUI-6008", "6008", "应用服务", "可访问"],
            ["SSH", "22", "远程连接", "可访问"],
        ],
        "auditChecks": [
            ["基础信息完整", "通过", "名称、简介、分类、封面均已填写"],
            ["镜像安全扫描", "通过", "未发现高危漏洞和异常启动脚本"],
            ["服务端口声明", "通过", "WebUI-6006 / WebUI-6008 已声明"],
            ["应用说明规范", "待人工复核" if item["status"] == "draft" else "通过", "发布文档和示例说明已生成"],
        ],
    }


def ensure_default_rent_app_item(sp_user_id: int = 1):
    app_id = "MINICONDA-CUDA118-4090-CQ"
    db_exec(
        """
        INSERT INTO cd_app_item
        (app_id, sp_user_id, app_name, author_name, version, category_text, summary, badge_text, cover_tone,
         favorite_count, runtime_text, download_count, tags_json, is_base, status, is_favorite, last_used_at)
        VALUES (%s,%s,'重庆A区 RTX4090 CUDA11.8 基础环境','灵渠','v1','基础镜像 / Miniconda',
                '重庆A区 RTX 4090，CUDA 11.8-12.8，预置 /root/miniconda3，适合快速开机调试。',
                '基','video',0,'0h',0,%s,1,'published',0,NULL)
        ON DUPLICATE KEY UPDATE
          app_name=VALUES(app_name),
          summary=VALUES(summary),
          status='published',
          is_base=1
        """,
        (app_id, sp_user_id, json.dumps(["RTX4090", "CUDA11.8", "Miniconda"], ensure_ascii=False)),
    )
    return app_detail(app_id, sp_user_id)


def ensure_default_pro_app_item(sp_user_id: int = 1):
    app_id = "AUTODL-PRO-4090D-BJ"
    db_exec(
        """
        INSERT INTO cd_app_item
        (app_id, sp_user_id, app_name, author_name, version, category_text, summary, badge_text, cover_tone,
         favorite_count, runtime_text, download_count, tags_json, is_base, status, is_favorite, last_used_at)
        VALUES (%s,%s,'北京B区 RTX4090D Pro 开发环境','灵渠','v1','开发型算力 / Pro',
                '北京B区容器实例Pro，RTX 4090D，关机保留系统盘，适合 SSH、Jupyter 和长期调试。',
                'Pro','image',0,'0h',0,%s,1,'published',0,NULL)
        ON DUPLICATE KEY UPDATE
          app_name=VALUES(app_name),
          summary=VALUES(summary),
          status='published',
          is_base=1
        """,
        (app_id, sp_user_id, json.dumps(["RTX4090D", "Pro", "北京B区"], ensure_ascii=False)),
    )
    return app_detail(app_id, sp_user_id)


def create_app_item(payload: AppCreateRequest, sp_user_id: int = 1):
    app_id = f"APP-CUSTOM-{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    db_exec(
        """
        INSERT INTO cd_app_item
        (app_id, sp_user_id, app_name, author_name, version, category_text, summary, badge_text, cover_tone,
         favorite_count, runtime_text, download_count, tags_json, is_base, status, is_favorite, last_used_at)
        VALUES (%s,%s,%s,%s,%s,%s,%s,'草','avatar',0,'0h',0,%s,0,%s,0,NULL)
        """,
        (
            app_id,
            sp_user_id,
            payload.name,
            payload.author,
            payload.version,
            payload.category,
            payload.summary,
            json.dumps(payload.tags, ensure_ascii=False),
            payload.status,
        ),
    )
    return app_detail(app_id, sp_user_id)


def update_app_item(app_id: str, payload: AppUpdateRequest, sp_user_id: int = 1):
    if not app_detail(app_id, sp_user_id):
        return None
    db_exec(
        """
        UPDATE cd_app_item
        SET app_name=%s, category_text=%s, summary=%s, tags_json=%s
        WHERE sp_user_id=%s AND app_id=%s
        """,
        (payload.name, payload.category, payload.summary, json.dumps(payload.tags, ensure_ascii=False), sp_user_id, app_id),
    )
    return app_detail(app_id, sp_user_id)


def publish_app_version(app_id: str, payload: AppVersionRequest, sp_user_id: int = 1):
    detail = app_detail(app_id, sp_user_id)
    if not detail:
        return None
    db_exec(
        """
        UPDATE cd_app_item
        SET version=%s, status='published', badge_text='精', last_used_at=COALESCE(last_used_at, NOW())
        WHERE sp_user_id=%s AND app_id=%s
        """,
        (payload.version, sp_user_id, app_id),
    )
    return app_detail(app_id, sp_user_id)


def app_instance_from_row(row):
    services = parse_tags(row.get("service_json"))
    metrics = parse_tags(row.get("metric_json"))
    files = parse_tags(row.get("file_json"))
    logs = parse_tags(row.get("log_json"))
    bills = parse_tags(row.get("bill_json"))
    events = parse_tags(row.get("event_json"))
    return {
        "id": row["instance_id"],
        "appId": row["app_id"],
        "appName": row["app_name"],
        "author": row["author_name"],
        "instanceName": row["instance_name"],
        "gpuModel": row["gpu_model"],
        "region": row["region"],
        "gpuCount": row["gpu_count"],
        "gpuCountText": f"{row['gpu_count']}卡",
        "billingMode": row["billing_mode"],
        "instanceType": row.get("instance_type") or "task",
        "status": row["status"],
        "statusText": row["status_text"],
        "priceText": row["price_text"],
        "systemDiskGb": row["system_disk_gb"],
        "dataDiskGb": row["data_disk_gb"],
        "monthRuntimeText": row["month_runtime_text"],
        "currentCostText": row["current_cost_text"],
        "category": row["category_text"],
        "summary": row["summary"],
        "version": row["version"],
        "appKey": f"{row['app_id']}:{row['version']}",
        "startCommand": AUTODL_DEFAULT_START_CMD,
        "services": services,
        "metrics": metrics,
        "files": files,
        "logs": logs,
        "bills": bills,
        "events": events,
        "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
        "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
    }


def app_instance_rows(status: str = "all", sp_user_id: int = 1):
    ensure_app_instance_type_column()
    where = "i.sp_user_id=%s"
    params: list = [sp_user_id]
    if status in {"running", "pending", "stopped"}:
        where += " AND i.status=%s"
        params.append(status)
    rows = db_rows(
        f"""
        SELECT i.*, a.app_name, a.author_name, a.category_text, a.summary, a.version
        FROM cd_app_instance i
        JOIN cd_app_item a ON a.app_id=i.app_id
        WHERE {where}
        ORDER BY i.updated_at DESC
        """,
        tuple(params),
    )
    return [app_instance_from_row(row) for row in rows]


def app_instance_detail(instance_id: str = "", sp_user_id: int = 1):
    ensure_app_instance_type_column()
    if not instance_id:
        rows = app_instance_rows("all", sp_user_id)
        return rows[0] if rows else None
    row = db_one(
        """
        SELECT i.*, a.app_name, a.author_name, a.category_text, a.summary, a.version
        FROM cd_app_instance i
        JOIN cd_app_item a ON a.app_id=i.app_id
        WHERE i.sp_user_id=%s AND i.instance_id=%s
        """,
        (sp_user_id, instance_id),
    )
    return app_instance_from_row(row) if row else None


def default_instance_assets(status: str, status_text: str, instance_id: str, app_id: str):
    service_status = "运行中" if status == "running" else "未开机"
    services = [
        ["JupyterLab", "8888", "系统服务", service_status, "打开"],
        ["AutoPanel", "6008", "管理面板", service_status, "打开"],
        ["SSH", "22", "远程终端", service_status, "复制命令"],
        ["WebUI-6006", "6006", "应用服务", service_status, "打开"],
        ["WebUI-6008", "6008", "应用服务", service_status, "打开"],
    ]
    metrics = [
        ["GPU利用率", "36%" if status == "running" else "0%", "运行中" if status == "running" else "未开机"],
        ["显存占用", "18 / 24GB" if status == "running" else "0 / 32GB", "实时监控" if status == "running" else "等待启动"],
        ["运行时长", "0.2h" if status == "running" else "0h", "本月累计"],
        ["当前费用", "￥0.10", "按量计费"],
    ]
    files = [
        ["folder", "datasets", "目录", "2026-05-21 19:40"],
        ["folder", "outputs", "目录", "2026-05-21 19:40"],
        ["file", "start-app.sh", "3.1 KB", "2026-05-21 19:40"],
        ["file", "last-run.log", "2.4 KB", "2026-05-21 19:40"],
    ]
    logs = [
        f"[19:40:00] instance {instance_id} created from app {app_id}",
        f"[19:40:04] status changed to {status_text}",
        "[19:40:08] WebUI-6006 service registered",
    ]
    bills = [["2026-05-21 19:40:00", "创建实例", "系统盘 30GB", "￥0.10/日", "已计费"]]
    events = [["2026-05-21 19:40:00", "实例创建成功", "用户操作", f"从应用 {app_id} 创建", "done"]]
    return services, metrics, files, logs, bills, events


def update_instance_status(instance_id: str, action: str, instance_name: Optional[str] = None, sp_user_id: int = 1):
    detail = app_instance_detail(instance_id, sp_user_id)
    if not detail:
        return None
    if action == "delete":
        db_exec("DELETE FROM cd_app_instance WHERE instance_id=%s", (instance_id,))
        return {"deleted": True, "id": instance_id}
    if action == "clone":
        new_id = f"{instance_id}-copy-{datetime.now().strftime('%H%M%S')}"
        services, metrics, files, logs, bills, events = default_instance_assets("pending", "未开机", new_id, detail["appId"])
        db_exec(
            """
            INSERT INTO cd_app_instance
            (instance_id, sp_user_id, app_id, instance_name, gpu_model, region, gpu_count, billing_mode,
             status, status_text, price_text, system_disk_gb, data_disk_gb, month_runtime_text, current_cost_text,
             service_json, metric_json, file_json, log_json, bill_json, event_json)
            VALUES (%s,1,%s,%s,%s,%s,%s,%s,'pending','未开机',%s,%s,%s,'0h','￥0.00',%s,%s,%s,%s,%s,%s)
            """,
            (
                new_id, detail["appId"], instance_name or f"{detail['instanceName']}-副本", detail["gpuModel"], detail["region"],
                detail["gpuCount"], detail["billingMode"], detail["priceText"], detail["systemDiskGb"], detail["dataDiskGb"],
                json.dumps(services, ensure_ascii=False), json.dumps(metrics, ensure_ascii=False), json.dumps(files, ensure_ascii=False),
                json.dumps(logs, ensure_ascii=False), json.dumps(bills, ensure_ascii=False), json.dumps(events, ensure_ascii=False),
            ),
        )
        return app_instance_detail(new_id, sp_user_id)
    if action == "rename":
        db_exec("UPDATE cd_app_instance SET instance_name=%s WHERE instance_id=%s", (instance_name or detail["instanceName"], instance_id))
        return app_instance_detail(instance_id, sp_user_id)
    task = latest_provision_task_by_target(instance_id)
    if detail.get("instanceType") == "development" and task:
        result = task.get("result") or {}
        pro_uuid = result.get("providerProInstanceUuid") or ""
        if not pro_uuid:
            db_exec("UPDATE cd_provision_task SET err_msg=%s WHERE task_id=%s", ("缺少 providerProInstanceUuid，无法操作 Pro 实例", task["id"]))
            return app_instance_detail(instance_id, sp_user_id)
        try:
            if action == "stop":
                response = AutoDLClient().power_off_pro_instance(pro_uuid)
                merged = {**result, "proStop": {"response": response, "stoppedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")}, "proStatus": "shutting_down"}
                db_exec("UPDATE cd_provision_task SET status='stopped', result_json=%s, err_msg='' WHERE task_id=%s", (json.dumps(merged, ensure_ascii=False), task["id"]))
                db_exec("UPDATE cd_app_instance SET status='stopped', status_text='已关机' WHERE instance_id=%s", (instance_id,))
                return app_instance_detail(instance_id, sp_user_id)
            if action == "boot":
                response = AutoDLClient().power_on_pro_instance(pro_uuid)
                merged = {**result, "proBoot": {"response": response, "startedAt": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")}, "proStatus": "starting"}
                db_exec("UPDATE cd_provision_task SET status='starting', result_json=%s, err_msg='' WHERE task_id=%s", (json.dumps(merged, ensure_ascii=False), task["id"]))
                db_exec("UPDATE cd_app_instance SET status='pending', status_text='开机中' WHERE instance_id=%s", (instance_id,))
                return app_instance_detail(instance_id, sp_user_id)
        except Exception as exc:
            db_exec("UPDATE cd_provision_task SET err_msg=%s WHERE task_id=%s", (str(exc)[:500], task["id"]))
            return app_instance_detail(instance_id, sp_user_id)
    if action == "stop" and task and (task.get("binding") or task.get("deploymentUuid")):
        stopped = stop_provision_task(int(task["id"]), force_real=True)
        next_status = "stopped" if stopped and not stopped.get("errMsg") else "failed"
        next_text = "已停止/已释放" if next_status == "stopped" else "停止失败"
        db_exec("UPDATE cd_app_instance SET status=%s, status_text=%s WHERE instance_id=%s", (next_status, next_text, instance_id))
        return app_instance_detail(instance_id, sp_user_id)
    if action == "boot" and task and (task.get("binding") or task.get("deploymentUuid")):
        binding = active_provider_binding("market_app", detail["appId"]) or task.get("binding") or {}
        policy = active_price_policy("market_app", detail["appId"])
        request_payload = {
            "appId": detail["appId"],
            "instanceName": detail["instanceName"],
            "gpuModel": detail["gpuModel"],
            "region": detail["region"],
            "gpuCount": detail["gpuCount"],
            "billingMode": detail["billingMode"],
            "boot": True,
            "restartFrom": task.get("id"),
        }
        new_task = create_provision_task("market_app", detail["appId"], instance_id, request_payload, binding, policy, status="queued" if binding else "local")
        executed = execute_provision_task(int(new_task["id"]), force_real=True) if new_task and binding else new_task
        next_status = "pending" if executed and executed.get("status") in {"submitted", "starting", "dry_run"} else "running" if executed and executed.get("status") == "running" else "failed"
        next_text = "调度中" if next_status == "pending" else "运行中" if next_status == "running" else "启动失败"
        db_exec("UPDATE cd_app_instance SET status=%s, status_text=%s WHERE instance_id=%s", (next_status, next_text, instance_id))
        return app_instance_detail(instance_id, sp_user_id)
    status_map = {
        "boot": ("running", "运行中"),
        "restart": ("running", "运行中"),
        "stop": ("stopped", "已停止"),
    }
    if action in status_map:
        status, status_text = status_map[action]
        services, metrics, files, logs, bills, events = default_instance_assets(status, status_text, instance_id, detail["appId"])
        db_exec(
            """
            UPDATE cd_app_instance
            SET status=%s, status_text=%s, service_json=%s, metric_json=%s, file_json=%s,
                log_json=%s, bill_json=%s, event_json=%s
            WHERE instance_id=%s
            """,
            (
                status, status_text, json.dumps(services, ensure_ascii=False), json.dumps(metrics, ensure_ascii=False),
                json.dumps(files, ensure_ascii=False), json.dumps(logs, ensure_ascii=False), json.dumps(bills, ensure_ascii=False),
                json.dumps(events, ensure_ascii=False), instance_id,
            ),
        )
        return app_instance_detail(instance_id, sp_user_id)
    return detail


def model_rows(vendor: str = "", model_type: str = ""):
    where = "status='online'"
    params: list = []
    if vendor:
        where += " AND vendor=%s"
        params.append(vendor)
    if model_type:
        where += " AND model_type=%s"
        params.append(model_type)
    rows = db_rows(
        f"""
        SELECT model_id, model_name, vendor, model_type, discount_text, input_price, output_price,
               original_price, summary, tags_json, updated_at
        FROM cd_model_item
        WHERE {where}
        ORDER BY sort_no ASC, updated_at DESC
        """,
        tuple(params),
    )
    return [
        {
            "id": row["model_id"],
            "name": row["model_name"],
            "vendor": row["vendor"],
            "type": row["model_type"],
            "discount": row["discount_text"],
            "inputPrice": row["input_price"],
            "outputPrice": row["output_price"],
            "originalPrice": row["original_price"],
            "summary": row["summary"],
            "tags": parse_tags(row.get("tags_json")),
            "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
        }
        for row in rows
    ]


def model_detail(model_id: str):
    item = next((row for row in model_rows() if row["id"] == model_id), None)
    if not item:
        return None
    return {
        **item,
        "priceRows": [
            ["输入", item["inputPrice"] or "点击查看价格详情", "上下文缓存命中按账号等级结算"],
            ["输出", item["outputPrice"] or "点击查看价格详情", "会员折扣按账号等级结算"],
            ["并发", "自动弹性", "支持 API Key 调用与用量统计"],
        ],
        "endpoint": "https://api.yaochuang.tech/v1/chat/completions",
    }


def image_rows():
    rows = db_rows(
        """
        SELECT image_id, author_name, updated_text, badge_text, image_name, runtime_rank_text, github_star_text,
               summary, favorite_count, runtime_text, download_count, system_text, python_text, size_text,
               scenario_text, tags_json, updated_at
        FROM cd_image_item
        WHERE status='online'
        ORDER BY sort_no ASC, updated_at DESC
        """
    )
    return [
        {
            "id": row["image_id"],
            "author": row["author_name"],
            "updatedText": row["updated_text"],
            "badge": row["badge_text"],
            "name": row["image_name"],
            "runtimeRankText": row["runtime_rank_text"],
            "githubStarText": row["github_star_text"],
            "summary": row["summary"],
            "favoriteCount": row["favorite_count"],
            "runtimeText": row["runtime_text"],
            "downloadCount": row["download_count"],
            "systemText": row["system_text"],
            "pythonText": row["python_text"],
            "sizeText": row["size_text"],
            "scenarioText": row["scenario_text"],
            "tags": parse_tags(row.get("tags_json")),
            "updatedAt": row["updated_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("updated_at") else "",
        }
        for row in rows
    ]


def image_detail(image_id: str):
    item = next((row for row in image_rows() if row["id"] == image_id), None)
    if not item:
        return None
    return {
        **item,
        "usageCommand": "cd /root/project && bash start.sh",
        "related": ["ComfyUI", "StableDiffusion WebUI", "GPT-SoVITS", "Langchain-Chatchat"],
    }


def model_admin_dashboard(sp_user_id: int = 1):
    rows = db_rows(
        """
        SELECT model_name, token_usage_text, cost_text, request_count, success_rate
        FROM cd_model_usage
        WHERE sp_user_id=%s
        ORDER BY stat_date DESC, usage_id ASC
        LIMIT 10
        """,
        (sp_user_id,),
    )
    request_total = sum(int(row["request_count"]) for row in rows)
    return {
        "stats": [
            ["今日调用量", "191,428", "+12.6%"],
            ["今日费用", "￥560.82", "较昨日 +8.4%"],
            ["失败请求", "72", "错误率 0.04%"],
            ["活跃令牌", str(len(api_token_rows(sp_user_id, "启用"))), "3 个项目"],
        ],
        "peak": {"value": "32,840", "time": "18:00 - 19:00", "requestTotal": request_total},
        "usageRows": [[row["model_name"], row["token_usage_text"], row["cost_text"], str(row["request_count"]), row["success_rate"]] for row in rows],
    }


def api_token_rows(sp_user_id: int = 1, status: str = ""):
    where = "sp_user_id=%s"
    params: list = [sp_user_id]
    if status:
        where += " AND status=%s"
        params.append(status)
    rows = db_rows(
        f"""
        SELECT token_id, token_name, token_mask, permission_scope, status, created_at
        FROM cd_api_token
        WHERE {where}
        ORDER BY created_at DESC, token_id DESC
        """,
        tuple(params),
    )
    return [
        {
            "id": row["token_id"],
            "name": row["token_name"],
            "mask": row["token_mask"],
            "scope": row["permission_scope"],
            "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M:%S") if row.get("created_at") else "",
            "status": row["status"],
        }
        for row in rows
    ]


def model_setting(sp_user_id: int = 1):
    row = db_one(
        """
        SELECT default_model, daily_budget, concurrency_limit, callback_url, daily_report, auto_retry, ip_whitelist
        FROM cd_model_setting
        WHERE sp_user_id=%s
        """,
        (sp_user_id,),
    )
    if not row:
        return ModelSettingRequest().dict()
    return {
        "defaultModel": row["default_model"],
        "dailyBudget": row["daily_budget"],
        "concurrencyLimit": row["concurrency_limit"],
        "callbackUrl": row["callback_url"],
        "dailyReport": bool(row["daily_report"]),
        "autoRetry": bool(row["auto_retry"]),
        "ipWhitelist": bool(row["ip_whitelist"]),
    }


def message_rows(message_type: str = "", sp_user_id: int = 1):
    where = "sp_user_id=%s"
    params: list = [sp_user_id]
    if message_type:
        where += " AND message_type=%s"
        params.append(message_type)
    rows = db_rows(
        f"""
        SELECT message_id, message_type, type_text, title, content, read_status, created_at
        FROM cd_message
        WHERE {where}
        ORDER BY created_at DESC, message_id DESC
        """,
        tuple(params),
    )
    return [
        {
            "id": row["message_id"],
            "type": row["message_type"],
            "typeText": row["type_text"],
            "title": row["title"],
            "content": row["content"],
            "readStatus": row["read_status"],
            "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M") if row.get("created_at") else "",
        }
        for row in rows
    ]


def help_doc_rows():
    rows = db_rows(
        """
        SELECT doc_key, title, href, warning, intro, sections_json, code_text, sort_no
        FROM cd_help_doc
        WHERE status='online'
        ORDER BY sort_no ASC
        """
    )
    return [
        {
            "key": row["doc_key"],
            "title": row["title"],
            "href": row["href"],
            "warning": row["warning"],
            "intro": row["intro"],
            "sections": parse_tags(row.get("sections_json")),
            "code": row.get("code_text") or "",
        }
        for row in rows
    ]


def help_doc_detail(doc_key: str):
    rows = help_doc_rows()
    return next((row for row in rows if row["key"] == doc_key), None) or (rows[0] if rows else None)


def public_data_rows():
    rows = db_rows(
        """
        SELECT data_id, data_name, mount_path, size_text, data_type, publisher, summary, files_json
        FROM cd_public_data
        WHERE status='online'
        ORDER BY sort_no ASC
        """
    )
    return [
        {
            "id": row["data_id"],
            "name": row["data_name"],
            "mountPath": row["mount_path"],
            "sizeText": row["size_text"],
            "dataType": row["data_type"],
            "publisher": row["publisher"],
            "summary": row["summary"],
            "files": parse_tags(row.get("files_json")),
        }
        for row in rows
    ]


def public_data_detail(data_id: str):
    rows = public_data_rows()
    return next((row for row in rows if row["id"] == data_id), None) or (rows[0] if rows else None)


def shared_data_rows():
    rows = db_rows(
        """
        SELECT share_id, title, summary, owner_name, favorite_count, source_type
        FROM cd_shared_data
        WHERE status='online'
        ORDER BY sort_no ASC
        """
    )
    return [
        {
            "id": row["share_id"],
            "title": row["title"],
            "summary": row["summary"],
            "owner": row["owner_name"],
            "favoriteCount": row["favorite_count"],
            "sourceType": row["source_type"],
        }
        for row in rows
    ]


def estimate_workflow_cost(payload: WorkflowRunRequest):
    policy = active_price_policy("workflow", payload.templateId, payload.mode)
    base = float(policy["baseCoin"])
    quality_extra = float(policy["qualityExtraCoin"]) if payload.quality == "1080P" else 0
    duration_extra = float(policy["durationExtraCoin"]) if payload.durationSeconds == 8 else 0
    image_count_extra = max((payload.imageCount or 1) - 1, 0) * float(policy["imageExtraCoin"]) if payload.mode == "text_to_image" else 0
    return {
        "base": base,
        "qualityExtra": quality_extra,
        "durationExtra": duration_extra,
        "total": base + quality_extra + duration_extra + image_count_extra,
        "currency": "compute_coin",
        "policy": policy,
    }


def workflow_template_title(template_id: str, mode: str):
    for template in workflow_template_rows():
        if template["id"] == template_id:
            return template["title"]
    return "文生图生成" if mode == "text_to_image" else "文生视频生成" if mode == "text_to_video" else "图生视频生成"


def template_from_row(row):
    return {
        "id": row["template_id"],
        "title": row["title"],
        "mode": row["mode"],
        "category": row["category"],
        "cover": row["cover"],
        "summary": row["summary"],
        "priceText": row["price_text"],
        "runCount": row["run_count_text"],
        "tags": parse_tags(row.get("tags_json")),
    }


def workflow_template_rows():
    try:
        rows = db_rows(
            """
            SELECT template_id, title, mode, category, cover, summary, price_text, run_count_text, tags_json
            FROM cd_workflow_template
            WHERE status = 'online'
            ORDER BY sort_no, created_at
            """
        )
        if rows:
            templates = [template_from_row(row) for row in rows]
            for template in templates:
                template["priceText"] = active_price_policy("workflow", template["id"], template["mode"])["priceText"]
            return templates
    except Exception:
        pass
    templates = [{**template} for template in WORKFLOW_TEMPLATES]
    for template in templates:
        template["priceText"] = active_price_policy("workflow", template["id"], template["mode"])["priceText"]
    return templates


def find_workflow_template(template_id: str):
    for template in workflow_template_rows():
        if template["id"] == template_id:
            return template
    raise HTTPException(status_code=404, detail="workflow template not found")


def run_from_row(row):
    template = find_workflow_template(row["template_id"])
    return {
        "id": row["run_id"],
        "templateId": row["template_id"],
        "title": template["title"],
        "status": row["status"],
        "statusText": row["status_text"],
        "mode": row["mode"],
        "durationText": row["duration_text"],
        "costText": row["cost_text"],
        "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M") if row.get("created_at") else "",
        "prompt": row.get("prompt") or "",
        "ratio": row["ratio"],
        "quality": row["quality"],
        "seed": row.get("seed") or "random",
        "resultType": row["result_type"],
    }


def workflow_run_rows():
    try:
        rows = db_rows(
            """
            SELECT run_id, template_id, status, status_text, mode, duration_text, cost_text,
                   created_at, prompt, ratio, quality, seed, result_type
            FROM cd_workflow_run
            ORDER BY created_at DESC
            """
        )
        if rows:
            return [run_from_row(row) for row in rows]
    except Exception:
        pass
    return WORKFLOW_RUNS


def find_workflow_run(run_id: str):
    for run in workflow_run_rows():
        if run["id"] == run_id:
            return run
    raise HTTPException(status_code=404, detail="workflow run not found")


def workflow_owner_rows():
    try:
        rows = db_rows(
            """
            SELECT t.template_id, t.title AS template_title, t.mode, t.category, t.cover, t.summary,
                   t.price_text, t.run_count_text, t.tags_json,
                   u.title, u.status, u.version, u.visibility, u.monthly_revenue, u.audit_note
            FROM cd_user_workflow u
            JOIN cd_workflow_template t ON t.template_id = u.template_id
            WHERE u.sp_user_id = 0
            ORDER BY u.updated_at DESC
            """
        )
        if rows:
            return [
                {
                    "id": row["template_id"],
                    "title": row["title"] or row["template_title"],
                    "mode": row["mode"],
                    "category": row["category"],
                    "cover": row["cover"],
                    "summary": row["summary"],
                    "priceText": row["price_text"],
                    "runCount": row["run_count_text"],
                    "tags": parse_tags(row.get("tags_json")),
                    "status": row["status"],
                    "version": row["version"],
                    "visibility": row["visibility"],
                    "monthlyRevenue": float(row["monthly_revenue"] or 0),
                    "auditNote": row["audit_note"] or "",
                }
                for row in rows
            ]
    except Exception:
        pass
    states = ["已发布", "草稿", "审核中", "已发布", "已发布", "草稿"]
    versions = ["v1.8", "v0.3", "v1.1", "v2.0", "v1.4", "v0.8"]
    return [{**template, "status": states[index % len(states)], "version": versions[index % len(versions)], "visibility": "public" if states[index % len(states)] == "已发布" else "private", "monthlyRevenue": [426.8, 318.2, 168.4, 146.6, 172.0, 54.4][index % 6], "auditNote": "已上架" if states[index % len(states)] == "已发布" else "等待补充案例" if states[index % len(states)] == "审核中" else "仅自己可见"} for index, template in enumerate(workflow_template_rows())]


def workflow_versions(template_id: str):
    template = find_workflow_template(template_id)
    try:
        rows = db_rows(
            """
            SELECT version, status, note, created_at
            FROM cd_workflow_template_version
            WHERE template_id = %s
            ORDER BY created_at DESC, version DESC
            """,
            (template_id,),
        )
        if rows:
            return [
                {
                    "version": row["version"],
                    "status": row["status"],
                    "createdAt": row["created_at"].strftime("%Y-%m-%d %H:%M") if row.get("created_at") else "",
                    "note": row["note"] or "",
                }
                for row in rows
            ]
    except Exception:
        pass
    return [
        {
            "version": "v1.8",
            "status": "已发布",
            "createdAt": "2026-05-20 18:40",
            "note": f"{template['category']}模板新增 1080P 输出，优化失败退费逻辑",
        },
        {
            "version": "v1.7",
            "status": "历史版本",
            "createdAt": "2026-05-18 11:22",
            "note": "调整提示词 schema，兼容批量运行",
        },
        {
            "version": "v1.6",
            "status": "历史版本",
            "createdAt": "2026-05-12 15:09",
            "note": "首次公开发布",
        },
    ]


def workflow_cases(template_id: str):
    template = find_workflow_template(template_id)
    is_image = template["mode"] == "text_to_image"
    try:
        rows = db_rows(
            """
            SELECT case_id, template_id, title, summary, output_text, prompt, ratio, quality, published_at
            FROM cd_workflow_case
            WHERE template_id = %s AND status = '已发布'
            ORDER BY published_at DESC
            """,
            (template_id,),
        )
        if rows:
            return [
                {
                    "id": row["case_id"],
                    "templateId": row["template_id"],
                    "title": row["title"],
                    "summary": row["summary"],
                    "outputText": row["output_text"],
                    "prompt": row.get("prompt") or "",
                    "ratio": row["ratio"],
                    "quality": row["quality"],
                    "publishedAt": row["published_at"].strftime("%Y-%m-%d %H:%M") if row.get("published_at") else "",
                }
                for row in rows
            ]
    except Exception:
        pass
    published = [case for case in PUBLISHED_WORKFLOW_CASES if case["templateId"] == template_id]
    defaults = [
        {
            "id": f"CASE-{template_id}-1",
            "templateId": template_id,
            "title": "角色设定" if is_image else "人物回头",
            "summary": "统一人物风格，生成高质感封面和分镜图" if is_image else "柔光电影镜头，角色自然回头，背景虚化",
            "outputText": "4 张" if is_image else "00:06",
            "prompt": "电影感镜头，柔和光线，细节丰富",
            "ratio": "9:16",
            "quality": "1080P",
            "publishedAt": "2026-05-20 19:40",
        },
        {
            "id": f"CASE-{template_id}-2",
            "templateId": template_id,
            "title": "商品旋转" if template["category"] == "商品营销" else "城市夜景",
            "summary": "玻璃质感产品，慢速环绕，金色高光" if template["category"] == "商品营销" else "赛博城市街头，霓虹反射，推轨镜头",
            "outputText": "00:05" if template["category"] == "商品营销" else ("1 张" if is_image else "00:08"),
            "prompt": "商业质感，高级光影，构图稳定",
            "ratio": "1:1" if template["category"] == "商品营销" else "16:9",
            "quality": "1080P",
            "publishedAt": "2026-05-19 16:18",
        },
        {
            "id": f"CASE-{template_id}-3",
            "templateId": template_id,
            "title": "社媒素材",
            "summary": "适合发布到短视频和投放场景的成片结果",
            "outputText": "2 张" if is_image else "00:06",
            "prompt": "社媒封面，清晰主体，强记忆点",
            "ratio": "9:16",
            "quality": "720P",
            "publishedAt": "2026-05-18 10:26",
        },
    ]
    return published + defaults


def workflow_api_schema(template_id: str):
    template = find_workflow_template(template_id)
    is_image = template["mode"] == "text_to_image"
    return {
        "templateId": template["id"],
        "title": template["title"],
        "mode": template["mode"],
        "endpoint": "/api/workflows/runs",
        "method": "POST",
        "headers": {"Content-Type": "application/json"},
        "fields": [
            {"name": "templateId", "type": "string", "required": True, "default": template["id"]},
            {"name": "mode", "type": "string", "required": True, "default": template["mode"]},
            {"name": "prompt", "type": "string", "required": True},
            {"name": "negativePrompt", "type": "string", "required": False},
            {"name": "ratio", "type": "enum", "required": True, "options": ["9:16", "16:9", "1:1"]},
            {"name": "quality", "type": "enum", "required": True, "options": ["720P", "1080P"]},
            {"name": "imageCount" if is_image else "durationSeconds", "type": "number", "required": False, "options": [1, 2, 4] if is_image else [4, 6, 8]},
            {"name": "styleStrength", "type": "enum", "required": False, "options": ["low", "medium", "high"]},
            {"name": "seed", "type": "string", "required": False},
        ],
        "estimate": {"endpoint": "/api/workflows/estimate", "currency": "compute_coin"},
    }


@app.get("/api/health")
async def health():
    return ok({"service": "a9-compute-admin", "status": "ok"})


@app.get("/api/provider/autodl/status")
async def api_autodl_status():
    return ok(autodl_config_status())


@app.get("/api/provider/autodl/balance")
async def api_autodl_balance(_admin: str = Depends(require_admin_token)):
    try:
        return ok(AutoDLClient().get_balance())
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/images")
async def api_autodl_images(page_index: int = 1, page_size: int = 20, _admin: str = Depends(require_admin_token)):
    try:
        return ok(AutoDLClient().list_private_images(page_index=page_index, page_size=page_size))
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/image-candidates")
async def api_autodl_image_candidates(page_index: int = 1, page_size: int = 50, keyword: str = "", _admin: str = Depends(require_admin_token)):
    try:
        payload = AutoDLClient().list_private_images(page_index=page_index, page_size=page_size)
        data = payload.get("data") or {}
        rows = data.get("list") or []
        keyword = keyword.strip().lower()
        items = [
            {"imageUuid": row.get("image_uuid") or "", "imageName": row.get("image_name") or "", "providerId": row.get("id")}
            for row in rows
            if not keyword or keyword in (row.get("image_name") or "").lower()
        ]
        return ok({"items": items, "summary": {"total": data.get("result_total", len(items)), "current": len(items)}})
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/deployments")
async def api_autodl_deployments(page_index: int = 1, page_size: int = 20, _admin: str = Depends(require_admin_token)):
    try:
        return ok(AutoDLClient().list_deployments(page_index=page_index, page_size=page_size))
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/deployments/normalized")
async def api_autodl_deployments_normalized(page_index: int = 1, page_size: int = 20):
    try:
        payload = AutoDLClient().list_deployments(page_index=page_index, page_size=page_size)
        data = payload.get("data") or {}
        rows = data.get("list") or []
        items = [autodl_deployment_to_view(row) for row in rows]
        summary = {
            "total": data.get("result_total", len(items)),
            "running": sum(1 for item in items if item["rawStatus"] == "running"),
            "replicaNum": sum(item["replicaNum"] for item in items),
            "runningContainers": sum(item["runningNum"] for item in items),
        }
        return ok({"items": items, "summary": summary, "page": {"pageIndex": data.get("page_index", page_index), "pageSize": data.get("page_size", page_size), "maxPage": data.get("max_page", 1)}})
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/template-candidates")
async def api_autodl_template_candidates(page_index: int = 1, page_size: int = 20, _admin: str = Depends(require_admin_token)):
    try:
        payload = AutoDLClient().list_deployments(page_index=page_index, page_size=page_size)
        data = payload.get("data") or {}
        rows = data.get("list") or []
        items = []
        for row in rows:
            template = row.get("template") or {}
            items.append(
                {
                    "deploymentUuid": row.get("uuid") or "",
                    "deploymentName": row.get("name") or "",
                    "imageUuid": row.get("image_uuid") or template.get("image_uuid") or "",
                    "imageName": template.get("image_name") or "",
                    "gpuNameSet": template.get("gpu_name_set") or [],
                    "regionSignList": template.get("region_sign_list") or [],
                    "cmd": template.get("cmd") or "sleep infinity",
                    "servicePorts": ["6006", "6008"],
                    "status": row.get("status") or "",
                    "reuseContainer": bool(row.get("reuse_container")),
                }
            )
        return ok({"items": items, "summary": {"total": data.get("result_total", len(items)), "current": len(items)}})
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/containers")
async def api_autodl_containers(
    deployment_uuid: Optional[str] = None,
    container_uuid: Optional[str] = None,
    released: bool = False,
    page_index: int = 1,
    page_size: int = 20,
):
    try:
        return ok(
            AutoDLClient().list_containers(
                deployment_uuid=deployment_uuid,
                container_uuid=container_uuid,
                released=released,
                page_index=page_index,
                page_size=page_size,
            )
        )
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/containers/normalized")
async def api_autodl_containers_normalized(
    deployment_uuid: Optional[str] = None,
    container_uuid: Optional[str] = None,
    released: bool = False,
    page_index: int = 1,
    page_size: int = 20,
):
    try:
        payload = AutoDLClient().list_containers(
            deployment_uuid=deployment_uuid,
            container_uuid=container_uuid,
            released=released,
            page_index=page_index,
            page_size=page_size,
        )
        data = payload.get("data") or {}
        rows = data.get("list") or []
        items = [autodl_container_to_instance(row) for row in rows]
        summary = {
            "total": data.get("result_total", len(items)),
            "running": sum(1 for item in items if item["rawStatus"] == "running"),
            "starting": sum(1 for item in items if item["rawStatus"] == "starting"),
            "stopped": sum(1 for item in items if item["rawStatus"] in {"stopped", "finished"}),
        }
        return ok({"items": items, "summary": summary, "page": {"pageIndex": data.get("page_index", page_index), "pageSize": data.get("page_size", page_size), "maxPage": data.get("max_page", 1)}})
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/bindings")
async def api_provider_bindings(product_type: str = "", product_id: str = "", _admin: str = Depends(require_admin_token)):
    items = provider_binding_rows(product_type=product_type, product_id=product_id)
    enriched = []
    for item in items:
        policy = active_price_policy(item["productType"], item["productId"])
        enriched.append({**item, "validation": validate_provider_binding(item, policy)})
    return ok({"items": enriched})


@app.post("/api/provider/bindings")
async def api_save_provider_binding(payload: ProviderBindingRequest, _admin: str = Depends(require_admin_token)):
    if payload.provider != "autodl":
        return {"err_code": 400, "err_desc": "当前只支持 autodl provider", "data": None}
    if payload.productType not in {"market_app", "workflow"}:
        return {"err_code": 400, "err_desc": "productType must be market_app or workflow", "data": None}
    if not payload.productId:
        return {"err_code": 400, "err_desc": "productId is required", "data": None}
    if not payload.imageUuid:
        return {"err_code": 400, "err_desc": "imageUuid is required", "data": None}
    return ok(save_provider_binding(payload))


@app.post("/api/provider/bindings/{binding_id}/create-test-task")
async def api_create_binding_test_task(binding_id: int, _admin: str = Depends(require_admin_token)):
    binding = next((item for item in provider_binding_rows() if int(item["id"]) == binding_id), None)
    if not binding:
        return {"err_code": 404, "err_desc": "binding not found", "data": None}
    policy = active_price_policy(binding["productType"], binding["productId"])
    task = create_provision_task(
        binding["productType"],
        binding["productId"],
        f"TEST-{binding['productType']}-{binding['productId']}-{int(datetime.now(timezone.utc).timestamp())}",
        {"source": "admin_test_task", "gpuCount": 1},
        binding if binding["status"] == "active" else {},
        policy,
        status="queued" if binding["status"] == "active" and validate_provider_binding(binding, policy)["ready"] else "local",
    )
    return ok(task)


@app.delete("/api/provider/bindings/{binding_id}")
async def api_delete_provider_binding(binding_id: int, _admin: str = Depends(require_admin_token)):
    ensure_provider_binding_table()
    db_exec("DELETE FROM cd_provider_binding WHERE binding_id=%s", (binding_id,))
    return ok({"deleted": True, "id": binding_id})


@app.get("/api/admin/price-policies")
async def api_price_policies(product_type: str = "", product_id: str = "", _admin: str = Depends(require_admin_token)):
    return ok({"items": price_policy_rows(product_type=product_type, product_id=product_id)})


@app.post("/api/admin/price-policies")
async def api_save_price_policy(payload: PricePolicyRequest, _admin: str = Depends(require_admin_token)):
    if payload.productType not in {"workflow", "market_app"}:
        return {"err_code": 400, "err_desc": "productType must be workflow or market_app", "data": None}
    if not payload.productId:
        return {"err_code": 400, "err_desc": "productId is required", "data": None}
    if payload.baseCoin < 0 or payload.qualityExtraCoin < 0 or payload.durationExtraCoin < 0 or payload.imageExtraCoin < 0:
        return {"err_code": 400, "err_desc": "price coin must be positive", "data": None}
    return ok(save_price_policy(payload))


@app.delete("/api/admin/price-policies/{policy_id}")
async def api_delete_price_policy(policy_id: int, _admin: str = Depends(require_admin_token)):
    ensure_price_policy_table()
    db_exec("DELETE FROM cd_price_policy WHERE policy_id=%s", (policy_id,))
    return ok({"deleted": True, "id": policy_id})


@app.get("/api/admin/provision-tasks")
async def api_admin_provision_tasks(limit: int = 50, status: str = "", _admin: str = Depends(require_admin_token)):
    return ok({"items": provision_task_rows(limit=limit, status=status)})


@app.post("/api/admin/provision-tasks/execute-queued")
async def api_execute_queued_provision_tasks(limit: int = 20, real: bool = False, _admin: str = Depends(require_admin_token)):
    return ok(execute_queued_provision_tasks(limit=limit, force_real=real))


@app.post("/api/admin/provision-tasks/refresh-bindings")
async def api_refresh_provision_task_bindings(limit: int = 100, _admin: str = Depends(require_admin_token)):
    return ok(refresh_provision_task_bindings(limit=limit))


@app.post("/api/admin/provision-tasks/sync-submitted")
async def api_sync_submitted_provision_tasks(limit: int = 50, _admin: str = Depends(require_admin_token)):
    return ok(sync_submitted_provision_tasks(limit=limit))


@app.get("/api/admin/provision-tasks/{task_id}/preview")
async def api_preview_provision_task(task_id: int, _admin: str = Depends(require_admin_token)):
    preview = preview_provision_task(task_id)
    if not preview:
        return {"err_code": 404, "err_desc": "task not found", "data": None}
    return ok(preview)


@app.post("/api/admin/provision-tasks/{task_id}/execute")
async def api_execute_provision_task(task_id: int, real: bool = False, _admin: str = Depends(require_admin_token)):
    task = execute_provision_task(task_id, force_real=real)
    if not task:
        return {"err_code": 404, "err_desc": "task not found", "data": None}
    return ok(task)


@app.post("/api/admin/provision-tasks/{task_id}/sync")
async def api_sync_provision_task(task_id: int, _admin: str = Depends(require_admin_token)):
    task = sync_provision_task_status(task_id)
    if not task:
        return {"err_code": 404, "err_desc": "task not found", "data": None}
    return ok(task)


@app.post("/api/admin/provision-tasks/{task_id}/stop")
async def api_stop_provision_task(task_id: int, real: bool = False, _admin: str = Depends(require_admin_token)):
    task = stop_provision_task(task_id, force_real=real)
    if not task:
        return {"err_code": 404, "err_desc": "task not found", "data": None}
    return ok(task)


@app.get("/api/admin/provider/container-snapshot")
async def api_admin_provider_container_snapshot(_admin: str = Depends(require_admin_token)):
    return ok(provider_container_snapshot())


@app.get("/api/admin/provider/overview")
async def api_admin_provider_overview(_admin: str = Depends(require_admin_token)):
    status = autodl_config_status()
    bindings = provider_binding_rows()
    policies = price_policy_rows()
    tasks = provision_task_rows(limit=50)
    overview = {
        "provider": "autodl",
        "configured": status["configured"],
        "tokenSource": status["tokenSource"],
        "bindingTotal": len(bindings),
        "activeBindings": len([item for item in bindings if item["status"] == "active"]),
        "draftBindings": len([item for item in bindings if item["status"] == "draft"]),
        "pricePolicyTotal": len(policies),
        "activePricePolicies": len([item for item in policies if item["status"] == "active"]),
        "provisionTaskTotal": len(tasks),
        "queuedProvisionTasks": len([item for item in tasks if item["status"] == "queued"]),
        "dryRunProvisionTasks": len([item for item in tasks if item["status"] == "dry_run"]),
        "failedProvisionTasks": len([item for item in tasks if item["status"] == "failed"]),
        "deploymentTotal": 0,
        "imageTotal": 0,
        "runningDeployments": 0,
    }
    if status["configured"]:
        try:
            deployments = AutoDLClient().list_deployments(page_size=50).get("data") or {}
            overview["deploymentTotal"] = int(deployments.get("result_total") or 0)
            overview["runningDeployments"] = len([item for item in deployments.get("list", []) if item.get("status") == "running"])
        except AutoDLError:
            pass
        try:
            images = AutoDLClient().list_private_images(page_size=1).get("data") or {}
            overview["imageTotal"] = int(images.get("result_total") or 0)
        except AutoDLError:
            pass
    return ok(overview)


@app.get("/api/provider/autodl/gpu-stock")
async def api_autodl_gpu_stock(
    region_sign: str,
    cuda_v_from: Optional[int] = None,
    cuda_v_to: Optional[int] = None,
    gpu_name: Optional[str] = None,
    cached: bool = True,
):
    try:
        if cached and gpu_name:
            stock = cached_autodl_gpu_stock(region_sign, gpu_name)
            return ok(
                {
                    "regionSign": region_sign,
                    "regionName": autodl_region_name(region_sign),
                    "gpuName": gpu_name,
                    "stock": stock,
                    "cacheTtlSeconds": AUTODL_STOCK_CACHE_TTL_SECONDS,
                }
            )
        if cached and not gpu_name:
            items = cached_autodl_region_gpu_stock(region_sign)
            return ok(
                {
                    "regionSign": region_sign,
                    "regionName": autodl_region_name(region_sign),
                    "items": items,
                    "cacheTtlSeconds": AUTODL_STOCK_CACHE_TTL_SECONDS,
                }
            )
        gpu_name_set = [gpu_name] if gpu_name else None
        response = AutoDLClient().list_gpu_stock(region_sign=region_sign, cuda_v_from=cuda_v_from, cuda_v_to=cuda_v_to, gpu_name_set=gpu_name_set)
        if gpu_name:
            return ok({"regionSign": region_sign, "regionName": autodl_region_name(region_sign), "gpuName": gpu_name, "stock": parse_autodl_gpu_stock(response, gpu_name), "raw": response})
        return ok({"regionSign": region_sign, "regionName": autodl_region_name(region_sign), "items": parse_autodl_gpu_stock_list(response), "raw": response})
    except AutoDLError as exc:
        return provider_error(str(exc))


@app.get("/api/provider/autodl/base-tables")
async def api_autodl_base_tables():
    return ok(
        {
            "source": "https://www.autodl.com/docs/esd_api_doc/",
            "elasticRegions": AUTODL_ELASTIC_REGION_BASE,
            "proRegions": AUTODL_PRO_REGION_BASE,
            "publicImages": AUTODL_PUBLIC_IMAGE_BASE,
            "cudaVersions": AUTODL_CUDA_VERSION_BASE,
            "envKeys": [
                {"key": "AutoDLContainerUUID", "description": "容器的UUID"},
                {"key": "AutoDLDeploymentUUID", "description": "部署的UUID"},
                {"key": "AutoDLDataCenter", "description": "地区data_center"},
            ],
        }
    )


@app.get("/api/compute/autodl/console")
async def autodl_console(sync: bool = False, sp_user_id: int = Depends(current_sp_user_id)):
    wallet = wallet_summary(sp_user_id)
    resources = [
        {
            "id": "chongqing-4090-cuda118",
            "region": "重庆A区",
            "region_sign": "chongqingDC1",
            "machine": "重庆弹性池",
            "gpu_model": "RTX 4090",
            "gpu_memory_gb": 24,
            "available": 30,
            "total": 200,
            "cpu": "20 核",
            "memory_gb": 90,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 4096,
            "driver": "570.124.04",
            "cuda": "11.8-12.8",
            "provider_hourly_cost": 2.08,
            "provider_original_hourly_cost": 2.08,
            "discount_label": "",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": ["AutoDL弹性", "Miniconda"],
        },
        {
            "id": "pro-bj-b2-4090d",
            "region": "北京B区",
            "region_sign": "bj-B2",
            "machine": "Pro资源池",
            "gpu_model": "RTX 4090D",
            "gpu_memory_gb": 24,
            "available": 1,
            "total": 1,
            "cpu": "动态分配",
            "memory_gb": 60,
            "system_disk_gb": 30,
            "data_disk_gb": 0,
            "data_disk_expand_gb": 500,
            "driver": "AutoDL Pro",
            "cuda": "11.8",
            "provider_hourly_cost": 1.88,
            "provider_original_hourly_cost": 1.98,
            "discount_label": "",
            "provider": "容器实例Pro",
            "provider_mode": "autodl_pro",
            "tags": ["开发型算力", "关机保留"],
        },
        {
            "id": "80d0408bc2",
            "region": "重庆A区",
            "region_sign": "chongqingDC1",
            "machine": "027机",
            "gpu_model": "RTX 4090D",
            "gpu_memory_gb": 24,
            "available": 88,
            "total": 600,
            "cpu": "18 核 Xeon Platinum",
            "memory_gb": 80,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 4096,
            "driver": "570.86.15",
            "cuda": "≤ 12.8",
            "provider_hourly_cost": 1.98,
            "provider_original_hourly_cost": 2.08,
            "discount_label": "9.5折",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": ["弹性资源接口", "一键镜像"],
        },
        {
            "id": "d0f64f9549",
            "region": "西北B区",
            "machine": "213机",
            "gpu_model": "RTX 5090",
            "gpu_memory_gb": 32,
            "available": 1,
            "total": 8,
            "cpu": "25 核 Xeon Platinum 8470Q",
            "memory_gb": 90,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 1341,
            "driver": "595.58.03",
            "cuda": "≤ 13.2",
            "provider_hourly_cost": 2.78,
            "provider_original_hourly_cost": 2.93,
            "discount_label": "9.5折",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": ["缓存优化"],
        },
        {
            "id": "27e64f848e",
            "region": "西北B区",
            "machine": "965机",
            "gpu_model": "vGPU-32GB",
            "gpu_memory_gb": 32,
            "available": 1,
            "total": 8,
            "cpu": "16 核 Xeon Platinum 8375C",
            "memory_gb": 62,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 6735,
            "driver": "595.71.05",
            "cuda": "≤ 13.2",
            "provider_hourly_cost": 1.68,
            "provider_original_hourly_cost": 1.77,
            "discount_label": "9.5折",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": ["缓存优化"],
        },
        {
            "id": "6dd1448dae",
            "region": "西北B区",
            "machine": "931机",
            "gpu_model": "RTX PRO 6000",
            "gpu_memory_gb": 96,
            "available": 1,
            "total": 9,
            "cpu": "22 核 Xeon Platinum 8470Q",
            "memory_gb": 110,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 10,
            "driver": "580.82.09",
            "cuda": "≤ 13.0",
            "provider_hourly_cost": 5.98,
            "provider_original_hourly_cost": 7.97,
            "discount_label": "7.5折",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": [],
        },
        {
            "id": "a19d43b48e",
            "region": "西北B区",
            "machine": "C90机",
            "gpu_model": "RTX PRO 6000",
            "gpu_memory_gb": 96,
            "available": 1,
            "total": 9,
            "cpu": "22 核 Xeon Platinum 8470Q",
            "memory_gb": 110,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 6350,
            "driver": "580.95.05",
            "cuda": "≤ 13.0",
            "provider_hourly_cost": 5.98,
            "provider_original_hourly_cost": 7.97,
            "discount_label": "7.5折",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": ["缓存优化"],
        },
        {
            "id": "41d846924e",
            "region": "西北B区",
            "machine": "611机",
            "gpu_model": "vGPU-32GB",
            "gpu_memory_gb": 32,
            "available": 1,
            "total": 8,
            "cpu": "16 核 Xeon Platinum 8352V",
            "memory_gb": 62,
            "system_disk_gb": 30,
            "data_disk_gb": 50,
            "data_disk_expand_gb": 4411,
            "driver": "595.58.03",
            "cuda": "≤ 13.2",
            "provider_hourly_cost": 1.68,
            "provider_original_hourly_cost": 1.77,
            "discount_label": "9.5折",
            "provider": "弹性算力资源",
            "provider_mode": "autodl_elastic",
            "tags": [],
        },
    ]
    static_instances = [
        {
            "id": "1a4d48a0d9-a416943c",
            "name": "policynew",
            "region": "重庆A区",
            "machine": "150机",
            "status": "运行中",
            "gpu": "CPU * 1卡",
            "health": "正常",
            "billing": "包年包月",
            "release_time": "到期15天后释放 2026-07-05 18:12:33",
            "system_disk_usage": "76.40%",
            "data_disk_usage": "73.38%",
            "quick_tools": ["JupyterLab", "AutoPanel", "实例监控", "自定义服务"],
        },
        {
            "id": "7d794cbd77-09e61a2c",
            "name": "手串",
            "region": "重庆A区",
            "machine": "155机",
            "status": "运行中",
            "gpu": "CPU * 1卡",
            "health": "正常",
            "billing": "按量计费",
            "release_time": "关机15天后释放",
            "system_disk_usage": "56.18%",
            "data_disk_usage": "0.00%",
            "quick_tools": ["JupyterLab", "AutoPanel", "实例监控", "自定义服务"],
        },
        {
            "id": "80d0408bc2-26d0c9b7",
            "name": "数字人",
            "region": "重庆A区",
            "machine": "027机",
            "status": "运行中",
            "gpu": "RTX 4090D * 1卡",
            "health": "正常",
            "billing": "按量计费",
            "release_time": "关机15天后释放",
            "system_disk_usage": "24.50%",
            "data_disk_usage": "0.88%",
            "quick_tools": ["JupyterLab", "AutoPanel", "实例监控", "自定义服务"],
        },
    ]
    if sync:
        resources = apply_realtime_gpu_stock(resources)
    owned_instances = compute_instance_views(sp_user_id=sp_user_id, sync_live=sync)
    return ok(
        {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "provider": "弹性算力资源",
            "account_name": account_profile(sp_user_id).get("nickName") or account_profile(sp_user_id).get("userName") or "灵渠用户",
            "balance_cny": wallet["balanceCny"],
            "routes": ["provider_elastic_api", "a9_billing", "a9_image_templates"],
            "elasticRegions": AUTODL_ELASTIC_REGION_BASE,
            "resources": [apply_lingqu_pricing(item) for item in resources],
            "instances": owned_instances,
            "templates": [
                {
                    "id": "wan22",
                    "name": "Wan2.2 视频生成",
                    "description": "预装 CUDA / PyTorch / JupyterLab，启动后直接进入工作区。",
                    "image": "a9/wan2.2:cuda12-runtime",
                    "gpu_hint": "RTX 4090 24GB+",
                },
                {
                    "id": "ltx23",
                    "name": "LTX 2.3 生成工作流",
                    "description": "镜像内置依赖与模型目录约定，支持弹性实例一键拉起。",
                    "image": "a9/ltx2.3:cuda12-runtime",
                    "gpu_hint": "RTX 4090 / 5090",
                },
                {
                    "id": "comfyui",
                    "name": "ComfyUI WebUI",
                    "description": "面向应用视角的预装环境，由 A9 统一计费和入口治理。",
                    "image": "a9/comfyui:wan-ltx",
                    "gpu_hint": "单卡可用",
                },
            ],
        }
    )


@app.get("/api/wallet/summary")
async def api_wallet_summary():
    return ok(wallet_summary())


@app.get("/api/wallet/ledger")
async def api_wallet_ledger():
    return ok({"items": wallet_ledger_rows()})


@app.get("/api/wallet/orders")
async def api_wallet_orders():
    return ok({"items": wallet_order_rows()})


@app.get("/api/wallet/invoices")
async def api_wallet_invoices():
    return ok({"items": wallet_invoice_rows()})


@app.get("/api/wallet/coupons")
async def api_wallet_coupons():
    return ok({"items": wallet_coupon_rows()})


@app.get("/api/wallet/contracts")
async def api_wallet_contracts():
    return ok({"items": wallet_contract_rows()})


@app.get("/api/wallet/app-billing")
async def api_wallet_app_billing():
    wallet = wallet_summary()
    ledger = wallet_ledger_rows()
    detail = [
        {
            "billNo": f"BILL{item['id'].replace('LEDGER', '')}",
            "product": "工作流" if item["bizType"] == "workflow_run" else "应用实例" if item["bizType"] == "instance" else "存储服务" if item["bizType"] == "storage" else "钱包",
            "target": item["note"],
            "spec": "按次计费" if item["bizType"] == "workflow_run" else "余额服务",
            "usage": "1次" if item["bizType"] == "workflow_run" else "-",
            "amount": item["amountText"],
            "status": "已出账",
        }
        for item in ledger
        if item["bizType"] != "recharge"
    ]
    return ok(
        {
            "summary": wallet,
            "ledger": ledger,
            "orders": wallet_order_rows(),
            "detail": detail,
            "invoices": wallet_invoice_rows(),
            "coupons": wallet_coupon_rows(),
            "contracts": wallet_contract_rows(),
        }
    )


@app.post("/api/wallet/recharge")
async def api_wallet_recharge(payload: RechargeRequest):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")
    now = datetime.now(timezone.utc)
    order_id = f"ORDER{int(now.timestamp() * 1000)}"
    conn = get_connection()
    try:
        with conn.cursor(pymysql.cursors.DictCursor) as cursor:
            cursor.execute(
                """
                INSERT INTO cd_order (order_id, sp_user_id, order_type, status, amount_cny, pay_channel, note, paid_at)
                VALUES (%s,1,'recharge','paid',%s,%s,'余额充值',NOW())
                """,
                (order_id, payload.amount, payload.payChannel),
            )
        conn.commit()
    finally:
        conn.close()
    add_wallet_ledger(1, "recharge", order_id, payload.amount, 0, f"{payload.payChannel}充值")
    return ok({"orderNo": order_id, "status": "已支付", "summary": wallet_summary()})


@app.post("/api/wallet/invoices")
async def api_wallet_invoice(payload: InvoiceRequest):
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be positive")
    invoice_id = f"FP{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    db_exec(
        """
        INSERT INTO cd_invoice (invoice_id, sp_user_id, invoice_type, title, content, amount_cny, email, status)
        VALUES (%s,1,%s,%s,%s,%s,%s,'待开票')
        """,
        (invoice_id, payload.invoiceType, payload.title, payload.content, payload.amount, payload.email),
    )
    return ok({"invoiceNo": invoice_id, "status": "待开票", "invoices": wallet_invoice_rows()})


@app.post("/api/wallet/contracts")
async def api_wallet_contract(payload: ContractRequest):
    contract_id = f"HT{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    db_exec(
        """
        INSERT INTO cd_contract (contract_id, sp_user_id, contract_type, subject, amount_cny, status, email)
        VALUES (%s,1,%s,%s,%s,'待签署',%s)
        """,
        (contract_id, payload.contractType, payload.subject, payload.amount, payload.email),
    )
    return ok({"contractNo": contract_id, "status": "待签署", "contracts": wallet_contract_rows()})


@app.get("/api/account/profile")
async def api_account_profile():
    return ok(account_profile())


@app.get("/api/account/security")
async def api_account_security():
    return ok({"items": account_security_rows(), "profile": account_profile()})


@app.get("/api/account/access")
async def api_account_access():
    return ok({"items": account_access_rows()})


@app.get("/api/account/sub-accounts")
async def api_account_sub_accounts():
    return ok({"items": account_sub_rows()})


@app.post("/api/account/sub-accounts")
async def api_account_create_sub(payload: SubAccountRequest):
    db_exec(
        """
        INSERT INTO cd_sub_account (sp_user_id, account_name, role_name, permission_scope, status)
        VALUES (1,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE role_name=VALUES(role_name), permission_scope=VALUES(permission_scope), status=VALUES(status)
        """,
        (payload.accountName, payload.roleName, payload.permissionScope, payload.status),
    )
    return ok({"items": account_sub_rows()})


@app.get("/api/account/settings")
async def api_account_settings():
    return ok(account_setting())


@app.patch("/api/account/settings")
async def api_account_update_settings(payload: AccountSettingRequest):
    db_exec(
        """
        INSERT INTO cd_account_setting (sp_user_id, message_notify, default_region, release_reminder)
        VALUES (1,%s,%s,%s)
        ON DUPLICATE KEY UPDATE message_notify=VALUES(message_notify),
          default_region=VALUES(default_region), release_reminder=VALUES(release_reminder)
        """,
        (1 if payload.messageNotify else 0, payload.defaultRegion, 1 if payload.releaseReminder else 0),
    )
    return ok(account_setting())


@app.get("/api/apps/mine")
async def api_apps_mine(tab: str = "mine"):
    tab = tab if tab in {"mine", "favorites", "recent", "drafts"} else "mine"
    items = app_item_rows(tab)
    summary = {
        "mine": len(app_item_rows("mine")),
        "favorites": len(app_item_rows("favorites")),
        "recent": len(app_item_rows("recent")),
        "drafts": len(app_item_rows("drafts")),
    }
    return ok({"items": items, "summary": summary})


@app.get("/api/apps/market")
async def api_apps_market(section: str = "all", q: str = "", tag: str = ""):
    section = section if section in {"all", "weekly", "base"} else "all"
    items = app_market_rows(section=section, query=q.strip(), tag=tag.strip())
    summary = {
        "all": len(app_market_rows("all")),
        "weekly": len(app_market_rows("weekly")),
        "base": len(app_market_rows("base")),
    }
    return ok({"items": items, "summary": summary})


@app.post("/api/apps")
async def api_create_app(payload: AppCreateRequest):
    return ok(create_app_item(payload))


@app.patch("/api/apps/{app_id}")
async def api_update_app(app_id: str, payload: AppUpdateRequest):
    detail = update_app_item(app_id, payload)
    if not detail:
        return {"err_code": 404, "err_desc": "app not found", "data": None}
    return ok(detail)


@app.post("/api/apps/{app_id}/version")
async def api_publish_app_version(app_id: str, payload: AppVersionRequest):
    detail = publish_app_version(app_id, payload)
    if not detail:
        return {"err_code": 404, "err_desc": "app not found", "data": None}
    return ok(detail)


@app.get("/api/apps/{app_id}")
async def api_app_detail(app_id: str):
    detail = app_detail(app_id)
    if not detail:
        return {"err_code": 404, "err_desc": "app not found", "data": None}
    return ok(detail)


@app.get("/api/app-instances")
async def api_app_instances(status: str = "all", sp_user_id: int = Depends(current_sp_user_id)):
    status = status if status in {"all", "running", "pending", "stopped"} else "all"
    items = app_instance_rows(status, sp_user_id)
    summary = {
        "all": len(app_instance_rows("all", sp_user_id)),
        "running": len(app_instance_rows("running", sp_user_id)),
        "pending": len(app_instance_rows("pending", sp_user_id)),
        "stopped": len(app_instance_rows("stopped", sp_user_id)),
    }
    return ok({"items": items, "summary": summary})


@app.get("/api/app-instances/{instance_id}")
async def api_app_instance_detail(instance_id: str, sp_user_id: int = Depends(current_sp_user_id)):
    detail = app_instance_detail(instance_id, sp_user_id)
    if not detail:
        return {"err_code": 404, "err_desc": "instance not found", "data": None}
    return ok(detail)


@app.post("/api/app-instances")
async def api_create_app_instance(payload: AppInstanceCreateRequest, sp_user_id: int = Depends(current_sp_user_id)):
    ensure_app_instance_type_column()
    instance_type = "development" if payload.instanceType == "development" else "task"
    if payload.appId == "MINICONDA-CUDA118-4090-CQ":
        ensure_default_rent_app_item(sp_user_id)
    if payload.appId == "AUTODL-PRO-4090D-BJ":
        ensure_default_pro_app_item(sp_user_id)
    app = app_detail(payload.appId, sp_user_id)
    if not app:
        return {"err_code": 404, "err_desc": "app not found", "data": None}
    instance_id = f"ins-{payload.appId.lower().replace('app-', '').replace('_', '-')}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
    binding = active_provider_binding("market_app", payload.appId) if instance_type == "task" else None
    policy = active_price_policy("market_app", payload.appId)
    status, status_text = ("pending", "待调度") if binding or instance_type == "development" else (("running", "运行中") if payload.boot else ("pending", "未开机"))
    instance_name = payload.instanceName or f"{app['name']}-{datetime.now().strftime('%m%d%H%M')}"
    services, metrics, files, logs, bills, events = default_instance_assets(status, status_text, instance_id, payload.appId)
    if binding:
        ports = binding.get("servicePorts") or ["6006", "6008"]
        services = [[f"WebUI-{port}", str(port), "绑定服务", "待调度", "等待启动"] for port in ports] + [["SSH", "22", "远程终端", "待调度", "等待启动"]]
        logs = [
            f"[{datetime.now().strftime('%H:%M:%S')}] instance {instance_id} queued by provider binding",
            f"[{datetime.now().strftime('%H:%M:%S')}] provider autodl deployment {binding.get('deploymentUuid') or '-'}",
            f"[{datetime.now().strftime('%H:%M:%S')}] image {binding.get('imageName') or binding.get('imageUuid') or '-'}",
        ]
        events = [[datetime.now().strftime("%Y-%m-%d %H:%M:%S"), "创建调度任务", "灵渠调度", f"绑定 {binding.get('deploymentUuid') or binding.get('imageUuid')}", "queued"]]
    billing_mode = policy.get("billingMode") or binding.get("billingMode") if binding else payload.billingMode
    price_text = policy.get("priceText") or (binding.get("priceText") if binding else "") or ("￥-.--/时" if payload.billingMode == "按量计费" else "￥-.--/日")
    db_exec(
        """
        INSERT INTO cd_app_instance
        (instance_id, sp_user_id, app_id, instance_name, gpu_model, region, gpu_count, billing_mode, instance_type,
         status, status_text, price_text, system_disk_gb, data_disk_gb, month_runtime_text, current_cost_text,
         service_json, metric_json, file_json, log_json, bill_json, event_json)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,30,50,%s,%s,%s,%s,%s,%s,%s,%s)
        """,
        (
            instance_id, sp_user_id, payload.appId, instance_name, payload.gpuModel,
            payload.region, payload.gpuCount, billing_mode, instance_type,
            status, status_text, price_text,
            "0.2h" if status == "running" else "0h", "￥0.10",
            json.dumps(services, ensure_ascii=False), json.dumps(metrics, ensure_ascii=False), json.dumps(files, ensure_ascii=False),
            json.dumps(logs, ensure_ascii=False), json.dumps(bills, ensure_ascii=False), json.dumps(events, ensure_ascii=False),
        ),
    )
    detail = app_instance_detail(instance_id, sp_user_id)
    request_payload = payload.dict()
    request_payload["instanceType"] = instance_type
    task = create_provision_task("market_app", payload.appId, instance_id, request_payload, binding, policy, status="queued" if binding or instance_type == "development" else "local")
    if instance_type == "development" and task:
        try:
            pro_payload = {
                "data_center_list": AUTODL_PRO_DEFAULT_DATA_CENTER_LIST,
                "req_gpu_amount": max(1, int(payload.gpuCount or 1)),
                "expand_system_disk_by_gb": 0,
                "gpu_spec_uuid": AUTODL_PRO_DEFAULT_GPU_SPEC_UUID,
                "image_uuid": AUTODL_PRO_DEFAULT_IMAGE_UUID,
                "cuda_v_from": AUTODL_DEFAULT_CUDA_V_FROM,
                "instance_name": instance_name[:80],
                "start_command": "mkdir -p /root/lingqu-workspace && sleep infinity",
            }
            response = AutoDLClient().create_pro_instance(pro_payload)
            pro_uuid = response.get("data") or ""
            result = {"dryRun": False, "action": "create_pro_instance", "payload": pro_payload, "response": response, "providerProInstanceUuid": pro_uuid}
            db_exec("UPDATE cd_provision_task SET status='submitted', result_json=%s, err_msg='' WHERE task_id=%s", (json.dumps(result, ensure_ascii=False), task["id"]))
            db_exec("UPDATE cd_app_instance SET status='pending', status_text='Pro开机中' WHERE instance_id=%s", (instance_id,))
            task = provision_task_detail(int(task["id"]))
        except Exception as exc:
            result = {"dryRun": False, "action": "create_pro_instance", "error": str(exc)}
            db_exec("UPDATE cd_provision_task SET status='failed', result_json=%s, err_msg=%s WHERE task_id=%s", (json.dumps(result, ensure_ascii=False), str(exc)[:500], task["id"]))
            db_exec("UPDATE cd_app_instance SET status='failed', status_text='创建失败' WHERE instance_id=%s", (instance_id,))
            task = provision_task_detail(int(task["id"]))
    else:
        task = execute_provision_task(int(task["id"]), force_real=True) if task and binding and task.get("status") == "queued" else maybe_execute_created_task(task, binding)
    if task and task.get("status") in {"dry_run", "submitted", "starting", "running"}:
        mapped_status = "pending" if task["status"] in {"dry_run", "submitted", "starting"} else "running"
        mapped_text = "预检完成" if task["status"] == "dry_run" else "调度中" if task["status"] in {"submitted", "starting"} else "运行中"
        db_exec("UPDATE cd_app_instance SET status=%s, status_text=%s WHERE instance_id=%s", (mapped_status, mapped_text, instance_id))
        detail = app_instance_detail(instance_id, sp_user_id)
    if detail is not None:
        detail["provisionTask"] = task
        detail["providerBinding"] = binding
    return ok(detail)


@app.patch("/api/app-instances/{instance_id}/action")
async def api_app_instance_action(instance_id: str, payload: AppInstanceActionRequest, sp_user_id: int = Depends(current_sp_user_id)):
    result = update_instance_status(instance_id, payload.action, payload.instanceName, sp_user_id)
    if not result:
        return {"err_code": 404, "err_desc": "instance not found", "data": None}
    return ok(result)


@app.post("/api/app-instances/batch-action")
async def api_app_instance_batch_action(payload: AppInstanceBatchActionRequest, sp_user_id: int = Depends(current_sp_user_id)):
    action = payload.action if payload.action in {"boot", "stop", "restart"} else "boot"
    target_ids = payload.ids or [row["id"] for row in app_instance_rows("all", sp_user_id)]
    results = []
    for instance_id in target_ids:
        before = app_instance_detail(instance_id, sp_user_id)
        if not before:
            results.append({"id": instance_id, "status": "missing", "result": "实例不存在"})
            continue
        if action == "boot" and before["status"] == "running":
            results.append({"id": instance_id, "appName": before["appName"], "status": before["status"], "result": "已运行，跳过"})
            continue
        updated = update_instance_status(instance_id, action, sp_user_id=sp_user_id)
        results.append(
            {
                "id": instance_id,
                "appName": before["appName"],
                "status": updated.get("status") if isinstance(updated, dict) else before["status"],
                "result": "已执行",
            }
        )
    return ok({"items": results, "summary": {"total": len(results), "success": len([row for row in results if row["result"] == "已执行"]), "skipped": len([row for row in results if row["result"] != "已执行"])}})


@app.get("/api/models")
async def api_models(vendor: str = "", model_type: str = ""):
    items = model_rows(vendor.strip(), model_type.strip())
    return ok({"items": items, "summary": {"total": len(model_rows()), "current": len(items)}})


@app.get("/api/models/{model_id}")
async def api_model_detail(model_id: str):
    detail = model_detail(model_id)
    if not detail:
        return {"err_code": 404, "err_desc": "model not found", "data": None}
    return ok(detail)


@app.get("/api/images")
async def api_images():
    items = image_rows()
    hot = sorted(items, key=lambda row: row["favoriteCount"], reverse=True)[:5]
    return ok({"items": items, "hot": hot, "summary": {"total": len(items)}})


@app.get("/api/images/{image_id}")
async def api_image_detail(image_id: str):
    detail = image_detail(image_id)
    if not detail:
        return {"err_code": 404, "err_desc": "image not found", "data": None}
    return ok(detail)


@app.get("/api/model-admin/dashboard")
async def api_model_admin_dashboard():
    return ok(model_admin_dashboard())


@app.get("/api/model-admin/tokens")
async def api_model_admin_tokens(status: str = ""):
    status = status if status in {"启用", "停用"} else ""
    return ok({"items": api_token_rows(status=status), "summary": {"total": len(api_token_rows()), "active": len(api_token_rows(status="启用"))}})


@app.post("/api/model-admin/tokens")
async def api_model_admin_create_token(payload: ApiTokenCreateRequest):
    suffix = datetime.now().strftime("%H%M")
    db_exec(
        """
        INSERT INTO cd_api_token (sp_user_id, token_name, token_mask, permission_scope, status)
        VALUES (1,%s,%s,%s,'启用')
        ON DUPLICATE KEY UPDATE token_mask=VALUES(token_mask), permission_scope=VALUES(permission_scope), status='启用'
        """,
        (payload.tokenName, f"sk-****-{suffix}", payload.permissionScope),
    )
    return ok({"items": api_token_rows()})


@app.get("/api/model-admin/settings")
async def api_model_admin_settings():
    return ok(model_setting())


@app.patch("/api/model-admin/settings")
async def api_model_admin_update_settings(payload: ModelSettingRequest):
    db_exec(
        """
        INSERT INTO cd_model_setting
        (sp_user_id, default_model, daily_budget, concurrency_limit, callback_url, daily_report, auto_retry, ip_whitelist)
        VALUES (1,%s,%s,%s,%s,%s,%s,%s)
        ON DUPLICATE KEY UPDATE default_model=VALUES(default_model), daily_budget=VALUES(daily_budget),
          concurrency_limit=VALUES(concurrency_limit), callback_url=VALUES(callback_url),
          daily_report=VALUES(daily_report), auto_retry=VALUES(auto_retry), ip_whitelist=VALUES(ip_whitelist)
        """,
        (
            payload.defaultModel,
            payload.dailyBudget,
            payload.concurrencyLimit,
            payload.callbackUrl,
            1 if payload.dailyReport else 0,
            1 if payload.autoRetry else 0,
            1 if payload.ipWhitelist else 0,
        ),
    )
    return ok(model_setting())


@app.get("/api/messages")
async def api_messages(message_type: str = ""):
    message_type = message_type if message_type in {"system", "instance", "billing"} else ""
    items = message_rows(message_type)
    return ok({"items": items, "summary": {"total": len(message_rows()), "unread": len([row for row in message_rows() if row["readStatus"] == "未读"])}})


@app.post("/api/messages/read-all")
async def api_messages_read_all():
    db_exec("UPDATE cd_message SET read_status='已读' WHERE sp_user_id=1", ())
    return ok({"items": message_rows(), "summary": {"total": len(message_rows()), "unread": 0}})


@app.get("/api/docs")
async def api_docs():
    return ok({"items": help_doc_rows()})


@app.get("/api/docs/{doc_key}")
async def api_doc_detail(doc_key: str):
    detail = help_doc_detail(doc_key)
    if not detail:
        return {"err_code": 404, "err_desc": "doc not found", "data": None}
    return ok(detail)


@app.get("/api/public-data")
async def api_public_data():
    items = public_data_rows()
    return ok({"items": items, "summary": {"total": len(items)}})


@app.get("/api/public-data/{data_id}")
async def api_public_data_detail(data_id: str):
    detail = public_data_detail(data_id)
    if not detail:
        return {"err_code": 404, "err_desc": "public data not found", "data": None}
    return ok(detail)


@app.get("/api/shared-data")
async def api_shared_data():
    items = shared_data_rows()
    return ok({"items": items, "summary": {"total": len(items)}})


@app.get("/api/workflows/templates")
async def workflow_templates():
    return ok({"items": workflow_template_rows()})


@app.get("/api/workflows/templates/{template_id}")
async def workflow_template_detail(template_id: str):
    template = find_workflow_template(template_id)
    related = [item for item in workflow_template_rows() if item["id"] != template_id][:3]
    return ok({"item": template, "related": related})


@app.get("/api/workflows/templates/{template_id}/cases")
async def workflow_template_cases(template_id: str):
    return ok({"items": workflow_cases(template_id)})


@app.get("/api/workflows/templates/{template_id}/api-schema")
async def workflow_template_api_schema(template_id: str):
    return ok(workflow_api_schema(template_id))


@app.get("/api/workflows/mine")
async def workflow_mine():
    rows = workflow_owner_rows()
    return ok(
        {
            "items": rows,
            "summary": {
                "revenue": round(sum(item["monthlyRevenue"] for item in rows), 2),
                "published": len([item for item in rows if item["status"] == "已发布"]),
                "drafts": len([item for item in rows if item["status"] == "草稿"]),
                "auditing": len([item for item in rows if item["status"] == "审核中"]),
                "rating": 4.8,
            },
        }
    )


@app.post("/api/workflows/mine")
async def create_workflow_template(payload: WorkflowCreateRequest):
    source = find_workflow_template(payload.templateId)
    created = {
        **source,
        "id": f"custom-{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "title": payload.title,
        "category": payload.category,
        "status": "草稿" if payload.visibility == "private" else "审核中",
        "version": "v0.1",
        "visibility": payload.visibility,
        "monthlyRevenue": 0,
        "auditNote": "新建草稿" if payload.visibility == "private" else "等待审核",
        "source": payload.source,
    }
    try:
        db_exec(
            """
            INSERT INTO cd_workflow_template
            (template_id, title, mode, category, cover, summary, price_coin, price_text, run_count_text, tags_json, status, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,0,%s,%s,%s,'online',99)
            ON DUPLICATE KEY UPDATE title=VALUES(title), category=VALUES(category), summary=VALUES(summary)
            """,
            (
                created["id"],
                created["title"],
                created["mode"],
                created["category"],
                created["cover"],
                created["summary"],
                created["priceText"],
                created["runCount"],
                json.dumps(created["tags"], ensure_ascii=False),
            ),
        )
        db_exec(
            """
            INSERT INTO cd_user_workflow
            (sp_user_id, template_id, title, status, version, visibility, monthly_revenue, audit_note)
            VALUES (0,%s,%s,%s,'v0.1',%s,0,%s)
            ON DUPLICATE KEY UPDATE title=VALUES(title), status=VALUES(status), visibility=VALUES(visibility), audit_note=VALUES(audit_note)
            """,
            (created["id"], created["title"], created["status"], created["visibility"], created["auditNote"]),
        )
    except Exception:
        pass
    return ok(created)


@app.patch("/api/workflows/mine/{template_id}/status")
async def update_workflow_status(template_id: str, payload: WorkflowStatusRequest):
    source = find_workflow_template(template_id) if not template_id.startswith("custom-") else workflow_template_rows()[0]
    visibility = "public" if payload.status == "已发布" else "private"
    audit_note = "已上架" if payload.status == "已发布" else "等待审核" if payload.status == "审核中" else "仅自己可见"
    try:
        db_exec(
            """
            UPDATE cd_user_workflow
            SET status=%s, visibility=%s, monthly_revenue=%s, audit_note=%s
            WHERE sp_user_id=0 AND template_id=%s
            """,
            (payload.status, visibility, 128.6 if payload.status == "已发布" else 0, audit_note, template_id),
        )
    except Exception:
        pass
    return ok(
        {
            **source,
            "id": template_id,
            "status": payload.status,
            "version": "v1.8" if payload.status == "已发布" else "v0.1",
            "visibility": visibility,
            "monthlyRevenue": 0 if payload.status != "已发布" else 128.6,
            "auditNote": audit_note,
        }
    )


@app.get("/api/workflows/mine/{template_id}/versions")
async def workflow_template_versions(template_id: str):
    return ok({"items": workflow_versions(template_id)})


@app.post("/api/workflows/mine/share")
async def create_workflow_share(payload: WorkflowShareRequest):
    template = find_workflow_template(payload.templateId)
    token = f"wf-{template['id']}-{int(datetime.now(timezone.utc).timestamp())}"
    try:
        db_exec(
            """
            INSERT INTO cd_workflow_share (template_id, sp_user_id, share_token, permission, expires_at, visits)
            VALUES (%s,0,%s,%s,DATE_ADD(NOW(), INTERVAL %s DAY),328)
            """,
            (template["id"], token, payload.permission, payload.expiresInDays),
        )
    except Exception:
        pass
    return ok(
        {
            "templateId": template["id"],
            "title": template["title"],
            "permission": payload.permission,
            "expiresInDays": payload.expiresInDays,
            "url": f"https://yaochuang.tech/compute/workflows/{template['id']}?share={token}",
            "visits": 328,
            "conversion": "18.6%",
        }
    )


@app.get("/api/workflows/runs")
async def workflow_runs():
    return ok({"items": workflow_run_rows()})


@app.get("/api/workflows/runs/export")
async def export_workflow_runs():
    return ok(
        {
            "filename": f"workflow-runs-{datetime.now(timezone.utc).strftime('%Y%m%d')}.json",
            "items": workflow_run_rows(),
        }
    )


@app.post("/api/workflows/runs/delete")
async def delete_workflow_runs(payload: WorkflowDeleteRunsRequest):
    ids = set(payload.ids)
    before = len(workflow_run_rows())
    try:
        conn = get_connection()
        try:
            with conn.cursor() as cursor:
                cursor.executemany("DELETE FROM cd_workflow_run WHERE run_id=%s", [(item,) for item in ids])
            conn.commit()
        finally:
            conn.close()
    except Exception:
        WORKFLOW_RUNS[:] = [run for run in WORKFLOW_RUNS if run["id"] not in ids]
        save_workflow_runs()
    items = workflow_run_rows()
    return ok({"deleted": max(before - len(items), 0), "items": items})


@app.post("/api/workflows/publish")
async def publish_workflow_result(payload: WorkflowPublishRequest):
    template = find_workflow_template(payload.templateId)
    published_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    publish_id = f"PUB-{int(datetime.now(timezone.utc).timestamp() * 1000)}"
    published = {
        "id": publish_id,
        "runId": payload.runId,
        "templateId": template["id"],
        "templateTitle": template["title"],
        "title": payload.title,
        "destination": payload.destination,
        "cover": payload.cover,
        "tags": payload.tags,
        "prompt": payload.prompt,
        "ratio": payload.ratio,
        "quality": payload.quality,
        "status": "已发布",
        "publishedAt": published_at,
        "url": f"https://yaochuang.tech/compute/workflows/{template['id']}#case-{publish_id}",
    }
    PUBLISHED_WORKFLOW_CASES.insert(
        0,
        {
            "id": publish_id,
            "templateId": template["id"],
            "title": payload.title,
            "summary": payload.prompt or template["summary"],
            "outputText": "4 张" if template["mode"] == "text_to_image" else "00:06",
            "prompt": payload.prompt,
            "ratio": payload.ratio,
            "quality": payload.quality,
            "publishedAt": published_at,
        },
    )
    save_workflow_cases()
    try:
        db_exec(
            """
            INSERT INTO cd_workflow_case
            (case_id, run_id, template_id, sp_user_id, title, summary, output_text, prompt, ratio, quality, status, published_at)
            VALUES (%s,%s,%s,0,%s,%s,%s,%s,%s,%s,'已发布',NOW())
            ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), output_text=VALUES(output_text)
            """,
            (
                publish_id,
                payload.runId,
                template["id"],
                payload.title,
                payload.prompt or template["summary"],
                "4 张" if template["mode"] == "text_to_image" else "00:06",
                payload.prompt,
                payload.ratio,
                payload.quality,
            ),
        )
    except Exception:
        pass
    return ok(published)


@app.get("/api/workflows/runs/{run_id}")
async def workflow_run_detail(run_id: str):
    return ok({"item": find_workflow_run(run_id)})


@app.post("/api/workflows/estimate")
async def workflow_estimate(payload: WorkflowRunRequest):
    return ok(estimate_workflow_cost(payload))


@app.post("/api/workflows/runs")
async def create_workflow_run(payload: WorkflowRunRequest):
    estimate = estimate_workflow_cost(payload)
    binding = active_provider_binding("workflow", payload.templateId)
    policy = estimate.get("policy") or active_price_policy("workflow", payload.templateId, payload.mode)
    now = datetime.now(timezone.utc)
    run = {
        "id": f"WF-{int(now.timestamp() * 1000)}",
        "templateId": payload.templateId,
        "title": workflow_template_title(payload.templateId, payload.mode),
        "status": "queued",
        "statusText": "等待弹性调度" if binding else "排队中",
        "mode": payload.mode,
        "durationText": "-",
        "costText": f"{estimate['total']}算力币",
        "createdAt": now.strftime("%Y-%m-%d %H:%M"),
        "prompt": payload.prompt,
        "ratio": payload.ratio,
        "quality": payload.quality,
        "seed": payload.seed or "random",
        "resultType": "image" if payload.mode == "text_to_image" else "video",
    }
    WORKFLOW_RUNS.insert(0, run)
    save_workflow_runs()
    try:
        db_exec(
            """
            INSERT INTO cd_workflow_run
            (run_id, sp_user_id, template_id, status, status_text, mode, duration_text, cost_coin, cost_text,
             prompt, negative_prompt, ratio, quality, seed, result_type, params_json, created_at)
            VALUES (%s,0,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,NOW())
            """,
            (
                run["id"],
                run["templateId"],
                run["status"],
                run["statusText"],
                run["mode"],
                run["durationText"],
                estimate["total"],
                run["costText"],
                payload.prompt,
                payload.negativePrompt,
                payload.ratio,
                payload.quality,
                run["seed"],
                run["resultType"],
                json.dumps({**payload.dict(), "providerBinding": binding, "pricePolicy": policy}, ensure_ascii=False),
            ),
        )
        add_wallet_ledger(1, "workflow_run", run["id"], 0, -float(estimate["total"]), run["title"])
    except Exception:
        pass
    try:
        task = create_provision_task(
            "workflow",
            payload.templateId,
            run["id"],
            payload.dict(),
            binding,
            policy,
            status="queued" if binding else "local",
        )
        task = maybe_execute_created_task(task, binding)
        if task and task.get("status") in {"dry_run", "submitted", "starting", "running"}:
            status_text = "预检完成" if task["status"] == "dry_run" else "调度中" if task["status"] in {"submitted", "starting"} else "运行中"
            db_exec(
                "UPDATE cd_workflow_run SET status=%s, status_text=%s WHERE run_id=%s",
                (task["status"], status_text, run["id"]),
            )
            run["status"] = task["status"]
            run["statusText"] = status_text
        run["provisionTask"] = task
        run["providerBinding"] = binding
    except Exception:
        run["providerBinding"] = binding
    return ok(run)


if FRONTEND_DIST.exists():
    app.mount("/compute/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="compute-assets")
    fonts_dir = FRONTEND_DIST / "fonts"
    if fonts_dir.exists():
        app.mount("/compute/fonts", StaticFiles(directory=fonts_dir), name="compute-fonts")


@app.get("/")
async def root():
    return RedirectResponse(url="/compute")


@app.get("/compute")
async def compute_page():
    index_file = FRONTEND_DIST / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    return {"err_code": 1, "error": "frontend not built. run: cd frontend && npm install && npm run build"}


@app.get("/compute/")
async def compute_page_slash():
    return await compute_page()


@app.get("/compute/{path:path}")
async def compute_page_path(path: str):
    return await compute_page()


if __name__ == "__main__":
    uvicorn.run(
        app="api:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "6111")),
        workers=1,
        reload=False,
    )
