export interface ApiEnvelope<T> {
  err_code?: number;
  data?: T;
  error?: string;
}

export interface GpuResource {
  id: string;
  region: string;
  machine: string;
  gpu_model: string;
  gpu_memory_gb: number;
  available: number;
  total: number;
  cpu: string;
  memory_gb: number;
  system_disk_gb: number;
  data_disk_gb: number;
  data_disk_expand_gb?: number;
  driver: string;
  cuda: string;
  hourly_price: number;
  original_hourly_price?: number;
  daily_price?: number;
  weekly_price?: number;
  monthly_price?: number;
  provider_hourly_cost?: number;
  provider_original_hourly_cost?: number;
  discount_label?: string;
  tags?: string[];
  region_sign?: string;
  provider: string;
  provider_mode: 'autodl_elastic' | 'autodl_pro' | 'self_pool' | 'third_party';
}

export interface ComputeInstance {
  id: string;
  displayId?: string;
  name: string;
  region: string;
  machine: string;
  status: string;
  instanceType?: 'task' | 'development';
  instanceTypeText?: string;
  gpu: string;
  health: string;
  billing: string;
  release_time: string;
  system_disk_usage: string;
  data_disk_usage: string;
  quick_tools: string[];
  serviceUrl?: string;
  service6006Url?: string;
  service6008Url?: string;
  sshCommand?: string;
  rootPassword?: string;
  providerDeploymentUuid?: string;
  providerContainerUuid?: string;
  providerProInstanceUuid?: string;
  provisionTaskId?: number;
  providerPricePerHour?: number;
  providerDataCenter?: string;
  rawStatus?: string;
}

export interface AppTemplate {
  id: string;
  name: string;
  description: string;
  image: string;
  gpu_hint: string;
}

export interface ComputePayload {
  generated_at_utc: string;
  provider: string;
  account_name: string;
  balance_cny: number;
  routes: string[];
  elasticRegions?: Array<{ name: string; dataCenter: string; alias?: string; recommended?: boolean }>;
  resources: GpuResource[];
  instances: ComputeInstance[];
  templates: AppTemplate[];
}
