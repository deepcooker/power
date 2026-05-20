export type WorkflowMode = 'text_to_image' | 'text_to_video' | 'image_to_video';

export type WorkflowTemplate = {
  id: string;
  title: string;
  mode: WorkflowMode;
  category: string;
  cover: string;
  summary: string;
  priceText: string;
  runCount: string;
  tags: string[];
};

export type WorkflowRunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type WorkflowRunRecord = {
  id: string;
  templateId: string;
  title: string;
  status: WorkflowRunStatus;
  statusText: string;
  mode: WorkflowMode;
  durationText: string;
  costText: string;
  createdAt: string;
  prompt: string;
  ratio: string;
  quality: string;
  seed: string;
  resultType: 'image' | 'video';
};

export type WorkflowCostEstimate = {
  base: number;
  qualityExtra: number;
  durationExtra: number;
  total: number;
  currency: 'compute_coin';
};

export type WorkflowRunPayload = {
  templateId: string;
  mode: WorkflowMode;
  prompt: string;
  negativePrompt?: string;
  ratio: '9:16' | '16:9' | '1:1';
  quality: '720P' | '1080P';
  durationSeconds?: 4 | 6 | 8;
  imageCount?: 1 | 2 | 4;
  styleStrength?: 'low' | 'medium' | 'high';
  seed?: string;
};

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'ltx-video',
    title: 'LTX2.3 图生视频',
    mode: 'image_to_video',
    category: '图生视频',
    cover: 'workflow-ltx-video',
    summary: '上传角色图，一键生成电影感运镜短片',
    priceText: '12算力币/次',
    runCount: '8.6k',
    tags: ['精选', '角色', '短视频'],
  },
  {
    id: 'wan-video',
    title: 'Wan2.2 文生视频',
    mode: 'text_to_video',
    category: '文生视频',
    cover: 'workflow-wan-video',
    summary: '输入剧情提示词，生成高质感商业视频镜头',
    priceText: '18算力币/次',
    runCount: '6.9k',
    tags: ['热门', '剧情', '商业'],
  },
  {
    id: 'product-video',
    title: '商品图动态展示',
    mode: 'image_to_video',
    category: '商品营销',
    cover: 'workflow-product-video',
    summary: '电商主图转 5 秒卖点视频，适合批量投放',
    priceText: '9算力币/次',
    runCount: '5.1k',
    tags: ['商用', '电商', '批量'],
  },
];

export const workflowRunRecords: WorkflowRunRecord[] = [
  {
    id: 'WF-240518',
    templateId: 'ltx-video',
    title: 'LTX2.3 图生视频',
    status: 'succeeded',
    statusText: '生成成功',
    mode: 'image_to_video',
    durationText: '00:01:48',
    costText: '12算力币',
    createdAt: '2026-05-20 17:18',
    prompt: '电影感镜头，人物回头，柔和光线，浅景深，细节丰富',
    ratio: '9:16',
    quality: '1080P',
    seed: '238471',
    resultType: 'video',
  },
];

export function estimateWorkflowCost(payload: WorkflowRunPayload): WorkflowCostEstimate {
  const base = payload.mode === 'text_to_image' ? 5 : payload.mode === 'text_to_video' ? 18 : 12;
  const qualityExtra = payload.quality === '1080P' ? 4 : 0;
  const durationExtra = payload.durationSeconds === 8 ? 6 : 0;
  const imageCountExtra = payload.mode === 'text_to_image' ? ((payload.imageCount ?? 1) - 1) * 2 : 0;
  return {
    base,
    qualityExtra,
    durationExtra,
    total: base + qualityExtra + durationExtra + imageCountExtra,
    currency: 'compute_coin',
  };
}

export async function createWorkflowRun(payload: WorkflowRunPayload): Promise<WorkflowRunRecord> {
  const estimate = estimateWorkflowCost(payload);
  return {
    id: `WF-${Date.now()}`,
    templateId: payload.templateId,
    title: payload.mode === 'text_to_image' ? '文生图生成' : payload.mode === 'text_to_video' ? '文生视频生成' : '图生视频生成',
    status: 'queued',
    statusText: '排队中',
    mode: payload.mode,
    durationText: '-',
    costText: `${estimate.total}算力币`,
    createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    prompt: payload.prompt,
    ratio: payload.ratio,
    quality: payload.quality,
    seed: payload.seed ?? 'random',
    resultType: payload.mode === 'text_to_image' ? 'image' : 'video',
  };
}
