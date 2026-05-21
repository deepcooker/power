import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import uvicorn
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles


ROOT = Path(__file__).resolve().parent
FRONTEND_DIST = ROOT / "a9_compute_admin" / "dist"
WORKFLOW_RUNS_FILE = Path(os.getenv("WORKFLOW_RUNS_FILE", str(ROOT / "runtime_data" / "workflow_runs.json")))

app = FastAPI(title="A9 Compute Admin API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def ok(data):
    return {"err_code": 0, "data": data}


WORKFLOW_TEMPLATES = [
    {
        "id": "ltx-video",
        "title": "LTX2.3 图生视频",
        "mode": "image_to_video",
        "category": "图生视频",
        "cover": "workflow-ltx-video",
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
        "cover": "workflow-wan-video",
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
        "cover": "workflow-product-video",
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
        "cover": "workflow-avatar",
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
        "cover": "workflow-cyber-style",
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
        "cover": "workflow-comic-storyboard",
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


WORKFLOW_RUNS = load_workflow_runs()


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


def estimate_workflow_cost(payload: WorkflowRunRequest):
    base = 5 if payload.mode == "text_to_image" else 18 if payload.mode == "text_to_video" else 12
    quality_extra = 4 if payload.quality == "1080P" else 0
    duration_extra = 6 if payload.durationSeconds == 8 else 0
    image_count_extra = max((payload.imageCount or 1) - 1, 0) * 2 if payload.mode == "text_to_image" else 0
    return {
        "base": base,
        "qualityExtra": quality_extra,
        "durationExtra": duration_extra,
        "total": base + quality_extra + duration_extra + image_count_extra,
        "currency": "compute_coin",
    }


def workflow_template_title(template_id: str, mode: str):
    for template in WORKFLOW_TEMPLATES:
        if template["id"] == template_id:
            return template["title"]
    return "文生图生成" if mode == "text_to_image" else "文生视频生成" if mode == "text_to_video" else "图生视频生成"


@app.get("/api/health")
async def health():
    return ok({"service": "a9-compute-admin", "status": "ok"})


@app.get("/api/compute/autodl/console")
async def autodl_console():
    return ok(
        {
            "generated_at_utc": datetime.now(timezone.utc).isoformat(),
            "provider": "合作商弹性算力",
            "account_name": "deepcooker",
            "balance_cny": 1303.96,
            "routes": ["provider_elastic_api", "a9_billing", "a9_image_templates"],
            "resources": [
                {
                    "id": "80d0408bc2",
                    "region": "重庆A区",
                    "machine": "027机",
                    "gpu_model": "RTX 4090D",
                    "gpu_memory_gb": 24,
                    "available": 1,
                    "total": 8,
                    "cpu": "18 核 Xeon Platinum",
                    "memory_gb": 80,
                    "system_disk_gb": 30,
                    "data_disk_gb": 50,
                    "data_disk_expand_gb": 4096,
                    "driver": "570.86.15",
                    "cuda": "≤ 12.8",
                    "hourly_price": 1.98,
                    "original_hourly_price": 2.08,
                    "discount_label": "9.5折",
                    "provider": "合作商弹性算力",
                    "provider_mode": "autodl_elastic",
                    "tags": ["合作商弹性接口", "一键镜像"],
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
                    "hourly_price": 2.78,
                    "original_hourly_price": 2.93,
                    "discount_label": "9.5折",
                    "provider": "合作商弹性算力",
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
                    "hourly_price": 1.68,
                    "original_hourly_price": 1.77,
                    "discount_label": "9.5折",
                    "provider": "合作商弹性算力",
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
                    "hourly_price": 5.98,
                    "original_hourly_price": 7.97,
                    "discount_label": "7.5折",
                    "provider": "合作商弹性算力",
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
                    "hourly_price": 5.98,
                    "original_hourly_price": 7.97,
                    "discount_label": "7.5折",
                    "provider": "合作商弹性算力",
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
                    "hourly_price": 1.68,
                    "original_hourly_price": 1.77,
                    "discount_label": "9.5折",
                    "provider": "合作商弹性算力",
                    "provider_mode": "autodl_elastic",
                    "tags": [],
                },
            ],
            "instances": [
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
            ],
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


@app.get("/api/workflows/templates")
async def workflow_templates():
    return ok({"items": WORKFLOW_TEMPLATES})


@app.get("/api/workflows/runs")
async def workflow_runs():
    return ok({"items": WORKFLOW_RUNS})


@app.post("/api/workflows/estimate")
async def workflow_estimate(payload: WorkflowRunRequest):
    return ok(estimate_workflow_cost(payload))


@app.post("/api/workflows/runs")
async def create_workflow_run(payload: WorkflowRunRequest):
    estimate = estimate_workflow_cost(payload)
    now = datetime.now(timezone.utc)
    run = {
        "id": f"WF-{int(now.timestamp() * 1000)}",
        "templateId": payload.templateId,
        "title": workflow_template_title(payload.templateId, payload.mode),
        "status": "queued",
        "statusText": "排队中",
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
    return ok(run)


if FRONTEND_DIST.exists():
    app.mount("/compute/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="compute-assets")


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
