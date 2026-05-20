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
  {
    id: 'avatar-video',
    title: '数字人口播片段',
    mode: 'image_to_video',
    category: '数字人',
    cover: 'workflow-avatar',
    summary: '上传人像和口播文案，生成竖版短视频',
    priceText: '15算力币/次',
    runCount: '4.8k',
    tags: ['新', '数字人', '口播'],
  },
  {
    id: 'cyber-style',
    title: '赛博风格转绘',
    mode: 'text_to_image',
    category: '风格化',
    cover: 'workflow-cyber-style',
    summary: '普通照片转赛博朋克风图像和视频封面',
    priceText: '6算力币/次',
    runCount: '9.2k',
    tags: ['爆款', '风格化', '封面'],
  },
  {
    id: 'comic-storyboard',
    title: '漫画分镜生成',
    mode: 'text_to_image',
    category: '图像设计',
    cover: 'workflow-comic-storyboard',
    summary: '提示词生成连续分镜，支持二次编辑',
    priceText: '5算力币/次',
    runCount: '3.7k',
    tags: ['精选', '分镜', '漫画'],
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
  {
    id: 'WF-240519',
    templateId: 'product-video',
    title: '商品图动态展示',
    status: 'running',
    statusText: '生成中',
    mode: 'image_to_video',
    durationText: '00:00:36',
    costText: '9算力币',
    createdAt: '2026-05-20 17:11',
    prompt: '玻璃质感产品，慢速环绕，金色高光，电商主图展示',
    ratio: '1:1',
    quality: '1080P',
    seed: '884120',
    resultType: 'video',
  },
  {
    id: 'WF-240520',
    templateId: 'wan-video',
    title: 'Wan2.2 文生视频',
    status: 'queued',
    statusText: '排队中',
    mode: 'text_to_video',
    durationText: '-',
    costText: '18算力币',
    createdAt: '2026-05-20 17:02',
    prompt: '城市雨夜，霓虹反射，人物穿过街道，电影感推镜',
    ratio: '16:9',
    quality: '1080P',
    seed: 'random',
    resultType: 'video',
  },
  {
    id: 'WF-240521',
    templateId: 'cyber-style',
    title: '赛博风格转绘',
    status: 'failed',
    statusText: '生成失败',
    mode: 'text_to_image',
    durationText: '00:00:52',
    costText: '0算力币',
    createdAt: '2026-05-20 16:44',
    prompt: '赛博朋克角色头像，霓虹光，未来城市背景',
    ratio: '1:1',
    quality: '1080P',
    seed: '238471',
    resultType: 'image',
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
