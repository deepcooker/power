import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api';
import type { AccountAccessItem, AccountProfile, AccountSecurityItem, AccountSetting, ApiTokenItem, AppDetail, AppInstanceItem, AppMarketItem, AppMineItem, AuthUser, HelpDocItem, ImageItem, MessageItem, ModelDashboard, ModelItem, ModelSetting, PricePolicyItem, ProviderBindingItem, ProviderContainerSnapshotItem, ProviderDeploymentItem, ProviderOverview, ProviderTemplateCandidate, ProvisionTaskItem, PublicDataItem, SharedDataItem, SubAccountItem, WalletBilling, WalletSummary } from './api';
import { createWorkflowRun, estimateWorkflowCost, workflowApi, workflowRunRecords, workflowTemplates } from './workflowApi';
import type { WorkflowCase, WorkflowCostEstimate, WorkflowMineItem, WorkflowMineSummary, WorkflowPublishResult, WorkflowRunPayload, WorkflowRunRecord, WorkflowShareResult, WorkflowTemplate, WorkflowVersion } from './workflowApi';
import type { ComputeInstance, ComputePayload, GpuResource } from './types';
import type { ReactNode } from 'react';
import './styles.css';
import { EndpointsPage } from './EndpointsPage';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const billingModes = ['按量计费', '包日', '包周', '包月'];
const regionLineOne = ['西北B区', '北京B区', '重庆A区', '内蒙B区', '北京A区', '佛山区', '西北企业区'];
const regionLineTwo = ['V100专区', 'A800专区', '摩尔线程专区', '华为昇腾专区', 'L20专区'];
const autodlElasticRegions = [
  { region: '西北企业区', region_sign: 'westDC2', machine: '弹性资源池' },
  { region: '西北B区', region_sign: 'westDC3', machine: '弹性资源池' },
  { region: '北京A区', region_sign: 'beijingDC1', machine: '弹性资源池' },
  { region: '北京B区', region_sign: 'beijingDC2', machine: '弹性资源池' },
  { region: 'L20专区', region_sign: 'beijingDC4', machine: '原北京C区' },
  { region: 'V100专区', region_sign: 'beijingDC3', machine: '原华南A区' },
  { region: '佛山区', region_sign: 'foshanDC1', machine: '弹性资源池' },
  { region: '重庆A区', region_sign: 'chongqingDC1', machine: '弹性资源池' },
  { region: '3090专区', region_sign: 'yangzhouDC1', machine: '弹性资源池' },
  { region: '内蒙B区', region_sign: 'neimengDC3', machine: '弹性资源池' },
];
type StockCacheItem = { at: number; models: Array<{ gpuName: string; available: number; total: number; chipCorp?: string; cpuArch?: string }> };
const stockFetchCache = new Map<string, StockCacheItem>();
const gpuOptions = [
  '全部',
  'RTX 5090 (256/1768)',
  'RTX PRO 6000 (460/1580)',
  'vGPU-32GB (152/1898)',
  'vGPU-48GB (41/842)',
  'H800 (9/96)',
  'RTX 4090D (0/1168)',
  'RTX 4090 (0/1873)',
  'RTX 3090 (0/210)',
  'RTX 3080x2 (0/348)',
  'RTX 3080 Ti (0/380)',
  'RTX A4000 (0/24)',
  'RTX 3060 (0/32)',
  'GTX 1080 Ti (0/14)',
  'CPU (0/328)',
  'CPU-close-HT (0/6)',
  'vGPU-48GB-350W (14/152)',
];
const gpuCounts = [1, 2, 3, 4, 5, 6, 7, 8, 10, 12];
const deploymentRows = [
  { id: '0f11ed8da8', name: '日本人机交互', type: 'ReplicaSet', region: '北京B区,北京A区', gpu: 'RTX 3090', copies: ['0', '0', '2', '0'], pack: '未购买', status: '部署中', created: '2025-07-22\n13:40:25' },
  { id: '8789eba0ef', name: 'metahuman', type: 'ReplicaSet', region: '西北企业区', gpu: 'RTX 3080x2', copies: ['0', '0', '1', '0'], pack: '未购买', status: '部署中', created: '2025-07-18\n14:43:19' },
  { id: '4d094922ed', name: 'genavatar-cuda11.3-0410', type: 'ReplicaSet', region: '西北企业区', gpu: 'RTX 3090,RTX 3080x2', copies: ['0', '0', '6136', '0'], pack: '未购买', status: '部署中', created: '2025-04-10\n13:30:16' },
  { id: '322b0c8c78', name: '日本说话', type: 'ReplicaSet', region: '北京B区,北京A区', gpu: 'RTX 3080', copies: ['0', '0', '20', '1'], pack: '未购买', status: '停止', created: '2025-04-01\n11:24:50' },
  { id: '3ae95162bf', name: '说话视频生成', type: 'ReplicaSet', region: '西北企业区', gpu: 'RTX 4090D', copies: ['0', '0', '1850', '0'], pack: '未购买', status: '部署中', created: '2024-12-25\n11:12:57' },
  { id: 'edbb3ea075', name: 'vc-train', type: 'ReplicaSet', region: '重庆A区', gpu: 'RTX 2080 Ti x2', copies: ['0', '0', '77522', '0'], pack: '未购买', status: '部署中', created: '2024-10-21\n13:57:56' },
  { id: '6c06dea33c', name: '素材清洗-OCR', type: 'ReplicaSet', region: '西北企业区', gpu: 'RTX 3080x2', copies: ['0', '0', '1258', '0'], pack: 'RTX 3080x2：剩29分\n查看使用详情', status: '部署中', created: '2024-09-12\n10:02:12' },
];
const workflowCoverClass: Record<string, string> = {
  'workflow-ltx-video': 'video',
  'workflow-wan-video': 'cinema',
  'workflow-product-video': 'product',
  'workflow-avatar': 'avatar',
  'workflow-cyber-style': 'cyber',
  'workflow-comic-storyboard': 'comic',
};
function workflowCoverKey(cover: string) {
  const fileName = cover.split('/').pop()?.replace(/\.(png|jpg|jpeg|webp)$/i, '') ?? cover;
  return fileName;
}
function workflowCoverClassName(cover: string) {
  return workflowCoverClass[workflowCoverKey(cover)] ?? 'video';
}
function workflowTemplateToCard(item: WorkflowTemplate) {
  return [
  item.id,
  item.title,
  item.summary,
  item.category,
  item.runCount,
  item.priceText,
  workflowCoverClassName(item.cover),
  item.tags[0] ?? '精选',
  ];
}
function workflowTemplateToMineRow(item: WorkflowTemplate, index: number) {
  const states = ['已发布', '草稿', '审核中', '已发布', '已发布', '草稿'];
  const versions = ['v1.8', 'v0.3', 'v1.1', 'v2.0', 'v1.4', 'v0.8'];
  return [item.id, item.title, states[index % states.length], versions[index % versions.length], item.runCount, item.priceText, workflowCoverClassName(item.cover)];
}
function workflowMineToRow(item: WorkflowMineItem) {
  return [item.id, item.title, item.status, item.version, item.runCount, item.priceText, workflowCoverClassName(item.cover), item.auditNote];
}
const workflowShowcase = [
  ['城市雨夜追光', '文生视频', '00:08', 'cinema'],
  ['香水瓶旋转展示', '商品营销', '00:05', 'product'],
  ['机甲少女回眸', '图生视频', '00:06', 'cyber'],
  ['水墨山海漫游', '风格化', '4 张', 'comic'],
  ['主播口播开场', '数字人', '00:12', 'avatar'],
  ['潮玩盲盒海报', '文生图', '1 张', 'video'],
];
function workflowRunCover(run: WorkflowRunRecord, templates = workflowTemplates) {
  const template = templates.find((item) => item.id === run.templateId);
  return workflowCoverClassName(template?.cover ?? '');
}
function workflowIdFromPath() {
  const match = window.location.pathname.match(/^\/compute\/workflows\/([^/]+)/);
  return match?.[1] ?? 'ltx-video';
}
function appInstanceIdFromPath() {
  const match = window.location.pathname.match(/^\/compute\/app\/instances\/(?:detail|workspace)\/([^/]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : 'ins-art-zimage-20260518';
}
function useWorkflowTemplates() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>(workflowTemplates);
  useEffect(() => {
    let alive = true;
    workflowApi.templates().then(({ items }) => {
      if (alive && items.length > 0) {
        setTemplates(items);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return templates;
}
function useWorkflowTemplateDetail(templateId: string, templates: WorkflowTemplate[]) {
  const fallback = templates.find((item) => item.id === templateId) ?? workflowTemplates[0];
  const [template, setTemplate] = useState<WorkflowTemplate>(fallback);
  const [related, setRelated] = useState<WorkflowTemplate[]>(() => templates.filter((item) => item.id !== fallback.id).slice(0, 3));
  useEffect(() => {
    setTemplate(fallback);
    setRelated(templates.filter((item) => item.id !== fallback.id).slice(0, 3));
  }, [fallback, templates]);
  useEffect(() => {
    let alive = true;
    workflowApi.template(templateId).then(({ item, related: nextRelated }) => {
      if (alive) {
        setTemplate(item);
        setRelated(nextRelated.length > 0 ? nextRelated : templates.filter((entry) => entry.id !== item.id).slice(0, 3));
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [templateId, templates]);
  return { template, related };
}
const imageRows = [
  { uuid: 'image-e55db9ae41', name: 'new0415', size: '20.78GB', status: '就绪', share: '私有镜像', source: '灵渠', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-04-15 13:30:50' },
  { uuid: 'image-ef24180470', name: 'policy2026', size: '14.97GB', status: '就绪', share: '私有镜像', source: '灵渠', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-01-17 01:11:09' },
  { uuid: 'image-e76f008b92', name: 'policy_2016', size: '20.24GB', status: '就绪', share: '私有镜像', source: '灵渠', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-01-15 14:20:28' },
  { uuid: 'image-08c61e993b', name: 'newpolicy', size: '25.63GB', status: '就绪', share: '私有镜像', source: '灵渠', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-01-04 21:44:26' },
  { uuid: 'image-83271d99d1', name: 'policy', size: '24.14GB', status: '就绪', share: '私有镜像', source: '灵渠', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2025-11-21 09:04:47' },
];
const publicDataRows = [
  ['argoverse2.0感知数据集', '/root/lingqu-pub/argoverse2.0-sensor', '739.02 GB', '数据集', 'https://argoverse.github.io', 'https://argoverse.github.io/user-guide/'],
  ['Vimeo-90k', '/root/lingqu-pub/Vimeo-90k', '81.89 GB', '数据集', 'toflow.csail.mit.edu', 'Vimeo-90k视频超分数据集'],
  ['CULane', '/root/lingqu-pub/CULane', '42.45 GB', '数据集', 'https://xingangpan.github.io/projects/CULane.html', 'CULane is a large scale challenging dataset for academic research on traffic lane detection'],
  ['TT100K', '/root/lingqu-pub/TT100K', '106.77 GB', '数据集', 'https://cg.cs.tsinghua.edu.cn/traffic-sign/', '交通信号灯检测与识别数据集'],
  ['cifar-100', '/root/lingqu-pub/cifar-100', '162 MB', '数据集', 'https://www.cs.toronto.edu/~kriz/cifar.html', 'CIFAR-100图像分类数据集'],
  ['CUB200-2011', '/root/lingqu-pub/CUB200-2011', '1.11 GB', '数据集', 'http://www.vision.caltech.edu/datasets/cub_200_2011/', '鸟类细粒度分类数据集'],
  ['ModelNet', '/root/lingqu-pub/ModelNet', '2.34 GB', '数据集', 'https://modelnet.cs.princeton.edu/', 'The goal of the Princeton ModelNet project is to provide researchers in computer vision, computer graphics, robotics and cognitive science, with a comprehensive clean collection of 3D CAD models for objects.'],
  ['S3DIS', '/root/lingqu-pub/S3DIS', '14.26 GB', '数据集', 'http://buildingparser.stanford.edu/dataset.html', 'Stanford Large-Scale 3D Indoor Spaces Dataset (S3DIS)'],
];

function App() {
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [data, setData] = useState<ComputePayload>();
  const [region, setRegion] = useState('西北B区');
  const [gpu, setGpu] = useState('');
  const currentPath = window.location.pathname.replace(/\/$/, '');
  const isHomePage = currentPath === '/compute/home';
  const isEndpointsPage = currentPath === '/compute/endpoints';
  const isWorkflowRunsPage = currentPath === '/compute/workflow-runs';
  const isMyWorkflowsPage = currentPath === '/compute/workflows/mine';
  const isWorkflowRunPage = /^\/compute\/workflows\/[^/]+\/run$/.test(currentPath);
  const isWorkflowDetailPage = /^\/compute\/workflows\/[^/]+$/.test(currentPath) && currentPath !== '/compute/workflows/mine';
  const isWorkflowsPage = currentPath === '/compute/workflows';
  const isArtMarketPage = currentPath === '/compute/app/market' || currentPath === '/compute/art-market' || currentPath.startsWith('/compute/app/market/');
  const isArtSectionPage = currentPath.startsWith('/compute/app/') || currentPath.startsWith('/compute/art/');
  const isRentPage = currentPath === '/compute/rent';
  const isDashboardPage = currentPath === '/compute/dashboard';
  const isInstanceWorkspacePage = currentPath === '/compute/instances/workspace';
  const isInstanceDetailPage = currentPath === '/compute/instances/detail';
  const isInstancesPage = currentPath === '/compute/instances';
  const isInstancesProPage = currentPath === '/compute/instances-pro';
  const isFileStorePage = currentPath === '/compute/file-store';
  const isFastFileStorePage = currentPath === '/compute/fast-file-store';
  const isNetdiskPage = currentPath === '/compute/netdisk';
  const isImageDetailPage = currentPath === '/compute/images/detail';
  const isImagesPage = currentPath === '/compute/images';
  const isPublicDataDetailPage = currentPath === '/compute/public-data/detail';
  const isPublicDataPage = currentPath === '/compute/public-data';
  const isBillingPage = currentPath === '/compute/billing';
  const isOrdersPage = currentPath === '/compute/billing/orders';
  const isBillDetailPage = currentPath === '/compute/billing/detail';
  const isCouponsPage = currentPath === '/compute/billing/coupons';
  const isInvoicesPage = currentPath === '/compute/billing/invoices';
  const isContractsPage = currentPath === '/compute/billing/contracts';
  const isAccountPage = currentPath === '/compute/account/security';
  const isAccessPage = currentPath === '/compute/account/access';
  const isSubAccountPage = currentPath === '/compute/account/sub-accounts';
  const isSettingsPage = currentPath === '/compute/account/settings';
  const isServersPage = currentPath === '/compute/servers';
  const isDocsPage = currentPath === '/compute/docs' || currentPath.startsWith('/compute/docs/');
  const isApiDeployPage = currentPath === '/compute/api-deploy';
  const isSharedDataPage = currentPath === '/compute/shared-data';
  const isAdminPage = currentPath === '/compute/admin' || currentPath.startsWith('/compute/admin/');
  const isDurationPacksPage = currentPath === '/compute/deployments/packs';
  const isDeploymentsPage = currentPath === '/compute/deployments';
  const isDeploymentCreatePage = currentPath === '/compute/deployments/create';
  const isDeploymentContainersPage = currentPath === '/compute/deployments/containers';
  const isDeploymentBlacklistPage = currentPath === '/compute/deployments/blacklist';
  const isAuthPage = currentPath === '/compute/art/login' || currentPath === '/compute/art/register';
  const needsLogin = !isAuthPage && (
    currentPath === '/compute/rent' ||
    currentPath === '/compute/dashboard' ||
    currentPath.startsWith('/compute/instances') ||
    currentPath.startsWith('/compute/deployments') ||
    currentPath.startsWith('/compute/file-store') ||
    currentPath.startsWith('/compute/fast-file-store') ||
    currentPath.startsWith('/compute/netdisk') ||
    currentPath.startsWith('/compute/billing') ||
    currentPath.startsWith('/compute/account') ||
    currentPath.startsWith('/compute/app/mine') ||
    currentPath.startsWith('/compute/app/instances') ||
    currentPath.startsWith('/compute/app/billing') ||
    currentPath.startsWith('/compute/app/create') ||
    currentPath.startsWith('/compute/art/dashboard') ||
    currentPath.startsWith('/compute/art/tokens') ||
    currentPath.startsWith('/compute/art/settings') ||
    currentPath.startsWith('/compute/art/messages') ||
    currentPath.startsWith('/compute/art/profile') ||
    currentPath.startsWith('/compute/art/incentive') ||
    currentPath.startsWith('/compute/workflows/mine') ||
    currentPath === '/compute/workflow-runs'
  );

  if (needsLogin && !window.localStorage.getItem('compute_user_token')) {
    window.location.href = `/compute/art/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    return <main className="docs-page"><p>正在跳转登录...</p></main>;
  }

  const reload = async (sync = false) => {
    setState('loading');
    setError('');
    try {
      const payload = await api.computeConsole(sync);
      setData(payload.data);
      setState('ready');
    } catch (err) {
      setError(String(err));
      setState('error');
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const visibleResources = useMemo(() => {
    const rows = data?.resources ?? [];
    const filtered = rows.filter((item) => {
      const regionOk = region ? item.region === region : true;
      const gpuOk = gpu ? item.gpu_model.includes(gpu) : true;
      return regionOk && gpuOk;
    });
    return [...(filtered.length ? filtered : rows)].sort((a, b) => resourceRank(a) - resourceRank(b));
  }, [data, gpu, region]);

  if (isHomePage) {
    return <Shell data={data}><HomePage /></Shell>;
  }

  if (isEndpointsPage) {
    return <EndpointsPage />;
  }

  if (isWorkflowRunsPage) {
    return <Shell data={data}><WorkflowRunsPage /></Shell>;
  }

  if (isMyWorkflowsPage) {
    return <Shell data={data}><MyWorkflowsPage /></Shell>;
  }

  if (isWorkflowRunPage) {
    return <Shell data={data}><WorkflowRunPage /></Shell>;
  }

  if (isWorkflowDetailPage) {
    return <Shell data={data}><WorkflowDetailPage /></Shell>;
  }

  if (isWorkflowsPage) {
    return <Shell data={data}><WorkflowsPage /></Shell>;
  }

  if (isArtMarketPage) {
    return <ArtMarketPage />;
  }

  if (isArtSectionPage) {
    return <ArtSectionPage />;
  }

  if (isRentPage) {
    return <Shell data={data}><RentPage data={data} /></Shell>;
  }

  if (isDashboardPage) {
    return <Shell data={data}><DashboardPage data={data} /></Shell>;
  }

  if (isInstanceWorkspacePage) {
    return <Shell data={data}><ComputeInstanceWorkspacePage data={data} /></Shell>;
  }

  if (isInstanceDetailPage) {
    return <Shell data={data}><ComputeInstanceDetailPage data={data} /></Shell>;
  }

  if (isInstancesPage) {
    return <Shell data={data}><InstancesPage data={data} onRefresh={() => reload(true)} /></Shell>;
  }

  if (isInstancesProPage) {
    return <Shell data={data}><InstancesProPage /></Shell>;
  }

  if (isFileStorePage) {
    return <Shell data={data}><FileStorePage /></Shell>;
  }

  if (isFastFileStorePage) {
    return <Shell data={data}><FastFileStorePage /></Shell>;
  }

  if (isNetdiskPage) {
    return <Shell data={data}><NetdiskPage /></Shell>;
  }

  if (isPublicDataDetailPage) {
    return <Shell data={data}><PublicDataDetailPage /></Shell>;
  }

  if (isPublicDataPage) {
    return <Shell data={data}><PublicDataPage /></Shell>;
  }

  if (isImageDetailPage) {
    return <Shell data={data}><ComputeImageDetailPage /></Shell>;
  }

  if (isImagesPage) {
    return <Shell data={data}><ImagesPage /></Shell>;
  }

  if (isBillingPage) {
    return <Shell data={data}><BillingPage /></Shell>;
  }

  if (isOrdersPage) {
    return <Shell data={data}><BillingSubPage kind="orders" /></Shell>;
  }

  if (isBillDetailPage) {
    return <Shell data={data}><BillingSubPage kind="detail" /></Shell>;
  }

  if (isCouponsPage) {
    return <Shell data={data}><BillingSubPage kind="coupons" /></Shell>;
  }

  if (isInvoicesPage) {
    return <Shell data={data}><BillingSubPage kind="invoices" /></Shell>;
  }

  if (isContractsPage) {
    return <Shell data={data}><BillingSubPage kind="contracts" /></Shell>;
  }

  if (isAccountPage) {
    return <Shell data={data}><AccountSecurityPage /></Shell>;
  }

  if (isAccessPage) {
    return <Shell data={data}><AccountSubPage kind="access" /></Shell>;
  }

  if (isSubAccountPage) {
    return <Shell data={data}><AccountSubPage kind="sub" /></Shell>;
  }

  if (isSettingsPage) {
    return <Shell data={data}><AccountSubPage kind="settings" /></Shell>;
  }

  if (isServersPage) {
    return <Shell data={data}><ServersPage /></Shell>;
  }

  if (isAdminPage) {
    return <Shell data={data}><AdminPage /></Shell>;
  }

  if (isDocsPage) {
    return <DocsPage />;
  }

  if (isApiDeployPage) {
    return <Shell data={data}><ApiDeployPage /></Shell>;
  }

  if (isSharedDataPage) {
    return <Shell data={data}><SharedDataPage /></Shell>;
  }

  if (isDeploymentsPage) {
    return <Shell data={data}><DeploymentsPage /></Shell>;
  }

  if (isDeploymentCreatePage) {
    return <Shell data={data}><DeploymentCreatePage /></Shell>;
  }

  if (isDeploymentContainersPage) {
    return <Shell data={data}><DeploymentContainersPage /></Shell>;
  }

  if (isDeploymentBlacklistPage) {
    return <Shell data={data}><DeploymentBlacklistPage /></Shell>;
  }

  if (isDurationPacksPage) {
    return <Shell data={data}><DurationPacksPage /></Shell>;
  }

  return (
    <Shell data={data}>
      <MarketPage
        data={data}
        error={error}
        state={state}
        gpu={gpu}
        region={region}
        visibleResources={visibleResources}
        setGpu={setGpu}
        setRegion={setRegion}
      />
    </Shell>
  );
}

function Shell({ children, data }: { children: ReactNode; data?: ComputePayload }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const pathname = window.location.pathname;
  const isHome = pathname.includes('/home');
  const isConsole = pathname.includes('/dashboard') || pathname.includes('/instances') || pathname.includes('/file-store') || pathname.includes('/netdisk') || pathname.includes('/images') || pathname.includes('/public-data') || pathname.includes('/billing') || pathname.includes('/account');
  const isServers = pathname.includes('/servers');
  const isDocs = pathname.includes('/docs');
  const isAdmin = pathname.includes('/admin');
  const isWorkflows = pathname.includes('/workflows') || pathname.includes('/workflow-runs');
  const isArtApp = pathname.includes('/app/') || pathname.includes('/art/');
  const isEndpoints = pathname.includes('/endpoints');
  const isMarket = !isHome && !isArtApp && !isWorkflows && !isConsole && !pathname.includes('/deployments') && !isServers && !isDocs && !isAdmin && !isEndpoints;
  useEffect(() => {
    const token = window.localStorage.getItem('compute_user_token');
    if (!token) return;
    let alive = true;
    api.user.info(token).then((payload) => {
      if (alive) setAuthUser(payload.data);
    }).catch(() => {
      window.localStorage.removeItem('compute_user_token');
      if (alive) setAuthUser(null);
    });
    return () => {
      alive = false;
    };
  }, []);
  const hasLoginToken = Boolean(window.localStorage.getItem('compute_user_token'));
  const accountName = authUser?.user_name || (hasLoginToken ? data?.account_name : '') || '';
  const isAdminUser = accountName === 'root';
  const logout = () => {
    const token = window.localStorage.getItem('compute_user_token');
    const done = () => {
      window.localStorage.removeItem('compute_user_token');
      setAuthUser(null);
      setUserOpen(false);
      window.location.href = '/compute/art/login';
    };
    if (!token) {
      done();
      return;
    }
    api.user.logout(token).finally(done);
  };
  return (
    <div className="page">
      <header className="promo">DeepSeek V4 API已上线&nbsp;&nbsp;<b>大模型广场</b></header>
      <nav className="topbar">
        <a className="brand" href="/compute/home"><span />灵渠</a>
        <div className="topnav">
          <a className={isMarket ? 'active' : ''} href="/compute">算力市场</a><a className={isArtApp ? 'active' : ''} href="/compute/app/market">AI应用</a><a className={`workflow-nav-link ${isWorkflows ? 'active' : ''}`} href="/compute/workflows">工作流<span>新</span></a><a className={isEndpoints ? 'active' : ''} href="/compute/endpoints">推理端点</a><a className={isServers ? 'active' : ''} href="/compute/servers">AI服务器</a><a className={isDocs ? 'active' : ''} href="/compute/docs">帮助文档</a><button className={`top-more ${moreOpen ? 'open' : ''}`} type="button" onClick={() => setMoreOpen(!moreOpen)}>更多<span className="nav-caret" /></button>
          {moreOpen && <div className="top-more-menu"><a href="/compute/api-deploy">API弹性部署</a><a href="/compute/shared-data">共享数据</a></div>}
        </div>
        <div className="topuser">
          {isAdminUser && <a className={isAdmin ? 'active' : ''} href="/compute/admin">管理后台</a>}
          <a className={isConsole ? 'active' : ''} href="/compute/dashboard">控制台</a>
          {accountName ? (
            <>
              <button className={`user-trigger ${userOpen ? 'open' : ''}`} type="button" onClick={() => setUserOpen(!userOpen)}>{accountName}<span className="nav-caret" /></button>
              {userOpen && <UserMenu accountName={accountName} user={authUser} onLogout={logout} />}
            </>
          ) : <a className="login-link" href={`/compute/art/login?next=${encodeURIComponent(pathname)}`}>登录 / 注册</a>}
        </div>
      </nav>
      {children}
      {isHome && <aside className="home-float">
        <button className="coupon-ticket" type="button">领<br />优惠券</button>
        <div className="float-tools">
          <button aria-label="客服" type="button">?</button>
          <button aria-label="文档" type="button">i</button>
          <button aria-label="顶部" type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑</button>
        </div>
      </aside>}
    </div>
  );
}

function UserMenu({ accountName, user, onLogout }: { accountName: string; user: AuthUser | null; onLogout: () => void }) {
  return (
    <div className="user-menu">
      <div className="user-menu-head">
        <strong>{accountName}</strong>
        <em>企业认证</em>
      </div>
      <div className="user-id">{user?.email ? `邮箱：${user.email}` : 'ID：8474db06-cf32-46d2-b908-fbb3b43170b5'} <span>⧉</span></div>
      <div className="member-line"><i>♕</i><span>算力会员</span></div>
      <div className="user-money"><span>可用余额：￥1282.08</span><button>去充值</button></div>
      <div className="user-stat">冻结余额：￥0.00</div>
      <div className="user-stat">代金券：￥0.00</div>
      <div className="user-stat">容器实例：3</div>
      <a className="logout-link" onClick={onLogout}>退出登录</a>
    </div>
  );
}

function useAuthUser() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const token = window.localStorage.getItem('compute_user_token');
    if (!token) {
      setReady(true);
      return;
    }
    let alive = true;
    api.user.info(token).then((payload) => {
      if (alive) setAuthUser(payload.data);
    }).catch(() => {
      window.localStorage.removeItem('compute_user_token');
      if (alive) setAuthUser(null);
    }).finally(() => {
      if (alive) setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  const logout = () => {
    const token = window.localStorage.getItem('compute_user_token');
    const done = () => {
      window.localStorage.removeItem('compute_user_token');
      setAuthUser(null);
      window.location.href = '/compute/art/login';
    };
    if (!token) {
      done();
      return;
    }
    api.user.logout(token).finally(done);
  };
  return { authUser, ready, logout };
}

function ArtUserNav({ activeLogin = false }: { activeLogin?: boolean }) {
  const { authUser, ready, logout } = useAuthUser();
  if (ready && authUser) {
    return (
      <nav className="art-auth-user">
        <a href="/compute/art/messages">消息</a>
        <a href="/compute/art/incentive">创作激励</a>
        <a href="/compute/docs">帮助文档</a>
        <a href="/compute/account/security">{authUser.user_name}</a>
        <button type="button" onClick={logout}>退出</button>
      </nav>
    );
  }
  return (
    <nav>
      <a href="/compute/art/messages">消息</a>
      <a href="/compute/art/incentive">创作激励</a>
      <a href="/compute/docs">帮助文档</a>
      <a className={activeLogin ? 'active' : ''} href="/compute/art/login">登录</a>
      <button onClick={() => { window.location.href = '/compute/art/register'; }}>注册</button>
    </nav>
  );
}

function HomePage() {
  const templates = useWorkflowTemplates();
  const [priceKind, setPriceKind] = useState<'member' | 'normal'>('member');
  const [rankKind, setRankKind] = useState<'half' | 'single'>('half');
  const primaryWorkflow = templates[0] ?? workflowTemplates[0];
  const homeWorkflowTypes = templates.slice(0, 3);
  const cards = [
    ['注册礼包', '注册立送30天会员'],
    ['GPU选型', '如何选择合适的GPU'],
    ['开具发票', '简单快速开具发票'],
    ['新手入门', '简单几步，创建实例'],
  ];
  const priceRows = [
    ['H800 / 80GB', '单精 51.2 TFLOPS / 半精 756.0 Tensor TFLOPS', '￥8.88 /时', '会员95折'],
    ['H20 / 96GB', '单精 暂无 / 半精 暂无', '￥7.58 /时', '会员95折'],
    ['PRO 6000 / 96GB', '单精 126.0 TFLOPS / 半精 503.8 Tensor TFLOPS', '￥5.98 /时', '会员75折'],
    ['A800-80GB / 80GB', '单精 19.5 TFLOPS / 半精 312 Tensor TFLOPS', '￥4.98 /时', '会员95折'],
    ['NVIDIA L20 / 48GB', '单精 59.35 TFLOPS / 半精 119.5 Tensor TFLOPS', '￥3.68 /时', '会员95折'],
    ['NVIDIA RTX 5090 / 32GB', '单精 104.8 TFLOPS / 半精 210 Tensor TFLOPS', '￥2.88 /时', '会员95折'],
    ['NVIDIA RTX 4090 / 24GB', '单精 82.58 TFLOPS / 半精 165.2 Tensor TFLOPS', '￥1.98 /时', '会员95折'],
    ['NVIDIA RTX 3090 / 24GB', '单精 35.58 TFLOPS / 半精 71 Tensor TFLOPS', '￥1.32 /时', '会员95折'],
  ];
  const normalPriceRows = priceRows.map((row) => {
    const numeric = Number.parseFloat(row[2].replace(/[^\d.]/g, ''));
    const nextPrice = Number.isFinite(numeric) ? `￥${(numeric * 1.08).toFixed(2)} /时` : row[2];
    return [row[0], row[1], nextPrice, '普通价'];
  });
  const rankRows = [
    ['H800 / 80GB', '100%', '756 Tensor TFLOPS'],
    ['PRO 6000 / 96GB', '67%', '503.8 Tensor TFLOPS'],
    ['NVIDIA A100 SXM4 / 80GB', '41%', '312 Tensor TFLOPS'],
    ['A800-80GB / 80GB', '41%', '312 Tensor TFLOPS'],
    ['NVIDIA RTX 5090 / 32GB', '28%', '210 TFLOPS'],
    ['NVIDIA RTX 4090 / 24GB', '22%', '165.2 Tensor TFLOPS'],
    ['NVIDIA V100 / 32GB', '17%', '125 Tensor TFLOPS'],
    ['NVIDIA RTX 3090 / 24GB', '9%', '71 Tensor TFLOPS'],
  ];
  const singleRankRows = [
    ['PRO 6000 / 96GB', '100%', '126.0 TFLOPS'],
    ['NVIDIA RTX 5090 / 32GB', '83%', '104.8 TFLOPS'],
    ['NVIDIA RTX 4090 / 24GB', '66%', '82.58 TFLOPS'],
    ['NVIDIA L20 / 48GB', '47%', '59.35 TFLOPS'],
    ['H800 / 80GB', '41%', '51.2 TFLOPS'],
    ['NVIDIA RTX 3090 / 24GB', '28%', '35.58 TFLOPS'],
    ['A800-80GB / 80GB', '16%', '19.5 TFLOPS'],
    ['NVIDIA V100 / 32GB', '12%', '15.7 TFLOPS'],
  ];
  const activePriceRows = priceKind === 'member' ? priceRows : normalPriceRows;
  const activeRankRows = rankKind === 'half' ? rankRows : singleRankRows;
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1>灵渠 AI算力云</h1>
          <p>弹性、好用、省钱</p>
          <div className="home-hero-actions"><a href="/compute/art/register?next=/compute/home">立即注册</a><a href="/compute/docs">了解详情</a></div>
        </div>
        <div className="home-visual" aria-hidden="true">
          <div className="home-board">
            <i className="node gpu">GPU</i>
            <i className="node mlu">MLU</i>
            <i className="node ascend">Ascend</i>
          </div>
        </div>
        <div className="home-dots"><b /><span /><span /></div>
      </section>
      <section className="home-metrics">
        {[
          ['20000+', '在线 GPU / MLU / Ascend'],
          ['94 秒', '工作流平均出片'],
          ['68 个', '热门工作流模板'],
          ['99.2%', '近期任务成功率'],
        ].map((item) => <article key={item[0]}><strong>{item[0]}</strong><span>{item[1]}</span></article>)}
      </section>
      <section className="home-quick">
        {cards.map((card) => <article key={card[0]}><h2>{card[0]}</h2><p>{card[1]}</p></article>)}
      </section>
      <section className="home-workflow">
        <div>
          <span>AI Workflow Studio</span>
          <h2>从算力到内容生成，一站式跑通文生图和文生视频</h2>
          <p>把常用图像、视频和商品素材链路封装成工作流模板。用户不用搭节点，只需要上传素材、填写提示词、选择参数，即可按次生成结果。</p>
          <nav><a href="/compute/workflows">查看工作流</a><a href={`/compute/workflows/${primaryWorkflow.id}/run`}>立即创作</a></nav>
        </div>
        <aside>
          {homeWorkflowTypes.map((item) => <article key={item.id}><strong>{item.category}</strong><p>{item.priceText} · 运行 {item.runCount}</p></article>)}
        </aside>
      </section>
      <section className="home-prices">
        <h2>算力会员及租用价格</h2>
        <p>灵渠坚持为您提供服务稳定、价格公道的GPU租用服务。更为学生提供免费升级会员通道，享极具性价比的会员价格。<a>如何升级会员？</a></p>
        <div className="home-tabs"><button className={priceKind === 'member' ? 'active' : ''} onClick={() => setPriceKind('member')}>算力会员</button><button className={priceKind === 'normal' ? 'active' : ''} onClick={() => setPriceKind('normal')}>普通用户</button></div>
        <div className="home-price-grid">
          {activePriceRows.map((row) => <article key={row[0]}><h3>{row[0]}</h3><p>{row[1]}</p><strong>{row[2]}</strong><em>{row[3]}</em></article>)}
        </div>
      </section>
      <section className="home-rank">
        <h2>GPU算力排名</h2>
        <p>仅以灵渠平台提供的加速卡型号进行算力排名，其中 NVIDIA GPU 以 Peak FP16 Tensor TFLOPS with FP32 Accumulate 值为半精算力值</p>
        <div className="home-rank-tabs"><button className={rankKind === 'half' ? 'active' : ''} onClick={() => setRankKind('half')}>半精算力排名</button><button className={rankKind === 'single' ? 'active' : ''} onClick={() => setRankKind('single')}>单精算力排名</button></div>
        <div className="rank-table">
          <div className="rank-head"><span>排名</span><span>GPU</span><span>{rankKind === 'half' ? '半精算力' : '单精算力'}</span><span>算力</span></div>
          {activeRankRows.map((row, index) => (
            <div className="rank-row" key={row[0]}><span>{index + 1}</span><span>{row[0]}</span><span><i style={{ width: row[1] }} /></span><span>{row[2]}</span></div>
          ))}
        </div>
      </section>
      <section className="home-cta"><h2>更大更全更专业的AI算力集群，即刻开启算力租用</h2><p>20000+ 卡在线GPU、MLU、Ascend</p><a href="/compute">查看算力市场</a></section>
      <footer className="home-footer">
        <div><h3>产品与服务</h3><a href="/compute">GPU租用</a><a href="/compute/app/market">AI应用</a></div>
        <div><h3>帮助与支持</h3><a href="/compute/docs">帮助文档</a><a>开具发票</a></div>
        <div><h3>灵渠</h3><a>加入我们</a><a>联系电话：17717677953</a></div>
        <div className="home-footer-service"><h3>扫码关注公众号</h3><div className="footer-qr" /></div>
        <div className="home-footer-record"><span>© 2026 要创科技官网</span><a href="https://beian.miit.gov.cn/" target="_blank" rel="noreferrer">沪ICP备2021019600号-1</a></div>
      </footer>
    </main>
  );
}

function WorkflowsPage() {
  const templates = useWorkflowTemplates();
  const [activeCat, setActiveCat] = useState('推荐');
  const [sortMode, setSortMode] = useState('综合排序');
  const [favoriteIds, setFavoriteIds] = useState<string[]>(['ltx-video', 'product-video']);
  const toggleFavorite = (id: string) => {
    setFavoriteIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const filteredTemplates = activeCat === '推荐' || activeCat === 'ComfyUI'
    ? templates
    : activeCat === '收藏'
      ? templates.filter((item) => favoriteIds.includes(item.id))
      : templates.filter((item) => item.category === activeCat || item.tags.includes(activeCat));
  const sortedTemplates = [...filteredTemplates].sort((a, b) => {
    if (sortMode === '价格从低到高') return Number.parseFloat(a.priceText) - Number.parseFloat(b.priceText);
    if (sortMode === '运行最多') return Number.parseFloat(b.runCount) - Number.parseFloat(a.runCount);
    return templates.indexOf(a) - templates.indexOf(b);
  });
  const cards = sortedTemplates.map(workflowTemplateToCard);
  const featured = templates.slice(0, 3);
  const cats = ['推荐', '收藏', '文生视频', '图生视频', '商品营销', '数字人', '风格化', 'ComfyUI'];
  const sortTabs = ['综合排序', '运行最多', '价格从低到高'];
  return (
    <main className="workflow-page">
      <section className="workflow-hero">
        <div>
          <span>灵渠 Workflow</span>
          <h1>AI工作流创作平台</h1>
          <p>把成熟的文生视频、图生视频和商业创作链路封装成黑盒工作流。上传素材，填写提示词，直接生成结果。</p>
          <div><a href={`/compute/workflows/${templates[0]?.id ?? 'ltx-video'}/run`}>立即生成</a><a href="/compute/workflows/mine">我的工作流</a></div>
        </div>
        <div className="workflow-hero-stage">
          <article className="big"><b>LTX2.3</b><strong>角色图转电影短片</strong><em>12算力币/次</em></article>
          <article><b>Wan2.2</b><strong>文生视频</strong></article>
          <article><b>ComfyUI</b><strong>成熟节点黑盒执行</strong></article>
        </div>
      </section>
      <section className="workflow-strip">
        {['今日运行 12,486 次', '平均出片 94 秒', '热门工作流 68 个', '支持 弹性算力调度'].map((item) => <span key={item}>{item}</span>)}
      </section>
      <section className="workflow-featured">
        <div className="workflow-section-head"><h2>精选模板</h2><div><button className="active">增长最快</button><button>商业投放</button><button>创作者推荐</button></div></div>
        <div className="workflow-featured-grid">
          {featured.map((item, index) => (
            <article className={`${workflowCoverClassName(item.cover)} ${index === 0 ? 'large' : ''}`} key={item.id} onClick={() => { window.location.href = `/compute/workflows/${item.id}`; }}>
              <span>{index === 0 ? '增长最快' : item.tags[0] ?? '精选'}</span>
              <strong>{item.title}</strong>
              <p>{item.summary}</p>
              <button>查看模板</button>
            </article>
          ))}
        </div>
      </section>
      <section className="workflow-filter-bar">
        <div><strong>{activeCat}</strong><span>{cards.length} 个工作流 · 收藏 {favoriteIds.length} 个 · 支持文生图/文生视频/图生视频</span></div>
        <nav>{sortTabs.map((tab) => <button className={sortMode === tab ? 'active' : ''} key={tab} onClick={() => setSortMode(tab)}>{tab}</button>)}</nav>
      </section>
      <section className="workflow-scene-filter">
        {[
          ['短视频爆款', '文生视频'],
          ['商品投放', '商品营销'],
          ['人物角色', '图生视频'],
          ['封面海报', '风格化'],
        ].map((item) => <button className={activeCat === item[1] ? 'active' : ''} key={item[0]} onClick={() => setActiveCat(item[1])}><strong>{item[0]}</strong><span>{item[1]}</span></button>)}
      </section>
      <section className="workflow-section-head"><h2>热门工作流</h2><div>{cats.map((cat) => <button className={activeCat === cat ? 'active' : ''} key={cat} onClick={() => setActiveCat(cat)}>{cat}</button>)}<a href="/compute/workflows/mine">我的工作流</a></div></section>
      <div className="workflow-layout">
        <section className="workflow-grid">
          {cards.map((card) => <WorkflowCard card={card} favorite={favoriteIds.includes(card[0])} key={card[0]} onFavorite={toggleFavorite} />)}
          {cards.length === 0 && <div className="workflow-empty"><strong>暂无匹配工作流</strong><p>当前分类还没有上架模板，可以先从推荐模板开始创作。</p><a href="/compute/workflows">返回推荐</a></div>}
        </section>
        <aside className="workflow-rank">
          <h2>创作榜</h2>
          {cards.slice(0, 5).map((card, index) => <a href={`/compute/workflows/${card[0]}`} key={card[0]}><b>{index + 1}</b><span>{card[1]}</span><em>{card[4]}</em></a>)}
          <div className="workflow-rank-divider" />
          <h2>变现榜</h2>
          {cards.slice(0, 3).map((card, index) => <a href={`/compute/workflows/${card[0]}/run`} key={`${card[0]}-money`}><b>{index + 1}</b><span>{card[1]}</span><em>￥{[3860, 2940, 2168][index]}</em></a>)}
        </aside>
      </div>
      <section className="workflow-showcase">
        <div className="workflow-section-head"><h2>最新作品</h2><div><button className="active">全部</button><button>视频</button><button>图片</button><button>可复用</button></div></div>
        <div>
          {workflowShowcase.map((item) => (
            <article className={item[3]} key={item[0]}>
              <span>{item[1]}</span>
              <strong>{item[0]}</strong>
              <p>{item[2]}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function WorkflowCard({ card, favorite = false, onFavorite }: { card: string[]; favorite?: boolean; onFavorite?: (id: string) => void }) {
  return (
    <article className="workflow-card" onClick={() => { window.location.href = `/compute/workflows/${card[0]}`; }}>
      {onFavorite && <button className={`workflow-favorite ${favorite ? 'active' : ''}`} onClick={(event) => { event.stopPropagation(); onFavorite(card[0]); }}>{favorite ? '已收藏' : '收藏'}</button>}
      <div className={`workflow-cover ${card[6]}`}><span>{card[7]}</span><strong>{card[1]}</strong></div>
      <div className="workflow-card-body">
        <h2>{card[1]}</h2>
        <p>{card[2]}</p>
        <div><span>{card[3]}</span><span>运行 {card[4]}</span></div>
        <footer><b>{card[5]}</b><button onClick={(event) => { event.stopPropagation(); window.location.href = `/compute/workflows/${card[0]}/run`; }}>立即使用</button></footer>
      </div>
    </article>
  );
}

function WorkflowDetailPage() {
  const templates = useWorkflowTemplates();
  const workflowId = workflowIdFromPath();
  const { template, related } = useWorkflowTemplateDetail(workflowId, templates);
  const relatedCards = related.map(workflowTemplateToCard);
  const basePrice = template.priceText.replace('/次', '');
  const isImage = template.mode === 'text_to_image';
  const isTextVideo = template.mode === 'text_to_video';
  const estimatedTime = isImage ? '15-35 秒' : isTextVideo ? '80-150 秒' : '60-120 秒';
  const scenarioText = isImage ? '海报封面、连续分镜、角色设定图、商品视觉、社媒配图。' : isTextVideo ? '剧情镜头、广告短片、视频脚本预览、社媒内容、AIGC 样片。' : '角色动态、商品展示、剧情分镜、社媒短视频、AI 影视预览。';
  const inputSummary = isImage ? `${template.category}模板支持提示词、负向提示词、比例、清晰度、生成数量、seed。节点链路和模型参数默认锁定。` : isTextVideo ? `${template.category}模板支持提示词、比例、时长、清晰度、风格强度、seed。节点链路和模型参数默认锁定。` : `${template.category}模板支持参考图、提示词、比例、时长、清晰度、seed。节点链路和模型参数默认锁定。`;
  const examples = [
    isImage ? ['角色设定', '统一人物风格，生成高质感封面和分镜图', '4 张'] : ['人物回头', '柔光电影镜头，角色自然回头，背景虚化', '00:06'],
    template.category === '商品营销' ? ['商品旋转', '玻璃质感产品，慢速环绕，金色高光', '00:05'] : ['城市夜景', '赛博城市街头，霓虹反射，推轨镜头', isImage ? '1 张' : '00:08'],
    isTextVideo ? ['剧情开场', '雨夜街道，人物穿过霓虹反射，镜头缓慢推进', '00:08'] : ['社媒素材', '适合发布到短视频和投放场景的成片结果', isImage ? '2 张' : '00:06'],
  ];
  const [cases, setCases] = useState<WorkflowCase[]>(() => examples.map((item, index) => ({ id: `fallback-${index}`, templateId: template.id, title: item[0], summary: item[1], outputText: item[2], prompt: item[1], ratio: index === 1 ? '16:9' : '9:16', quality: '1080P', publishedAt: '2026-05-20 18:00' })));
  useEffect(() => {
    let alive = true;
    workflowApi.cases(template.id).then(({ items }) => {
      if (alive) setCases(items);
    }).catch(() => {
      if (alive) setCases(examples.map((item, index) => ({ id: `fallback-${index}`, templateId: template.id, title: item[0], summary: item[1], outputText: item[2], prompt: item[1], ratio: index === 1 ? '16:9' : '9:16', quality: '1080P', publishedAt: '2026-05-20 18:00' })));
    });
    return () => {
      alive = false;
    };
  }, [template.id]);
  const params = [
    ...(isImage || isTextVideo ? [] : [['参考图', '必填', 'JPG / PNG，建议 1024px 以上']]),
    ['提示词', '必填', '镜头、动作、风格、光线描述'],
    ['比例', '可选', '9:16 / 16:9 / 1:1'],
    ...(isImage ? [['生成数量', '可选', '1 / 2 / 4 张']] : [['时长', '可选', '4s / 6s / 8s']]),
    ['清晰度', '可选', '720P / 1080P'],
  ];
  const reviews = [
    ['短视频团队', '出片稳定，角色一致性比直接跑开源节点好很多。', '4.9'],
    ['电商运营', '商品图转视频能直接拿去做投放素材，失败会退回费用。', '4.8'],
    ['独立创作者', '参数不复杂，适合不会搭节点的人快速试镜头。', '4.7'],
  ];
  const modes = [
    ['文生图', '输入提示词生成封面、海报和分镜图', '5算力币起'],
    ['文生视频', '输入剧情和镜头描述生成短视频', '18算力币起'],
    ['图生视频', '上传参考图生成角色或商品动态', '12算力币起'],
  ];
  const versionRows = [
    ['v1.8', '当前版本', '优化 1080P 输出和失败退费链路', '2026-05-20'],
    ['v1.7', '稳定版本', '增加批量运行参数和案例发布', '2026-05-18'],
    ['v1.6', '历史版本', '首次公开上架工作流广场', '2026-05-12'],
  ];
  const deliveryRows = [
    ['输入校验', '素材尺寸、提示词、比例和余额预检查'],
    ['算力调度', '自动选择空闲 GPU，失败重试一次'],
    ['结果回传', '生成结果写入创作记录和资产库'],
    ['结算审计', '按成功任务扣费，失败自动退回'],
  ];
  const purchaseSignals = [
    ['适合人群', template.category === '商品营销' ? '电商运营 / 投放团队' : isImage ? '设计师 / 内容创作者' : '短视频团队 / AIGC 创作者'],
    ['交付资产', isImage ? '高清图、封面、提示词快照' : 'MP4、封面、关键帧、提示词快照'],
    ['复用方式', '一键再次运行 / 复制参数 / 发布案例'],
    ['结算方式', '按次预扣，失败自动退回'],
  ];
  const faqRows = [
    ['失败会扣费吗？', '任务失败会自动退回预扣费用，并保留运行日志。'],
    ['能修改底层节点吗？', '第一版只开放稳定参数，底层节点由平台维护。'],
    ['结果可以商用吗？', '平台提供生成记录和资产清单，授权规则以当前账号协议为准。'],
  ];
  return (
    <main className="workflow-detail-page">
      <section className="workflow-detail-hero">
        <div className="workflow-detail-media">
          <div className="preview-main">{template.title}<br />生成预览</div>
          <div><span /> <span /> <span /></div>
        </div>
          <aside>
            <span className="workflow-badge">{template.tags[0] ?? '精选工作流'}</span>
            <h1>{template.title}</h1>
            <p>{template.summary}。底层流程黑盒执行，只开放稳定参数。</p>
            <div className="workflow-author"><b>灵渠官方</b><span>运行 {template.runCount} · 收藏 1,209 · 评分 4.9</span></div>
            <div className="workflow-price"><strong>{template.priceText}</strong><em>预计 {estimatedTime}</em></div>
            <div className="workflow-detail-stats">
              <span><b>4.9</b>综合评分</span>
              <span><b>{estimatedTime}</b>平均耗时</span>
              <span><b>99%</b>成功率</span>
            </div>
            <div className="workflow-purchase-signals">
              {purchaseSignals.map((item) => <p key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></p>)}
            </div>
            <div className="workflow-actions"><a href={`/compute/workflows/${template.id}/run`}>立即使用</a><button>收藏</button><button>复制链接</button></div>
          </aside>
      </section>
      <section className="workflow-detail-grid">
        <article><h2>适用场景</h2><p>{scenarioText}</p></article>
        <article><h2>输入参数</h2><p>{inputSummary}</p></article>
        <article><h2>算力配置</h2><p>优先使用 RTX 4090 / 5090，底层可通过 弹性资源池执行。</p></article>
      </section>
      <section className="workflow-delivery-row">
        {[
          ['结果保障', '失败自动退回费用，异常任务保留日志和输入快照。'],
          ['参数封装', '复杂节点链路由平台维护，用户只改稳定输入项。'],
          ['资产沉淀', '生成结果进入创作记录，可复跑、导出、发布案例。'],
          ['商用场景', '适合官网入口、应用市场和创作者模板联合展示。'],
        ].map((item) => <article key={item[0]}><strong>{item[0]}</strong><p>{item[1]}</p></article>)}
      </section>
      <section className="workflow-mode-overview">
        <div className="workflow-section-head"><h2>支持生成模式</h2><div><a href={`/compute/workflows/${template.id}/run`}>打开工作台</a></div></div>
        <div>{modes.map((item, index) => <article className={index === 2 ? 'active' : ''} key={item[0]}><strong>{item[0]}</strong><p>{item[1]}</p><span>{item[2]}</span></article>)}</div>
      </section>
      <section className="workflow-example-wall">
        <div className="workflow-section-head"><h2>生成案例</h2><div><button className="active">精选</button><button>竖版</button><button>商品</button><button>人物</button></div></div>
        <div>
          {cases.map((item, index) => <article className={`workflow-example-card ${index === 0 ? 'large' : ''}`} key={item.id}><span>{item.outputText}</span><strong>{item.title}</strong><p>{item.summary}</p><em>{item.quality} · {item.ratio}</em></article>)}
        </div>
      </section>
      <section className="workflow-node-preview">
        <h2>工作流预览</h2>
        <WorkflowNodes />
      </section>
      <section className="workflow-detail-panels">
        <article className="workflow-param-table">
          <h2>开放参数</h2>
          {params.map((row) => <div key={row[0]}><span>{row[0]}</span><b>{row[1]}</b><p>{row[2]}</p></div>)}
        </article>
        <article className="workflow-cost-card">
          <h2>费用估算</h2>
          <div><span>基础生成</span><strong>{basePrice}</strong></div>
          <div><span>1080P 高清</span><strong>+4 算力币</strong></div>
          <div><span>{isImage ? '多图生成' : '8 秒时长'}</span><strong>{isImage ? '+2 算力币/张' : '+6 算力币'}</strong></div>
          <p>提交时预扣，失败自动退回。批量任务会按实际成功数量结算。</p>
          <a href={`/compute/workflows/${template.id}/run`}>开始生成</a>
        </article>
      </section>
      <section className="workflow-version-matrix">
        <article>
          <h2>版本记录</h2>
          {versionRows.map((row) => <p key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><em>{row[2]}</em><i>{row[3]}</i></p>)}
        </article>
        <article>
          <h2>交付流程</h2>
          {deliveryRows.map((row, index) => <p key={row[0]}><b>{index + 1}</b><span>{row[0]}</span><em>{row[1]}</em></p>)}
        </article>
      </section>
      <section className="workflow-review-wall">
        <div className="workflow-section-head"><h2>用户反馈</h2><div><button className="active">全部</button><button>商用</button><button>创作</button></div></div>
        <div>{reviews.map((row) => <article key={row[0]}><strong>{row[2]}</strong><h3>{row[0]}</h3><p>{row[1]}</p></article>)}</div>
      </section>
      <section className="workflow-related">
        <div className="workflow-section-head"><h2>相似工作流</h2><div><a href="/compute/workflows">返回广场</a></div></div>
        <div>{relatedCards.map((card) => <WorkflowCard card={card} key={card[0]} />)}</div>
      </section>
      <section className="workflow-detail-bottom">
        <article><h2>运行须知</h2><p>该工作流内部节点和模型参数已锁定，只开放稳定输入项。生成结果受素材质量、提示词和时长影响。</p></article>
        <article><h2>费用规则</h2><p>每次提交预扣 {basePrice}，失败自动退回。高清、长时长或多图生成会按实际参数计费。</p></article>
      </section>
      <section className="workflow-faq-row">
        {faqRows.map((item) => <article key={item[0]}><strong>{item[0]}</strong><p>{item[1]}</p></article>)}
      </section>
      <section className="workflow-final-cta">
        <div><span>准备开始</span><strong>{template.title}</strong><p>使用当前模板进入工作台，生成结果会自动写入创作记录。</p></div>
        <a href={`/compute/workflows/${template.id}/run`}>进入工作台</a>
      </section>
    </main>
  );
}

function WorkflowRunPage() {
  const templates = useWorkflowTemplates();
  const workflowId = workflowIdFromPath();
  const { template } = useWorkflowTemplateDetail(workflowId, templates);
  const [publishOpen, setPublishOpen] = useState(false);
  const [resultMode, setResultMode] = useState<'idle' | 'running' | 'done'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const [activeRun, setActiveRun] = useState<WorkflowRunRecord>();
  const [activeMode, setActiveMode] = useState<WorkflowRunPayload['mode']>(template.mode);
  const [prompt, setPrompt] = useState('电影感镜头，人物回头，柔和光线，浅景深，细节丰富');
  const [negativePrompt, setNegativePrompt] = useState('低清晰度、畸变、过曝、多余肢体');
  const [ratio, setRatio] = useState<WorkflowRunPayload['ratio']>('9:16');
  const [quality, setQuality] = useState<WorkflowRunPayload['quality']>('1080P');
  const [durationSeconds, setDurationSeconds] = useState<4 | 6 | 8>(6);
  const [imageCount, setImageCount] = useState<1 | 2 | 4>(2);
  const [styleStrength, setStyleStrength] = useState<WorkflowRunPayload['styleStrength']>('medium');
  const [seed, setSeed] = useState('238471');
  useEffect(() => {
    setActiveMode(template.mode);
  }, [template.id, template.mode]);
  const promptChips = ['电影感', '慢速推镜', '浅景深', '柔和逆光', '商业质感'];
  const modeOptions: Array<[WorkflowRunPayload['mode'], string, string]> = [['text_to_image', '文生图', '1-4张'], ['text_to_video', '文生视频', '4-8秒'], ['image_to_video', '图生视频', '参考图驱动']];
  const assetSlots = activeMode === 'text_to_image' ? ['风格参考', '构图参考', '色彩参考'] : activeMode === 'text_to_video' ? ['剧情参考', '镜头参考', '风格参考'] : ['人物参考', '背景参考', '风格参考'];
  const frameSlots = activeMode === 'text_to_image' ? ['结果 1', '结果 2', '结果 3', '结果 4'] : ['首帧', '中间帧', '尾帧', '封面'];
  const workflowNodeLabels = activeMode === 'text_to_image' ? ['提示词', '风格锁定', '黑盒生图节点', '高清放大', '结果输出'] : activeMode === 'text_to_video' ? ['提示词', '镜头规划', '黑盒视频节点', '视频采样', '结果输出'] : ['输入图', '提示词', '黑盒加速节点', '视频采样', '结果输出'];
  const runMetrics = [
    ['资源池', 'RTX 5090 优先', resultMode === 'running' ? '调度中' : '就绪'],
    ['预计排队', resultMode === 'running' ? '12 秒' : '低峰'],
    ['平均耗时', activeMode === 'text_to_image' ? '28 秒' : '96 秒'],
    ['成功率', '99.2%'],
  ];
  const outputTiles = activeMode === 'text_to_image'
    ? ['主图', '近景', '横版', '海报']
    : ['首帧', '中段', '尾帧', '成片'];
  const runTimeline = resultMode === 'idle'
    ? [['参数校验', '已完成'], ['资源预估', '已完成'], ['等待提交', '待运行'], ['结果入库', '待运行']]
    : resultMode === 'running'
      ? [['参数校验', '已完成'], ['资源调度', '运行中'], ['黑盒节点执行', '68%'], ['结果入库', '等待']]
      : [['参数校验', '已完成'], ['资源调度', '已完成'], ['黑盒节点执行', '已完成'], ['结果入库', '已完成']];
  const logLines = resultMode === 'idle'
    ? ['[17:22:14] 等待提交任务', '[17:22:15] 参数草稿已自动保存', '[17:22:16] 费用预估完成']
    : resultMode === 'running'
      ? ['[17:22:14] 任务已提交', '[17:22:16] 弹性资源预检查完成', `[17:22:26] ${activeMode === 'text_to_image' ? '生图' : '视频'}工作流参数已写入黑盒节点`, '[17:23:04] 输出文件等待回传']
      : ['[17:22:14] 任务已提交', '[17:22:26] 黑盒节点执行完成', '[17:23:04] 结果已入库', '[17:23:08] 可下载或发布案例'];
  const preflightRows = [
    ['提示词', prompt.trim().length > 8 ? '通过' : '过短'],
    ['余额', '充足'],
    ['素材', activeMode === 'text_to_video' ? '非必填' : '待上传'],
    ['内容安全', resultMode === 'idle' ? '提交后检测' : '通过'],
  ];
  const assetPackage = activeMode === 'text_to_image'
    ? ['原图 JPG', '高清 PNG', '提示词 JSON', '封面缩略图']
    : ['成片 MP4', '封面 JPG', '关键帧 ZIP', '提示词 JSON'];
  const runPayload: WorkflowRunPayload = useMemo(() => ({
    templateId: template.id,
    mode: activeMode,
    prompt,
    negativePrompt,
    ratio,
    quality,
    durationSeconds,
    imageCount,
    styleStrength,
    seed,
  }), [activeMode, durationSeconds, imageCount, negativePrompt, prompt, quality, ratio, seed, styleStrength, template.id]);
  const [cost, setCost] = useState<WorkflowCostEstimate>(() => estimateWorkflowCost(runPayload));
  const modeTitle = activeMode === 'text_to_image' ? '文生图结果' : activeMode === 'text_to_video' ? '文生视频结果' : '竖版短片结果';
  useEffect(() => {
    let alive = true;
    workflowApi.estimate(runPayload).then((nextCost) => {
      if (alive) setCost(nextCost);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [runPayload]);
  const submitRun = () => {
    if (resultMode === 'running') {
      setResultMode('done');
      return;
    }
    if (resultMode === 'done') {
      setResultMode('idle');
      setActiveRun(undefined);
      return;
    }
    setSubmitting(true);
    workflowApi.createRun(runPayload).catch(() => createWorkflowRun(runPayload)).then((run) => {
      setActiveRun(run);
      setResultMode('running');
    }).finally(() => {
      setSubmitting(false);
    });
  };
  const exportApiSchema = () => {
    workflowApi.apiSchema(template.id).then((schema) => {
      const payload = { ...schema, examplePayload: runPayload };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${template.id}-api-schema.json`;
      link.click();
      URL.revokeObjectURL(url);
    });
  };
  const exportAssetManifest = () => {
    const payload = {
      templateId: template.id,
      mode: activeMode,
      assets: assetPackage,
      prompt,
      ratio,
      quality,
      cost: cost.total,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${template.id}-asset-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const canPublish = resultMode === 'done';
  return (
    <main className="workflow-run-page">
      <header className="workflow-studio-top">
        <div><b>{template.title}</b><span>自动保存 · 版本 v1.8 · 黑盒加速节点</span></div>
        <nav><button>另存为模板</button><button onClick={exportApiSchema}>导出(API)</button><button disabled={!canPublish} onClick={() => canPublish && setPublishOpen(true)}>发布</button><a href="/compute/workflow-runs">运行记录</a></nav>
      </header>
      <section className="workflow-studio-steps">
        {['填写参数', '预扣费用', '生成结果', '发布案例'].map((item, index) => <span className={index < (resultMode === 'idle' ? 2 : resultMode === 'running' ? 3 : 4) ? 'active' : ''} key={item}>{item}</span>)}
      </section>
      <section className="workflow-ready-banner studio"><strong>工作台状态</strong><span>{resultMode === 'done' ? '结果已生成，可发布案例或导出资产清单。' : resultMode === 'running' ? '任务运行中，等待结果回传。' : '参数已自动保存，可立即运行。'}</span></section>
      <section className="workflow-studio-status">
        {runMetrics.map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong>{item[2] && <em>{item[2]}</em>}</article>)}
      </section>
      <div className="workflow-studio">
        <aside className="workflow-input-panel">
          <h2>输入参数</h2>
          <div className="workflow-mode-switch">
            {modeOptions.map(([mode, label, desc]) => <button className={activeMode === mode ? 'active' : ''} key={mode} onClick={() => setActiveMode(mode)}><strong>{label}</strong><span>{desc}</span></button>)}
          </div>
          {activeMode !== 'text_to_image' && <label><span>参考图</span><div className="upload-box">拖拽上传图片</div></label>}
          <div className="workflow-asset-strip">{assetSlots.map((item) => <span key={item}>{item}</span>)}</div>
          <label><span>提示词</span><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} /></label>
          <label><span>负向提示词</span><input value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} /></label>
          <div className="workflow-prompt-chips">{promptChips.map((chip) => <button key={chip} onClick={() => setPrompt((value) => value.includes(chip) ? value : `${value}，${chip}`)}>{chip}</button>)}</div>
          <label><span>比例</span><div>{(['9:16', '16:9', '1:1'] as const).map((item) => <button className={ratio === item ? 'active' : ''} key={item} onClick={() => setRatio(item)}>{item}</button>)}</div></label>
          {activeMode !== 'text_to_image' && <label><span>时长</span><div>{([4, 6, 8] as const).map((item) => <button className={durationSeconds === item ? 'active' : ''} key={item} onClick={() => setDurationSeconds(item)}>{item}s</button>)}</div></label>}
          <label><span>清晰度</span><div>{(['720P', '1080P'] as const).map((item) => <button className={quality === item ? 'active' : ''} key={item} onClick={() => setQuality(item)}>{item}</button>)}</div></label>
          {activeMode === 'text_to_image' && <label><span>生成数量</span><div>{([1, 2, 4] as const).map((item) => <button className={imageCount === item ? 'active' : ''} key={item} onClick={() => setImageCount(item)}>{item}</button>)}</div></label>}
          <label><span>风格强度</span><div>{[['low', '低'], ['medium', '中'], ['high', '高']].map(([value, label]) => <button className={styleStrength === value ? 'active' : ''} key={value} onClick={() => setStyleStrength(value as WorkflowRunPayload['styleStrength'])}>{label}</button>)}</div></label>
          <label><span>Seed</span><input value={seed} onChange={(event) => setSeed(event.target.value)} /></label>
        </aside>
        <section className="workflow-canvas-panel">
          <div className={`workflow-result-stage ${resultMode}`}><span>{resultMode === 'done' ? '生成完成' : resultMode === 'running' ? '生成中 68%' : '等待生成'}</span><strong>{resultMode === 'done' ? modeTitle : `${template.title} 预览区`}</strong><p>{resultMode === 'done' ? `已生成${activeMode === 'text_to_image' ? ` ${imageCount} 张图片` : ` ${durationSeconds} 秒视频`}，可下载或发布。` : resultMode === 'running' ? '弹性算力实例已启动，工作流正在执行。' : '运行后将在这里显示结果和中间帧。'}</p></div>
          <div className="workflow-result-toolbar"><button disabled={!canPublish}>下载</button><button disabled={!canPublish}>设为封面</button><button>复制参数</button><button disabled={!canPublish} onClick={() => canPublish && setPublishOpen(true)}>发布案例</button></div>
          {activeRun && <div className="workflow-active-run"><span>最近任务</span><strong>{activeRun.id}</strong><em>{activeRun.statusText} · {activeRun.costText}</em><a href="/compute/workflow-runs">查看记录</a></div>}
          <div className="workflow-frame-strip">{frameSlots.map((item, index) => <span className={resultMode !== 'idle' && index < 3 ? 'ready' : ''} key={item}>{item}</span>)}</div>
          <div className="workflow-output-board">
            <header><h2>输出预览</h2><span>{resultMode === 'done' ? '已保存到创作资产' : resultMode === 'running' ? '实时回传中' : '提交后自动生成'}</span></header>
            <div>{outputTiles.map((item, index) => <article className={resultMode === 'idle' ? '' : index === 0 ? 'primary' : 'filled'} key={item}><b>{item}</b><span>{resultMode === 'idle' ? '等待' : resultMode === 'running' && index > 1 ? '生成中' : '可预览'}</span></article>)}</div>
          </div>
          <div className="workflow-result-inspector">
            {[
              ['内容安全', resultMode === 'idle' ? '待检测' : '通过'],
              ['清晰度', quality],
              ['比例', ratio],
              ['资产归档', resultMode === 'done' ? '已入库' : '等待结果'],
            ].map((item) => <p key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong></p>)}
          </div>
          <div className="workflow-param-summary">
            {[
              ['模式', modeOptions.find((item) => item[0] === activeMode)?.[1] ?? '图生视频'],
              ['时长/数量', activeMode === 'text_to_image' ? `${imageCount} 张` : `${durationSeconds}s`],
              ['强度', styleStrength === 'high' ? '高' : styleStrength === 'low' ? '低' : '中'],
              ['Seed', seed || '随机'],
            ].map((item) => <span key={item[0]}><b>{item[0]}</b>{item[1]}</span>)}
          </div>
          <div className="workflow-asset-package">
            <header><h2>结果资产包</h2><button disabled={!canPublish} onClick={exportAssetManifest}>导出清单</button></header>
            <div>{assetPackage.map((item, index) => <article className={resultMode === 'done' ? 'ready' : ''} key={item}><b>{item}</b><span>{resultMode === 'done' ? '已生成' : index === 0 && resultMode === 'running' ? '生成中' : '等待'}</span></article>)}</div>
          </div>
          <div className="workflow-next-actions">
            {[
              { title: '发布案例', desc: '把当前结果发布到模板详情页', enabled: canPublish },
              { title: '再次运行', desc: '保留参数重新提交一条任务', enabled: true },
              { title: '查看记录', desc: '进入创作记录追踪历史任务', enabled: true },
            ].map((item) => <button disabled={!item.enabled} key={item.title} onClick={() => {
              if (item.title === '发布案例' && canPublish) setPublishOpen(true);
              if (item.title === '再次运行') submitRun();
              if (item.title === '查看记录') window.location.href = '/compute/workflow-runs';
            }}><strong>{item.title}</strong><span>{item.desc}</span></button>)}
          </div>
          <WorkflowNodes nodes={workflowNodeLabels} />
          <div className="workflow-log"><b>运行日志</b>{logLines.map((line) => <p key={line}>{line}</p>)}</div>
        </section>
        <aside className="workflow-run-config">
          <h2>运行配置</h2>
          <div className="workflow-queue-card"><span>当前队列</span><strong>{resultMode === 'running' ? '3 / 12' : '空闲'}</strong><p>{resultMode === 'running' ? '预计 42 秒后完成' : '提交后自动分配弹性算力'}</p></div>
          <div className="workflow-run-timeline">
            {runTimeline.map((item, index) => <p className={index < (resultMode === 'idle' ? 2 : resultMode === 'running' ? 3 : 4) ? 'done' : ''} key={item[0]}><i>{index + 1}</i><span>{item[0]}</span><b>{item[1]}</b></p>)}
          </div>
          {activeRun && <p><span>任务编号</span><strong>{activeRun.id}</strong></p>}
          <p><span>推荐 GPU</span><strong>RTX 4090 / 5090</strong></p>
          <p><span>地区</span><strong>北京B区 / 重庆A区</strong></p>
          <p><span>预计耗时</span><strong>{activeMode === 'text_to_image' ? '15-35 秒' : activeMode === 'text_to_video' ? '80-150 秒' : '60-120 秒'}</strong></p>
          <p><span>模板价格</span><strong>{template.priceText}</strong></p>
          <p><span>本次费用</span><strong>{cost.total} 算力币</strong></p>
          <p><span>账户余额</span><strong>1303.96</strong></p>
          <div className="workflow-preflight-card">
            <strong>运行前检查</strong>
            {preflightRows.map((item) => <p key={item[0]}><span>{item[0]}</span><b>{item[1]}</b></p>)}
          </div>
          <div className="workflow-cost-breakdown">
            <strong>费用明细</strong>
            <p><span>基础费用</span><b>{cost.base}</b></p>
            <p><span>高清加价</span><b>{cost.qualityExtra}</b></p>
            <p><span>时长/数量</span><b>{cost.durationExtra}</b></p>
          </div>
          <div className="workflow-exception-card">
            <strong>异常处理</strong>
            <p><span>失败退费</span><b>自动</b></p>
            <p><span>日志保留</span><b>180 天</b></p>
            <p><span>复跑方式</span><b>保留参数</b></p>
          </div>
          <div className="workflow-cost-confirm"><span>预扣费用</span><strong>{cost.total} 算力币</strong><em>失败自动退回</em></div>
          <button onClick={submitRun} disabled={submitting}>{submitting ? '提交中' : resultMode === 'idle' ? '立即运行' : resultMode === 'running' ? '查看完成态' : '再次运行'}</button>
          <div className="workflow-run-actions"><button disabled={!canPublish} onClick={() => canPublish && setPublishOpen(true)}>发布作品</button><button onClick={() => { window.location.href = '/compute/workflow-runs'; }}>记录</button></div>
          <small>提交后会创建运行记录，任务完成后自动保存结果。</small>
        </aside>
      </div>
      {publishOpen && <WorkflowPublishModal runId={activeRun?.id} template={template} mode={activeMode} prompt={prompt} ratio={ratio} quality={quality} durationSeconds={durationSeconds} imageCount={imageCount} resultReady={resultMode === 'done'} onClose={() => setPublishOpen(false)} />}
    </main>
  );
}

function WorkflowNodes({ nodes = ['输入图', '提示词', '黑盒加速节点', '视频采样', '结果输出'] }: { nodes?: string[] }) {
  return <div className="workflow-nodes">{nodes.map((node, index) => <div className={index === 2 ? 'core' : ''} key={node}><b>{index + 1}</b><span>{node}</span>{index < nodes.length - 1 && <i />}</div>)}</div>;
}

function WorkflowRunsPage() {
  const templates = useWorkflowTemplates();
  const [detail, setDetail] = useState<WorkflowRunRecord | null>(null);
  const [runs, setRuns] = useState<WorkflowRunRecord[]>(workflowRunRecords);
  const [activeStatus, setActiveStatus] = useState<'all' | WorkflowRunRecord['status']>('all');
  const [query, setQuery] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d'>('today');
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedRunIds, setSelectedRunIds] = useState<string[]>([]);
  useEffect(() => {
    let alive = true;
    workflowApi.runs().then(({ items }) => {
      if (alive) {
        setRuns(items);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const nowTime = new Date('2026-05-21T23:59:59').getTime();
  const rangeDays = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : 30;
  const queryText = query.trim().toLowerCase();
  const filteredRuns = runs.filter((run) => {
    const statusOk = activeStatus === 'all' || run.status === activeStatus;
    const runTime = new Date(run.createdAt.replace(' ', 'T')).getTime();
    const dateOk = Number.isNaN(runTime) ? true : nowTime - runTime <= rangeDays * 24 * 60 * 60 * 1000;
    const queryOk = !queryText || [run.id, run.title, run.statusText, run.prompt, run.ratio, run.quality].some((value) => value.toLowerCase().includes(queryText));
    return statusOk && dateOk && queryOk;
  });
  const selectedVisibleCount = filteredRuns.filter((run) => selectedRunIds.includes(run.id)).length;
  const statusFilters: Array<['all' | WorkflowRunRecord['status'], string]> = [['all', '全部'], ['running', '运行中'], ['queued', '排队中'], ['succeeded', '成功'], ['failed', '失败']];
  const dateFilters: Array<['today' | '7d' | '30d', string]> = [['today', '今天'], ['7d', '近7天'], ['30d', '近30天']];
  const succeededCount = runs.filter((run) => run.status === 'succeeded').length;
  const successRate = runs.length > 0 ? `${Math.round((succeededCount / runs.length) * 1000) / 10}%` : '0%';
  const todayVideo = runs.filter((run) => run.resultType === 'video').length;
  const todayImage = runs.filter((run) => run.resultType === 'image').length;
  const costTotal = runs.reduce((sum, run) => sum + (Number.parseFloat(run.costText) || 0), 0);
  const distribution = [
    ['视频任务', todayVideo, runs.length > 0 ? Math.round((todayVideo / runs.length) * 100) : 0],
    ['图片任务', todayImage, runs.length > 0 ? Math.round((todayImage / runs.length) * 100) : 0],
    ['成功任务', succeededCount, runs.length > 0 ? Math.round((succeededCount / runs.length) * 100) : 0],
  ];
  const queue = [
    ['#WF-240518', '图生视频', '生成中', '68%'],
    ['#WF-240519', '文生图', '排队中', '预计 1 分钟'],
    ['#WF-240520', '商品视频', '回传中', '12MB/s'],
  ];
  const openRunDetail = (run: WorkflowRunRecord) => {
    setDetail(run);
    setDetailLoading(true);
    workflowApi.run(run.id).then(({ item }) => {
      setDetail(item);
    }).catch(() => undefined).finally(() => {
      setDetailLoading(false);
    });
  };
  const exportRuns = () => {
    workflowApi.exportRuns().then(({ filename, items }) => {
      const visibleIds = new Set(filteredRuns.map((run) => run.id));
      const payload = items.filter((run) => visibleIds.has(run.id));
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }).catch(() => {
      const blob = new Blob([JSON.stringify(filteredRuns, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'workflow-runs.json';
      link.click();
      URL.revokeObjectURL(url);
    });
  };
  const toggleRunSelection = (runId: string) => {
    setSelectedRunIds((current) => current.includes(runId) ? current.filter((id) => id !== runId) : [...current, runId]);
  };
  const toggleVisibleSelection = () => {
    const visibleIds = filteredRuns.map((run) => run.id);
    setSelectedRunIds((current) => {
      const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => current.includes(id));
      return allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]));
    });
  };
  const deleteRuns = () => {
    const ids = selectedRunIds.length > 0 ? selectedRunIds : filteredRuns.map((run) => run.id);
    if (ids.length === 0) return;
    setRuns((current) => current.filter((run) => !ids.includes(run.id)));
    setSelectedRunIds([]);
    workflowApi.deleteRuns(ids).then(({ items }) => {
      setRuns(items);
    }).catch(() => undefined);
  };
  return (
    <main className="workflow-runs-page">
      <div className="workflow-section-head"><h1>创作记录</h1><div>{statusFilters.map(([status, label]) => <button className={activeStatus === status ? 'active' : ''} key={status} onClick={() => setActiveStatus(status)}>{label}</button>)}</div></div>
      <section className="workflow-run-summary">
        <article><span>今日生成</span><strong>{runs.length}</strong><p>视频 {todayVideo} / 图片 {todayImage}</p></article>
        <article><span>算力币消耗</span><strong>386</strong><p>失败任务已自动退回</p></article>
        <article><span>平均耗时</span><strong>86s</strong><p>近 7 日任务均值</p></article>
        <article><span>成功率</span><strong>{successRate}</strong><p>素材缺失为主要失败原因</p></article>
      </section>
      <section className="workflow-run-control">
        <div><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工作流 / 任务ID / 提示词" /><button onClick={() => setQuery('')}>{query ? '清空' : '搜索'}</button></div>
        <nav>{dateFilters.map(([range, label]) => <button className={dateRange === range ? 'active' : ''} key={range} onClick={() => setDateRange(range)}>{label}</button>)}<button onClick={toggleVisibleSelection}>{selectedVisibleCount === filteredRuns.length && filteredRuns.length > 0 ? '取消全选' : '全选'}</button><button onClick={exportRuns}>导出记录</button><button onClick={deleteRuns}>{selectedRunIds.length > 0 ? `删除${selectedRunIds.length}条` : '批量删除'}</button></nav>
      </section>
      <section className="workflow-batch-hint"><strong>{selectedRunIds.length > 0 ? `已选择 ${selectedRunIds.length} 条记录` : '批量处理'}</strong><span>{selectedRunIds.length > 0 ? '可以导出、删除，或进入详情后复跑。' : '全选当前结果后可批量导出或删除历史记录。'}</span></section>
      <section className="workflow-run-health">
        {[
          ['当前筛选', `${filteredRuns.length} 条`, activeStatus === 'all' ? '全部状态' : statusFilters.find((item) => item[0] === activeStatus)?.[1] ?? '全部状态'],
          ['已选择', `${selectedRunIds.length} 条`, selectedRunIds.length > 0 ? '可批量删除或导出' : '可全选当前结果'],
          ['累计消耗', `${costTotal} 算力币`, '按当前记录统计'],
          ['保留周期', '180 天', '到期前可手动导出归档'],
        ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
      </section>
      <section className="workflow-run-distribution">
        <article>
          <h2>产出分布</h2>
          {distribution.map((item) => <p key={item[0]}><span>{item[0]}</span><b>{item[1]}</b><i style={{ width: `${item[2]}%` }} /></p>)}
        </article>
        <article>
          <h2>导出范围</h2>
          <p><span>时间范围</span><b>{dateFilters.find((item) => item[0] === dateRange)?.[1]}</b><i style={{ width: '72%' }} /></p>
          <p><span>筛选状态</span><b>{activeStatus === 'all' ? '全部' : statusFilters.find((item) => item[0] === activeStatus)?.[1]}</b><i style={{ width: '58%' }} /></p>
          <p><span>导出字段</span><b>完整</b><i style={{ width: '100%' }} /></p>
        </article>
      </section>
      <section className="workflow-run-ops">
        <article><h2>失败原因</h2><p><span>素材尺寸不符</span><b>42%</b></p><p><span>提示词违规</span><b>31%</b></p><p><span>回传超时</span><b>18%</b></p></article>
        <article><h2>最近队列</h2>{queue.map((item) => <div key={item[0]}><span>{item[0]}</span><b>{item[1]}</b><em>{item[2]} · {item[3]}</em></div>)}</article>
      </section>
      <section className="workflow-run-replay">
        <article>
          <strong>复跑策略</strong>
          <p>成功任务可保留参数再次运行；失败任务会带上失败原因和素材校验结果，避免重复提交无效任务。</p>
        </article>
        <article>
          <strong>发布链路</strong>
          <p>生成成功后可从详情弹窗下载结果、复制参数，或进入工作台发布为模板案例。</p>
        </article>
      </section>
      <section className="workflow-runs-grid">
        {filteredRuns.map((run) => (
          <article className="workflow-run-card" key={run.id}>
            <label className="workflow-run-select"><input checked={selectedRunIds.includes(run.id)} onChange={() => toggleRunSelection(run.id)} type="checkbox" />选择</label>
            <div className={`workflow-cover ${workflowRunCover(run, templates)}`}><span>{run.statusText}</span><strong>{run.title}</strong></div>
            <div><h2>{run.title}</h2><p>{run.createdAt}</p><span>耗时 {run.durationText}</span><span>{run.costText}</span></div>
            <footer><button onClick={() => openRunDetail(run)}>查看结果</button><button onClick={() => { window.location.href = `/compute/workflows/${run.templateId}/run`; }}>再次运行</button></footer>
          </article>
        ))}
        {filteredRuns.length === 0 && <div className="workflow-empty"><strong>没有匹配的创作记录</strong><p>可以调整状态、时间范围，或换一个任务 ID / 提示词再查。</p><button onClick={() => { setActiveStatus('all'); setDateRange('30d'); setQuery(''); }}>重置筛选</button></div>}
      </section>
      {detail && <WorkflowRunDetailModal run={detail} cover={workflowRunCover(detail, templates)} loading={detailLoading} onClose={() => setDetail(null)} />}
    </main>
  );
}

function WorkflowRunDetailModal({ run, cover, loading, onClose }: { run: WorkflowRunRecord; cover: string; loading: boolean; onClose: () => void }) {
  const isFailed = run.status === 'failed';
  const isVideo = run.resultType === 'video';
  const steps = isFailed ? ['已提交', '素材校验', '已退回'] : ['已提交', '算力就绪', '生成完成', '结果入库'];
  return (
    <div className="modal-mask">
      <section className="workflow-run-detail-modal">
        <header><h2>{run.title}</h2><span>{loading ? '同步详情中' : '详情已同步'}</span><button onClick={onClose}>×</button></header>
        <div className="workflow-run-detail-body">
          <div className={`run-detail-preview ${cover} ${isFailed ? 'failed' : ''}`}>
            <span>{run.statusText}</span>
            <strong>{isFailed ? '未生成结果' : isVideo ? '视频结果' : '图片结果'}</strong>
            <p>{isFailed ? '素材尺寸不满足当前模板要求，费用已退回。' : '可下载、发布为案例，或基于相同参数再次运行。'}</p>
          </div>
          <aside>
            <p><span>任务状态</span><strong>{run.statusText}</strong></p>
            <p><span>任务 ID</span><strong>{run.id}</strong></p>
            <p><span>提交时间</span><strong>{run.createdAt}</strong></p>
            <p><span>运行耗时</span><strong>{run.durationText}</strong></p>
            <p><span>消耗费用</span><strong>{run.costText}</strong></p>
            <p><span>工作流版本</span><strong>v1.8</strong></p>
          </aside>
          <section className="run-detail-params">
            <h3>输入参数</h3>
            <div><span>提示词</span><p>{run.prompt}</p></div>
            <div><span>比例/质量</span><p>{run.ratio} / {run.quality}</p></div>
            <div><span>Seed</span><p>{run.seed}</p></div>
          </section>
          <section className="run-detail-assets">
            <h3>生成产物</h3>
            <div>
              {['封面', '首帧', '中间帧', isVideo ? 'MP4' : '原图'].map((item) => <span key={item}>{item}</span>)}
            </div>
          </section>
          <section className="run-detail-resolution">
            <h3>{isFailed ? '处理建议' : '结果去向'}</h3>
            {isFailed
              ? <div><span>退费状态</span><p>已自动退回</p><span>建议操作</span><p>更换素材尺寸后再次运行</p></div>
              : <div><span>资产归档</span><p>创作记录 / 资产包</p><span>可用操作</span><p>下载、复跑、发布案例</p></div>}
          </section>
          <section className="run-detail-timeline">
            <h3>任务进度</h3>
            <div>{steps.map((step, index) => <span className={index === steps.length - 1 ? 'current' : ''} key={step}>{step}</span>)}</div>
          </section>
          <section className="run-detail-log">
            <h3>运行日志</h3>
            <pre>{isFailed ? '[17:01:20] 素材检查失败\n[17:01:21] 任务取消，算力币已退回' : '[17:18:04] 任务创建\n[17:18:22] 弹性算力就绪\n[17:19:36] 视频生成完成\n[17:19:42] 输出已保存'}</pre>
          </section>
        </div>
        <footer><button onClick={onClose}>关闭</button><button onClick={() => { window.location.href = `/compute/workflows/${run.templateId}/run`; }}>再次运行</button><button className="primary">下载结果</button></footer>
      </section>
    </div>
  );
}

function MyWorkflowsPage() {
  const [modal, setModal] = useState<'create' | 'version' | 'share' | ''>('');
  const [activeStatus, setActiveStatus] = useState('全部');
  const [activeCategory, setActiveCategory] = useState('全部分类');
  const [templateShelfTab, setTemplateShelfTab] = useState('官方模板');
  const [query, setQuery] = useState('');
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>([]);
  const templates = useWorkflowTemplates();
  const [mineItems, setMineItems] = useState<WorkflowMineItem[]>(() => templates.map((item, index) => {
    const row = workflowTemplateToMineRow(item, index);
    return { ...item, status: row[2], version: row[3], visibility: row[2] === '已发布' ? 'public' : 'private', monthlyRevenue: 0, auditNote: row[2] === '已发布' ? '已上架' : '等待处理' };
  }));
  const [mineSummary, setMineSummary] = useState<WorkflowMineSummary>({ revenue: 1286.4, published: 0, drafts: 0, auditing: 0, rating: 4.8 });
  useEffect(() => {
    if (templates.length > 0) {
      setMineItems((current) => current.length > 0 ? current : templates.map((item, index) => {
        const row = workflowTemplateToMineRow(item, index);
        return { ...item, status: row[2], version: row[3], visibility: row[2] === '已发布' ? 'public' : 'private', monthlyRevenue: 0, auditNote: row[2] === '已发布' ? '已上架' : '等待处理' };
      }));
    }
  }, [templates]);
  useEffect(() => {
    let alive = true;
    workflowApi.mine().then(({ items, summary }) => {
      if (alive) {
        setMineItems(items);
        setMineSummary(summary);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const mine = mineItems.map(workflowMineToRow);
  const queryText = query.trim().toLowerCase();
  const categoryTabs = ['全部分类', ...Array.from(new Set(mineItems.map((item) => item.category)))];
  const filteredMine = mine.filter((row) => {
    const template = mineItems.find((item) => item.id === row[0]) ?? templates.find((item) => item.id === row[0]);
    const statusOk = activeStatus === '全部' || row[2] === activeStatus;
    const categoryOk = activeCategory === '全部分类' || template?.category === activeCategory;
    const queryOk = !queryText || [row[0], row[1], row[2], row[3], row[4], row[5], template?.summary ?? '', template?.category ?? ''].some((value) => value.toLowerCase().includes(queryText));
    return statusOk && categoryOk && queryOk;
  });
  const filteredIds = filteredMine.map((row) => row[0]);
  const selectedVisibleCount = filteredIds.filter((id) => selectedWorkflowIds.includes(id)).length;
  const shelfCards = (templateShelfTab === '官方模板' ? templates.slice(0, 4) : templateShelfTab === '最近使用' ? templates.slice(1, 5) : templates.filter((item) => ['ltx-video', 'product-video'].includes(item.id))).map(workflowTemplateToCard);
  const statusTabs = ['全部', '已发布', '草稿', '审核中'];
  const publishedCount = mineSummary.published || mine.filter((row) => row[2] === '已发布').length;
  const draftCount = mineSummary.drafts || mine.filter((row) => row[2] === '草稿').length;
  const auditingCount = mineSummary.auditing || mine.filter((row) => row[2] === '审核中').length;
  const audits = [
    ['Wan2.2 剧情分镜', '待审核', '预计 2 小时内完成'],
    ['数字人口播片段', '素材复核', '需补充封面示例'],
    ['赛博风格转绘', '准备上架', '定价已确认'],
  ];
  const addMineItem = (item: WorkflowMineItem) => {
    setMineItems((current) => [item, ...current]);
    setMineSummary((current) => ({
      ...current,
      drafts: current.drafts + (item.status === '草稿' ? 1 : 0),
      auditing: current.auditing + (item.status === '审核中' ? 1 : 0),
      published: current.published + (item.status === '已发布' ? 1 : 0),
    }));
  };
  const replaceMineItem = (item: WorkflowMineItem, previousStatus?: string) => {
    setMineItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, ...item } : entry));
    if (previousStatus && previousStatus !== item.status) {
      setMineSummary((current) => ({
        ...current,
        drafts: current.drafts + (item.status === '草稿' ? 1 : 0) - (previousStatus === '草稿' ? 1 : 0),
        auditing: current.auditing + (item.status === '审核中' ? 1 : 0) - (previousStatus === '审核中' ? 1 : 0),
        published: current.published + (item.status === '已发布' ? 1 : 0) - (previousStatus === '已发布' ? 1 : 0),
      }));
    }
  };
  const updateMineStatus = (id: string, status: string) => {
    const current = mineItems.find((item) => item.id === id);
    if (!current) return;
    const optimistic = { ...current, status, visibility: status === '已发布' ? 'public' : 'private', auditNote: status === '已发布' ? '已上架' : status === '审核中' ? '等待审核' : '仅自己可见' };
    replaceMineItem(optimistic, current.status);
    workflowApi.updateTemplateStatus(id, status).then((item) => {
      replaceMineItem(item);
    }).catch(() => undefined);
  };
  const toggleWorkflowSelection = (id: string) => {
    setSelectedWorkflowIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };
  const toggleVisibleWorkflows = () => {
    setSelectedWorkflowIds((current) => {
      const allVisibleSelected = filteredIds.length > 0 && filteredIds.every((id) => current.includes(id));
      return allVisibleSelected ? current.filter((id) => !filteredIds.includes(id)) : Array.from(new Set([...current, ...filteredIds]));
    });
  };
  const bulkStatus = (status: string) => {
    const ids = selectedWorkflowIds.length > 0 ? selectedWorkflowIds : filteredIds;
    ids.forEach((id) => updateMineStatus(id, status));
    setSelectedWorkflowIds([]);
  };
  const exportMine = () => {
    const selected = selectedWorkflowIds.length > 0 ? new Set(selectedWorkflowIds) : new Set(filteredIds);
    const payload = mineItems.filter((item) => selected.has(item.id));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'my-workflows.json';
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <main className="workflow-runs-page my-workflows-page">
      <div className="workflow-section-head">
        <h1>我的工作流</h1>
        <div>{statusTabs.map((status) => <button className={activeStatus === status ? 'active' : ''} key={status} onClick={() => setActiveStatus(status)}>{status}</button>)}<button onClick={() => setModal('create')}>新建工作流</button></div>
      </div>
      <section className="workflow-author-panel">
        <div><span>创作者收益</span><strong>￥{mineSummary.revenue.toFixed(2)}</strong><p>本月工作流被运行 8,752 次</p></div>
        <div><span>发布工作流</span><strong>{publishedCount}</strong><p>{auditingCount} 个正在审核，{draftCount} 个草稿</p></div>
        <div><span>平均评分</span><strong>{mineSummary.rating}</strong><p>来自 1,204 条用户反馈</p></div>
      </section>
      <section className="workflow-mine-statusbar">
        {[
          ['当前筛选', `${filteredMine.length} 个`, activeStatus === '全部' ? activeCategory : `${activeStatus} · ${activeCategory}`],
          ['已选择', `${selectedWorkflowIds.length} 个`, selectedWorkflowIds.length > 0 ? '可批量提审、下架或导出' : '可全选当前结果'],
          ['本月转化', '18.6%', '从详情页进入运行台'],
          ['平均客单', '13.4 算力币', '近 30 日结算均值'],
        ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
      </section>
      <section className="workflow-author-dashboard">
        <article>
          <h2>收益趋势</h2>
          <div className="workflow-earnings-chart">{['42%', '68%', '54%', '82%', '75%', '92%', '88%'].map((height, index) => <span style={{ height }} key={index} />)}</div>
          <p>近 7 日运行量稳定增长，商品营销类模板转化最高。</p>
        </article>
        <article>
          <h2>发布质量</h2>
          <div className="workflow-quality-list">
            <p><span>参数说明完整</span><b>96%</b></p>
            <p><span>示例案例覆盖</span><b>88%</b></p>
            <p><span>失败退费配置</span><b>已开启</b></p>
          </div>
        </article>
        <article>
          <h2>审核队列</h2>
          {audits.map((item) => <div className="workflow-audit-row" key={item[0]}><span>{item[0]}</span><b>{item[1]}</b><em>{item[2]}</em></div>)}
        </article>
        <article>
          <h2>快捷操作</h2>
          <button onClick={() => setModal('create')}>复制官方模板</button>
          <button onClick={() => setModal('version')}>管理版本</button>
          <button onClick={() => setModal('share')}>生成分享链接</button>
        </article>
      </section>
      <section className="workflow-publish-health">
        <article><span>批量操作</span><strong>{selectedWorkflowIds.length > 0 ? `已选择 ${selectedWorkflowIds.length} 个` : '未选择'}</strong><p>{selectedWorkflowIds.length > 0 ? '可批量提审、导出或下架。' : '选择工作流后可集中处理发布状态。'}</p></article>
        <article><span>审核准备</span><strong>封面 / 案例 / 参数</strong><p>提审前检查封面尺寸、案例产物和开放参数说明。</p></article>
        <article><span>收益归因</span><strong>模板运行计费</strong><p>发布后按运行成功次数结算，失败任务自动排除。</p></article>
      </section>
      <section className="workflow-ready-banner mine"><strong>发布管理已就绪</strong><span>支持筛选、批量选择、提审、下架、导出和版本/分享入口。</span></section>
      <section className="my-workflow-table">
        <div className="my-workflow-toolbar"><strong>工作流列表 · {filteredMine.length}</strong><div><button onClick={toggleVisibleWorkflows}>{selectedVisibleCount === filteredMine.length && filteredMine.length > 0 ? '取消全选' : '全选'}</button><button onClick={() => bulkStatus('审核中')}>批量提审</button><button onClick={exportMine}>导出数据</button><button onClick={() => bulkStatus('草稿')}>下架</button></div></div>
        <div className="my-workflow-filters">
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称 / 分类 / 版本" />
          <div>{categoryTabs.map((cat) => <button className={activeCategory === cat ? 'active' : ''} key={cat} onClick={() => setActiveCategory(cat)}>{cat}</button>)}</div>
        </div>
        <div className="head"><span>工作流</span><span>状态</span><span>版本</span><span>运行量</span><span>价格</span><span>操作</span></div>
        {filteredMine.map((row) => (
          <div className={`row ${selectedWorkflowIds.includes(row[0]) ? 'selected' : ''}`} key={row[0]}>
            <span><label className="my-workflow-check"><input checked={selectedWorkflowIds.includes(row[0])} onChange={() => toggleWorkflowSelection(row[0])} type="checkbox" /></label><i className={row[6]} />{row[1]}</span><span><b className={`workflow-status ${row[2]}`}>{row[2]}</b></span><span>{row[3]}</span><span>{row[4]}</span><span>{row[5]}</span>
            <span><a href={`/compute/workflows/${row[0]}/run`}>编辑</a><a onClick={() => setModal('version')}>版本</a><a onClick={() => setModal('share')}>分享</a><a onClick={() => updateMineStatus(row[0], row[2] === '已发布' ? '草稿' : row[2] === '审核中' ? '草稿' : '审核中')}>{row[2] === '已发布' ? '下架' : row[2] === '审核中' ? '撤回' : '提审'}</a></span>
          </div>
        ))}
        {filteredMine.length === 0 && <div className="workflow-empty my-workflow-empty"><strong>没有匹配的工作流</strong><p>可以调整状态、分类或搜索关键词，再继续管理模板。</p><button onClick={() => { setActiveStatus('全部'); setActiveCategory('全部分类'); setQuery(''); }}>重置筛选</button></div>}
      </section>
      <section className="workflow-template-shelf">
        <div className="workflow-section-head"><h2>可复制模板</h2><div>{['官方模板', '最近使用', '收藏'].map((tab) => <button className={templateShelfTab === tab ? 'active' : ''} key={tab} onClick={() => setTemplateShelfTab(tab)}>{tab}</button>)}</div></div>
        <div>{shelfCards.map((card) => <WorkflowCard card={card} key={card[0]} />)}</div>
      </section>
      {modal && <MyWorkflowModal type={modal} onCreated={addMineItem} onClose={() => setModal('')} />}
    </main>
  );
}

function MyWorkflowModal({ type, onCreated, onClose }: { type: 'create' | 'version' | 'share'; onCreated: (item: WorkflowMineItem) => void; onClose: () => void }) {
  const templates = useWorkflowTemplates();
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? 'ltx-video');
  const [createMode, setCreateMode] = useState('复制官方模板');
  const [visibility, setVisibility] = useState('私有');
  const [submitting, setSubmitting] = useState(false);
  const [versions, setVersions] = useState<WorkflowVersion[]>([]);
  const [sharePermission, setSharePermission] = useState<'run' | 'copy' | 'preview'>('run');
  const [shareResult, setShareResult] = useState<WorkflowShareResult | null>(null);
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? workflowTemplates[0];
  const categories = Array.from(new Set(templates.map((item) => item.category))).slice(0, 4);
  const coverClass = workflowCoverClassName(selectedTemplate.cover);
  const title = type === 'create' ? '新建工作流' : type === 'version' ? '版本信息' : '分享工作流';
  const createTitle = `新的${selectedTemplate.category}工作流`;
  useEffect(() => {
    if (type === 'version') {
      workflowApi.versions(selectedTemplate.id).then(({ items }) => {
        setVersions(items);
      }).catch(() => {
        setVersions([
          { version: 'v1.8', status: '已发布', createdAt: '2026-05-20 18:40', note: `${selectedTemplate.category}模板新增 1080P 输出，优化失败退费逻辑` },
          { version: 'v1.7', status: '历史版本', createdAt: '2026-05-18 11:22', note: '调整提示词 schema，兼容批量运行' },
          { version: 'v1.6', status: '历史版本', createdAt: '2026-05-12 15:09', note: '首次公开发布' },
        ]);
      });
    }
  }, [selectedTemplate.category, selectedTemplate.id, type]);
  const submitModal = () => {
    if (type === 'share') {
      setSubmitting(true);
      workflowApi.share({ templateId: selectedTemplate.id, permission: sharePermission, expiresInDays: 7 }).then((result) => {
        setShareResult(result);
      }).finally(() => {
        setSubmitting(false);
      });
      return;
    }
    if (type !== 'create') {
      onClose();
      return;
    }
    const payload = {
      templateId: selectedTemplate.id,
      title: createTitle,
      category: selectedTemplate.category,
      visibility: visibility === '私有' ? 'private' as const : 'public_review' as const,
      source: createMode === '复制官方模板' ? 'official_template' : createMode === '导入 API JSON' ? 'api_json' : 'blank',
    };
    setSubmitting(true);
    workflowApi.createTemplate(payload).catch(() => ({
      ...selectedTemplate,
      id: `custom-${Date.now()}`,
      title: payload.title,
      category: payload.category,
      status: payload.visibility === 'private' ? '草稿' : '审核中',
      version: 'v0.1',
      visibility: payload.visibility,
      monthlyRevenue: 0,
      auditNote: payload.visibility === 'private' ? '新建草稿' : '等待审核',
    })).then((item) => {
      onCreated(item);
      onClose();
    }).finally(() => {
      setSubmitting(false);
    });
  };
  return (
    <div className="modal-mask">
      <section className="workflow-publish-modal my-workflow-modal">
        <header><h2>{title}</h2><button onClick={onClose}>×</button></header>
        <div className="workflow-publish-body">
          {type === 'create' && <><div className={`workflow-modal-preview ${coverClass}`}><span>官方模板</span><strong>{selectedTemplate.title}</strong><p>{selectedTemplate.summary}，已包含输入校验、计费配置、结果回传和案例发布字段。</p></div><label><span>模板</span><div>{templates.slice(0, 4).map((item) => <button className={selectedTemplateId === item.id ? 'active' : ''} key={item.id} onClick={() => setSelectedTemplateId(item.id)}>{item.title}</button>)}</div></label><label><span>创建方式</span><div>{['复制官方模板', '导入 API JSON', '空白工作流'].map((item) => <button className={createMode === item ? 'active' : ''} key={item} onClick={() => setCreateMode(item)}>{item}</button>)}</div></label><label><span>名称</span><input value={createTitle} readOnly /></label><label><span>分类</span><div>{categories.map((cat) => <button className={selectedTemplate.category === cat ? 'active' : ''} key={cat}>{cat}</button>)}</div></label><label><span>可见性</span><div>{['私有', '公开审核'].map((item) => <button className={visibility === item ? 'active' : ''} key={item} onClick={() => setVisibility(item)}>{item}</button>)}</div></label></>}
          {type === 'version' && <><label><span>工作流</span><div>{templates.slice(0, 3).map((item) => <button className={selectedTemplateId === item.id ? 'active' : ''} key={item.id} onClick={() => setSelectedTemplateId(item.id)}>{item.title}</button>)}</div></label><label><span>当前版本</span><input value={`${versions[0]?.version ?? 'v1.8'} ${versions[0]?.status ?? '已发布'}`} readOnly /></label><label><span>最近版本</span><div>{(versions.length > 0 ? versions : [{ version: 'v1.8' }, { version: 'v1.7' }, { version: 'v1.6' }]).map((item, index) => <button className={index === 0 ? 'active' : ''} key={item.version}>{item.version}</button>)}</div></label><div className="workflow-version-list">{versions.map((item) => <p key={item.version}><b>{item.version}</b><span>{item.note}</span><em>{item.createdAt} · {item.status}</em></p>)}</div><p>版本保存后会生成快照，可回滚参数 schema、封面和计费配置。</p></>}
          {type === 'share' && <><label><span>工作流</span><div>{templates.slice(0, 3).map((item) => <button className={selectedTemplateId === item.id ? 'active' : ''} key={item.id} onClick={() => { setSelectedTemplateId(item.id); setShareResult(null); }}>{item.title}</button>)}</div></label><label><span>分享链接</span><input value={shareResult?.url ?? `https://yaochuang.tech/compute/workflows/${selectedTemplate.id}`} readOnly /></label><label><span>权限</span><div><button className={sharePermission === 'run' ? 'active' : ''} onClick={() => setSharePermission('run')}>可运行</button><button className={sharePermission === 'copy' ? 'active' : ''} onClick={() => setSharePermission('copy')}>可复制</button><button className={sharePermission === 'preview' ? 'active' : ''} onClick={() => setSharePermission('preview')}>仅预览</button></div></label><div className="workflow-share-summary"><span>访问人数 {shareResult?.visits ?? 328}</span><span>运行转化 {shareResult?.conversion ?? '18.6%'}</span><span>链接 {shareResult?.expiresInDays ?? 7} 天内有效</span></div><p>{shareResult ? '分享链接已生成，可直接发送给客户或放到官网入口。' : '公开分享不会暴露黑盒节点和底层 workflow_api.json。'}</p></>}
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={submitModal} disabled={submitting}>{submitting ? '提交中' : '确定'}</button></footer>
      </section>
    </div>
  );
}

function WorkflowPublishModal({ runId, template, mode, prompt, ratio, quality, durationSeconds, imageCount, resultReady, onClose }: { runId?: string; template: WorkflowTemplate; mode: WorkflowRunPayload['mode']; prompt: string; ratio: string; quality: string; durationSeconds: number; imageCount: number; resultReady: boolean; onClose: () => void }) {
  const isImage = mode === 'text_to_image';
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState<WorkflowPublishResult | null>(null);
  const title = `${template.title}${isImage ? '作品图' : '生成片段'}`;
  const outputText = resultReady ? (isImage ? `${imageCount} 张图片结果` : `${durationSeconds} 秒视频结果`) : '待生成预览';
  const coverOptions = isImage ? ['结果 1', '结果 2', '结果 3'] : ['首帧', '中间帧', '尾帧'];
  const modeLabel = mode === 'text_to_image' ? '文生图' : mode === 'text_to_video' ? '文生视频' : '图生视频';
  const shortPrompt = prompt.length > 34 ? `${prompt.slice(0, 34)}...` : prompt;
  const submitPublish = () => {
    setSubmitting(true);
    workflowApi.publish({
      runId,
      templateId: template.id,
      title,
      destination: 'workflow_case',
      cover: isImage ? 'result-1' : 'middle-frame',
      tags: [template.category, modeLabel, quality, ratio],
      prompt,
      ratio,
      quality,
    }).then((result) => {
      setPublished(result);
    }).finally(() => {
      setSubmitting(false);
    });
  };
  return (
    <div className="modal-mask">
      <section className="workflow-publish-modal">
        <header><h2>发布作品</h2><button onClick={onClose}>×</button></header>
        <div className="workflow-publish-body">
          <div className={`publish-preview ${workflowCoverClassName(template.cover)}`}><span>{outputText}</span><strong>{template.title}</strong></div>
          <label><span>作品标题</span><input value={title} readOnly /></label>
          <label><span>发布到</span><div><button className="active">个人作品</button><button>工作流案例</button><button>私密</button></div></label>
          <label><span>封面帧</span><div>{coverOptions.map((item, index) => <button className={index === 1 ? 'active' : ''} key={item}>{item}</button>)}</div></label>
          <label><span>标签</span><div><button className="active">{template.category}</button><button className="active">{modeLabel}</button><button>{quality}</button><button>{ratio}</button></div></label>
          <div className="workflow-publish-summary"><span>提示词</span><p>{shortPrompt}</p><em>{isImage ? `${imageCount} 张` : `${durationSeconds}s`} · {quality} · {ratio}</em></div>
          {published && <div className="workflow-publish-result"><span>{published.status}</span><p>{published.url}</p><a href={published.url}>查看案例</a></div>}
          <div className="workflow-publish-checks"><span>已隐藏输入素材</span><span>允许展示参数</span><span>不公开原始节点</span></div>
          <div className="workflow-compliance-card"><strong>发布检查</strong><p><span>内容安全已通过</span><span>封面尺寸合规</span><span>费用归属当前账号</span></p></div>
          <p>发布后可在工作流详情页展示案例，优秀作品可获得算力币奖励。</p>
        </div>
        <footer><button onClick={onClose}>{published ? '关闭' : '取消'}</button><button className="primary" disabled={submitting || !!published || !resultReady} onClick={submitPublish}>{submitting ? '发布中' : published ? '已发布' : '发布'}</button></footer>
      </section>
    </div>
  );
}

function SharedDataPage() {
  const [rows, setRows] = useState<SharedDataItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ total: 0 });
  useEffect(() => {
    api.sharedData.list().then((payload) => {
      setRows(payload.data.items);
      setSummary(payload.data.summary);
    }).catch(() => undefined);
  }, []);
  return (
    <main className="shared-page">
      <div className="shared-tabs"><a className="active">共享数据</a><a>我共享的</a><a>我收藏的</a><button>＋ 发布共享</button></div>
      <div className="shared-tools"><label>搜索数据：</label><div className="shared-search">请输入数据名称 <span>⌕</span></div><a>如何使用数据？</a></div>
      <section className="shared-grid">
        {rows.map((row) => (
          <article className="shared-card" key={row.id}>
            <h2>{row.title} <span className="netdisk-icon" /> <em>{row.sourceType}</em></h2>
            <p>{row.summary}</p>
            <div><span>♙ {row.owner}</span><i /> <span>☆ {row.favoriteCount}</span></div>
          </article>
        ))}
      </section>
      <div className="shared-pager">共 {summary.total} 条 <span>‹</span><b>1</b><span>›</span> 前往 <input value="1" readOnly /> 页</div>
    </main>
  );
}

function ArtMarketPage() {
  const templates = useWorkflowTemplates();
  const primaryWorkflow = templates[0] ?? workflowTemplates[0];
  const bridgeTemplates = templates.slice(0, 3);
  const path = window.location.pathname;
  const detailOpen = path.includes('/compute/app/market/') && !path.includes('/search') && !path.includes('/tag/') && !path.includes('/weekly') && !path.includes('/base');
  const isSearch = path.includes('/compute/app/market/search');
  const isTag = path.includes('/compute/app/market/tag/');
  const isWeekly = path.includes('/compute/app/market/weekly');
  const isBase = path.includes('/compute/app/market/base');
  const activeTag = isTag ? decodeURIComponent(path.split('/tag/')[1] || 'Z-Image') : '';
  const detailAppId = detailOpen ? decodeURIComponent(path.split('/compute/app/market/')[1] || 'APP-ZIMAGE-WAN') : '';
  const tags = ['全部', '周榜', '基础镜像', '漫剧', '二次元', 'LTX-2', 'OpenClaw', 'LTX2.3', '语音', 'HeyGem', 'LongCat', 'NewBie', 'LLM', '电商', 'Flux.2', 'Z-Image', 'Qwen', 'llama', 'LORA', 'OCR', '小说', 'Sora', 'FluxGym', 'ComfyUI', 'TTS', 'AI-Toolkit', '训练', 'wan2.2', '视频', 'DeepSeek', '音频'];
  const [visibleApps, setVisibleApps] = useState<AppMarketItem[]>([]);
  const [marketSummary, setMarketSummary] = useState<Record<string, number>>({ all: 0, weekly: 0, base: 0 });
  useEffect(() => {
    let alive = true;
    api.apps.market({
      section: isWeekly ? 'weekly' : isBase ? 'base' : 'all',
      q: isSearch ? 'Zimage LORA' : '',
      tag: isTag ? activeTag : '',
    }).then((payload) => {
      if (alive) {
        setVisibleApps(payload.data.items);
        setMarketSummary(payload.data.summary);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [activeTag, isBase, isSearch, isTag, isWeekly]);
  return (
    <div className="art-page">
      <header className="art-topbar">
        <a className="art-brand" href="/compute/app/market"><span />灵渠<em>Art</em></a>
        <div className="art-search"><button>应用⌄</button><input value={isSearch ? 'Zimage LORA' : '请输入应用名称或关键词'} readOnly /><span onClick={() => { window.location.href = '/compute/app/market/search'; }}>⌕</span></div>
        <ArtUserNav />
      </header>
      <div className="art-subnav"><a className="active" href="/compute/app/market">▦ 应用</a><a href="/compute/app/models">⬡ 大模型</a><a href="/compute/app/images">☁ 镜像</a></div>
      <div className="art-layout">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['工作流广场', '/compute/workflows'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 0 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','⬡','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-market-main">
          <h1>应用广场</h1>
          <section className="art-workflow-bridge">
            <div>
              <span>AI Workflow</span>
              <h2>文生图 / 文生视频工作流</h2>
              <p>从热门模板直接进入创作台，填写提示词和素材即可生成结果。适合短视频、电商素材、角色 IP 和风格化内容。</p>
              <nav><a href="/compute/workflows">进入工作流广场</a><a href={`/compute/workflows/${primaryWorkflow.id}/run`}>立即生成</a></nav>
            </div>
            <aside>
              {bridgeTemplates.map((item) => <a href={`/compute/workflows/${item.id}`} key={item.id}>{item.title}<b>{item.priceText}</b></a>)}
            </aside>
          </section>
          <div className="art-market-tabs"><a className={!isWeekly && !isBase ? 'active' : ''} href="/compute/app/market">全部({marketSummary.all})</a><i /> <a className={isWeekly ? 'active' : ''} href="/compute/app/market/weekly">周榜</a><i /> <a className={isBase ? 'active' : ''} href="/compute/app/market/base">基础镜像</a></div>
          <div className="art-tags">{tags.map((tag, index) => <button onClick={() => { window.location.href = tag === '全部' ? '/compute/app/market' : `/compute/app/market/tag/${encodeURIComponent(tag)}`; }} className={`${index % 5 === 0 ? 'orange' : index % 3 === 0 ? 'green' : index % 2 === 0 ? 'purple' : ''} ${activeTag === tag ? 'active' : ''}`} key={tag}>{tag}</button>)}</div>
          {(isSearch || isTag || isWeekly || isBase) && <div className="art-result-summary"><strong>{isWeekly ? '周榜：按下载量排序' : isBase ? '基础镜像：可直接创建实例' : isSearch ? '搜索结果：Zimage LORA' : `标签筛选：${activeTag}`}</strong><span>共找到 {visibleApps.length} 个应用</span><a href="/compute/app/market">清除筛选</a></div>}
          {isWeekly && <section className="art-rank-list">
            {visibleApps.slice(0, 6).map((app, index) => <article key={app.id} onClick={() => { window.location.href = `/compute/app/market/${app.id}`; }}><b>{index + 1}</b><div className={`mini-cover ${app.coverTone}`}>{app.badge}</div><div><h2>{app.name}</h2><p>{app.author} · {app.summary}</p></div><span>下载 {app.downloadCount}</span><span>运行 {app.runtimeText}</span></article>)}
          </section>}
          {!isWeekly && <section className={`art-card-grid ${isBase ? 'base-mode' : ''}`}>
            {visibleApps.map((app) => (
              <article className="art-app-card" key={app.id} onClick={() => { window.location.href = `/compute/app/market/${app.id}`; }}>
                <div className={`art-cover ${app.coverTone}`}><b>{app.badge}</b><strong>{app.name.slice(0, 18)}</strong></div>
                <h2>{app.name}</h2>
                <p className="author"><span />{app.author}</p>
                <div className="stats"><span>☆ {app.favoriteCount}</span><span>◷ {app.runtimeText}</span><span>⇩ {app.downloadCount}</span></div>
                <p className="desc">{app.summary}</p>
              </article>
            ))}
          </section>}
          {visibleApps.length === 0 && <div className="art-no-result"><strong>暂无相关应用</strong><p>换一个关键词或标签试试</p><a href="/compute/app/market">返回应用广场</a></div>}
        </main>
      </div>
      {detailOpen && <ArtAppDetail appId={detailAppId} />}
    </div>
  );
}

function ArtCreatePanelModal({ type, onClose }: { type: 'select' | 'mine' | 'cost'; onClose: () => void }) {
  const [appRows, setAppRows] = useState<AppMarketItem[]>([]);
  useEffect(() => {
    if (type === 'cost') return undefined;
    let alive = true;
    api.apps.market({ section: 'all' }).then((payload) => {
      if (alive) setAppRows(payload.data.items.slice(0, 6));
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [type]);
  const costRows = [
    ['GPU费用', 'RTX 5090-32G × 1', '￥-.--/时'],
    ['系统盘基础容量', '30GB', '￥0.1/日'],
    ['系统盘扩容', '未开启', '￥0.00/日'],
    ['公网服务', 'WebUI-6006 / WebUI-6008', '按流量计费'],
  ];
  const isCost = type === 'cost';
  return (
    <div className="art-action-mask">
      <section className={`art-panel-modal ${isCost ? 'cost' : ''}`}>
        <header><h2>{type === 'select' ? '选择应用' : type === 'mine' ? '我的常用应用' : '费用明细'}</h2><button onClick={onClose}>×</button></header>
        {isCost ? (
          <div className="panel-cost-body">
            <div className="cost-total"><span>预估配置费用</span><strong>￥-.-- / 时</strong><small>最终费用以实例创建时库存和计费策略为准</small></div>
            <div className="panel-cost-table">
              <div className="head"><span>费用项</span><span>配置</span><span>价格</span></div>
              {costRows.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
            </div>
          </div>
        ) : (
          <div className="panel-app-body">
            <div className="panel-app-search"><input value="" readOnly placeholder="搜索应用名称或开发者" /><button>搜索</button></div>
            <div className="panel-app-list">
              {appRows.map((row, index) => <article className={index === 0 ? 'active' : ''} key={row.id}><b>{row.badge}</b><div><h3>{row.name}</h3><p>{row.author} · {row.category}</p><span>运行时长 {row.runtimeText}</span></div><button>选择</button></article>)}
            </div>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>{isCost ? '知道了' : '确认选择'}</button></footer>
      </section>
    </div>
  );
}

function ArtAppDetail({ appId }: { appId: string }) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const [detail, setDetail] = useState<AppDetail | null>(null);
  useEffect(() => {
    let alive = true;
    api.apps.detail(appId).then((payload) => {
      if (alive) setDetail(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [appId]);
  const fallback: AppDetail = {
    id: appId || 'APP-ZIMAGE-WAN',
    name: '应用详情',
    author: '灵渠',
    version: 'v1',
    category: '应用',
    summary: '应用配置已同步',
    badge: '精',
    coverTone: 'dark',
    favoriteCount: 0,
    runtimeText: '0h',
    downloadCount: 0,
    tags: ['应用'],
    isBase: false,
    status: 'published',
    isFavorite: false,
    updatedAt: '',
    appKey: appId || 'APP-ZIMAGE-WAN:v1',
    startCommand: 'bash /root/start-app.sh',
    serviceTips: '开机后稍等片刻，等程序自动运行后，点击 WebUI-6006 即可打开应用界面。',
    docLines: ['应用配置已同步。'],
    versions: [['v1', '2026-05-21', '基础版本', '当前版本']],
    reviews: [['灵渠用户', '★★★★★', '应用配置已同步。', '2026-05-21']],
    services: [['WebUI-6006', '6006', '应用服务', '可访问']],
    auditChecks: [],
  };
  const app = detail ?? fallback;
  const shortTitle = app.name.length > 18 ? app.name.slice(0, 18) : app.name;
  const deploySummary = [
    ['推荐规格', 'RTX 5090 / 4090D'],
    ['启动耗时', app.runtimeText || '约 3 分钟'],
    ['服务端口', app.services.map((row) => row[1]).join(' / ') || '6006'],
    ['计费方式', '按量 / 包日 / 包周'],
  ];
  return (
    <div className="art-detail-mask">
      <section className="art-detail-modal">
        <aside className="art-detail-side">
          <div className={`detail-cover ${app.coverTone}`}><strong>{shortTitle}</strong><span>{app.category}</span></div>
          <p>{app.summary}</p>
          <div className="detail-stats"><span>☆ {app.favoriteCount}</span><span>◷ {app.runtimeText}</span><span>⇩ {app.downloadCount}</span></div>
          <h3>开发者</h3><p className="avatar-line"><i />{app.author}</p>
          <h3>应用分类</h3><div className="detail-tags">{app.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
          <h3>更新时间</h3><p>{app.updatedAt || '-'}</p>
          <h3>应用版本</h3><div className="detail-select">{app.version} <span>⌄</span></div>
          <h3>应用ID</h3><p>{app.appKey} ⧉</p>
          <h3>开机启动命令</h3><p>{app.startCommand} ⧉</p>
          <div className="detail-deploy-summary">
            {deploySummary.map((row) => <article key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></article>)}
          </div>
          <div className="detail-actions"><button>分享应用</button><button>部署应用</button></div>
        </aside>
        <main className="art-detail-main">
          <button className="detail-close" onClick={() => { window.location.href = '/compute/app/market'; }}>×</button>
          <h1>{app.name}</h1>
          <div className="detail-service-box">
            <p>{app.serviceTips}</p>
            <div className="service-row"><h3>访问实例</h3><span>JupyterLab</span><span>AutoPanel</span><span>SSH</span></div>
            <div className="service-row"><h3>访问应用服务</h3><span>WebUI-6006</span><span>WebUI-6008</span></div>
          </div>
          <section className="detail-launch-panel">
            <div>
              <h2>一键部署配置</h2>
              <p>按当前应用版本创建实例，系统盘、端口和启动命令会自动写入。当前版本会按配置生成部署任务。</p>
            </div>
            <aside>
              <button onClick={() => { window.location.href = '/compute/app/instances/create'; }}>创建实例</button>
              <button onClick={() => { window.location.href = '/compute/workflows'; }}>查看工作流</button>
            </aside>
          </section>
          <section className="detail-doc">
            {app.docLines.map((line) => <p key={line}>{line}</p>)}
            <div className="detail-video"><span>{app.name} · 快速启动指南</span></div>
          </section>
          {app.auditChecks.length > 0 && <section className="detail-audit-section">
            <h2>发布检查</h2>
            <div>{app.auditChecks.map((row) => <article key={row[0]}><b>{row[0]}</b><span>{row[1]}</span><em>{row[2]}</em></article>)}</div>
          </section>}
          <section className="detail-version-section">
            <h2>版本历史</h2>
            <div className="detail-version-table">
              <div className="head"><span>版本</span><span>更新时间</span><span>说明</span><span>状态</span></div>
              {app.versions.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 3 ? 'state' : ''} key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="detail-review-section">
            <div className="review-summary">
              <strong>4.8</strong>
              <span>★★★★★</span>
              <p>基于 {app.favoriteCount} 次收藏和近期使用反馈</p>
            </div>
            <div className="review-list">
              <div className="review-list-head"><h2>用户评价</h2><button onClick={() => setReviewOpen(true)}>写评价</button></div>
              {app.reviews.map((row) => <article key={row[0]}><b>{row[0].slice(0, 1)}</b><div><h3>{row[0]} <span>{row[1]}</span></h3><p>{row[2]}</p><time>{row[3]}</time></div></article>)}
            </div>
          </section>
        </main>
      </section>
      {reviewOpen && <ArtReviewModal onClose={() => setReviewOpen(false)} />}
    </div>
  );
}

function ArtReviewModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="art-action-mask nested">
      <section className="art-review-modal">
        <header><h2>评价应用</h2><button onClick={onClose}>×</button></header>
        <div className="review-form-body">
          <div className="review-app-line"><strong>Zimage-Wan-Ltx2.3-训练器</strong><span>最近使用实例：ins-art-zimage-20260518</span></div>
          <label><span>综合评分</span><div className="review-stars"><button className="active">★</button><button className="active">★</button><button className="active">★</button><button className="active">★</button><button className="active">★</button></div></label>
          <label><span>使用场景</span><div className="review-tags"><button className="active">LoRA训练</button><button>Z-Image</button><button>ComfyUI</button><button>启动速度</button></div></label>
          <label className="textarea"><span>评价内容</span><textarea value="镜像启动清晰，WebUI-6006 入口和训练模板都比较完整，适合快速复现训练流程。" readOnly /></label>
          <div className="review-form-options"><label><input type="checkbox" checked readOnly /> 匿名展示</label><label><input type="checkbox" checked readOnly /> 同步给开发者作为反馈</label></div>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>提交评价</button></footer>
      </section>
    </div>
  );
}

function ArtSectionPage() {
  const path = window.location.pathname;
  if (path.includes('/models')) {
    return <ArtModelsPage />;
  }
  if (path.includes('/images')) {
    return <ArtImagesPage />;
  }
  if (path.includes('/instances/create')) {
    return <ArtInstanceCreatePage />;
  }
  if (path.includes('/create')) {
    return <ArtCreatePage />;
  }
  if (path.includes('/mine/detail')) {
    return <ArtMineDetailPage />;
  }
  if (path.includes('/mine')) {
    return <ArtMinePage />;
  }
  if (path.includes('/instances/workspace')) {
    return <ArtInstanceWorkspacePage />;
  }
  if (path.includes('/instances/detail')) {
    return <ArtInstanceDetailPage />;
  }
  if (path.includes('/instances')) {
    return <ArtInstancesPage />;
  }
  if (path.includes('/incentive')) {
    return <ArtIncentivePage />;
  }
  if (path.includes('/messages')) {
    return <ArtMessagesPage />;
  }
  if (path.includes('/profile')) {
    return <ArtProfilePage />;
  }
  if (path.includes('/billing')) {
    return <ArtBillingPage />;
  }
  if (path.includes('/dashboard')) {
    return <ArtModelAdminPage kind="dashboard" />;
  }
  if (path.includes('/tokens')) {
    return <ArtModelAdminPage kind="tokens" />;
  }
  if (path.includes('/settings')) {
    return <ArtModelAdminPage kind="settings" />;
  }
  if (path.includes('/login')) {
    return <ArtAuthPage mode="login" />;
  }
  if (path.includes('/register')) {
    return <ArtAuthPage mode="register" />;
  }
  const title = path.includes('/models') ? '公共模型' : path.includes('/images') ? '镜像' : path.includes('/mine') ? '我的' : path.includes('/instances') ? '应用实例' : path.includes('/incentive') ? '创作激励' : path.includes('/login') ? '登录' : path.includes('/register') ? '注册' : '应用广场';
  return (
    <div className="art-page">
      <header className="art-topbar">
        <a className="art-brand" href="/compute/app/market"><span />灵渠<em>Art</em></a>
        <div className="art-search"><button>应用⌄</button><input value="请输入应用名称或关键词" readOnly /><span>⌕</span></div>
        <ArtUserNav />
      </header>
      <div className="art-subnav"><a href="/compute/app/market">▦ 应用</a><a className={path.includes('/models') ? 'active' : ''} href="/compute/app/models">⬡ 大模型</a><a className={path.includes('/images') ? 'active' : ''} href="/compute/app/images">☁ 镜像</a></div>
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={title === item[0] ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-section-main">
          <h1>{title}</h1>
          <div className="art-empty-panel">
            <strong>{title}</strong>
            <p>该入口已接入应用市场导航和统一账户，当前展示核心信息流与常用操作入口。</p>
            <a href="/compute/app/market">返回应用广场</a>
          </div>
        </main>
      </div>
    </div>
  );
}

function ArtProfilePage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [securityRows, setSecurityRows] = useState<AccountSecurityItem[]>([]);
  const [subRows, setSubRows] = useState<SubAccountItem[]>([]);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [setting, setSetting] = useState<AccountSetting>({ messageNotify: true, defaultRegion: '重庆A区', releaseReminder: true });
  useEffect(() => {
    let alive = true;
    api.account.security().then((payload) => {
      if (alive) {
        setProfile(payload.data.profile);
        setSecurityRows(payload.data.items);
      }
    }).catch(() => undefined);
    api.account.subAccounts().then((payload) => {
      if (alive) setSubRows(payload.data.items);
    }).catch(() => undefined);
    api.wallet.summary().then((payload) => {
      if (alive) setWallet(payload.data);
    }).catch(() => undefined);
    api.account.settings().then((payload) => {
      if (alive) setSetting(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const displayName = profile?.nickName || profile?.userName || '17717677953';
  const profileEmail = profile?.email || 'admin.local';
  const profileMobile = profile?.mobile || profile?.userName || '17717677953';
  const uid = profile?.userId ?? 416943;
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['消息中心', '/compute/art/messages'],
            ['账号资料', '/compute/art/profile'],
          ].map((item, index) => <a className={index === 7 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','◉','◎'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-profile-main">
          <div className="art-user-head">
            <h1>账号资料</h1>
            <div><button>保存设置</button><button onClick={() => { window.location.href = '/compute/art/messages'; }}>消息中心</button></div>
          </div>
          <section className="profile-hero">
            <div className="profile-avatar">灵</div>
            <div>
              <h2>{displayName}</h2>
              <p>灵渠 Art 创作者账号 · UID {uid} · {setting.defaultRegion}默认资源池</p>
              <div><span>个人认证</span><span>算力会员</span><span>API 已开通</span></div>
            </div>
            <aside><span>账户余额</span><strong>￥{(wallet?.balanceCny ?? 0).toFixed(2)}</strong><button onClick={() => { window.location.href = '/compute/app/billing'; }}>充值</button></aside>
          </section>
          <section className="art-overview-grid">
            {[
              ['安全项', `${securityRows.filter((row) => row.ok).length}/${securityRows.length || 4}`, '密码、手机、实名、邮箱'],
              ['子账号', String(subRows.length), '团队权限可分配'],
              ['默认区域', setting.defaultRegion, '创建实例默认选区'],
              ['通知', setting.messageNotify ? '已开启' : '未开启', '余额、实例、账单提醒'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <div className="profile-grid">
            <section className="profile-card">
              <h2>基本资料</h2>
              <label><span>昵称</span><input value={displayName} readOnly /></label>
              <label><span>手机号</span><input value={profileMobile} readOnly /></label>
              <label><span>默认区域</span><input value={setting.defaultRegion} readOnly /></label>
              <label><span>联系邮箱</span><input value={profileEmail} readOnly /></label>
            </section>
            <section className="profile-card">
              <h2>通知偏好</h2>
              {['实例开关机结果', '余额不足提醒', '账单出账通知', '应用审核进度'].map((item) => <label className="profile-check" key={item}><input type="checkbox" checked={setting.messageNotify} readOnly /> {item}</label>)}
              <div className="profile-channel"><button className="active">站内信</button><button className={setting.messageNotify ? 'active' : ''}>短信</button><button className={setting.messageNotify ? 'active' : ''}>邮件</button><button>企业微信</button></div>
            </section>
          </div>
          <section className="profile-card">
            <div className="profile-section-title"><h2>安全与认证</h2><a href="/compute/account/security">进入主账号安全中心</a></div>
            <div className="profile-security-table">
              <div className="head"><span>项目</span><span>状态</span><span>说明</span><span>操作</span></div>
              {securityRows.slice(0, 4).map((row) => <div className="row" key={row.key}><span>{row.title}</span><span>{row.status}</span><span>{row.desc}</span><span className="link">{row.action}</span></div>)}
            </div>
          </section>
          <section className="profile-api-card">
            <article><span>API Key</span><strong>2 个</strong><p>模型调用与弹性部署共用权限</p></article>
            <article><span>子账号</span><strong>{subRows.length} 个</strong><p>可限制实例、账单和镜像操作范围</p></article>
            <article><span>安全白名单</span><strong>0.0.0.0/0</strong><p>支持按 IP 段限制访问</p></article>
          </section>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtMessagesPage() {
  const path = window.location.pathname;
  const active = path.includes('/billing') ? 'billing' : path.includes('/instance') ? 'instance' : path.includes('/system') ? 'system' : 'all';
  const [visibleRows, setVisibleRows] = useState<MessageItem[]>([]);
  const loadMessages = () => api.messages.list(active === 'all' ? '' : active).then((payload) => setVisibleRows(payload.data.items)).catch(() => undefined);
  useEffect(() => {
    loadMessages();
  }, [active]);
  const markRead = () => api.messages.readAll().then(() => loadMessages()).catch(() => undefined);
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['消息中心', '/compute/art/messages'],
            ['账号资料', '/compute/art/profile'],
          ].map((item, index) => <a className={index === 6 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','◉','◎'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-message-main">
          <div className="art-user-head">
            <h1>消息中心</h1>
            <div><button onClick={markRead}>全部标为已读</button><button>消息设置</button></div>
          </div>
          <section className="art-overview-grid">
            {[
              ['全部消息', String(visibleRows.length), '当前筛选结果'],
              ['未读', String(visibleRows.filter((row) => row.readStatus === '未读').length), '需要处理的消息'],
              ['实例事件', String(visibleRows.filter((row) => row.type === 'instance').length), '开关机与服务状态'],
              ['账单提醒', String(visibleRows.filter((row) => row.type === 'billing').length), '充值、扣费、发票'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <div className="message-filter">
            <a className={active === 'all' ? 'active' : ''} href="/compute/art/messages">全部</a>
            <a className={active === 'system' ? 'active' : ''} href="/compute/art/messages/system">系统公告</a>
            <a className={active === 'instance' ? 'active' : ''} href="/compute/art/messages/instance">实例事件</a>
            <a className={active === 'billing' ? 'active' : ''} href="/compute/art/messages/billing">账单提醒</a>
            <label>搜索<input value="" readOnly placeholder="消息标题/内容" /></label>
          </div>
          <div className="message-layout">
            <section className="message-list">
              {visibleRows.map((row, index) => (
                <article className={index === 0 ? 'active' : ''} key={row.id}>
                  <b className={row.readStatus === '未读' ? 'unread' : ''}>{row.typeText}</b>
                  <div><h2>{row.title}</h2><p>{row.content}</p></div>
                  <time>{row.createdAt}</time>
                  <span>{row.readStatus}</span>
                </article>
              ))}
            </section>
            <aside className="message-detail">
              <span>{visibleRows[0]?.typeText ?? '消息'}</span>
              <h2>{visibleRows[0]?.title ?? '暂无消息'}</h2>
              <time>{visibleRows[0]?.createdAt ?? ''}</time>
              <p>{visibleRows[0]?.content ?? '当前筛选条件下没有消息。'}</p>
              <div>
                <button onClick={() => { window.location.href = '/compute/app/instances'; }}>查看实例</button>
                <button onClick={() => { window.location.href = '/compute/app/billing/detail'; }}>查看账单</button>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtAuthPage({ mode }: { mode: 'login' | 'register' }) {
  const isRegister = mode === 'register';
  const [userName, setUserName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [rememberLogin, setRememberLogin] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const normalizedUserName = userName.trim();
    if (!normalizedUserName) {
      setStatus('请输入账号');
      return;
    }
    if (!password) {
      setStatus('请输入密码');
      return;
    }
    if (isRegister && password.length < 6) {
      setStatus('密码至少6位');
      return;
    }
    if (isRegister && password !== confirmPassword) {
      setStatus('两次输入的密码不一致');
      return;
    }
    if (isRegister && !agreeTerms) {
      setStatus('请先阅读并同意用户服务协议和隐私政策');
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      const result = isRegister
        ? await api.user.register({ user_name: normalizedUserName, pwd: password, sp_id: 0 })
        : await api.user.login(normalizedUserName, password);
      window.localStorage.setItem('compute_user_token', result.token);
      window.localStorage.setItem('compute_remember_login', rememberLogin ? '1' : '0');
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next || '/compute/app/market';
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '请求失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className={`art-page art-auth-page ${isRegister ? 'register' : 'login'}`}>
      <header className="art-topbar">
        <a className="art-brand" href="/compute/app/market"><span />灵渠<em>Art</em></a>
        <div className="art-search"><button>应用⌄</button><input value="请输入应用名称或关键词" readOnly /><span>⌕</span></div>
        <ArtUserNav activeLogin={!isRegister} />
      </header>
      <div className="art-auth-wrap">
        <div className="art-auth-mobile-hero"><strong>{isRegister ? '注册灵渠账号' : '登录灵渠账号'}</strong><span>统一访问算力、应用和工作流</span></div>
        <section className="art-auth-panel">
          <div className="art-auth-copy">
            <h1>{isRegister ? '注册灵渠 Art' : '登录灵渠 Art'}</h1>
            <p>进入应用市场、实例管理、钱包账单和模型 API 控制台。</p>
            <div>
              <span>应用实例</span><span>公共模型</span><span>镜像市场</span><span>费用中心</span>
            </div>
            <ul>
              <li>统一账号访问算力、应用、工作流和模型 API</li>
              <li>实例、账单、发票、消息提醒统一管理</li>
              <li>文生图、文生视频工作流按次计费</li>
            </ul>
          </div>
          <form className="art-auth-form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <h2>{isRegister ? '创建账号' : '账号登录'}</h2>
            <label><span>账号</span><input value={userName} autoComplete="username" onChange={(event) => setUserName(event.target.value)} /></label>
            <label><span>密码</span><div className="auth-password-field"><input type={showPassword ? 'text' : 'password'} value={password} autoComplete={isRegister ? 'new-password' : 'current-password'} onChange={(event) => setPassword(event.target.value)} /><button type="button" aria-label={showPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? '◉' : '◌'}</button></div></label>
            {isRegister && <label><span>确认密码</span><div className="auth-password-field"><input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword} autoComplete="new-password" onChange={(event) => setConfirmPassword(event.target.value)} /><button type="button" aria-label={showConfirmPassword ? '隐藏密码' : '显示密码'} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? '◉' : '◌'}</button></div></label>}
            {!isRegister && <div className="auth-options"><label className={`auth-check el-checkbox el-checkbox--small ${rememberLogin ? 'is-checked' : ''}`}><span className={`el-checkbox__input ${rememberLogin ? 'is-checked' : ''}`}><span className="el-checkbox__inner" /><input className="el-checkbox__original" type="checkbox" checked={rememberLogin} onChange={(event) => setRememberLogin(event.target.checked)} /></span><span className="el-checkbox__label">记住登录状态</span></label><a>忘记密码</a></div>}
            {isRegister && <label className={`auth-agree auth-check el-checkbox el-checkbox--small ${agreeTerms ? 'is-checked' : ''}`}><span className={`el-checkbox__input ${agreeTerms ? 'is-checked' : ''}`}><span className="el-checkbox__inner" /><input className="el-checkbox__original" type="checkbox" checked={agreeTerms} onChange={(event) => setAgreeTerms(event.target.checked)} /></span><span className="el-checkbox__label">我已阅读并同意《用户服务协议》和《隐私政策》</span></label>}
            {status && <div className="art-auth-status">{status}</div>}
            <button className="auth-submit" type="submit" disabled={busy}>{busy ? '处理中...' : isRegister ? '注册并进入控制台' : '登录'}</button>
            <p>{isRegister ? '已有账号？' : '还没有账号？'}<a href={isRegister ? '/compute/art/login' : '/compute/art/register'}>{isRegister ? '立即登录' : '立即注册'}</a></p>
          </form>
          {!isRegister && <aside className="art-auth-qr"><div>灵渠</div><strong>扫码登录</strong><span>微信扫码后在移动端确认登录</span></aside>}
        </section>
      </div>
    </div>
  );
}

function ArtModelAdminPage({ kind }: { kind: 'dashboard' | 'tokens' | 'settings' }) {
  const [modal, setModal] = useState<'export' | 'token' | 'save' | ''>('');
  const title = kind === 'dashboard' ? '数据看板' : kind === 'tokens' ? '令牌管理' : '设置';
  const [dashboard, setDashboard] = useState<ModelDashboard | null>(null);
  const [tokens, setTokens] = useState<ApiTokenItem[]>([]);
  const [settings, setSettings] = useState<ModelSetting | null>(null);
  const loadAdmin = () => {
    if (kind === 'dashboard') api.modelAdmin.dashboard().then((payload) => setDashboard(payload.data)).catch(() => undefined);
    if (kind === 'tokens') api.modelAdmin.tokens().then((payload) => setTokens(payload.data.items)).catch(() => undefined);
    if (kind === 'settings') api.modelAdmin.settings().then((payload) => setSettings(payload.data)).catch(() => undefined);
  };
  useEffect(() => {
    loadAdmin();
  }, [kind]);
  const usageRows = dashboard?.usageRows ?? [];
  const tokenRows = tokens.map((row) => [row.name, row.mask, row.scope, row.createdAt, row.status]);
  const settingRows = settings ? [
    ['默认模型', settings.defaultModel, '用于控制台试算和 API 示例的默认模型'],
    ['费用预警', settings.dailyBudget, '达到阈值后通过站内信和短信提醒'],
    ['并发限制', settings.concurrencyLimit, '按账号等级和模型供应策略动态调整'],
    ['回调地址', settings.callbackUrl, '模型异步任务完成后推送结果'],
  ] : [];
  return (
    <ArtShell active="models">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['模型广场', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['数据看板', '/compute/art/dashboard'],
            ['令牌管理', '/compute/art/tokens'],
            ['设置', '/compute/art/settings'],
          ].map((item, index) => <a className={title === item[0] ? 'active' : ''} href={item[1]} key={item[0]}><span>{['◇','▦','▥','▣','▤'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-admin-main">
          <div className="art-user-head">
            <h1>{title}</h1>
            <div><button onClick={() => setModal(kind === 'tokens' ? 'token' : kind === 'settings' ? 'save' : 'export')}>{kind === 'tokens' ? '创建令牌' : kind === 'settings' ? '保存设置' : '导出报表'}</button><button>刷新</button></div>
          </div>
          {kind === 'dashboard' && (
            <>
              <section className="art-admin-stats">
                {(dashboard?.stats ?? []).map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
              </section>
              <section className="art-admin-chart"><div><i /><i /><i /><i /><i /><i /><i /></div><aside><b>峰值 {dashboard?.peak.value ?? '-'}</b><span>{dashboard?.peak.time ?? '-'}</span><p>按小时统计模型调用、消耗 token 和错误率。</p></aside></section>
              <ArtAdminTable heads={['模型', 'Token 用量', '费用', '请求数', '成功率']} rows={usageRows} />
            </>
          )}
          {kind === 'tokens' && (
            <>
              <div className="art-admin-filter"><button className="active">全部令牌</button><button>启用</button><button>停用</button><label>搜索<input value="" readOnly placeholder="令牌名称" /></label></div>
              <ArtAdminTable heads={['名称', '密钥', '权限范围', '创建时间', '状态']} rows={tokenRows} />
              <section className="art-token-guide"><h2>调用示例</h2><pre>{`curl https://api.yaochuang.tech/v1/chat/completions \\\n  -H "Authorization: Bearer sk-****" \\\n  -d '{"model":"DeepSeek-V4-Pro","messages":[{"role":"user","content":"hi"}]}'`}</pre></section>
            </>
          )}
          {kind === 'settings' && (
            <section className="art-settings-form">
              {[
                ...settingRows,
              ].map((row) => <label key={row[0]}><span>{row[0]}</span><input value={row[1]} readOnly /><small>{row[2]}</small></label>)}
              <div className="art-setting-switches"><label><input type="checkbox" checked={settings?.dailyReport ?? true} readOnly /> 开启用量日报</label><label><input type="checkbox" checked={settings?.autoRetry ?? true} readOnly /> 失败请求自动重试</label><label><input type="checkbox" checked={settings?.ipWhitelist ?? false} readOnly /> 仅允许白名单 IP</label></div>
            </section>
          )}
        </main>
      </div>
      {modal && <ArtModelAdminModal type={modal} settings={settings} onDone={loadAdmin} onClose={() => setModal('')} />}
    </ArtShell>
  );
}

function ArtModelAdminModal({ type, settings, onDone, onClose }: { type: 'export' | 'token' | 'save'; settings?: ModelSetting | null; onDone?: () => void; onClose: () => void }) {
  const isToken = type === 'token';
  const isExport = type === 'export';
  const [submitting, setSubmitting] = useState(false);
  const submit = () => {
    setSubmitting(true);
    const request = isToken
      ? api.modelAdmin.createToken({ tokenName: 'prod-chat-agent-new', permissionScope: '全部模型', dailyQuota: '￥500.00 / 日' })
      : type === 'save'
        ? api.modelAdmin.updateSettings(settings ?? { defaultModel: 'DeepSeek-V4-Pro', dailyBudget: '￥500.00 / 日', concurrencyLimit: '自动弹性', callbackUrl: 'https://example.com/model/callback', dailyReport: true, autoRetry: true, ipWhitelist: false })
        : Promise.resolve(null);
    request.then(() => {
      onDone?.();
      onClose();
    }).finally(() => setSubmitting(false));
  };
  return (
    <div className="art-action-mask">
      <section className="art-model-admin-modal">
        <header><h2>{isToken ? '创建令牌' : isExport ? '导出报表' : '保存设置'}</h2><button onClick={onClose}>×</button></header>
        {isToken && (
          <div className="model-admin-form">
            <label><span>令牌名称</span><input value="prod-chat-agent-new" readOnly /></label>
            <label><span>权限范围</span><div className="model-checks"><button className="active">全部模型</button><button>对话模型</button><button>生图/视频</button></div></label>
            <label><span>调用额度</span><input value="￥500.00 / 日" readOnly /></label>
            <label><span>IP白名单</span><input value="0.0.0.0/0" readOnly /></label>
            <p>创建后仅展示一次完整密钥，请及时保存。</p>
          </div>
        )}
        {isExport && (
          <div className="model-admin-form">
            <label><span>报表范围</span><div className="model-checks"><button className="active">今日</button><button>近7天</button><button>本月</button></div></label>
            <label><span>报表内容</span><div className="model-checks"><button className="active">调用量</button><button className="active">费用</button><button>错误率</button></div></label>
            <label><span>导出格式</span><div className="model-checks"><button className="active">CSV</button><button>XLSX</button></div></label>
            <p>导出任务生成后可在浏览器下载，导出完成后可下载报表文件。</p>
          </div>
        )}
        {type === 'save' && (
          <div className="model-save-body">
            <span>✓</span>
            <div><h3>设置已保存</h3><p>默认模型、费用预警、并发限制和回调地址已保存到当前账号配置。</p></div>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={submitting} onClick={submit}>{submitting ? '提交中' : isToken ? '创建' : isExport ? '导出' : '完成'}</button></footer>
      </section>
    </div>
  );
}

function ArtAdminTable({ heads, rows }: { heads: string[]; rows: string[][] }) {
  return (
    <div className="art-admin-table">
      <div className="head">{heads.map((head) => <span key={head}>{head}</span>)}</div>
      {rows.map((row) => <div className="row" key={row.join('-')}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
    </div>
  );
}

function ArtBillingPage() {
  const [modal, setModal] = useState<'recharge' | 'invoice' | ''>('');
  const [billing, setBilling] = useState<WalletBilling | null>(null);
  const path = window.location.pathname;
  const active = path.includes('/orders') ? 'invoice' : path.includes('/detail') ? 'detail' : 'wallet';
  const loadBilling = () => api.wallet.billing().then((payload) => setBilling(payload.data)).catch(() => undefined);
  useEffect(() => {
    let alive = true;
    api.wallet.billing().then((payload) => {
      if (alive) setBilling(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const rows = active === 'wallet'
    ? (billing?.ledger.map((item) => [item.createdAt, item.incomeType, item.tradeType, item.channel, item.amountText, item.balanceText, item.note]) ?? [
        ['2026-05-18 16:22:10', '充值', '余额充值', '微信支付', '+￥500.00', '￥500.00', '充值成功'],
      ])
    : active === 'detail'
      ? (billing?.detail.map((item) => [item.billNo, item.product, item.target, item.spec, item.usage, item.amount, item.status]) ?? [])
      : (billing?.invoices.map((item) => [item.invoiceNo, item.createdAt, item.type, item.content, item.amount, item.status, item.action]) ?? []);
  const summary = billing?.summary ?? { balanceCny: 0, frozenCny: 0, computeCoin: 0, monthExpenseCny: 0, invoiceableCny: 0 };
  const heads = active === 'wallet'
    ? ['交易时间', '收支类型', '交易类型', '交易渠道', '交易金额', '账户余额', '备注']
    : active === 'detail'
      ? ['账单号', '产品', '应用/实例', '规格', '用量', '金额', '状态']
      : ['发票号', '申请时间', '发票类型', '开票内容', '金额', '状态', '操作'];
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={(active === 'wallet' && index === 5) || (active === 'detail' && index === 6) || (active === 'invoice' && index === 7) ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-billing-main">
          <div className="art-user-head">
            <h1>{active === 'wallet' ? '钱包' : active === 'detail' ? '账单' : '发票'}</h1>
            <div><button onClick={() => setModal(active === 'invoice' ? 'invoice' : 'recharge')}>{active === 'invoice' ? '申请开票' : '充值'}</button><button>导出</button></div>
          </div>
          <section className="art-wallet-cards">
            <article><span>可用余额</span><strong>￥{summary.balanceCny.toFixed(2)}</strong><button onClick={() => setModal('recharge')}>充值</button></article>
            <article><span>冻结金额</span><strong>￥{summary.frozenCny.toFixed(2)}</strong><small>实例创建预授权</small></article>
            <article><span>本月消费</span><strong>￥{summary.monthExpenseCny.toFixed(2)}</strong><small>应用实例与存储</small></article>
            <article><span>可开票金额</span><strong>￥{summary.invoiceableCny.toFixed(2)}</strong><small>已完成订单</small></article>
          </section>
          <div className="art-billing-filter">
            <div><button className={active === 'wallet' ? 'active' : ''} onClick={() => { window.location.href = '/compute/app/billing'; }}>收支明细</button><button className={active === 'detail' ? 'active' : ''} onClick={() => { window.location.href = '/compute/app/billing/detail'; }}>账单明细</button><button className={active === 'invoice' ? 'active' : ''} onClick={() => { window.location.href = '/compute/app/billing/orders'; }}>发票管理</button></div>
            <label>日期范围 <span>开始日期</span><b>至</b><span>结束日期</span></label>
          </div>
          <div className={`art-billing-table ${active}`}>
            <div className="head">{heads.map((head) => <span key={head}>{head}</span>)}</div>
            {rows.map((row) => <div className="row" key={row.join('-')}>{row.map((cell) => <span key={cell} onClick={() => cell === '申请开票' && setModal('invoice')}>{cell}</span>)}</div>)}
          </div>
          <div className="art-billing-pager">共 {rows.length} 条 <b>1</b> <button>10条/页⌄</button> 前往 <input value="1" readOnly /> 页</div>
        </main>
      </div>
      {modal === 'recharge' && <ArtRechargeModal onClose={() => setModal('')} onDone={loadBilling} />}
      {modal === 'invoice' && <ArtInvoiceModal onClose={() => setModal('')} onDone={loadBilling} amount={summary.invoiceableCny || 500} />}
    </ArtShell>
  );
}

function ArtRechargeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(500);
  const [payChannel, setPayChannel] = useState('微信支付');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const submit = async () => {
    setBusy(true);
    setStatus('');
    try {
      const result = await api.wallet.recharge(amount, payChannel);
      setStatus(`${result.status}：${result.orderNo}`);
      await onDone();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '充值失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="art-action-mask">
      <section className="art-pay-modal">
        <header><h2>账户充值</h2><button onClick={onClose}>×</button></header>
        <div className="pay-body">
          <label><span>充值金额</span><div className="pay-amounts">{[100, 500, 1000, 2000].map((item) => <button className={amount === item ? 'active' : ''} key={item} onClick={() => setAmount(item)}>￥{item}</button>)}</div></label>
          <label><span>支付方式</span><div className="pay-methods">{['微信支付', '支付宝', '企业转账'].map((item) => <button className={payChannel === item ? 'active' : ''} key={item} onClick={() => setPayChannel(item)}>{item}</button>)}</div></label>
          <div className="pay-summary"><span>到账金额</span><strong>￥{amount.toFixed(2)}</strong><small>充值完成后余额实时更新，可用于应用实例、模型调用和存储费用。</small></div>
          {status && <p className="pay-status">{status}</p>}
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={busy} onClick={submit}>{busy ? '处理中...' : '确认充值'}</button></footer>
      </section>
    </div>
  );
}

function ArtInvoiceModal({ onClose, onDone, amount }: { onClose: () => void; onDone: () => void; amount: number }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const submit = async () => {
    setBusy(true);
    setStatus('');
    try {
      const result = await api.wallet.invoice({ amount, invoiceType: '个人普通发票', title: '灵渠用户', content: '算力服务费', email: 'finance@example.com' });
      setStatus(`${result.status}：${result.invoiceNo}`);
      await onDone();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '提交失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="art-action-mask">
      <section className="art-pay-modal invoice">
        <header><h2>申请开票</h2><button onClick={onClose}>×</button></header>
        <div className="invoice-body">
          <label><span>开票金额</span><input value={`￥${amount.toFixed(2)}`} readOnly /></label>
          <label><span>发票类型</span><div className="pay-methods"><button className="active">个人普通发票</button><button>企业专票</button></div></label>
          <label><span>发票抬头</span><input value="灵渠用户" readOnly /></label>
          <label><span>开票内容</span><input value="算力服务费" readOnly /></label>
          <label><span>接收邮箱</span><input value="finance@example.com" readOnly /></label>
          <p>提交后将在 1-3 个工作日内处理，电子发票将发送至接收邮箱。</p>
          {status && <p className="pay-status">{status}</p>}
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={busy} onClick={submit}>{busy ? '提交中...' : '提交申请'}</button></footer>
      </section>
    </div>
  );
}

function ArtIncentivePage() {
  const ranks = [
    ['nahz202', 'ComfyUI云绘通用版', '27,092', '52,637h', '￥12,486.30'],
    ['zealman', 'Zimage-Wan-Ltx2.3-训练器', '5,343', '13,574h', '￥4,206.18'],
    ['AI-Train', 'AI-Toolkit', '8,722', '38,641h', '￥3,918.42'],
    ['XIGUA-AIGC', '西瓜AI', '16,850', '54,442h', '￥3,104.90'],
  ];
  const steps = [
    ['发布应用', '上传镜像、填写启动命令和服务端口，提交后进入应用广场。'],
    ['用户部署', '用户从应用详情或右侧创建面板部署实例，系统记录运行时长。'],
    ['收益结算', '按应用使用量、收藏、部署和持续运行时长计算激励。'],
  ];
  return (
    <ArtShell active="market">
      <main className="art-incentive-page">
        <section className="incentive-hero">
          <div>
            <span>创作者计划</span>
            <h1>发布优质应用，获得持续激励</h1>
            <p>面向模型训练、图像生成、视频工作流和工具镜像创作者，按应用部署、运行时长和用户反馈综合结算。</p>
            <div><button>立即发布应用</button><button onClick={() => { window.location.href = '/compute/app/mine'; }}>查看我的应用</button></div>
          </div>
          <aside>
            <strong>本月预估激励</strong>
            <b>￥24,715.80</b>
            <small>覆盖 176 个公开应用</small>
          </aside>
        </section>
        <section className="incentive-stats">
          {[
            ['应用总数', '176', '+12 本月新增'],
            ['累计部署', '193,307', '热门应用持续增长'],
            ['累计运行', '685,556h', '按真实运行时长统计'],
            ['创作者', '84', '支持个人和团队'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <section className="incentive-body">
          <div className="incentive-rules">
            <h2>参与流程</h2>
            {steps.map((step, index) => <article key={step[0]}><b>{index + 1}</b><div><h3>{step[0]}</h3><p>{step[1]}</p></div></article>)}
          </div>
          <div className="incentive-rank">
            <h2>应用激励榜</h2>
            <div className="rank-head"><span>创作者</span><span>应用</span><span>部署</span><span>运行时长</span><span>预估收益</span></div>
            {ranks.map((row, index) => <div className="rank-row" key={row[1]}><b>{index + 1}</b>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
          </div>
        </section>
      </main>
    </ArtShell>
  );
}

function ArtMinePage() {
  const path = window.location.pathname;
  const activeTab = (path.includes('/favorites') ? 'favorites' : path.includes('/recent') ? 'recent' : path.includes('/drafts') ? 'drafts' : 'mine') as 'mine' | 'favorites' | 'recent' | 'drafts';
  const [visibleApps, setVisibleApps] = useState<AppMineItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ mine: 0, favorites: 0, recent: 0, drafts: 0 });
  useEffect(() => {
    let alive = true;
    api.apps.mine(activeTab).then((payload) => {
      if (alive) {
        setVisibleApps(payload.data.items);
        setSummary(payload.data.summary);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [activeTab]);
  const tabMeta: Record<string, [string, string]> = {
    mine: ['我的应用', `共 ${summary.mine} 个已发布应用`],
    favorites: ['收藏应用', `共 ${summary.favorites} 个收藏应用`],
    recent: ['最近使用', `最近 7 天使用过 ${summary.recent} 个应用`],
    drafts: ['草稿箱', summary.drafts > 0 ? `共 ${summary.drafts} 个草稿` : '暂无草稿'],
  };
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 2 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-user-main">
          <div className="art-user-head">
            <h1>我的</h1>
            <div><button onClick={() => { window.location.href = '/compute/app/create'; }}>创建应用</button><button onClick={() => { window.location.href = '/compute/app/market'; }}>去应用广场</button></div>
          </div>
          <section className="art-overview-grid">
            {[
              ['已发布', String(summary.mine || visibleApps.length), '可被用户创建实例'],
              ['收藏', String(summary.favorites || 0), '常用应用快速访问'],
              ['最近使用', String(summary.recent || 0), '近 7 天启动记录'],
              ['草稿', String(summary.drafts || 0), '待完善后提交审核'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <div className="art-user-tabs">
            <a className={activeTab === 'mine' ? 'active' : ''} href="/compute/app/mine">我的应用</a>
            <a className={activeTab === 'favorites' ? 'active' : ''} href="/compute/app/mine/favorites">收藏应用</a>
            <a className={activeTab === 'recent' ? 'active' : ''} href="/compute/app/mine/recent">最近使用</a>
            <a className={activeTab === 'drafts' ? 'active' : ''} href="/compute/app/mine/drafts">草稿箱</a>
            <span>{tabMeta[activeTab][1]}</span>
          </div>
          {visibleApps.length > 0 && <section className="art-mine-grid">
            {visibleApps.map((app, index) => (
              <article key={app.id}>
                <div className={`art-mine-cover tone-${index}`}><b>{index === 1 ? '热' : '精'}</b><strong>{app.name}</strong></div>
                <h2>{app.name}</h2>
                <p><span />{app.author}</p>
                <div><em>{app.version}</em><small>{app.category}</small></div>
                <footer><span>{app.updatedAt}</span><button onClick={() => { window.location.href = activeTab === 'mine' ? '/compute/app/mine/detail' : '/compute/app/market/77'; }}>{app.action}</button></footer>
              </article>
            ))}
          </section>}
          {visibleApps.length === 0 && <div className="art-mine-empty"><strong>{tabMeta[activeTab][0]}</strong><p>当前没有可展示的应用，创建或收藏应用后会显示在这里。</p><button onClick={() => { window.location.href = '/compute/app/create'; }}>创建应用</button></div>}
          <div className="art-user-note">当前为「{tabMeta[activeTab][0]}」列表，已同步收藏、发布和使用记录。</div>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtMineDetailPage() {
  const [manageModal, setManageModal] = useState<'version' | 'edit' | ''>('');
  const [detail, setDetail] = useState<AppDetail | null>(null);
  const loadDetail = () => {
    api.apps.detail('APP-ZIMAGE-WAN').then((payload) => {
      setDetail(payload.data);
    }).catch(() => undefined);
  };
  useEffect(() => {
    let alive = true;
    api.apps.detail('APP-ZIMAGE-WAN').then((payload) => {
      if (alive) setDetail(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const app = detail ?? {
    id: 'APP-ZIMAGE-WAN',
    name: '应用详情',
    author: '灵渠',
    version: 'v1',
    category: '应用',
    summary: '应用配置已同步',
    badge: '精',
    coverTone: 'dark',
    favoriteCount: 0,
    runtimeText: '0h',
    downloadCount: 0,
    tags: ['应用'],
    isBase: false,
    status: 'published',
    isFavorite: false,
    updatedAt: '',
    appKey: 'APP-ZIMAGE-WAN:v1',
    startCommand: 'bash /root/start-app.sh',
    serviceTips: '',
    docLines: [],
    versions: [['v1', '2026-05-21', '基础版本', '当前版本']],
    reviews: [],
    services: [['WebUI-6006', '6006', '应用服务', '可访问']],
    auditChecks: [['基础信息完整', '通过', '名称、简介、分类、封面均已填写']],
  };
  const manageVersions = app.versions.map((row) => [row[0], row[3] === '当前版本' ? '已发布' : row[3], `${row[1]} 13:42:48`, `${app.id}:${row[0]}`]);
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 2 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-app-manage-main">
          <div className="art-user-head">
            <h1>{app.name}</h1>
            <div><button onClick={() => setManageModal('version')}>发布新版本</button><button onClick={() => setManageModal('edit')}>编辑应用</button><button onClick={() => { window.location.href = '/compute/app/mine'; }}>返回</button></div>
          </div>
          <section className="app-manage-hero">
            <div className={`preview-cover ${app.coverTone}`}><b>{app.badge}</b><strong>{app.name}</strong></div>
            <div>
              <span className="review-state">{app.status === 'draft' ? '草稿' : app.status === 'favorite' ? '收藏' : '已发布'}</span>
              <h2>{app.name}</h2>
              <p>{app.summary}</p>
              <div>{app.tags.map((tag) => <em key={tag}>{tag}</em>)}</div>
            </div>
            <aside><strong>本周运行</strong><b>{app.runtimeText}</b><small>下载 {app.downloadCount} · 收藏 {app.favoriteCount}</small></aside>
          </section>
          <div className="app-manage-layout">
            <section className="app-manage-card">
              <h2>版本管理</h2>
              <div className="app-version-table">
                <div className="head"><span>版本</span><span>状态</span><span>更新时间</span><span>应用ID</span><span>操作</span></div>
                {manageVersions.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 1 ? `status ${cell === '审核中' ? 'pending' : cell === '已下架' ? 'offline' : ''}` : ''} key={cell}>{cell}</span>)}<span><a>查看</a><a>复制</a></span></div>)}
              </div>
            </section>
            <section className="app-manage-card">
              <h2>服务端口</h2>
              <div className="app-service-table">
                <div className="head"><span>服务</span><span>端口</span><span>类型</span><span>状态</span></div>
                {app.services.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
              </div>
            </section>
            <section className="app-manage-card wide">
              <div className="profile-section-title"><h2>审核中心</h2><a>查看审核规范</a></div>
              <div className="audit-check-grid">
                {app.auditChecks.map((row) => <article key={row[0]}><span>{row[0]}</span><strong className={row[1] === '待人工复核' ? 'pending' : ''}>{row[1]}</strong><p>{row[2]}</p></article>)}
              </div>
              <div className="review-timeline">
                {app.versions.map((row) => <p key={row[0]}><b>{row[1]} 13:42</b><span>{row[0]} {row[3]}：{row[2]}</span></p>)}
              </div>
            </section>
          </div>
        </main>
      </div>
      {manageModal && <ArtManageAppModal type={manageModal} app={app} onDone={loadDetail} onClose={() => setManageModal('')} />}
    </ArtShell>
  );
}

function ArtManageAppModal({ type, app, onDone, onClose }: { type: 'version' | 'edit'; app: AppDetail; onDone?: () => void; onClose: () => void }) {
  const isVersion = type === 'version';
  const [submitting, setSubmitting] = useState(false);
  const submit = () => {
    setSubmitting(true);
    const request = isVersion
      ? api.apps.publishVersion(app.id, { version: `v${Number(app.version.replace(/\D/g, '') || '1') + 1}`, note: `更新 ${app.name} 的镜像脚本和服务端口配置。` })
      : api.apps.update(app.id, { name: app.name, summary: `${app.summary} 已完成应用信息维护。`, category: app.category, tags: app.tags });
    request.then(() => {
      onDone?.();
      onClose();
    }).finally(() => setSubmitting(false));
  };
  return (
    <div className="art-action-mask">
      <section className="art-manage-modal">
        <header><h2>{isVersion ? '发布新版本' : '编辑应用信息'}</h2><button onClick={onClose}>×</button></header>
        {isVersion ? (
          <div className="manage-version-body">
            <label><span>版本号</span><input value={`v${Number(app.version.replace(/\D/g, '') || '1') + 1}`} readOnly /></label>
            <label><span>基础镜像</span><input value={`image-${app.id.toLowerCase()}:${app.version}`} readOnly /></label>
            <label><span>启动命令</span><input value={app.startCommand} readOnly /></label>
            <label><span>更新说明</span><textarea value={`更新 ${app.name} 的镜像脚本和服务端口配置。`} readOnly /></label>
            <div className="manage-audit-preview">
              <strong>提交前检查</strong>
              <p><span>镜像扫描通过</span><span>端口配置完整</span><span>保留回滚版本</span></p>
            </div>
            <div className="manage-checks"><label><input type="checkbox" checked readOnly /> 保留 v6 作为可回滚版本</label><label><input type="checkbox" checked readOnly /> 提交后进入审核队列</label></div>
          </div>
        ) : (
          <div className="manage-version-body">
            <label><span>应用名称</span><input value={app.name} readOnly /></label>
            <label><span>一句话介绍</span><input value={`${app.summary} 已完成应用信息维护。`} readOnly /></label>
            <label><span>应用分类</span><div className="manage-tags">{app.tags.map((tag) => <em key={tag}>{tag}</em>)}<button>添加</button></div></label>
            <label><span>应用说明</span><textarea value={app.summary} readOnly /></label>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={submitting} onClick={submit}>{submitting ? '提交中' : isVersion ? '提交审核' : '保存修改'}</button></footer>
      </section>
    </div>
  );
}

function ArtCreatePage() {
  const [submitting, setSubmitting] = useState(false);
  const createApp = (status: 'draft' | 'published') => {
    setSubmitting(true);
    api.apps.create({
      name: status === 'draft' ? '数字人口播应用草稿' : 'Zimage-Wan-Ltx2.3-训练器',
      author: '灵渠',
      summary: '内置训练脚本、依赖环境、WebUI 服务和示例配置，适合快速创建训练实例并复现工作流。',
      category: 'AI-Toolkit / LORA',
      tags: ['AI-Toolkit', '训练', 'LORA', 'Z-Image'],
      version: status === 'draft' ? 'v0.1' : 'v1',
      status,
    }).then(() => {
      window.location.href = status === 'draft' ? '/compute/app/mine/drafts' : '/compute/app/mine';
    }).finally(() => setSubmitting(false));
  };
  const serviceRows = [
    ['JupyterLab', '8888', '系统服务', '开机后自动可用'],
    ['WebUI-6006', '6006', '应用服务', '训练器主入口'],
    ['WebUI-6008', '6008', '应用服务', '辅助面板'],
  ];
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 2 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-create-app-main">
          <div className="art-user-head">
            <h1>创建应用</h1>
            <div><button disabled={submitting} onClick={() => createApp('draft')}>{submitting ? '保存中' : '保存草稿'}</button><button onClick={() => { window.location.href = '/compute/app/mine'; }}>取消</button></div>
          </div>
          <section className="art-overview-grid">
            {[
              ['资料完整度', '92%', '封面、简介、标签已填写'],
              ['服务端口', '3 个', 'JupyterLab / WebUI'],
              ['审核预计', '1-3 小时', '人工复核后上架'],
              ['推荐规格', 'RTX 5090', '适合训练与推理'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <section className="create-app-steps">
            {['基础信息', '运行配置', '服务端口', '发布审核'].map((item, index) => <span className={index === 0 ? 'active' : ''} key={item}><b>{index + 1}</b>{item}</span>)}
          </section>
          <div className="create-app-layout">
            <section className="create-app-form">
              <h2>基础信息</h2>
              <label><span>应用名称</span><input value="Zimage-Wan-Ltx2.3-训练器" readOnly /></label>
              <label><span>一句话介绍</span><input value="更新到2026年4月最新版本，支持 Z-Image 与 Wan2.2 LoRA 训练" readOnly /></label>
              <label className="textarea"><span>应用说明</span><textarea value="内置训练脚本、依赖环境、WebUI 服务和示例配置，适合快速创建训练实例并复现工作流。" readOnly /></label>
              <label><span>应用分类</span><div className="create-tag-box"><em>AI-Toolkit</em><em>训练</em><em>LORA</em><em>Z-Image</em><button>添加标签</button></div></label>
              <h2>运行配置</h2>
              <label><span>基础镜像</span><input value="image-aikit-zimage-wan-ltx23:v6" readOnly /></label>
              <label><span>启动命令</span><input value="bash /root/start-aitoolkitui.sh" readOnly /></label>
              <label><span>推荐 GPU</span><div className="create-radio-row"><button className="active">RTX 5090-32G</button><button>RTX 4090D-24G</button><button>RTX 4080S-32G</button></div></label>
              <h2>服务端口</h2>
              <div className="create-service-table">
                <div className="head"><span>服务名称</span><span>端口</span><span>类型</span><span>说明</span></div>
                {serviceRows.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
              </div>
            </section>
            <aside className="create-app-preview">
              <h2>应用预览</h2>
              <div className="preview-cover"><b>精</b><strong>Zimage-Wan-Ltx2.3-训练器</strong></div>
              <h3>Zimage-Wan-Ltx2.3-训练器</h3>
              <p><span />zealman</p>
              <div><small>☆ 121</small><small>◷ 13574h</small><small>⇩ 5343</small></div>
              <p>更新到2026年4月最新版本，支持 Z-Image 与 Wan2.2 LoRA 训练</p>
              <button disabled={submitting} onClick={() => createApp('published')}>{submitting ? '提交中' : '提交审核'}</button>
              <label><input type="checkbox" checked readOnly /> 我已确认镜像来源和应用内容符合发布规范</label>
              <div className="create-audit-box">
                <h4>提交前检查</h4>
                <p><span>✓</span>基础信息完整</p>
                <p><span>✓</span>启动命令可执行</p>
                <p><span>✓</span>服务端口已声明</p>
                <p><span>!</span>提交后需等待平台人工复核</p>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtInstancesPage() {
  const [action, setAction] = useState<'boot' | 'stop' | 'rename' | 'recharge' | 'clone' | 'delete' | 'batch' | ''>('');
  const [selectedInstanceId, setSelectedInstanceId] = useState('ins-art-zimage-20260518');
  const path = window.location.pathname;
  const filter = (path.includes('/running') ? 'running' : path.includes('/pending') ? 'pending' : path.includes('/stopped') ? 'stopped' : 'all') as 'all' | 'running' | 'pending' | 'stopped';
  const [visibleRows, setVisibleRows] = useState<AppInstanceItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ all: 0, running: 0, pending: 0, stopped: 0 });
  useEffect(() => {
    let alive = true;
    api.appInstances.list(filter).then((payload) => {
      if (alive) {
        setVisibleRows(payload.data.items);
        setSummary(payload.data.summary);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [filter]);
  const refreshInstances = () => {
    api.appInstances.list(filter).then((payload) => {
      setVisibleRows(payload.data.items);
      setSummary(payload.data.summary);
    }).catch(() => undefined);
  };
  const openAction = (nextAction: typeof action, instanceId: string) => {
    setSelectedInstanceId(instanceId);
    setAction(nextAction);
  };
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 3 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-user-main">
          <div className="art-user-head">
            <h1>应用实例</h1>
            <div><button onClick={() => { window.location.href = '/compute/app/instances/create'; }}>创建实例</button><button onClick={() => setAction('batch')}>批量操作</button></div>
          </div>
          <section className="art-overview-grid">
            {[
              ['全部实例', String(summary.all || visibleRows.length), '应用市场创建的实例'],
              ['运行中', String(summary.running || 0), '正在产生算力费用'],
              ['未开机', String(summary.pending || 0), '保留系统盘配置'],
              ['已停止', String(summary.stopped || 0), '可随时重新开机'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <div className="art-instance-filter">
            <a className={filter === 'all' ? 'active' : ''} href="/compute/app/instances">全部({summary.all})</a><a className={filter === 'running' ? 'active' : ''} href="/compute/app/instances/running">运行中({summary.running})</a><a className={filter === 'pending' ? 'active' : ''} href="/compute/app/instances/pending">未开机({summary.pending})</a><a className={filter === 'stopped' ? 'active' : ''} href="/compute/app/instances/stopped">已停止({summary.stopped})</a>
            <label>实例名称<input value="" readOnly placeholder="搜索实例/应用名称" /></label>
          </div>
          <div className="art-instance-table">
            <div className="head"><span><input type="checkbox" checked readOnly /></span><span>应用名称</span><span>GPU型号</span><span>地区</span><span>数量</span><span>计费方式</span><span>状态</span><span>费用</span><span>操作</span></div>
            {visibleRows.map((row, index) => (
              <div className="row" key={row.id}>
                <span><input type="checkbox" checked={index < 2} readOnly /></span>
                {[row.appName, row.gpuModel, row.region, row.gpuCountText, row.billingMode, row.statusText, row.priceText].map((cell, cellIndex) => <span className={cellIndex === 5 ? `state ${row.status === 'running' ? 'running' : row.status === 'stopped' ? 'stopped' : ''}` : ''} key={`${row.id}-${cellIndex}`}>{cell}</span>)}
                <span><a onClick={() => openAction('boot', row.id)}>开机</a><a onClick={() => openAction('stop', row.id)}>关机</a><a href={`/compute/app/instances/detail/${row.id}`}>详情</a><a onClick={() => openAction('rename', row.id)}>改名</a><a onClick={() => openAction('recharge', row.id)}>续费</a><a onClick={() => openAction('clone', row.id)}>复制</a><a onClick={() => openAction('delete', row.id)}>删除</a></span>
              </div>
            ))}
          </div>
          {visibleRows.length === 0 && <div className="art-instance-empty"><strong>暂无实例</strong><p>当前筛选条件下没有应用实例。</p><button onClick={() => { window.location.href = '/compute/app/instances/create'; }}>创建实例</button></div>}
          <div className="art-user-note">当前筛选：{filter === 'all' ? '全部' : filter === 'running' ? '运行中' : filter === 'pending' ? '未开机' : '已停止'}，共 {visibleRows.length} 个实例。</div>
        </main>
      </div>
      {action === 'boot' && <ArtInstanceActionModal type="boot" instanceId={selectedInstanceId} onDone={refreshInstances} onClose={() => setAction('')} />}
      {action === 'stop' && <ArtInstanceActionModal type="stop" instanceId={selectedInstanceId} onDone={refreshInstances} onClose={() => setAction('')} />}
      {action === 'rename' && <ArtInstanceActionModal type="rename" instanceId={selectedInstanceId} onDone={refreshInstances} onClose={() => setAction('')} />}
      {action === 'recharge' && <ArtInstanceActionModal type="recharge" onClose={() => setAction('')} />}
      {action === 'clone' && <ArtInstanceActionModal type="clone" instanceId={selectedInstanceId} onDone={refreshInstances} onClose={() => setAction('')} />}
      {action === 'delete' && <ArtInstanceActionModal type="delete" instanceId={selectedInstanceId} onDone={refreshInstances} onClose={() => setAction('')} />}
      {action === 'batch' && <ArtBatchActionModal onDone={refreshInstances} onClose={() => setAction('')} />}
    </ArtShell>
  );
}

function ArtInstanceCreatePage() {
  const specs = [
    ['RTX 5090-32G', '北京B区', '146 / 1072', '16核 80GB', '￥-.-- / 日'],
    ['RTX 4090D-24G', '北京B区', '4 / 184', '14核 60GB', '￥-.-- / 日'],
    ['RTX 4080S-32G', '西北B区', '14 / 320', '12核 48GB', '￥-.-- / 日'],
  ];
  const [apps, setApps] = useState<AppMarketItem[]>([]);
  const [selectedAppId, setSelectedAppId] = useState('APP-ZIMAGE-WAN');
  const [selectedSpec, setSelectedSpec] = useState(0);
  const [creating, setCreating] = useState(false);
  useEffect(() => {
    let alive = true;
    api.apps.market({ section: 'all' }).then((payload) => {
      if (alive) {
        setApps(payload.data.items);
        if (payload.data.items[0]) setSelectedAppId(payload.data.items[0].id);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const selectedApp = apps.find((item) => item.id === selectedAppId) ?? apps[0];
  const createInstance = () => {
    if (!selectedApp || creating) return;
    const spec = specs[selectedSpec];
    setCreating(true);
    api.appInstances.create({
      appId: selectedApp.id,
      instanceName: `${selectedApp.name}-${new Date().getMonth() + 1}${new Date().getDate()}`,
      gpuModel: spec[0],
      region: spec[1],
      gpuCount: 1,
      billingMode: '按量计费',
      boot: true,
    }).then((instance) => {
      window.location.href = `/compute/app/instances/detail/${instance.id}`;
    }).finally(() => {
      setCreating(false);
    });
  };
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 3 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-instance-create-main">
          <div className="art-user-head">
            <h1>创建应用实例</h1>
            <div><button onClick={() => { window.location.href = '/compute/app/market'; }}>选择应用</button><button onClick={() => { window.location.href = '/compute/app/instances'; }}>返回列表</button></div>
          </div>
          <section className="instance-create-steps">
            {['选择应用', '选择算力', '确认配置', '创建完成'].map((item, index) => <span className={index < 3 ? 'active' : ''} key={item}><b>{index + 1}</b>{item}</span>)}
          </section>
          <div className="instance-create-layout">
            <section className="instance-create-form">
              <h2>应用信息</h2>
              <div className="selected-app-card">
                <div className="selected-app-cover">{selectedApp?.badge ?? '精'}</div>
                <div>
                  <h3>{selectedApp?.name ?? '选择应用'}</h3>
                  <p>{selectedApp ? `${selectedApp.author} · ${selectedApp.summary}` : '正在加载应用市场数据'}</p>
                </div>
                <a href="/compute/app/market">更换应用</a>
              </div>
              <div className="instance-create-segments">
                {apps.slice(0, 4).map((app) => <button className={selectedAppId === app.id ? 'active' : ''} key={app.id} onClick={() => setSelectedAppId(app.id)}>{app.name}</button>)}
              </div>
              <h2>计费方式</h2>
              <div className="instance-create-segments"><button className="active">按量计费</button><button>包日</button><button>包周</button><button>包月</button></div>
              <h2>选择算力</h2>
              <div className="instance-spec-list">
                {specs.map((item, index) => (
                  <label className={selectedSpec === index ? 'active' : ''} key={item[0]} onClick={() => setSelectedSpec(index)}>
                    <input type="radio" checked={selectedSpec === index} readOnly />
                    <strong>{item[0]}</strong>
                    <span>{item[1]}</span>
                    <span>库存 {item[2]}</span>
                    <span>{item[3]}</span>
                    <em>{item[4]}</em>
                  </label>
                ))}
              </div>
              <h2>实例配置</h2>
              <div className="instance-create-grid">
                <label><span>GPU数量</span><input value="1" readOnly /></label>
                <label><span>系统盘</span><input value="30 GB" readOnly /></label>
                <label><span>实例名称</span><input value={selectedApp ? `${selectedApp.name}-${new Date().getMonth() + 1}${new Date().getDate()}` : 'new-app-instance'} readOnly /></label>
                <label><span>释放策略</span><input value="到期15天后释放" readOnly /></label>
              </div>
            </section>
            <aside className="instance-create-summary">
              <h2>费用明细</h2>
              <p><span>算力费用</span><strong>￥-.-- / 日</strong></p>
              <p><span>系统盘</span><strong>￥0.10 / 日</strong></p>
              <p><span>应用服务</span><strong>已包含</strong></p>
              <div><span>日常费用</span><b>￥-.-- / 日</b></div>
              <small>账户余额 ￥0.00，创建后可在应用实例中开机、停止和查看服务入口。</small>
              <button onClick={createInstance} disabled={creating || !selectedApp}>{creating ? '创建中' : '创建并开机'}</button>
              <button className="plain" onClick={() => { window.location.href = '/compute/app/instances'; }}>取消</button>
              <label><input type="checkbox" checked readOnly /> 我已阅读并同意应用计费及数据保留规则</label>
            </aside>
          </div>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtInstanceWorkspacePage() {
  const instanceId = appInstanceIdFromPath();
  const [instance, setInstance] = useState<AppInstanceItem | null>(null);
  useEffect(() => {
    let alive = true;
    api.appInstances.detail(instanceId).then((payload) => {
      if (alive) setInstance(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [instanceId]);
  const files = instance?.files ?? [];
  const logs = instance?.logs ?? [];
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['实例详情', '/compute/app/instances/detail'],
            ['终端工作台', '/compute/app/instances/workspace'],
            ['应用实例', '/compute/app/instances'],
            ['钱包', '/compute/app/billing'],
            ['消息中心', '/compute/art/messages'],
          ].map((item, index) => <a className={index === 1 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['▤','⌁','▥','▣','◉'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="instance-workspace-main">
          <div className="art-user-head">
            <h1>实例工作台</h1>
            <div><button>重连终端</button><button onClick={() => { window.location.href = `/compute/app/instances/detail/${instanceId}`; }}>返回详情</button></div>
          </div>
          <section className="workspace-status">
            <article><span>实例</span><strong>{instance?.instanceName ?? instanceId}</strong><p>{instance?.statusText ?? '-'} · {instance?.region ?? '-'} · {instance?.gpuModel ?? '-'}</p></article>
            <article><span>服务</span><strong>WebUI-6006</strong><p>等待开机后自动生成访问地址</p></article>
            <article><span>数据目录</span><strong>/root/lingqu-tmp</strong><p>{instance?.dataDiskGb ?? 50}GB 临时数据盘</p></article>
            <article><span>连接状态</span><strong>{instance?.status === 'running' ? '已连接' : '待开机'}</strong><p>终端、文件、日志三栏同步</p></article>
          </section>
          <div className="workspace-grid">
            <section className="workspace-terminal">
              <div className="workspace-title"><h2>SSH 终端</h2><span>只读预览</span></div>
              <pre>{['root@lingqu-container:~# pwd','/root','root@lingqu-container:~# nvidia-smi', instance?.status === 'running' ? 'GPU process ready.' : 'No running GPU process. Instance is stopped.', `root@lingqu-container:~# ${instance?.startCommand ?? 'bash /root/start-app.sh'}`,'waiting for boot confirmation ...'].join('\n')}</pre>
              <div><input value={instance?.startCommand ?? 'bash /root/start-app.sh'} readOnly /><button>发送</button></div>
            </section>
            <section className="workspace-files">
              <div className="workspace-title"><h2>文件浏览器</h2><span>/root</span></div>
              <div className="file-toolbar"><button>上传</button><button>新建目录</button><button>刷新</button></div>
              <div className="file-table">
                <div className="head"><span>名称</span><span>大小/类型</span><span>修改时间</span></div>
                {files.map((row) => <div className="row" key={row[1]}><span><i className={row[0]} />{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span></div>)}
              </div>
            </section>
            <section className="workspace-logs">
              <div className="workspace-title"><h2>实时日志</h2><span>最近 100 行</span></div>
              <pre>{logs.join('\n')}</pre>
              <div className="log-actions"><button>清空</button><button>下载日志</button><button>自动滚动</button></div>
            </section>
          </div>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtInstanceDetailPage() {
  const [action, setAction] = useState<'boot' | 'restart' | 'stop' | 'rename' | 'recharge' | 'delete' | ''>('');
  const instanceId = appInstanceIdFromPath();
  const [instance, setInstance] = useState<AppInstanceItem | null>(null);
  useEffect(() => {
    let alive = true;
    api.appInstances.detail(instanceId).then((payload) => {
      if (alive) setInstance(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [instanceId]);
  const refreshInstance = () => {
    api.appInstances.detail(instanceId).then((payload) => {
      setInstance(payload.data);
    }).catch(() => undefined);
  };
  const metrics = instance?.metrics ?? [];
  const logs = instance?.logs ?? [];
  const services = instance?.services ?? [];
  const bills = instance?.bills ?? [];
  const events = instance?.events ?? [];
  return (
    <ArtShell active="market">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['应用广场', '/compute/app/market'],
            ['公共模型', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['应用实例', '/compute/app/instances'],
            ['镜像', '/compute/app/images'],
            ['钱包', '/compute/app/billing'],
            ['账单', '/compute/app/billing/detail'],
            ['发票', '/compute/app/billing/orders'],
          ].map((item, index) => <a className={index === 3 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-instance-detail-main">
          <div className="art-user-head">
            <h1>{instance?.appName ?? '应用实例'}</h1>
            <div><button onClick={() => setAction('rename')}>改名</button><button onClick={() => setAction('boot')}>开机</button><button onClick={() => setAction('stop')}>关机</button><button onClick={() => setAction('restart')}>重启</button><button onClick={() => setAction('recharge')}>充值</button><button onClick={() => { window.location.href = '/compute/app/instances'; }}>返回列表</button></div>
          </div>
          <section className="instance-detail-hero">
            <div>
              <span className="instance-state">{instance?.statusText ?? '-'}</span>
              <h2>{instance?.instanceName ?? instanceId}</h2>
              <p>{instance?.region ?? '-'} · {instance?.gpuModel ?? '-'} · {instance?.gpuCountText ?? '-'} · {instance?.billingMode ?? '-'} · 系统盘 {instance?.systemDiskGb ?? 30}GB</p>
              <div>{services.slice(0, 5).map((row) => <button key={row[0]} onClick={() => { window.location.href = `/compute/app/instances/workspace/${instanceId}`; }}>{row[0]}</button>)}</div>
            </div>
            <aside>
              <strong>日常费用</strong>
              <b>{instance?.priceText ?? '￥-.-- / 日'}</b>
              <small>账户余额 ￥0.00</small>
            </aside>
          </section>
          <section className="art-overview-grid">
            {[
              ['实例状态', instance?.statusText ?? '-', '开机后可访问服务'],
              ['访问入口', `${services.length || 0} 个`, 'JupyterLab / WebUI / SSH'],
              ['数据盘', `${instance?.dataDiskGb ?? 50}GB`, '随实例生命周期保留'],
              ['今日费用', instance?.priceText ?? '￥-.-- / 日', '按当前计费方式预估'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <section className="instance-metric-grid">
            {metrics.map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <section className="instance-service-card">
            <div className="instance-section-title"><h2>访问服务</h2><span>开机后自动生成访问地址，端口与 平台应用服务保持一致</span></div>
            <div className="instance-service-table">
              <div className="head"><span>服务名称</span><span>端口</span><span>类型</span><span>状态</span><span>操作</span></div>
              {services.map((row) => (
                <div className="row" key={row[0]}>
                  {row.map((cell, index) => <span className={index === 3 ? 'pending' : index === 4 ? 'link' : ''} key={cell}>{cell}</span>)}
                </div>
              ))}
            </div>
          </section>
          <section className="instance-runtime-grid">
            <article>
              <h2>存储挂载</h2>
              <p><span>系统盘</span><strong>/root · 30GB · 已用 8.2GB</strong></p>
              <p><span>数据盘</span><strong>/root/lingqu-tmp · 50GB · 随实例释放</strong></p>
              <p><span>公共数据</span><strong>/root/lingqu-pub · 只读挂载</strong></p>
            </article>
            <article>
              <h2>网络与安全</h2>
              <p><span>公网访问</span><strong>通过平台代理访问 WebUI 服务</strong></p>
              <p><span>SSH 指令</span><strong>ssh root@connect.lingqu.local -p 202605</strong></p>
              <p><span>端口策略</span><strong>仅开放应用声明端口</strong></p>
            </article>
          </section>
          <section className="instance-monitor-card">
            <div className="instance-section-title"><h2>资源监控</h2><span>最近 30 分钟</span></div>
            <div className="monitor-panels">
              {[
                ['GPU 利用率', '0%', '0,0,0,1,0,0,0,0'],
                ['显存占用', '0GB', '0,0,0,0,0,0,0,0'],
                ['CPU 使用率', '2%', '4,3,2,3,2,2,2,2'],
                ['网络吞吐', '0KB/s', '1,1,0,0,0,1,0,0'],
              ].map((item, itemIndex) => (
                <article key={item[0]}>
                  <div><span>{metrics[itemIndex]?.[0] ?? item[0]}</span><strong>{metrics[itemIndex]?.[1] ?? item[1]}</strong></div>
                  <div className="monitor-bars">
                    {item[2].split(',').map((value, index) => <i style={{ height: `${12 + Number(value) * 9}px` }} key={`${item[0]}-${index}`} />)}
                  </div>
                </article>
              ))}
            </div>
          </section>
          <div className="instance-detail-layout">
            <section className="instance-config-card">
              <h2>实例配置</h2>
              {[
                ['应用版本', instance?.appKey ?? '-'],
                ['基础镜像', `image-${instance?.appId ?? 'app'}:${instance?.version ?? 'v1'}`],
                ['启动命令', instance?.startCommand ?? '-'],
                ['创建时间', instance?.createdAt ?? '-'],
                ['释放策略', '到期15天后释放'],
              ].map((row) => <p key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></p>)}
            </section>
            <section className="instance-log-card">
              <h2>运行日志</h2>
              <pre>{logs.join('\n')}</pre>
            </section>
          </div>
          <section className="instance-bill-card">
            <div className="instance-section-title"><h2>计费记录</h2><a href="/compute/app/billing/detail">查看完整账单</a></div>
            <div className="instance-bill-table">
              <div className="head"><span>时间</span><span>事件</span><span>说明</span><span>金额</span><span>状态</span></div>
              {bills.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="instance-event-card">
            <div className="instance-section-title"><h2>事件记录</h2><span>展示实例生命周期和平台调度事件</span></div>
            <div className="instance-event-list">
              {events.map((row) => (
                <article key={row[0]}>
                  <i className={row[4]} />
                  <span>{row[0]}</span>
                  <strong>{row[1]}</strong>
                  <em>{row[2]}</em>
                  <p>{row[3]}</p>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
      {action === 'boot' && <ArtInstanceActionModal type="boot" instanceId={instanceId} onDone={refreshInstance} onClose={() => setAction('')} />}
      {action === 'restart' && <ArtInstanceActionModal type="restart" instanceId={instanceId} onDone={refreshInstance} onClose={() => setAction('')} />}
      {action === 'stop' && <ArtInstanceActionModal type="stop" instanceId={instanceId} onDone={refreshInstance} onClose={() => setAction('')} />}
      {action === 'rename' && <ArtInstanceActionModal type="rename" instanceId={instanceId} onDone={refreshInstance} onClose={() => setAction('')} />}
      {action === 'recharge' && <ArtInstanceActionModal type="recharge" onClose={() => setAction('')} />}
      {action === 'delete' && <ArtInstanceActionModal type="delete" instanceId={instanceId} onDone={() => { window.location.href = '/compute/app/instances'; }} onClose={() => setAction('')} />}
    </ArtShell>
  );
}

function ArtInstanceActionModal({ type, instanceId = 'ins-art-zimage-20260518', onDone, onClose }: { type: 'boot' | 'restart' | 'stop' | 'rename' | 'recharge' | 'clone' | 'delete'; instanceId?: string; onDone?: () => void; onClose: () => void }) {
  const isDelete = type === 'delete';
  const isRestart = type === 'restart';
  const isStop = type === 'stop';
  const isRename = type === 'rename';
  const isRecharge = type === 'recharge';
  const isClone = type === 'clone';
  const [instance, setInstance] = useState<AppInstanceItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    if (isRecharge) return undefined;
    let alive = true;
    api.appInstances.detail(instanceId).then((payload) => {
      if (alive) setInstance(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [instanceId, isRecharge]);
  const submitAction = () => {
    if (isRecharge) {
      onClose();
      return;
    }
    setSubmitting(true);
    api.appInstances.action(instanceId, {
      action: type,
      instanceName: isRename ? `${instance?.instanceName ?? instanceId}-01` : isClone ? `copy-${instance?.instanceName ?? instanceId}` : undefined,
    }).then(() => {
      onDone?.();
      onClose();
    }).finally(() => {
      setSubmitting(false);
    });
  };
  return (
    <div className="art-action-mask">
      <section className={`art-action-modal ${isDelete ? 'danger' : ''}`}>
        <header><h2>{isDelete ? '删除实例' : isRestart ? '重启实例' : isStop ? '关机确认' : isRename ? '修改实例名称' : isRecharge ? '账户充值' : isClone ? '复制实例' : '开机确认'}</h2><button onClick={onClose}>×</button></header>
        {isDelete ? (
          <div className="art-delete-body">
            <span>!</span>
            <p>删除后实例系统盘和运行环境将不可恢复，请确认已保存需要的数据。</p>
            <label><input type="checkbox" checked readOnly /> 我已知晓删除风险</label>
          </div>
        ) : isRename ? (
          <div className="art-instance-form-body">
            <label><span>当前名称</span><input value={instance?.instanceName ?? instanceId} readOnly /></label>
            <label><span>新实例名称</span><input value={`${instance?.instanceName ?? instanceId}-01`} readOnly /></label>
            <p>名称仅用于控制台展示，不影响镜像、端口、数据盘和计费规则。</p>
          </div>
        ) : isClone ? (
          <div className="art-instance-form-body clone">
            <label><span>来源实例</span><input value={instance?.instanceName ?? instanceId} readOnly /></label>
            <label><span>新实例名</span><input value={`copy-${instance?.instanceName ?? instanceId}`} readOnly /></label>
            <label><span>复制内容</span><div><button className="active">应用配置</button><button className="active">系统盘快照</button><button>数据盘</button></div></label>
            <p>复制实例会沿用应用版本、启动命令和端口配置，创建后可在实例列表中单独开机。</p>
          </div>
        ) : isRecharge ? (
          <div className="art-recharge-body">
            <div className="recharge-balance"><span>当前余额</span><strong>￥0.00</strong><em>开机前需要完成余额检查</em></div>
            <div className="recharge-options"><button>￥100</button><button className="active">￥500</button><button>￥1000</button><button>自定义</button></div>
            <label><span>支付方式</span><div><button className="active">微信支付</button><button>支付宝</button><button>对公转账</button></div></label>
          </div>
        ) : isStop ? (
          <div className="art-stop-body">
            <span>i</span>
            <p>关机后 GPU 计费停止，系统盘、扩容盘和已挂载数据仍会按规则保留并计费。</p>
            <label><input type="checkbox" checked readOnly /> 保留实例与系统盘，稍后可重新开机</label>
          </div>
        ) : (
          <div className="art-boot-body">
            <div className="boot-app-line"><strong>{instance?.appName ?? '应用实例'}</strong><span>{instance?.region ?? '-'} · {instance?.gpuModel ?? '-'} · {instance?.gpuCountText ?? '-'}</span></div>
            <label><span>计费方式</span><div><button className="active">按量计费</button><button>包日</button><button>包周</button></div></label>
            <label><span>开机模式</span><div><button className="active">标准开机</button><button>无卡开机</button></div></label>
            <label><span>服务入口</span><div><button className="active">WebUI-6006</button><button>WebUI-6008</button><button>JupyterLab</button></div></label>
            <div className="boot-cost"><span>配置费用</span><b>￥-.-- / 时</b><small>实例30GB基础容量将按￥0.1/日计费</small></div>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={submitting} onClick={submitAction}>{submitting ? '提交中' : isDelete ? '确认删除' : isRestart ? '确认重启' : isStop ? '确认关机' : isRename ? '保存名称' : isRecharge ? '立即充值' : isClone ? '确认复制' : '确认开机'}</button></footer>
      </section>
    </div>
  );
}

function ArtBatchActionModal({ onDone, onClose }: { onDone?: () => void; onClose: () => void }) {
  const [rows, setRows] = useState<AppInstanceItem[]>([]);
  const [batchAction, setBatchAction] = useState<'boot' | 'stop'>('boot');
  const [resultRows, setResultRows] = useState<Array<{ id: string; appName?: string; status: string; result: string }>>([]);
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => {
    let alive = true;
    api.appInstances.list('all').then((payload) => {
      if (alive) setRows(payload.data.items);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const selectedIds = rows.slice(0, 2).map((row) => row.id);
  const executableCount = rows.slice(0, 2).filter((row) => batchAction === 'boot' ? row.status !== 'running' : row.status === 'running').length;
  const submitBatch = () => {
    setSubmitting(true);
    api.appInstances.batchAction({ action: batchAction, ids: selectedIds }).then((result) => {
      setResultRows(result.items);
      onDone?.();
    }).finally(() => setSubmitting(false));
  };
  return (
    <div className="art-action-mask">
      <section className="art-batch-modal">
        <header><h2>批量操作</h2><button onClick={onClose}>×</button></header>
        <div className="batch-action-body">
          <div className="batch-action-tabs"><button className={batchAction === 'boot' ? 'active' : ''} onClick={() => setBatchAction('boot')}>批量开机</button><button className={batchAction === 'stop' ? 'active' : ''} onClick={() => setBatchAction('stop')}>批量关机</button><button>释放实例</button><button className="danger">批量删除</button></div>
          <div className="batch-summary"><strong>已选择 {selectedIds.length} 个实例</strong><span>操作会按实例当前状态自动跳过不可执行项，执行前会检查余额、库存和实例锁定状态。</span></div>
          <div className="batch-plan-grid">
            <article><span>执行策略</span><strong>顺序执行</strong><p>同一区域实例按创建时间依次开机</p></article>
            <article><span>预计费用</span><strong>{batchAction === 'boot' ? '￥-.-- / 时' : '￥0.00'}</strong><p>{batchAction === 'boot' ? '仅对成功开机的实例产生 GPU 费用' : '关机会停止 GPU 费用，保留系统盘计费'}</p></article>
            <article><span>失败处理</span><strong>继续执行</strong><p>失败项保留在结果列表中便于重试</p></article>
          </div>
          <div className="batch-option-row">
            <label><input type="checkbox" checked readOnly /> 自动跳过不可执行实例</label>
            <label><input type="checkbox" checked readOnly /> 开机后生成服务入口</label>
            <label><input type="checkbox" readOnly /> 执行完成后短信通知</label>
          </div>
          <div className="batch-instance-table">
            <div className="head"><span>应用名称</span><span>状态</span><span>GPU型号</span><span>数量</span><span>地区</span><span>处理结果</span></div>
            {rows.slice(0, 2).map((row) => {
              const result = resultRows.find((item) => item.id === row.id)?.result;
              const plan = batchAction === 'boot' ? (row.status === 'running' ? '将跳过' : '可开机') : (row.status === 'running' ? '可关机' : '将跳过');
              return <div className="row" key={row.id}><span>{row.appName}</span><span>{row.statusText}</span><span>{row.gpuModel}</span><span>{row.gpuCountText}</span><span>{row.region}</span><span>{result ?? plan}</span></div>;
            })}
          </div>
          <div className="batch-result-preview">
            <strong>执行预览</strong>
            <p><span>{executableCount} 个实例将执行{batchAction === 'boot' ? '开机' : '关机'}</span><span>{selectedIds.length - executableCount} 个实例会自动跳过</span><span>余额不足时全部停止执行</span></p>
          </div>
          <label className="batch-confirm"><input type="checkbox" checked readOnly /> 我已确认批量操作范围，并了解关机/删除可能影响正在运行的任务。</label>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={submitting || selectedIds.length === 0} onClick={submitBatch}>{submitting ? '执行中' : resultRows.length > 0 ? '再次执行' : '确认执行'}</button></footer>
      </section>
    </div>
  );
}

function ArtShell({ children, active }: { children: ReactNode; active: string }) {
  return (
    <div className="art-page">
      <header className="art-topbar">
        <a className="art-brand" href="/compute/app/market"><span />灵渠<em>Art</em></a>
        <div className="art-search"><button>应用⌄</button><input value="请输入应用名称或关键词" readOnly /><span>⌕</span></div>
        <ArtUserNav />
      </header>
      <div className="art-subnav"><a href="/compute/app/market">▦ 应用</a><a className={active === 'models' ? 'active' : ''} href="/compute/app/models">⬡ 大模型</a><a className={active === 'images' ? 'active' : ''} href="/compute/app/images">☁ 镜像</a></div>
      {children}
    </div>
  );
}

function ArtModelsPage() {
  const detailOpen = window.location.pathname.includes('/compute/app/models/');
  const modelId = detailOpen ? decodeURIComponent(window.location.pathname.split('/compute/app/models/')[1] || 'deepseek-v4-pro') : '';
  const vendors = ['DeepSeek', '智谱', 'Qwen', 'MiniMax', 'Kimi', '火山即梦', '海螺', 'Vidu', '可灵'];
  const types = ['对话', '生图', '视频'];
  const [models, setModels] = useState<ModelItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ total: 0, current: 0 });
  useEffect(() => {
    let alive = true;
    api.models.list().then((payload) => {
      if (alive) {
        setModels(payload.data.items);
        setSummary(payload.data.summary);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <ArtShell active="models">
      <div className="art-layout simple">
        <aside className="art-sidebar">
          <h2>探索</h2>
          {[
            ['模型广场', '/compute/app/models'],
            ['我的', '/compute/app/mine'],
            ['数据看板', '/compute/art/dashboard'],
            ['令牌管理', '/compute/art/tokens'],
            ['设置', '/compute/art/settings'],
          ].map((item, index) => <a className={index === 0 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['◇','▦','▥','▣','▤'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="model-market-main">
          <h1>模型广场</h1>
          <section className="art-overview-grid">
            {[
              ['模型总数', String(summary.total || models.length), '对话 / 生图 / 视频'],
              ['已接入', String(summary.current || 0), '当前账号可调用'],
              ['计费方式', '按 Token', '统一钱包扣费'],
              ['API Key', '2 个', '可在令牌管理中创建'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <div className="model-filter"><label>系列/厂商：</label>{vendors.map((item) => <button key={item}>{item}</button>)}</div>
          <div className="model-filter"><label>模型类型：</label>{types.map((item) => <button key={item}>{item}</button>)}</div>
          <section className="model-grid">
            {models.map((row) => (
              <article className="model-card" key={row.id} onClick={() => { window.location.href = `/compute/app/models/${row.id}`; }}>
                <h2>{row.name}</h2>
                {row.discount && <em>{row.discount}</em>}
                <p>{row.inputPrice || row.outputPrice}</p>
                {row.inputPrice && <p>{row.outputPrice}</p>}
                {row.originalPrice && <small>{row.originalPrice}</small>}
              </article>
            ))}
          </section>
          <div className="model-pager">共 {summary.total} 条 <b>1</b></div>
        </main>
      </div>
      {detailOpen && <ArtModelDetail modelId={modelId} />}
    </ArtShell>
  );
}

function ArtModelDetail({ modelId }: { modelId: string }) {
  const [modelModal, setModelModal] = useState<'playground' | 'docs' | ''>('');
  const [model, setModel] = useState<ModelItem | null>(null);
  useEffect(() => {
    let alive = true;
    api.models.detail(modelId).then((payload) => {
      if (alive) setModel(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [modelId]);
  const item = model ?? { id: modelId, name: '模型详情', vendor: '', type: '对话', discount: '', inputPrice: '', outputPrice: '', originalPrice: '', summary: '模型配置已同步', tags: ['对话'], updatedAt: '', priceRows: [['输入', '-', '-'], ['输出', '-', '-']], endpoint: 'https://api.yaochuang.tech/v1/chat/completions' };
  const priceRows = item.priceRows ?? [];
  return (
    <div className="art-detail-mask">
      <section className="art-model-detail">
        <button className="detail-close" onClick={() => { window.location.href = '/compute/app/models'; }}>×</button>
        <aside>
          <div className="model-logo">{item.vendor.slice(0, 2) || item.name.slice(0, 2)}</div>
          <h1>{item.name}</h1>
          <p>{item.summary}</p>
          <div className="model-detail-tags">{item.tags.map((tag) => <span key={tag}>{tag}</span>)}{item.discount && <span>{item.discount}</span>}</div>
          <button onClick={() => setModelModal('playground')}>立即调用</button>
          <button className="ghost" onClick={() => setModelModal('docs')}>查看 API 文档</button>
        </aside>
        <main>
          <section>
            <h2>价格详情</h2>
            <div className="model-price-table">
              {priceRows.map((row) => <div key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><small>{row[2]}</small></div>)}
            </div>
          </section>
          <section>
            <h2>调用方式</h2>
            <pre>{`POST /v1/chat/completions\nAuthorization: Bearer <API_KEY>\n\n{\n  "model": "${item.name}",\n  "messages": [{"role": "user", "content": "你好"}]\n}`}</pre>
          </section>
          <section>
            <h2>模型说明</h2>
            <p>{item.summary} 模型广场提供统一计费、令牌管理和用量看板。</p>
          </section>
        </main>
      </section>
      {modelModal && <ArtModelActionModal type={modelModal} model={item} onClose={() => setModelModal('')} />}
    </div>
  );
}

function ArtModelActionModal({ type, model, onClose }: { type: 'playground' | 'docs'; model: ModelItem; onClose: () => void }) {
  const isDocs = type === 'docs';
  return (
    <div className="art-action-mask nested">
      <section className={`art-model-action-modal ${isDocs ? 'docs' : ''}`}>
        <header><h2>{isDocs ? 'API 文档' : '在线试调'}</h2><button onClick={onClose}>×</button></header>
        {isDocs ? (
          <div className="model-doc-body">
            <nav><a className="active">认证</a><a>Chat Completions</a><a>错误码</a><a>计费</a></nav>
            <section>
              <h3>请求地址</h3>
              <pre>{`POST https://api.yaochuang.tech/v1/chat/completions`}</pre>
              <h3>Header</h3>
              <pre>{`Authorization: Bearer <API_KEY>\nContent-Type: application/json`}</pre>
              <h3>Body</h3>
              <pre>{`{\n  "model": "${model.name}",\n  "messages": [{"role": "user", "content": "你好"}],\n  "stream": false\n}`}</pre>
            </section>
          </div>
        ) : (
          <div className="model-play-body">
            <label><span>API Key</span><input value="sk-****-9f28" readOnly /></label>
            <label><span>模型</span><input value={model.name} readOnly /></label>
            <label className="prompt"><span>Prompt</span><textarea value="请用三句话介绍 LoRA 训练流程。" readOnly /></label>
            <div className="model-play-result"><strong>响应预览</strong><p>LoRA 训练通常包括准备数据集、选择基础模型并配置训练参数。训练完成后会生成轻量权重文件，可叠加到基础模型上使用。建议先用小样本验证配置，再扩大数据规模。</p><small>预估消耗 184 tokens · ￥0.0044</small></div>
          </div>
        )}
        <footer><button onClick={onClose}>关闭</button><button className="primary" onClick={onClose}>{isDocs ? '复制示例' : '发送请求'}</button></footer>
      </section>
    </div>
  );
}

function ArtImagesPage() {
  const detailOpen = window.location.pathname.includes('/compute/app/images/');
  const imageId = detailOpen ? decodeURIComponent(window.location.pathname.split('/compute/app/images/')[1] || 'lora-train') : '';
  const filters: Array<[string, string[]]> = [
    ['芯片', ['摩尔线程专区', '华为昇腾', 'NVIDIA']],
    ['CPU架构', ['x86_64', 'ARM64']],
    ['热门', ['Qwen', 'ComfyUI', 'FLUX', '音色转换', '实时变声器', 'Langchain', 'StableDiffusion', '虚拟人合成']],
    ['计算机视觉', ['语义分割', '视觉分类', '物体检测跟踪']],
    ['生成式算法', ['多模态', '文生图', '图像描述']],
    ['语音', ['声音克隆', '合成', '语音识别']],
  ];
  const [rows, setRows] = useState<ImageItem[]>([]);
  const [hot, setHot] = useState<ImageItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ total: 0 });
  useEffect(() => {
    let alive = true;
    api.images.list().then((payload) => {
      if (alive) {
        setRows(payload.data.items);
        setHot(payload.data.hot);
        setSummary(payload.data.summary);
      }
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return (
    <ArtShell active="images">
      <div className="image-market-layout">
        <aside className="image-filter-panel">
          {filters.map((group) => <section key={group[0]}><h2>{group[0]}</h2>{group[1].map((item) => <button key={item}>{item}</button>)}</section>)}
        </aside>
        <main className="image-list-main">
          <div className="image-tabs"><a className="active">热门</a><a>最新</a><a>周榜</a></div>
          <section className="art-overview-grid">
            {[
              ['镜像总数', String(summary.total || rows.length), '训练 / 推理 / 工作流'],
              ['热门镜像', String(hot.length), '按运行时长排序'],
              ['支持架构', 'x86 / ARM', '多芯片资源池'],
              ['创建实例', '一键创建', '自动注入启动命令'],
            ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          {rows.map((row) => (
            <article className="image-row-card" key={row.id} onClick={() => { window.location.href = `/compute/app/images/${row.id}`; }}>
              <div className="image-row-head"><strong>{row.author}</strong><span>{row.updatedText}</span><em>{row.badge}</em></div>
              <h2>{row.name}</h2>
              <div className="image-meta"><span>{row.runtimeRankText}</span><span>{row.githubStarText}</span></div>
              <p>{row.summary}</p>
              <div className="image-stats"><span>☆ {row.favoriteCount}</span><span>◷ {row.runtimeText}</span><span>⇩ {row.downloadCount}</span></div>
            </article>
          ))}
          <div className="image-pager">共 {summary.total} 条 <b>1</b></div>
        </main>
        <aside className="hot-image-panel">
          <h2>热门镜像</h2>
          {hot.map((row, index) => <article key={row.id}><b>{index + 1}</b><div><strong>{row.author}</strong><span>{row.runtimeText}</span><p>{row.name}</p><small>{row.githubStarText}</small></div></article>)}
        </aside>
      </div>
      {detailOpen && <ArtImageDetail imageId={imageId} />}
    </ArtShell>
  );
}

function ArtImageDetail({ imageId }: { imageId: string }) {
  const [createOpen, setCreateOpen] = useState(false);
  const [image, setImage] = useState<ImageItem | null>(null);
  useEffect(() => {
    let alive = true;
    api.images.detail(imageId).then((payload) => {
      if (alive) setImage(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [imageId]);
  const item = image ?? { id: imageId, author: '-', updatedText: '-', badge: '精', name: '镜像详情', runtimeRankText: '-', githubStarText: '-', summary: '镜像配置已同步', favoriteCount: 0, runtimeText: '0h', downloadCount: 0, systemText: '-', pythonText: '-', sizeText: '-', scenarioText: '-', tags: [], updatedAt: '', usageCommand: 'cd /root/project && bash start.sh', related: [] };
  return (
    <div className="art-detail-mask">
      <section className="art-image-detail">
        <button className="detail-close" onClick={() => { window.location.href = '/compute/app/images'; }}>×</button>
        <header>
          <div className="image-detail-avatar">镜</div>
          <div>
            <h1>{item.name}</h1>
            <p>{item.summary}</p>
            <div><span>{item.runtimeRankText}</span><span>{item.githubStarText}</span><span>下载 {item.downloadCount}</span></div>
          </div>
          <button onClick={() => setCreateOpen(true)}>使用该镜像创建</button>
        </header>
        <div className="image-detail-body">
          <aside>
            <h2>镜像信息</h2>
            {[
              ['作者', item.author],
              ['更新时间', item.updatedText],
              ['系统', item.systemText],
              ['Python', item.pythonText],
              ['镜像大小', item.sizeText],
              ['适用场景', item.scenarioText],
            ].map((row) => <p key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></p>)}
          </aside>
          <main>
            <h2>使用说明</h2>
            <p>创建实例后可在 JupyterLab 或 SSH 中进入工作目录，按镜像 README 启动脚本。常用数据集建议挂载到数据盘或网盘目录。</p>
            <pre>{item.usageCommand}</pre>
            <h2>相关推荐</h2>
            <div className="image-related">{(item.related ?? []).map((name) => <span key={name}>{name}</span>)}</div>
          </main>
        </div>
      </section>
      {createOpen && <ArtImageCreateModal image={item} onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ArtImageCreateModal({ image, onClose }: { image: ImageItem; onClose: () => void }) {
  return (
    <div className="art-action-mask nested">
      <section className="art-image-create-modal">
        <header><h2>使用镜像创建实例</h2><button onClick={onClose}>×</button></header>
        <div className="image-create-body">
          <div className="image-create-summary"><strong>{image.name}</strong><span>{image.systemText} · Python {image.pythonText} · {image.sizeText}</span></div>
          <label><span>计费方式</span><div><button className="active">按量计费</button><button>包日</button><button>包周</button></div></label>
          <label><span>GPU型号</span><div><button className="active">RTX 5090-32G</button><button>RTX 4090D-24G</button><button>RTX 4080S-32G</button></div></label>
          <label><span>服务入口</span><div><button className="active">JupyterLab</button><button>SSH</button><button>自定义端口</button></div></label>
          <label><span>启动命令</span><input value={image.usageCommand ?? 'cd /root/project && bash start.sh'} readOnly /></label>
          <div className="image-create-cost"><span>预估费用</span><b>￥-.-- / 时</b><small>系统盘 30GB 基础容量按￥0.1/日计费</small></div>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={() => { window.location.href = '/compute/rent'; }}>确认创建</button></footer>
      </section>
    </div>
  );
}

function ApiDeployPage() {
  const params = [
    ['deployment_name', 'string', '部署名称，建议与业务服务名称保持一致'],
    ['replicas', 'number', '容器副本数量，ReplicaSet 模式下用于弹性扩缩容'],
    ['region_sign', 'array', '调度地区，可传入多个地区编码'],
    ['gpu_name', 'array', '调度 GPU 型号，可与地区组合筛选库存'],
    ['image_uuid', 'string', '基础镜像或自定义镜像 ID'],
    ['cmd', 'string', '容器启动命令'],
  ];
  return (
    <main className="api-deploy-page">
      <section className="api-hero">
        <div>
          <h1>API弹性部署</h1>
          <p>通过接口创建、更新和管理弹性部署，适合服务化推理、自动调度和批量任务编排。</p>
          <div className="api-actions"><a href="/compute/deployments/create">创建部署</a><a href="/compute/docs">查看帮助文档</a></div>
        </div>
        <pre>{`POST /api/v1/deployment\nAuthorization: Bearer <token>\nContent-Type: application/json\n\n{\n  \"deployment_name\": \"llm-service\",\n  \"replicas\": 2,\n  \"gpu_name\": [\"RTX 4090\"]\n}`}</pre>
      </section>
      <section className="api-metric-grid">
        {[
          ['部署创建', 'POST', '创建 ReplicaSet / 单容器部署'],
          ['状态查询', 'GET', '查询部署、容器、费用状态'],
          ['扩缩容', 'PATCH', '调整副本数和调度条件'],
          ['回调通知', 'Webhook', '容器状态变更主动推送'],
        ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
      </section>
      <section className="api-steps">
        {['获取访问令牌', '配置调度条件', '提交部署请求', '查询容器状态'].map((item, index) => <article key={item}><b>{index + 1}</b><h2>{item}</h2><p>按弹性部署控制台字段组织参数，接口返回部署 ID 后可继续查询和管理。</p></article>)}
      </section>
      <section className="api-param-section">
        <h2>创建部署参数</h2>
        <div className="api-param-table">
          <div className="api-param-head"><span>字段</span><span>类型</span><span>说明</span></div>
          {params.map((row) => <div className="api-param-row" key={row[0]}><span>{row[0]}</span><span>{row[1]}</span><span>{row[2]}</span></div>)}
        </div>
      </section>
      <section className="api-footer-note"><h2>配合弹性接口接入</h2><p>接入弹性接口后，这里将直接串联部署创建、状态查询、扩缩容和费用统计。</p></section>
    </main>
  );
}

function SimpleTopPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="docs-page simple-top-page">
      <h1>{title}</h1>
      <p>{description}</p>
      <section className="docs-grid">
        <article><h2>创建</h2><p>按灵渠资源和账号权限创建任务。</p><a>查看详情</a></article>
        <article><h2>管理</h2><p>查看状态、日志、费用和使用记录。</p><a>查看详情</a></article>
        <article><h2>权限</h2><p>配置访问范围和共享策略。</p><a>查看详情</a></article>
      </section>
    </main>
  );
}

function ServersPage() {
  return (
    <main className="server-page">
      <div className="server-subbar"><span>AI服务器</span><div><a>♡ 我保存的配置 <b>0</b></a><a>♕ 发票/物流/售后</a></div></div>
      <section className="server-card">
        <div className="tag">8卡服务器</div>
        <h1>Intel 6430 x RTX 4090D服务器</h1>
        <p>超高性价比服务器，可托管于灵渠机房</p>
        <div className="server-visual"><div className="server-machine"><i /><i /><i /></div><strong>已售罄</strong></div>
        <ul>
          <li>2 x Intel 6430处理器 32核心64线程 主频2.10G</li>
          <li>16 x 三星32G DDR5 ECC 4800MHz</li>
          <li>1 x 三星480G SATA SSD</li>
          <li>2 x 三星7.68T SATA SSD</li>
          <li>8 x RTX 4090D</li>
          <li>1 x Mellanox 25G双口网卡</li>
          <li>所有GPU同时工作在PCIe4.0x16速率下</li>
        </ul>
        <div className="server-price">￥<b>999999.00</b></div>
      </section>
    </main>
  );
}

function DocsPage() {
  const path = window.location.pathname;
  const current = path.includes('/app-publish') ? 'app-publish' : path.includes('/instance') ? 'instance' : path.includes('/billing') ? 'billing' : path.includes('/api') ? 'api' : path.includes('/invoice') ? 'invoice' : path.includes('/trouble') ? 'trouble' : path.includes('/agreement') ? 'agreement' : path.includes('/quickstart') ? 'quickstart' : 'intro';
  const [docs, setDocs] = useState<HelpDocItem[]>([]);
  const [activeArticle, setActiveArticle] = useState<HelpDocItem | null>(null);
  useEffect(() => {
    api.docs.list().then((payload) => setDocs(payload.data.items)).catch(() => undefined);
    api.docs.detail(current).then((payload) => setActiveArticle(payload.data)).catch(() => undefined);
  }, [current]);
  const article = activeArticle ?? { key: current, title: '帮助文档', href: '/compute/docs', warning: '文档内容已同步', intro: '文档内容已同步。', sections: [], code: '' };
  return (
    <div className="docs-shell">
      <header className="docs-top"><a className="docs-brand" href="/compute"><span />灵渠帮助文档</a><div className="docs-top-search">⌕ 搜索</div></header>
      <aside className="docs-sidebar">
        <h2>灵渠帮助文档</h2>
        {docs.map((item) => <a className={current === item.key ? 'current' : ['app-publish', 'instance', 'billing', 'api'].includes(item.key) ? 'with-arrow' : ''} href={item.href} key={item.key}>{item.title}</a>)}
      </aside>
      <main className="docs-article">
        <h1>{article.title}</h1>
        <div className="doc-warning">{article.warning}</div>
        <section className="docs-quick-grid">
          {[
            ['快速开始', '/compute/docs/quickstart', '从创建实例到访问 WebUI'],
            ['应用发布', '/compute/docs/app-publish', '上传镜像并发布应用'],
            ['工作流', '/compute/workflows', '进入文生图/视频创作台'],
            ['费用账单', '/compute/app/billing', '查看余额、消费和发票'],
          ].map((item) => <a href={item[1]} key={item[0]}><strong>{item[0]}</strong><span>{item[2]}</span></a>)}
        </section>
        <hr />
        <p>{article.intro}</p>
        {article.sections.map((section) => (
          <section className="doc-section-block" key={section[0]}>
            <h3>{section[0]}</h3>
            <ol>{section[1].map((item) => <li key={item}><a>{item}</a></li>)}</ol>
          </section>
        ))}
        {article.code && <pre className="doc-code">{article.code}</pre>}
        <div className="doc-next-grid">
          <a href="/compute/app/market">应用广场</a>
          <a href="/compute/app/instances">应用实例</a>
          <a href="/compute/app/billing">钱包账单</a>
        </div>
      </main>
    </div>
  );
}

function ConsoleSideBar({ current }: { current: 'home' | 'instances' | 'instancesPro' | 'files' | 'fastfs' | 'netdisk' | 'images' | 'publicData' | 'billing' | 'account' }) {
  const items = [
    ['主页', '⌂', 'home', '/compute/dashboard'],
    ['容器实例', '⬡', 'instances', '/compute/instances'],
    ['弹性部署', '⌘', 'deployments', '/compute/deployments'],
    ['文件存储', '▣', 'files', '/compute/file-store'],
    ['高速文件存储', '▱', 'fastfs', '/compute/fast-file-store'],
    ['网盘', '▰', 'netdisk', '/compute/netdisk'],
    ['镜像', '◫', 'images', '/compute/images'],
    ['公开数据', '◉', 'publicData', '/compute/public-data'],
    ['费用', '￥', 'billing', '/compute/billing'],
    ['账号', '♙', 'account', '/compute/account/security'],
  ];
  return (
    <aside className="console-sidebar">
      {items.map(([label, icon, key, href]) => <a className={key === current ? 'current' : ''} href={href} key={label}><span>{icon}</span>{label}</a>)}
      {current === 'billing' && <div className="billing-submenu">{[
        ['收支明细', '/compute/billing'],
        ['我的订单', '/compute/billing/orders'],
        ['账单明细', '/compute/billing/detail'],
        ['代金券', undefined],
        ['优惠券', '/compute/billing/coupons'],
        ['发票管理', '/compute/billing/invoices'],
        ['合同', '/compute/billing/contracts'],
      ].map((item, index) => <a className={billingSubIndex() === index ? 'current' : ''} href={item[1]} key={item[0]}>{item[0]}</a>)}</div>}
      {current === 'account' && <div className="billing-submenu">{[
        ['账号安全', '/compute/account/security'],
        ['访问记录', '/compute/account/access'],
        ['子账号', '/compute/account/sub-accounts'],
        ['设置', '/compute/account/settings'],
      ].map((item, index) => <a className={accountSubIndex() === index ? 'current' : ''} href={item[1]} key={item[0]}>{item[0]}</a>)}</div>}
      <button className="collapse" type="button">☰</button>
    </aside>
  );
}

function accountSubIndex() {
  const path = window.location.pathname;
  if (path.includes('/access')) return 1;
  if (path.includes('/sub-accounts')) return 2;
  if (path.includes('/settings')) return 3;
  return 0;
}

function billingSubIndex() {
  const path = window.location.pathname;
  if (path.includes('/orders')) return 1;
  if (path.includes('/detail')) return 2;
  if (path.includes('/coupons')) return 4;
  if (path.includes('/invoices')) return 5;
  if (path.includes('/contracts')) return 6;
  return 0;
}

function DashboardPage({ data }: { data?: ComputePayload }) {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [subRows, setSubRows] = useState<SubAccountItem[]>([]);
  const [couponCount, setCouponCount] = useState(0);
  useEffect(() => {
    let alive = true;
    api.account.profile().then((payload) => {
      if (alive) setProfile(payload.data);
    }).catch(() => undefined);
    api.wallet.summary().then((payload) => {
      if (alive) setWallet(payload.data);
    }).catch(() => undefined);
    api.account.subAccounts().then((payload) => {
      if (alive) setSubRows(payload.data.items);
    }).catch(() => undefined);
    api.wallet.billing().then((payload) => {
      if (alive) setCouponCount(payload.data.coupons.filter((item) => item.status === '可用').length);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const displayName = profile?.nickName || profile?.userName || data?.account_name || '灵渠用户';
  const balance = wallet?.balanceCny ?? data?.balance_cny ?? 1303.96;
  const frozen = wallet?.frozenCny ?? 0;
  return (
    <div className="console-layout">
      <ConsoleSideBar current="home" />
      <main className="dashboard-main">
        <h1>首页</h1>
        <div className="dashboard-grid">
          <section className="dash-card usage-card">
            <div className="dash-col">
              <h2>容器实例</h2>
              <div className="metric-grid"><Metric label="总实例" value="3" blue /><Metric label="运行中" value="3" blue /><Metric label="无卡开机" value="0" /><Metric label="异常状态" value="0" /></div>
            </div>
            <div className="dash-col">
              <h2>无卡模式 <em>Pro</em></h2>
              <div className="metric-grid"><Metric label="总实例" value="0" blue /><Metric label="运行中" value="0" blue /><Metric label="无卡开机" value="0" /><Metric label="异常状态" value="0" /></div>
            </div>
            <div className="dash-col switches">
              <h2>便捷功能</h2>
              <div><span>关机/无卡开机 ⓘ</span><button className="switch on" /><b>开启</b><a>修改规则</a><small>规则生效中</small></div>
              <div><span>自动释放告警 ⓘ</span><button className="switch on" /><b>开启</b><small>（释放前50小时）</small></div>
            </div>
          </section>

          <aside className="dash-card profile-card">
            <h2>{displayName} <a href="/compute/art/profile">↗</a><em>个人认证</em></h2>
            <p>🏅 超级会员</p>
            <a href="/compute/account/security">个人资料与安全设置</a><a href="/compute/account/sub-accounts">子账号 {subRows.length} 个</a>
            <div className="progress-label"><span>成长值</span><b>6000 <small>/100</small></b></div>
            <div className="progress-bar"><i /></div>
            <p>成长值越高权益越多 <a>权益详情</a></p>
            <a>查看会员权益&gt;</a>
          </aside>

          <section className="dash-card disk-card">
            <h2>硬盘</h2>
            <div className="disk-grid"><Metric label="我的数据盘容量" hint="累计数据盘容量" value="0" unit="GB" /><Metric label="硬盘" hint="总容量" value="581" unit="GB" /><Metric label="快照容量" hint="总容量" value="0" unit="GB" /></div>
          </section>

          <aside className="dash-card wallet-card">
            <h2>我的余额</h2>
            <div className="wallet-box"><span>现金余额</span><button onClick={() => { window.location.href = '/compute/billing'; }}>去充值</button><strong>￥{balance.toFixed(2)}</strong><small>冻结金额 {frozen.toFixed(2)}</small></div>
            <p>🎟 优惠券 <b>{couponCount} 张</b></p><p>🧧 代金券 <span>暂无</span></p><p>🛡 保障 <span>暂无</span> <a href="/compute/billing/detail">查看明细</a></p>
            <div className="wallet-links"><a href="/compute/billing/orders">充值记录&gt;</a><a href="/compute/billing">消费记录&gt;</a><a href="/compute/billing/detail">账单明细&gt;</a><a href="/compute/billing/invoices">发票&gt;</a></div>
          </aside>

          <section className="dash-card notice-card">
            <h2>官方公告</h2>
            <p>租用新的GPU机器</p><p>平台升级维护公告</p><p>镜像与数据盘使用说明</p><p>计费规则与实例释放提醒</p><a>更多</a>
          </section>
        </div>
      </main>
    </div>
  );
}

function Metric({ label, value, hint, unit, blue }: { label: string; value: string; hint?: string; unit?: string; blue?: boolean }) {
  return <div className="metric"><span>{label}</span>{hint && <small>{hint}</small>}<b className={blue ? 'blue-num' : ''}>{value}</b>{unit && <em>{unit}</em>}</div>;
}

function FastFileStorePage() {
  return (
    <div className="console-layout">
      <ConsoleSideBar current="fastfs" />
      <main className="console-main fastfs-main">
        <div className="console-title file-title">
          <h1>高速文件存储</h1>
          <span>如购买到期会停止挂载存储，到期超过7天，平台保留删除数据的权利，具体规则请参考<a>文档</a></span>
        </div>
        <div className="region-tabs"><button className="selected">北京B区</button></div>
        <div className="fastfs-empty">
          <div className="cloud-icon">↻</div>
          <button>购买高速文件存储</button>
          <div><a>高速文件存储介绍</a><a>查看计费规则</a></div>
        </div>
      </main>
    </div>
  );
}

function PublicDataPage() {
  const [modal, setModal] = useState<'mount' | 'copy' | ''>('');
  const [rows, setRows] = useState<PublicDataItem[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({ total: 0 });
  useEffect(() => {
    api.publicData.list().then((payload) => {
      setRows(payload.data.items);
      setSummary(payload.data.summary);
    }).catch(() => undefined);
  }, []);
  return (
    <div className="console-layout">
      <ConsoleSideBar current="publicData" />
      <main className="console-main public-main">
        <div className="public-title"><h1>公开数据</h1><div className="search-like public-search">搜索数据集 <span>⌕</span></div></div>
        <section className="console-summary-grid compact">
          {[
            ['公开数据集', String(summary.total || rows.length), '平台维护只读挂载'],
            ['可用容量', '1.08TB', '不占个人存储'],
            ['覆盖地区', '4', '北京/重庆/西北'],
            ['今日挂载', '128', '训练实例直接读取'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="public-toolbar"><a className="usage-link" onClick={() => setModal('mount')}>如何使用公开数据？</a><button onClick={() => setModal('copy')}>复制挂载路径</button><button>申请发布数据</button></div>
        <div className="public-table">
          <div className="public-head"><span>数据名称</span><span>实例中路径</span><span>大小</span><span>类型</span><span>发布方</span><span>简介</span></div>
          {rows.map((row) => (
            <div className="public-row" key={row.id}>
              <span><a href={`/compute/public-data/detail?data=${row.id}`}>{row.name}</a></span><span>{row.mountPath} <a onClick={() => setModal('copy')}>▣</a></span><span>{row.sizeText}</span><span>{row.dataType}</span><span>{row.publisher}</span><span>{row.summary}</span>
            </div>
          ))}
        </div>
        <div className="console-pager">共 {summary.total} 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {modal && <PublicDataModal type={modal} onClose={() => setModal('')} />}
    </div>
  );
}

function PublicDataDetailPage() {
  const [modal, setModal] = useState<'mount' | 'copy' | ''>('');
  const dataId = new URLSearchParams(window.location.search).get('data') || 'argoverse2-sensor';
  const [dataRow, setDataRow] = useState<PublicDataItem | null>(null);
  useEffect(() => {
    api.publicData.detail(dataId).then((payload) => setDataRow(payload.data)).catch(() => undefined);
  }, [dataId]);
  const item = dataRow ?? { id: dataId, name: '公开数据', mountPath: '/root/lingqu-pub', sizeText: '-', dataType: '数据集', publisher: '-', summary: '数据目录已同步', files: [] };
  const files = item.files;
  const examples = [
    ['查看路径', `ls ${item.mountPath}`],
    ['软链到工作目录', `ln -s ${item.mountPath} /root/lingqu-tmp/${item.id}`],
    ['Python读取', `python train.py --data ${item.mountPath}`],
  ];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="publicData" />
      <main className="public-detail-main">
        <div className="compute-detail-head">
          <div>
            <div className="rent-crumb">公开数据 / 数据详情</div>
            <h1>{item.name}</h1>
            <p>{item.sizeText} · {item.dataType} · 发布方 {item.publisher}</p>
          </div>
          <div><button onClick={() => setModal('copy')}>复制路径</button><button onClick={() => setModal('mount')}>挂载说明</button><button onClick={() => { window.location.href = '/compute/public-data'; }}>返回列表</button></div>
        </div>
        <section className="public-detail-hero">
          <div>
            <span className="compute-state">只读挂载</span>
            <h2>{item.mountPath}</h2>
            <p>公开数据会自动挂载到同地区实例的 `/root/lingqu-pub` 目录。数据为只读模式，不占用个人文件存储容量，适合训练、评测和快速复现实验。</p>
            <div><button onClick={() => setModal('copy')}>复制实例路径</button><button onClick={() => setModal('mount')}>查看使用方式</button><button>收藏数据集</button></div>
          </div>
          <aside><span>数据大小</span><strong>{item.sizeText}</strong><small>平台维护，用户只读</small></aside>
        </section>
        <div className="compute-detail-grid">
          <section className="compute-card">
            <div className="compute-card-title"><h2>目录结构</h2><span>实例内可见路径</span></div>
            <div className="public-file-table">
              <div className="head"><span>名称</span><span>类型</span><span>大小</span><span>说明</span></div>
              {files.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="compute-card">
            <div className="compute-card-title"><h2>基础信息</h2><span>数据集元信息</span></div>
            <div className="image-info-list">
              {[
                ['数据名称', item.name],
                ['实例路径', item.mountPath],
                ['数据类型', item.dataType],
                ['发布方', item.publisher],
                ['访问方式', '实例内只读挂载'],
                ['计费规则', '不计入个人存储容量'],
              ].map((row) => <p key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></p>)}
            </div>
          </section>
        </div>
        <section className="compute-card">
          <div className="compute-card-title"><h2>使用示例</h2><span>复制到实例终端执行</span></div>
          <div className="public-example-grid">
            {examples.map((row) => <article key={row[0]}><strong>{row[0]}</strong><pre>{row[1]}</pre><button>复制</button></article>)}
          </div>
        </section>
      </main>
      {modal && <PublicDataModal type={modal} onClose={() => setModal('')} />}
    </div>
  );
}

function PublicDataModal({ type, onClose }: { type: 'mount' | 'copy'; onClose: () => void }) {
  const isCopy = type === 'copy';
  return (
    <div className="modal-mask">
      <section className="compute-action-modal public-data-modal">
        <header><h2>{isCopy ? '复制公开数据路径' : '公开数据使用说明'}</h2><button onClick={onClose}>×</button></header>
        {isCopy ? (
          <div className="compute-action-form">
            <label><span>实例路径</span><input value="/root/lingqu-pub/argoverse2.0-sensor" readOnly /></label>
            <label><span>软链命令</span><input value="ln -s /root/lingqu-pub/argoverse2.0-sensor /root/lingqu-tmp/argoverse2" readOnly /></label>
            <p>公开数据为只读目录，训练输出请写入 `/root/lingqu-tmp` 或文件存储。</p>
          </div>
        ) : (
          <div className="public-help-body">
            <article><b>1</b><div><strong>创建同区实例</strong><p>公开数据会挂载到支持该数据集的实例地区。</p></div></article>
            <article><b>2</b><div><strong>进入实例终端</strong><p>通过 SSH 或 JupyterLab 查看 `/root/lingqu-pub`。</p></div></article>
            <article><b>3</b><div><strong>读取数据训练</strong><p>直接使用路径读取，输出文件写入个人数据盘。</p></div></article>
          </div>
        )}
        <footer><button onClick={onClose}>关闭</button><button className="primary" onClick={onClose}>{isCopy ? '复制' : '知道了'}</button></footer>
      </section>
    </div>
  );
}

function FileStorePage() {
  const regions = ['北京B区', '内蒙B区', '重庆A区', '北京A区', '西北企业区', '西北B区', 'L20专区', 'A800专区'];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="files" />
      <main className="console-main file-main">
        <div className="console-title file-title">
          <h1>文件存储</h1>
          <span>文件存储在实例中的挂载目录为：/root/lingqu-fs。连续3个月未登录或欠费50元以上，平台保留删除数据的权利，具体规则请参考<a>文档</a></span>
        </div>
        <section className="console-summary-grid compact">
          {[
            ['今日峰值', '231MB', '预计扣费 ￥0.00'],
            ['免费容量', '20GB', '每地区独立计算'],
            ['付费容量', '0GB', '超出免费后计费'],
            ['挂载路径', '/root/lingqu-fs', '实例内自动挂载'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="region-tabs">{regions.map((item, index) => <button className={index === 0 ? 'selected' : ''} key={item}>{item}</button>)}</div>
        <section className="image-usage file-usage">
          <div className="image-usage-head"><span><b>231MB</b>/200GB（今天容量使用峰值231MB，预计扣费0元）</span><a>查看计费规则</a><a>展开更多信息</a></div>
          <div className="image-bar file-bar"><i className="free-part" /></div>
          <div className="image-legend"><span><i className="blue-dot" />免费20GB</span><span><i className="orange-dot" />付费0GB</span></div>
        </section>
        <div className="file-table-title"><h2>北京B区</h2><span>文件与目录数量超过300条，最多显示300条记录</span><button>⇧ 上传</button></div>
        <div className="file-table">
          <div className="file-head"><span>文件名称</span><span>大小</span><span>更新时间</span><span>操作</span></div>
          <div className="file-row"><span><i className="folder-icon" />audio_model_v2</span><span>4KB</span><span>-</span><span><a className="danger">删除</a></span></div>
        </div>
      </main>
    </div>
  );
}

function NetdiskPage() {
  return (
    <div className="console-layout">
      <ConsoleSideBar current="netdisk" />
      <main className="console-main netdisk-main">
        <div className="console-title netdisk-title">
          <h1>我的网盘</h1>
          <span>连续3个月未续费，网盘数据将被清空。</span>
        </div>
        <section className="console-summary-grid compact">
          {[
            ['服务状态', '即将下线', '建议迁移到文件存储'],
            ['当前网盘', '0 个', '无可用挂载'],
            ['替代方案', '文件存储', '/root/lingqu-fs'],
            ['备份建议', '立即迁移', '避免历史数据丢失'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <p className="netdisk-warning">如扩容到期且使用量超出免费容量，将会停止实例挂载网盘，直至扩容或清理数据</p>
        <p className="netdisk-warning strong">非常抱歉通知您，网盘功能即将于 2025-07-15 日永久下线，请尽快备份数据，如您续费超过此日期请联系客服双倍退还未使用时长费用，此外可以换用同地区文件存储，相同的功能更好的体验</p>
        <div className="netdisk-separator" />
        <div className="netdisk-empty"><div className="empty-illustration">◇</div><span>暂无可用网盘</span></div>
      </main>
    </div>
  );
}

function ImagesPage() {
  const [modal, setModal] = useState<'edit' | 'share' | 'delete' | 'create' | ''>('');
  return (
    <div className="console-layout">
      <ConsoleSideBar current="images" />
      <main className="console-main images-main">
        <div className="console-title image-title">
          <h1>我的镜像</h1>
          <span>连续3个月未登录或欠费50元以上，平台保留删除数据的权利，具体规则请参考<a>文档</a></span>
        </div>
        <section className="console-summary-grid compact">
          {[
            ['镜像数量', String(imageRows.length), '私有镜像可创建实例'],
            ['存储用量', '611.25GB', '今日预计 ￥5.81'],
            ['已缓存地区', '3', '同区创建更快'],
            ['安全扫描', '全部通过', '保存后自动扫描'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="console-toolbar image-toolbar">
          <button className="blue" onClick={() => setModal('create')}>保存实例为镜像</button>
          <button>导入镜像</button>
          <button className="refresh">C</button>
          <div className="toolbar-spacer" />
          <div className="search-like">搜索镜像名称/UUID <span>⌕</span></div>
        </div>
        <section className="image-usage">
          <div className="image-usage-head"><span>存储容量大小:<b>611.25GB</b>（今天容量使用峰值611.25GB，预计扣费5.81元）</span><a>查看计费规则</a></div>
          <div className="image-bar"><i className="free-part" /><i className="paid-part" /></div>
          <div className="image-legend"><span><i className="blue-dot" />免费30.00GB</span><span><i className="orange-dot" />付费581.25GB</span></div>
        </section>
        <div className="image-table">
          <div className="image-head"><span>镜像UUID</span><span>镜像名称</span><span>大小</span><span>状态</span><span>共享信息</span><span>来源</span><span>缓存地区 ⓘ</span><span>原基础镜像信息</span><span>创建时间</span><span>操作</span></div>
          {imageRows.map((row) => (
            <div className="image-row" key={row.uuid}>
              <span><a href="/compute/images/detail">{row.uuid}</a></span><span>{row.name}</span><span>{row.size}</span><span><i className="dot green" />{row.status}</span><span>{row.share}</span><span>{row.source}</span><span>{row.cache}</span><span>{row.base}</span><span>{row.created}</span>
              <span className="image-actions"><a onClick={() => setModal('edit')}>编辑</a><a onClick={() => setModal('share')}>共享</a><a className="danger" onClick={() => setModal('delete')}>删除</a></span>
            </div>
          ))}
        </div>
        <div className="console-pager">共 38 条 <span>‹</span><b>1</b><b className="dark">2</b><b className="dark">3</b><b className="dark">4</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {modal && <ComputeImageActionModal type={modal} onClose={() => setModal('')} />}
    </div>
  );
}

function ComputeImageDetailPage() {
  const [modal, setModal] = useState<'edit' | 'share' | 'delete' | 'create' | ''>('');
  const image = imageRows[0];
  const caches = [
    ['重庆A区', '已缓存', '2026-04-15 13:41:20', '可直接创建实例'],
    ['北京B区', '同步中', '2026-05-20 16:22:10', '预计 18 分钟完成'],
    ['西北B区', '未缓存', '-', '首次创建会自动同步'],
  ];
  const tasks = [
    ['2026-04-15 13:30:50', '从实例保存镜像', 'ins-941327a885', '成功'],
    ['2026-04-15 13:36:12', '镜像安全扫描', '系统任务', '通过'],
    ['2026-04-15 13:41:20', '缓存到重庆A区', '调度系统', '成功'],
  ];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="images" />
      <main className="compute-image-detail">
        <div className="compute-detail-head">
          <div>
            <div className="rent-crumb">我的镜像 / 镜像详情</div>
            <h1>{image.name}</h1>
            <p>{image.uuid} · {image.size} · {image.status} · {image.share}</p>
          </div>
          <div><button onClick={() => setModal('edit')}>编辑</button><button onClick={() => setModal('share')}>共享</button><button onClick={() => setModal('create')}>创建实例</button><button onClick={() => setModal('delete')}>删除</button></div>
        </div>
        <section className="console-summary-grid compact">
          {[
            ['镜像状态', image.status, '可直接创建实例'],
            ['镜像大小', image.size, '按日计费存储'],
            ['缓存地区', image.cache, '同区创建更快'],
            ['扫描结果', '通过', '系统自动安全检查'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <section className="compute-image-hero">
          <div className="image-detail-icon">镜</div>
          <div>
            <span className="compute-state">就绪</span>
            <h2>Miniconda / Python 3.10 / CUDA 11.8</h2>
            <p>该镜像由 平台实例保存而来，包含系统环境、已安装依赖和工作目录配置。可用于创建新实例、弹性部署基础镜像或共享给团队成员。</p>
            <div><button onClick={() => setModal('create')}>用镜像创建实例</button><button>复制镜像UUID</button><button>同步缓存</button></div>
          </div>
          <aside><span>今日存储费用</span><strong>￥5.81</strong><small>已用容量 611.25GB</small></aside>
        </section>
        <div className="compute-detail-grid">
          <section className="compute-card">
            <div className="compute-card-title"><h2>基础信息</h2><a onClick={() => setModal('edit')}>编辑</a></div>
            <div className="image-info-list">
              {[
                ['镜像UUID', image.uuid],
                ['镜像名称', image.name],
                ['镜像大小', image.size],
                ['来源', image.source],
                ['缓存地区', image.cache],
                ['创建时间', image.created],
              ].map((row) => <p key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></p>)}
            </div>
          </section>
          <section className="compute-card">
            <div className="compute-card-title"><h2>原基础镜像</h2><span>保存镜像时的基础环境</span></div>
            <pre>{image.base}</pre>
          </section>
        </div>
        <section className="compute-card">
          <div className="compute-card-title"><h2>地区缓存</h2><span>缓存完成后同区创建实例更快</span></div>
          <div className="image-cache-table">
            <div className="head"><span>地区</span><span>状态</span><span>更新时间</span><span>说明</span></div>
            {caches.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 1 ? (cell === '已缓存' ? 'ok' : cell === '同步中' ? 'pending' : '') : ''} key={cell}>{cell}</span>)}</div>)}
          </div>
        </section>
        <section className="compute-card">
          <div className="compute-card-title"><h2>任务记录</h2><span>保存、扫描、缓存和共享记录</span></div>
          <div className="image-task-table">
            <div className="head"><span>时间</span><span>任务</span><span>来源</span><span>结果</span></div>
            {tasks.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
          </div>
        </section>
      </main>
      {modal && <ComputeImageActionModal type={modal} onClose={() => setModal('')} />}
    </div>
  );
}

function ComputeImageActionModal({ type, onClose }: { type: 'edit' | 'share' | 'delete' | 'create'; onClose: () => void }) {
  const isDelete = type === 'delete';
  const isShare = type === 'share';
  const isCreate = type === 'create';
  return (
    <div className="modal-mask">
      <section className={`compute-action-modal image-action-modal ${isDelete ? 'danger' : ''}`}>
        <header><h2>{isDelete ? '删除镜像' : isShare ? '共享镜像' : isCreate ? '用镜像创建实例' : '编辑镜像'}</h2><button onClick={onClose}>×</button></header>
        {isDelete ? (
          <div className="compute-action-body"><span>!</span><p>删除镜像后无法通过该镜像创建实例，已缓存地区的镜像副本也会被清理。</p><label><input type="checkbox" checked readOnly /> 我已确认镜像不再使用</label></div>
        ) : isShare ? (
          <div className="compute-action-form image-action-form">
            <label><span>共享范围</span><div><button className="active">私有</button><button>团队</button><button>公开</button></div></label>
            <label><span>授权账号</span><input value="请输入用户ID或手机号" readOnly /></label>
            <label><span>权限</span><div><button className="active">只读使用</button><button>允许复制</button></div></label>
            <p>共享后对方可以在“我的镜像”中看到该镜像，并用它创建实例。</p>
          </div>
        ) : isCreate ? (
          <div className="compute-action-form image-action-form">
            <label><span>地区</span><div><button className="active">重庆A区</button><button>北京B区</button><button>西北B区</button></div></label>
            <label><span>GPU</span><div><button className="active">RTX 5090</button><button>RTX 4090D</button><button>vGPU-32GB</button></div></label>
            <label><span>系统盘</span><input value="30GB" readOnly /></label>
            <p>创建后会进入容器实例列表，开机后可访问 JupyterLab、SSH 和自定义服务。</p>
          </div>
        ) : (
          <div className="compute-action-form image-action-form">
            <label><span>镜像名称</span><input value="new0415" readOnly /></label>
            <label><span>描述</span><input value="Python 3.10 / CUDA 11.8 训练环境" readOnly /></label>
            <label><span>标签</span><div><button className="active">训练</button><button className="active">CUDA</button><button>WebUI</button></div></label>
            <p>修改名称和描述不会影响镜像 UUID、大小和缓存副本。</p>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>{isDelete ? '确认删除' : isShare ? '保存共享' : isCreate ? '创建实例' : '保存'}</button></footer>
      </section>
    </div>
  );
}

function BillingPage() {
  const [billing, setBilling] = useState<WalletBilling | null>(null);
  useEffect(() => {
    let alive = true;
    api.wallet.billing().then((payload) => {
      if (alive) setBilling(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const rows = billing?.ledger ?? [];
  const balance = billing?.summary.balanceCny ?? 1303.96;
  const billingSummary = [
    ['可用余额', `￥${balance.toFixed(2)}`, '支持微信/支付宝充值'],
    ['本月消费', `￥${(billing?.summary.monthExpenseCny ?? 24.23).toFixed(2)}`, '实例、镜像、工作流'],
    ['可开票金额', `￥${(billing?.summary.invoiceableCny ?? 500).toFixed(2)}`, '可申请电子发票'],
    ['优惠券', String(billing?.coupons.filter((item) => item.status === '可用').length ?? 2), '可用于算力抵扣'],
  ];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="billing" />
      <main className="console-main billing-main">
        <div className="billing-page-head"><h1>收支明细</h1><button>充值</button></div>
        <section className="billing-summary-grid">
          {billingSummary.map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="billing-filter">
          <label>交易时间：</label>
          <div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div>
        </div>
        <div className="billing-table">
          <div className="billing-head"><span>流水号</span><span>交易时间</span><span>收支类型 ⌯</span><span>交易类型 ⌯</span><span>交易渠道</span><span>交易金额</span><span>账户余额</span><span>备注</span></div>
          {rows.length > 0 ? rows.map((row) => (
            <div className="billing-data-row" key={row.id}><span>{row.id}</span><span>{row.createdAt}</span><span>{row.incomeType}</span><span>{row.tradeType}</span><span>{row.channel}</span><span>{row.amountText}</span><span>{row.balanceText}</span><span>{row.note}</span></div>
          )) : <div className="empty-row">暂无数据</div>}
        </div>
        <div className="console-pager billing-pager">共 {rows.length} 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function BillingSubPage({ kind }: { kind: 'orders' | 'detail' | 'coupons' | 'invoices' | 'contracts' }) {
  const [modal, setModal] = useState<'invoice' | 'contract' | ''>('');
  const [billing, setBilling] = useState<WalletBilling | null>(null);
  const loadBilling = () => api.wallet.billing().then((payload) => setBilling(payload.data)).catch(() => undefined);
  useEffect(() => {
    let alive = true;
    api.wallet.billing().then((payload) => {
      if (alive) setBilling(payload.data);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const config = {
    orders: {
      title: '我的订单',
      filter: ['创建时间：', '订单类型：全部', '订单状态：全部'],
      heads: ['订单号', '创建时间', '订单类型', '订单状态', '订单金额', '支付方式', '操作'],
      rows: [
        ['ORDER202605200001', '2026-05-20 16:02:11', '充值订单', '已支付', '￥500.00', '微信支付', '详情'],
        ['ORDER202605180014', '2026-05-18 15:40:02', '算力消费', '已完成', '￥18.42', '余额扣费', '详情'],
      ],
    },
    detail: {
      title: '账单明细',
      filter: ['账单月份：', '资源类型：全部', '计费方式：全部'],
      heads: ['账单号', '账单周期', '资源类型', '资源ID', '消费金额', '抵扣金额', '实付金额', '状态'],
      rows: [
        ['BILL202605200001', '2026-05', '容器实例', 'ins-941327a885', '￥18.42', '￥0.00', '￥18.42', '已出账'],
        ['BILL202605200002', '2026-05', '镜像存储', 'image-e55db9ae41', '￥5.81', '￥0.00', '￥5.81', '计费中'],
      ],
    },
    coupons: {
      title: '优惠券',
      filter: ['优惠券状态：全部', '获得时间：'],
      heads: ['优惠券名称', '优惠内容', '适用范围', '有效期', '状态', '操作'],
      rows: [
        ['新用户算力券', '满100减20', '容器实例/弹性部署', '2026-06-30', '可用', '立即使用'],
        ['镜像存储抵扣券', '存储费用8折', '我的镜像', '2026-07-31', '可用', '立即使用'],
      ],
    },
    invoices: {
      title: '发票管理',
      filter: ['申请时间：', '发票类型：全部', '发票状态：全部'],
      heads: ['发票号', '申请时间', '发票类型', '抬头', '开票内容', '金额', '状态', '操作'],
      rows: [
        ['FP202605200001', '2026-05-20 16:12:00', '个人普通发票', '灵渠用户', '算力服务费', '￥500.00', '待开票', '查看'],
        ['FP202604300014', '2026-04-30 10:18:22', '企业普通发票', '耀创科技', '算力服务费', '￥268.40', '已开票', '下载'],
      ],
    },
    contracts: {
      title: '合同',
      filter: ['创建时间：', '合同类型：全部', '合同状态：全部'],
      heads: ['合同编号', '创建时间', '合同类型', '主体', '金额', '状态', '操作'],
      rows: [
        ['HT202605200001', '2026-05-20 16:18:44', '算力服务合同', '耀创科技', '￥500.00', '待签署', '签署'],
        ['HT202604160002', '2026-04-16 09:10:23', '框架服务合同', '耀创科技', '￥0.00', '已归档', '下载'],
      ],
    },
  }[kind];
  const dbRows = kind === 'orders'
    ? (billing?.orders.map((row) => [row.orderNo, row.createdAt, row.orderType, row.status, row.amount, row.payChannel, row.action]) ?? config.rows)
    : kind === 'detail'
      ? (billing?.detail.map((row) => [row.billNo, new Date().toISOString().slice(0, 7), row.product, row.target, row.amount, '￥0.00', row.amount, row.status]) ?? config.rows)
      : kind === 'invoices'
        ? (billing?.invoices.map((row) => [row.invoiceNo, row.createdAt, row.type, '灵渠用户', row.content, row.amount, row.status, row.action]) ?? config.rows)
        : kind === 'coupons'
          ? (billing?.coupons.map((row) => [row.name, row.discount, row.scope, row.validUntil, row.status, row.action]) ?? config.rows)
          : kind === 'contracts'
            ? (billing?.contracts.map((row) => [row.contractNo, row.createdAt, row.contractType, row.subject, row.amount, row.status, row.action]) ?? config.rows)
        : config.rows;
  const isInvoice = kind === 'invoices';
  const isContract = kind === 'contracts';
  return (
    <div className="console-layout">
      <ConsoleSideBar current="billing" />
      <main className="console-main billing-main">
        <div className="billing-page-head"><h1>{config.title}</h1>{isInvoice && <button onClick={() => setModal('invoice')}>申请开票</button>}{isContract && <button onClick={() => setModal('contract')}>申请合同</button>}</div>
        <section className="billing-summary-grid compact">
          {[
            ['记录数量', String(dbRows.length), `${config.title}当前筛选结果`],
            ['本月金额', kind === 'coupons' ? '2 张可用' : kind === 'contracts' ? '￥500.00' : '￥524.23', '按当前账号统计'],
            ['处理状态', kind === 'invoices' ? '待开票 1' : kind === 'contracts' ? '待签署 1' : '正常', '可继续查看详情'],
            ['导出能力', 'CSV / XLSX', '支持财务归档'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="billing-filter wide">
          {config.filter.map((item) => item.endsWith('：') ? <label key={item}>{item}</label> : <div className="select-like mini-select" key={item}>{item} <span>⌄</span></div>)}
          <div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div>
        </div>
        <div className="billing-table">
          <div className={`billing-head ${kind}`}>{config.heads.map((item) => <span key={item}>{item}</span>)}</div>
          {dbRows.map((row) => <div className={`billing-data-row ${kind}`} key={row[0]}>{row.map((cell, index) => <span className={index === row.length - 1 ? 'action' : ''} key={`${row[0]}-${cell}-${index}`} onClick={() => isInvoice && index === row.length - 1 ? setModal('invoice') : isContract && index === row.length - 1 ? setModal('contract') : undefined}>{cell}</span>)}</div>)}
        </div>
        <div className="console-pager billing-pager">共 {dbRows.length} 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {modal && <BillingApplyModal type={modal} onClose={() => setModal('')} onDone={loadBilling} amount={billing?.summary.invoiceableCny || 500} />}
    </div>
  );
}

function BillingApplyModal({ type, onClose, onDone, amount }: { type: 'invoice' | 'contract'; onClose: () => void; onDone: () => void; amount: number }) {
  const isInvoice = type === 'invoice';
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const submit = async () => {
    setBusy(true);
    setStatus('');
    try {
      if (isInvoice) {
        const result = await api.wallet.invoice({ amount, invoiceType: '个人普通发票', title: '耀创科技', content: '算力服务费', email: 'finance@yaochuang.tech' });
        setStatus(`${result.status}：${result.invoiceNo}`);
      } else {
        const result = await api.wallet.contract({ amount, contractType: '算力服务合同', subject: '耀创科技', email: 'finance@yaochuang.tech' });
        setStatus(`${result.status}：${result.contractNo}`);
      }
      await onDone();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '提交失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-mask">
      <section className="compute-action-modal billing-apply-modal">
        <header><h2>{isInvoice ? '申请开票' : '申请合同'}</h2><button onClick={onClose}>×</button></header>
        <div className="compute-action-form billing-apply-form">
          <label><span>{isInvoice ? '发票类型' : '合同类型'}</span><div><button className="active">{isInvoice ? '个人普通发票' : '算力服务合同'}</button><button>{isInvoice ? '企业专票' : '框架服务合同'}</button></div></label>
          <label><span>{isInvoice ? '抬头' : '签约主体'}</span><input value={isInvoice ? '耀创科技' : '耀创科技有限公司'} readOnly /></label>
          <label><span>关联订单</span><input value={`可开票金额 / ￥${amount.toFixed(2)}`} readOnly /></label>
          <label><span>{isInvoice ? '接收邮箱' : '联系人邮箱'}</span><input value="finance@yaochuang.tech" readOnly /></label>
          <p>{isInvoice ? '提交后将在 1-3 个工作日内处理，电子发票会发送到接收邮箱。' : '合同申请提交后可在线签署，签署完成后可在合同列表下载归档文件。'}</p>
          {status && <p className="pay-status">{status}</p>}
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={busy} onClick={submit}>{busy ? '提交中...' : '提交'}</button></footer>
      </section>
    </div>
  );
}

function AccountSecurityPage() {
  const [modal, setModal] = useState<'password' | 'phone' | 'realname' | 'wechat' | 'email' | ''>('');
  const [rows, setRows] = useState<AccountSecurityItem[]>([]);
  useEffect(() => {
    let alive = true;
    api.account.security().then((payload) => {
      if (alive) setRows(payload.data.items);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const fallbackRows: AccountSecurityItem[] = [
    { title: '登录密码', desc: '安全性高的密码可以使账号更安全。建议您定期更换密码，设置一个包含字母和数字且长度超过8位的密码', status: '已设置', action: '修改', ok: true, key: 'password' },
    { title: '手机绑定', desc: '您已绑定了手机177****7953您的手机号可以直接用于登录、找回密码等', status: '已绑定', action: '修改', ok: true, key: 'phone' },
    { title: '实名认证', desc: '实名认证后可以使用更完整的功能，如打开实例的自定义服务等', status: '已认证', action: '查看', ok: true, key: 'realname' },
  ];
  const visibleRows = rows.length > 0 ? rows : fallbackRows;
  const doneCount = visibleRows.filter((row) => row.ok).length;
  return (
    <div className="console-layout">
      <ConsoleSideBar current="account" />
      <main className="console-main account-main">
        <h1>账号安全</h1>
        <section className="account-security-hero">
          <div><span>安全等级</span><strong>{doneCount >= visibleRows.length ? '高' : '中'}</strong><p>已完成 {doneCount}/{visibleRows.length} 项安全设置</p></div>
          <aside><button onClick={() => setModal('password')}>修改密码</button><button onClick={() => setModal('phone')}>绑定手机</button><button onClick={() => setModal('realname')}>实名认证</button></aside>
        </section>
        <div className="security-list">
          {visibleRows.map((row) => (
            <section className="security-card" key={row.key}>
              <div><h2>{row.title}</h2><p>{row.desc}</p></div>
              <span className={row.ok ? 'ok' : 'warn'}>{row.ok ? '◎' : 'ⓘ'} {row.status}</span>
              <a onClick={() => setModal(row.key)}>{row.action}</a>
            </section>
          ))}
        </div>
      </main>
      {modal && <AccountActionModal type={modal} onClose={() => setModal('')} />}
    </div>
  );
}

function AccountSubPage({ kind }: { kind: 'access' | 'sub' | 'settings' }) {
  const [modal, setModal] = useState<'sub' | 'settings' | 'access' | ''>('');
  const [accessRows, setAccessRows] = useState<AccountAccessItem[]>([]);
  const [subRows, setSubRows] = useState<SubAccountItem[]>([]);
  const [setting, setSetting] = useState<AccountSetting>({ messageNotify: true, defaultRegion: '重庆A区', releaseReminder: true });
  const loadSubAccounts = () => api.account.subAccounts().then((payload) => setSubRows(payload.data.items)).catch(() => undefined);
  const loadSetting = () => api.account.settings().then((payload) => setSetting(payload.data)).catch(() => undefined);
  useEffect(() => {
    let alive = true;
    if (kind === 'access') {
      api.account.access().then((payload) => {
        if (alive) setAccessRows(payload.data.items);
      }).catch(() => undefined);
    }
    if (kind === 'sub') {
      api.account.subAccounts().then((payload) => {
        if (alive) setSubRows(payload.data.items);
      }).catch(() => undefined);
    }
    if (kind === 'settings') {
      api.account.settings().then((payload) => {
        if (alive) setSetting(payload.data);
      }).catch(() => undefined);
    }
    return () => {
      alive = false;
    };
  }, [kind]);
  if (kind === 'settings') {
    return (
      <div className="console-layout">
        <ConsoleSideBar current="account" />
        <main className="console-main account-main">
          <h1>设置</h1>
          <div className="settings-list">
            <section><h2>消息通知</h2><p>余额不足、实例即将到期、实例即将释放等消息通知</p><button className={`switch ${setting.messageNotify ? 'on' : ''}`} onClick={() => setModal('settings')} /><span>{setting.messageNotify ? '开启' : '关闭'}</span></section>
            <section><h2>默认地区</h2><p>租用新实例时默认选择的地区</p><div className="select-like settings-select" onClick={() => setModal('settings')}>{setting.defaultRegion} <span>⌄</span></div></section>
            <section><h2>自动释放提醒</h2><p>实例释放前通知账号绑定手机和邮箱</p><button className={`switch ${setting.releaseReminder ? 'on' : ''}`} onClick={() => setModal('settings')} /><span>{setting.releaseReminder ? '开启' : '关闭'}</span></section>
          </div>
        </main>
        {modal && <AccountActionModal type={modal} onClose={() => setModal('')} onDone={loadSetting} setting={setting} />}
      </div>
    );
  }
  const config = kind === 'access'
    ? { title: '访问记录', filter: '访问时间：', heads: ['访问时间', '登录IP', '登录地区', '登录方式', '状态'], rows: [['2026-05-20 16:42:11', '47.103.49.82', '上海', '密码登录', '成功'], ['2026-05-19 21:18:03', '101.88.23.12', '上海', '微信扫码', '成功']] }
    : { title: '子账号', filter: '账号名称：', heads: ['子账号', '角色', '权限范围', '状态', '创建时间', '操作'], rows: [['ops@yaochuang.tech', '运维', '实例/镜像/账单只读', '启用', '2026-05-18 12:11:09', '编辑'], ['finance@yaochuang.tech', '财务', '账单/发票/合同', '启用', '2026-05-18 12:18:22', '编辑']] };
  const rows = kind === 'access'
    ? (accessRows.length > 0 ? accessRows.map((row) => [row.createdAt, row.loginIp, row.loginRegion, row.loginMethod, row.status]) : config.rows)
    : (subRows.length > 0 ? subRows.map((row) => [row.accountName, row.roleName, row.permissionScope, row.status, row.createdAt, row.action]) : config.rows);
  return (
    <div className="console-layout">
      <ConsoleSideBar current="account" />
      <main className="console-main billing-main">
        <h1>{config.title}</h1>
        <div className="billing-filter wide"><label>{config.filter}</label><div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div>{kind === 'sub' && <button className="blue small-action" onClick={() => setModal('sub')}>创建子账号</button>}</div>
        <div className="billing-table">
          <div className={`billing-head ${kind === 'access' ? 'access' : 'subaccounts'}`}>{config.heads.map((item) => <span key={item}>{item}</span>)}</div>
          {rows.map((row) => <div className={`billing-data-row ${kind === 'access' ? 'access' : 'subaccounts'}`} key={row[0]}>{row.map((cell, index) => <span className={index === row.length - 1 && kind === 'sub' ? 'action' : ''} key={`${row[0]}-${cell}-${index}`} onClick={() => kind === 'sub' && index === row.length - 1 ? setModal('sub') : kind === 'access' ? setModal('access') : undefined}>{cell}</span>)}</div>)}
        </div>
        <div className="console-pager billing-pager">共 {rows.length} 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {modal && <AccountActionModal type={modal} onClose={() => setModal('')} onDone={loadSubAccounts} />}
    </div>
  );
}

function AccountActionModal({ type, onClose, onDone, setting }: { type: 'password' | 'phone' | 'realname' | 'wechat' | 'email' | 'sub' | 'settings' | 'access'; onClose: () => void; onDone?: () => void; setting?: AccountSetting }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const titleMap = {
    password: '修改登录密码',
    phone: '修改绑定手机',
    realname: '实名认证信息',
    wechat: '微信绑定',
    email: '绑定邮箱',
    sub: '子账号权限',
    settings: '修改设置',
    access: '访问记录详情',
  };
  const submit = async () => {
    if (type !== 'sub' && type !== 'settings') {
      onClose();
      return;
    }
    setBusy(true);
    setStatus('');
    try {
      if (type === 'sub') {
        await api.account.createSubAccount({ accountName: 'ops@yaochuang.tech', roleName: '运维', permissionScope: '实例/镜像/账单只读', status: '启用' });
        setStatus('子账号已保存');
      }
      if (type === 'settings') {
        await api.account.updateSettings({
          messageNotify: !(setting?.messageNotify ?? true),
          defaultRegion: setting?.defaultRegion === '重庆A区' ? '北京B区' : '重庆A区',
          releaseReminder: setting?.releaseReminder ?? true,
        });
        setStatus('设置已保存');
      }
      await onDone?.();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存失败');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-mask">
      <section className="compute-action-modal account-action-modal">
        <header><h2>{titleMap[type]}</h2><button onClick={onClose}>×</button></header>
        <div className="compute-action-form account-action-form">
          {type === 'password' && <><label><span>当前密码</span><input value="********" readOnly /></label><label><span>新密码</span><input value="************" readOnly /></label><label><span>验证码</span><input value="329814" readOnly /></label></>}
          {type === 'phone' && <><label><span>当前手机</span><input value="177****7953" readOnly /></label><label><span>新手机号</span><input value="17717677953" readOnly /></label><label><span>短信验证码</span><input value="816204" readOnly /></label></>}
          {type === 'realname' && <><label><span>认证主体</span><input value="个人认证" readOnly /></label><label><span>认证状态</span><input value="已认证" readOnly /></label><label><span>可用权限</span><div><button className="active">自定义服务</button><button className="active">发票合同</button></div></label></>}
          {type === 'wechat' && <><label><span>微信状态</span><input value="已绑定" readOnly /></label><label><span>操作</span><div><button className="active">解绑当前微信</button><button>重新扫码</button></div></label></>}
          {type === 'email' && <><label><span>邮箱地址</span><input value="ops@yaochuang.tech" readOnly /></label><label><span>验证码</span><input value="640219" readOnly /></label></>}
          {type === 'sub' && <><label><span>子账号</span><input value="ops@yaochuang.tech" readOnly /></label><label><span>角色</span><div><button className="active">运维</button><button>财务</button><button>只读</button></div></label><label><span>权限</span><div><button className="active">实例</button><button className="active">镜像</button><button>账单</button></div></label></>}
          {type === 'settings' && <><label><span>默认地区</span><div><button className={setting?.defaultRegion === '重庆A区' ? 'active' : ''}>重庆A区</button><button className={setting?.defaultRegion === '北京B区' ? 'active' : ''}>北京B区</button><button>西北B区</button></div></label><label><span>消息通知</span><div><button className={setting?.messageNotify ? 'active' : ''}>短信</button><button className={setting?.messageNotify ? 'active' : ''}>邮箱</button><button>微信</button></div></label></>}
          {type === 'access' && <><label><span>登录IP</span><input value="47.103.49.82" readOnly /></label><label><span>登录地区</span><input value="上海" readOnly /></label><label><span>登录方式</span><input value="密码登录" readOnly /></label></>}
          <p>{type === 'sub' ? '保存后会同步子账号列表，并按角色记录权限范围。' : '当前操作会写入账号审计日志，便于安全追踪。'}</p>
          {status && <p className="pay-status">{status}</p>}
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" disabled={busy} onClick={submit}>{busy ? '保存中...' : type === 'realname' || type === 'access' ? '关闭' : '保存'}</button></footer>
      </section>
    </div>
  );
}

function AppSideBar({ current }: { current: 'deployments' | 'packs' }) {
  const rows = [{ key: 'deployments', label: '弹性部署', icon: '⌘', href: '/compute/deployments' }, { key: 'packs', label: '时长包', icon: '◴', href: '/compute/deployments/packs' }];
  return (
    <aside className="console-sidebar app-sidebar">
      {rows.map((item) => <a className={item.key === current ? 'current' : ''} href={item.href} key={item.key}><span>{item.icon}</span>{item.label}</a>)}
      <button className="collapse" type="button">☰</button>
    </aside>
  );
}

function AdminPage() {
  const emptyForm = {
    productType: 'workflow',
    productId: 'ltx-video',
    provider: 'autodl',
    deploymentUuid: '',
    imageUuid: '',
    imageName: '',
    gpuNameSet: [] as string[],
    regionSignList: [] as string[],
    cmd: 'sleep infinity',
    servicePorts: ['6006', '6008'],
    billingMode: '按次',
    priceText: '12算力币/次',
    status: 'draft',
  };
  const emptyPriceForm = {
    productType: 'workflow',
    productId: 'ltx-video',
    billingMode: '按次',
    baseCoin: 12,
    qualityExtraCoin: 4,
    durationExtraCoin: 6,
    imageExtraCoin: 2,
    priceText: '12算力币/次',
    status: 'active',
  };
  const [bindings, setBindings] = useState<ProviderBindingItem[]>([]);
  const [policies, setPolicies] = useState<PricePolicyItem[]>([]);
  const [tasks, setTasks] = useState<ProvisionTaskItem[]>([]);
  const [snapshots, setSnapshots] = useState<ProviderContainerSnapshotItem[]>([]);
  const [openTaskId, setOpenTaskId] = useState<number | null>(null);
  const [taskPreview, setTaskPreview] = useState<Record<string, unknown> | null>(null);
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');
  const [candidates, setCandidates] = useState<ProviderTemplateCandidate[]>([]);
  const [overview, setOverview] = useState<ProviderOverview | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [priceForm, setPriceForm] = useState(emptyPriceForm);
  const [status, setStatus] = useState('');
  const reload = () => {
    api.provider.overview().then((payload) => setOverview(payload.data)).catch(() => undefined);
    api.provider.bindings().then((payload) => setBindings(payload.data.items)).catch((error) => setStatus(String(error)));
    api.provider.templateCandidates().then((payload) => setCandidates(payload.data.items)).catch(() => undefined);
    api.pricing.policies().then((payload) => setPolicies(payload.data.items)).catch(() => undefined);
    api.provision.tasks().then((payload) => setTasks(payload.data.items)).catch(() => undefined);
    api.provision.containerSnapshot().then((payload) => setSnapshots(payload.data.items)).catch(() => undefined);
  };
  useEffect(() => {
    reload();
  }, []);
  const chooseCandidate = (item: ProviderTemplateCandidate) => {
    setForm((prev) => ({
      ...prev,
      deploymentUuid: item.deploymentUuid,
      imageUuid: item.imageUuid,
      imageName: item.imageName,
      gpuNameSet: item.gpuNameSet,
      regionSignList: item.regionSignList,
      cmd: item.cmd,
      servicePorts: item.servicePorts,
    }));
  };
  const editBinding = (item: ProviderBindingItem) => {
    setForm({
      productType: item.productType,
      productId: item.productId,
      provider: item.provider,
      deploymentUuid: item.deploymentUuid,
      imageUuid: item.imageUuid,
      imageName: item.imageName,
      gpuNameSet: item.gpuNameSet,
      regionSignList: item.regionSignList,
      cmd: item.cmd,
      servicePorts: item.servicePorts.length ? item.servicePorts : ['6006', '6008'],
      billingMode: item.billingMode,
      priceText: item.priceText,
      status: item.status,
    });
  };
  const loadBindingForTask = (task: ProvisionTaskItem) => {
    const directBinding = bindings.find((item) => item.productType === task.productType && item.productId === task.productId);
    if (directBinding) {
      editBinding(directBinding);
      setStatus('已载入绑定表单');
      window.location.hash = '';
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const binding = task.binding as Partial<ProviderBindingItem>;
    setForm({
      productType: task.productType,
      productId: task.productId,
      provider: String(binding.provider || 'autodl'),
      deploymentUuid: String(binding.deploymentUuid || task.deploymentUuid || ''),
      imageUuid: String(binding.imageUuid || task.imageUuid || ''),
      imageName: String(binding.imageName || task.imageName || ''),
      gpuNameSet: Array.isArray(binding.gpuNameSet) ? binding.gpuNameSet : [],
      regionSignList: Array.isArray(binding.regionSignList) ? binding.regionSignList : [],
      cmd: String(binding.cmd || 'sleep infinity'),
      servicePorts: Array.isArray(binding.servicePorts) ? binding.servicePorts : ['6006', '6008'],
      billingMode: task.billingMode || String(binding.billingMode || '按次'),
      priceText: task.priceText || String(binding.priceText || ''),
      status: String(binding.status || 'draft'),
    });
    setStatus('已按任务生成绑定表单');
    window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const save = () => {
    setStatus('保存中...');
    api.provider.saveBinding(form).then(() => {
      setStatus('已保存');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '保存失败'));
  };
  const activateAndPreflight = () => {
    setStatus('激活并预检中...');
    api.provider.saveBinding({ ...form, status: 'active' }).then(() => api.provision.refreshBindings())
      .then(() => api.provision.executeQueued())
      .then((payload) => {
        setForm({ ...form, status: 'active' });
        setStatus(`预检完成：${payload.summary.total ?? 0} 条`);
        reload();
      })
      .catch((error) => setStatus(error instanceof Error ? error.message : '预检失败'));
  };
  const remove = (id: number) => {
    setStatus('删除中...');
    api.provider.deleteBinding(id).then(() => {
      setStatus('已删除');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '删除失败'));
  };
  const setBindingStatus = (item: ProviderBindingItem, nextStatus: string) => {
    setStatus('更新状态中...');
    api.provider.saveBinding({
      productType: item.productType,
      productId: item.productId,
      provider: item.provider,
      deploymentUuid: item.deploymentUuid,
      imageUuid: item.imageUuid,
      imageName: item.imageName,
      gpuNameSet: item.gpuNameSet,
      regionSignList: item.regionSignList,
      cmd: item.cmd,
      servicePorts: item.servicePorts,
      billingMode: item.billingMode,
      priceText: item.priceText,
      status: nextStatus,
    }).then(() => {
      setStatus('状态已更新');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '更新失败'));
  };
  const createBindingTestTask = (id: number) => {
    setStatus('创建测试任务中...');
    api.provider.createTestTask(id).then((task) => {
      setOpenTaskId(task.id);
      setStatus('测试任务已创建');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '创建失败'));
  };
  const editPolicy = (item: PricePolicyItem) => {
    setPriceForm({
      productType: item.productType,
      productId: item.productId,
      billingMode: item.billingMode,
      baseCoin: item.baseCoin,
      qualityExtraCoin: item.qualityExtraCoin,
      durationExtraCoin: item.durationExtraCoin,
      imageExtraCoin: item.imageExtraCoin,
      priceText: item.priceText,
      status: item.status,
    });
  };
  const savePolicy = () => {
    setStatus('保存价格中...');
    api.pricing.savePolicy(priceForm).then(() => {
      setStatus('价格策略已保存');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '保存失败'));
  };
  const removePolicy = (id: number) => {
    setStatus('删除价格中...');
    api.pricing.deletePolicy(id).then(() => {
      setStatus('价格策略已删除');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '删除失败'));
  };
  const setPolicyStatus = (item: PricePolicyItem, nextStatus: string) => {
    setStatus('更新价格状态中...');
    api.pricing.savePolicy({
      productType: item.productType,
      productId: item.productId,
      billingMode: item.billingMode,
      baseCoin: item.baseCoin,
      qualityExtraCoin: item.qualityExtraCoin,
      durationExtraCoin: item.durationExtraCoin,
      imageExtraCoin: item.imageExtraCoin,
      priceText: item.priceText,
      status: nextStatus,
    }).then(() => {
      setStatus('价格状态已更新');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '更新失败'));
  };
  const executeTask = (id: number) => {
    setStatus('执行调度中...');
    api.provision.executeTask(id).then(() => {
      setStatus('调度已提交');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '执行失败'));
  };
  const previewTask = (id: number) => {
    setStatus('生成预览中...');
    api.provision.previewTask(id).then((payload) => {
      setOpenTaskId(id);
      setTaskPreview(payload.data);
      setStatus(payload.data.ready ? '预览已生成' : `预览不可执行：${payload.data.reason || '配置不完整'}`);
    }).catch((error) => setStatus(error instanceof Error ? error.message : '预览失败'));
  };
  const executeQueued = () => {
    setStatus('批量预检中...');
    api.provision.executeQueued().then((payload) => {
      setStatus(`批量预检完成：${payload.summary.total ?? 0} 条`);
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '批量预检失败'));
  };
  const syncSubmitted = () => {
    setStatus('同步供应商状态中...');
    api.provision.syncSubmitted().then((payload) => {
      setStatus(`同步完成：${payload.summary.total ?? 0} 条`);
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '同步失败'));
  };
  const syncTask = (id: number) => {
    setStatus('同步任务中...');
    api.provision.syncTask(id).then(() => {
      setStatus('任务已同步');
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '同步失败'));
  };
  const refreshTaskBindings = () => {
    setStatus('刷新任务绑定中...');
    api.provision.refreshBindings().then((payload) => {
      setStatus(`刷新完成：${payload.summary.total ?? 0} 条`);
      reload();
    }).catch((error) => setStatus(error instanceof Error ? error.message : '刷新失败'));
  };
  const openTask = tasks.find((item) => item.id === openTaskId) ?? null;
  const filteredTasks = taskStatusFilter === 'all' ? tasks : tasks.filter((item) => item.status === taskStatusFilter);
  const taskStatusCounts = tasks.reduce<Record<string, number>>((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});
  const latestDryRun = tasks.find((item) => item.status === 'dry_run');
  const summarizeProvision = (source: Record<string, unknown> | null) => {
    const payload = ((source?.payload as Record<string, unknown>) || ((source?.result as Record<string, unknown>)?.payload as Record<string, unknown>) || {}) as Record<string, unknown>;
    const template = (payload.container_template as Record<string, unknown>) || {};
    const action = String(source?.action || (source?.result as Record<string, unknown>)?.action || (payload.deployment_uuid ? 'scale_replicaset' : payload.container_template ? 'create_deployment' : '-'));
    return [
      ['动作', action],
      ['部署', String(payload.deployment_uuid || payload.name || '-')],
      ['镜像', String(template.image_uuid || '-')],
      ['GPU', Array.isArray(template.gpu_name_set) ? template.gpu_name_set.join(', ') : '-'],
      ['地区', String(template.region_sign || (Array.isArray(template.dc_list) ? template.dc_list.join(', ') : '-'))],
      ['副本', String(payload.replica_num || '-')],
      ['命令', String(template.cmd || '-')],
    ];
  };
  const taskJson = (value: Record<string, unknown>) => JSON.stringify(value || {}, null, 2);
  return (
    <div className="console-layout admin-layout">
      <aside className="console-sidebar">
        <h2>管理后台</h2>
        <a className="current" href="/compute/admin"><span>▦</span>供应商绑定</a>
        <a href="#admin-price-policies"><span>◈</span>价格策略</a>
        <a><span>◌</span>用户与账务</a>
      </aside>
      <main className="console-main admin-main">
        <div className="console-title">
          <h1>供应商绑定</h1>
          <span>把灵渠应用或工作流绑定到 AutoDL 私有镜像/弹性部署模板。这里只保存配置，不会启动或修改 AutoDL 部署。</span>
        </div>
        <section className="console-summary-grid compact admin-overview">
          {[
            ['AutoDL', overview?.configured ? '已接入' : '未配置', overview?.tokenSource || '-'],
            ['私有镜像', String(overview?.imageTotal ?? 0), 'AutoDL 镜像候选'],
            ['弹性部署', String(overview?.deploymentTotal ?? 0), `运行部署 ${overview?.runningDeployments ?? 0}`],
            ['产品绑定', String(overview?.bindingTotal ?? bindings.length), `active ${overview?.activeBindings ?? 0} / draft ${overview?.draftBindings ?? 0}`],
            ['价格策略', String(overview?.pricePolicyTotal ?? policies.length), `active ${overview?.activePricePolicies ?? 0}`],
            ['调度任务', String(overview?.provisionTaskTotal ?? tasks.length), `queued ${overview?.queuedProvisionTasks ?? 0} / dry ${overview?.dryRunProvisionTasks ?? 0}`],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <section className="admin-grid">
          <div className="admin-card">
            <div className="admin-card-head"><h2>绑定表单</h2><button onClick={() => setForm(emptyForm)}>新建</button></div>
            <label><span>产品类型</span><select value={form.productType} onChange={(event) => setForm({ ...form, productType: event.target.value })}><option value="workflow">workflow</option><option value="market_app">market_app</option></select></label>
            <label><span>产品ID</span><input value={form.productId} onChange={(event) => setForm({ ...form, productId: event.target.value })} /></label>
            <label><span>部署UUID</span><input value={form.deploymentUuid} onChange={(event) => setForm({ ...form, deploymentUuid: event.target.value })} /></label>
            <label><span>镜像UUID</span><input value={form.imageUuid} onChange={(event) => setForm({ ...form, imageUuid: event.target.value })} /></label>
            <label><span>镜像名称</span><input value={form.imageName} onChange={(event) => setForm({ ...form, imageName: event.target.value })} /></label>
            <label><span>GPU型号</span><input value={form.gpuNameSet.join(',')} onChange={(event) => setForm({ ...form, gpuNameSet: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
            <label><span>调度地区</span><input value={form.regionSignList.join(',')} onChange={(event) => setForm({ ...form, regionSignList: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
            <label><span>启动命令</span><textarea value={form.cmd} onChange={(event) => setForm({ ...form, cmd: event.target.value })} /></label>
            <label><span>服务端口</span><input value={form.servicePorts.join(',')} onChange={(event) => setForm({ ...form, servicePorts: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} /></label>
            <label><span>计费方式</span><input value={form.billingMode} onChange={(event) => setForm({ ...form, billingMode: event.target.value })} /></label>
            <label><span>价格展示</span><input value={form.priceText} onChange={(event) => setForm({ ...form, priceText: event.target.value })} /></label>
            <label><span>状态</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="draft">draft</option><option value="active">active</option><option value="disabled">disabled</option></select></label>
            {status && <p className="admin-status">{status}</p>}
            <div className="admin-actions"><button onClick={activateAndPreflight}>激活并预检</button><button onClick={save}>保存绑定</button></div>
          </div>
          <div className="admin-card">
            <div className="admin-card-head"><h2>AutoDL模板候选</h2><button onClick={reload}>刷新</button></div>
            <div className="admin-candidate-list">
              {candidates.map((item) => (
                <article key={item.deploymentUuid}>
                  <strong>{item.deploymentName}</strong>
                  <span>{item.imageName || item.imageUuid}</span>
                  <p>{item.gpuNameSet.join(' / ') || 'GPU'} · {item.regionSignList.slice(0, 3).join(' / ')}</p>
                  <button onClick={() => chooseCandidate(item)}>填入表单</button>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="admin-card admin-table-card">
          <div className="admin-card-head"><h2>已保存绑定</h2><button onClick={reload}>刷新</button></div>
          <div className="admin-binding-table">
            <div className="head"><span>产品</span><span>镜像/部署</span><span>GPU/地区</span><span>计费</span><span>状态</span><span>操作</span></div>
            {bindings.map((item) => (
              <div className="row" key={item.id}>
                <span><b>{item.productType}</b><em>{item.productId}</em></span>
                <span><b>{item.imageName || item.imageUuid}</b><em>{item.deploymentUuid || '-'}</em></span>
                <span><b>{item.gpuNameSet.join(',') || '-'}</b><em>{item.regionSignList.slice(0, 3).join(',') || '-'}</em></span>
                <span><b>{item.billingMode}</b><em>{item.priceText}</em></span>
                <span><b>{item.status}</b><em className={item.validation?.ready ? 'admin-ok' : 'admin-warn'}>{item.validation?.ready ? '可调度' : (item.validation?.errors?.[0] || '待检查')}</em></span>
                <span className="tool-links"><a onClick={() => editBinding(item)}>编辑</a><a onClick={() => createBindingTestTask(item.id)}>测试任务</a><a onClick={() => setBindingStatus(item, item.status === 'active' ? 'draft' : 'active')}>{item.status === 'active' ? '转草稿' : '启用'}</a><a onClick={() => remove(item.id)}>删除</a></span>
              </div>
            ))}
          </div>
        </section>
        <section className="admin-grid" id="admin-price-policies">
          <div className="admin-card">
            <div className="admin-card-head"><h2>价格策略</h2><button onClick={() => setPriceForm(emptyPriceForm)}>新建</button></div>
            <label><span>产品类型</span><select value={priceForm.productType} onChange={(event) => setPriceForm({ ...priceForm, productType: event.target.value })}><option value="workflow">workflow</option><option value="market_app">market_app</option></select></label>
            <label><span>产品ID</span><input value={priceForm.productId} onChange={(event) => setPriceForm({ ...priceForm, productId: event.target.value })} /></label>
            <label><span>计费方式</span><select value={priceForm.billingMode} onChange={(event) => setPriceForm({ ...priceForm, billingMode: event.target.value })}><option value="按次">按次</option><option value="按量计费">按量计费</option><option value="包日">包日</option><option value="包周">包周</option><option value="包月">包月</option></select></label>
            <label><span>基础费用</span><input type="number" value={priceForm.baseCoin} onChange={(event) => setPriceForm({ ...priceForm, baseCoin: Number(event.target.value) })} /></label>
            <label><span>高清加价</span><input type="number" value={priceForm.qualityExtraCoin} onChange={(event) => setPriceForm({ ...priceForm, qualityExtraCoin: Number(event.target.value) })} /></label>
            <label><span>时长加价</span><input type="number" value={priceForm.durationExtraCoin} onChange={(event) => setPriceForm({ ...priceForm, durationExtraCoin: Number(event.target.value) })} /></label>
            <label><span>多图加价</span><input type="number" value={priceForm.imageExtraCoin} onChange={(event) => setPriceForm({ ...priceForm, imageExtraCoin: Number(event.target.value) })} /></label>
            <label><span>价格展示</span><input value={priceForm.priceText} onChange={(event) => setPriceForm({ ...priceForm, priceText: event.target.value })} /></label>
            <label><span>状态</span><select value={priceForm.status} onChange={(event) => setPriceForm({ ...priceForm, status: event.target.value })}><option value="active">active</option><option value="draft">draft</option><option value="disabled">disabled</option></select></label>
            <div className="admin-actions"><button onClick={savePolicy}>保存价格</button></div>
          </div>
          <div className="admin-card admin-table-card">
            <div className="admin-card-head"><h2>已保存价格</h2><button onClick={reload}>刷新</button></div>
            <div className="admin-binding-table admin-price-table">
              <div className="head"><span>产品</span><span>计费</span><span>基础/加价</span><span>展示</span><span>状态</span><span>操作</span></div>
              {policies.map((item) => (
                <div className="row" key={item.id}>
                  <span><b>{item.productType}</b><em>{item.productId}</em></span>
                  <span><b>{item.billingMode}</b><em>{item.updatedAt || '-'}</em></span>
                  <span><b>{item.baseCoin} + {item.qualityExtraCoin}</b><em>时长 {item.durationExtraCoin} / 多图 {item.imageExtraCoin}</em></span>
                  <span><b>{item.priceText}</b><em>算力币策略</em></span>
                  <span>{item.status}</span>
                  <span className="tool-links"><a onClick={() => editPolicy(item)}>编辑</a><a onClick={() => setPolicyStatus(item, item.status === 'active' ? 'draft' : 'active')}>{item.status === 'active' ? '转草稿' : '启用'}</a><a onClick={() => removePolicy(item.id)}>删除</a></span>
                </div>
              ))}
              {policies.length === 0 && <div className="row"><span>暂无价格策略</span><span>保存后前台工作流立即按 active 策略估算</span><span /><span /><span /><span /></div>}
            </div>
          </div>
        </section>
        <section className="admin-card admin-table-card">
          <div className="admin-card-head"><h2>调度任务</h2><div><button onClick={refreshTaskBindings}>刷新绑定</button><button onClick={executeQueued}>批量 dry-run</button><button onClick={syncSubmitted}>同步状态</button><button onClick={reload}>刷新</button></div></div>
          <div className="admin-task-filter">
            {[
              ['all', `全部 ${tasks.length}`],
              ['queued', `queued ${taskStatusCounts.queued || 0}`],
              ['local', `local ${taskStatusCounts.local || 0}`],
              ['dry_run', `dry_run ${taskStatusCounts.dry_run || 0}`],
              ['failed', `failed ${taskStatusCounts.failed || 0}`],
              ['submitted', `submitted ${taskStatusCounts.submitted || 0}`],
            ].map((item) => <button className={taskStatusFilter === item[0] ? 'active' : ''} key={item[0]} onClick={() => setTaskStatusFilter(item[0])}>{item[1]}</button>)}
          </div>
          {latestDryRun && (
            <div className="admin-task-latest">
              <span>最近 dry-run</span>
              <strong>{latestDryRun.taskNo}</strong>
              <p>{String((latestDryRun.result as Record<string, unknown>)?.action || 'dry-run')} · {latestDryRun.productType}/{latestDryRun.productId}</p>
              <button onClick={() => { setOpenTaskId(latestDryRun.id); setTaskPreview({ task: latestDryRun, payload: (latestDryRun.result as Record<string, unknown>)?.payload || {}, action: (latestDryRun.result as Record<string, unknown>)?.action || 'dry-run', dryRun: true }); }}>查看 payload</button>
            </div>
          )}
          <div className="admin-binding-table admin-task-table">
            <div className="head"><span>任务</span><span>产品</span><span>目标</span><span>供应商</span><span>计费</span><span>状态/操作</span></div>
            {filteredTasks.map((item) => (
              <div className="row" key={item.id}>
                <span><b>{item.taskNo}</b><em>{item.createdAt}</em></span>
                <span><b>{item.productType}</b><em>{item.productId}</em></span>
                <span><b>{item.targetId}</b><em>{item.imageName || item.imageUuid || '-'}</em></span>
                <span><b>{item.provider}</b><em>{item.deploymentUuid || '-'}</em></span>
                <span><b>{item.billingMode || '-'}</b><em>{item.priceText || '-'}</em></span>
                <span><b>{item.status}</b><em>{item.errMsg || ' '}</em><span className="tool-links inline"><a onClick={() => loadBindingForTask(item)}>载入绑定</a><a onClick={() => { setOpenTaskId(openTaskId === item.id ? null : item.id); setTaskPreview(null); }}>详情</a><a onClick={() => previewTask(item.id)}>预览</a>{['queued', 'local', 'failed'].includes(item.status) && <a onClick={() => executeTask(item.id)}>dry-run</a>}{['submitted', 'starting', 'running'].includes(item.status) && <a onClick={() => syncTask(item.id)}>同步</a>}</span></span>
              </div>
            ))}
            {filteredTasks.length === 0 && <div className="row"><span>暂无调度任务</span><span>前台创建实例或运行工作流后会出现记录</span><span /><span /><span /><span /></div>}
          </div>
          {openTask && (
            <div className="admin-task-detail">
              <div><strong>{openTask.taskNo}</strong><span>{openTask.productType} / {openTask.productId} / {openTask.status}</span></div>
              <section>
                {taskPreview && <article className="wide admin-payload-summary"><h3>payload summary</h3><div>{summarizeProvision(taskPreview).map((item) => <p key={item[0]}><span>{item[0]}</span><b>{item[1]}</b></p>)}</div></article>}
                <article><h3>request</h3><pre>{taskJson(openTask.request)}</pre></article>
                <article><h3>binding</h3><pre>{taskJson(openTask.binding)}</pre></article>
                <article><h3>policy</h3><pre>{taskJson(openTask.policy)}</pre></article>
                <article><h3>result</h3><pre>{taskJson(openTask.result)}</pre></article>
                {taskPreview && <article className="wide"><h3>payload preview</h3><pre>{JSON.stringify(taskPreview, null, 2)}</pre></article>}
              </section>
            </div>
          )}
        </section>
        <section className="admin-card admin-table-card">
          <div className="admin-card-head"><h2>AutoDL容器快照</h2><button onClick={reload}>同步</button></div>
          <div className="admin-binding-table admin-snapshot-table">
            <div className="head"><span>产品</span><span>部署</span><span>镜像</span><span>总数</span><span>运行</span><span>启动/停止</span></div>
            {snapshots.map((item) => (
              <div className="row" key={`${item.productType}-${item.productId}-${item.deploymentUuid}`}>
                <span><b>{item.productType}</b><em>{item.productId}</em></span>
                <span><b>{item.deploymentUuid}</b><em>active binding</em></span>
                <span><b>{item.imageName || '-'}</b><em>AutoDL</em></span>
                <span>{item.total}</span>
                <span>{item.running}</span>
                <span>{item.starting} / {item.stopped}</span>
              </div>
            ))}
            {snapshots.length === 0 && <div className="row"><span>暂无快照</span><span>需要 active 绑定且包含 deploymentUuid</span><span /><span /><span /><span /></div>}
          </div>
        </section>
      </main>
    </div>
  );
}

function DurationPacksPage() {
  const [buyOpen, setBuyOpen] = useState(false);
  const [refundOpen, setRefundOpen] = useState('');
  const packRows = [
    ['177563732332470024', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1日', '0分', '已使用', '2026-04-08 16:35:23'],
    ['177563732343335315', '941327a885', '重庆A区', '永久有效', 'vGPU-32GB', '1日', '1日', '使用中', '2026-04-08 16:35:23'],
    ['176508214517388348', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-12-07 12:35:46'],
    ['176429363053685379', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-11-28 09:33:50'],
    ['176335576174993556', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-11-17 13:02:42'],
    ['176221935438129359', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-11-04 09:22:35'],
    ['176161368749468052', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-10-28 09:08:08'],
    ['176095127522549692', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-10-20 17:07:56'],
    ['175922293989050469', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '2周', '0分', '已使用', '2025-09-30 17:02:20'],
    ['175887355762842658', '941327a885', '重庆A区', '永久有效', 'RTX 4090', '1周', '0分', '已使用', '2025-09-26 15:59:18'],
  ];
  return (
    <div className="console-layout">
      <AppSideBar current="packs" />
      <main className="console-main deployments-main">
        <div className="deploy-title"><h1>时长包</h1></div>
        <section className="console-summary-grid compact">
          {[
            ['全部订单', String(packRows.length), '历史购买记录'],
            ['使用中', '1', '抵扣按量计费'],
            ['剩余时长', '1日', '到期自动恢复按量'],
            ['可退订', '0', '未使用包支持退订'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="console-toolbar deploy-toolbar">
          <button className="blue" onClick={() => setBuyOpen(true)}>购买</button>
          <button className="refresh">C</button>
          <a>查看时长包计费规则</a>
        </div>
        <div className="duration-table">
          <div className="duration-head"><span>订单号</span><span>部署ID</span><span>地区</span><span>有效期</span><span>GPU型号</span><span>购买时长</span><span>剩余时长</span><span>状态</span><span>下单时间</span><span>操作</span></div>
          {packRows.map((row) => (
            <div className="duration-row" key={row[0]}>
              {row.map((cell, index) => <span key={`${row[0]}-${cell}`}>{index === 7 && <i className={`dot ${cell === '使用中' ? 'green' : 'orange-dot'}`} />}{cell}</span>)}
              <span><a onClick={() => setRefundOpen(row[0])}>退订</a></span>
            </div>
          ))}
        </div>
        <div className="console-pager">共 64 条 <span>‹</span><b>1</b><b className="dark">2</b><b className="dark">3</b><b className="dark">4</b><b className="dark">5</b><b className="dark">6</b><b className="dark">7</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {buyOpen && <DurationBuyModal onClose={() => setBuyOpen(false)} />}
      {refundOpen && <ConfirmModal title="退订时长包" message={`确认退订时长包订单 ${refundOpen}？`} onClose={() => setRefundOpen('')} />}
    </div>
  );
}

function ConfirmModal({ title, message, onClose }: { title: string; message: string; onClose: () => void }) {
  return (
    <div className="modal-mask">
      <section className="confirm-modal">
        <header><h2>{title}</h2><button onClick={onClose}>×</button></header>
        <div className="confirm-body"><span>!</span><p>{message}</p></div>
        <footer><button onClick={onClose}>取消</button><button className="primary">确定</button></footer>
      </section>
    </div>
  );
}

function DurationBuyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-mask">
      <section className="duration-buy-modal">
        <header><h2>购买时长包</h2><button onClick={onClose}>×</button></header>
        <div className="duration-buy-body">
          <div className="warn-line"><span>!</span> 了解弹性部署时长包计费规则，请参考<a>帮助文档</a></div>
          <FormLine label="弹性部署：" required><div className="select-input buy-select">请选择弹性部署 <span>⌄</span></div></FormLine>
        </div>
        <footer>
          <div className="buy-total"><span>总支付金额：</span><strong>￥0.00</strong><small>账户余额：1282.08</small></div>
          <button onClick={onClose}>取消</button>
          <button className="primary">购买</button>
        </footer>
      </section>
    </div>
  );
}

function DeploymentCreatePage() {
  const regions = ['西北B区', '北京B区', '重庆A区', '内蒙B区', '北京A区', '佛山区', 'V100专区', 'A800专区', '西北企业区', '摩尔线程专区', '华为昇腾专区', 'L20专区'];
  const gpus = ['全部', 'RTX 5090 (450/1768)', 'RTX PRO 6000 (589/1580)', 'vGPU-32GB (410/1898)', 'vGPU-48GB (191/842)', 'H800 (13/96)', 'RTX 4090D (325/1168)', 'RTX 4090 (143/1873)', 'RTX 3090 (0/210)'];
  return (
    <div className="console-layout">
      <AppSideBar current="deployments" />
      <main className="deploy-create-main">
        <div className="rent-crumb">弹性部署 / 创建部署</div>
        <div className="deploy-create-grid">
          <section className="deploy-form">
            <FormLine label="部署名称：" required><input className="plain-input" /></FormLine>
            <FormLine label="部署类型："><div className="select-input form-select">ReplicaSet <span>⌄</span></div></FormLine>
            <FormLine label="容器副本数量：" required><input className="plain-input" value="1" readOnly /></FormLine>
            <FormLine label="复用已停止容器："><RadioGroup items={['是', '否']} selected="否" /><p>可显著缩短创建容器时间，实现细节请参考<a>文档</a></p></FormLine>
            <FormLine label="端口协议(6006)："><RadioGroup items={['http', 'tcp']} selected="http" /><p>系统会自动将容器内6006端口进行映射暴露于公网，您可以选择端口访问协议类型</p></FormLine>
            <FormLine label="端口协议(6008)："><RadioGroup items={['http', 'tcp']} selected="http" /><p>系统会自动将容器内6008端口进行映射暴露于公网，您可以选择端口访问协议类型</p></FormLine>
            <div className="deploy-section-title">容器调度条件 <span>系统将按以下您设置的条件调度和启动容器</span></div>
            <FormLine label="地区：" required><CheckboxGrid items={regions} checked="西北B区" /></FormLine>
            <FormLine label="GPU型号：" required><CheckboxGrid items={gpus} checked="全部" /></FormLine>
            <FormLine label="GPU数量："><SegmentButtons items={['1', '2', '3', '4', '5', '6', '7', '8', '10', '12']} selected="1" /><p>创建单个容器时所需的GPU数量</p></FormLine>
            <FormLine label="CUDA版本支持："><RangeInputs /><p>将选择GPU驱动支持您设置的CUDA版本范围内的主机进行调度</p></FormLine>
            <FormLine label="内存大小范围(GB)："><RangeInputs /><p>创建单个容器时允许的内存大小范围，满足此大小条件则调度创建容器</p></FormLine>
            <FormLine label="CPU数量范围(核心)："><RangeInputs /><p>创建单个容器时允许的CPU核心范围，满足此大小条件则调度创建容器</p></FormLine>
            <FormLine label="价格范围(元/时/GPU)："><RangeInputs /><p>创建单个容器时单张GPU允许的价格范围</p></FormLine>
            <FormLine label="镜像："><SegmentButtons items={['基础镜像', '自定义镜像']} selected="基础镜像" /></FormLine>
            <FormLine label="停止前执行命令："><textarea className="command-input" /><p>您可以设置在容器停止前执行bash shell命令以便更优雅的结束容器中的程序</p></FormLine>
            <FormLine label="启动命令："><textarea className="command-input" /></FormLine>
            <div className="deploy-actions-bar"><button>取消</button><button className="primary">确定</button></div>
          </section>
          <aside className="stock-summary">
            <h2>容器库存概要</h2>
            <p>在您选中的条件下(包含：地区、GPU数量、内存大小、CPU数量、价格)，所能创建容器的库存数量以及容器的价格</p>
            <div className="stock-table"><div><span>GPU型号</span><span>可创建容器数量*</span><span>容器最低价-最高价*(元/时)</span></div><strong>暂无数据</strong></div>
            <small>标*的字段表示为参考值，仅代表当前实例预算值。</small>
          </aside>
        </div>
      </main>
    </div>
  );
}

function FormLine({ label, children, required }: { label: string; children: ReactNode; required?: boolean }) {
  return <div className="form-line"><label>{required && <em>*</em>}{label}</label><div>{children}</div></div>;
}

function RadioGroup({ items, selected }: { items: string[]; selected: string }) {
  return <div className="radio-group">{items.map((item) => <span className={item === selected ? 'on' : ''} key={item}><i />{item}</span>)}</div>;
}

function CheckboxGrid({ items, checked }: { items: string[]; checked: string }) {
  return <div className="checkbox-grid">{items.map((item) => <span className={item === checked ? 'checked' : ''} key={item}><i />{item}</span>)}</div>;
}

function RangeInputs() {
  return <div className="range-inputs"><input /><b>-</b><input /></div>;
}

function DeploymentContainersPage() {
  return (
    <div className="console-layout">
      <AppSideBar current="deployments" />
      <main className="console-main deploy-containers-main">
        <div className="rent-crumb">弹性部署 / 日本人机交互</div>
        <a className="usage-link">查看已释放的实例</a>
        <section className="deploy-container-filters">
          <div><label>容器ID：</label><input /></div>
          <div><label>主机ID：</label><input /></div>
          <div><label>GPU型号：</label><div className="select-like">全部 <span>⌄</span></div></div>
          <div><label>创建时间：</label><div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div></div>
          <div><label>内存大小(GB)：</label><input /><b>~</b><input /></div>
          <div><label>CPU(核心)：</label><input /><b>~</b><input /></div>
          <div><label>价格范围(元/时)：</label><input /><b>~</b><input /></div>
        </section>
        <div className="deploy-container-table">
          <div className="deploy-container-head"><span>容器ID</span><span>配置</span><span>版本号</span><span>状态 ⌯</span><span>价格(元/时)</span><span>SSH</span><span>服务地址</span><span>创建时间</span><span>运行时间</span><span>停止时间</span><span>操作</span></div>
          <div className="empty-row compact">暂无数据</div>
        </div>
        <div className="console-pager">共 0 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function DeploymentBlacklistPage() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="console-layout">
      <AppSideBar current="deployments" />
      <main className="console-main deployments-main">
        <div className="rent-crumb">弹性部署 / 调度黑名单</div>
        <p className="blacklist-help">您还可以通过API管理设置调度黑名单，详情请查看<a>帮助文档</a></p>
        <div className="console-toolbar deploy-toolbar">
          <button className="blue" onClick={() => setAddOpen(true)}>添加黑名单</button>
        </div>
        <div className="blacklist-table">
          <div className="blacklist-head"><span>主机ID</span><span>配置</span><span>GPU库存(空闲/总量)</span><span>过期时间</span><span>更新时间</span><span>备注</span><span>操作</span></div>
          <div className="empty-row compact">暂无数据</div>
        </div>
        <div className="console-pager">共 0 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {addOpen && <BlacklistAddModal onClose={() => setAddOpen(false)} />}
    </div>
  );
}

function BlacklistAddModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-mask">
      <section className="blacklist-add-modal">
        <header><h2>添加黑名单</h2><button onClick={onClose}>×</button></header>
        <div className="blacklist-add-body">
          <FormLine label="容器ID：" required><input className="plain-input" /><p>系统会根据容器ID自动解析对应主机</p></FormLine>
          <FormLine label="过期时间(小时)：" required><input className="plain-input" value="24" readOnly /><p>系统将在此时间后自动解除黑名单</p></FormLine>
          <FormLine label="备注："><input className="plain-input" /></FormLine>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary">确定</button></footer>
      </section>
    </div>
  );
}

function DeploymentsPage() {
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [activeMore, setActiveMore] = useState('');
  const [rows, setRows] = useState<ProviderDeploymentItem[]>(
    deploymentRows.map((row) => ({
      ...row,
      providerId: 0,
      gpuCount: 1,
      imageUuid: '',
      imageName: '',
      copies: row.copies.map((value) => Number(value) || 0),
      startingNum: Number(row.copies[0]) || 0,
      runningNum: Number(row.copies[1]) || 0,
      replicaNum: Number(row.copies[2]) || 0,
      finishedNum: Number(row.copies[3]) || 0,
      rawStatus: row.status,
      currentCostText: '￥0.00/时',
      updated: '',
      reuseContainer: false,
      serviceProtocol: 'http',
    }))
  );
  const [summary, setSummary] = useState<Record<string, number>>({ total: deploymentRows.length, runningContainers: 0, replicaNum: 0 });
  useEffect(() => {
    let alive = true;
    api.provider.deployments(20).then((payload) => {
      if (!alive) return;
      setRows(payload.data.items);
      setSummary(payload.data.summary);
    }).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  const runningDeployments = rows.filter((row) => row.rawStatus === 'running').length;
  return (
    <div className="console-layout">
      <AppSideBar current="deployments" />
      <main className="console-main deployments-main">
        <div className="deploy-title"><h1>弹性部署</h1></div>
        <section className="console-summary-grid compact">
          {[
            ['部署数量', String(summary.total ?? rows.length), 'ReplicaSet 服务化任务'],
            ['运行容器', String(summary.runningContainers ?? 0), '跨地区弹性调度'],
            ['实时费用', '￥0.00/时', '当前无运行扣费'],
            ['运行部署', String(runningDeployments), 'AutoDL 弹性部署'],
          ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="console-toolbar deploy-toolbar">
          <button className="blue" onClick={() => { window.location.href = '/compute/deployments/create'; }}>创建部署</button>
          <button className="refresh">C</button>
          <a href="/compute/deployments/blacklist">管理调度黑名单</a><a>使用API创建部署</a><a>查看更新日志</a>
          <div className="toolbar-spacer" />
          <div className="search-like deploy-search">搜索部署ID <span>⌕</span></div>
        </div>
        <div className="deploy-table">
          <div className="deploy-head"><span>部署ID/名称</span><span>部署类型</span><span>调度地区</span><span>调度GPU型号</span><span>容器数量 ⓘ</span><span>实时费用</span><span>时长包</span><span>状态 ⌯</span><span>创建时间</span><span>操作</span></div>
          {rows.map((row) => (
            <div className="deploy-row" key={row.id}>
              <span><b>{row.id}</b><small>{row.name}</small></span>
              <span>{row.type}</span>
              <span>{row.region}</span>
              <span>{row.gpu}</span>
              <span><em className="orange">{row.copies[0]}</em> / <em className="green-text">{row.copies[1]}</em> / {row.copies[2]} / {row.copies[3]} <a>C</a><a onClick={() => setOverviewOpen(row.id === '0f11ed8da8' ? !overviewOpen : false)}>详情</a></span>
              <span><em className="red-text">{row.currentCostText}</em> <a>C</a></span>
              <span>{row.pack}</span>
              <span><i className={`dot ${row.status === '部署中' ? 'green' : 'gray'}`} />{row.status}</span>
              <span>{row.created}</span>
              <span className="tool-links deploy-actions">
                <a href="/compute/deployments/containers">查看容器</a>
                <a onClick={() => setActiveMore(activeMore === row.id ? '' : row.id)}>更多</a>
                {activeMore === row.id && <DeployMoreMenu />}
              </span>
            </div>
          ))}
          {overviewOpen && <div className="deploy-overview-pop"><div className="deploy-overview-arrow" /><div className="overview-head"><span>地区</span><span>GPU型号</span><span>启动中/运行中</span><span>预估库存 ⓘ</span></div><div className="overview-empty">暂无数据</div></div>}
        </div>
        <div className="console-pager">共 {summary.total ?? rows.length} 条 <span>‹</span><b>1</b><span>›</span><button>20条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function DeployMoreMenu() {
  return (
    <div className="deploy-more-menu">
      <a href="/compute/deployments/packs">购买时长包</a>
      <a>退订时长包</a>
      <a>查看详情</a>
      <a>锁定调度</a>
      <a>编辑</a>
      <a>停止</a>
      <a>删除</a>
    </div>
  );
}

function ComputeInstanceWorkspacePage({ data }: { data?: ComputePayload }) {
  const instance = data?.instances?.[0];
  const files = [
    ['folder', 'lingqu-tmp', '目录', '2026-05-20 15:41'],
    ['folder', 'ComfyUI', '目录', '2026-05-20 15:42'],
    ['folder', 'datasets', '目录', '2026-05-20 15:48'],
    ['file', 'start.sh', '1.8 KB', '2026-05-20 15:40'],
    ['file', 'requirements.txt', '3.4 KB', '2026-05-20 15:40'],
    ['file', 'run.log', '28.6 KB', '2026-05-20 16:04'],
  ];
  const ports = [
    ['JupyterLab', '8888', 'https://yaochuang.tech/compute/proxy/941327/8888', '运行中'],
    ['SSH', '22', 'ssh root@connect.lingqu.local -p 29413', '运行中'],
    ['WebUI', '6006', 'https://yaochuang.tech/compute/proxy/941327/6006', '运行中'],
    ['AutoPanel', '6008', 'https://yaochuang.tech/compute/proxy/941327/6008', '运行中'],
  ];
  const tasks = [
    ['PID 1217', 'python app.py --listen 0.0.0.0 --port 6006', '00:38:12', '2.1GB'],
    ['PID 1241', 'jupyter-lab --allow-root --port 8888', '00:38:02', '742MB'],
    ['PID 1356', 'tensorboard --logdir /root/lingqu-tmp/logs', '00:12:44', '318MB'],
  ];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="instances" />
      <main className="compute-workspace-main">
        <div className="compute-detail-head">
          <div>
            <div className="rent-crumb">容器实例 / 实例工作台</div>
            <h1>{instance?.name ?? 'RTX5090-训练实例'} 工作台</h1>
            <p>{instance?.region ?? '西北B区'} / {instance?.machine ?? 'C90机'} · {instance?.id ?? 'instance-941327a885'} · 运行中</p>
          </div>
          <div><button>重连</button><button>同步文件</button><button onClick={() => { window.location.href = '/compute/instances/detail'; }}>返回详情</button></div>
        </div>
        <section className="workspace-status compute-workspace-status">
          <article><span>实例状态</span><strong>运行中</strong><p>GPU计费中 · 健康状态正常</p></article>
          <article><span>当前镜像</span><strong>PyTorch 2.8.0</strong><p>Python 3.11 · CUDA 13.0</p></article>
          <article><span>数据目录</span><strong>/root/lingqu-tmp</strong><p>已用 38.4GB / 50GB</p></article>
          <article><span>公网服务</span><strong>4 个端口</strong><p>8888 / 22 / 6006 / 6008</p></article>
        </section>
        <div className="compute-workspace-grid">
          <section className="workspace-terminal compute-workspace-terminal">
            <div className="workspace-title"><h2>SSH 终端</h2><span>root@instance-941327a885</span></div>
            <pre>{['root@lingqu-container:~# nvidia-smi','RTX 5090  23%   18234MiB / 32768MiB','root@lingqu-container:~# pwd','/root','root@lingqu-container:~# cd /root/lingqu-tmp','root@lingqu-container:~/lingqu-tmp# bash start.sh --port 6006','service already running on 0.0.0.0:6006'].join('\n')}</pre>
            <div><input value="tail -f /root/lingqu-tmp/run.log" readOnly /><button>发送</button></div>
          </section>
          <section className="workspace-files compute-workspace-files">
            <div className="workspace-title"><h2>文件浏览器</h2><span>/root</span></div>
            <div className="file-toolbar"><button>上传</button><button>新建目录</button><button>下载</button><button>刷新</button></div>
            <div className="file-table">
              <div className="head"><span>名称</span><span>大小/类型</span><span>修改时间</span></div>
              {files.map((row) => <div className="row" key={row[1]}><span><i className={row[0]} />{row[1]}</span><span>{row[2]}</span><span>{row[3]}</span></div>)}
            </div>
          </section>
          <section className="compute-port-card">
            <div className="workspace-title"><h2>端口服务</h2><span>平台代理地址</span></div>
            <div className="compute-port-table">
              <div className="head"><span>服务</span><span>端口</span><span>地址</span><span>状态</span></div>
              {ports.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 2 ? 'url' : index === 3 ? 'ok' : ''} key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="compute-task-card">
            <div className="workspace-title"><h2>运行进程</h2><span>top 采样</span></div>
            <div className="compute-task-list">
              {tasks.map((row) => <article key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><em>{row[2]}</em><b>{row[3]}</b></article>)}
            </div>
          </section>
          <section className="workspace-logs compute-workspace-logs">
            <div className="workspace-title"><h2>实时日志</h2><span>run.log</span></div>
            <pre>{['[16:03:22] proxy /compute/proxy/941327/6006 ready','[16:03:25] model cache loaded from /root/lingqu-tmp/models','[16:03:31] web server listening on 0.0.0.0:6006','[16:04:02] request GET /health 200','[16:04:18] gpu memory allocated 18.2GB'].join('\n')}</pre>
            <div className="log-actions"><button>清空</button><button>下载日志</button><button>自动滚动</button></div>
          </section>
        </div>
      </main>
    </div>
  );
}

function ComputeInstanceDetailPage({ data }: { data?: ComputePayload }) {
  const [modal, setModal] = useState<'boot' | 'stop' | 'restart' | 'release' | 'rename' | ''>('');
  const instance = data?.instances?.[0];
  const services = [
    ['JupyterLab', '8888', 'HTTP', '运行中', '打开'],
    ['SSH', '22', 'TCP', '运行中', '复制'],
    ['TensorBoard', '6007', 'HTTP', '未启动', '打开'],
    ['自定义服务', '6006', 'HTTP', '运行中', '打开'],
    ['AutoPanel', '6008', 'HTTP', '运行中', '打开'],
  ];
  const metrics = [
    ['GPU利用率', '23%', '最近5分钟平均', '12,18,20,24,22,26,23,21'],
    ['显存占用', '18.2GB', 'RTX 5090 / 32GB', '30,42,48,55,53,57,56,54'],
    ['CPU使用率', '16%', '22核', '10,12,18,16,20,17,16,14'],
    ['磁盘IO', '42MB/s', '/root/lingqu-tmp', '8,14,20,24,18,22,16,12'],
  ];
  const disks = [
    ['系统盘', '/root', instance?.system_disk_usage ?? '22.1GB / 30GB', '随实例释放'],
    ['数据盘', '/root/lingqu-tmp', instance?.data_disk_usage ?? '38.4GB / 50GB', '关机保留，释放删除'],
    ['文件存储', '/root/lingqu-fs', '231MB / 200GB', '跨实例挂载'],
    ['公开数据', '/root/lingqu-pub', '只读挂载', '平台维护'],
  ];
  const events = [
    ['2026-05-20 15:41:02', '实例开机', '用户操作', '按量计费开始，服务端口开始代理', 'done'],
    ['2026-05-20 15:40:51', '数据盘挂载', '调度系统', '/root/lingqu-tmp 挂载完成', 'done'],
    ['2026-05-20 15:40:32', '镜像加载', '调度系统', 'PyTorch 2.8.0 / CUDA 13.0 基础镜像加载完成', 'done'],
    ['2026-05-20 15:39:58', '余额检查', '计费系统', '账户余额满足开机条件', 'done'],
  ];
  const bills = [
    ['2026-05-20 16:00', 'GPU算力', 'RTX 5090 * 1卡', '￥3.98/时', '按量中'],
    ['2026-05-20 16:00', '系统盘', '30GB', '￥0.10/日', '计费中'],
    ['2026-05-20 16:00', '文件存储', '免费额度内', '￥0.00', '已抵扣'],
  ];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="instances" />
      <main className="compute-instance-detail">
        <div className="compute-detail-head">
          <div>
            <div className="rent-crumb">容器实例 / 实例详情</div>
            <h1>{instance?.name ?? 'RTX5090-训练实例'}</h1>
            <p>{instance?.region ?? '西北B区'} / {instance?.machine ?? 'C90机'} · {instance?.id ?? 'instance-941327a885'} · {instance?.gpu ?? 'RTX 5090 * 1卡'}</p>
          </div>
          <div>
            <button onClick={() => setModal('rename')}>改名</button>
            <button onClick={() => setModal('restart')}>重启</button>
            <button onClick={() => setModal('stop')}>关机</button>
            <button onClick={() => setModal('release')}>释放</button>
          </div>
        </div>
        <section className="compute-detail-hero">
          <div>
            <span className="compute-state">运行中</span>
            <h2>PyTorch 2.8.0 / Python 3.11 / CUDA 13.0</h2>
            <p>当前实例通过平台代理提供 JupyterLab、SSH、自定义服务和 6008 管理入口，适合训练、调试和 WebUI 服务。</p>
            <div><button onClick={() => { window.location.href = '/compute/instances/workspace'; }}>JupyterLab</button><button onClick={() => { window.location.href = '/compute/instances/workspace'; }}>终端登录</button><button onClick={() => { window.location.href = '/compute/instances/workspace'; }}>AutoPanel-6008</button><button onClick={() => { window.location.href = '/compute/instances/workspace'; }}>自定义服务-6006</button></div>
          </div>
          <aside>
            <span>实时费用</span>
            <strong>￥3.98 / 时</strong>
            <small>账户余额 ￥1303.96</small>
          </aside>
        </section>
        <section className="compute-metric-grid">
          {metrics.map((item) => (
            <article key={item[0]}>
              <div><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></div>
              <div className="compute-bars">{item[3].split(',').map((value, index) => <i style={{ height: `${10 + Number(value)}px` }} key={`${item[0]}-${index}`} />)}</div>
            </article>
          ))}
        </section>
        <div className="compute-detail-grid">
          <section className="compute-card wide">
            <div className="compute-card-title"><h2>快捷服务</h2><span>服务地址在开机后自动生成，可按端口协议代理访问</span></div>
            <div className="compute-service-table">
              <div className="head"><span>服务</span><span>端口</span><span>协议</span><span>状态</span><span>操作</span></div>
              {services.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 3 ? (cell === '运行中' ? 'ok' : 'muted') : index === 4 ? 'link' : ''} key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="compute-card">
            <div className="compute-card-title"><h2>SSH 登录</h2><button>复制</button></div>
            <pre>{`ssh root@connect.lingqu.local -p 29413\npassword: ********`}</pre>
            <p>也可以在账号安全中配置 SSH 免密登录，开机后自动注入到实例。</p>
          </section>
          <section className="compute-card">
            <div className="compute-card-title"><h2>启动命令</h2><button>编辑</button></div>
            <pre>{`source /root/miniconda3/bin/activate\ncd /root/lingqu-tmp\nbash start.sh --port 6006`}</pre>
          </section>
        </div>
        <section className="compute-card">
          <div className="compute-card-title"><h2>磁盘与挂载</h2><a href="/compute/file-store">文件存储</a></div>
          <div className="compute-disk-table">
            <div className="head"><span>类型</span><span>挂载路径</span><span>用量</span><span>规则</span></div>
            {disks.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
          </div>
        </section>
        <div className="compute-detail-grid">
          <section className="compute-card">
            <div className="compute-card-title"><h2>运行日志</h2><button>下载</button></div>
            <pre>{['[16:02:04] nvidia-smi check ok','[16:02:11] service 6006 listening on 0.0.0.0','[16:02:16] jupyter lab started','[16:02:20] proxy tunnel ready'].join('\n')}</pre>
          </section>
          <section className="compute-card">
            <div className="compute-card-title"><h2>费用明细</h2><a href="/compute/billing/detail">完整账单</a></div>
            <div className="compute-bill-table">
              {bills.map((row) => <p key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong><em>{row[2]}</em><b>{row[3]}</b><small>{row[4]}</small></p>)}
            </div>
          </section>
        </div>
        <section className="compute-card">
          <div className="compute-card-title"><h2>事件记录</h2><span>最近生命周期事件</span></div>
          <div className="compute-event-list">
            {events.map((row) => <article key={row[0]}><i className={row[4]} /><span>{row[0]}</span><strong>{row[1]}</strong><em>{row[2]}</em><p>{row[3]}</p></article>)}
          </div>
        </section>
      </main>
      {modal && <ComputeInstanceActionModal type={modal} onClose={() => setModal('')} />}
    </div>
  );
}

function ComputeInstanceActionModal({ type, onClose }: { type: 'boot' | 'stop' | 'restart' | 'release' | 'rename'; onClose: () => void }) {
  const title = type === 'stop' ? '关机确认' : type === 'restart' ? '重启实例' : type === 'release' ? '释放实例' : type === 'rename' ? '修改实例名称' : '开机确认';
  return (
    <div className="modal-mask">
      <section className={`compute-action-modal ${type === 'release' ? 'danger' : ''}`}>
        <header><h2>{title}</h2><button onClick={onClose}>×</button></header>
        {type === 'rename' ? (
          <div className="compute-action-form">
            <label><span>当前名称</span><input value="RTX5090-训练实例" readOnly /></label>
            <label><span>新名称</span><input value="lingqu-train-01" readOnly /></label>
            <p>实例名称只影响控制台展示，不影响实例 ID、端口和计费。</p>
          </div>
        ) : (
          <div className="compute-action-body">
            <span>{type === 'release' ? '!' : 'i'}</span>
            <p>{type === 'release' ? '释放后系统盘和数据盘将不可恢复，请确认已备份重要数据。' : type === 'stop' ? '关机后 GPU 计费停止，系统盘和数据盘仍按规则保留。' : type === 'restart' ? '重启会短暂中断 JupyterLab、SSH 和自定义服务连接。' : '开机前会检查余额、库存和实例健康状态。'}</p>
            <label><input type="checkbox" checked readOnly /> 我已了解本次操作对任务和数据的影响</label>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>确定</button></footer>
      </section>
    </div>
  );
}

function InstancesPage({ data, onRefresh }: { data?: ComputePayload; onRefresh?: () => void }) {
  const [localData, setLocalData] = useState<ComputePayload | undefined>(data);
  const [notice, setNotice] = useState('');
  const statusRef = useRef<Record<string, string>>({});
  useEffect(() => {
    setLocalData(data);
  }, [data]);
  const allRows = localData?.instances ?? [];
  const initialTab = new URLSearchParams(window.location.search).get('type') === 'development' ? 'development' : 'task';
  const [activeType, setActiveType] = useState<'task' | 'development'>(initialTab);
  const [busyId, setBusyId] = useState('');
  const [pendingStop, setPendingStop] = useState<ComputeInstance | null>(null);
  const [activeMore, setActiveMore] = useState('');
  const rows = allRows.filter((item) => (item.instanceType ?? 'task') === activeType);
  const runningCount = rows.filter((item) => item.status.includes('运行')).length;
  const gpuCount = rows.reduce((sum, item) => sum + (Number.parseInt(item.gpu.match(/\*\s*(\d+)/)?.[1] ?? '1', 10) || 1), 0);
  const hourlyTotal = rows.reduce((sum, item) => sum + (item.providerPricePerHour ?? 0), 0);
  const taskCount = allRows.filter((item) => (item.instanceType ?? 'task') === 'task').length;
  const developmentCount = allRows.filter((item) => item.instanceType === 'development').length;
  const instanceSummary = [
    ['总实例', String(rows.length), activeType === 'task' ? '任务型弹性实例' : '开发型 Pro 实例'],
    ['运行中', String(runningCount), '可访问终端和服务'],
    ['GPU 卡数', String(gpuCount), '按实例规格估算'],
    ['小时费用', `￥${hourlyTotal.toFixed(2)}`, '按量实例实时计费'],
  ];
  const copyText = (value = '') => {
    if (!value) return;
    void navigator.clipboard?.writeText(value);
  };
  const isScheduling = (item: ComputeInstance) => {
    const raw = item.rawStatus || '';
    return ['dry_run', 'submitted', 'starting', 'queued', 'pending'].includes(raw) || /调度|待调度|预检|开机中|启动中/.test(item.status);
  };
  const refreshInstances = async (sync = true) => {
    const payload = await api.computeConsole(sync);
    const nextData = payload.data;
    if (!nextData) return;
    const nextRows = nextData.instances ?? [];
    const becameRunning = nextRows.find((item) => {
      const before = statusRef.current[item.id];
      return (item.rawStatus === 'running' || item.status.includes('运行')) && before && before !== 'running' && !before.includes('运行');
    });
    statusRef.current = Object.fromEntries(nextRows.map((item) => [item.id, item.rawStatus || item.status]));
    setLocalData(nextData);
    if (becameRunning) {
      setNotice(`${becameRunning.name} 已启动，可以连接 SSH / 打开服务入口。`);
      window.setTimeout(() => setNotice(''), 6000);
    }
  };
  const runAction = async (item: ComputeInstance, action: string) => {
    if (busyId) return;
    let instanceName: string | undefined;
    if (action === 'rename') {
      const nextName = window.prompt('修改实例名称', item.name);
      if (!nextName || nextName === item.name) return;
      instanceName = nextName;
    }
    if (action === 'stop') {
      setPendingStop(item);
      return;
    }
    if (action === 'boot' && (item.instanceType ?? 'task') === 'task') {
      if (!window.confirm('任务型算力将重新调度一台新实例，原容器数据不会恢复。确认重新调度？')) return;
    }
    if (action === 'delete') {
      const message = item.status.includes('运行') || item.status.includes('调度')
        ? '当前实例仍在运行或调度中。删除只会移除控制台记录，不会自动停止云端任务。建议先停止后再删除。确认删除记录？'
        : '确认删除该实例记录？';
      if (!window.confirm(message)) return;
    }
    setBusyId(item.id);
    try {
      await api.appInstances.action(item.id, { action, instanceName });
      setNotice(action === 'boot' ? ((item.instanceType ?? 'task') === 'task' ? '已提交重新调度，正在等待新实例启动。' : '已提交开机，正在等待实例启动。') : '操作已提交，正在刷新状态。');
      await refreshInstances(true);
      setBusyId('');
    } catch (error) {
      window.alert(String(error));
      setBusyId('');
    }
  };
  useEffect(() => {
    statusRef.current = Object.fromEntries(allRows.map((item) => [item.id, item.rawStatus || item.status]));
  }, []);
  useEffect(() => {
    if (!allRows.some(isScheduling)) return;
    const timer = window.setInterval(() => {
      void refreshInstances(true).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [allRows.map((item) => `${item.id}:${item.rawStatus || item.status}`).join('|')]);
  const handleRefresh = () => {
    void refreshInstances(true).catch(() => onRefresh?.());
  };
  return (
    <div className="console-layout">
      <ConsoleSideBar current="instances" />
      <main className="console-main instances-main">
        <div className="console-title">
          <h1>容器实例</h1>
          <span>任务型停止即释放容器数据，重新调度会创建新的任务型容器</span>
          <div className="console-links"><a>订阅GPU通知</a><a>设置SSH免密登录</a><a>小程序管理实例</a></div>
        </div>
        {notice && <div className="instance-status-toast">{notice}</div>}
        <section className="console-summary-grid">
          {instanceSummary.map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
        </section>
        <div className="instance-type-tabs">
          <button className={activeType === 'task' ? 'active' : ''} type="button" onClick={() => setActiveType('task')}>任务型算力 <span>{taskCount}</span></button>
          <button className={activeType === 'development' ? 'active' : ''} type="button" onClick={() => setActiveType('development')}>开发型算力 <span>{developmentCount}</span></button>
        </div>
        <div className="console-toolbar instances-toolbar">
          <button className="blue" onClick={() => { window.location.href = '/compute/rent?type=task'; }}>新建任务型</button>
          <button onClick={() => { window.location.href = '/compute/rent?type=development'; }}>新建开发型</button>
          <button>批量续费</button>
          <button className="refresh" onClick={handleRefresh}>C</button>
          <div className="toolbar-spacer" />
          <div className="select-like">筛选标签/子账号 <span>⌄</span></div>
          <div className="search-like">搜索实例名称/ID <span>⌕</span></div>
          <button className="gear">⚙</button>
        </div>
        <div className="autodl-instance-table">
          <div className="autodl-instance-head"><span>实例ID /名称</span><span>状态 ⌯</span><span>规格详情</span><span>本地磁盘</span><span>健康状态</span><span>付费方式 ⌯</span><span>释放时间/停机时间 ⓘ</span><span>SSH登录</span><span>快捷工具</span><span>操作</span></div>
          {rows.map((item) => {
            const billingParts = item.billing.split(/\s+/).filter(Boolean);
            const regionMachine = [item.region, item.machine && item.machine !== '-' ? item.machine : ''].filter(Boolean).join(' / ');
            return (
            <div className="autodl-instance-row" key={item.id}>
              <div className="instance-name-cell"><a>{regionMachine}</a><b>{item.displayId || item.providerContainerUuid || item.providerProInstanceUuid || item.providerDeploymentUuid || item.id}</b><em><span className={`instance-kind ${item.instanceType === 'development' ? 'dev' : 'task'}`}>{item.instanceTypeText || (item.instanceType === 'development' ? '开发型' : '任务型')}</span>{item.name}<button type="button" title="修改名称" onClick={() => runAction(item, 'rename')}>✎</button></em></div>
              <div className="instance-status-cell"><i className="dot blue" />{item.status}</div>
              <div className="instance-spec-cell"><b>{item.gpu.replace('*', '*')}</b><a href="/compute/instances/detail">查看详情</a></div>
              <div className="instance-disk-cell"><span>系统盘 {item.system_disk_usage}</span><span>数据盘 {item.data_disk_usage}</span></div>
              <div className="instance-health-cell"><span><i className="dot green" />{item.health || '正常'}</span><span>CPU <i className="usage-ring" /> 0%</span><span>内存 <i className="usage-ring" /> 0%</span></div>
              <div className="instance-billing-cell">{billingParts.length ? billingParts.map((part) => <span key={part}>{part}</span>) : <span>按量计费</span>}</div>
              <div className="instance-release-cell"><span>{item.release_time}</span>{item.status.includes('运行') && <a onClick={() => runAction(item, 'stop')}>立即停止</a>}</div>
              <div className="ssh-cell">
                {item.sshCommand ? (
                  <>
                    <b>登录指令</b><a title={item.sshCommand} onClick={() => copyText(item.sshCommand)}>ssh******</a>
                    <b>密码</b><a title={item.rootPassword || ''} onClick={() => copyText(item.rootPassword)}>*********</a>
                  </>
                ) : (
                  <>
                    <b>登录指令</b><a>ssh******</a>
                    <b>密码</b><a>*********</a>
                  </>
                )}
              </div>
              <div className="instance-quick-links">{item.quick_tools.map((tool) => {
                const href = tool === '6006' ? item.service6006Url : tool === '6008' ? item.service6008Url : tool === '服务入口' ? item.serviceUrl : '';
                return href ? <a href={href} target="_blank" rel="noreferrer" key={tool}>{tool}</a> : <a href="/compute/instances/workspace" key={tool}>{tool}</a>;
              })}</div>
              <div className="instance-actions">
                {item.status.includes('运行') || item.status.includes('调度') ? <a onClick={() => runAction(item, 'stop')}>{busyId === item.id ? '处理中' : '停止'}</a> : <a onClick={() => runAction(item, 'boot')}>{busyId === item.id ? '处理中' : (item.instanceType === 'development' ? '开机' : '重新调度')}</a>}
                <span className="instance-more-wrap">
                  <a onClick={() => setActiveMore(activeMore === item.id ? '' : item.id)}>更多</a>
                  {activeMore === item.id && (
                    <div className="instance-more-menu">
                      <button type="button" onClick={() => runAction(item, 'rename')}>修改名称</button>
                      <button type="button" onClick={() => runAction(item, 'delete')}>删除记录</button>
                    </div>
                  )}
                </span>
              </div>
            </div>
          );})}
          {rows.length === 0 && <div className="empty-row compact">当前类型暂无实例</div>}
        </div>
        <div className="console-pager">共 {rows.length} 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
      {pendingStop && (
        <TaskStopModal
          item={pendingStop}
          busy={busyId === pendingStop.id}
          onCancel={() => setPendingStop(null)}
          onConfirm={async () => {
            if (busyId) return;
            setBusyId(pendingStop.id);
            try {
              await api.appInstances.action(pendingStop.id, { action: 'stop' });
              setPendingStop(null);
              setNotice('停止请求已提交，正在刷新状态。');
              await refreshInstances(true);
              setBusyId('');
            } catch (error) {
              window.alert(String(error));
              setBusyId('');
            }
          }}
        />
      )}
    </div>
  );
}

function TaskStopModal({ item, busy, onCancel, onConfirm }: { item: ComputeInstance; busy: boolean; onCancel: () => void; onConfirm: () => void }) {
  const isDevelopment = item.instanceType === 'development';
  return (
    <div className="modal-mask">
      <section className={`compute-action-modal ${isDevelopment ? '' : 'danger'}`}>
        <header><h2>{isDevelopment ? '开发型算力关机' : '任务型算力停止'}</h2><button onClick={onCancel}>×</button></header>
        <div className="compute-action-body task-stop-body">
          <span>{isDevelopment ? 'i' : '!'}</span>
          {isDevelopment ? (
            <p>开发型算力关机后系统盘会保留，GPU 运行费用停止。长期未开机仍可能按平台规则释放。</p>
          ) : (
            <>
              <p>任务型算力基于弹性部署，停止会释放当前容器，本地文件和运行环境不会保留。</p>
              <p>当前任务型算力停止后会释放容器；请先把结果同步到云端、对象存储或文件存储，再执行停止。</p>
            </>
          )}
          <label><input type="checkbox" checked readOnly /> 我已确认重要数据已经备份或不需要保留</label>
        </div>
        <footer><button onClick={onCancel}>取消</button><button className="primary" disabled={busy} onClick={onConfirm}>{busy ? '处理中' : isDevelopment ? '确认关机' : '停止并释放'}</button></footer>
      </section>
    </div>
  );
}

function InstancesProPage() {
  return (
    <div className="console-layout">
      <ConsoleSideBar current="instancesPro" />
      <main className="console-main">
        <div className="console-title pro-title">
          <h1>容器实例 <em>Pro</em></h1>
          <span>容器实例Pro和容器实例的主要区别在于存算分离，无需克隆实例；实例连续关机60天会释放实例，实例释放会导致数据清空且不可恢复，释放前实例在数据在</span>
        </div>
        <div className="console-toolbar">
          <button className="blue">租用新实例</button>
          <button className="refresh">C</button>
          <a>使用API创建和管理实例</a>
          <div className="toolbar-spacer" />
          <div className="select-like">全部地区/机器 <span>⌄</span></div>
          <div className="search-like">搜索实例名称/ID <span>⌕</span></div>
        </div>
        <div className="console-table pro-table">
          <div className="console-head"><span>实例ID /名称</span><span>状态 ⌯</span><span>规格详情</span><span>本地磁盘</span><span>健康状态</span><span>付费方式 ⌯</span><span>释放时间/停机时间 ⓘ</span><span>SSH登录</span><span>快捷工具</span><span>操作</span></div>
          <div className="empty-row compact">暂无数据</div>
        </div>
        <div className="console-pager">共 0 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function MarketPage({
  data,
  error,
  state,
  gpu,
  region,
  visibleResources,
  setGpu,
  setRegion,
}: {
  data?: ComputePayload;
  error: string;
  state: LoadState;
  gpu: string;
  region: string;
  visibleResources: GpuResource[];
  setGpu: (value: string) => void;
  setRegion: (value: string) => void;
}) {
  return (
      <div className="market-layout">
        <main className="market-content">
          <section className="market">
            <div className="warning">ⓘ 严禁使用WebUI等算法生成违禁图片、严禁挖矿，一经发现立即封号！</div>
            <div className="filter-box">
              <FilterRow label="计费方式:" items={billingModes} selected="按量计费" />
              <RegionRows selected={region} onSelect={setRegion} />
              <div className="filter-row gpu-checks">
                <label>GPU型号:</label>
                {gpuOptions.map((item) => (
                  <button className={gpu && gpu === gpuValue(item) ? 'checked' : ''} key={item} type="button" onClick={() => setGpu(gpuValue(item))}>
                    <i />{item}
                  </button>
                ))}
              </div>
              <FilterRow label="GPU数量:" items={gpuCounts.map(String)} selected="1" />
            </div>

            {state === 'error' && <div className="error">{error}</div>}

            <div className="gpu-list">
              {visibleResources.map((item) => <GpuCard item={item} key={item.id} />)}
            </div>
            <div className="market-pager">共 1261 条&nbsp;&nbsp;<b>1</b><span>2</span><span>3</span><span>4</span><span>5</span><span>6</span><span>127</span>&nbsp;&nbsp;前往 <input value="1" readOnly /> 页</div>
          </section>
        </main>
      </div>
  );
}

function RentPage({ data }: { data?: ComputePayload }) {
  const elasticResources = useMemo(() => (data?.resources ?? []).filter((row) => row.provider_mode === 'autodl_elastic'), [data]);
  const taskResource = elasticResources.find((row) => row.gpu_model === 'RTX 4090' && row.region === '重庆A区') ?? elasticResources[0] ?? data?.resources[0];
  const developmentResource = data?.resources.find((row) => row.provider_mode === 'autodl_pro' && row.gpu_model === 'RTX 4090D') ?? data?.resources.find((row) => row.provider_mode === 'autodl_pro') ?? taskResource;
  const balance = data?.balance_cny ?? 1300.9;
  const initialInstanceType = new URLSearchParams(window.location.search).get('type') === 'development' ? 'development' : 'task';
  const [instanceType, setInstanceType] = useState<'task' | 'development'>(initialInstanceType);
  const [billingMode, setBillingMode] = useState('按量计费');
  const [billingRuleOpen, setBillingRuleOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState(autodlElasticRegions[0].region);
  const [selectedRegionSign, setSelectedRegionSign] = useState(autodlElasticRegions[0].region_sign);
  const [selectedGpu, setSelectedGpu] = useState('');
  const [stockModels, setStockModels] = useState<Array<{ gpuName: string; available: number; total: number; chipCorp?: string; cpuArch?: string }>>([]);
  const [stockLoading, setStockLoading] = useState(false);
  const isDevelopment = instanceType === 'development';
  const fetchRegionStock = (regionSign: string) => {
    if (!regionSign) return;
    const cacheKey = `${regionSign}:ALL`;
    const cached = stockFetchCache.get(cacheKey);
    if (cached && Date.now() - cached.at < 10 * 60 * 1000) {
      setStockModels(cached.models);
      setStockLoading(false);
      return;
    }
    setStockLoading(true);
    api.provider.gpuStock(regionSign).then((payload) => {
      const models = payload.data.items ?? [];
      stockFetchCache.set(cacheKey, { at: Date.now(), models });
      setStockModels(models);
    }).catch(() => undefined).finally(() => {
      setStockLoading(false);
    });
  };
  const regionOptions = useMemo(() => {
    return autodlElasticRegions;
  }, []);
  const gpuOptionsForRegion = useMemo(() => {
    if (stockModels.length) {
      return stockModels.map((row) => ({
        ...(elasticResources.find((item) => item.gpu_model === row.gpuName) ?? taskResource),
        id: `${selectedRegionSign}-${row.gpuName}`,
        region: selectedRegion,
        region_sign: selectedRegionSign,
        machine: '弹性资源池',
        gpu_model: row.gpuName,
        available: row.available,
        total: row.total,
      }));
    }
    return [];
  }, [elasticResources, selectedRegion, selectedRegionSign, stockModels, taskResource]);
  const selectedTaskResource = gpuOptionsForRegion.find((row) => row.gpu_model === selectedGpu) ?? gpuOptionsForRegion[0];
  const item = isDevelopment ? developmentResource : selectedTaskResource;
  const price = item?.hourly_price ?? 5.98;
  const dayPrice = item?.daily_price ?? price * 24;
  const weekPrice = item?.weekly_price ?? dayPrice * 7;
  const monthPrice = item?.monthly_price ?? dayPrice * 30;
  const originalPrice = item?.original_hourly_price ?? 7.97;
  const machine = item?.machine ?? '弹性资源池';
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const displayRegion = item?.region ?? (isDevelopment ? '北京B区' : selectedRegion);
  const displayMachine = machine;
  const displayGpuModel = item?.gpu_model ?? (isDevelopment ? 'RTX 4090D' : '请选择GPU');
  const displayGpuMemory = item?.gpu_memory_gb ?? 24;
  const displayCpuCores = item?.cpu ?? (isDevelopment ? '动态分配' : '22核');
  const displayMemory = item?.memory_gb ?? (isDevelopment ? 60 : 90);
  const displayCpuModel = item?.cpu ?? (isDevelopment ? 'Pro动态分配' : '弹性调度');
  const displayDriver = item?.driver ?? (isDevelopment ? 'AutoDL Pro' : '-');
  const displayCuda = item?.cuda ?? '11.8-12.8';
  const liveAvailable = item?.available ?? 0;
  const liveTotal = item?.total ?? 0;
  const displayPrice = price;
  const displayOriginalPrice = originalPrice;
  const displayDayPrice = dayPrice;
  const billingSummary = billingMode === '包月'
    ? { price: monthPrice, unit: '月' }
    : billingMode === '包周'
      ? { price: weekPrice, unit: '周' }
      : billingMode === '包日'
        ? { price: dayPrice, unit: '日' }
        : { price, unit: '时' };
  const dailySummary = billingMode === '按量计费'
    ? { price: dayPrice, unit: '日' }
    : billingSummary;
  const createInstance = async () => {
    if (creating) return;
    setCreating(true);
    setCreateError('');
    try {
      await api.appInstances.create({
        appId: isDevelopment ? 'AUTODL-PRO-4090D-BJ' : 'MINICONDA-CUDA118-4090-CQ',
        instanceName: isDevelopment ? `${displayRegion} ${displayGpuModel} Pro 开发型` : `${displayRegion} ${displayGpuModel} CUDA11.8 任务型`,
        gpuModel: displayGpuModel,
        region: displayRegion,
        gpuCount: 1,
        billingMode,
        boot: true,
        instanceType,
      });
      window.location.href = '/compute/instances';
    } catch (error) {
      setCreateError(String(error));
      setCreating(false);
    }
  };

  useEffect(() => {
    if (isDevelopment) return;
    const rows = gpuOptionsForRegion;
    if (rows.length === 0) return;
    if (!selectedGpu || !rows.some((row) => row.gpu_model === selectedGpu)) {
      setSelectedGpu(rows[0].gpu_model);
    }
  }, [gpuOptionsForRegion, isDevelopment, selectedGpu]);

  useEffect(() => {
    if (!isDevelopment && selectedRegionSign && stockModels.length === 0 && !stockLoading) {
      fetchRegionStock(selectedRegionSign);
    }
  }, [isDevelopment, selectedRegionSign]);

  return (
    <div className="rent-layout">
      <main className="rent-content">
        <div className="rent-crumb">算力市场 / 创建实例 <span>ⓘ 严禁使用WebUI等算法生成违禁图片、严禁挖矿，一经发现立即封号！</span></div>

        <section className="rent-panel compute-type-panel">
          <div className="rent-label">算力类型:</div>
          <div className="rent-body">
            <div className="compute-type-options">
              <button type="button" className={instanceType === 'task' ? 'active' : ''} onClick={() => setInstanceType('task')}>
                <strong>任务型算力</strong><span>适合 LTX、文生图、文生视频和工作流推理。停止即释放数据，结果需保存到云端。</span>
              </button>
              <button type="button" className={instanceType === 'development' ? 'active' : ''} onClick={() => setInstanceType('development')}>
                <strong>开发型算力</strong><span>适合 Jupyter、SSH、文件管理和长期调试。关机保留系统盘，价格更高。</span>
              </button>
            </div>
          </div>
        </section>

        <section className="rent-panel billing-panel">
          <div className="rent-label">计费方式:</div>
          <div className="rent-body">
            <SegmentButtons items={['按量计费', '包日', '包周', '包月']} selected={billingMode} onSelect={setBillingMode} />
            <button className="rule-link" type="button" onClick={() => setBillingRuleOpen(true)}>计费规则</button>
            <p>{instanceType === 'task' ? '任务型算力使用弹性部署，停止前请先把结果同步到云端、对象存储或文件存储。' : '开发型算力使用容器实例Pro，关机保留系统盘，15天未开机仍可能释放。'}</p>
            <div className="billing-price-line">
              <span className={billingMode === '按量计费' ? 'active' : ''}>按量 ￥{money(displayPrice)}/时</span>
              <span className={billingMode === '包日' ? 'active' : ''}>包日 ￥{money(displayDayPrice)}/日</span>
              <span className={billingMode === '包周' ? 'active' : ''}>包周 ￥{money(weekPrice)}/周</span>
              <span className={billingMode === '包月' ? 'active' : ''}>包月 ￥{money(monthPrice)}/月</span>
            </div>
            {billingRuleOpen && (
              <div className="billing-rule-pop">
                <div className="billing-rule-card">
                  <header><strong>计费规则</strong><button type="button" onClick={() => setBillingRuleOpen(false)}>×</button></header>
                  <p>按量计费按实际运行时长扣费，停止后不再产生 GPU 运行费用。</p>
                  <p>包日、包周、包月为时长包展示方式，下单后按所选周期锁定本次创建的计费方式。</p>
                  <p>{instanceType === 'task' ? '任务型算力停止前请同步结果或备份文件，释放后本地数据不可恢复。' : '开发型算力关机保留系统盘，实例释放规则以平台实际资源策略为准。'}</p>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className="rent-panel host-panel">
          <div className="rent-label">选择主机:</div>
          <div className="rent-body">
            <div className="resource-select-inline">
              {isDevelopment ? (
                <div className="resource-fixed-line">
                  <span>开发型算力</span><strong>{developmentResource?.region ?? '北京B区'} / {developmentResource?.machine ?? 'Pro资源池'}</strong><em>{developmentResource?.gpu_model ?? 'RTX 4090D'} · 关机保留</em>
                </div>
              ) : (
                <>
                  <div className="resource-option-line">
                    <label>选择地区：</label>
                    <div>
                      {regionOptions.map((row) => <button type="button" className={selectedRegionSign === row.region_sign ? 'selected' : ''} key={`${row.region}-${row.region_sign ?? ''}`} onClick={() => { const sign = row.region_sign ?? ''; setSelectedRegion(row.region); setSelectedRegionSign(sign); setStockModels([]); fetchRegionStock(sign); }}>{row.region}</button>)}
                    </div>
                  </div>
                  <div className="resource-option-line">
                    <label>GPU型号：</label>
                    <div>
                      {gpuOptionsForRegion.length > 0
                        ? gpuOptionsForRegion.map((row) => <button type="button" className={selectedGpu === row.gpu_model ? 'selected' : ''} key={`${row.region}-${row.gpu_model}`} onClick={() => { setSelectedGpu(row.gpu_model); }}>{row.gpu_model}<small>{row.available}/{row.total}</small></button>)
                        : <span className="resource-empty-tip">请先选择地区</span>}
                    </div>
                  </div>
                  <p>{stockLoading ? '正在刷新所选地区库存...' : `当前 ${displayRegion} ${displayGpuModel}：${liveAvailable}/${liveTotal}，切换地区时刷新库存`}</p>
                </>
              )}
            </div>
            <div className="host-table">
              <div className="host-head">
                <span></span><span>地区/资源池</span><span>算力型号/显存</span><span>空闲GPU</span><span>每GPU分配</span><span>CPU型号</span><span>硬盘</span><span>驱动/CUDA</span><span>价格(单卡)</span>
              </div>
              <div className="host-row">
                <span><i className="radio-dot" /></span>
                <span><a>{displayRegion}</a><small>{displayMachine}</small></span>
                <span>{displayGpuModel}<br />{displayGpuMemory}GB</span>
                <span><b>{liveAvailable} / {liveTotal}</b>{stockLoading && <small>刷新中</small>}</span>
                <span>CPU：{displayCpuCores}<br />内存：{displayMemory}GB</span>
                <span>{displayCpuModel}</span>
                <span>{isDevelopment ? <>系统盘：30GB起<br />关机保留</> : <>数据盘：{item?.data_disk_gb ?? 50}GB<br />可扩容：{item?.data_disk_expand_gb ?? 4096}GB</>}</span>
                <span>驱动：{displayDriver}<br />CUDA：{displayCuda}</span>
                <span className="host-price">￥{money(displayPrice)}/时<br /><del>￥{money(displayOriginalPrice)}/时</del></span>
              </div>
            </div>

            <div className="rent-line gpu-count-line">
              <label>GPU数量:</label>
              <SegmentButtons items={['1', '2', '3', '4', '5', '6', '7', '8', '9']} selected="1" disabledFrom={2} />
            </div>
            <div className="rent-line disk-line">
              <label>数据盘:</label>
              <span>免费50GB SSD</span>
              <label className="check-label"><i />需要扩容</label>
            </div>

            <div className="spec-box">
              <strong>实例规格：</strong>
              <dl><dt>地区</dt><dd>{displayRegion}</dd></dl>
              <dl><dt>GPU型号</dt><dd>{displayGpuModel} * 1卡</dd></dl>
              <dl><dt>CPU</dt><dd>{displayCpuCores}</dd></dl>
              <dl><dt>内存</dt><dd>{displayMemory}GB</dd></dl>
              <dl><dt>系统盘</dt><dd>30GB</dd></dl>
              <dl><dt>数据盘</dt><dd>{isDevelopment ? '关机保留系统盘' : '免费50GB SSD'}</dd></dl>
            </div>
          </div>
        </section>

        <section className="rent-panel image-panel">
          <div className="rent-label">镜像:</div>
          <div className="rent-body">
            <SegmentButtons items={['基础镜像', '社区镜像', '我的镜像']} selected="基础镜像" hotIndex={1} />
            <a className="rule-link">没有我要的环境？</a>
            <p>基础镜像包含常用基本软件，如：深度学习框架、Miniconda等。如需其他软件可创建后安装</p>
            <div className="select-input">PyTorch / Python 3.8 / CUDA 11.8 / Miniconda <span>⌄</span></div>
            {createError && <p className="form-error">{createError}</p>}
          </div>
        </section>

        <section className="rent-panel coupon-panel">
          <div className="rent-label">优惠券:</div>
          <div className="rent-body"><div className="select-input small">请选择 <span>⌄</span></div></div>
        </section>
      </main>

      <div className="rent-footer">
        <span>日常费用:<b>￥{money(dailySummary.price)}</b>/{dailySummary.unit} <button className="cost-help" type="button" onClick={() => setBillingRuleOpen(true)}>?</button></span>
        <span>配置费用:<b>￥{money(billingSummary.price)}</b>/{billingSummary.unit} <button className="cost-detail-link" type="button" onClick={() => setBillingRuleOpen(true)}>费用明细</button></span>
        <small>账户余额￥{balance.toFixed(2)}</small>
        <button type="button" className="ghost" onClick={() => { window.location.href = '/compute/instances'; }}>取消</button>
        <button type="button" className="primary" disabled={creating} onClick={createInstance}>{creating ? '创建中...' : '创建并开机'}</button>
      </div>
    </div>
  );
}

function SegmentButtons({ items, selected, disabledFrom, hotIndex, onSelect }: { items: string[]; selected: string; disabledFrom?: number; hotIndex?: number; onSelect?: (value: string) => void }) {
  return (
    <div className="segment-buttons">
      {items.map((item, index) => (
        <button className={item === selected ? 'selected' : ''} disabled={disabledFrom !== undefined && index >= disabledFrom} key={item} type="button" onClick={() => onSelect?.(item)}>
          {hotIndex === index && <em>hot</em>}{item}
        </button>
      ))}
    </div>
  );
}

function FilterRow({ label, items, selected, onSelect, wrap }: { label: string; items: string[]; selected: string; onSelect?: (value: string) => void; wrap?: boolean }) {
  return (
    <div className={`filter-row ${wrap ? 'wrap' : ''}`}>
      <label>{label}</label>
      {items.map((item) => <button className={item === selected ? 'selected' : ''} key={item} type="button" onClick={() => onSelect?.(item)}>{item}</button>)}
    </div>
  );
}

function RegionRows({ selected, onSelect }: { selected: string; onSelect: (value: string) => void }) {
  return (
    <div className="filter-row region-row">
      <label>选择地区:</label>
      <div className="region-lines">
        <div>
          {regionLineOne.map((item) => <button className={item === selected ? 'selected' : ''} key={item} type="button" onClick={() => onSelect(item)}>{item}</button>)}
        </div>
        <div>
          {regionLineTwo.map((item) => <button className={item === selected ? 'selected' : ''} key={item} type="button" onClick={() => onSelect(item)}>{item}</button>)}
        </div>
      </div>
    </div>
  );
}

function GpuCard({ item }: { item: GpuResource }) {
  return (
    <article className="gpu-card">
      <header>
        <div><small>{item.region} / {item.machine}&nbsp;&nbsp;{item.id}</small><h2>{item.gpu_model} / {item.gpu_memory_gb} GB</h2></div>
        <div className="free">空闲/总量 <strong>{item.available}</strong> / {item.total}</div>
        <div className="provider">{item.provider_mode === 'autodl_elastic' ? '弹性资源接口' : item.provider}</div>
      </header>
      <div className="gpu-body">
        <div><span>每GPU分配</span><b>CPU: {item.cpu}</b><b>内存: {item.memory_gb} GB</b></div>
        <div><span>硬盘</span><b>系统盘: {item.system_disk_gb} GB</b><b>数据盘: {item.data_disk_gb} GB，可扩容 {item.data_disk_expand_gb ?? 0} GB</b></div>
        <div><span>其它</span><b>GPU驱动: {item.driver}</b><b>CUDA版本: {item.cuda}</b></div>
        <div className="price"><strong>￥{money(item.hourly_price)}</strong><span>/时</span>{item.original_hourly_price && <del>￥{money(item.original_hourly_price)}/时</del>}{item.discount_label && <em>{item.discount_label}</em>}<button type="button" onClick={() => { if (item.available > 0) window.location.href = '/compute/rent'; }}>{item.available > 0 ? '1卡可租' : '暂无库存'}</button></div>
      </div>
    </article>
  );
}

function InstanceTable({ rows }: { rows: ComputeInstance[] }) {
  return (
    <div className="table">
      <div className="table-head"><span>实例ID /名称</span><span>状态</span><span>规格详情</span><span>本地磁盘</span><span>健康状态</span><span>付费方式</span><span>释放时间/停机时间</span><span>快捷工具</span><span>操作</span></div>
      {rows.map((item) => (
        <div className="table-row" key={item.id}>
          <span><a>{item.region} / {item.machine}</a><b>{item.id}</b><small>{item.name}</small></span>
          <span><i className="dot blue" />{item.status}</span>
          <span>{item.gpu}<a>查看详情</a></span>
          <span>系统盘 {item.system_disk_usage}<small>数据盘 {item.data_disk_usage}</small></span>
          <span><i className="dot green" />{item.health}</span>
          <span>{item.billing}</span>
          <span>{item.release_time}</span>
          <span className="links">{item.quick_tools.map((tool) => <a key={tool}>{tool}</a>)}</span>
          <span className="links"><a>关机</a><a>更多</a></span>
        </div>
      ))}
    </div>
  );
}

function resourceCount(rows: GpuResource[], model: string) {
  const filtered = rows.filter((item) => item.gpu_model === model);
  const available = filtered.reduce((sum, item) => sum + item.available, 0);
  const total = filtered.reduce((sum, item) => sum + item.total, 0);
  return `${available}/${total}`;
}

function gpuValue(label: string) {
  if (label === '全部') return '';
  return label.replace(/\s+\(.*/, '').replace('RTX PRO 6000', 'RTX PRO 6000').trim();
}

function money(value: number) {
  return value.toFixed(2).replace(/\.00$/, '');
}

function resourceRank(item: GpuResource) {
  if (item.machine === 'C90机') return 1;
  if (item.gpu_model === 'RTX 5090') return 2;
  if (item.gpu_model === 'vGPU-32GB') return 3;
  if (item.gpu_model === 'RTX PRO 6000') return 4;
  return 10;
}

createRoot(document.getElementById('root')!).render(<App />);
