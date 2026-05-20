# A9 Compute Admin

AutoDL 合作商算力租赁控制台的新项目目录，不改 `/root/a9quant_admin` 原项目。

## 结构

- `api.py`：根目录 FastAPI 后端，默认端口 `6111`
- `a9_compute_admin/`：只放 React + Vite 前端
- `/api/compute/autodl/console`：第一阶段 AutoDL 弹性接口的数据入口占位

## 本地运行

```bash
cd /root/power/a9_compute_admin
npm install
npm run build

cd /root/power
./restart_compute.sh
```

访问：

```text
http://127.0.0.1:6111/compute
http://127.0.0.1:6008/compute
```

外部 `https://uu68283-a0d9-a416943c.cqa1.seetacloud.com:8443/compute` 走现有 `6008` nginx，再由 nginx 把 `/compute` 和 `/api/compute/` 反代到本服务 `127.0.0.1:6111`。

## Nginx

已在 `/etc/nginx/conf.d/newswap_6008.conf` 增加：

- `upstream power_compute_backend -> 127.0.0.1:6111`
- `location = /compute`
- `location ^~ /compute/`
- `location ^~ /api/compute/`

变更后执行：

```bash
nginx -t
nginx -s reload
```

## 验证

```bash
curl http://127.0.0.1:6008/compute
curl http://127.0.0.1:6008/api/compute/autodl/console
```

浏览器截图验证产物：

- `/tmp/power_compute_6008.png`
