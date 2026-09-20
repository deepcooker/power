# 数据库结构规划

目标是先把重复数据收口，不追求复杂。第一阶段只服务账号、钱包、工作流展示、运行记录和案例发布。

## 核心原则

- `cd_sp_user` 继续沿用成熟用户结构，不重建用户体系。
- 工作流名称、分类、封面、价格、标签只存 `cd_workflow_template` 一份。
- 用户自己的草稿、审核、发布状态放 `cd_user_workflow`，不复制模板主数据。
- 每次生成只写 `cd_workflow_run`，发布到广场时再写 `cd_workflow_case`。
- 钱包先保留简单余额和流水，后面接支付、实例计费、Token 消耗都走同一张流水。

## 表

- `cd_sp_user`：用户、token、渠道 `sp_id`，已按 `newswap` 原结构建好。
- `cd_verification_code`：邮箱验证码。
- `cd_wallet_account`：用户余额、冻结金额、算力币。
- `cd_wallet_ledger`：充值、退款、工作流运行、实例计费流水。
- `cd_workflow_template`：工作流模板主表。
- `cd_user_workflow`：用户工作流状态表。
- `cd_workflow_template_version`：模板版本记录。
- `cd_workflow_run`：运行记录。
- `cd_workflow_case`：发布案例。
- `cd_workflow_share`：分享链接。

后续如果接 AutoDL 实例，再加 `cd_compute_instance` 和 `cd_provider_resource_snapshot`，不要先把供应商资源表做复杂。
