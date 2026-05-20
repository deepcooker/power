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
  discount_label?: string;
  tags?: string[];
  provider: string;
  provider_mode: 'autodl_elastic' | 'self_pool' | 'third_party';
}

export interface ComputeInstance {
  id: string;
  name: string;
  region: string;
  machine: string;
  status: string;
  gpu: string;
  health: string;
  billing: string;
  release_time: string;
  system_disk_usage: string;
  data_disk_usage: string;
  quick_tools: string[];
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
  resources: GpuResource[];
  instances: ComputeInstance[];
  templates: AppTemplate[];
}
