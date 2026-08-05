/**
 * 交互小说 API 客户端。
 * 复用论坛登录态（forum-auth-token），基地址与论坛一致（forum.060730.xyz / 本地 8787）。
 */
import { getBaseUrl } from '@/forum-bbs/lib/forum/api/client';
import type { NovelCondition, NovelAction, NovelSource } from './schema';

export type { NovelCondition, NovelPage, NovelAction, NovelSource, NovelVariable } from './schema';
export type Condition = NovelCondition;
export type Action = NovelAction;
export type NovelContent = NovelSource;

export interface Novel {
  id: number;
  slug: string;
  title: string;
  description: string;
  tags: string[];
  author_name: string;
  anonymous?: boolean;
  cover_image_url?: string;
  status: string;
  play_count: number;
  like_count: number;
  created_at: string;
  updated_at: string;
  content?: NovelContent;
  source?: NovelSource;
  is_owner?: boolean;
}

export interface AiJob {
  job_id: string;
  novel_id?: number;
  kind: 'generate' | 'refine';
  status: 'pending' | 'done' | 'error';
  billing_status?: 'reserved' | 'settled' | 'refunded' | 'none';
  reserved_points?: number;
  tokens: number;
  cost: number;
  error?: string;
  result?: any;
  prompt?: string;
  title?: string;
  slug?: string;
  created_at: string;
  finished_at?: string;
}

function getToken(): string | null {
  try { return localStorage.getItem('forum-auth-token'); } catch { return null; }
}

async function request<T>(path: string, options: RequestInit & { auth?: boolean } = {}): Promise<T> {
  const { auth, ...fetchOptions } = options;
  const baseUrl = getBaseUrl();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${baseUrl}/api${path}`, { ...fetchOptions, headers });
  if (res.status === 401 && auth) {
    try { localStorage.removeItem('forum-auth-token'); } catch {}
    throw new Error('登录已失效');
  }
  if (!res.ok) {
    let msg = '请求失败';
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      if (body.error) msg = body.error;
      if (body.message) msg = body.message;
    } catch {}
    throw new Error(msg);
  }
  return (await res.json()) as T;
}

// ── 小说 CRUD ──

export function getNovels(params: { q?: string; page?: number; perPage?: number } = {}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('per_page', String(params.perPage));
  return request<{ novels: Novel[]; total: number; page: number }>(`/webnovel/api/novels${qs.toString() ? '?' + qs : ''}`);
}

export function getNovel(slug: string) {
  return request<Novel>(`/webnovel/api/novels/${encodeURIComponent(slug)}`);
}

export function getMyNovels() {
  return request<Novel[]>('/webnovel/api/novels/mine', { auth: true });
}

export function createNovel(data: { title: string; slug?: string; description?: string; tags?: string[]; content?: NovelContent; status?: string }) {
  return request<Novel>('/webnovel/api/novels', { method: 'POST', auth: true, body: JSON.stringify(data) });
}

export function updateNovel(slug: string, data: Partial<Novel>) {
  return request(`/webnovel/api/novels/${encodeURIComponent(slug)}`, { method: 'PUT', auth: true, body: JSON.stringify(data) });
}

export function publishNovel(slug: string, status: string) {
  return request(`/webnovel/api/novels/${encodeURIComponent(slug)}/publish`, { method: 'POST', auth: true, body: JSON.stringify({ status }) });
}

export function deleteNovel(slug: string) {
  return request(`/webnovel/api/novels/${encodeURIComponent(slug)}`, { method: 'DELETE', auth: true });
}

// ── AI 生成 ──

export function aiGenerate(requirement: string) {
  return request<{ job_id: string }>('/webnovel/api/ai/generate', { method: 'POST', auth: true, body: JSON.stringify({ requirement }) });
}

export function aiRefine(slug: string, instruction: string) {
  return request<{ job_id: string }>('/webnovel/api/ai/refine', { method: 'POST', auth: true, body: JSON.stringify({ slug, instruction }) });
}

export function getAiJob(jobId: string) {
  return request<AiJob>(`/webnovel/api/ai/job/${encodeURIComponent(jobId)}`, { auth: true });
}

export function getAiJobs() {
  return request<AiJob[]>('/webnovel/api/ai/jobs', { auth: true });
}

export function getAiStatus() {
  return request<{ enabled: boolean }>('/webnovel/api/ai/status');
}

/** 轮询等待任务完成 */
export async function waitAiJob(jobId: string, onTick?: (seconds: number) => void): Promise<AiJob> {
  const start = Date.now();
  try {
    const token = getToken();
    const res = await fetch(`${getBaseUrl()}/api/webnovel/api/ai/job/${encodeURIComponent(jobId)}/stream`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(10 * 60 * 1000),
    });
    if (res.ok && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const event of events) {
          const dataLine = event.split('\n').find((line) => line.startsWith('data: '));
          if (!dataLine) continue;
          const data = JSON.parse(dataLine.slice(6)) as AiJob;
          if (data.status !== 'pending') return data;
        }
        onTick?.(Math.round((Date.now() - start) / 1000));
      }
    }
  } catch {}

  // SSE 不可用时保留轮询兜底，兼容旧 Worker 和本地开发服务器。
  for (;;) {
    await new Promise((r) => setTimeout(r, 3000));
    onTick?.(Math.round((Date.now() - start) / 1000));
    const job = await getAiJob(jobId);
    if (job.status !== 'pending' || Date.now() - start > 10 * 60 * 1000) return job;
  }
}

// ── 钱包 ──

export interface WalletInfo {
  balance: number;
  total_purchased: number;
  token_per_point: number;
  min_balance: number;
  per_sku: number;
  recharge_url: string | null;
}

export function getWallet() {
  return request<WalletInfo>('/webnovel/api/wallet', { auth: true });
}

export function syncWallet() {
  return request<WalletInfo>('/webnovel/api/wallet/sync', { method: 'POST', auth: true });
}

export interface WalletMail {
  id: number;
  title: string;
  body: string;
  amount: number;
  status: string;
  max_claims: number;
  claimed: boolean;
  sold_out: boolean;
  remaining: number;
  created_at: string;
}

export function getMails() {
  return request<{ items: WalletMail[]; unclaimed_count: number }>('/webnovel/api/mails', { auth: true });
}

export function claimMail(id: number) {
  return request<{ success: boolean; amount: number; balance: number; already_claimed?: boolean }>(
    `/webnovel/api/mails/${id}/claim`,
    { method: 'POST', auth: true },
  );
}

export function getMe() {
  return request<{ username: string; points: number }>('/webnovel/api/me', { auth: true });
}

export function createWalletOrder(points: number) {
  return request<{ order_id: string; points: number; amount_cny: number; pay_url: string | null; status: string }>(
    '/webnovel/api/wallet/orders',
    { method: 'POST', auth: true, body: JSON.stringify({ points }) },
  );
}

export function getMyOrders() {
  return request<Record<string, unknown>[]>('/webnovel/api/wallet/orders', { auth: true });
}

export interface WalletLedgerEntry {
  id: string;
  delta_points: number;
  balance_after: number;
  kind: string;
  reference_id?: string;
  metadata?: string;
  created_at: string;
}

export function getWalletLedger() {
  return request<WalletLedgerEntry[]>('/webnovel/api/wallet/ledger', { auth: true });
}

// ── 社交 ──

export function getSocial(slug: string) {
  return request<{ play_count: number; like_count: number; liked?: boolean }>(`/webnovel/api/social/${encodeURIComponent(slug)}`);
}

export function addView(slug: string) {
  return request(`/webnovel/api/social/${encodeURIComponent(slug)}/view`, { method: 'POST' });
}

/** 点赞/取消点赞切换，返回服务端最终状态 */
export function addLike(slug: string) {
  return request<{ liked: boolean; likeCount: number }>(`/webnovel/api/social/${encodeURIComponent(slug)}/like`, { method: 'POST', auth: true });
}

// ── 图片上传 ──

/** 上传前压缩：GIF 动图跳过（压缩会丢动效）；小于 100KB 的图跳过（压缩无收益且劣化画质）。 */
async function prepareImage(file: File): Promise<File> {
  if (file.type === 'image/gif' || file.size <= 100 * 1024) return file;
  try {
    const { default: compress } = await import('browser-image-compression');
    const result = await compress(file, {
      maxSizeMB: 0.5,
      maxWidthOrHeight: 1200,
      initialQuality: 0.82,
      fileType: file.type,
    });
    // 压缩失败/无收益时退回原图
    return result.size < file.size ? result : file;
  } catch {
    return file;
  }
}

export async function uploadNovelImage(file: File): Promise<string> {
  const upload = await prepareImage(file);
  const form = new FormData();
  form.append('image', upload);
  const token = getToken();
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}/api/webnovel/api/images`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = (await res.json()) as { url?: string; message?: string; error?: string };
  if (!res.ok) throw new Error(data.message || data.error || '上传失败');
  return data.url || '';
}
