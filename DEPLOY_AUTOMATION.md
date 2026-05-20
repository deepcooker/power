# Power 自动化发布说明

## 脚本

自动化发布脚本：

```bash
/root/power/tools/deploy_remote.sh
```

脚本做的事情：

1. 在本机 `/root/power` 执行 `git pull --ff-only origin main`
2. 在本机构建前端：`cd a9_compute_admin && npm ci && npm run build`
3. 打包项目，排除 `.git`、`node_modules`、日志、缓存、敏感交接文档
4. 上传到远端 `47.103.49.82:/www/wwwroot/power`
5. 远端保留已有 `venv`
6. 解包覆盖项目文件
7. 确认远端 Python 依赖：`fastapi uvicorn`
8. 重启 systemd 服务：`power-compute.service`
9. 测试 nginx 配置并 reload
10. 验证公网 `/compute` 和 `/api/health`
11. 生成发布总结 md 到 `deploy_reports/`

## 默认参数

```bash
REMOTE_HOST=47.103.49.82
REMOTE_USER=root
REMOTE_DIR=/www/wwwroot/power
REMOTE_SERVICE=power-compute.service
BRANCH=main
```

如需覆盖：

```bash
REMOTE_HOST=47.103.49.82 BRANCH=main ./tools/deploy_remote.sh
```

## 前置条件

本机：

- `/root/power` 是独立 git 仓库
- remote：`git@github.com:deepcooker/power.git`
- 分支：`main`
- 本机 Node 能构建 Vite 项目
- 本机可以免密 SSH 到远端：

```bash
ssh root@47.103.49.82 'hostname && whoami'
```

远端：

- 项目目录：`/www/wwwroot/power`
- Python venv：`/www/wwwroot/power/venv`
- systemd 服务：`power-compute.service`
- 后端监听：`127.0.0.1:6111`
- nginx 默认站点反代：
  - `/compute` -> `127.0.0.1:6111`
  - `/api/` -> `127.0.0.1:6111`

## 手动发布命令

```bash
cd /root/power
./tools/deploy_remote.sh
```

发布完成后会输出类似：

```text
/root/power/deploy_reports/DEPLOY_YYYYMMDD_HHMMSS.md
```

## 发布后验证

```bash
curl http://47.103.49.82/api/health
curl -I http://47.103.49.82/compute
```

浏览器访问：

```text
http://47.103.49.82/compute
http://47.103.49.82/compute/app/market
```

## 常用远端运维

```bash
ssh root@47.103.49.82
systemctl status power-compute.service --no-pager
systemctl restart power-compute.service
journalctl -u power-compute.service -n 100 --no-pager
/www/server/nginx/sbin/nginx -t
/www/server/nginx/sbin/nginx -s reload
```

## 说明

- 远端 Node 是 `v10.19.0`，不要在远端构建前端。
- 发布脚本采用“本机构建，远端运行”的方式。
- 远端 `6111` 只监听 `127.0.0.1`，公网不需要开放 `6111`。
- 外部访问走 nginx 的 `80` 端口。
- 敏感登录信息在本地 `DEPLOY_HANDOFF_SENSITIVE.md`，该文件已加入 `.gitignore`，不要提交。
