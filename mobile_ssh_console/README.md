# 灵渠 H5 SSH 控制台

独立手机端 SSH 工作台，默认监听 `127.0.0.1:6112`，不依赖主算力云 `api.py`。

## 本地启动

```bash
cd mobile_ssh_console
python3 -m venv venv
venv/bin/pip install fastapi uvicorn
PORT=6112 venv/bin/python app.py
```

访问：

```text
http://127.0.0.1:6112/
```

## 远端部署建议

systemd 服务名：

```text
power-mobile-ssh.service
```

nginx 建议入口：

```text
/ssh/
```

反代到：

```text
http://127.0.0.1:6112/
```

## Session 逻辑

- 第一次打开输入 SSH 目标，例如 `root@47.103.49.82` 或 `ssh -p 22 root@ip`
- 登录成功后浏览器 localStorage 保存 session
- 下次打开直接进入工作台
- 点击“切换主机”清除 session

当前版本要求服务端到目标机器已配置 SSH 免密登录。
