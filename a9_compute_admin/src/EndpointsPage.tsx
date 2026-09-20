import { useMemo, useState } from 'react';
import './endpoints.css';
import './endpoints-font.css';

const clusters = [
  { name: '华北集群', gpu: 'B200', tone: 'blue' },
  { name: '华东集群', gpu: 'H100', tone: 'violet' },
  { name: '西北集群', gpu: 'H800', tone: 'orange' },
  { name: '自有机房', gpu: 'A100', tone: 'green' },
];

const yaml = `name: glm-prod
model: zai-org/GLM-5.2

resources:
  accelerators: B200:8

replicas: 2
routing: kv_cache_aware`;

function Brand() {
  return <a className="ep-brand" href="/compute/home" aria-label="炫界云首页"><span className="ep-brand-mark"><i /><i /><i /></span><b>炫界云</b></a>;
}

function MultiClusterHero() {
  return (
    <div className="ep-hero-visual" aria-label="多集群路由示意图">
      <div className="ep-visual-caption"><span /> MULTI-CLUSTER ROUTING</div>
      <div className="ep-endpoint-pill"><i /> api.xuanjie.cloud <small>统一端点</small></div>
      <div className="ep-route-lines" aria-hidden="true"><span /><span /><span /><span /></div>
      <div className="ep-cluster-row">
        {clusters.map((cluster, index) => <div className={`ep-mini-cluster ${index === 1 ? 'is-failing' : ''}`} key={cluster.name}>
          <header><span className={`ep-cloud-dot ${cluster.tone}`} />{cluster.name}<i>{index === 1 ? '故障转移' : '健康'}</i></header>
          <strong>{cluster.gpu}</strong><small>{index === 1 ? '流量已自动迁移' : `${index + 2} 个副本运行中`}</small>
        </div>)}
      </div>
      <p><span>集群发生故障</span>，你的端点不会中断。</p>
    </div>
  );
}

function ClusterRoutingDemo() {
  const [rps, setRps] = useState(62);
  const [failed, setFailed] = useState<number | null>(null);
  const active = clusters.length - (failed === null ? 0 : 1);
  const replicas = Math.max(4, Math.ceil(rps / 12));
  return (
    <div className="ep-demo ep-routing-demo">
      <header className="ep-demo-head">
        <div><span className="ep-live-dot" />实时流量调度</div>
        <label>请求负载 <b>{rps} RPS</b><input aria-label="请求负载" type="range" min="10" max="100" value={rps} onChange={(event) => setRps(Number(event.target.value))} /></label>
      </header>
      <div className="ep-request-line"><span>统一推理端点</span><i style={{ width: `${rps}%` }} /></div>
      <div className="ep-routing-grid">
        {clusters.map((cluster, index) => {
          const down = failed === index;
          const count = down ? 0 : Math.max(1, Math.round(replicas / active + (index === 0 ? 1 : 0)));
          return <button className={`ep-route-cluster ${down ? 'is-down' : ''}`} type="button" key={cluster.name} onClick={() => setFailed(down ? null : index)}>
            <span className={`ep-cloud-dot ${cluster.tone}`} /><strong>{cluster.name}</strong><small>{cluster.gpu} · {down ? '不可用' : `${count} 副本`}</small>
            <span className="ep-replicas">{Array.from({ length: Math.min(count, 5) }, (_, dot) => <i key={dot} />)}</span>
            <em>{down ? '点击恢复' : '点击模拟故障'}</em>
          </button>;
        })}
      </div>
      <footer><span>{failed === null ? '所有集群健康，按延迟和容量分配流量' : `${clusters[failed].name} 已隔离，流量正在由其余集群承接`}</span><b>{replicas} 个服务副本</b></footer>
    </div>
  );
}

type Tab = 'overview' | 'metrics' | 'logs' | 'playground';

function EndpointDashboard() {
  const [tab, setTab] = useState<Tab>('overview');
  const tabs: Array<[Tab, string]> = [['overview', '概览'], ['metrics', '指标'], ['logs', '日志'], ['playground', '在线调试']];
  return (
    <div className="ep-dashboard">
      <header><span className="ep-window-dots"><i /><i /><i /></span><b>glm-prod</b><em><i />运行中</em></header>
      <nav>{tabs.map(([id, label]) => <button className={tab === id ? 'active' : ''} type="button" key={id} onClick={() => setTab(id)}>{label}</button>)}</nav>
      <div className="ep-dashboard-body">
        {tab === 'overview' && <div className="ep-overview">
          <div className="ep-stat"><span>当前请求</span><strong>1,284</strong><small>RPS</small></div>
          <div className="ep-stat"><span>P95 延迟</span><strong>187</strong><small>ms</small></div>
          <div className="ep-stat"><span>可用率</span><strong>99.99</strong><small>%</small></div>
          <div className="ep-chart"><span>请求吞吐</span><div>{[35,48,43,57,52,68,64,78,73,88,81,92,86,95,90,98].map((height, i) => <i style={{ height: `${height}%` }} key={i} />)}</div><small>过去 30 分钟</small></div>
        </div>}
        {tab === 'metrics' && <div className="ep-metrics"><div><span>吞吐量</span><b>1.28k req/s</b><i style={{ width: '82%' }} /></div><div><span>GPU 利用率</span><b>86.4%</b><i style={{ width: '86%' }} /></div><div><span>KV Cache 命中</span><b>93.1%</b><i style={{ width: '93%' }} /></div></div>}
        {tab === 'logs' && <pre className="ep-logs"><span>14:32:08</span> router  route selected cluster=west-b replica=glm-07{`\n`}<span>14:32:08</span> engine  request completed status=200 latency=176ms{`\n`}<span>14:32:09</span> scaler  target replicas unchanged current=8 desired=8{`\n`}<span>14:32:10</span> gateway health probe passed region=north-a</pre>}
        {tab === 'playground' && <div className="ep-playground"><textarea aria-label="调试提示词" defaultValue="请用三句话解释多集群推理的优势。" /><button type="button">发送请求 <span>→</span></button><p>请求将通过当前生产端点执行。</p></div>}
      </div>
    </div>
  );
}

function GpuSharingDemo() {
  const [rps, setRps] = useState(66);
  const inference = Math.max(2, Math.round(rps / 8));
  const dynamicInference = Math.min(15, inference);
  const staticDropped = Math.max(0, inference - 8);
  const tiles = useMemo(() => Array.from({ length: 16 }, (_, index) => index), []);
  return (
    <div className="ep-demo ep-gpu-demo">
      <header className="ep-demo-head"><div><span className="ep-live-dot" />GPU 资源池</div><label>在线请求 <b>{rps} RPS</b><input aria-label="在线请求" type="range" min="10" max="120" value={rps} onChange={(event) => setRps(Number(event.target.value))} /></label></header>
      <div className="ep-gpu-compare">
        <section><header><div><strong>静态分区</strong><small>8 推理 / 8 训练</small></div><em>传统方式</em></header><div className="ep-gpu-grid">{tiles.map((tile) => <i className={tile < 8 ? (tile < Math.min(inference, 8) ? 'inference' : 'idle') : 'training'} key={tile}>{tile < 8 ? 'I' : 'T'}</i>)}</div><footer><span>{staticDropped ? <b className="ep-danger">{staticDropped * 12} RPS 排队</b> : '容量正常'}</span><small>资源固定，无法借用</small></footer></section>
        <section className="is-dynamic"><header><div><strong>统一资源池</strong><small>按优先级动态分配</small></div><em>炫界云</em></header><div className="ep-gpu-grid">{tiles.map((tile) => <i className={tile < dynamicInference ? 'inference' : 'training'} key={tile}>{tile < dynamicInference ? 'I' : 'T'}</i>)}</div><footer><span><b>{dynamicInference}</b> 推理 · <b>{16 - dynamicInference}</b> 训练</span><small>训练任务自动暂停与恢复</small></footer></section>
      </div>
      <p><i className="inference" /> 在线推理 <i className="training" /> 训练任务 <i className="idle" /> 空闲 GPU</p>
    </div>
  );
}

export function EndpointsPage() {
  const [copied, setCopied] = useState(false);
  const copyYaml = async () => {
    await navigator.clipboard?.writeText(yaml);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <div className="ep-page">
      <header className="ep-site-header"><Brand /><nav><a href="#multi-cluster">多集群</a><a href="#one-yaml">统一配置</a><a href="#gpu-sharing">资源共享</a><a href="/compute/docs">文档</a></nav><a className="ep-header-cta" href="/compute/dashboard">进入控制台 <span>↗</span></a></header>
      <main>
        <article className="ep-article">
          <header className="ep-article-head"><span className="ep-kicker">产品发布 · ENDPOINTS</span><h1>生产级推理，运行在你拥有的每一个集群</h1><p>一个声明式配置，把模型服务部署到任意 GPU 集群。自动完成路由、扩缩容、故障转移与可观测性。</p><div className="ep-byline"><span className="ep-author">炫</span><div><b>炫界云基础设施团队</b><small>2026 年 9 月 2 日 · 8 分钟阅读</small></div></div></header>
          <MultiClusterHero />
          <div className="ep-article-layout">
            <aside className="ep-toc"><span>本文内容</span><a href="#multi-cluster">多集群推理</a><a href="#one-yaml">一份配置，一个面板</a><a href="#gpu-sharing">推理与训练共享</a><a href="#production">生产级能力</a><a href="#early-access">开始使用</a></aside>
            <div className="ep-content">
              <p className="ep-lead">炫界云 Endpoints 是面向大模型推理的新一代服务层。只需一份 YAML，即可把推理引擎、自动扩缩容、网关、证书和监控指标部署到多个 Kubernetes 或 GPU 集群，并通过同一个稳定地址对外服务。</p>
              <p>它建立在现有算力资源之上，不要求迁移集群，也不锁定云厂商。你的 GPU 仍在原来的位置，调度和服务交付变得一致。</p>

              <section id="multi-cluster"><span className="ep-section-index">01</span><h2>多集群推理，复杂性留在平台内</h2><p>模型推理跨越公有云、合作算力和自有机房时，真正困难的不是启动容器，而是持续处理放置、扩缩容和故障恢复。</p><ul><li><b>智能放置</b> 根据 GPU 型号、库存、成本和地域延迟选择集群。</li><li><b>弹性伸缩</b> 流量变化时自动调整副本，跨集群补充容量。</li><li><b>故障转移</b> 集群不可用时隔离故障并迁移请求，端点地址保持不变。</li></ul><ClusterRoutingDemo /><p className="ep-caption">拖动负载或点击任一集群，查看统一端点如何实时重排流量。</p></section>

              <section id="one-yaml"><span className="ep-section-index">02</span><h2>一份 YAML，一个控制面板</h2><p>从推理引擎到生产网关，不再需要拼接多套配置。声明模型、资源和副本策略，平台负责把意图转换为可运行的服务。</p><div className="ep-code"><header><span>endpoint.yaml</span><button type="button" onClick={copyYaml}>{copied ? '已复制' : '复制'}</button></header><pre><code>{yaml}</code></pre><footer><span>$</span> sky endpoint up endpoint.yaml</footer></div><p>兼容 vLLM、SGLang、TensorRT-LLM 等推理引擎，并可接入 KServe、KEDA、Gateway API、cert-manager 与 Prometheus。底层组件可以替换，对外服务契约保持稳定。</p><EndpointDashboard /><p className="ep-caption">端点、吞吐、延迟、日志与在线调试集中在同一个操作界面。</p></section>

              <section id="gpu-sharing"><span className="ep-section-index">03</span><h2>白天做推理，夜间跑训练</h2><p>静态划分 GPU 会让推理高峰容量不足、低峰资源空闲。统一资源池按任务优先级动态分配：在线推理优先获得 GPU，训练任务在流量回落后自动恢复。</p><GpuSharingDemo /><p>同一批 GPU 可以同时承载在线业务和离线作业。平台记录每次抢占、恢复和资源变更，业务侧只需要关注服务等级与成本。</p></section>

              <section id="production"><span className="ep-section-index">04</span><h2>为性能、可靠性与可观测性而设计</h2><div className="ep-feature-list"><article><span>01</span><div><h3>性能</h3><p>支持 KV Cache 感知路由、连续批处理和硬件亲和放置，让请求优先到达最适合的副本。</p></div></article><article><span>02</span><div><h3>可靠性</h3><p>端点健康检查、跨集群故障转移和声明式恢复共同工作，单个集群故障不会改变调用地址。</p></div></article><article><span>03</span><div><h3>可观测性</h3><p>统一采集请求、模型、GPU 与调度指标，并将日志和告警关联到具体端点与副本。</p></div></article></div></section>

              <section className="ep-access" id="early-access"><span className="ep-section-index">05</span><h2>把模型交付变成一个端点</h2><p>从第一张 GPU 到跨地域生产集群，使用同一套声明和操作方式。</p><div><a href="/compute/deployments/create">创建推理端点 <span>→</span></a><a href="/compute/docs">阅读技术文档</a></div></section>
            </div>
          </div>
        </article>
      </main>
      <footer className="ep-footer"><div><Brand /><h2>让 AI 基础设施跟上模型迭代速度。</h2><p>统一调度每一张 GPU，稳定交付每一个端点。</p><a href="/compute/dashboard">进入炫界云控制台 <span>→</span></a></div><small>© 2026 炫界云 · Yaochuang Technology</small></footer>
    </div>
  );
}
