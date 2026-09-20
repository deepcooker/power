import type { ApiEnvelope, ComputePayload } from './types';

type UserEnvelope<T> = {
  err_code: number;
  err_desc?: string;
  data: T;
};

export type AuthUser = {
  user_name: string;
  email: string;
  head_url?: string;
  last_login_time?: string;
};

export type WalletSummary = {
  balanceCny: number;
  frozenCny: number;
  computeCoin: number;
  monthExpenseCny: number;
  invoiceableCny: number;
};

export type WalletLedgerItem = {
  id: string;
  createdAt: string;
  incomeType: string;
  tradeType: string;
  channel: string;
  amountText: string;
  balanceText: string;
  note: string;
  bizType: string;
  bizId: string;
};

export type WalletBilling = {
  summary: WalletSummary;
  ledger: WalletLedgerItem[];
  orders: Array<{ orderNo: string; createdAt: string; orderType: string; status: string; amount: string; payChannel: string; action: string }>;
  detail: Array<{ billNo: string; product: string; target: string; spec: string; usage: string; amount: string; status: string }>;
  invoices: Array<{ invoiceNo: string; createdAt: string; type: string; content: string; amount: string; status: string; action: string }>;
  coupons: Array<{ couponNo: string; name: string; discount: string; scope: string; validUntil: string; status: string; action: string }>;
  contracts: Array<{ contractNo: string; createdAt: string; contractType: string; subject: string; amount: string; status: string; action: string }>;
};

export type AccountSecurityItem = {
  key: 'password' | 'phone' | 'realname' | 'wechat' | 'email';
  title: string;
  desc: string;
  status: string;
  action: string;
  ok: boolean;
};

export type AccountAccessItem = {
  createdAt: string;
  loginIp: string;
  loginRegion: string;
  loginMethod: string;
  status: string;
};

export type SubAccountItem = {
  id: number;
  accountName: string;
  roleName: string;
  permissionScope: string;
  status: string;
  createdAt: string;
  action: string;
};

export type AccountSetting = {
  messageNotify: boolean;
  defaultRegion: string;
  releaseReminder: boolean;
};

export type AccountProfile = {
  userId: number;
  userName: string;
  email: string;
  mobile: string;
  headUrl: string;
  nickName: string;
  status: number;
  lastLoginTime: string;
};

export type AppMineItem = {
  id: string;
  name: string;
  author: string;
  version: string;
  category: string;
  status: string;
  isFavorite: boolean;
  updatedAt: string;
  action: string;
};

export type AppMarketItem = {
  id: string;
  name: string;
  author: string;
  version: string;
  category: string;
  summary: string;
  badge: string;
  coverTone: string;
  favoriteCount: number;
  runtimeText: string;
  downloadCount: number;
  tags: string[];
  isBase: boolean;
  status: string;
  isFavorite: boolean;
  updatedAt: string;
};

export type AppDetail = AppMarketItem & {
  appKey: string;
  startCommand: string;
  serviceTips: string;
  docLines: string[];
  versions: string[][];
  reviews: string[][];
  services: string[][];
  auditChecks: string[][];
};

export type AppInstanceItem = {
  id: string;
  appId: string;
  appName: string;
  author: string;
  instanceName: string;
  gpuModel: string;
  region: string;
  gpuCount: number;
  gpuCountText: string;
  billingMode: string;
  instanceType: 'task' | 'development';
  status: string;
  statusText: string;
  priceText: string;
  systemDiskGb: number;
  dataDiskGb: number;
  monthRuntimeText: string;
  currentCostText: string;
  category: string;
  summary: string;
  version: string;
  appKey: string;
  startCommand: string;
  services: string[][];
  metrics: string[][];
  files: string[][];
  logs: string[];
  bills: string[][];
  events: string[][];
  createdAt: string;
  updatedAt: string;
};

export type ProviderDeploymentItem = {
  id: string;
  providerId: number;
  name: string;
  type: string;
  region: string;
  gpu: string;
  gpuCount: number;
  imageUuid: string;
  imageName: string;
  copies: number[];
  startingNum: number;
  runningNum: number;
  replicaNum: number;
  finishedNum: number;
  status: string;
  rawStatus: string;
  pack: string;
  currentCostText: string;
  created: string;
  updated: string;
  reuseContainer: boolean;
  serviceProtocol: string;
};

export type ProviderBindingItem = {
  id: number;
  productType: string;
  productId: string;
  provider: string;
  deploymentUuid: string;
  imageUuid: string;
  imageName: string;
  gpuNameSet: string[];
  regionSignList: string[];
  cmd: string;
  servicePorts: string[];
  billingMode: string;
  priceText: string;
  status: string;
  validation?: {
    ready: boolean;
    errors: string[];
    warnings: string[];
  };
  createdAt: string;
  updatedAt: string;
};

export type PricePolicyItem = {
  id: number;
  productType: string;
  productId: string;
  billingMode: string;
  baseCoin: number;
  qualityExtraCoin: number;
  durationExtraCoin: number;
  imageExtraCoin: number;
  priceText: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type ProvisionTaskItem = {
  id: number;
  taskNo: string;
  productType: string;
  productId: string;
  targetId: string;
  provider: string;
  deploymentUuid: string;
  imageUuid: string;
  imageName: string;
  status: string;
  billingMode: string;
  priceText: string;
  request: Record<string, unknown>;
  binding: Record<string, unknown>;
  policy: Record<string, unknown>;
  result: Record<string, unknown>;
  errMsg: string;
  createdAt: string;
  updatedAt: string;
};

export type ProviderContainerSnapshotItem = {
  productType: string;
  productId: string;
  deploymentUuid: string;
  imageName: string;
  total: number;
  running: number;
  starting: number;
  stopped: number;
};

export type ProviderTemplateCandidate = {
  deploymentUuid: string;
  deploymentName: string;
  imageUuid: string;
  imageName: string;
  gpuNameSet: string[];
  regionSignList: string[];
  cmd: string;
  servicePorts: string[];
  status: string;
  reuseContainer: boolean;
};

export type ProviderOverview = {
  provider: string;
  configured: boolean;
  tokenSource: string;
  bindingTotal: number;
  activeBindings: number;
  draftBindings: number;
  pricePolicyTotal: number;
  activePricePolicies: number;
  provisionTaskTotal: number;
  queuedProvisionTasks: number;
  dryRunProvisionTasks: number;
  failedProvisionTasks: number;
  deploymentTotal: number;
  imageTotal: number;
  runningDeployments: number;
};

export type ModelItem = {
  id: string;
  name: string;
  vendor: string;
  type: string;
  discount: string;
  inputPrice: string;
  outputPrice: string;
  originalPrice: string;
  summary: string;
  tags: string[];
  updatedAt: string;
  priceRows?: string[][];
  endpoint?: string;
};

export type ImageItem = {
  id: string;
  author: string;
  updatedText: string;
  badge: string;
  name: string;
  runtimeRankText: string;
  githubStarText: string;
  summary: string;
  favoriteCount: number;
  runtimeText: string;
  downloadCount: number;
  systemText: string;
  pythonText: string;
  sizeText: string;
  scenarioText: string;
  tags: string[];
  updatedAt: string;
  usageCommand?: string;
  related?: string[];
};

export type ModelDashboard = {
  stats: string[][];
  peak: { value: string; time: string; requestTotal: number };
  usageRows: string[][];
};

export type ApiTokenItem = {
  id: number;
  name: string;
  mask: string;
  scope: string;
  createdAt: string;
  status: string;
};

export type ModelSetting = {
  defaultModel: string;
  dailyBudget: string;
  concurrencyLimit: string;
  callbackUrl: string;
  dailyReport: boolean;
  autoRetry: boolean;
  ipWhitelist: boolean;
};

export type MessageItem = {
  id: number;
  type: string;
  typeText: string;
  title: string;
  content: string;
  readStatus: string;
  createdAt: string;
};

export type HelpDocItem = {
  key: string;
  title: string;
  href: string;
  warning: string;
  intro: string;
  sections: Array<[string, string[]]>;
  code: string;
};

export type PublicDataItem = {
  id: string;
  name: string;
  mountPath: string;
  sizeText: string;
  dataType: string;
  publisher: string;
  summary: string;
  files: string[][];
};

export type SharedDataItem = {
  id: string;
  title: string;
  summary: string;
  owner: string;
  favoriteCount: number;
  sourceType: string;
};

function authHeaders(): Record<string, string> {
  const token = window.localStorage.getItem('compute_user_token');
  return token ? { token } : {};
}

function apiUrl(url: string): string {
  if (url.startsWith('/api/') && window.location.pathname.startsWith('/compute')) {
    return `/compute${url}`;
  }
  return url;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(apiUrl(url), { cache: 'no-store', headers: authHeaders() });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = (await response.json()) as T & { err_code?: number; error?: string; err_desc?: string };
  if (typeof payload.err_code === 'number' && payload.err_code !== 0) {
    throw new Error(payload.error || payload.err_desc || `api err_code=${payload.err_code}`);
  }
  return payload;
}

async function postUser<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(apiUrl(url), {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  const payload = (await response.json()) as UserEnvelope<T>;
  if (payload.err_code !== 0) {
    throw new Error(payload.err_desc || `api err_code=${payload.err_code}`);
  }
  return payload.data;
}

export const api = {
  computeConsole: (sync = false) => getJson<ApiEnvelope<ComputePayload>>(`/api/compute/autodl/console${sync ? '?sync=1' : ''}`),
  user: {
    login: (user_name: string, pwd: string) => postUser<{ token: string }>('/api/user/login/', { user_name: user_name.trim(), pwd }),
    register: (payload: { user_name: string; pwd: string; email?: string; verification_code?: string; sp_id?: number }) =>
      postUser<{ token: string }>('/api/user/register/', { email: '', verification_code: '', sp_id: 0, ...payload }),
    logout: (token: string) => postUser<Record<string, never>>('/api/user/logout/', { token }),
    sendCode: (email: string) => postUser<Record<string, never>>('/api/user/send_verification_code/', { email }),
    info: (token: string) => getJson<UserEnvelope<AuthUser>>(`/api/user/getuserinfo/?token=${encodeURIComponent(token)}`),
  },
  wallet: {
    summary: () => getJson<UserEnvelope<WalletSummary>>('/api/wallet/summary'),
    ledger: () => getJson<UserEnvelope<{ items: WalletLedgerItem[] }>>('/api/wallet/ledger'),
    billing: () => getJson<UserEnvelope<WalletBilling>>('/api/wallet/app-billing'),
    recharge: (amount: number, payChannel: string) => postUser<{ orderNo: string; status: string; summary: WalletSummary }>('/api/wallet/recharge', { amount, payChannel }),
    invoice: (payload: { amount: number; invoiceType: string; title: string; content: string; email: string }) =>
      postUser<{ invoiceNo: string; status: string }>('/api/wallet/invoices', payload),
    contract: (payload: { contractType: string; subject: string; amount: number; email: string }) =>
      postUser<{ contractNo: string; status: string }>('/api/wallet/contracts', payload),
  },
  account: {
    security: () => getJson<UserEnvelope<{ items: AccountSecurityItem[]; profile: AccountProfile }>>('/api/account/security'),
    profile: () => getJson<UserEnvelope<AccountProfile>>('/api/account/profile'),
    access: () => getJson<UserEnvelope<{ items: AccountAccessItem[] }>>('/api/account/access'),
    subAccounts: () => getJson<UserEnvelope<{ items: SubAccountItem[] }>>('/api/account/sub-accounts'),
    createSubAccount: (payload: { accountName: string; roleName: string; permissionScope: string; status: string }) =>
      postUser<{ items: SubAccountItem[] }>('/api/account/sub-accounts', payload),
    settings: () => getJson<UserEnvelope<AccountSetting>>('/api/account/settings'),
    updateSettings: (payload: AccountSetting) =>
      fetch(apiUrl('/api/account/settings'), {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = (await response.json()) as UserEnvelope<AccountSetting>;
        if (result.err_code !== 0) throw new Error(result.err_desc || `api err_code=${result.err_code}`);
        return result.data;
      }),
  },
  apps: {
    mine: (tab: 'mine' | 'favorites' | 'recent' | 'drafts') =>
      getJson<UserEnvelope<{ items: AppMineItem[]; summary: Record<string, number> }>>(`/api/apps/mine?tab=${encodeURIComponent(tab)}`),
    market: (params: { section?: 'all' | 'weekly' | 'base'; q?: string; tag?: string } = {}) => {
      const search = new URLSearchParams();
      if (params.section) search.set('section', params.section);
      if (params.q) search.set('q', params.q);
      if (params.tag) search.set('tag', params.tag);
      return getJson<UserEnvelope<{ items: AppMarketItem[]; summary: Record<string, number> }>>(`/api/apps/market?${search.toString()}`);
    },
    detail: (appId: string) => getJson<UserEnvelope<AppDetail>>(`/api/apps/${encodeURIComponent(appId)}`),
    create: (payload: { name: string; author: string; summary: string; category: string; tags: string[]; version: string; status: string }) =>
      postUser<AppDetail>('/api/apps', payload),
    update: (appId: string, payload: { name: string; summary: string; category: string; tags: string[] }) =>
      fetch(apiUrl(`/api/apps/${encodeURIComponent(appId)}`), {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = (await response.json()) as UserEnvelope<AppDetail>;
        if (result.err_code !== 0) throw new Error(result.err_desc || `api err_code=${result.err_code}`);
        return result.data;
      }),
    publishVersion: (appId: string, payload: { version: string; note: string }) =>
      postUser<AppDetail>(`/api/apps/${encodeURIComponent(appId)}/version`, payload),
  },
  appInstances: {
    list: (status: 'all' | 'running' | 'pending' | 'stopped' = 'all') =>
      getJson<UserEnvelope<{ items: AppInstanceItem[]; summary: Record<string, number> }>>(`/api/app-instances?status=${encodeURIComponent(status)}`),
    detail: (instanceId: string) => getJson<UserEnvelope<AppInstanceItem>>(`/api/app-instances/${encodeURIComponent(instanceId)}`),
    create: (payload: { appId: string; instanceName: string; gpuModel: string; region: string; gpuCount: number; billingMode: string; boot: boolean; instanceType?: 'task' | 'development' }) =>
      postUser<AppInstanceItem>('/api/app-instances', payload),
    action: (instanceId: string, payload: { action: string; instanceName?: string }) =>
      fetch(apiUrl(`/api/app-instances/${encodeURIComponent(instanceId)}/action`), {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = (await response.json()) as UserEnvelope<AppInstanceItem | { deleted: boolean; id: string }>;
        if (result.err_code !== 0) throw new Error(result.err_desc || `api err_code=${result.err_code}`);
        return result.data;
      }),
    batchAction: (payload: { action: string; ids: string[] }) =>
      postUser<{ items: Array<{ id: string; appName?: string; status: string; result: string }>; summary: Record<string, number> }>('/api/app-instances/batch-action', payload),
  },
  provider: {
    gpuStock: (regionSign: string, gpuName = '') =>
      getJson<UserEnvelope<{ regionSign: string; regionName: string; gpuName?: string; stock?: { idle_gpu_num?: number; total_gpu_num?: number; chip_corp?: string; cpu_arch?: string }; items?: Array<{ gpuName: string; available: number; total: number; chipCorp?: string; cpuArch?: string }>; cacheTtlSeconds: number }>>(`/api/provider/autodl/gpu-stock?region_sign=${encodeURIComponent(regionSign)}${gpuName ? `&gpu_name=${encodeURIComponent(gpuName)}` : ''}`),
    overview: () => getJson<UserEnvelope<ProviderOverview>>('/api/admin/provider/overview'),
    deployments: (pageSize = 20) =>
      getJson<UserEnvelope<{ items: ProviderDeploymentItem[]; summary: Record<string, number>; page: Record<string, number> }>>(`/api/provider/autodl/deployments/normalized?page_size=${pageSize}`),
    bindings: () => getJson<UserEnvelope<{ items: ProviderBindingItem[] }>>('/api/provider/bindings'),
    templateCandidates: () => getJson<UserEnvelope<{ items: ProviderTemplateCandidate[]; summary: Record<string, number> }>>('/api/provider/autodl/template-candidates?page_size=50'),
    saveBinding: (payload: Omit<ProviderBindingItem, 'id' | 'createdAt' | 'updatedAt'>) => postUser<ProviderBindingItem>('/api/provider/bindings', payload),
    createTestTask: (bindingId: number) => postUser<ProvisionTaskItem>(`/api/provider/bindings/${bindingId}/create-test-task`, {}),
    deleteBinding: (bindingId: number) =>
      fetch(apiUrl(`/api/provider/bindings/${bindingId}`), { method: 'DELETE', cache: 'no-store', headers: authHeaders() }).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = (await response.json()) as UserEnvelope<{ deleted: boolean; id: number }>;
        if (result.err_code !== 0) throw new Error(result.err_desc || `api err_code=${result.err_code}`);
        return result.data;
      }),
  },
  pricing: {
    policies: () => getJson<UserEnvelope<{ items: PricePolicyItem[] }>>('/api/admin/price-policies'),
    savePolicy: (payload: Omit<PricePolicyItem, 'id' | 'createdAt' | 'updatedAt'>) => postUser<PricePolicyItem>('/api/admin/price-policies', payload),
    deletePolicy: (policyId: number) =>
      fetch(apiUrl(`/api/admin/price-policies/${policyId}`), { method: 'DELETE', cache: 'no-store', headers: authHeaders() }).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = (await response.json()) as UserEnvelope<{ deleted: boolean; id: number }>;
        if (result.err_code !== 0) throw new Error(result.err_desc || `api err_code=${result.err_code}`);
        return result.data;
      }),
  },
  provision: {
    tasks: () => getJson<UserEnvelope<{ items: ProvisionTaskItem[] }>>('/api/admin/provision-tasks?limit=50'),
    previewTask: (taskId: number) => getJson<UserEnvelope<{ task: ProvisionTaskItem; ready: boolean; reason?: string; action: string; payload?: Record<string, unknown>; dryRun?: boolean }>>(`/api/admin/provision-tasks/${taskId}/preview`),
    executeTask: (taskId: number) => postUser<ProvisionTaskItem>(`/api/admin/provision-tasks/${taskId}/execute`, {}),
    syncTask: (taskId: number) => postUser<ProvisionTaskItem>(`/api/admin/provision-tasks/${taskId}/sync`, {}),
    executeQueued: () => postUser<{ items: ProvisionTaskItem[]; summary: Record<string, number> }>('/api/admin/provision-tasks/execute-queued?limit=20', {}),
    refreshBindings: () => postUser<{ items: ProvisionTaskItem[]; summary: Record<string, number> }>('/api/admin/provision-tasks/refresh-bindings?limit=100', {}),
    syncSubmitted: () => postUser<{ items: ProvisionTaskItem[]; summary: Record<string, number> }>('/api/admin/provision-tasks/sync-submitted?limit=50', {}),
    containerSnapshot: () => getJson<UserEnvelope<{ items: ProviderContainerSnapshotItem[]; errors: Array<{ deploymentUuid: string; errMsg: string }>; summary: Record<string, number> }>>('/api/admin/provider/container-snapshot'),
  },
  models: {
    list: () => getJson<UserEnvelope<{ items: ModelItem[]; summary: Record<string, number> }>>('/api/models'),
    detail: (modelId: string) => getJson<UserEnvelope<ModelItem>>(`/api/models/${encodeURIComponent(modelId)}`),
  },
  images: {
    list: () => getJson<UserEnvelope<{ items: ImageItem[]; hot: ImageItem[]; summary: Record<string, number> }>>('/api/images'),
    detail: (imageId: string) => getJson<UserEnvelope<ImageItem>>(`/api/images/${encodeURIComponent(imageId)}`),
  },
  modelAdmin: {
    dashboard: () => getJson<UserEnvelope<ModelDashboard>>('/api/model-admin/dashboard'),
    tokens: () => getJson<UserEnvelope<{ items: ApiTokenItem[]; summary: Record<string, number> }>>('/api/model-admin/tokens'),
    createToken: (payload: { tokenName: string; permissionScope: string; dailyQuota: string }) =>
      postUser<{ items: ApiTokenItem[] }>('/api/model-admin/tokens', payload),
    settings: () => getJson<UserEnvelope<ModelSetting>>('/api/model-admin/settings'),
    updateSettings: (payload: ModelSetting) =>
      fetch(apiUrl('/api/model-admin/settings'), {
        method: 'PATCH',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(async (response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        const result = (await response.json()) as UserEnvelope<ModelSetting>;
        if (result.err_code !== 0) throw new Error(result.err_desc || `api err_code=${result.err_code}`);
        return result.data;
      }),
  },
  messages: {
    list: (messageType = '') => getJson<UserEnvelope<{ items: MessageItem[]; summary: Record<string, number> }>>(`/api/messages${messageType ? `?message_type=${encodeURIComponent(messageType)}` : ''}`),
    readAll: () => postUser<{ items: MessageItem[]; summary: Record<string, number> }>('/api/messages/read-all', {}),
  },
  docs: {
    list: () => getJson<UserEnvelope<{ items: HelpDocItem[] }>>('/api/docs'),
    detail: (docKey: string) => getJson<UserEnvelope<HelpDocItem>>(`/api/docs/${encodeURIComponent(docKey)}`),
  },
  publicData: {
    list: () => getJson<UserEnvelope<{ items: PublicDataItem[]; summary: Record<string, number> }>>('/api/public-data'),
    detail: (dataId: string) => getJson<UserEnvelope<PublicDataItem>>(`/api/public-data/${encodeURIComponent(dataId)}`),
  },
  sharedData: {
    list: () => getJson<UserEnvelope<{ items: SharedDataItem[]; summary: Record<string, number> }>>('/api/shared-data'),
  },
};
