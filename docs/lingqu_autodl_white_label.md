# 灵渠 AutoDL 供应商白标镜像流程

## 目标

把 AutoDL 弹性容器启动后的用户可见环境改成灵渠工作区：

- Jupyter 文件区默认进入 `/workspace`
- Jupyter 终端默认进入白标 shell
- 用户看到 `/workspace`、`/data`、`/output`、`/system`、`/share`
- 终端打开时显示灵渠目录说明、CPU、内存、GPU、磁盘和常用命令
- 页面和终端里不主动展示 AutoDL 品牌路径

这套脚本既可以用于“开机后注入”，也可以用于“手工调好后保存成私有镜像”。

## 文件

- 容器内安装脚本：`scripts/autodl_white_label/lingqu-autodl-bootstrap.sh`
- 本机 SSH 注入脚本：`scripts/autodl_white_label/inject_over_ssh.py`

## 当前推荐镜像

第一版只维护少量官方镜像：

- 基础开发镜像：Miniconda / CUDA / Jupyter / 白标工作区
- PyTorch 镜像：基础开发镜像 + PyTorch
- LTX2.3 镜像：基础开发镜像 + 模型、服务启动脚本、工作流依赖

前台只展示我们允许的官方镜像。后台保存镜像 UUID、镜像类型、适配 GPU、默认启动命令、是否上架。

## 对运行中容器注入

示例：

```bash
cd /root/power
python3 scripts/autodl_white_label/inject_over_ssh.py \
  --host connect.nmb2.seetacloud.com \
  --port 45240 \
  --user root \
  --password '容器SSH密码' \
  --token '自定义JupyterToken'
```

如果是跨用户的新租用实例，不能直接复用上一轮工作区，必须清理旧数据或使用独立 deployment：

```bash
python3 scripts/autodl_white_label/inject_over_ssh.py \
  --host connect.nmb2.seetacloud.com \
  --port 45240 \
  --user root \
  --password '容器SSH密码' \
  --token '自定义JupyterToken' \
  --reset-data
```

如果只需要清理 Jupyter 文件区，不清理整个数据盘：

```bash
python3 scripts/autodl_white_label/inject_over_ssh.py \
  --host connect.nmb2.seetacloud.com \
  --port 45240 \
  --user root \
  --password '容器SSH密码' \
  --token '自定义JupyterToken' \
  --reset-workspace
```

注入后脚本会：

1. 建立 `/opt/lingqu` 白标目录
2. 映射数据盘到 `/data`
3. 映射 Jupyter 工作区到 `/workspace`
4. 映射输出目录到 `/output`
5. 映射系统盘工作目录到 `/system`
6. 检测共享存储并映射到 `/share`
7. 安装/检查 `proot`
8. 写入白标 shell `/usr/local/bin/lingqu-shell`
9. 启动 6006 端口的 JupyterLab，base URL 为 `/`，与网站的 6006 直达入口一致
10. 生成 `/opt/lingqu/WHITE_LABEL_STATUS`

## 打镜像流程

1. 在 AutoDL 控制台开一台目标规格机器。
2. 用上面的注入命令完成白标初始化。
3. 浏览器打开 6006 对应的 Jupyter 外网地址，确认：
   - 文件列表进入 `/workspace`
   - 新建 Terminal 显示灵渠欢迎页
   - `cd /data`、`cd /system`、`cd /share` 可用
   - `nvidia-smi` 可用
4. 如需 PyTorch 或 LTX2.3，继续安装对应依赖和服务文件。
5. 关机后在 AutoDL 控制台保存为私有镜像。
6. 把镜像 UUID 写入灵渠后台官方镜像配置。

## 开机后注入和镜像内置的区别

开机后注入：

- 优点：不用马上打镜像，方便调试。
- 缺点：每台机器启动后都要 SSH 执行一次脚本，启动链路更长。

镜像内置：

- 优点：启动即白标，最稳定，适合正式对外。
- 缺点：每次改基础环境都要重新保存镜像。

正式产品建议走镜像内置。开机后注入只作为测试、修复和临时兼容方案。

## 弹性复用和数据隔离

本次测试确认的是：当 AutoDL 弹性 deployment 使用 `reuse_container=true` 时，停止后再次拉起，可能获得新的容器 UUID 后缀，但实际复用了上一轮容器及其本地数据目录，因此 `/root/autodl-tmp` 内容仍然存在。例如上一轮 Jupyter 创建的 `11` 文件夹和 `111.txt`，再次拉起后仍可在 `/workspace` 看到。

这个现象不能解释为“同 deployment 多个容器共享 `/root/autodl-tmp`”。正确理解是：

- `/root/autodl-tmp` 是容器本地数据盘，不应作为多个同时运行容器之间的共享目录。
- `/root/autodl-fs` 才是跨实例/跨容器共享文件存储，属于需要单独开通和计费的共享存储。
- `reuse_container=true` 的续开保留，是供应商弹性复用策略带来的效果，不等同于共享存储能力。
- 如果同一个 deployment 同时扩到 2 个容器，默认不能假设两个容器的 `/root/autodl-tmp` 互通。

因此后台需要把“弹性 deployment”拆成几种使用方式：

- `resume`：同用户同工作区续开，可以尝试 `reuse_container=true`，但页面仍提示重要文件请同步到共享存储或对象存储。
- `fresh`：同用户新开工作区或跨用户新租用，必须创建独立 deployment，或清理数据盘，避免旧数据残留。
- `scale`：同一个任务扩多个副本时，不能依赖 `/root/autodl-tmp` 共享；需要把输入输出放到 `/root/autodl-fs`、OSS、数据库或任务级对象存储。

产品上不能把 `/root/autodl-tmp` 保留承诺成强 SLA。它可以作为“续开时可能保留上次工作区”的体验优化，但长期数据、跨副本数据、跨任务共享数据必须走 `/root/autodl-fs` 或我们自己的 OSS/数据库。

## 影响复用的 AutoDL 参数

弹性部署创建参数：

- `reuse_container`：控制部署是否复用停止后的容器。为 `true` 时，后续扩容/重启可能复用缓存容器，因此 `/root/autodl-tmp` 可能保留上一轮内容。为 `false` 时，倾向新建容器。
- `reuse_container_scope`：控制复用范围。官方文档示例中使用 `all`，表示复用所有符合条件的容器。后续如果 AutoDL 支持更细范围，需要继续实测。
- `replica_num`：副本数。副本数大于 1 时，是同时多个容器，不等同于同一个本地盘。不能假设多个副本共享 `/root/autodl-tmp`。

停止容器参数：

- `decrease_one_replica_num`：停止容器时是否同步减少 deployment 副本数。我们当前停机使用 `true`。
- `no_cache`：停止容器时是否不进入缓存。这个参数会影响后续是否还能复用到旧容器。需要实测：
  - `no_cache=false` 或不传：可能进入可复用缓存，后续 `reuse_container=true` 时可能保留 `/root/autodl-tmp`。
  - `no_cache=true`：理论上不进入缓存，后续不应依赖旧数据保留。
- `cmd_before_shutdown`：停机前执行命令。可用于停机前把 `/workspace`、`/output` 同步到 `/root/autodl-fs` 或 OSS。

当前代码状态：

- 创建 deployment 时，默认 `reuse_container=true`、`reuse_container_scope=all`。
- 停止容器时，默认没有传 `no_cache`，因此实测 A 的“文件保留”是在默认缓存策略下发生的。
- `autodl_client.py` 已预留 `no_cache` 和 `cmd_before_shutdown` 参数，后续可以做显式对照测试。

后续必须补做的实测矩阵：

- 同 deployment，`reuse_container=true`，停止时不传 `no_cache`，再开：文件是否保留。已测，见 2026-05-27 实测记录。
- 同 deployment，`reuse_container=true`，停止时 `no_cache=true`，再开：文件是否还保留。已测，见 2026-05-27 实测记录。
- 同 deployment，同时 `replica_num=2`：A 容器写 `/root/autodl-tmp/test.txt`，B 容器是否可见。已测，见 2026-05-27 实测记录。
- 开通 `/root/autodl-fs` 后，同时 `replica_num=2`：A 容器写 `/root/autodl-fs/test.txt`，B 容器是否可见。
- `cmd_before_shutdown` 执行同步脚本：停机前能否稳定把结果同步到 `/root/autodl-fs` 或 OSS。

白标注入脚本已经预留：

- 默认：不清理数据，适合续开。
- `--reset-workspace`：只清理 `/workspace`。
- `--reset-data`：清理数据盘后重建 `/workspace`、`/data`、`/output`，适合跨用户新租用。

## 2026-05-26 实测记录

测试 A：同一个本地实例 ID 续开。

- 本地实例 ID：`ins-miniconda-cuda118-4090-cq-20260526233925`
- 第一次容器：`591d3d4831-e07941848a-aabd1c100f-519ec288d`
- 写入文件：`/workspace/lingqu_resume_marker_A_20260526.txt`
- 关机后再次开机容器：`591d3d4831-e07941848a-aabd1c100f-cc6f338b7`
- 结果：容器 UUID 后缀变化，但标记文件仍存在。

结论：这次只能证明 `reuse_container=true` 的停开路径可能复用上一轮容器数据。不能证明同一个 deployment 下多个同时运行容器共享 `/root/autodl-tmp`。页面文案应提示“续开可能保留上次工作区，请及时同步重要文件”，不能承诺本地数据盘长期可靠保留。

测试 B：同一个供应商账号下新开 deployment，不复用容器。

- 本地测试 ID：`manual-fresh-B-202605262351`
- 新 deployment：`23d5d82d60`
- 新容器：`23d5d82d60-e07941848a-fa717f7abc`
- 创建参数：`reuse_container=false`
- 结果：`/workspace` 为空，看不到测试 A 的 `lingqu_resume_marker_A_20260526.txt`。

结论：同一个客户如果明确选择“新开一台新的工作区”，或者后台判定需要隔离，应创建独立 deployment 或清理数据盘，不应走已有 deployment 的续开路径。多副本任务如果需要共享输入输出，应使用 `/root/autodl-fs` 或我们自己的 OSS/数据库。

## 2026-05-27 实测记录

测试 deployment：

- deployment 名称：`lingqu-cache-matrix-20260527`
- deployment UUID：`0c1d0ba832`
- 创建参数：`reuse_container=true`、`reuse_container_scope=all`、`replica_num=1`
- 测试镜像：`base-image-l2t43iu6uk`
- 测试区域：`neimengDC3`
- 测试 GPU：`RTX 3090`

测试 C：默认停机缓存，不传 `no_cache`。

- 第一次容器：`591d3d4831-e07941848a-aabd1c100f-14a030f59`
- 写入文件：`/root/autodl-tmp/.lingqu-workspace/matrix_default_cache_marker_20260527.txt`
- 停止参数：`decrease_one_replica_num=true`，不传 `no_cache`
- 再开容器：`23d5d82d60-e07941848a-fa717f7abc-7a91beee1`
- 检查结果：`MARKER_ABSENT`

结论：即使 `reuse_container=true`，默认停机后再开也不保证复用刚才那台容器。AutoDL 可能从复用池中选择另一台缓存容器，因此不能把本地盘保留作为产品承诺。

测试 D：停机传 `no_cache=true`。

- 写入容器：`23d5d82d60-e07941848a-fa717f7abc-7a91beee1`
- 写入文件：`/root/autodl-tmp/.lingqu-workspace/matrix_no_cache_marker_20260527.txt`
- 停止参数：`decrease_one_replica_num=true`，`no_cache=true`
- 再开容器：`591d3d4831-e07941848a-aabd1c100f-4fc18060c`
- 检查结果：`MARKER_ABSENT`

结论：`no_cache=true` 后，不能依赖该容器再次进入复用池；再开拿到其他容器，本地盘文件不可见。这个参数适合“释放后不希望被续用”的场景。

测试 E：同 deployment 同时 `replica_num=2`。

- 写入容器：`23d5d82d60-e07941848a-fa717f7abc-801d75dc4`
- 读取容器：`591d3d4831-e07941848a-aabd1c100f-4fc18060c`
- 写入文件：`/root/autodl-tmp/.lingqu-workspace/matrix_replica_tmp_share_20260527.txt`
- 读取结果：`MARKER_ABSENT`

结论：同一个 deployment 的两个同时运行副本之间，`/root/autodl-tmp` 不互通。多副本共享输入输出必须走 `/root/autodl-fs`、OSS、数据库或其他外部存储。

测试后清理：

- `23d5d82d60-e07941848a-fa717f7abc-801d75dc4` 已 stop。
- `591d3d4831-e07941848a-aabd1c100f-4fc18060c` 已 stop。
- 查询 `0c1d0ba832` 的未释放容器均为 `shutdown`，无 running 容器。

更新后的产品判断：

- `reuse_container=true` 只能提高复用概率，不能保证复用指定容器。
- `/root/autodl-tmp` 只适合单容器临时工作区，不适合跨副本共享。
- “续开保留数据”只能作为不承诺的体验优化，不应写成强保证。
- 真正需要保留、共享、归档的数据，必须同步到 `/root/autodl-fs` 或我们自己的 OSS。

## 2026-05-27 严格同部署扩容实测

原始结果文件：

- `docs/lingqu_live_tmp_share_matrix_20260527.json`

测试 deployment：

- deployment 名称：`lingqu-live-tmp-share-matrix-20260527`
- deployment UUID：`3e9f90e84d`
- 创建参数：`reuse_container=true`、`reuse_container_scope=all`、`replica_num=1`
- 测试镜像：`base-image-l2t43iu6uk`
- 测试区域：`neimengDC3`
- 测试 GPU：`RTX 3090`
- marker 文件：`/root/autodl-tmp/lingqu_live_tmp_share_marker_20260527.txt`

测试 F：先开 1 台，写文件，不关机，直接扩到 3 台。

- 写入容器：`591d3d4831-e07941848a-aabd1c100f-1510d7411`
- 扩容后 3 个 running 容器：
  - `3e9f90e84d-e07941848a-2d0c3f4fb3`：`MARKER_ABSENT`
  - `23d5d82d60-e07941848a-fa717f7abc-deef1d3c2`：`MARKER_ABSENT`
  - `591d3d4831-e07941848a-aabd1c100f-1510d7411`：`MARKER_PRESENT`

结论：同一个 deployment 同时运行的多个副本之间，`/root/autodl-tmp` 明确不共享。只有写入 marker 的原容器能看到该文件。

测试 G：把 3 台分别用不同停机参数关掉，再开 2 台。

停机参数：

- `3e9f90e84d-e07941848a-2d0c3f4fb3`：不传 `no_cache`
- `23d5d82d60-e07941848a-fa717f7abc-deef1d3c2`：`no_cache=false`
- `591d3d4831-e07941848a-aabd1c100f-1510d7411`：`no_cache=true`

再开 2 台后：

- `591d3d4831-e07941848a-aabd1c100f-4dcce5d17`：`MARKER_PRESENT`
- `3e9f90e84d-67194fac87-80a7e8dde3`：`MARKER_ABSENT`

结论：

- AutoDL 复用池会选择某个旧容器族，但不保证复用指定容器。
- 即使原写入容器停机时用了 `no_cache=true`，这次仍出现同一容器族的新后缀看到 marker 的现象，说明 `no_cache` 的实际语义需要继续结合官方支持确认，不能单独作为“彻底清除本地盘”的保证。
- 对我们产品来说，不能依赖缓存池命中来做数据保留；如果需要用户数据稳定存在，必须主动同步到 `/root/autodl-fs` 或 OSS。
- 如果需要强隔离，应该新建 deployment，并在启动前显式清理工作目录，不能只依赖 `no_cache`。

测试后清理：

- `591d3d4831-e07941848a-aabd1c100f-4dcce5d17` 已 stop。
- `3e9f90e84d-67194fac87-80a7e8dde3` 已 stop。
- 查询 `3e9f90e84d` 下所有容器均为 `shutdown`，无 running 容器。

## 用户可见目录说明

- `/workspace`：项目工作区，Jupyter 文件区
- `/data`：数据盘，适合数据集、模型权重、中间产物
- `/output`：输出结果
- `/system`：系统盘工作目录，适合装依赖和少量工具文件，会随镜像保存
- `/share`：共享存储，实际检测 AutoDL 文件存储目录，未开通时为空目录

## 注意

- 终端欢迎页不实时跑 `nvidia-smi`，资源信息来自 `/opt/lingqu/resource.env` 缓存，避免打开 Terminal 变慢。
- 如果机器规格变化，开机后执行一次：

```bash
/opt/lingqu/bin/refresh-resource-cache.py
```

- Jupyter 旧 Terminal 不会刷新欢迎页，需要新建 Terminal。
- 这套脚本不负责保存镜像；保存镜像仍然在供应商控制台完成。
