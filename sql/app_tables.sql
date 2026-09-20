CREATE TABLE IF NOT EXISTS `cd_wallet_account` (
  `wallet_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL,
  `balance_cny` decimal(12,2) NOT NULL DEFAULT '0.00',
  `frozen_cny` decimal(12,2) NOT NULL DEFAULT '0.00',
  `compute_coin` decimal(12,2) NOT NULL DEFAULT '0.00',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`wallet_id`),
  UNIQUE KEY `uk_wallet_user` (`sp_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_wallet_ledger` (
  `ledger_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL,
  `biz_type` varchar(64) NOT NULL COMMENT 'recharge/workflow_run/refund/instance',
  `biz_id` varchar(64) DEFAULT NULL,
  `amount_cny` decimal(12,2) NOT NULL DEFAULT '0.00',
  `amount_coin` decimal(12,2) NOT NULL DEFAULT '0.00',
  `balance_after_cny` decimal(12,2) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`ledger_id`),
  KEY `idx_ledger_user_time` (`sp_user_id`, `created_at`),
  KEY `idx_ledger_biz` (`biz_type`, `biz_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_order` (
  `order_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL,
  `order_type` varchar(64) NOT NULL DEFAULT 'recharge',
  `status` varchar(32) NOT NULL DEFAULT 'paid',
  `amount_cny` decimal(12,2) NOT NULL DEFAULT '0.00',
  `pay_channel` varchar(64) NOT NULL DEFAULT '微信支付',
  `note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `paid_at` datetime DEFAULT NULL,
  PRIMARY KEY (`order_id`),
  KEY `idx_order_user_time` (`sp_user_id`, `created_at`),
  KEY `idx_order_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_invoice` (
  `invoice_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL,
  `invoice_type` varchar(64) NOT NULL DEFAULT '个人普通发票',
  `title` varchar(120) NOT NULL,
  `content` varchar(120) NOT NULL DEFAULT '算力服务费',
  `amount_cny` decimal(12,2) NOT NULL DEFAULT '0.00',
  `email` varchar(120) DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT '待开票',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`invoice_id`),
  KEY `idx_invoice_user_time` (`sp_user_id`, `created_at`),
  KEY `idx_invoice_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_coupon` (
  `coupon_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL,
  `coupon_name` varchar(120) NOT NULL,
  `discount_text` varchar(120) NOT NULL,
  `scope_text` varchar(120) NOT NULL,
  `valid_until` date DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT '可用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`coupon_id`),
  KEY `idx_coupon_user_status` (`sp_user_id`, `status`, `valid_until`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_contract` (
  `contract_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL,
  `contract_type` varchar(64) NOT NULL DEFAULT '算力服务合同',
  `subject` varchar(120) NOT NULL,
  `amount_cny` decimal(12,2) NOT NULL DEFAULT '0.00',
  `status` varchar(32) NOT NULL DEFAULT '待签署',
  `email` varchar(120) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`contract_id`),
  KEY `idx_contract_user_time` (`sp_user_id`, `created_at`),
  KEY `idx_contract_status` (`status`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_access_log` (
  `access_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL,
  `login_ip` varchar(64) NOT NULL,
  `login_region` varchar(64) DEFAULT NULL,
  `login_method` varchar(64) NOT NULL DEFAULT '密码登录',
  `status` varchar(32) NOT NULL DEFAULT '成功',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`access_id`),
  KEY `idx_access_user_time` (`sp_user_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_sub_account` (
  `sub_account_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL,
  `account_name` varchar(120) NOT NULL,
  `role_name` varchar(64) NOT NULL,
  `permission_scope` varchar(255) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT '启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sub_account_id`),
  UNIQUE KEY `uk_sub_account_user_name` (`sp_user_id`, `account_name`),
  KEY `idx_sub_account_status` (`sp_user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_account_setting` (
  `sp_user_id` int NOT NULL,
  `message_notify` smallint NOT NULL DEFAULT '1',
  `default_region` varchar(64) NOT NULL DEFAULT '重庆A区',
  `release_reminder` smallint NOT NULL DEFAULT '1',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sp_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_workflow_template` (
  `template_id` varchar(64) NOT NULL,
  `title` varchar(120) NOT NULL,
  `mode` varchar(32) NOT NULL COMMENT 'text_to_image/text_to_video/image_to_video',
  `category` varchar(64) NOT NULL,
  `cover` varchar(512) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `price_coin` decimal(10,2) NOT NULL DEFAULT '0.00',
  `price_text` varchar(64) NOT NULL,
  `run_count_text` varchar(32) NOT NULL DEFAULT '0',
  `tags_json` json DEFAULT NULL,
  `status` varchar(32) NOT NULL DEFAULT 'online',
  `sort_no` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`template_id`),
  KEY `idx_template_category` (`category`, `status`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_user_workflow` (
  `user_workflow_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL DEFAULT '0',
  `template_id` varchar(64) NOT NULL,
  `title` varchar(120) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT '草稿',
  `version` varchar(32) NOT NULL DEFAULT 'v0.1',
  `visibility` varchar(32) NOT NULL DEFAULT 'private',
  `monthly_revenue` decimal(12,2) NOT NULL DEFAULT '0.00',
  `audit_note` varchar(255) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_workflow_id`),
  UNIQUE KEY `uk_user_template` (`sp_user_id`, `template_id`),
  KEY `idx_user_workflow_status` (`sp_user_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_workflow_template_version` (
  `version_id` bigint NOT NULL AUTO_INCREMENT,
  `template_id` varchar(64) NOT NULL,
  `version` varchar(32) NOT NULL,
  `status` varchar(32) NOT NULL,
  `note` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`version_id`),
  UNIQUE KEY `uk_template_version` (`template_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_workflow_run` (
  `run_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL DEFAULT '0',
  `template_id` varchar(64) NOT NULL,
  `status` varchar(32) NOT NULL,
  `status_text` varchar(64) NOT NULL,
  `mode` varchar(32) NOT NULL,
  `duration_text` varchar(32) NOT NULL DEFAULT '-',
  `cost_coin` decimal(10,2) NOT NULL DEFAULT '0.00',
  `cost_text` varchar(64) NOT NULL,
  `prompt` text,
  `negative_prompt` text,
  `ratio` varchar(16) NOT NULL DEFAULT '9:16',
  `quality` varchar(32) NOT NULL DEFAULT '1080P',
  `seed` varchar(64) DEFAULT 'random',
  `result_type` varchar(16) NOT NULL DEFAULT 'video',
  `params_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`run_id`),
  KEY `idx_run_user_time` (`sp_user_id`, `created_at`),
  KEY `idx_run_template` (`template_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_workflow_case` (
  `case_id` varchar(64) NOT NULL,
  `run_id` varchar(64) DEFAULT NULL,
  `template_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL DEFAULT '0',
  `title` varchar(120) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `output_text` varchar(64) NOT NULL,
  `prompt` text,
  `ratio` varchar(16) NOT NULL DEFAULT '9:16',
  `quality` varchar(32) NOT NULL DEFAULT '1080P',
  `status` varchar(32) NOT NULL DEFAULT '已发布',
  `published_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`case_id`),
  KEY `idx_case_template_time` (`template_id`, `published_at`),
  KEY `idx_case_user_time` (`sp_user_id`, `published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_workflow_share` (
  `share_id` bigint NOT NULL AUTO_INCREMENT,
  `template_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL DEFAULT '0',
  `share_token` varchar(128) NOT NULL,
  `permission` varchar(32) NOT NULL DEFAULT 'run',
  `expires_at` datetime DEFAULT NULL,
  `visits` int NOT NULL DEFAULT '0',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`share_id`),
  UNIQUE KEY `uk_share_token` (`share_token`),
  KEY `idx_share_template` (`template_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_app_item` (
  `app_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL DEFAULT '1',
  `app_name` varchar(160) NOT NULL,
  `author_name` varchar(120) NOT NULL,
  `version` varchar(32) NOT NULL DEFAULT 'v1',
  `category_text` varchar(160) NOT NULL,
  `summary` varchar(500) NOT NULL DEFAULT '',
  `badge_text` varchar(16) NOT NULL DEFAULT '精',
  `cover_tone` varchar(32) NOT NULL DEFAULT 'dark',
  `favorite_count` int NOT NULL DEFAULT '0',
  `runtime_text` varchar(32) NOT NULL DEFAULT '0h',
  `download_count` int NOT NULL DEFAULT '0',
  `tags_json` json DEFAULT NULL,
  `is_base` smallint NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'published',
  `is_favorite` smallint NOT NULL DEFAULT '0',
  `last_used_at` datetime DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`app_id`),
  KEY `idx_app_user_status` (`sp_user_id`, `status`, `updated_at`),
  KEY `idx_app_user_favorite` (`sp_user_id`, `is_favorite`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_app_instance` (
  `instance_id` varchar(64) NOT NULL,
  `sp_user_id` int NOT NULL DEFAULT '1',
  `app_id` varchar(64) NOT NULL,
  `instance_name` varchar(160) NOT NULL,
  `gpu_model` varchar(120) NOT NULL,
  `region` varchar(64) NOT NULL,
  `gpu_count` int NOT NULL DEFAULT '1',
  `billing_mode` varchar(32) NOT NULL DEFAULT '按量计费',
  `status` varchar(32) NOT NULL DEFAULT 'pending',
  `status_text` varchar(32) NOT NULL DEFAULT '未开机',
  `price_text` varchar(64) NOT NULL DEFAULT '￥-.--/时',
  `system_disk_gb` int NOT NULL DEFAULT '30',
  `data_disk_gb` int NOT NULL DEFAULT '50',
  `month_runtime_text` varchar(32) NOT NULL DEFAULT '0h',
  `current_cost_text` varchar(64) NOT NULL DEFAULT '￥0.00',
  `service_json` json DEFAULT NULL,
  `metric_json` json DEFAULT NULL,
  `file_json` json DEFAULT NULL,
  `log_json` json DEFAULT NULL,
  `bill_json` json DEFAULT NULL,
  `event_json` json DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`instance_id`),
  KEY `idx_app_instance_user_status` (`sp_user_id`, `status`, `updated_at`),
  KEY `idx_app_instance_app` (`app_id`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_model_item` (
  `model_id` varchar(64) NOT NULL,
  `model_name` varchar(160) NOT NULL,
  `vendor` varchar(64) NOT NULL,
  `model_type` varchar(32) NOT NULL,
  `discount_text` varchar(64) NOT NULL DEFAULT '',
  `input_price` varchar(120) NOT NULL DEFAULT '',
  `output_price` varchar(120) NOT NULL DEFAULT '',
  `original_price` varchar(160) NOT NULL DEFAULT '',
  `summary` varchar(500) NOT NULL DEFAULT '',
  `tags_json` json DEFAULT NULL,
  `sort_no` int NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'online',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`model_id`),
  KEY `idx_model_vendor_type` (`vendor`, `model_type`, `status`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_image_item` (
  `image_id` varchar(64) NOT NULL,
  `author_name` varchar(120) NOT NULL,
  `updated_text` varchar(64) NOT NULL,
  `badge_text` varchar(16) NOT NULL DEFAULT '精',
  `image_name` varchar(200) NOT NULL,
  `runtime_rank_text` varchar(120) NOT NULL,
  `github_star_text` varchar(120) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `favorite_count` int NOT NULL DEFAULT '0',
  `runtime_text` varchar(64) NOT NULL,
  `download_count` int NOT NULL DEFAULT '0',
  `system_text` varchar(120) NOT NULL DEFAULT 'Ubuntu 22.04 / CUDA 11.8',
  `python_text` varchar(64) NOT NULL DEFAULT '3.10',
  `size_text` varchar(64) NOT NULL DEFAULT '24.6GB',
  `scenario_text` varchar(160) NOT NULL DEFAULT '',
  `tags_json` json DEFAULT NULL,
  `sort_no` int NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'online',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`image_id`),
  KEY `idx_image_status_sort` (`status`, `sort_no`, `updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_model_usage` (
  `usage_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL DEFAULT '1',
  `model_name` varchar(160) NOT NULL,
  `token_usage_text` varchar(64) NOT NULL,
  `cost_text` varchar(64) NOT NULL,
  `request_count` int NOT NULL DEFAULT '0',
  `success_rate` varchar(32) NOT NULL DEFAULT '99.90%',
  `stat_date` date NOT NULL,
  PRIMARY KEY (`usage_id`),
  KEY `idx_model_usage_user_date` (`sp_user_id`, `stat_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_api_token` (
  `token_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL DEFAULT '1',
  `token_name` varchar(120) NOT NULL,
  `token_mask` varchar(64) NOT NULL,
  `permission_scope` varchar(120) NOT NULL,
  `status` varchar(32) NOT NULL DEFAULT '启用',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`token_id`),
  UNIQUE KEY `uk_token_user_name` (`sp_user_id`, `token_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_model_setting` (
  `sp_user_id` int NOT NULL DEFAULT '1',
  `default_model` varchar(160) NOT NULL DEFAULT 'DeepSeek-V4-Pro',
  `daily_budget` varchar(64) NOT NULL DEFAULT '￥500.00 / 日',
  `concurrency_limit` varchar(64) NOT NULL DEFAULT '自动弹性',
  `callback_url` varchar(255) NOT NULL DEFAULT '',
  `daily_report` smallint NOT NULL DEFAULT '1',
  `auto_retry` smallint NOT NULL DEFAULT '1',
  `ip_whitelist` smallint NOT NULL DEFAULT '0',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`sp_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_message` (
  `message_id` bigint NOT NULL AUTO_INCREMENT,
  `sp_user_id` int NOT NULL DEFAULT '1',
  `message_type` varchar(32) NOT NULL,
  `type_text` varchar(64) NOT NULL,
  `title` varchar(160) NOT NULL,
  `content` varchar(500) NOT NULL,
  `read_status` varchar(32) NOT NULL DEFAULT '未读',
  `created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`message_id`),
  KEY `idx_message_user_type` (`sp_user_id`, `message_type`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_help_doc` (
  `doc_key` varchar(64) NOT NULL,
  `title` varchar(120) NOT NULL,
  `href` varchar(160) NOT NULL,
  `warning` varchar(255) NOT NULL,
  `intro` varchar(500) NOT NULL,
  `sections_json` json DEFAULT NULL,
  `code_text` text,
  `sort_no` int NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'online',
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`doc_key`),
  KEY `idx_help_doc_sort` (`status`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_public_data` (
  `data_id` varchar(64) NOT NULL,
  `data_name` varchar(160) NOT NULL,
  `mount_path` varchar(255) NOT NULL,
  `size_text` varchar(64) NOT NULL,
  `data_type` varchar(64) NOT NULL DEFAULT '数据集',
  `publisher` varchar(160) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `files_json` json DEFAULT NULL,
  `sort_no` int NOT NULL DEFAULT '0',
  `status` varchar(32) NOT NULL DEFAULT 'online',
  PRIMARY KEY (`data_id`),
  KEY `idx_public_data_sort` (`status`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `cd_shared_data` (
  `share_id` varchar(64) NOT NULL,
  `title` varchar(160) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `owner_name` varchar(120) NOT NULL,
  `favorite_count` int NOT NULL DEFAULT '0',
  `source_type` varchar(64) NOT NULL DEFAULT '百度网盘',
  `status` varchar(32) NOT NULL DEFAULT 'online',
  `sort_no` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`share_id`),
  KEY `idx_shared_data_sort` (`status`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
