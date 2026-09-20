from datetime import datetime
from pathlib import Path
import json
import sys


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from mysqldbpoolnew import get_connection
from api import DEFAULT_WORKFLOW_RUNS, WORKFLOW_TEMPLATES, workflow_cases


SQL_FILE = ROOT / "sql" / "app_tables.sql"


def split_sql(sql_text: str):
    current = []
    for line in sql_text.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("--"):
            continue
        current.append(line)
        if stripped.endswith(";"):
            yield "\n".join(current).rstrip(";")
            current = []
    if current:
        yield "\n".join(current)


def price_coin(price_text: str):
    digits = "".join(ch for ch in price_text if ch.isdigit() or ch == ".")
    return float(digits or 0)


def seed_templates(cursor):
    for sort_no, item in enumerate(WORKFLOW_TEMPLATES, start=1):
        cursor.execute(
            """
            INSERT INTO cd_workflow_template
            (template_id, title, mode, category, cover, summary, price_coin, price_text, run_count_text, tags_json, status, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'online',%s)
            ON DUPLICATE KEY UPDATE
              title=VALUES(title), mode=VALUES(mode), category=VALUES(category), cover=VALUES(cover),
              summary=VALUES(summary), price_coin=VALUES(price_coin), price_text=VALUES(price_text),
              run_count_text=VALUES(run_count_text), tags_json=VALUES(tags_json), status='online', sort_no=VALUES(sort_no)
            """,
            (
                item["id"],
                item["title"],
                item["mode"],
                item["category"],
                item["cover"],
                item["summary"],
                price_coin(item["priceText"]),
                item["priceText"],
                item["runCount"],
                json.dumps(item["tags"], ensure_ascii=False),
                sort_no,
            ),
        )


def seed_user_workflows(cursor):
    states = ["已发布", "草稿", "审核中", "已发布", "已发布", "草稿"]
    versions = ["v1.8", "v0.3", "v1.1", "v2.0", "v1.4", "v0.8"]
    revenues = [426.8, 318.2, 168.4, 146.6, 172.0, 54.4]
    for index, item in enumerate(WORKFLOW_TEMPLATES):
        status = states[index % len(states)]
        cursor.execute(
            """
            INSERT INTO cd_user_workflow
            (sp_user_id, template_id, title, status, version, visibility, monthly_revenue, audit_note)
            VALUES (0,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE
              title=VALUES(title), status=VALUES(status), version=VALUES(version), visibility=VALUES(visibility),
              monthly_revenue=VALUES(monthly_revenue), audit_note=VALUES(audit_note)
            """,
            (
                item["id"],
                item["title"],
                status,
                versions[index % len(versions)],
                "public" if status == "已发布" else "private",
                revenues[index % len(revenues)],
                "已上架" if status == "已发布" else "等待补充案例" if status == "审核中" else "仅自己可见",
            ),
        )


def seed_versions(cursor):
    for item in WORKFLOW_TEMPLATES:
        rows = [
            ("v1.8", "已发布", f"{item['category']}模板新增 1080P 输出，优化失败退费逻辑"),
            ("v1.7", "历史版本", "调整提示词 schema，兼容批量运行"),
            ("v1.6", "历史版本", "首次公开发布"),
        ]
        for version, status, note in rows:
            cursor.execute(
                """
                INSERT INTO cd_workflow_template_version (template_id, version, status, note, created_at)
                VALUES (%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE status=VALUES(status), note=VALUES(note)
                """,
                (item["id"], version, status, note, datetime.now()),
            )


def seed_runs(cursor):
    for item in DEFAULT_WORKFLOW_RUNS:
        cursor.execute(
            """
            INSERT INTO cd_workflow_run
            (run_id, sp_user_id, template_id, status, status_text, mode, duration_text, cost_coin, cost_text,
             prompt, ratio, quality, seed, result_type, params_json, created_at)
            VALUES (%s,0,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE status=VALUES(status), status_text=VALUES(status_text), cost_text=VALUES(cost_text)
            """,
            (
                item["id"],
                item["templateId"],
                item["status"],
                item["statusText"],
                item["mode"],
                item["durationText"],
                price_coin(item["costText"]),
                item["costText"],
                item["prompt"],
                item["ratio"],
                item["quality"],
                item["seed"],
                item["resultType"],
                json.dumps({}, ensure_ascii=False),
                datetime.strptime(item["createdAt"], "%Y-%m-%d %H:%M"),
            ),
        )


def seed_cases(cursor):
    for template in WORKFLOW_TEMPLATES:
        for case in workflow_cases(template["id"]):
            cursor.execute(
                """
                INSERT INTO cd_workflow_case
                (case_id, template_id, sp_user_id, title, summary, output_text, prompt, ratio, quality, status, published_at)
                VALUES (%s,%s,0,%s,%s,%s,%s,%s,%s,'已发布',%s)
                ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), output_text=VALUES(output_text)
                """,
                (
                    case["id"],
                    case["templateId"],
                    case["title"],
                    case["summary"],
                    case["outputText"],
                    case["prompt"],
                    case["ratio"],
                    case["quality"],
                    datetime.strptime(case["publishedAt"], "%Y-%m-%d %H:%M"),
                ),
            )


def seed_wallet(cursor):
    cursor.execute(
        """
        INSERT INTO cd_wallet_account (sp_user_id, balance_cny, frozen_cny, compute_coin)
        VALUES (1, 1303.96, 0.00, 886.00)
        ON DUPLICATE KEY UPDATE balance_cny=VALUES(balance_cny), frozen_cny=VALUES(frozen_cny), compute_coin=VALUES(compute_coin)
        """
    )
    rows = [
        ("recharge", "ORDER202605200001", 500.00, 0, 1303.96, "微信支付充值"),
        ("workflow_run", "WF-240518", 0, -12.00, 803.96, "LTX2.3 图生视频"),
        ("instance", "ins-art-zimage-20260518", -18.42, 0, 815.96, "Zimage-Wan-Ltx2.3-训练器"),
        ("storage", "image-ef24180470", -3.20, 0, 834.38, "系统盘扩容"),
    ]
    for biz_type, biz_id, amount_cny, amount_coin, balance_after, note in rows:
        cursor.execute(
            """
            INSERT INTO cd_wallet_ledger
            (sp_user_id, biz_type, biz_id, amount_cny, amount_coin, balance_after_cny, note)
            SELECT 1,%s,%s,%s,%s,%s,%s
            WHERE NOT EXISTS (
              SELECT 1 FROM cd_wallet_ledger WHERE sp_user_id=1 AND biz_type=%s AND biz_id=%s
            )
            """,
            (biz_type, biz_id, amount_cny, amount_coin, balance_after, note, biz_type, biz_id),
        )


def seed_orders(cursor):
    cursor.execute(
        """
        INSERT INTO cd_order (order_id, sp_user_id, order_type, status, amount_cny, pay_channel, note, paid_at)
        VALUES ('ORDER202605200001',1,'recharge','paid',500.00,'微信支付','余额充值',NOW())
        ON DUPLICATE KEY UPDATE status=VALUES(status), amount_cny=VALUES(amount_cny), pay_channel=VALUES(pay_channel)
        """
    )
    cursor.execute(
        """
        INSERT INTO cd_invoice (invoice_id, sp_user_id, invoice_type, title, content, amount_cny, email, status)
        VALUES ('FP202605180001',1,'个人普通发票','灵渠用户','算力服务费',500.00,'finance@example.com','待开票')
        ON DUPLICATE KEY UPDATE amount_cny=VALUES(amount_cny), status=VALUES(status)
        """
    )


def seed_coupons_contracts(cursor):
    coupons = [
        ("CP202605200001", "新用户算力券", "满100减20", "容器实例/弹性部署", "2026-06-30", "可用"),
        ("CP202605200002", "镜像存储抵扣券", "存储费用8折", "我的镜像", "2026-07-31", "可用"),
    ]
    for coupon_id, name, discount, scope, valid_until, status in coupons:
        cursor.execute(
            """
            INSERT INTO cd_coupon (coupon_id, sp_user_id, coupon_name, discount_text, scope_text, valid_until, status)
            VALUES (%s,1,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE coupon_name=VALUES(coupon_name), discount_text=VALUES(discount_text),
              scope_text=VALUES(scope_text), valid_until=VALUES(valid_until), status=VALUES(status)
            """,
            (coupon_id, name, discount, scope, valid_until, status),
        )
    contracts = [
        ("HT202605200001", "算力服务合同", "耀创科技", 500.00, "待签署", "finance@yaochuang.tech"),
        ("HT202604160002", "框架服务合同", "耀创科技", 0.00, "已归档", "finance@yaochuang.tech"),
    ]
    for contract_id, contract_type, subject, amount, status, email in contracts:
        cursor.execute(
            """
            INSERT INTO cd_contract (contract_id, sp_user_id, contract_type, subject, amount_cny, status, email)
            VALUES (%s,1,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE contract_type=VALUES(contract_type), subject=VALUES(subject),
              amount_cny=VALUES(amount_cny), status=VALUES(status), email=VALUES(email)
            """,
            (contract_id, contract_type, subject, amount, status, email),
        )


def seed_account_rows(cursor):
    logs = [
        ("47.103.49.82", "上海", "密码登录", "成功"),
        ("101.88.23.12", "上海", "微信扫码", "成功"),
    ]
    for login_ip, region, method, status in logs:
        cursor.execute(
            """
            INSERT INTO cd_access_log (sp_user_id, login_ip, login_region, login_method, status)
            SELECT 1,%s,%s,%s,%s
            WHERE NOT EXISTS (
              SELECT 1 FROM cd_access_log WHERE sp_user_id=1 AND login_ip=%s AND login_method=%s
            )
            """,
            (login_ip, region, method, status, login_ip, method),
        )
    subs = [
        ("ops@yaochuang.tech", "运维", "实例/镜像/账单只读", "启用"),
        ("finance@yaochuang.tech", "财务", "账单/发票/合同", "启用"),
    ]
    for account_name, role, scope, status in subs:
        cursor.execute(
            """
            INSERT INTO cd_sub_account (sp_user_id, account_name, role_name, permission_scope, status)
            VALUES (1,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE role_name=VALUES(role_name), permission_scope=VALUES(permission_scope), status=VALUES(status)
            """,
            (account_name, role, scope, status),
        )
    cursor.execute(
        """
        INSERT INTO cd_account_setting (sp_user_id, message_notify, default_region, release_reminder)
        VALUES (1,1,'重庆A区',1)
        ON DUPLICATE KEY UPDATE default_region=VALUES(default_region)
        """
    )


def seed_app_items(cursor):
    app_columns = [
        ("summary", "varchar(500) NOT NULL DEFAULT ''"),
        ("badge_text", "varchar(16) NOT NULL DEFAULT '精'"),
        ("cover_tone", "varchar(32) NOT NULL DEFAULT 'dark'"),
        ("favorite_count", "int NOT NULL DEFAULT '0'"),
        ("runtime_text", "varchar(32) NOT NULL DEFAULT '0h'"),
        ("download_count", "int NOT NULL DEFAULT '0'"),
        ("tags_json", "json DEFAULT NULL"),
        ("is_base", "smallint NOT NULL DEFAULT '0'"),
    ]
    for column_name, column_sql in app_columns:
        cursor.execute(
            """
            SELECT COUNT(*) AS count
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='cd_app_item' AND COLUMN_NAME=%s
            """,
            (column_name,),
        )
        count_row = cursor.fetchone()
        count = count_row["count"] if isinstance(count_row, dict) else count_row[0]
        if count == 0:
            cursor.execute(f"ALTER TABLE cd_app_item ADD COLUMN `{column_name}` {column_sql}")
    apps = [
        ("APP-ZIMAGE-WAN", "Zimage-Wan-Ltx2.3-训练器", "zealman", "v6", "AI-Toolkit / LORA", "更新到2026年4月最新版本", "精", "pink", 121, "13574h", 5343, ["Z-Image", "LORA", "训练", "wan2.2"], 0, "published", 1, "2026-05-18 22:41:09"),
        ("APP-COMFYUI", "ComfyUI云绘通用版", "nahz202", "v18", "ComfyUI / 工作流", "4TB模型库，50+套图像视频生成工作流", "精", "dark", 310, "52637h", 27092, ["ComfyUI", "文生图", "文生视频", "基础镜像"], 1, "published", 1, "2026-05-19 10:16:44"),
        ("APP-ZZDONGHUA", "字字动画", "zzdh", "v9", "漫剧 / 视频", "全自动-AI电影，适合短剧和口播片段", "精", "white", 801, "685556h", 193307, ["漫剧", "视频", "数字人"], 0, "published", 0, "2026-05-17 14:18:32"),
        ("APP-ZEAL-COMFY", "zealman-ComfyUI", "zealman", "v12", "ComfyUI / API", "8T模型插件工作流+商用API接口并发", "精", "neon", 576, "146375h", 56058, ["ComfyUI", "API", "Flux.2"], 1, "published", 0, "2026-05-15 09:28:11"),
        ("APP-COMFYUI-LITE", "comfyui", "tzwm", "v3", "ComfyUI / 基础镜像", "ComfyUI 整合包，支持 5090 与常用视频节点", "精", "mirror", 63, "12163h", 4748, ["ComfyUI", "基础镜像"], 1, "published", 0, "2026-05-12 19:24:10"),
        ("APP-AITOOLKIT", "AI-Toolkit", "AI-Train", "v4", "训练 / Z-Image", "图像和视频模型训练器，支持Z-Image与LoRA训练", "精", "anime", 133, "38641h", 8722, ["AI-Toolkit", "Z-Image", "训练"], 0, "published", 0, "2026-05-18 22:41:09"),
        ("APP-LORANEXT", "LoRANext云端训练器", "AI-Train", "v3", "LoRA Next / 训练", "延续秋叶训练习惯的 LoRA Next 云端训练器", "精", "lora", 45, "2417h", 1654, ["LORA", "训练"], 0, "favorite", 1, "2026-03-03 17:36:02"),
        ("APP-LLAMA-FACTORY", "llama-factory一键使用", "xxxiu", "v5", "LLM / 微调", "一键调用LLaMA-Factory，轻松微调", "精", "llama", 40, "8612h", 2355, ["LLM", "llama", "训练"], 1, "published", 0, "2026-05-10 10:24:53"),
        ("APP-XIGUA-AIGC", "西瓜AI", "XIGUA-AIGC", "v2", "ComfyUI / AIGC", "面向图像视频生成的 ComfyUI 应用", "热", "melon", 37, "54442h", 16850, ["ComfyUI", "视频"], 0, "published", 0, "2026-05-08 16:09:22"),
        ("APP-DRAFT-001", "数字人口播应用草稿", "炫界云", "v0.1", "数字人 / 草稿", "数字人口播与商品脚本的内部草稿", "草", "avatar", 0, "0h", 0, ["数字人", "草稿"], 0, "draft", 0, None),
    ]
    for app_id, name, author, version, category, summary, badge, tone, favorite_count, runtime, download_count, tags, is_base, status, favorite, last_used_at in apps:
        cursor.execute(
            """
            INSERT INTO cd_app_item
            (app_id, sp_user_id, app_name, author_name, version, category_text, summary, badge_text, cover_tone,
             favorite_count, runtime_text, download_count, tags_json, is_base, status, is_favorite, last_used_at)
            VALUES (%s,1,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE app_name=VALUES(app_name), author_name=VALUES(author_name),
              version=VALUES(version), category_text=VALUES(category_text), status=VALUES(status),
              summary=VALUES(summary), badge_text=VALUES(badge_text), cover_tone=VALUES(cover_tone),
              favorite_count=VALUES(favorite_count), runtime_text=VALUES(runtime_text), download_count=VALUES(download_count),
              tags_json=VALUES(tags_json), is_base=VALUES(is_base), is_favorite=VALUES(is_favorite), last_used_at=VALUES(last_used_at)
            """,
            (app_id, name, author, version, category, summary, badge, tone, favorite_count, runtime, download_count, json.dumps(tags, ensure_ascii=False), is_base, status, favorite, last_used_at),
        )


def seed_app_instances(cursor):
    services = [
        ["JupyterLab", "8888", "系统服务", "未开机", "打开"],
        ["AutoPanel", "6008", "管理面板", "未开机", "打开"],
        ["SSH", "22", "远程终端", "未开机", "复制命令"],
        ["WebUI-6006", "6006", "应用服务", "未开机", "打开"],
        ["WebUI-6008", "6008", "应用服务", "未开机", "打开"],
    ]
    running_services = [[row[0], row[1], row[2], "运行中", row[4]] for row in services]
    files = [
        ["folder", "datasets", "目录", "2026-05-18 15:42"],
        ["folder", "outputs", "目录", "2026-05-18 16:10"],
        ["file", "train_lora.sh", "4.2 KB", "2026-05-18 15:43"],
        ["file", "config-zimage.yaml", "2.8 KB", "2026-05-18 15:45"],
        ["file", "last-run.log", "18.6 KB", "2026-05-18 16:22"],
    ]
    bills = [
        ["2026-05-18 15:40:02", "创建实例", "系统盘 30GB", "￥0.10/日", "已计费"],
        ["2026-05-18 15:41:40", "关机", "按量 GPU 费用停止", "￥0.00", "已完成"],
        ["2026-05-18 16:22:12", "余额检查", "账户余额不足提醒", "￥0.00", "待充值"],
    ]
    events = [
        ["2026-05-18 16:22:12", "余额不足提醒", "系统", "账户余额为0，开机会进入预付检查", "warning"],
        ["2026-05-18 15:41:40", "实例关机", "用户操作", "停止 GPU 计费，保留系统盘与应用配置", "done"],
        ["2026-05-18 15:40:18", "镜像挂载完成", "调度系统", "应用镜像已挂载", "done"],
        ["2026-05-18 15:40:02", "实例创建成功", "用户操作", "从应用创建实例", "done"],
    ]
    rows = [
        ("ins-art-zimage-20260518", "APP-ZIMAGE-WAN", "Zimage LoRA 训练 01", "RTX 5090-32G", "北京B区", 1, "按量计费", "pending", "未开机", "￥-.--/时", "13.2h", "￥18.42", services),
        ("ins-comfyui-20260519", "APP-COMFYUI", "ComfyUI 视频工作台", "RTX 4090D-24G", "北京B区", 1, "包日", "running", "运行中", "￥-.--/日", "42.6h", "￥76.80", running_services),
        ("ins-aitoolkit-20260517", "APP-AITOOLKIT", "AI-Toolkit 双卡训练", "RTX 4080S-32G", "内蒙A区", 2, "按量计费", "stopped", "已停止", "￥-.--/时", "8.5h", "￥24.16", services),
    ]
    for instance_id, app_id, name, gpu_model, region, gpu_count, billing_mode, status, status_text, price_text, runtime, cost, service_rows in rows:
        logs = [
            f"[13:40:12] instance {instance_id} created from app {app_id}",
            "[13:40:18] image mounted",
            "[13:41:03] waiting for WebUI-6006 service",
            f"[13:41:40] instance status: {status_text}",
        ]
        metrics = [
            ["GPU利用率", "36%" if status == "running" else "0%", "运行中" if status == "running" else "未开机"],
            ["显存占用", "18 / 24GB" if status == "running" else "0 / 32GB", "实时监控" if status == "running" else "等待启动"],
            ["运行时长", runtime, "本月累计"],
            ["当前费用", cost, billing_mode],
        ]
        cursor.execute(
            """
            INSERT INTO cd_app_instance
            (instance_id, sp_user_id, app_id, instance_name, gpu_model, region, gpu_count, billing_mode,
             status, status_text, price_text, system_disk_gb, data_disk_gb, month_runtime_text, current_cost_text,
             service_json, metric_json, file_json, log_json, bill_json, event_json)
            VALUES (%s,1,%s,%s,%s,%s,%s,%s,%s,%s,%s,30,50,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE app_id=VALUES(app_id), instance_name=VALUES(instance_name), gpu_model=VALUES(gpu_model),
              region=VALUES(region), gpu_count=VALUES(gpu_count), billing_mode=VALUES(billing_mode),
              status=VALUES(status), status_text=VALUES(status_text), price_text=VALUES(price_text),
              month_runtime_text=VALUES(month_runtime_text), current_cost_text=VALUES(current_cost_text),
              service_json=VALUES(service_json), metric_json=VALUES(metric_json), file_json=VALUES(file_json),
              log_json=VALUES(log_json), bill_json=VALUES(bill_json), event_json=VALUES(event_json)
            """,
            (
                instance_id, app_id, name, gpu_model, region, gpu_count, billing_mode, status, status_text, price_text,
                runtime, cost, json.dumps(service_rows, ensure_ascii=False), json.dumps(metrics, ensure_ascii=False),
                json.dumps(files, ensure_ascii=False), json.dumps(logs, ensure_ascii=False), json.dumps(bills, ensure_ascii=False),
                json.dumps(events, ensure_ascii=False),
            ),
        )


def seed_model_items(cursor):
    rows = [
        ("deepseek-v4-pro", "DeepSeek-V4-Pro", "DeepSeek", "对话", "", "输入：￥12.000 / M token", "输出：￥24.000 / M token", "", "高性能推理模型，适用于复杂推理、代码生成、知识问答和智能体任务。", ["对话", "代码", "推理"], 1),
        ("deepseek-v4-flash", "DeepSeek-V4-Flash", "DeepSeek", "对话", "", "输入：￥1.000 / M token", "输出：￥2.000 / M token", "", "轻量快速推理模型，适合高并发客服、摘要和工具调用。", ["对话", "低延迟"], 2),
        ("kimi-k2-6", "Kimi-K2.6", "Kimi", "对话", "会员6折", "输入：￥3.900 / M token", "输出：￥16.200 / M token", "￥6.500 / M token / ￥27.000 / M token", "长上下文对话与文档理解模型。", ["长上下文", "文档"], 3),
        ("glm-5-1", "GLM-5.1", "智谱", "对话", "会员8折", "输入：￥4.800 / M token", "输出：￥19.200 / M token", "￥6.000 / M token / ￥24.000 / M token", "通用中文推理和智能体模型。", ["中文", "推理"], 4),
        ("qwen3-6-plus", "qwen3.6-plus", "Qwen", "对话", "会员8折", "输入：￥1.600 / M token", "输出：￥9.600 / M token", "￥2.000 / M token / ￥12.000 / M token", "适合中文问答、代码和工具调用。", ["Qwen", "工具调用"], 5),
        ("qwen-image", "Qwen-Image", "Qwen", "生图", "会员6折", "输入：￥0.001 / 次", "输出：￥0.150 / 次", "￥0.250 / 次", "高质量中文海报、电商图和风格化生成模型。", ["生图", "电商"], 6),
        ("doubao-seedance-2", "doubao-seedance-2-0-260128", "火山即梦", "视频", "", "", "点击查看价格详情", "", "文生视频和图生视频生成模型。", ["视频", "AIGC"], 7),
    ]
    for row in rows:
        cursor.execute(
            """
            INSERT INTO cd_model_item
            (model_id, model_name, vendor, model_type, discount_text, input_price, output_price, original_price, summary, tags_json, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE model_name=VALUES(model_name), vendor=VALUES(vendor), model_type=VALUES(model_type),
              discount_text=VALUES(discount_text), input_price=VALUES(input_price), output_price=VALUES(output_price),
              original_price=VALUES(original_price), summary=VALUES(summary), tags_json=VALUES(tags_json), sort_no=VALUES(sort_no), status='online'
            """,
            (*row[:9], json.dumps(row[9], ensure_ascii=False), row[10]),
        )


def seed_image_items(cursor):
    rows = [
        ("lora-train", "akibanzu", "更新于2年前", "精", "Akegarasu/lora-scripts/lora-train", "运行时长557935h No.7", "GitHub Star6.0k", "Stable Diffusion LoRA 训练", 724, "75.8k", 29, "Ubuntu 22.04 / CUDA 11.8", "3.10", "24.6GB", "LoRA训练 / Stable Diffusion", ["StableDiffusion", "LORA", "训练"], 1),
        ("gpt-sovits", "RVC-Boss", "更新于4周前", "精", "RVC-Boss/GPT-SoVITS/GPT-SoVITS-Official", "运行时长426341h No.10", "GitHub Star57.5k", "GPT-SoVITS语音合成官方镜像，3080Ti卡测试通过", 1277, "64.9k", 26, "Ubuntu 22.04 / CUDA 12.1", "3.10", "28.2GB", "语音合成 / 声音克隆", ["语音", "TTS", "声音克隆"], 2),
        ("langchain-chatchat", "glide-the", "更新于2年前", "精", "chatchat-space/Langchain-Chatchat/Langchain-Chatchat", "运行时长323828h No.11", "GitHub Star38.0k", "基于 Langchain 与 ChatGLM 等语言模型的本地知识库问答", 513, "30.7k", 61, "Ubuntu 22.04 / CUDA 11.8", "3.10", "22.8GB", "知识库问答 / Langchain", ["Langchain", "LLM"], 3),
        ("linly-talker", "Kedreamix", "更新于1年前", "精", "Kedreamix/Linly-Talker/Kedreamix-Linly-Talker", "运行时长19540h No.91", "GitHub Star3.3k", "Linly-Talker是一款创新的数字人对话系统", 191, "4.4k", 17, "Ubuntu 22.04 / CUDA 11.8", "3.10", "31.4GB", "数字人 / 口播", ["数字人", "视频"], 4),
        ("livetalking", "lipku", "更新于1月前", "精", "lipku/livetalking/base", "运行时长48327h No.35", "GitHub Star7.7k", "实时交互数字人，支持ernerf和musetalk、wav2lip", 97, "2.9k", 13, "Ubuntu 22.04 / CUDA 12.1", "3.10", "33.1GB", "实时数字人 / 语音驱动", ["数字人", "实时"], 5),
        ("so-vits-svc", "39c5bb", "更新于3月前", "热", "svc-develop-team/so-vits-svc/so-vits-svc-4.1-Stable", "运行时长587459h No.5", "GitHub Star28.1k", "so vits svc项目主分支，开箱即用", 219, "80.7k", 16, "Ubuntu 20.04 / CUDA 11.7", "3.9", "19.6GB", "音色转换 / 声音克隆", ["语音", "音色转换"], 6),
        ("sd-webui-a1111", "tzwm", "更新于3年前", "热", "AUTOMATIC1111/stable-diffusion-webui/tzwm_sd_webui_A1111", "运行时长596445h No.4", "GitHub Star163.1k", "webui 1.6.0 整合版，支持 SDXL", 557, "79.6k", 36, "Ubuntu 22.04 / CUDA 11.8", "3.10", "27.5GB", "Stable Diffusion / WebUI", ["文生图", "StableDiffusion"], 7),
    ]
    for row in rows:
        cursor.execute(
            """
            INSERT INTO cd_image_item
            (image_id, author_name, updated_text, badge_text, image_name, runtime_rank_text, github_star_text,
             summary, favorite_count, runtime_text, download_count, system_text, python_text, size_text,
             scenario_text, tags_json, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE author_name=VALUES(author_name), updated_text=VALUES(updated_text),
              badge_text=VALUES(badge_text), image_name=VALUES(image_name), runtime_rank_text=VALUES(runtime_rank_text),
              github_star_text=VALUES(github_star_text), summary=VALUES(summary), favorite_count=VALUES(favorite_count),
              runtime_text=VALUES(runtime_text), download_count=VALUES(download_count), system_text=VALUES(system_text),
              python_text=VALUES(python_text), size_text=VALUES(size_text), scenario_text=VALUES(scenario_text),
              tags_json=VALUES(tags_json), sort_no=VALUES(sort_no), status='online'
            """,
            (*row[:15], json.dumps(row[15], ensure_ascii=False), row[16]),
        )


def seed_model_admin(cursor):
    usage_rows = [
        ("DeepSeek-V4-Pro", "128,420", "￥154.10", 1286, "99.96%", "2026-05-21"),
        ("Kimi-K2.6", "62,180", "￥45.82", 592, "99.91%", "2026-05-21"),
        ("Qwen-Image", "2,406次", "￥360.90", 214, "99.88%", "2026-05-21"),
    ]
    for model_name, token_usage, cost, request_count, success_rate, stat_date in usage_rows:
        cursor.execute(
            """
            INSERT INTO cd_model_usage (sp_user_id, model_name, token_usage_text, cost_text, request_count, success_rate, stat_date)
            SELECT 1,%s,%s,%s,%s,%s,%s
            WHERE NOT EXISTS (
              SELECT 1 FROM cd_model_usage WHERE sp_user_id=1 AND model_name=%s AND stat_date=%s
            )
            """,
            (model_name, token_usage, cost, request_count, success_rate, stat_date, model_name, stat_date),
        )
    token_rows = [
        ("prod-chat-agent", "sk-****-9f28", "全部模型", "启用"),
        ("image-workflow", "sk-****-81ac", "生图/视频", "启用"),
        ("test-local", "sk-****-44de", "对话模型", "停用"),
    ]
    for token_name, token_mask, scope, status in token_rows:
        cursor.execute(
            """
            INSERT INTO cd_api_token (sp_user_id, token_name, token_mask, permission_scope, status)
            VALUES (1,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE token_mask=VALUES(token_mask), permission_scope=VALUES(permission_scope), status=VALUES(status)
            """,
            (token_name, token_mask, scope, status),
        )
    cursor.execute(
        """
        INSERT INTO cd_model_setting (sp_user_id, default_model, daily_budget, concurrency_limit, callback_url, daily_report, auto_retry, ip_whitelist)
        VALUES (1,'DeepSeek-V4-Pro','￥500.00 / 日','自动弹性','https://example.com/model/callback',1,1,0)
        ON DUPLICATE KEY UPDATE default_model=VALUES(default_model)
        """
    )


def seed_messages_docs(cursor):
    messages = [
        ("system", "系统公告", "五一期间 GPU 调度策略更新", "平台将优先保障已预约实例和包日实例的资源调度。", "未读", "2026-05-20 08:30:00"),
        ("instance", "实例事件", "Zimage-Wan-Ltx2.3-训练器余额不足", "账户余额为0，开机会进入预付检查，请先充值。", "未读", "2026-05-19 16:22:00"),
        ("billing", "账单提醒", "本月应用实例消费已出账", "实例、系统盘和镜像存储费用已生成明细。", "已读", "2026-05-18 23:10:00"),
        ("system", "系统公告", "镜像市场发布审核规则更新", "新增应用需声明服务端口、启动命令和基础镜像来源。", "已读", "2026-05-18 10:00:00"),
    ]
    for message_type, type_text, title, content, read_status, created_at in messages:
        cursor.execute(
            """
            INSERT INTO cd_message (sp_user_id, message_type, type_text, title, content, read_status, created_at)
            SELECT 1,%s,%s,%s,%s,%s,%s
            WHERE NOT EXISTS (
              SELECT 1 FROM cd_message WHERE sp_user_id=1 AND title=%s
            )
            """,
            (message_type, type_text, title, content, read_status, created_at, title),
        )
    docs = [
        ("intro", "简介", "/compute/docs", "严肃声明: 严禁挖矿，一经发现一律封号", [["必看文档", ["快速开始", "计费说明", "开具发票", "实例数据保留说明", "开守护进程"]], ["常用文档", ["如何选择GPU", "上传数据", "下载数据", "配置环境", "公网网盘", "VSCode", "PyCharm"]]], "", 1),
        ("quickstart", "快速开始", "/compute/docs/quickstart", "创建实例前请先确认余额、资源区和镜像来源。", [["创建应用实例", ["进入应用广场选择应用", "确认计费方式和 GPU 型号", "创建后在实例列表开机", "通过 WebUI-6006 或 SSH 访问"]], ["常见入口", ["应用市场", "应用实例", "实例工作台", "钱包充值"]]], "", 2),
        ("app-publish", "应用发布", "/compute/docs/app-publish", "应用发布后会进入平台审核，审核通过后展示到应用广场。", [["发布材料", ["应用名称、简介、封面", "基础镜像和启动命令", "服务端口声明", "应用说明和使用教程"]], ["审核流程", ["自动检查基础信息", "镜像安全扫描", "人工复核应用说明", "通过后发布到应用广场"]]], "", 3),
        ("instance", "应用实例", "/compute/docs/instance", "关机只停止 GPU 计费，系统盘和扩容盘仍会保留并计费。", [["实例生命周期", ["创建实例", "开机和生成服务入口", "关机保留系统盘", "删除实例释放数据"]], ["工作台", ["SSH 终端", "文件浏览器", "实时日志", "WebUI 服务入口"]]], "", 4),
        ("billing", "充值与计费", "/compute/docs/billing", "实例开机前会进行余额预检查，余额不足时无法分配 GPU。", [["费用组成", ["GPU 算力费用", "系统盘基础容量", "扩容盘", "公网服务和流量"]], ["账单管理", ["收支明细", "账单明细", "发票申请", "余额提醒"]]], "", 5),
        ("api", "API文档", "/compute/docs/api", "API Key 请妥善保管，不要暴露在前端代码或公开仓库中。", [["弹性部署接口", ["创建部署", "查询状态", "扩缩容", "停止部署"]], ["模型调用接口", ["创建令牌", "设置白名单", "查看调用量", "导出报表"]]], "POST /api/v1/deployment\nAuthorization: Bearer <token>\nContent-Type: application/json\n\n{\n  \"deployment_name\": \"zimage-train\",\n  \"gpu_name\": [\"RTX 5090\"],\n  \"replicas\": 1\n}", 6),
        ("invoice", "发票", "/compute/docs/invoice", "只有已完成支付且可开票的订单才能申请发票。", [["开票流程", ["进入钱包发票页", "选择订单", "填写抬头信息", "提交并等待开具"]], ["发票类型", ["个人普通发票", "企业普通发票", "企业专票"]]], "", 7),
        ("trouble", "维护与故障", "/compute/docs/trouble", "实例异常时请先保留日志和实例 ID，便于定位调度问题。", [["排查步骤", ["查看实例事件记录", "检查余额和资源库存", "查看实时日志", "联系平台客服"]], ["常见问题", ["WebUI 无法打开", "SSH 连接失败", "镜像启动慢", "文件无法上传"]]], "", 8),
        ("agreement", "服务协议", "/compute/docs/agreement", "严禁挖矿、攻击、违规内容生成和未授权数据处理。", [["使用限制", ["不得挖矿", "不得攻击第三方服务", "不得传播违法内容", "不得共享账号给未授权人员"]], ["数据责任", ["用户自行备份重要数据", "删除实例会释放系统盘", "欠费可能影响数据保留"]]], "", 9),
    ]
    intro = "本文档用于说明炫界云 Art 和算力控制台的基础流程，页面会同步真实状态和返回码。"
    for doc_key, title, href, warning, sections, code_text, sort_no in docs:
        cursor.execute(
            """
            INSERT INTO cd_help_doc (doc_key, title, href, warning, intro, sections_json, code_text, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE title=VALUES(title), href=VALUES(href), warning=VALUES(warning),
              intro=VALUES(intro), sections_json=VALUES(sections_json), code_text=VALUES(code_text), sort_no=VALUES(sort_no), status='online'
            """,
            (doc_key, title, href, warning, intro, json.dumps(sections, ensure_ascii=False), code_text, sort_no),
        )


def seed_public_shared_data(cursor):
    public_rows = [
        ("argoverse2-sensor", "argoverse2.0感知数据集", "/root/lingqu-pub/argoverse2.0-sensor", "739.02 GB", "数据集", "https://argoverse.github.io", "Argoverse 2.0 自动驾驶感知数据集", [["sensor/train", "目录", "421.2GB", "训练集传感器数据"], ["sensor/val", "目录", "118.4GB", "验证集传感器数据"], ["annotations", "目录", "43.8GB", "标注文件"], ["README.md", "文件", "18KB", "数据集说明"]], 1),
        ("vimeo-90k", "Vimeo-90k", "/root/lingqu-pub/Vimeo-90k", "81.89 GB", "数据集", "toflow.csail.mit.edu", "Vimeo-90k视频超分数据集", [["train", "目录", "68.2GB", "训练集"], ["test", "目录", "13.4GB", "测试集"]], 2),
        ("culane", "CULane", "/root/lingqu-pub/CULane", "42.45 GB", "数据集", "https://xingangpan.github.io/projects/CULane.html", "大规模车道线检测数据集", [["driver_23_30frame", "目录", "38.1GB", "图像序列"], ["list", "目录", "280KB", "训练列表"]], 3),
        ("tt100k", "TT100K", "/root/lingqu-pub/TT100K", "106.77 GB", "数据集", "https://cg.cs.tsinghua.edu.cn/traffic-sign/", "交通信号灯检测与识别数据集", [["images", "目录", "103GB", "图像数据"], ["annotations.json", "文件", "420MB", "标注文件"]], 4),
        ("cifar-100", "cifar-100", "/root/lingqu-pub/cifar-100", "162 MB", "数据集", "https://www.cs.toronto.edu/~kriz/cifar.html", "CIFAR-100图像分类数据集", [["train", "文件", "155MB", "训练数据"], ["test", "文件", "7MB", "测试数据"]], 5),
    ]
    for row in public_rows:
        cursor.execute(
            """
            INSERT INTO cd_public_data
            (data_id, data_name, mount_path, size_text, data_type, publisher, summary, files_json, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE data_name=VALUES(data_name), mount_path=VALUES(mount_path), size_text=VALUES(size_text),
              data_type=VALUES(data_type), publisher=VALUES(publisher), summary=VALUES(summary), files_json=VALUES(files_json),
              sort_no=VALUES(sort_no), status='online'
            """,
            (*row[:7], json.dumps(row[7], ensure_ascii=False), row[8]),
        )
    shared_rows = [
        ("shared-imagenet100", "ImageNet100", "ImageNet 100类数据集。参考：https://github.c...", "daiab", 230, "百度网盘", 1),
        ("shared-coco2017", "COCO2017", "Based on community feedback, in 2017...", "daiab", 146, "百度网盘", 2),
        ("shared-visdrone", "VisDrone 2019", "天津大学机器学习与数据挖掘实验室发布的无人机目标检测数据", "daiab", 81, "百度网盘", 3),
        ("shared-mot20", "MOT20", "密集人群中行人跟踪数据集（多目标跟踪）", "daiab", 79, "百度网盘", 4),
        ("shared-akisd", "AKI-Stable diffusion", "基于秋叶版本的sd", "炼丹师9033", 72, "百度网盘", 5),
        ("shared-chatglm", "ChatGLM-6B", "开源中英双语对话语言模型数据与权重说明", "炼丹师5015", 64, "百度网盘", 6),
    ]
    for row in shared_rows:
        cursor.execute(
            """
            INSERT INTO cd_shared_data
            (share_id, title, summary, owner_name, favorite_count, source_type, sort_no)
            VALUES (%s,%s,%s,%s,%s,%s,%s)
            ON DUPLICATE KEY UPDATE title=VALUES(title), summary=VALUES(summary), owner_name=VALUES(owner_name),
              favorite_count=VALUES(favorite_count), source_type=VALUES(source_type), sort_no=VALUES(sort_no), status='online'
            """,
            row,
        )


def main():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            for statement in split_sql(SQL_FILE.read_text(encoding="utf-8")):
                cursor.execute(statement)
            seed_templates(cursor)
            seed_user_workflows(cursor)
            seed_versions(cursor)
            seed_runs(cursor)
            seed_cases(cursor)
            seed_wallet(cursor)
            seed_orders(cursor)
            seed_coupons_contracts(cursor)
            seed_account_rows(cursor)
            seed_app_items(cursor)
            seed_app_instances(cursor)
            seed_model_items(cursor)
            seed_image_items(cursor)
            seed_model_admin(cursor)
            seed_messages_docs(cursor)
            seed_public_shared_data(cursor)
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    main()
