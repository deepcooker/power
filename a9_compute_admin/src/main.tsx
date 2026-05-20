import { createRoot } from 'react-dom/client';
import { useEffect, useMemo, useState } from 'react';
import { api } from './api';
import type { ComputeInstance, ComputePayload, GpuResource } from './types';
import type { ReactNode } from 'react';
import './styles.css';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const billingModes = ['按量计费', '包日', '包周', '包月'];
const regionLineOne = ['西北B区', '北京B区', '重庆A区', '内蒙B区', '北京A区', '佛山区', '西北企业区'];
const regionLineTwo = ['V100专区', 'A800专区', '摩尔线程专区', '华为昇腾专区', 'L20专区'];
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
const imageRows = [
  { uuid: 'image-e55db9ae41', name: 'new0415', size: '20.78GB', status: '就绪', share: '私有镜像', source: 'AutoDL', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-04-15 13:30:50' },
  { uuid: 'image-ef24180470', name: 'policy2026', size: '14.97GB', status: '就绪', share: '私有镜像', source: 'AutoDL', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-01-17 01:11:09' },
  { uuid: 'image-e76f008b92', name: 'policy_2016', size: '20.24GB', status: '就绪', share: '私有镜像', source: 'AutoDL', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-01-15 14:20:28' },
  { uuid: 'image-08c61e993b', name: 'newpolicy', size: '25.63GB', status: '就绪', share: '私有镜像', source: 'AutoDL', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2026-01-04 21:44:26' },
  { uuid: 'image-83271d99d1', name: 'policy', size: '24.14GB', status: '就绪', share: '私有镜像', source: 'AutoDL', cache: '重庆区', base: 'Miniconda  conda3\nPython  3.10(ubuntu22.04)\nCUDA  11.8', created: '2025-11-21 09:04:47' },
];
const publicDataRows = [
  ['argoverse2.0感知数据集', '/root/autodl-pub/argoverse2.0-sensor', '739.02 GB', '数据集', 'https://argoverse.github.io', 'https://argoverse.github.io/user-guide/'],
  ['Vimeo-90k', '/root/autodl-pub/Vimeo-90k', '81.89 GB', '数据集', 'toflow.csail.mit.edu', 'Vimeo-90k视频超分数据集'],
  ['CULane', '/root/autodl-pub/CULane', '42.45 GB', '数据集', 'https://xingangpan.github.io/projects/CULane.html', 'CULane is a large scale challenging dataset for academic research on traffic lane detection'],
  ['TT100K', '/root/autodl-pub/TT100K', '106.77 GB', '数据集', 'https://cg.cs.tsinghua.edu.cn/traffic-sign/', '交通信号灯检测与识别数据集'],
  ['cifar-100', '/root/autodl-pub/cifar-100', '162 MB', '数据集', 'https://www.cs.toronto.edu/~kriz/cifar.html', 'CIFAR-100图像分类数据集'],
  ['CUB200-2011', '/root/autodl-pub/CUB200-2011', '1.11 GB', '数据集', 'http://www.vision.caltech.edu/datasets/cub_200_2011/', '鸟类细粒度分类数据集'],
  ['ModelNet', '/root/autodl-pub/ModelNet', '2.34 GB', '数据集', 'https://modelnet.cs.princeton.edu/', 'The goal of the Princeton ModelNet project is to provide researchers in computer vision, computer graphics, robotics and cognitive science, with a comprehensive clean collection of 3D CAD models for objects.'],
  ['S3DIS', '/root/autodl-pub/S3DIS', '14.26 GB', '数据集', 'http://buildingparser.stanford.edu/dataset.html', 'Stanford Large-Scale 3D Indoor Spaces Dataset (S3DIS)'],
];

function App() {
  const [state, setState] = useState<LoadState>('idle');
  const [error, setError] = useState('');
  const [data, setData] = useState<ComputePayload>();
  const [region, setRegion] = useState('西北B区');
  const [gpu, setGpu] = useState('');
  const currentPath = window.location.pathname.replace(/\/$/, '');
  const isHomePage = currentPath === '/compute/home';
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
  const isImagesPage = currentPath === '/compute/images';
  const isPublicDataPage = currentPath === '/compute/public-data';
  const isBillingPage = currentPath === '/compute/billing';
  const isOrdersPage = currentPath === '/compute/billing/orders';
  const isBillDetailPage = currentPath === '/compute/billing/detail';
  const isCouponsPage = currentPath === '/compute/billing/coupons';
  const isAccountPage = currentPath === '/compute/account/security';
  const isAccessPage = currentPath === '/compute/account/access';
  const isSubAccountPage = currentPath === '/compute/account/sub-accounts';
  const isSettingsPage = currentPath === '/compute/account/settings';
  const isServersPage = currentPath === '/compute/servers';
  const isPrivateCloudPage = currentPath === '/compute/private-cloud';
  const isDocsPage = currentPath === '/compute/docs' || currentPath.startsWith('/compute/docs/');
  const isApiDeployPage = currentPath === '/compute/api-deploy';
  const isSharedDataPage = currentPath === '/compute/shared-data';
  const isDurationPacksPage = currentPath === '/compute/deployments/packs';
  const isDeploymentsPage = currentPath === '/compute/deployments';
  const isDeploymentCreatePage = currentPath === '/compute/deployments/create';
  const isDeploymentContainersPage = currentPath === '/compute/deployments/containers';
  const isDeploymentBlacklistPage = currentPath === '/compute/deployments/blacklist';

  const reload = async () => {
    setState('loading');
    setError('');
    try {
      const payload = await api.computeConsole();
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
    return <Shell data={data}><InstancesPage data={data} /></Shell>;
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

  if (isPublicDataPage) {
    return <Shell data={data}><PublicDataPage /></Shell>;
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

  if (isPrivateCloudPage) {
    return <Shell data={data}><PrivateCloudPage /></Shell>;
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
  const pathname = window.location.pathname;
  const isHome = pathname.includes('/home');
  const isConsole = pathname.includes('/dashboard') || pathname.includes('/instances') || pathname.includes('/file-store') || pathname.includes('/netdisk') || pathname.includes('/images') || pathname.includes('/public-data') || pathname.includes('/billing') || pathname.includes('/account');
  const isServers = pathname.includes('/servers');
  const isPrivateCloud = pathname.includes('/private-cloud');
  const isDocs = pathname.includes('/docs');
  const isArtApp = pathname.includes('/app/') || pathname.includes('/art/');
  const isMarket = !isHome && !isArtApp && !isConsole && !pathname.includes('/deployments') && !isServers && !isPrivateCloud && !isDocs;
  return (
    <div className="page">
      <header className="promo">DeepSeek V4 API已上线&nbsp;&nbsp;<b>大模型广场</b></header>
      <nav className="topbar">
        <a className="brand" href="/compute/home"><span />灵渠</a>
        <div className="topnav">
          <a className={isMarket ? 'active' : ''} href="/compute">算力市场</a><a className={isArtApp ? 'active' : ''} href="/compute/app/market">AI应用</a><a className={isServers ? 'active' : ''} href="/compute/servers">AI服务器</a><a className={isPrivateCloud ? 'active' : ''} href="/compute/private-cloud">私有云</a><a className={isDocs ? 'active' : ''} href="/compute/docs">帮助文档</a><button className="top-more" type="button" onClick={() => setMoreOpen(!moreOpen)}>更多⌃</button>
          {moreOpen && <div className="top-more-menu"><a href="/compute/api-deploy">API弹性部署</a><a href="/compute/shared-data">共享数据</a></div>}
        </div>
        <div className="topuser">
          <a className={isConsole ? 'active' : ''} href="/compute/dashboard">控制台</a>
          <button type="button" onClick={() => setUserOpen(!userOpen)}>{data?.account_name ?? 'deepcooker'} {userOpen ? '⌃' : '⌄'}</button>
          {userOpen && <UserMenu accountName={data?.account_name ?? 'deepcooker'} />}
        </div>
      </nav>
      {children}
      <aside className="float-help"><button>领<br />优惠券</button><button>☏</button><button>▣</button><button>↗</button></aside>
    </div>
  );
}

function UserMenu({ accountName }: { accountName: string }) {
  return (
    <div className="user-menu">
      <div className="user-menu-head">
        <strong>{accountName}</strong>
        <em>企业认证</em>
      </div>
      <div className="user-id">ID：8474db06-cf32-46d2-b908-fbb3b43170b5 <span>⧉</span></div>
      <div className="member-line"><i>♕</i><span>炼丹会员</span></div>
      <div className="user-money"><span>可用余额：￥1282.08</span><button>去充值</button></div>
      <div className="user-stat">冻结余额：￥0.00</div>
      <div className="user-stat">代金券：￥0.00</div>
      <div className="user-stat">容器实例：3</div>
      <a className="logout-link">退出登录</a>
    </div>
  );
}

function HomePage() {
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
  return (
    <main className="home-page">
      <section className="home-hero">
        <div className="home-hero-copy">
          <h1>灵渠 AI算力云</h1>
          <p>弹性、好用、省钱</p>
          <div className="home-hero-actions"><a href="/compute">立即注册</a><a href="/compute/docs">了解详情</a></div>
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
      <section className="home-quick">
        {cards.map((card) => <article key={card[0]}><h2>{card[0]}</h2><p>{card[1]}</p></article>)}
      </section>
      <section className="home-prices">
        <h2>炼丹会员及租用价格</h2>
        <p>灵渠坚持为您提供服务稳定、价格公道的GPU租用服务。更为学生提供免费升级会员通道，享极具性价比的会员价格。<a>如何升级会员？</a></p>
        <div className="home-tabs"><b>炼丹会员</b><span>普通用户</span></div>
        <div className="home-price-grid">
          {priceRows.map((row) => <article key={row[0]}><h3>{row[0]}</h3><p>{row[1]}</p><strong>{row[2]}</strong><em>{row[3]}</em></article>)}
        </div>
      </section>
      <section className="home-rank">
        <h2>GPU算力排名</h2>
        <p>仅以灵渠平台提供的加速卡型号进行算力排名，其中 NVIDIA GPU 以 Peak FP16 Tensor TFLOPS with FP32 Accumulate 值为半精算力值</p>
        <div className="home-rank-tabs"><b>半精算力排名</b><span>单精算力排名</span></div>
        <div className="rank-table">
          <div className="rank-head"><span>排名</span><span>GPU</span><span>半精算力</span><span>算力</span></div>
          {rankRows.map((row, index) => (
            <div className="rank-row" key={row[0]}><span>{index + 1}</span><span>{row[0]}</span><span><i style={{ width: row[1] }} /></span><span>{row[2]}</span></div>
          ))}
        </div>
      </section>
      <section className="home-cta"><h2>更大更全更专业的AI算力集群，即刻开启算力租用</h2><p>20000+ 卡在线GPU、MLU、Ascend</p><a href="/compute">查看算力市场</a></section>
      <footer className="home-footer">
        <div><h3>产品与服务</h3><a>GPU租用</a><a>大客户1v1支持</a></div>
        <div><h3>帮助与支持</h3><a href="/compute/docs">帮助文档</a><a>开具发票</a></div>
        <div><h3>灵渠</h3><a>加入我们</a><a>联系电话：15335190557</a></div>
        <div><h3>扫码关注公众号</h3><div className="footer-qr" /></div>
      </footer>
    </main>
  );
}

function SharedDataPage() {
  const rows = [
    ['ImageNet100', 'ImageNet 100类数据集。参考：https://github.c...', 'daiab', '230'],
    ['COCO2017', 'Based on community feedback, in 2017...', 'daiab', '146'],
    ['VisDrone 2019', '天津大学机器学习与数据挖掘实验室发布的无人机目标检测数据', 'daiab', '81'],
    ['MOT20', '密集人群中行人跟踪数据集（多目标跟踪）', 'daiab', '79'],
    ['AKI-Stable diffusion', '基于秋叶版本的sd', '炼丹师9033', '72'],
    ['ImageNet', 'The ImageNet dataset contains 14,197,...', 'daiab', '67'],
    ['ChatGLM-6B', 'ChatGLM-6B 是一个开源的、支持中英双语的对话语言模型...', '炼丹师5015', '64'],
    ['coco2014', 'coco2014', '炼丹师1605', '55'],
    ['KITTI', 'Karlsruhe Institute of Technology and T...', '秦家伟-QJW', '46'],
    ['LLaMA', 'Meta LLaMA LLM Data', '炼丹师3345', '43'],
    ['CityScapes', 'Semantic Understanding of Urban Stre...', '炼丹师9485', '43'],
    ['PASCALVOC2012', 'The PASCAL Visual Object Classes (VOC...', 'daiab', '41'],
    ['mini-ImageNet', '小样本学习、元学习标准数据集', '用户7705', '37'],
    ['CIFAR_10', 'The CIFAR-10 dataset (Canadian Institu...', 'daiab', '36'],
    ['CIFAR_100', 'The CIFAR-100 dataset (Canadian Instit...', 'daiab', '34'],
    ['GTA5', 'GTA5城市景观数据，对应cityscapes的类别', '违规炼丹', '31'],
    ['nuScenes dataset (v1...', 'keyframe subset and metadata', 'Yokey', '28'],
    ['DOTA', 'DOTA is a large-scale dataset for object...', 'daiab', '28'],
    ['so-vits-svc-4.0', 'so-vits-svc，是音频转音频，属于音色转换算法...', '炼丹师9686', '27'],
    ['stable diffusion model', 'xmix9realistic_v26 meinamix_meinaV9', '炼丹师6123', '24'],
  ];
  return (
    <main className="shared-page">
      <div className="shared-tabs"><a className="active">共享数据</a><a>我共享的</a><a>我收藏的</a><button>＋ 发布共享</button></div>
      <div className="shared-tools"><label>搜索数据：</label><div className="shared-search">请输入数据名称 <span>⌕</span></div><a>如何使用数据？</a></div>
      <section className="shared-grid">
        {rows.map((row) => (
          <article className="shared-card" key={row[0]}>
            <h2>{row[0]} <span className="netdisk-icon" /> <em>百度网盘</em></h2>
            <p>{row[1]}</p>
            <div><span>♙ {row[2]}</span><i /> <span>☆ {row[3]}</span></div>
          </article>
        ))}
      </section>
      <div className="shared-pager">共 665 条 <span>‹</span><b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b><b>34</b><span>›</span> 前往 <input value="1" readOnly /> 页</div>
    </main>
  );
}

function ArtMarketPage() {
  const [panelModal, setPanelModal] = useState<'select' | 'mine' | 'cost' | ''>('');
  const path = window.location.pathname;
  const detailOpen = path.includes('/compute/app/market/') && !path.includes('/search') && !path.includes('/tag/') && !path.includes('/weekly') && !path.includes('/base');
  const isSearch = path.includes('/compute/app/market/search');
  const isTag = path.includes('/compute/app/market/tag/');
  const isWeekly = path.includes('/compute/app/market/weekly');
  const isBase = path.includes('/compute/app/market/base');
  const activeTag = isTag ? decodeURIComponent(path.split('/tag/')[1] || 'Z-Image') : '';
  const tags = ['全部', '周榜', '基础镜像', '漫剧', '二次元', 'LTX-2', 'OpenClaw', 'LTX2.3', '语音', 'HeyGem', 'LongCat', 'NewBie', 'LLM', '电商', 'Flux.2', 'Z-Image', 'Qwen', 'llama', 'LORA', 'OCR', '小说', 'Sora', 'FluxGym', 'ComfyUI', 'TTS', 'AI-Toolkit', '训练', 'wan2.2', '视频', 'DeepSeek', '音频'];
  const apps = [
    ['精', 'Zimage-Wan-Ltx2.3-训练器', 'zealman', '121', '13574h', '5343', '更新到2026年4月最新版本', 'pink'],
    ['精', 'ComfyUI云绘通用版', 'nahz202', '310', '52637h', '27092', '4TB模型库，50+套图像视频生成工作流', 'dark'],
    ['精', '字字动画', 'zzdh', '801', '685556h', '193307', '全自动-AI电影', 'white'],
    ['精', 'zealman-ComfyUI', 'zealman', '576', '146375h', '56058', '8T模型插件工作流+商用API接口并发', 'neon'],
    ['精', 'comfyui', 'tzwm', '63', '12163h', '4748', 'ComfyUI 整合包，支持 5090...', 'mirror'],
    ['精', 'AI-Toolkit', 'AI-Train', '133', '38641h', '8722', '图像和视频模型训练器，支持Z-Image...', 'anime'],
    ['精', 'LoRANext云端训练器', 'AI-Train', '45', '2417h', '1654', '延续秋叶训练习惯的 LoRA Next 云端训练器', 'lora'],
    ['精', 'llama-factory一键使用', 'xxxiu', '40', '8612h', '2355', '一键调用LLaMA-Factory，轻松微调', 'llama'],
    ['热', '西瓜AI', 'XIGUA-AIGC', '37', '54442h', '16850', 'comfyui', 'melon'],
  ];
  const weeklyApps = [...apps].sort((a, b) => Number(b[5]) - Number(a[5]));
  const baseApps = apps.filter((app) => ['ComfyUI云绘通用版', 'comfyui', 'llama-factory一键使用'].includes(app[1]));
  const visibleApps = isWeekly ? weeklyApps : isBase ? baseApps : isSearch ? apps.filter((app) => app.join('').toLowerCase().includes('zimage') || app.join('').toLowerCase().includes('lora')) : isTag ? apps.filter((app) => app.join('').toLowerCase().includes(activeTag.toLowerCase().replace('-', '')) || app.join('').toLowerCase().includes(activeTag.toLowerCase())) : apps;
  return (
    <div className="art-page">
      <header className="art-topbar">
        <a className="art-brand" href="/compute/app/market"><span />灵渠<em>Art</em></a>
        <div className="art-search"><button>应用⌄</button><input value={isSearch ? 'Zimage LORA' : '请输入应用名称或关键词'} readOnly /><span onClick={() => { window.location.href = '/compute/app/market/search'; }}>⌕</span></div>
        <nav><a href="/compute/art/messages">消息</a><a href="/compute/art/incentive">创作激励</a><a href="/compute/docs">帮助文档</a><a href="/compute/art/login">登录</a><button onClick={() => { window.location.href = '/compute/art/register'; }}>注册</button></nav>
      </header>
      <div className="art-subnav"><a className="active" href="/compute/app/market">▦ 应用</a><a href="/compute/app/models">⬡ 大模型</a><a href="/compute/app/images">☁ 镜像</a></div>
      <div className="art-layout">
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
          ].map((item, index) => <a className={index === 0 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-market-main">
          <h1>应用广场</h1>
          <div className="art-market-tabs"><a className={!isWeekly && !isBase ? 'active' : ''} href="/compute/app/market">全部(176)</a><i /> <a className={isWeekly ? 'active' : ''} href="/compute/app/market/weekly">周榜</a><i /> <a className={isBase ? 'active' : ''} href="/compute/app/market/base">基础镜像</a></div>
          <div className="art-tags">{tags.map((tag, index) => <button onClick={() => { window.location.href = tag === '全部' ? '/compute/app/market' : `/compute/app/market/tag/${encodeURIComponent(tag)}`; }} className={`${index % 5 === 0 ? 'orange' : index % 3 === 0 ? 'green' : index % 2 === 0 ? 'purple' : ''} ${activeTag === tag ? 'active' : ''}`} key={tag}>{tag}</button>)}</div>
          {(isSearch || isTag || isWeekly || isBase) && <div className="art-result-summary"><strong>{isWeekly ? '周榜：按下载量排序' : isBase ? '基础镜像：可直接创建实例' : isSearch ? '搜索结果：Zimage LORA' : `标签筛选：${activeTag}`}</strong><span>共找到 {visibleApps.length} 个应用</span><a href="/compute/app/market">清除筛选</a></div>}
          {isWeekly && <section className="art-rank-list">
            {visibleApps.slice(0, 6).map((app, index) => <article key={app[1]} onClick={() => { window.location.href = '/compute/app/market/77'; }}><b>{index + 1}</b><div className={`mini-cover ${app[7]}`}>{app[0]}</div><div><h2>{app[1]}</h2><p>{app[2]} · {app[6]}</p></div><span>下载 {app[5]}</span><span>运行 {app[4]}</span></article>)}
          </section>}
          {!isWeekly && <section className={`art-card-grid ${isBase ? 'base-mode' : ''}`}>
            {visibleApps.map((app) => (
              <article className="art-app-card" key={app[1]} onClick={() => { window.location.href = '/compute/app/market/77'; }}>
                <div className={`art-cover ${app[7]}`}><b>{app[0]}</b><strong>{app[1].slice(0, 18)}</strong></div>
                <h2>{app[1]}</h2>
                <p className="author"><span />{app[2]}</p>
                <div className="stats"><span>☆ {app[3]}</span><span>◷ {app[4]}</span><span>⇩ {app[5]}</span></div>
                <p className="desc">{app[6]}</p>
              </article>
            ))}
          </section>}
          {visibleApps.length === 0 && <div className="art-no-result"><strong>暂无相关应用</strong><p>换一个关键词或标签试试</p><a href="/compute/app/market">返回应用广场</a></div>}
        </main>
        <aside className="art-create-panel">
          <div className="art-create-head"><h2>创建实例</h2><a href="/compute/rent">使用非应用镜像创建</a></div>
          <div className="app-select"><button onClick={() => setPanelModal('select')}>↩ 选择一个应用</button> <i /> <a onClick={() => setPanelModal('mine')}>我的常用应用</a></div>
          <div className="form-row"><label>计费方式：</label><strong>按量计费</strong><a>更多</a></div>
          <div className="art-segments"><button className="on">按量计费</button><button>包日</button><button>包周</button><button>包月</button></div>
          <div className="form-row"><label>选择地区：</label><strong>北京B区</strong><a>更多</a></div>
          <div className="form-row block"><label>GPU型号：</label><div className="gpu-buttons"><button className="on">5090-32G <span>(146/1072)</span></button><button>4080(S)-32G <span>(14/320)</span></button><button>PRO6000-96G <span>(7/90)</span></button><button>4090D-24G <span>(4/184)</span></button></div></div>
          <div className="spec-mini"><div><span>规格</span><span>vCPU(核)</span><span>内存(GB)</span><span>单价(每GPU)</span></div><p><i />性能型 <b>16~30</b><b>80~100</b><em>￥-.-- /日</em></p></div>
          <div className="form-row block"><label>GPU数量：</label><div className="art-counts"><button className="on">1</button><button>2</button><button>3</button><button>4</button></div></div>
          <div className="disk-line-art">系统盘：基础容量 30 GB <label><i /> 扩容</label><em>￥-.--/日</em><small>(镜像占用：0B　空闲：30.00GB)</small></div>
          <div className="art-cost"><span>日常费用:<b>￥-.--/日</b></span><span>配置费用:<b>￥-.--/时</b> <a onClick={() => setPanelModal('cost')}>费用明细</a></span><small>账户余额 ￥0.00</small></div>
          <div className="art-submit"><label>创建实例数量</label><input value="1" readOnly /><button onClick={() => { window.location.href = '/compute/rent'; }}>创建并开机</button></div>
          <ol><li>实例30GB基础容量将按￥0.1/日计费</li><li>系统盘费用无论是否开机运行，只要实例在即计费</li><li>扩容后受限于文件系统特性</li></ol>
          <label className="art-agree"><input type="checkbox" checked readOnly /> 我已阅读并同意 <a>《应用计费及数据保留相关规则》</a></label>
        </aside>
      </div>
      {detailOpen && <ArtAppDetail />}
      {panelModal && <ArtCreatePanelModal type={panelModal} onClose={() => setPanelModal('')} />}
    </div>
  );
}

function ArtCreatePanelModal({ type, onClose }: { type: 'select' | 'mine' | 'cost'; onClose: () => void }) {
  const appRows = [
    ['Zimage-Wan-Ltx2.3-训练器', 'zealman', 'AI-Toolkit / LORA', '13574h'],
    ['ComfyUI云绘通用版', 'nahz202', 'ComfyUI / 工作流', '52637h'],
    ['AI-Toolkit', 'AI-Train', '训练 / Z-Image', '38641h'],
  ];
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
              {appRows.map((row, index) => <article className={index === 0 ? 'active' : ''} key={row[0]}><b>{index === 0 ? '精' : '热'}</b><div><h3>{row[0]}</h3><p>{row[1]} · {row[2]}</p><span>运行时长 {row[3]}</span></div><button>选择</button></article>)}
            </div>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>{isCost ? '知道了' : '确认选择'}</button></footer>
      </section>
    </div>
  );
}

function ArtAppDetail() {
  const [reviewOpen, setReviewOpen] = useState(false);
  const versionRows = [
    ['v6', '2026-04-06', '更新到2026年4月最新版本，优化 Z-Image 与 Wan2.2 LoRA 训练脚本', '当前版本'],
    ['v5', '2026-03-18', '新增 WebUI-6008 辅助面板，修复启动脚本依赖检查', '可创建'],
    ['v4', '2026-02-26', '升级基础镜像 CUDA 版本，内置常用训练模板', '历史版本'],
  ];
  const reviews = [
    ['nahz202', '★★★★★', '5090 上启动很快，WebUI-6006 入口清晰，训练模板比较完整。', '2026-05-18'],
    ['AI-Train', '★★★★☆', '适合快速跑 Z-Image LoRA，建议再补一份数据集目录说明。', '2026-05-16'],
    ['zzdh', '★★★★★', '镜像里依赖比较全，创建实例后按说明能直接开始训练。', '2026-05-12'],
  ];
  return (
    <div className="art-detail-mask">
      <section className="art-detail-modal">
        <aside className="art-detail-side">
          <div className="detail-cover"><strong>Z-iMAGE<br />Wan2.2 Ltx2.3</strong><span>LORA TRAIN</span></div>
          <p>更新到2026年4月最新版本</p>
          <div className="detail-stats"><span>☆ 121</span><span>◷ 13574h</span><span>⇩ 5343</span></div>
          <h3>开发者</h3><p className="avatar-line"><i />zealman</p>
          <h3>应用分类</h3><div className="detail-tags"><span>AI-Toolkit</span><span>训练</span><span>LORA</span><span>Z-Image</span></div>
          <h3>更新时间</h3><p>2026-04-06 13:42:48</p>
          <h3>应用版本</h3><div className="detail-select">v6 <span>⌄</span></div>
          <h3>应用ID</h3><p>YrhEqUKpQo:v6 ⧉</p>
          <h3>开机启动命令</h3><p>bash /root/start-aitoolkitui.sh ⧉</p>
          <div className="detail-actions"><button>分享应用</button><button>部署应用</button></div>
        </aside>
        <main className="art-detail-main">
          <button className="detail-close" onClick={() => { window.location.href = '/compute/app/market'; }}>×</button>
          <h1>Zimage-Wan-Ltx2.3-训练器</h1>
          <div className="detail-service-box">
            <p>开机后稍等片刻，等程序自动运行后，点击WebUI-6006即可打开训练界面</p>
            <div className="service-row"><h3>访问实例</h3><span>JupyterLab</span><span>AutoPanel</span><span>SSH</span></div>
            <div className="service-row"><h3>访问应用服务</h3><span>WebUI-6006</span><span>WebUI-6008</span></div>
          </div>
          <section className="detail-doc">
            <p>作者使用的打标工具下载</p>
            <p>链接:<a>https://pan.quark.cn/s/1284fb542ccd?pwd=cuJc</a></p>
            <p>提取码: cuJc</p>
            <p>本镜像支持所有常见类型<strong>LORA</strong>训练，有问题可以加Q群<strong>1046279436</strong></p>
            <p>下面是视频流程</p>
            <div className="detail-video"><span>bilibili · 5分钟跑通Z-image训练器</span></div>
          </section>
          <section className="detail-version-section">
            <h2>版本历史</h2>
            <div className="detail-version-table">
              <div className="head"><span>版本</span><span>更新时间</span><span>说明</span><span>状态</span></div>
              {versionRows.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 3 ? 'state' : ''} key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="detail-review-section">
            <div className="review-summary">
              <strong>4.8</strong>
              <span>★★★★★</span>
              <p>基于 121 次收藏和近期使用反馈</p>
            </div>
            <div className="review-list">
              <div className="review-list-head"><h2>用户评价</h2><button onClick={() => setReviewOpen(true)}>写评价</button></div>
              {reviews.map((row) => <article key={row[0]}><b>{row[0].slice(0, 1)}</b><div><h3>{row[0]} <span>{row[1]}</span></h3><p>{row[2]}</p><time>{row[3]}</time></div></article>)}
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
        <nav><a href="/compute/art/messages">消息</a><a href="/compute/art/incentive">创作激励</a><a href="/compute/docs">帮助文档</a><a href="/compute/art/login">登录</a><button onClick={() => { window.location.href = '/compute/art/register'; }}>注册</button></nav>
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
            <p>该入口已按应用市场导航关系接入，后续继续逐页像素级补齐。</p>
            <a href="/compute/app/market">返回应用广场</a>
          </div>
        </main>
      </div>
    </div>
  );
}

function ArtProfilePage() {
  const securityRows = [
    ['登录密码', '已设置', '上次修改 2026-05-12', '修改'],
    ['手机绑定', '177****7953', '用于登录、找回密码和安全验证', '修改'],
    ['微信绑定', '已绑定', '支持扫码登录和服务通知', '解绑'],
    ['实名认证', '个人认证通过', '可使用应用实例与模型 API', '查看'],
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
              <h2>17717677953</h2>
              <p>灵渠 Art 合作商账号 · UID 416943 · 北京B区默认资源池</p>
              <div><span>个人认证</span><span>炼丹会员</span><span>API 已开通</span></div>
            </div>
            <aside><span>账户余额</span><strong>￥0.00</strong><button onClick={() => { window.location.href = '/compute/app/billing'; }}>充值</button></aside>
          </section>
          <div className="profile-grid">
            <section className="profile-card">
              <h2>基本资料</h2>
              <label><span>昵称</span><input value="灵渠合作商" readOnly /></label>
              <label><span>公司/团队</span><input value="A9Quant Compute" readOnly /></label>
              <label><span>默认区域</span><input value="北京B区" readOnly /></label>
              <label><span>联系邮箱</span><input value="admin@lingqu.local" readOnly /></label>
            </section>
            <section className="profile-card">
              <h2>通知偏好</h2>
              {['实例开关机结果', '余额不足提醒', '账单出账通知', '应用审核进度'].map((item) => <label className="profile-check" key={item}><input type="checkbox" checked readOnly /> {item}</label>)}
              <div className="profile-channel"><button className="active">站内信</button><button className="active">短信</button><button>邮件</button><button>企业微信</button></div>
            </section>
          </div>
          <section className="profile-card">
            <div className="profile-section-title"><h2>安全与认证</h2><a href="/compute/account/security">进入主账号安全中心</a></div>
            <div className="profile-security-table">
              <div className="head"><span>项目</span><span>状态</span><span>说明</span><span>操作</span></div>
              {securityRows.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 3 ? 'link' : ''} key={cell}>{cell}</span>)}</div>)}
            </div>
          </section>
          <section className="profile-api-card">
            <article><span>API Key</span><strong>2 个</strong><p>模型调用与弹性部署共用权限</p></article>
            <article><span>子账号</span><strong>3 个</strong><p>可限制实例、账单和镜像操作范围</p></article>
            <article><span>安全白名单</span><strong>0.0.0.0/0</strong><p>后续接入接口后支持按 IP 段限制</p></article>
          </section>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtMessagesPage() {
  const path = window.location.pathname;
  const active = path.includes('/billing') ? 'billing' : path.includes('/instance') ? 'instance' : path.includes('/system') ? 'system' : 'all';
  const rows = [
    ['系统公告', '五一期间 GPU 调度策略更新', '平台将优先保障已预约实例和包日实例的资源调度。', '2026-05-20 08:30', 'system', '未读'],
    ['实例事件', 'Zimage-Wan-Ltx2.3-训练器余额不足', '账户余额为0，开机会进入预付检查，请先充值。', '2026-05-19 16:22', 'instance', '未读'],
    ['账单提醒', '本月应用实例消费已出账', '实例、系统盘和镜像存储费用已生成明细。', '2026-05-18 23:10', 'billing', '已读'],
    ['系统公告', '镜像市场发布审核规则更新', '新增应用需声明服务端口、启动命令和基础镜像来源。', '2026-05-18 10:00', 'system', '已读'],
  ];
  const visibleRows = rows.filter((row) => active === 'all' || row[4] === active);
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
            <div><button>全部标为已读</button><button>消息设置</button></div>
          </div>
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
                <article className={index === 0 ? 'active' : ''} key={row[1]}>
                  <b className={row[5] === '未读' ? 'unread' : ''}>{row[0]}</b>
                  <div><h2>{row[1]}</h2><p>{row[2]}</p></div>
                  <time>{row[3]}</time>
                  <span>{row[5]}</span>
                </article>
              ))}
            </section>
            <aside className="message-detail">
              <span>系统公告</span>
              <h2>{visibleRows[0]?.[1] ?? '暂无消息'}</h2>
              <time>{visibleRows[0]?.[3] ?? ''}</time>
              <p>{visibleRows[0]?.[2] ?? '当前筛选条件下没有消息。'}</p>
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
  return (
    <div className="art-page">
      <header className="art-topbar">
        <a className="art-brand" href="/compute/app/market"><span />灵渠<em>Art</em></a>
        <div className="art-search"><button>应用⌄</button><input value="请输入应用名称或关键词" readOnly /><span>⌕</span></div>
        <nav><a href="/compute/art/messages">消息</a><a href="/compute/art/incentive">创作激励</a><a href="/compute/docs">帮助文档</a><a className={!isRegister ? 'active' : ''} href="/compute/art/login">登录</a><button onClick={() => { window.location.href = '/compute/art/register'; }}>注册</button></nav>
      </header>
      <div className="art-auth-wrap">
        <section className="art-auth-panel">
          <div className="art-auth-copy">
            <h1>{isRegister ? '注册灵渠 Art' : '登录灵渠 Art'}</h1>
            <p>进入应用市场、实例管理、钱包账单和模型 API 控制台。</p>
            <div>
              <span>应用实例</span><span>公共模型</span><span>镜像市场</span><span>费用中心</span>
            </div>
          </div>
          <form className="art-auth-form">
            <h2>{isRegister ? '创建账号' : '账号登录'}</h2>
            <label><span>手机号</span><input value="17717677953" readOnly /></label>
            {isRegister && <label className="code-row"><span>验证码</span><div><input value="123456" readOnly /><button type="button">获取验证码</button></div></label>}
            <label><span>密码</span><input type="password" value="123abcDe" readOnly /></label>
            {isRegister && <label><span>邀请码</span><input value="LINGQU-AUTO" readOnly /></label>}
            {!isRegister && <div className="auth-options"><label><input type="checkbox" checked readOnly /> 记住登录状态</label><a>忘记密码</a></div>}
            {isRegister && <label className="auth-agree"><input type="checkbox" checked readOnly /> 我已阅读并同意《用户服务协议》和《隐私政策》</label>}
            <button className="auth-submit" type="button" onClick={() => { window.location.href = '/compute/app/market'; }}>{isRegister ? '注册并进入控制台' : '登录'}</button>
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
  const usageRows = [
    ['DeepSeek-V4-Pro', '128,420', '￥154.10', '1,286', '99.96%'],
    ['Kimi-K2.6', '62,180', '￥45.82', '592', '99.91%'],
    ['Qwen-Image', '2,406次', '￥360.90', '214', '99.88%'],
  ];
  const tokenRows = [
    ['prod-chat-agent', 'sk-****-9f28', '全部模型', '2026-05-18 15:24:12', '启用'],
    ['image-workflow', 'sk-****-81ac', '生图/视频', '2026-05-12 09:10:05', '启用'],
    ['test-local', 'sk-****-44de', '对话模型', '2026-04-30 20:43:18', '停用'],
  ];
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
                {[
                  ['今日调用量', '191,428', '+12.6%'],
                  ['今日费用', '￥560.82', '较昨日 +8.4%'],
                  ['失败请求', '72', '错误率 0.04%'],
                  ['活跃令牌', '12', '3 个项目'],
                ].map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
              </section>
              <section className="art-admin-chart"><div><i /><i /><i /><i /><i /><i /><i /></div><aside><b>峰值 32,840</b><span>18:00 - 19:00</span><p>按小时统计模型调用、消耗 token 和错误率，后续接入真实用量接口。</p></aside></section>
              <ArtAdminTable heads={['模型', 'Token 用量', '费用', '请求数', '成功率']} rows={usageRows} />
            </>
          )}
          {kind === 'tokens' && (
            <>
              <div className="art-admin-filter"><button className="active">全部令牌</button><button>启用</button><button>停用</button><label>搜索<input value="" readOnly placeholder="令牌名称" /></label></div>
              <ArtAdminTable heads={['名称', '密钥', '权限范围', '创建时间', '状态']} rows={tokenRows} />
              <section className="art-token-guide"><h2>调用示例</h2><pre>{`curl https://api.lingqu.art/v1/chat/completions \\\n  -H "Authorization: Bearer sk-****" \\\n  -d '{"model":"DeepSeek-V4-Pro","messages":[{"role":"user","content":"hi"}]}'`}</pre></section>
            </>
          )}
          {kind === 'settings' && (
            <section className="art-settings-form">
              {[
                ['默认模型', 'DeepSeek-V4-Pro', '用于控制台试算和 API 示例的默认模型'],
                ['费用预警', '￥500.00 / 日', '达到阈值后通过站内信和短信提醒'],
                ['并发限制', '自动弹性', '按账号等级和模型供应策略动态调整'],
                ['回调地址', 'https://example.com/model/callback', '模型异步任务完成后推送结果'],
              ].map((row) => <label key={row[0]}><span>{row[0]}</span><input value={row[1]} readOnly /><small>{row[2]}</small></label>)}
              <div className="art-setting-switches"><label><input type="checkbox" checked readOnly /> 开启用量日报</label><label><input type="checkbox" checked readOnly /> 失败请求自动重试</label><label><input type="checkbox" readOnly /> 仅允许白名单 IP</label></div>
            </section>
          )}
        </main>
      </div>
      {modal && <ArtModelAdminModal type={modal} onClose={() => setModal('')} />}
    </ArtShell>
  );
}

function ArtModelAdminModal({ type, onClose }: { type: 'export' | 'token' | 'save'; onClose: () => void }) {
  const isToken = type === 'token';
  const isExport = type === 'export';
  return (
    <div className="art-action-mask">
      <section className="art-model-admin-modal">
        <header><h2>{isToken ? '创建令牌' : isExport ? '导出报表' : '保存设置'}</h2><button onClick={onClose}>×</button></header>
        {isToken && (
          <div className="model-admin-form">
            <label><span>令牌名称</span><input value="prod-chat-agent" readOnly /></label>
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
            <p>导出任务生成后可在浏览器下载，后续接入接口后返回真实文件地址。</p>
          </div>
        )}
        {type === 'save' && (
          <div className="model-save-body">
            <span>✓</span>
            <div><h3>设置已保存</h3><p>默认模型、费用预警、并发限制和回调地址已保存到当前账号配置。</p></div>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>{isToken ? '创建' : isExport ? '导出' : '完成'}</button></footer>
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
  const path = window.location.pathname;
  const active = path.includes('/orders') ? 'invoice' : path.includes('/detail') ? 'detail' : 'wallet';
  const rows = active === 'wallet'
    ? [
        ['2026-05-18 16:22:10', '充值', '余额充值', '微信支付', '+￥500.00', '￥500.00', '充值成功'],
        ['2026-05-18 15:40:02', '支出', '应用实例', '余额', '-￥18.42', '￥0.00', 'Zimage-Wan-Ltx2.3-训练器'],
        ['2026-05-17 20:12:46', '支出', '镜像存储', '余额', '-￥3.20', '￥18.42', '系统盘扩容'],
      ]
    : active === 'detail'
      ? [
          ['202605180001', '应用实例', 'Zimage-Wan-Ltx2.3-训练器', 'RTX 5090-32G', '13.2h', '￥18.42', '已出账'],
          ['202605170028', '应用实例', 'ComfyUI云绘通用版', 'RTX 4090D-24G', '24h', '￥32.00', '已出账'],
          ['202605160019', '系统盘', 'AI-Toolkit', '扩容 80GB', '1天', '￥3.20', '已出账'],
        ]
      : [
          ['FP202605180001', '2026-05-18', '个人普通发票', '算力服务费', '￥500.00', '待开票', '申请开票'],
          ['FP202605120006', '2026-05-12', '企业专票', '技术服务费', '￥1,280.00', '已开票', '下载'],
          ['FP202604300014', '2026-04-30', '个人普通发票', '算力服务费', '￥268.40', '已开票', '下载'],
        ];
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
            <article><span>可用余额</span><strong>￥0.00</strong><button onClick={() => setModal('recharge')}>充值</button></article>
            <article><span>冻结金额</span><strong>￥0.00</strong><small>实例创建预授权</small></article>
            <article><span>本月消费</span><strong>￥53.62</strong><small>应用实例与存储</small></article>
            <article><span>可开票金额</span><strong>￥500.00</strong><small>已完成订单</small></article>
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
      {modal === 'recharge' && <ArtRechargeModal onClose={() => setModal('')} />}
      {modal === 'invoice' && <ArtInvoiceModal onClose={() => setModal('')} />}
    </ArtShell>
  );
}

function ArtRechargeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="art-action-mask">
      <section className="art-pay-modal">
        <header><h2>账户充值</h2><button onClick={onClose}>×</button></header>
        <div className="pay-body">
          <label><span>充值金额</span><div className="pay-amounts">{['100', '500', '1000', '2000'].map((item, index) => <button className={index === 1 ? 'active' : ''} key={item}>￥{item}</button>)}</div></label>
          <label><span>支付方式</span><div className="pay-methods"><button className="active">微信支付</button><button>支付宝</button><button>企业转账</button></div></label>
          <div className="pay-summary"><span>到账金额</span><strong>￥500.00</strong><small>充值完成后余额实时更新，可用于应用实例、模型调用和存储费用。</small></div>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>确认充值</button></footer>
      </section>
    </div>
  );
}

function ArtInvoiceModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="art-action-mask">
      <section className="art-pay-modal invoice">
        <header><h2>申请开票</h2><button onClick={onClose}>×</button></header>
        <div className="invoice-body">
          <label><span>开票金额</span><input value="￥500.00" readOnly /></label>
          <label><span>发票类型</span><div className="pay-methods"><button className="active">个人普通发票</button><button>企业专票</button></div></label>
          <label><span>发票抬头</span><input value="灵渠用户" readOnly /></label>
          <label><span>开票内容</span><input value="算力服务费" readOnly /></label>
          <label><span>接收邮箱</span><input value="finance@example.com" readOnly /></label>
          <p>提交后将在 1-3 个工作日内处理，电子发票将发送至接收邮箱。</p>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>提交申请</button></footer>
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
  const activeTab = path.includes('/favorites') ? 'favorites' : path.includes('/recent') ? 'recent' : path.includes('/drafts') ? 'drafts' : 'mine';
  const apps = [
    ['Zimage-Wan-Ltx2.3-训练器', 'zealman', 'v6', '2026-04-06 13:42:48', '管理', 'AI-Toolkit / LORA'],
    ['ComfyUI云绘通用版', 'nahz202', 'v18', '2026-03-28 09:12:06', '管理', 'ComfyUI / 工作流'],
    ['AI-Toolkit', 'AI-Train', 'v4', '2026-02-19 18:30:11', '管理', '训练 / Z-Image'],
  ];
  const favoriteApps = [
    ['Zimage-Wan-Ltx2.3-训练器', 'zealman', 'v6', '2026-04-06 13:42:48', '查看', 'AI-Toolkit / LORA'],
    ['LoRANext云端训练器', 'AI-Train', 'v3', '2026-03-03 17:36:02', '查看', 'LoRA Next / 训练'],
  ];
  const recentApps = [
    ['ComfyUI云绘通用版', 'nahz202', 'v18', '2026-05-19 10:16:44', '继续使用', 'ComfyUI / 工作流'],
    ['AI-Toolkit', 'AI-Train', 'v4', '2026-05-18 22:41:09', '继续使用', '训练 / Z-Image'],
  ];
  const visibleApps = activeTab === 'favorites' ? favoriteApps : activeTab === 'recent' ? recentApps : activeTab === 'drafts' ? [] : apps;
  const tabMeta: Record<string, [string, string]> = {
    mine: ['我的应用', '共 3 个已发布应用'],
    favorites: ['收藏应用', '共 2 个收藏应用'],
    recent: ['最近使用', '最近 7 天使用过 2 个应用'],
    drafts: ['草稿箱', '暂无草稿'],
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
          <div className="art-user-tabs">
            <a className={activeTab === 'mine' ? 'active' : ''} href="/compute/app/mine">我的应用</a>
            <a className={activeTab === 'favorites' ? 'active' : ''} href="/compute/app/mine/favorites">收藏应用</a>
            <a className={activeTab === 'recent' ? 'active' : ''} href="/compute/app/mine/recent">最近使用</a>
            <a className={activeTab === 'drafts' ? 'active' : ''} href="/compute/app/mine/drafts">草稿箱</a>
            <span>{tabMeta[activeTab][1]}</span>
          </div>
          {visibleApps.length > 0 && <section className="art-mine-grid">
            {visibleApps.map((app, index) => (
              <article key={app[0]}>
                <div className={`art-mine-cover tone-${index}`}><b>{index === 1 ? '热' : '精'}</b><strong>{app[0]}</strong></div>
                <h2>{app[0]}</h2>
                <p><span />{app[1]}</p>
                <div><em>{app[2]}</em><small>{app[5]}</small></div>
                <footer><span>{app[3]}</span><button onClick={() => { window.location.href = activeTab === 'mine' ? '/compute/app/mine/detail' : '/compute/app/market/77'; }}>{app[4]}</button></footer>
              </article>
            ))}
          </section>}
          {visibleApps.length === 0 && <div className="art-mine-empty"><strong>{tabMeta[activeTab][0]}</strong><p>当前没有可展示的应用，创建或收藏应用后会显示在这里。</p><button onClick={() => { window.location.href = '/compute/app/create'; }}>创建应用</button></div>}
          <div className="art-user-note">当前为「{tabMeta[activeTab][0]}」列表，后续接入接口后同步收藏、发布和使用记录。</div>
        </main>
      </div>
    </ArtShell>
  );
}

function ArtMineDetailPage() {
  const [manageModal, setManageModal] = useState<'version' | 'edit' | ''>('');
  const versions = [
    ['v6', '已发布', '2026-04-06 13:42:48', 'YrhEqUKpQo:v6'],
    ['v5', '已下架', '2026-03-18 11:24:10', 'YrhEqUKpQo:v5'],
    ['v7', '审核中', '2026-05-19 09:20:32', 'YrhEqUKpQo:v7'],
  ];
  const services = [
    ['JupyterLab', '8888', '系统服务', '可访问'],
    ['WebUI-6006', '6006', '应用服务', '可访问'],
    ['WebUI-6008', '6008', '应用服务', '可访问'],
  ];
  const auditChecks = [
    ['基础信息完整', '通过', '名称、简介、分类、封面均已填写'],
    ['镜像安全扫描', '通过', '未发现高危漏洞和异常启动脚本'],
    ['服务端口声明', '通过', 'WebUI-6006 / WebUI-6008 已声明'],
    ['应用说明规范', '待人工复核', '需确认外链资料和用户群信息'],
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
        <main className="art-app-manage-main">
          <div className="art-user-head">
            <h1>Zimage-Wan-Ltx2.3-训练器</h1>
            <div><button onClick={() => setManageModal('version')}>发布新版本</button><button onClick={() => setManageModal('edit')}>编辑应用</button><button onClick={() => { window.location.href = '/compute/app/mine'; }}>返回</button></div>
          </div>
          <section className="app-manage-hero">
            <div className="preview-cover"><b>精</b><strong>Zimage-Wan-Ltx2.3-训练器</strong></div>
            <div>
              <span className="review-state">已发布</span>
              <h2>Zimage-Wan-Ltx2.3-训练器</h2>
              <p>更新到2026年4月最新版本，支持 Z-Image 与 Wan2.2 LoRA 训练。</p>
              <div><em>AI-Toolkit</em><em>训练</em><em>LORA</em><em>Z-Image</em></div>
            </div>
            <aside><strong>本周运行</strong><b>13,574h</b><small>下载 5,343 · 收藏 121</small></aside>
          </section>
          <div className="app-manage-layout">
            <section className="app-manage-card">
              <h2>版本管理</h2>
              <div className="app-version-table">
                <div className="head"><span>版本</span><span>状态</span><span>更新时间</span><span>应用ID</span><span>操作</span></div>
                {versions.map((row) => <div className="row" key={row[0]}>{row.map((cell, index) => <span className={index === 1 ? `status ${cell === '审核中' ? 'pending' : cell === '已下架' ? 'offline' : ''}` : ''} key={cell}>{cell}</span>)}<span><a>查看</a><a>复制</a></span></div>)}
              </div>
            </section>
            <section className="app-manage-card">
              <h2>服务端口</h2>
              <div className="app-service-table">
                <div className="head"><span>服务</span><span>端口</span><span>类型</span><span>状态</span></div>
                {services.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
              </div>
            </section>
            <section className="app-manage-card wide">
              <div className="profile-section-title"><h2>审核中心</h2><a>查看审核规范</a></div>
              <div className="audit-check-grid">
                {auditChecks.map((row) => <article key={row[0]}><span>{row[0]}</span><strong className={row[1] === '待人工复核' ? 'pending' : ''}>{row[1]}</strong><p>{row[2]}</p></article>)}
              </div>
              <div className="review-timeline">
                <p><b>2026-05-19 09:20</b><span>v7 提交审核，等待平台审核应用说明和镜像内容。</span></p>
                <p><b>2026-04-06 13:42</b><span>v6 审核通过并发布到应用广场。</span></p>
                <p><b>2026-03-18 11:24</b><span>v5 主动下架，保留历史版本记录。</span></p>
              </div>
            </section>
          </div>
        </main>
      </div>
      {manageModal && <ArtManageAppModal type={manageModal} onClose={() => setManageModal('')} />}
    </ArtShell>
  );
}

function ArtManageAppModal({ type, onClose }: { type: 'version' | 'edit'; onClose: () => void }) {
  const isVersion = type === 'version';
  return (
    <div className="art-action-mask">
      <section className="art-manage-modal">
        <header><h2>{isVersion ? '发布新版本' : '编辑应用信息'}</h2><button onClick={onClose}>×</button></header>
        {isVersion ? (
          <div className="manage-version-body">
            <label><span>版本号</span><input value="v7" readOnly /></label>
            <label><span>基础镜像</span><input value="image-aikit-zimage-wan-ltx23:v7" readOnly /></label>
            <label><span>启动命令</span><input value="bash /root/start-aitoolkitui.sh" readOnly /></label>
            <label><span>更新说明</span><textarea value="更新 Z-Image 训练脚本，补充 Wan2.2 Ltx2.3 示例配置，优化 WebUI-6006 启动速度。" readOnly /></label>
            <div className="manage-audit-preview">
              <strong>提交前检查</strong>
              <p><span>镜像扫描通过</span><span>端口配置完整</span><span>保留回滚版本</span></p>
            </div>
            <div className="manage-checks"><label><input type="checkbox" checked readOnly /> 保留 v6 作为可回滚版本</label><label><input type="checkbox" checked readOnly /> 提交后进入审核队列</label></div>
          </div>
        ) : (
          <div className="manage-version-body">
            <label><span>应用名称</span><input value="Zimage-Wan-Ltx2.3-训练器" readOnly /></label>
            <label><span>一句话介绍</span><input value="更新到2026年4月最新版本，支持 Z-Image 与 Wan2.2 LoRA 训练" readOnly /></label>
            <label><span>应用分类</span><div className="manage-tags"><em>AI-Toolkit</em><em>训练</em><em>LORA</em><em>Z-Image</em><button>添加</button></div></label>
            <label><span>应用说明</span><textarea value="内置训练脚本、依赖环境、WebUI 服务和示例配置，适合快速创建训练实例并复现工作流。" readOnly /></label>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>{isVersion ? '提交审核' : '保存修改'}</button></footer>
      </section>
    </div>
  );
}

function ArtCreatePage() {
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
            <div><button>保存草稿</button><button onClick={() => { window.location.href = '/compute/app/mine'; }}>取消</button></div>
          </div>
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
              <button>提交审核</button>
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
  const path = window.location.pathname;
  const filter = path.includes('/running') ? 'running' : path.includes('/pending') ? 'pending' : path.includes('/stopped') ? 'stopped' : 'all';
  const rows = [
    ['Zimage-Wan-Ltx2.3-训练器', 'RTX 5090-32G', '北京B区', '1卡', '按量计费', '未开机', '￥-.--/时'],
    ['ComfyUI云绘通用版', 'RTX 4090D-24G', '北京B区', '1卡', '包日', '运行中', '￥-.--/日'],
    ['AI-Toolkit', 'RTX 4080S-32G', '内蒙A区', '2卡', '按量计费', '已停止', '￥-.--/时'],
  ];
  const visibleRows = rows.filter((row) => filter === 'all' ? true : filter === 'running' ? row[5] === '运行中' : filter === 'pending' ? row[5] === '未开机' : row[5] === '已停止');
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
          <div className="art-instance-filter">
            <a className={filter === 'all' ? 'active' : ''} href="/compute/app/instances">全部</a><a className={filter === 'running' ? 'active' : ''} href="/compute/app/instances/running">运行中</a><a className={filter === 'pending' ? 'active' : ''} href="/compute/app/instances/pending">未开机</a><a className={filter === 'stopped' ? 'active' : ''} href="/compute/app/instances/stopped">已停止</a>
            <label>实例名称<input value="" readOnly placeholder="搜索实例/应用名称" /></label>
          </div>
          <div className="art-instance-table">
            <div className="head"><span><input type="checkbox" checked readOnly /></span><span>应用名称</span><span>GPU型号</span><span>地区</span><span>数量</span><span>计费方式</span><span>状态</span><span>费用</span><span>操作</span></div>
            {visibleRows.map((row, index) => (
              <div className="row" key={row[0]}>
                <span><input type="checkbox" checked={index < 2} readOnly /></span>
                {row.map((cell, index) => <span className={index === 5 ? `state ${cell === '运行中' ? 'running' : cell === '已停止' ? 'stopped' : ''}` : ''} key={cell}>{cell}</span>)}
                <span><a onClick={() => setAction('boot')}>开机</a><a onClick={() => setAction('stop')}>关机</a><a href="/compute/app/instances/detail">详情</a><a onClick={() => setAction('rename')}>改名</a><a onClick={() => setAction('recharge')}>续费</a><a onClick={() => setAction('clone')}>复制</a><a onClick={() => setAction('delete')}>删除</a></span>
              </div>
            ))}
          </div>
          {visibleRows.length === 0 && <div className="art-instance-empty"><strong>暂无实例</strong><p>当前筛选条件下没有应用实例。</p><button onClick={() => { window.location.href = '/compute/app/instances/create'; }}>创建实例</button></div>}
          <div className="art-user-note">当前筛选：{filter === 'all' ? '全部' : filter === 'running' ? '运行中' : filter === 'pending' ? '未开机' : '已停止'}，共 {visibleRows.length} 个实例。</div>
        </main>
      </div>
      {action === 'boot' && <ArtInstanceActionModal type="boot" onClose={() => setAction('')} />}
      {action === 'stop' && <ArtInstanceActionModal type="stop" onClose={() => setAction('')} />}
      {action === 'rename' && <ArtInstanceActionModal type="rename" onClose={() => setAction('')} />}
      {action === 'recharge' && <ArtInstanceActionModal type="recharge" onClose={() => setAction('')} />}
      {action === 'clone' && <ArtInstanceActionModal type="clone" onClose={() => setAction('')} />}
      {action === 'delete' && <ArtInstanceActionModal type="delete" onClose={() => setAction('')} />}
      {action === 'batch' && <ArtBatchActionModal onClose={() => setAction('')} />}
    </ArtShell>
  );
}

function ArtInstanceCreatePage() {
  const specs = [
    ['RTX 5090-32G', '北京B区', '146 / 1072', '16核 80GB', '￥-.-- / 日'],
    ['RTX 4090D-24G', '北京B区', '4 / 184', '14核 60GB', '￥-.-- / 日'],
    ['RTX 4080S-32G', '内蒙A区', '14 / 320', '12核 48GB', '￥-.-- / 日'],
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
                <div className="selected-app-cover">精</div>
                <div>
                  <h3>Zimage-Wan-Ltx2.3-训练器</h3>
                  <p>zealman · 更新到2026年4月最新版本，支持 Z-Image 与 Wan2.2 LoRA 训练</p>
                </div>
                <a href="/compute/app/market">更换应用</a>
              </div>
              <h2>计费方式</h2>
              <div className="instance-create-segments"><button className="active">按量计费</button><button>包日</button><button>包周</button><button>包月</button></div>
              <h2>选择算力</h2>
              <div className="instance-spec-list">
                {specs.map((item, index) => (
                  <label className={index === 0 ? 'active' : ''} key={item[0]}>
                    <input type="radio" checked={index === 0} readOnly />
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
                <label><span>实例名称</span><input value="ins-art-zimage-20260519" readOnly /></label>
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
              <button onClick={() => { window.location.href = '/compute/app/instances/detail'; }}>创建并开机</button>
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
  const files = [
    ['folder', 'datasets', '目录', '2026-05-18 15:42'],
    ['folder', 'outputs', '目录', '2026-05-18 16:10'],
    ['file', 'train_lora.sh', '4.2 KB', '2026-05-18 15:43'],
    ['file', 'config-zimage.yaml', '2.8 KB', '2026-05-18 15:45'],
    ['file', 'last-run.log', '18.6 KB', '2026-05-18 16:22'],
  ];
  const logs = [
    '[16:20:12] checking container status: stopped',
    '[16:20:14] mount /root/autodl-tmp ready',
    '[16:20:16] WebUI-6006 waiting for instance boot',
    '[16:20:18] balance precheck required before GPU allocation',
  ];
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
            <div><button>重连终端</button><button onClick={() => { window.location.href = '/compute/app/instances/detail'; }}>返回详情</button></div>
          </div>
          <section className="workspace-status">
            <article><span>实例</span><strong>ins-art-zimage-20260518</strong><p>未开机 · 北京B区 · RTX 5090-32G</p></article>
            <article><span>服务</span><strong>WebUI-6006</strong><p>等待开机后自动生成访问地址</p></article>
            <article><span>数据目录</span><strong>/root/autodl-tmp</strong><p>50GB 临时数据盘</p></article>
          </section>
          <div className="workspace-grid">
            <section className="workspace-terminal">
              <div className="workspace-title"><h2>SSH 终端</h2><span>只读预览</span></div>
              <pre>{['root@autodl-container:~# pwd','/root','root@autodl-container:~# nvidia-smi','No running GPU process. Instance is stopped.','root@autodl-container:~# bash /root/start-aitoolkitui.sh','waiting for boot confirmation ...'].join('\n')}</pre>
              <div><input value="bash /root/start-aitoolkitui.sh" readOnly /><button>发送</button></div>
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
  const metrics = [
    ['GPU利用率', '0%', '未开机'],
    ['显存占用', '0 / 32GB', '等待启动'],
    ['运行时长', '13.2h', '本月累计'],
    ['当前费用', '￥18.42', '按量计费'],
  ];
  const logs = [
    '[13:40:12] instance created from app Zimage-Wan-Ltx2.3',
    '[13:40:18] image image-aikit-zimage-wan-ltx23:v6 mounted',
    '[13:41:03] waiting for WebUI-6006 service',
    '[13:41:40] instance stopped by user',
  ];
  const services = [
    ['JupyterLab', '8888', '系统服务', '未开机', '打开'],
    ['AutoPanel', '6008', '管理面板', '未开机', '打开'],
    ['SSH', '22', '远程终端', '未开机', '复制命令'],
    ['WebUI-6006', '6006', '应用服务', '未开机', '打开'],
    ['WebUI-6008', '6008', '应用服务', '未开机', '打开'],
  ];
  const bills = [
    ['2026-05-18 15:40:02', '创建实例', '系统盘 30GB', '￥0.10/日', '已计费'],
    ['2026-05-18 15:41:40', '关机', '按量 GPU 费用停止', '￥0.00', '已完成'],
    ['2026-05-18 16:22:12', '余额检查', '账户余额不足提醒', '￥0.00', '待充值'],
  ];
  const events = [
    ['2026-05-18 16:22:12', '余额不足提醒', '系统', '账户余额为0，开机会进入预付检查', 'warning'],
    ['2026-05-18 15:41:40', '实例关机', '用户操作', '停止 GPU 计费，保留系统盘与应用配置', 'done'],
    ['2026-05-18 15:40:18', '镜像挂载完成', '调度系统', 'image-aikit-zimage-wan-ltx23:v6 已挂载', 'done'],
    ['2026-05-18 15:40:02', '实例创建成功', '用户操作', '从应用 Zimage-Wan-Ltx2.3-训练器创建', 'done'],
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
          ].map((item, index) => <a className={index === 3 ? 'active' : ''} href={item[1]} key={item[0]}><span>{['⌘','◇','▦','▥','▤','▣','▥','▧'][index]}</span>{item[0]}</a>)}
          <button>微信客服</button>
        </aside>
        <main className="art-instance-detail-main">
          <div className="art-user-head">
            <h1>Zimage-Wan-Ltx2.3-训练器</h1>
            <div><button onClick={() => setAction('rename')}>改名</button><button onClick={() => setAction('boot')}>开机</button><button onClick={() => setAction('stop')}>关机</button><button onClick={() => setAction('restart')}>重启</button><button onClick={() => setAction('recharge')}>充值</button><button onClick={() => { window.location.href = '/compute/app/instances'; }}>返回列表</button></div>
          </div>
          <section className="instance-detail-hero">
            <div>
              <span className="instance-state">未开机</span>
              <h2>ins-art-zimage-20260518</h2>
              <p>北京B区 · RTX 5090-32G · 1卡 · 按量计费 · 系统盘 30GB</p>
              <div><button onClick={() => { window.location.href = '/compute/app/instances/workspace'; }}>JupyterLab</button><button onClick={() => { window.location.href = '/compute/app/instances/workspace'; }}>AutoPanel</button><button onClick={() => { window.location.href = '/compute/app/instances/workspace'; }}>SSH</button><button onClick={() => { window.location.href = '/compute/app/instances/workspace'; }}>WebUI-6006</button><button onClick={() => { window.location.href = '/compute/app/instances/workspace'; }}>WebUI-6008</button></div>
            </div>
            <aside>
              <strong>日常费用</strong>
              <b>￥-.-- / 日</b>
              <small>账户余额 ￥0.00</small>
            </aside>
          </section>
          <section className="instance-metric-grid">
            {metrics.map((item) => <article key={item[0]}><span>{item[0]}</span><strong>{item[1]}</strong><p>{item[2]}</p></article>)}
          </section>
          <section className="instance-service-card">
            <div className="instance-section-title"><h2>访问服务</h2><span>开机后自动生成访问地址，端口与 AutoDL 应用服务保持一致</span></div>
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
              <p><span>数据盘</span><strong>/root/autodl-tmp · 50GB · 随实例释放</strong></p>
              <p><span>公共数据</span><strong>/root/autodl-pub · 只读挂载</strong></p>
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
              ].map((item) => (
                <article key={item[0]}>
                  <div><span>{item[0]}</span><strong>{item[1]}</strong></div>
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
                ['应用版本', 'YrhEqUKpQo:v6'],
                ['基础镜像', 'image-aikit-zimage-wan-ltx23:v6'],
                ['启动命令', 'bash /root/start-aitoolkitui.sh'],
                ['创建时间', '2026-05-18 15:40:02'],
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
      {action === 'boot' && <ArtInstanceActionModal type="boot" onClose={() => setAction('')} />}
      {action === 'restart' && <ArtInstanceActionModal type="restart" onClose={() => setAction('')} />}
      {action === 'stop' && <ArtInstanceActionModal type="stop" onClose={() => setAction('')} />}
      {action === 'rename' && <ArtInstanceActionModal type="rename" onClose={() => setAction('')} />}
      {action === 'recharge' && <ArtInstanceActionModal type="recharge" onClose={() => setAction('')} />}
      {action === 'delete' && <ArtInstanceActionModal type="delete" onClose={() => setAction('')} />}
    </ArtShell>
  );
}

function ArtInstanceActionModal({ type, onClose }: { type: 'boot' | 'restart' | 'stop' | 'rename' | 'recharge' | 'clone' | 'delete'; onClose: () => void }) {
  const isDelete = type === 'delete';
  const isRestart = type === 'restart';
  const isStop = type === 'stop';
  const isRename = type === 'rename';
  const isRecharge = type === 'recharge';
  const isClone = type === 'clone';
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
            <label><span>当前名称</span><input value="ins-art-zimage-20260518" readOnly /></label>
            <label><span>新实例名称</span><input value="zimage-lora-train-01" readOnly /></label>
            <p>名称仅用于控制台展示，不影响镜像、端口、数据盘和计费规则。</p>
          </div>
        ) : isClone ? (
          <div className="art-instance-form-body clone">
            <label><span>来源实例</span><input value="ins-art-zimage-20260518" readOnly /></label>
            <label><span>新实例名</span><input value="copy-zimage-lora-train-01" readOnly /></label>
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
            <div className="boot-app-line"><strong>Zimage-Wan-Ltx2.3-训练器</strong><span>北京B区 · RTX 5090-32G · 1卡</span></div>
            <label><span>计费方式</span><div><button className="active">按量计费</button><button>包日</button><button>包周</button></div></label>
            <label><span>开机模式</span><div><button className="active">标准开机</button><button>无卡开机</button></div></label>
            <label><span>服务入口</span><div><button className="active">WebUI-6006</button><button>WebUI-6008</button><button>JupyterLab</button></div></label>
            <div className="boot-cost"><span>配置费用</span><b>￥-.-- / 时</b><small>实例30GB基础容量将按￥0.1/日计费</small></div>
          </div>
        )}
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>{isDelete ? '确认删除' : isRestart ? '确认重启' : isStop ? '确认关机' : isRename ? '保存名称' : isRecharge ? '立即充值' : isClone ? '确认复制' : '确认开机'}</button></footer>
      </section>
    </div>
  );
}

function ArtBatchActionModal({ onClose }: { onClose: () => void }) {
  const rows = [
    ['Zimage-Wan-Ltx2.3-训练器', '未开机', 'RTX 5090-32G', '1卡', '北京B区', '可开机'],
    ['ComfyUI云绘通用版', '运行中', 'RTX 4090D-24G', '1卡', '北京B区', '将跳过'],
  ];
  return (
    <div className="art-action-mask">
      <section className="art-batch-modal">
        <header><h2>批量操作</h2><button onClick={onClose}>×</button></header>
        <div className="batch-action-body">
          <div className="batch-action-tabs"><button className="active">批量开机</button><button>批量关机</button><button>释放实例</button><button className="danger">批量删除</button></div>
          <div className="batch-summary"><strong>已选择 2 个实例</strong><span>操作会按实例当前状态自动跳过不可执行项，执行前会检查余额、库存和实例锁定状态。</span></div>
          <div className="batch-plan-grid">
            <article><span>执行策略</span><strong>顺序执行</strong><p>同一区域实例按创建时间依次开机</p></article>
            <article><span>预计费用</span><strong>￥-.-- / 时</strong><p>仅对成功开机的实例产生 GPU 费用</p></article>
            <article><span>失败处理</span><strong>继续执行</strong><p>失败项保留在结果列表中便于重试</p></article>
          </div>
          <div className="batch-option-row">
            <label><input type="checkbox" checked readOnly /> 自动跳过运行中实例</label>
            <label><input type="checkbox" checked readOnly /> 开机后生成服务入口</label>
            <label><input type="checkbox" readOnly /> 执行完成后短信通知</label>
          </div>
          <div className="batch-instance-table">
            <div className="head"><span>应用名称</span><span>状态</span><span>GPU型号</span><span>数量</span><span>地区</span><span>处理结果</span></div>
            {rows.map((row) => <div className="row" key={row[0]}>{row.map((cell) => <span key={cell}>{cell}</span>)}</div>)}
          </div>
          <div className="batch-result-preview">
            <strong>执行预览</strong>
            <p><span>1 个实例将进入开机队列</span><span>1 个运行中实例会自动跳过</span><span>余额不足时全部停止执行</span></p>
          </div>
          <label className="batch-confirm"><input type="checkbox" checked readOnly /> 我已确认批量操作范围，并了解关机/删除可能影响正在运行的任务。</label>
        </div>
        <footer><button onClick={onClose}>取消</button><button className="primary" onClick={onClose}>确认执行</button></footer>
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
        <nav><a href="/compute/art/messages">消息</a><a href="/compute/art/incentive">创作激励</a><a href="/compute/docs">帮助文档</a><a href="/compute/art/login">登录</a><button onClick={() => { window.location.href = '/compute/art/register'; }}>注册</button></nav>
      </header>
      <div className="art-subnav"><a href="/compute/app/market">▦ 应用</a><a className={active === 'models' ? 'active' : ''} href="/compute/app/models">⬡ 大模型</a><a className={active === 'images' ? 'active' : ''} href="/compute/app/images">☁ 镜像</a></div>
      {children}
    </div>
  );
}

function ArtModelsPage() {
  const detailOpen = window.location.pathname.includes('/compute/app/models/');
  const vendors = ['DeepSeek', '智谱', 'Qwen', 'MiniMax', 'Kimi', '火山即梦', '海螺', 'Vidu', '可灵'];
  const types = ['对话', '生图', '视频'];
  const models = [
    ['doubao-seedance-2-0-260128', '', '', '点击查看价格详情', ''],
    ['doubao-seedance-2-0-fast-260128', '', '', '点击查看价格详情', ''],
    ['DeepSeek-V4-Pro', '', '输入：￥12.000 / M token', '输出：￥24.000 / M token', ''],
    ['DeepSeek-V4-Flash', '', '输入：￥1.000 / M token', '输出：￥2.000 / M token', ''],
    ['Kimi-K2.6', '会员6折', '输入：￥3.900 / M token', '输出：￥16.200 / M token', '￥6.500 / M token / ￥27.000 / M token'],
    ['GLM-5.1', '会员8折', '输入：￥4.800 / M token', '输出：￥19.200 / M token', '￥6.000 / M token / ￥24.000 / M token'],
    ['qwen3.6-plus', '会员8折', '输入：￥1.600 / M token', '输出：￥9.600 / M token', '￥2.000 / M token / ￥12.000 / M token'],
    ['GLM-5', '会员6折', '输入：￥2.400 / M token', '输出：￥10.800 / M token', '￥4.000 / M token / ￥18.000 / M token'],
    ['Kimi-K2.5', '会员6折', '输入：￥2.400 / M token', '输出：￥12.600 / M token', '￥4.000 / M token / ￥21.000 / M token'],
    ['MiniMax-M2.7', '会员6折', '输入：￥1.260 / M token', '输出：￥5.040 / M token', '￥2.100 / M token / ￥8.400 / M token'],
    ['DeepSeek-V3.2', '会员6折', '输入：￥1.200 / M token', '输出：￥1.800 / M token', '￥2.000 / M token / ￥3.000 / M token'],
    ['Qwen-Image', '会员6折', '输入：￥0.001 / 次', '输出：￥0.150 / 次', '￥0.250 / 次'],
  ];
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
          <div className="model-filter"><label>系列/厂商：</label>{vendors.map((item) => <button key={item}>{item}</button>)}</div>
          <div className="model-filter"><label>模型类型：</label>{types.map((item) => <button key={item}>{item}</button>)}</div>
          <section className="model-grid">
            {models.map((row) => (
              <article className="model-card" key={row[0]} onClick={() => { window.location.href = '/compute/app/models/deepseek-v4-pro'; }}>
                <h2>{row[0]}</h2>
                {row[1] && <em>{row[1]}</em>}
                <p>{row[2] || row[3]}</p>
                {row[2] && <p>{row[3]}</p>}
                {row[4] && <small>{row[4]}</small>}
              </article>
            ))}
          </section>
          <div className="model-pager">共 39 条 <b>1</b></div>
        </main>
      </div>
      {detailOpen && <ArtModelDetail />}
    </ArtShell>
  );
}

function ArtModelDetail() {
  const [modelModal, setModelModal] = useState<'playground' | 'docs' | ''>('');
  const priceRows = [
    ['输入', '￥12.000 / M token', '上下文缓存命中 ￥3.000 / M token'],
    ['输出', '￥24.000 / M token', '会员折扣按账号等级结算'],
    ['并发', '自动弹性', '支持 API Key 调用与用量统计'],
  ];
  return (
    <div className="art-detail-mask">
      <section className="art-model-detail">
        <button className="detail-close" onClick={() => { window.location.href = '/compute/app/models'; }}>×</button>
        <aside>
          <div className="model-logo">DS</div>
          <h1>DeepSeek-V4-Pro</h1>
          <p>高性能推理模型，适用于复杂推理、代码生成、知识问答和智能体任务。</p>
          <div className="model-detail-tags"><span>对话</span><span>代码</span><span>推理</span><span>会员6折</span></div>
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
            <pre>{`POST /v1/chat/completions\nAuthorization: Bearer <API_KEY>\n\n{\n  "model": "DeepSeek-V4-Pro",\n  "messages": [{"role": "user", "content": "你好"}]\n}`}</pre>
          </section>
          <section>
            <h2>模型说明</h2>
            <p>模型广场提供统一计费、令牌管理和用量看板。后续接入接口后，此处将展示真实上下文长度、限速策略和请求示例。</p>
          </section>
        </main>
      </section>
      {modelModal && <ArtModelActionModal type={modelModal} onClose={() => setModelModal('')} />}
    </div>
  );
}

function ArtModelActionModal({ type, onClose }: { type: 'playground' | 'docs'; onClose: () => void }) {
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
              <pre>{`POST https://api.lingqu.art/v1/chat/completions`}</pre>
              <h3>Header</h3>
              <pre>{`Authorization: Bearer <API_KEY>\nContent-Type: application/json`}</pre>
              <h3>Body</h3>
              <pre>{`{\n  "model": "DeepSeek-V4-Pro",\n  "messages": [{"role": "user", "content": "你好"}],\n  "stream": false\n}`}</pre>
            </section>
          </div>
        ) : (
          <div className="model-play-body">
            <label><span>API Key</span><input value="sk-****-9f28" readOnly /></label>
            <label><span>模型</span><input value="DeepSeek-V4-Pro" readOnly /></label>
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
  const filters: Array<[string, string[]]> = [
    ['芯片', ['摩尔线程专区', '华为昇腾', 'NVIDIA']],
    ['CPU架构', ['x86_64', 'ARM64']],
    ['热门', ['Qwen', 'ComfyUI', 'FLUX', '音色转换', '实时变声器', 'Langchain', 'StableDiffusion', '虚拟人合成']],
    ['计算机视觉', ['语义分割', '视觉分类', '物体检测跟踪']],
    ['生成式算法', ['多模态', '文生图', '图像描述']],
    ['语音', ['声音克隆', '合成', '语音识别']],
  ];
  const rows = [
    ['akibanzu', '更新于2年前', '精', 'Akegarasu/lora-scripts/lora-train', '运行时长557935h No.7', 'GitHub Star6.0k', 'Stable Diffusion LoRA 训练', '724', '75.8k', '29'],
    ['RVC-Boss', '更新于4周前', '精', 'RVC-Boss/GPT-SoVITS/GPT-SoVITS-Official', '运行时长426341h No.10', 'GitHub Star57.5k', 'GPT-SoVITS语音合成官方镜像，3080Ti卡测试通过', '1277', '64.9k', '26'],
    ['glide-the', '更新于2年前', '精', 'chatchat-space/Langchain-Chatchat/Langchain-Chatchat', '运行时长323828h No.11', 'GitHub Star38.0k', '基于 Langchain 与 ChatGLM 等语言模型的本地知识库问答', '513', '30.7k', '61'],
    ['Kedreamix', '更新于1年前', '精', 'Kedreamix/Linly-Talker/Kedreamix-Linly-Talker', '运行时长19540h No.91', 'GitHub Star3.3k', 'Linly-Talker是一款创新的数字人对话系统', '191', '4.4k', '17'],
    ['lipku', '更新于1月前', '精', 'lipku/livetalking/base', '运行时长48327h No.35', 'GitHub Star7.7k', '实时交互数字人，支持ernerf和musetalk、wav2lip', '97', '2.9k', '13'],
    ['39c5bb', '更新于3月前', '热', 'svc-develop-team/so-vits-svc/so-vits-svc-4.1-Stable', '运行时长587459h No.5', 'GitHub Star28.1k', 'so vits svc项目主分支，开箱即用', '219', '80.7k', '16'],
    ['tzwm', '更新于3年前', '热', 'AUTOMATIC1111/stable-diffusion-webui/tzwm_sd_webui_A1111', '运行时长596445h No.4', 'GitHub Star163.1k', 'webui 1.6.0 整合版，支持 SDXL', '557', '79.6k', '36'],
  ];
  const hot = [
    ['RVC-Boss', '134.6k', 'Retrieval-based-Voice-Conversion-WebUI/RVC_WebUI', '35.6k star'],
    ['tzwm', '37.0k', 'ComfyUI/tzwm_ComfyUI', '113.3k star'],
    ['iscyy', '23.1k', 'ultralytics/yolov8', '57.2k star'],
    ['39c5bb', '80.7k', 'so-vits-svc/so-vits-svc-4.1-Stable', '28.1k star'],
    ['nahz202', '12.6k', 'ComfyUI/ComfyUI_2024', '113.3k star'],
  ];
  return (
    <ArtShell active="images">
      <div className="image-market-layout">
        <aside className="image-filter-panel">
          {filters.map((group) => <section key={group[0]}><h2>{group[0]}</h2>{group[1].map((item) => <button key={item}>{item}</button>)}</section>)}
        </aside>
        <main className="image-list-main">
          <div className="image-tabs"><a className="active">热门</a><a>最新</a><a>周榜</a></div>
          {rows.map((row) => (
            <article className="image-row-card" key={row[3]} onClick={() => { window.location.href = '/compute/app/images/lora-train'; }}>
              <div className="image-row-head"><strong>{row[0]}</strong><span>{row[1]}</span><em>{row[2]}</em></div>
              <h2>{row[3]}</h2>
              <div className="image-meta"><span>{row[4]}</span><span>{row[5]}</span></div>
              <p>{row[6]}</p>
              <div className="image-stats"><span>☆ {row[7]}</span><span>◷ {row[8]}</span><span>⇩ {row[9]}</span></div>
            </article>
          ))}
          <div className="image-pager">共 1698 条 <b>1</b><b>2</b><b>3</b><b>4</b><b>5</b><b>6</b><b>95</b></div>
        </main>
        <aside className="hot-image-panel">
          <h2>热门镜像</h2>
          {hot.map((row, index) => <article key={row[2]}><b>{index + 1}</b><div><strong>{row[0]}</strong><span>{row[1]}</span><p>{row[2]}</p><small>{row[3]}</small></div></article>)}
        </aside>
      </div>
      {detailOpen && <ArtImageDetail />}
    </ArtShell>
  );
}

function ArtImageDetail() {
  const [createOpen, setCreateOpen] = useState(false);
  return (
    <div className="art-detail-mask">
      <section className="art-image-detail">
        <button className="detail-close" onClick={() => { window.location.href = '/compute/app/images'; }}>×</button>
        <header>
          <div className="image-detail-avatar">镜</div>
          <div>
            <h1>Akegarasu/lora-scripts/lora-train</h1>
            <p>Stable Diffusion LoRA 训练镜像，内置常用训练脚本、依赖环境和示例配置。</p>
            <div><span>运行时长557935h No.7</span><span>GitHub Star6.0k</span><span>下载 29</span></div>
          </div>
          <button onClick={() => setCreateOpen(true)}>使用该镜像创建</button>
        </header>
        <div className="image-detail-body">
          <aside>
            <h2>镜像信息</h2>
            {[
              ['作者', 'akibanzu'],
              ['更新时间', '更新于2年前'],
              ['系统', 'Ubuntu 22.04 / CUDA 11.8'],
              ['Python', '3.10'],
              ['镜像大小', '24.6GB'],
              ['适用场景', 'LoRA训练 / Stable Diffusion'],
            ].map((row) => <p key={row[0]}><span>{row[0]}</span><strong>{row[1]}</strong></p>)}
          </aside>
          <main>
            <h2>使用说明</h2>
            <p>创建实例后可在 JupyterLab 或 SSH 中进入工作目录，按镜像 README 启动训练脚本。常用数据集建议挂载到数据盘或网盘目录。</p>
            <pre>{`cd /root/lora-scripts\nbash train.sh --config configs/example.toml`}</pre>
            <h2>相关推荐</h2>
            <div className="image-related"><span>ComfyUI</span><span>StableDiffusion WebUI</span><span>GPT-SoVITS</span><span>Langchain-Chatchat</span></div>
          </main>
        </div>
      </section>
      {createOpen && <ArtImageCreateModal onClose={() => setCreateOpen(false)} />}
    </div>
  );
}

function ArtImageCreateModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="art-action-mask nested">
      <section className="art-image-create-modal">
        <header><h2>使用镜像创建实例</h2><button onClick={onClose}>×</button></header>
        <div className="image-create-body">
          <div className="image-create-summary"><strong>Akegarasu/lora-scripts/lora-train</strong><span>Ubuntu 22.04 / CUDA 11.8 · Python 3.10 · 24.6GB</span></div>
          <label><span>计费方式</span><div><button className="active">按量计费</button><button>包日</button><button>包周</button></div></label>
          <label><span>GPU型号</span><div><button className="active">RTX 5090-32G</button><button>RTX 4090D-24G</button><button>RTX 4080S-32G</button></div></label>
          <label><span>服务入口</span><div><button className="active">JupyterLab</button><button>SSH</button><button>自定义端口</button></div></label>
          <label><span>启动命令</span><input value="cd /root/lora-scripts && bash train.sh" readOnly /></label>
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
      <section className="api-footer-note"><h2>配合弹性接口接入</h2><p>后续接入 AutoDL 提供的弹性接口后，这里将直接串联部署创建、状态查询、扩缩容和费用统计。</p></section>
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

function PrivateCloudPage() {
  return <HomePage />;
}

function DocsPage() {
  const path = window.location.pathname;
  const docs = [
    { key: 'intro', title: '简介', href: '/compute/docs' },
    { key: 'quickstart', title: '快速开始', href: '/compute/docs/quickstart' },
    { key: 'app-publish', title: '应用发布', href: '/compute/docs/app-publish' },
    { key: 'instance', title: '应用实例', href: '/compute/docs/instance' },
    { key: 'billing', title: '充值与计费', href: '/compute/docs/billing' },
    { key: 'api', title: 'API文档', href: '/compute/docs/api' },
    { key: 'invoice', title: '发票', href: '/compute/docs/invoice' },
    { key: 'trouble', title: '维护与故障', href: '/compute/docs/trouble' },
    { key: 'agreement', title: '服务协议', href: '/compute/docs/agreement' },
  ];
  const current = path.includes('/app-publish') ? 'app-publish' : path.includes('/instance') ? 'instance' : path.includes('/billing') ? 'billing' : path.includes('/api') ? 'api' : path.includes('/invoice') ? 'invoice' : path.includes('/trouble') ? 'trouble' : path.includes('/agreement') ? 'agreement' : path.includes('/quickstart') ? 'quickstart' : 'intro';
  const article: Record<string, { title: string; warning: string; sections: [string, string[]][] }> = {
    intro: {
      title: '简介',
      warning: '严肃声明: 严禁挖矿，一经发现一律封号',
      sections: [
        ['必看文档', ['快速开始', '计费说明', '开具发票', '实例数据保留说明', '开守护进程']],
        ['常用文档', ['如何选择GPU', '上传数据', '下载数据', '配置环境', '公网网盘', 'VSCode', 'PyCharm']],
      ],
    },
    quickstart: {
      title: '快速开始',
      warning: '创建实例前请先确认余额、资源区和镜像来源。',
      sections: [
        ['创建应用实例', ['进入应用广场选择应用', '确认计费方式和 GPU 型号', '创建后在实例列表开机', '通过 WebUI-6006 或 SSH 访问']],
        ['常见入口', ['应用市场', '应用实例', '实例工作台', '钱包充值']],
      ],
    },
    'app-publish': {
      title: '应用发布',
      warning: '应用发布后会进入平台审核，审核通过后展示到应用广场。',
      sections: [
        ['发布材料', ['应用名称、简介、封面', '基础镜像和启动命令', '服务端口声明', '应用说明和使用教程']],
        ['审核流程', ['自动检查基础信息', '镜像安全扫描', '人工复核应用说明', '通过后发布到应用广场']],
      ],
    },
    instance: {
      title: '应用实例',
      warning: '关机只停止 GPU 计费，系统盘和扩容盘仍会保留并计费。',
      sections: [
        ['实例生命周期', ['创建实例', '开机和生成服务入口', '关机保留系统盘', '删除实例释放数据']],
        ['工作台', ['SSH 终端', '文件浏览器', '实时日志', 'WebUI 服务入口']],
      ],
    },
    billing: {
      title: '充值与计费',
      warning: '实例开机前会进行余额预检查，余额不足时无法分配 GPU。',
      sections: [
        ['费用组成', ['GPU 算力费用', '系统盘基础容量', '扩容盘', '公网服务和流量']],
        ['账单管理', ['收支明细', '账单明细', '发票申请', '余额提醒']],
      ],
    },
    api: {
      title: 'API文档',
      warning: 'API Key 请妥善保管，不要暴露在前端代码或公开仓库中。',
      sections: [
        ['弹性部署接口', ['创建部署', '查询状态', '扩缩容', '停止部署']],
        ['模型调用接口', ['创建令牌', '设置白名单', '查看调用量', '导出报表']],
      ],
    },
    invoice: {
      title: '发票',
      warning: '只有已完成支付且可开票的订单才能申请发票。',
      sections: [
        ['开票流程', ['进入钱包发票页', '选择订单', '填写抬头信息', '提交并等待开具']],
        ['发票类型', ['个人普通发票', '企业普通发票', '企业专票']],
      ],
    },
    trouble: {
      title: '维护与故障',
      warning: '实例异常时请先保留日志和实例 ID，便于定位调度问题。',
      sections: [
        ['排查步骤', ['查看实例事件记录', '检查余额和资源库存', '查看实时日志', '联系平台客服']],
        ['常见问题', ['WebUI 无法打开', 'SSH 连接失败', '镜像启动慢', '文件无法上传']],
      ],
    },
    agreement: {
      title: '服务协议',
      warning: '严禁挖矿、攻击、违规内容生成和未授权数据处理。',
      sections: [
        ['使用限制', ['不得挖矿', '不得攻击第三方服务', '不得传播违法内容', '不得共享账号给未授权人员']],
        ['数据责任', ['用户自行备份重要数据', '删除实例会释放系统盘', '欠费可能影响数据保留']],
      ],
    },
  };
  const activeArticle = article[current];
  return (
    <div className="docs-shell">
      <header className="docs-top"><a className="docs-brand" href="/compute"><span />灵渠帮助文档</a><div className="docs-top-search">⌕ 搜索</div></header>
      <aside className="docs-sidebar">
        <h2>灵渠帮助文档</h2>
        {docs.map((item) => <a className={current === item.key ? 'current' : ['app-publish', 'instance', 'billing', 'api'].includes(item.key) ? 'with-arrow' : ''} href={item.href} key={item.key}>{item.title}</a>)}
      </aside>
      <main className="docs-article">
        <h1>{activeArticle.title}</h1>
        <div className="doc-warning">{activeArticle.warning}</div>
        <hr />
        <p>本文档用于说明灵渠 Art 和算力控制台的基础流程，页面目前先完成 UI 结构，后续接入真实接口后会同步真实状态和返回码。</p>
        {activeArticle.sections.map((section) => (
          <section className="doc-section-block" key={section[0]}>
            <h3>{section[0]}</h3>
            <ol>{section[1].map((item) => <li key={item}><a>{item}</a></li>)}</ol>
          </section>
        ))}
        {current === 'api' && <pre className="doc-code">{`POST /api/v1/deployment\nAuthorization: Bearer <token>\nContent-Type: application/json\n\n{\n  \"deployment_name\": \"zimage-train\",\n  \"gpu_name\": [\"RTX 5090\"],\n  \"replicas\": 1\n}`}</pre>}
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
  const labels = ['主页', '容器实例', '容器实例 Pro', '弹性部署', '文件存储', '高速文件存储', '网盘', '镜像', '公开数据', '费用', '账号'];
  const icons = ['⌂','⬡','⬢','⌘','▣','▱','▰','◫','◉','￥','♙'];
  return (
    <aside className="console-sidebar">
      {labels.map((item, index) => {
        const key = index === 0 ? 'home' : index === 1 ? 'instances' : index === 2 ? 'instancesPro' : index === 4 ? 'files' : index === 5 ? 'fastfs' : index === 6 ? 'netdisk' : index === 7 ? 'images' : index === 8 ? 'publicData' : index === 9 ? 'billing' : index === 10 ? 'account' : item;
        const href = index === 0 ? '/compute/dashboard' : index === 1 ? '/compute/instances' : index === 2 ? '/compute/instances-pro' : index === 3 ? '/compute/deployments' : index === 4 ? '/compute/file-store' : index === 5 ? '/compute/fast-file-store' : index === 6 ? '/compute/netdisk' : index === 7 ? '/compute/images' : index === 8 ? '/compute/public-data' : index === 9 ? '/compute/billing' : index === 10 ? '/compute/account/security' : undefined;
        return <a className={key === current ? 'current' : ''} href={href} key={item}><span>{icons[index]}</span>{item}</a>;
      })}
      {current === 'billing' && <div className="billing-submenu">{[
        ['收支明细', '/compute/billing'],
        ['我的订单', '/compute/billing/orders'],
        ['账单明细', '/compute/billing/detail'],
        ['代金券', undefined],
        ['优惠券', '/compute/billing/coupons'],
        ['发票管理', undefined],
        ['合同', undefined],
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
  return 0;
}

function DashboardPage({ data }: { data?: ComputePayload }) {
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
            <h2>deepcooker <a>↗</a><em>个人认证</em></h2>
            <p>🏅 超级会员</p>
            <a>个人资料与安全设置</a><a>邀请好友赚钱</a>
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
            <div className="wallet-box"><span>现金余额</span><button>去充值</button><strong>￥{(data?.balance_cny ?? 1303.96).toFixed(2)}</strong><small>冻结金额 0.00</small></div>
            <p>🎟 优惠券 <b>￥0.00</b></p><p>🧧 代金券 <span>暂无</span></p><p>🛡 保障 <span>暂无</span> <a>查看明细</a></p>
            <div className="wallet-links"><a>充值记录&gt;</a><a>消费记录&gt;</a><a>账单明细&gt;</a><a>发票&gt;</a></div>
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
  return (
    <div className="console-layout">
      <ConsoleSideBar current="publicData" />
      <main className="console-main public-main">
        <div className="public-title"><h1>公开数据</h1><div className="search-like public-search">搜索数据集 <span>⌕</span></div></div>
        <a className="usage-link">如何使用公开数据？</a>
        <div className="public-table">
          <div className="public-head"><span>数据名称</span><span>实例中路径</span><span>大小</span><span>类型</span><span>发布方</span><span>简介</span></div>
          {publicDataRows.map((row) => (
            <div className="public-row" key={row[0]}>
              <span>{row[0]}</span><span>{row[1]} <a>▣</a></span><span>{row[2]}</span><span>{row[3]}</span><span>{row[4]}</span><span>{row[5]}</span>
            </div>
          ))}
        </div>
        <div className="console-pager">共 39 条 <span>‹</span><b>1</b><b className="dark">2</b><b className="dark">3</b><b className="dark">4</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
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
          <span>文件存储在实例中的挂载目录为：/root/autodl-fs。连续3个月未登录或欠费50元以上，平台保留删除数据的权利，具体规则请参考<a>文档</a></span>
        </div>
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
        <p className="netdisk-warning">如扩容到期且使用量超出免费容量，将会停止实例挂载网盘，直至扩容或清理数据</p>
        <p className="netdisk-warning strong">非常抱歉通知您，网盘功能即将于 2025-07-15 日永久下线，请尽快备份数据，如您续费超过此日期请联系客服双倍退还未使用时长费用，此外可以换用同地区文件存储，相同的功能更好的体验</p>
        <div className="netdisk-separator" />
        <div className="netdisk-empty"><div className="empty-illustration">◇</div><span>暂无可用网盘</span></div>
      </main>
    </div>
  );
}

function ImagesPage() {
  return (
    <div className="console-layout">
      <ConsoleSideBar current="images" />
      <main className="console-main images-main">
        <div className="console-title image-title">
          <h1>我的镜像</h1>
          <span>连续3个月未登录或欠费50元以上，平台保留删除数据的权利，具体规则请参考<a>文档</a></span>
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
              <span>{row.uuid}</span><span>{row.name}</span><span>{row.size}</span><span><i className="dot green" />{row.status}</span><span>{row.share}</span><span>{row.source}</span><span>{row.cache}</span><span>{row.base}</span><span>{row.created}</span>
              <span className="image-actions"><a>编辑</a><a>共享</a><a className="danger">删除</a></span>
            </div>
          ))}
        </div>
        <div className="console-pager">共 38 条 <span>‹</span><b>1</b><b className="dark">2</b><b className="dark">3</b><b className="dark">4</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function BillingPage() {
  return (
    <div className="console-layout">
      <ConsoleSideBar current="billing" />
      <main className="console-main billing-main">
        <h1>收支明细</h1>
        <div className="billing-filter">
          <label>交易时间：</label>
          <div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div>
        </div>
        <div className="billing-table">
          <div className="billing-head"><span>流水号</span><span>交易时间</span><span>收支类型 ⌯</span><span>交易类型 ⌯</span><span>交易渠道</span><span>交易金额</span><span>账户余额</span><span>备注</span></div>
          <div className="empty-row">暂无数据</div>
        </div>
        <div className="console-pager billing-pager">共 0 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function BillingSubPage({ kind }: { kind: 'orders' | 'detail' | 'coupons' }) {
  const config = {
    orders: {
      title: '我的订单',
      filter: ['创建时间：', '订单类型：全部', '订单状态：全部'],
      heads: ['订单号', '创建时间', '订单类型', '订单状态', '订单金额', '支付方式', '操作'],
    },
    detail: {
      title: '账单明细',
      filter: ['账单月份：', '资源类型：全部', '计费方式：全部'],
      heads: ['账单号', '账单周期', '资源类型', '资源ID', '消费金额', '抵扣金额', '实付金额', '状态'],
    },
    coupons: {
      title: '优惠券',
      filter: ['优惠券状态：全部', '获得时间：'],
      heads: ['优惠券名称', '优惠内容', '适用范围', '有效期', '状态', '操作'],
    },
  }[kind];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="billing" />
      <main className="console-main billing-main">
        <h1>{config.title}</h1>
        <div className="billing-filter wide">
          {config.filter.map((item) => item.endsWith('：') ? <label key={item}>{item}</label> : <div className="select-like mini-select" key={item}>{item} <span>⌄</span></div>)}
          <div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div>
        </div>
        <div className="billing-table">
          <div className={`billing-head ${kind}`}>{config.heads.map((item) => <span key={item}>{item}</span>)}</div>
          <div className="empty-row">暂无数据</div>
        </div>
        <div className="console-pager billing-pager">共 0 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
    </div>
  );
}

function AccountSecurityPage() {
  const rows = [
    ['登录密码', '安全性高的密码可以使账号更安全。建议您定期更换密码，设置一个包含字母和数字且长度超过8位的密码', '已设置', '修改', true],
    ['手机绑定', '您已绑定了手机177****7953您的手机号可以直接用于登录、找回密码等', '已绑定', '修改', true],
    ['实名认证', '实名认证后可以使用AutoDL更完整的功能，如打开实例的自定义服务等', '已认证', '查看', true],
    ['微信绑定', '您已绑定微信，可快速扫码登录', '已绑定', '解绑', true],
    ['邮箱绑定', '绑定邮箱后可接收系统消息，如余额不足、实例即将到期、实例即将释放等消息', '未绑定', '绑定', false],
  ] as const;
  return (
    <div className="console-layout">
      <ConsoleSideBar current="account" />
      <main className="console-main account-main">
        <h1>账号安全</h1>
        <div className="security-list">
          {rows.map((row) => (
            <section className="security-card" key={row[0]}>
              <div><h2>{row[0]}</h2><p>{row[1]}</p></div>
              <span className={row[4] ? 'ok' : 'warn'}>{row[4] ? '◎' : 'ⓘ'} {row[2]}</span>
              <a>{row[3]}</a>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}

function AccountSubPage({ kind }: { kind: 'access' | 'sub' | 'settings' }) {
  if (kind === 'settings') {
    return (
      <div className="console-layout">
        <ConsoleSideBar current="account" />
        <main className="console-main account-main">
          <h1>设置</h1>
          <div className="settings-list">
            <section><h2>消息通知</h2><p>余额不足、实例即将到期、实例即将释放等消息通知</p><button className="switch on" /><span>开启</span></section>
            <section><h2>默认地区</h2><p>租用新实例时默认选择的地区</p><div className="select-like settings-select">重庆A区 <span>⌄</span></div></section>
            <section><h2>自动释放提醒</h2><p>实例释放前通知账号绑定手机和邮箱</p><button className="switch on" /><span>开启</span></section>
          </div>
        </main>
      </div>
    );
  }
  const config = kind === 'access'
    ? { title: '访问记录', filter: '访问时间：', heads: ['访问时间', '登录IP', '登录地区', '登录方式', '状态'] }
    : { title: '子账号', filter: '账号名称：', heads: ['子账号', '角色', '权限范围', '状态', '创建时间', '操作'] };
  return (
    <div className="console-layout">
      <ConsoleSideBar current="account" />
      <main className="console-main billing-main">
        <h1>{config.title}</h1>
        <div className="billing-filter wide"><label>{config.filter}</label><div className="date-range"><span>▣</span><em>开始日期</em><b>至</b><em>结束日期</em></div>{kind === 'sub' && <button className="blue small-action">创建子账号</button>}</div>
        <div className="billing-table">
          <div className={`billing-head ${kind === 'access' ? 'access' : 'subaccounts'}`}>{config.heads.map((item) => <span key={item}>{item}</span>)}</div>
          <div className="empty-row">暂无数据</div>
        </div>
        <div className="console-pager billing-pager">共 0 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
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
  return (
    <div className="console-layout">
      <AppSideBar current="deployments" />
      <main className="console-main deployments-main">
        <div className="deploy-title"><h1>弹性部署</h1></div>
        <div className="console-toolbar deploy-toolbar">
          <button className="blue" onClick={() => { window.location.href = '/compute/deployments/create'; }}>创建部署</button>
          <button className="refresh">C</button>
          <a href="/compute/deployments/blacklist">管理调度黑名单</a><a>使用API创建部署</a><a>查看更新日志</a>
          <div className="toolbar-spacer" />
          <div className="search-like deploy-search">搜索部署ID <span>⌕</span></div>
        </div>
        <div className="deploy-table">
          <div className="deploy-head"><span>部署ID/名称</span><span>部署类型</span><span>调度地区</span><span>调度GPU型号</span><span>容器数量 ⓘ</span><span>实时费用</span><span>时长包</span><span>状态 ⌯</span><span>创建时间</span><span>操作</span></div>
          {deploymentRows.map((row) => (
            <div className="deploy-row" key={row.id}>
              <span><b>{row.id}</b><small>{row.name}</small></span>
              <span>{row.type}</span>
              <span>{row.region}</span>
              <span>{row.gpu}</span>
              <span><em className="orange">{row.copies[0]}</em> / <em className="green-text">{row.copies[1]}</em> / {row.copies[2]} / {row.copies[3]} <a>C</a><a onClick={() => setOverviewOpen(row.id === '0f11ed8da8' ? !overviewOpen : false)}>详情</a></span>
              <span><em className="red-text">￥0.00/时</em> <a>C</a></span>
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
        <div className="console-pager">共 20 条 <span>‹</span><b>1</b><b className="dark">2</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
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
    ['folder', 'autodl-tmp', '目录', '2026-05-20 15:41'],
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
    ['PID 1356', 'tensorboard --logdir /root/autodl-tmp/logs', '00:12:44', '318MB'],
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
          <article><span>数据目录</span><strong>/root/autodl-tmp</strong><p>已用 38.4GB / 50GB</p></article>
          <article><span>公网服务</span><strong>4 个端口</strong><p>8888 / 22 / 6006 / 6008</p></article>
        </section>
        <div className="compute-workspace-grid">
          <section className="workspace-terminal compute-workspace-terminal">
            <div className="workspace-title"><h2>SSH 终端</h2><span>root@instance-941327a885</span></div>
            <pre>{['root@autodl-container:~# nvidia-smi','RTX 5090  23%   18234MiB / 32768MiB','root@autodl-container:~# pwd','/root','root@autodl-container:~# cd /root/autodl-tmp','root@autodl-container:~/autodl-tmp# bash start.sh --port 6006','service already running on 0.0.0.0:6006'].join('\n')}</pre>
            <div><input value="tail -f /root/autodl-tmp/run.log" readOnly /><button>发送</button></div>
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
            <pre>{['[16:03:22] proxy /compute/proxy/941327/6006 ready','[16:03:25] model cache loaded from /root/autodl-tmp/models','[16:03:31] web server listening on 0.0.0.0:6006','[16:04:02] request GET /health 200','[16:04:18] gpu memory allocated 18.2GB'].join('\n')}</pre>
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
    ['磁盘IO', '42MB/s', '/root/autodl-tmp', '8,14,20,24,18,22,16,12'],
  ];
  const disks = [
    ['系统盘', '/root', instance?.system_disk_usage ?? '22.1GB / 30GB', '随实例释放'],
    ['数据盘', '/root/autodl-tmp', instance?.data_disk_usage ?? '38.4GB / 50GB', '关机保留，释放删除'],
    ['文件存储', '/root/autodl-fs', '231MB / 200GB', '跨实例挂载'],
    ['公开数据', '/root/autodl-pub', '只读挂载', '平台维护'],
  ];
  const events = [
    ['2026-05-20 15:41:02', '实例开机', '用户操作', '按量计费开始，服务端口开始代理', 'done'],
    ['2026-05-20 15:40:51', '数据盘挂载', '调度系统', '/root/autodl-tmp 挂载完成', 'done'],
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
            <pre>{`source /root/miniconda3/bin/activate\ncd /root/autodl-tmp\nbash start.sh --port 6006`}</pre>
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

function InstancesPage({ data }: { data?: ComputePayload }) {
  const rows = data?.instances ?? [];
  return (
    <div className="console-layout">
      <ConsoleSideBar current="instances" />
      <main className="console-main">
        <div className="console-title">
          <h1>容器实例</h1>
          <span>实例关机15天后会释放，请及时备份数据，避免数据丢失</span>
          <div className="console-links"><a>租用GPU机器</a><a>配置SSH免密登录</a><a>企业认证</a></div>
        </div>
        <div className="console-toolbar">
          <button className="blue">租用新实例</button>
          <button>无卡模式实例</button>
          <button>开机模板</button>
          <button className="refresh">C</button>
          <div className="toolbar-spacer" />
          <div className="select-like">全部地区/机器 <span>⌄</span></div>
          <div className="search-like">搜索实例名称/ID <span>⌕</span></div>
          <button className="gear">⚙</button>
        </div>
        <div className="console-table">
          <div className="console-head"><span>实例ID /名称</span><span>状态 ⌯</span><span>规格详情</span><span>本地磁盘</span><span>健康状态</span><span>付费方式 ⌯</span><span>释放时间/停机时间 ⓘ</span><span>SSH登录</span><span>快捷工具</span><span>操作</span></div>
          {rows.map((item) => (
            <div className="console-row" key={item.id}>
              <span><a>{item.region} / {item.machine}</a><b>{item.id}</b><em>{item.name} ↗</em></span>
              <span><i className="dot blue" />{item.status}{item.gpu.includes('4090') && <small>⊘ 无卡开机</small>}</span>
              <span>{item.gpu.replace('*', '*')}<a href="/compute/instances/detail">查看详情</a></span>
              <span>系统盘 {item.system_disk_usage}<small>数据盘 {item.data_disk_usage}</small></span>
              <span><i className="dot green" />{item.health}</span>
              <span>{item.billing}</span>
              <span>{item.release_time.replace('到期15天后释放 ', '到期15天后释放\n')}<a>{item.billing === '按量计费' ? '立即释放' : ''}</a></span>
              <span>终端登录<br />ssh******<small>*</small><a>复制</a><br />密码<br />********<small>*</small><a>复制</a></span>
              <span className="tool-links">{item.quick_tools.map((tool) => <a href="/compute/instances/workspace" key={tool}>{tool}</a>)}</span>
              <span className="tool-links"><a>关机</a><a>更多</a></span>
            </div>
          ))}
        </div>
        <div className="console-pager">共 3 条 <span>‹</span><b>1</b><span>›</span><button>10条/页 ⌄</button> 前往 <input value="1" readOnly /> 页</div>
      </main>
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
  const item = data?.resources.find((row) => row.gpu_model === 'RTX PRO 6000' && row.region === '西北B区') ?? data?.resources[0];
  const balance = data?.balance_cny ?? 1300.9;
  const price = item?.hourly_price ?? 5.98;
  const originalPrice = item?.original_hourly_price ?? 7.97;
  const machine = 'A13机';

  return (
    <div className="rent-layout">
      <main className="rent-content">
        <div className="rent-crumb">算力市场 / 创建实例 <span>ⓘ 严禁使用WebUI等算法生成违禁图片、严禁挖矿，一经发现立即封号！</span></div>

        <section className="rent-panel billing-panel">
          <div className="rent-label">计费方式:</div>
          <div className="rent-body">
            <SegmentButtons items={['按量计费', '包日', '包周', '包月']} selected="按量计费" />
            <a className="rule-link">计费规则</a>
            <p>创建完主机后仍然可以转换计费方式。如选择按量计费，价格发生变动以实例开机时的价格为准</p>
          </div>
        </section>

        <section className="rent-panel host-panel">
          <div className="rent-label">选择主机:</div>
          <div className="rent-body">
            <div className="host-table">
              <div className="host-head">
                <span></span><span>主机ID</span><span>算力型号/显存</span><span>空闲GPU</span><span>每GPU分配</span><span>CPU型号</span><span>硬盘</span><span>驱动/CUDA</span><span>价格(单卡)</span>
              </div>
              <div className="host-row">
                <span><i className="radio-dot" /></span>
                <span><a>{machine}</a></span>
                <span>{item?.gpu_model ?? 'RTX PRO 6000'}<br />{item?.gpu_memory_gb ?? 96}GB</span>
                <span><b>{item?.available ?? 1} / {item?.total ?? 9}</b></span>
                <span>CPU：22核<br />内存：{item?.memory_gb ?? 110}GB</span>
                <span>Xeon(R) Platinum<br />8470Q</span>
                <span>数据盘：{item?.data_disk_gb ?? 50}GB<br />可扩容：5588GB</span>
                <span>驱动：580.95.05<br />CUDA：13.0</span>
                <span className="host-price">￥{money(price)}/时<br /><del>￥{money(originalPrice)}/时</del></span>
              </div>
            </div>

            <div className="rent-line gpu-count-line">
              <label>GPU数量:</label>
              <SegmentButtons items={['1', '2', '3', '4', '5', '6', '7', '8', '9']} selected="1" disabledFrom={2} />
            </div>
            <div className="rent-line disk-line">
              <label>数据盘:</label>
              <span>免费50GB</span>
              <label className="check-label"><i />需要扩容</label>
            </div>

            <div className="spec-box">
              <strong>实例规格：</strong>
              <dl><dt>GPU型号</dt><dd>{item?.gpu_model ?? 'RTX PRO 6000'} * 1卡</dd></dl>
              <dl><dt>CPU</dt><dd>22核</dd></dl>
              <dl><dt>内存</dt><dd>{item?.memory_gb ?? 110}GB</dd></dl>
              <dl><dt>系统盘</dt><dd>30GB</dd></dl>
              <dl><dt>数据盘</dt><dd>免费50GB SSD</dd></dl>
            </div>
          </div>
        </section>

        <section className="rent-panel image-panel">
          <div className="rent-label">镜像:</div>
          <div className="rent-body">
            <SegmentButtons items={['基础镜像', '社区镜像', '我的镜像']} selected="基础镜像" hotIndex={1} />
            <a className="rule-link">没有我要的环境？</a>
            <p>基础镜像包含常用基本软件，如：深度学习框架、Miniconda等。如需其他软件可创建后安装</p>
            <div className="select-input">请选择框架名称/框架版本/Python版本/CUDA版本 <span>⌄</span></div>
          </div>
        </section>

        <section className="rent-panel coupon-panel">
          <div className="rent-label">优惠券:</div>
          <div className="rent-body"><div className="select-input small">请选择 <span>⌄</span></div></div>
        </section>
      </main>

      <div className="rent-footer">
        <span>日常费用:<b>￥0.00</b>/日 <i>?</i></span>
        <span>配置费用:<b>￥{money(price)}</b>/时 <a>费用明细</a></span>
        <small>账户余额￥{balance.toFixed(2)}</small>
        <button type="button" className="ghost">取消</button>
        <button type="button" className="primary">创建并开机</button>
      </div>
    </div>
  );
}

function SegmentButtons({ items, selected, disabledFrom, hotIndex }: { items: string[]; selected: string; disabledFrom?: number; hotIndex?: number }) {
  return (
    <div className="segment-buttons">
      {items.map((item, index) => (
        <button className={item === selected ? 'selected' : ''} disabled={disabledFrom !== undefined && index >= disabledFrom} key={item} type="button">
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
        <div className="provider">{item.provider_mode === 'autodl_elastic' ? '合作商弹性接口' : item.provider}</div>
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
