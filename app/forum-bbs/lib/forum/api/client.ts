import type {
  ForumPostSummary,
  ForumPostDetail,
  ForumPostInput,
  ForumComment,
  ForumCommentInput,
  ForumCategory,
  ForumUser,
  ForumConfig,
  AdminStats,
  ApiListResult,
  SortOption,
  CommentSort,
  ForumAnnouncement,
  ChannelPolicy,
} from '../types';

export type { ChannelPolicy };
import { track } from '@/forum-bbs/lib/track';
import { withBase } from '@/forum-bbs/lib/base-path';
import { stripBase } from '@/forum-bbs/lib/seo/route-meta';
import { siteConfig } from '@/forum-bbs/lib/site-config';
import { type RawPost, mapPost } from './map-post';
import { type RawComment, mapComment, getCommentSortParams } from './map-comment';
// buildCommentTree 历史上从这里导出，消费方沿用该路径
export { buildCommentTree } from './map-comment';

export type ForumApiEnv = 'prod' | 'dev';

export const FORUM_API_BASE_URLS: Record<ForumApiEnv, string> = {
  // VITE_FORUM_API_BASE（构建期环境变量）优先，兜底读 site.config.json 的 forumApiBase
  prod: import.meta.env.VITE_FORUM_API_BASE || siteConfig.forumApiBase,
  dev: 'http://127.0.0.1:8787',
};

/**
 * 论坛 API 根地址。SSE 那条流不走 forumRequest，需要自己拼 URL，故导出。
 *
 * 独立部署后浏览器**直连**后端（后端 CORS 是 `*`），不再有主站
 * `/forum/api/* → 127.0.0.1:8787` 那层同源代理。所以 localStorage 里若存着
 * 一个**路径**形式的旧值（主站曾往里写过 `/forum`），在这里必须当作无效丢掉 ——
 * 否则请求会打到本站根本不存在的 `/forum/api/...` 上，整站接口全 404。
 */
export function getBaseUrl(): string {
  if (typeof window === 'undefined') return FORUM_API_BASE_URLS.prod;
  try {
    const saved = localStorage.getItem('forum-api-base-url');
    if (!saved) return FORUM_API_BASE_URLS.prod;
    // 显式处于 dev 环境（EnvironmentSwitcher 切到「开发」）时，
    // 放行本地 http 调试地址（127.0.0.1/localhost），否则 dev 切换会白切。
    const env = localStorage.getItem('forum-api-env');
    if (env === 'dev' && /^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?\//.test(saved + '/')) return saved;
    // 非 dev：只接受 https 且非本机/原作者地址；本地残留与 i.2x.nz 一律忽略，
    // 避免缝合进大前端后误打错后端
    if (/^https:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)(?!i\.2x\.nz)([^/]+)/.test(saved)) return saved;
  } catch {}
  return FORUM_API_BASE_URLS.prod;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem('forum-auth-token');
  } catch {
    return null;
  }
}

class ForumApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ForumApiError';
    this.status = status;
    this.code = code;
  }
}

/**
 * TOTP 相关判断（B-4）：以 code 为准（message 未来可能中文化）。
 */
export function isTotpError(e: unknown): boolean {
  return e instanceof ForumApiError && !!e.code && e.code.startsWith('TOTP_');
}

/** TOTP_INVALID 转友好文案；其余透传 */
export function totpErrorText(e: unknown): string {
  if (e instanceof ForumApiError && e.code === 'TOTP_INVALID') return '验证码错误，请重试';
  return e instanceof Error ? e.message : '验证失败';
}

async function forumRequest<T>(
  path: string,
  options: RequestInit & { skipAuthRedirect?: boolean } = {},
): Promise<T> {
  const { skipAuthRedirect, ...fetchOptions } = options;
  const baseUrl = getBaseUrl();
  const token = getToken();
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // CSRF protection for mutating requests
  if (options.method && !['GET', 'HEAD'].includes(options.method)) {
    headers['X-Timestamp'] = String(Math.floor(Date.now() / 1000));
    headers['X-Nonce'] = crypto.randomUUID?.() || Math.random().toString(36);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(url, {
      ...fetchOptions,
      headers,
      signal: controller.signal,
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    let errMsg = '请求失败';
    let errCode: string | undefined;
    try {
      const body = (await res.json()) as Record<string, any>;
      errMsg = body.message || body.error || errMsg;
      errCode = body.code;
    } catch {}

    // 401 → 跳转登录（跳过 TOTP 相关状态码，交由调用方处理）
    const TOTP_CODES = ['TOTP_REQUIRED', 'TOTP_INVALID'];
    if (res.status === 401 && errCode && TOTP_CODES.includes(errCode)) {
      // TOTP 相关错误——不登出，直接抛给调用方
    } else if (res.status === 401 && !skipAuthRedirect) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('forum-auth-token');
        // redirect 里存的是**站内**路径（不含部署前缀），登录页跳回时再补
        window.location.href =
          withBase('/auth/login') +
          '?redirect=' +
          encodeURIComponent(stripBase(window.location.pathname));
      }
    }

    throw new ForumApiError(errMsg, res.status, errCode);
  } catch (e) {
    if (e instanceof ForumApiError) throw e;
    // B-22：超时/网络错误统一友好文案（不暴露英文 abort 原文）
    throw new ForumApiError(
      e instanceof Error && e.name === 'AbortError' ? '请求超时，请稍后重试' : '网络错误，请检查连接后重试',
      0,
    );
  } finally {
    clearTimeout(timeout);
  }
}

// ── Response mapping (API uses snake_case, we use camelCase) ──

// RawPost / extractFirstImageUrl / mapPost 已抽到 ./map-post，与服务端 loader 共用

function mapUser(raw: Record<string, unknown>): ForumUser {
  return {
    id: String(raw.id ?? raw.user_id ?? ''),
    username: String(raw.username ?? ''),
    displayName: raw.display_name as string | undefined,
    avatarUrl: (raw.avatar_url as string) || (raw.avatarUrl as string) || undefined,
    bio: (raw.bio as string) || undefined,
    gender: raw.gender as 'male' | 'female' | 'other' | undefined,
    age: raw.age as number | undefined,
    region: raw.region as string | undefined,
    email: raw.email as string | undefined,
    role: raw.role as string | undefined,
    createdAt: (raw.created_at as string) || undefined,
    lastSeenAt: (raw.last_seen_at as string) || null,
    emailNotifications: raw.email_notifications as boolean | undefined,
    articleNotifications: raw.article_notifications as boolean | undefined,
    totpEnabled: raw.totp_enabled as boolean | undefined,
    verified: raw.verified as boolean | undefined,
    githubId: (raw.github_id as number) ?? null,
    githubLogin: raw.github_login as string | null | undefined,
    githubAvatarUrl: raw.github_avatar_url as string | null | undefined,
    qq: raw.qq as string | null | undefined,
    hasPassword: raw.has_password as boolean | undefined,
  };
}

// ── Auth ──

export async function login(body: { email: string; password: string; totpCode?: string; turnstileToken?: string }) {
  const raw = await forumRequest<Record<string, unknown>>('/api/login', {
    method: 'POST',
    skipAuthRedirect: true,
    body: JSON.stringify({
      email: body.email,
      password: body.password,
      totp_code: body.totpCode,
      'cf-turnstile-response': body.turnstileToken,
    }),
  });
  return { token: raw.token as string, user: mapUser(resolveUser(raw)) };
}

export async function register(body: { username: string; email: string; password: string; turnstileToken?: string }) {
  const raw = await forumRequest<Record<string, unknown>>('/api/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  track('注册账号');
  return { token: raw.token as string, user: mapUser(resolveUser(raw)) };
}

// ── Password Reset ──

export async function forgotPassword(payload: { email: string; turnstileToken?: string }) {
  return forumRequest<{ success?: boolean }>('/api/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({
      email: payload.email,
      'cf-turnstile-response': payload.turnstileToken,
    }),
  });
}

export async function resetPassword(payload: { token: string; newPassword: string; totpCode?: string; turnstileToken?: string }) {
  return forumRequest<{ success?: boolean }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({
      token: payload.token,
      new_password: payload.newPassword,
      totp_code: payload.totpCode,
      'cf-turnstile-response': payload.turnstileToken,
    }),
  });
}

export function logout(token?: string) {
  // token 可显式传入：乐观退出时 localStorage 已被清空，需用清空前的 token 吊销服务端会话
  return forumRequest<{ success?: boolean }>('/api/logout', {
    method: 'POST',
    skipAuthRedirect: true,
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  });
}

function resolveUser(raw: Record<string, unknown>): Record<string, unknown> {
  // Match old project's resolveSessionUser: prefer nested `user` field
  if (raw.user && typeof raw.user === 'object') return raw.user as Record<string, unknown>;
  // Fallback: construct from top-level fields if they look like user data
  if (raw.id !== undefined || raw.email || raw.username) return raw;
  return {};
}

export async function getSession() {
  const raw = await forumRequest<Record<string, unknown>>('/api/session');
  return mapUser(resolveUser(raw));
}

export async function getCurrentUser(opts: { skipAuthRedirect?: boolean } = {}) {
  const raw = await forumRequest<Record<string, unknown>>('/api/user/me', {
    skipAuthRedirect: opts.skipAuthRedirect,
  });
  return mapUser(resolveUser(raw));
}

// ── Users / Profile ──

export async function updateProfile(payload: {
  username: string;
  avatarUrl?: string;
  emailNotifications?: boolean;
  articleNotifications?: boolean;
}) {
  return forumRequest('/api/user/profile', {
    method: 'POST',
    body: JSON.stringify({
      username: payload.username,
      avatar_url: payload.avatarUrl || '',
      email_notifications: payload.emailNotifications,
      article_notifications: payload.articleNotifications,
    }),
  });
}

export async function updateMyProfile(payload: {
  gender?: string | null;
  bio?: string | null;
  age?: number | null;
  region?: string | null;
}) {
  return forumRequest('/api/user/me/profile', {
    method: 'POST',
    body: JSON.stringify({
      gender: payload.gender ?? null,
      bio: payload.bio ?? null,
      age: payload.age ?? null,
      region: payload.region ?? null,
    }),
  });
}

export async function changeEmail(payload: { newEmail: string; totpCode?: string }) {
  return forumRequest<{ success?: boolean; message?: string }>('/api/user/change-email', {
    method: 'POST',
    body: JSON.stringify({ new_email: payload.newEmail, totp_code: payload.totpCode }),
  });
}

export async function uploadFile(file: File, type: 'avatar' | 'post' = 'avatar') {
  // Compress image to stay under 500KB
  let target = file;
  if (file.type.startsWith('image/')) {
    try {
      const imageCompression = (await import('browser-image-compression')).default;
      const isAvatar = type === 'avatar';
      target = await imageCompression(file, {
        // 头像全站最大只显示到 h-14（56px），DPR2 下 128px 已经绰绰有余。
        // 此前是 512px / 200KB，实测线上真有 199KB 的头像被拿来画 20 像素。
        maxSizeMB: isAvatar ? 0.03 : 0.5,
        maxWidthOrHeight: isAvatar ? 128 : 1200,
        initialQuality: isAvatar ? 0.75 : 0.82,
        // 头像统一转 webp：同画质下比 png/jpg 小一大截，且头像不需要保留原格式
        fileType: isAvatar ? 'image/webp' : file.type,
      });
    } catch {}
  }

  const formData = new FormData();
  formData.append('file', target);
  formData.append('type', type);
  const token = localStorage.getItem('forum-auth-token');
  // 走 getBaseUrl() 而不是自己再读一遍 localStorage：那份旧写法会把主站写进去的
  // 路径型代理地址（`/forum`）当成 API 根，上传直接打到不存在的路径上
  const baseUrl = getBaseUrl();
  const ts = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomUUID?.() || Math.random().toString(36);
  const res = await fetch(`${baseUrl}/api/upload`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      'X-Timestamp': String(ts),
      'X-Nonce': nonce,
    },
    body: formData,
  });
  const data = (await res.json()) as Record<string, any>;

  if (!res.ok) {
    throw new Error(data.error || data.message || '上传失败');
  }

  return (data.url || data.path || data.image_url || data.urls?.[0] || '') as string;
}

// ── 登录设备（会话）──

export interface ForumSession {
  jti: string;
  created_at: string | null;
  expires_at: number;
  user_agent: string | null;
  ip: string | null;
  last_seen_at: number | null;
  /** ISO 3166-1 alpha-2，来自 CF-IPCountry；拿不到时为 null */
  country: string | null;
  /** 城市或省份，需在 CF 开启 visitor location headers；否则为 null */
  city: string | null;
  /** 是否为当前这台设备 */
  current: boolean;
}

export function getMySessions() {
  return forumRequest<ForumSession[]>('/api/user/sessions');
}

export function revokeSession(jti: string) {
  return forumRequest<{ success: boolean }>(
    `/api/user/sessions/${encodeURIComponent(jti)}`,
    { method: 'DELETE' },
  );
}

/** 吊销除本机外的全部设备；返回被踢下线的数量 */
export function revokeOtherSessions() {
  return forumRequest<{ success: boolean; revoked: number }>(
    '/api/user/sessions/revoke-others',
    { method: 'POST', body: '{}' },
  );
}

// ── TOTP ──

export async function setupTotp() {
  return forumRequest<{ secret: string; uri?: string; otpauth_url?: string }>('/api/user/totp/setup', {
    method: 'POST',
    body: '{}',
  });
}

export async function verifyTotp(payload: { token: string }) {
  return forumRequest('/api/user/totp/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function disableTotp(payload: { password: string; totpCode: string }) {
  return forumRequest('/api/user/totp/disable', {
    method: 'POST',
    body: JSON.stringify({ password: payload.password, totp_code: payload.totpCode }),
  });
}

// ── GitHub ──

export async function startGithubOAuth(mode: string, redirect: string) {
  return forumRequest<{ authorize_url: string }>(`/api/auth/github/start?mode=${mode}&redirect=${encodeURIComponent(redirect)}`);
}

export async function unlinkGithub() {
  return forumRequest('/api/auth/github/unlink', { method: 'POST' });
}

// ── Danger ──

export async function deleteAccount(payload: { password: string; totpCode?: string }) {
  return forumRequest('/api/user/delete', {
    method: 'POST',
    body: JSON.stringify({ password: payload.password, totp_code: payload.totpCode }),
  });
}

// ── Posts ──

export function getPosts(query: Record<string, string | number | undefined> = {}) {
  const sortMap: Record<string, string> = {
    latest: 'time',
    oldest: 'time_asc',
    likes: 'likes',
    comments: 'comments',
    views: 'views',
  };
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Number(query.pageSize) || 20;
  const params: Record<string, string | undefined> = {
    q: query.search ? String(query.search) : undefined,
    category_id: query.category ? String(query.category) : undefined,
    sort_by: query.sort ? sortMap[String(query.sort)] || String(query.sort) : undefined,
    limit: String(limit),
    offset: String((page - 1) * limit),
  };
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join('&');
  return forumRequest<{ posts: RawPost[]; total: number }>(`/api/posts${qs ? '?' + qs : ''}`)
    .then((data) => ({
      data: data.posts.map(mapPost),
      total: data.total,
    }));
}

export function getPost(id: string) {
  return forumRequest<RawPost>(`/api/posts/${id}`)
    .then((raw) => mapPost(raw) as ForumPostDetail);
}

// 论坛埋点一律挂在 .then 上，失败的请求不算数（校验没过、被限流、Turnstile 挡了
// 都会走 reject）。也不带标题/正文，那是用户内容
export function createPost(body: ForumPostInput) {
  return forumRequest<ForumPostDetail>('/api/posts', {
    method: 'POST',
    body: JSON.stringify({
      title: body.title,
      categoryId: body.categoryId,
      content: body.content,
      'cf-turnstile-response': body.turnstileToken,
    }),
  }).then((r) => {
    track('论坛发布', { 类型: '帖子' });
    return r;
  });
}

export function updatePost(id: string, body: Partial<ForumPostInput>) {
  return forumRequest<ForumPostDetail>(`/api/posts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deletePost(id: string) {
  return forumRequest<void>(`/api/posts/${id}`, { method: 'DELETE' });
}

export async function likePost(id: string) {
  const raw = await forumRequest<Record<string, unknown>>(`/api/posts/${id}/like`, { method: 'POST' });
  const liked = Boolean(raw.liked);
  // 这个接口是切换：取消点赞也会回 200，只是 liked=false —— 别把两者混成一条
  track('论坛点赞', { 对象: '帖子', 动作: liked ? '点赞' : '取消' });
  return { liked, likeCount: (raw.likeCount ?? raw.like_count ?? 0) as number };
}

/**
 * 当前用户是否点过赞。SSR 拿不到登录态（loader 那份 `liked` 恒为 false），
 * 水合后由客户端补拉这一个轻量接口修正 —— 比重新拉整篇帖子便宜得多。
 */
export async function getPostLikeStatus(id: string) {
  const raw = await forumRequest<Record<string, unknown>>(`/api/posts/${id}/like-status`);
  return { liked: Boolean(raw.liked) };
}

// ── Comments ──

export function getComments(postId: string, sort: CommentSort = 'hot') {
  const params = getCommentSortParams(sort);
  return forumRequest<RawComment[]>(`/api/posts/${postId}/comments?sort_by=${params.sortBy}&sort_dir=${params.sortDir}`)
    .then((raw) => raw.map(mapComment));
}

export function createComment(postId: string, body: ForumCommentInput) {
  return forumRequest<RawComment>(`/api/posts/${postId}/comments`, {
    method: 'POST',
    body: JSON.stringify({
      content: body.content,
      parent_id: body.parentId,
      'cf-turnstile-response': body.turnstileToken,
    }),
  }).then((raw) => {
    track('论坛发布', { 类型: body.parentId ? '回复' : '评论' });
    return mapComment(raw);
  });
}

export function deleteComment(id: string) {
  return forumRequest<void>(`/api/comments/${id}`, { method: 'DELETE' });
}

export async function likeComment(id: string) {
  const raw = await forumRequest<Record<string, unknown>>(`/api/comments/${id}/like`, { method: 'POST' });
  const liked = Boolean(raw.liked);
  track('论坛点赞', { 对象: '评论', 动作: liked ? '点赞' : '取消' });
  return { liked, likeCount: (raw.likeCount ?? raw.like_count ?? 0) as number };
}

export function pinComment(id: string, pinned: boolean) {
  return forumRequest<ForumComment>(`/api/comments/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ is_pinned: pinned }),
  });
}

// ── Categories ──

export function getCategories() {
  return forumRequest<ForumCategory[]>('/api/categories');
}

// ── Config ──

export function getForumConfig() {
  return forumRequest<ForumConfig>('/api/config');
}

// ── Users ──

export function getUserProfile(id: string) {
  // 后端返回 snake_case，需走 mapUser 转 camelCase（此前直接透传，字段对不上）
  return forumRequest<Record<string, unknown>>(`/api/users/${id}`).then(mapUser);
}

export function getUserPosts(id: string) {
  // 后端返回 snake_case，走 mapPost 映射（与列表/详情一致）
  return forumRequest<RawPost[]>(`/api/users/${id}/posts`).then((raw) => raw.map(mapPost));
}

// ── Admin ──

export function getAdminStats() {
  return forumRequest<AdminStats>('/api/admin/stats');
}

export function getAdminSettings() {
  return forumRequest<Record<string, unknown>>('/api/admin/settings');
}

export function saveAdminSettings(settings: Record<string, unknown>) {
  return forumRequest('/api/admin/settings', {
    method: 'POST',
    body: JSON.stringify(settings),
  });
}

export function getAdminUsers(query?: string) {
  const qs = query?.trim() ? `?q=${encodeURIComponent(query.trim())}` : '';
  return forumRequest<Record<string, unknown>[]>(`/api/admin/users${qs}`);
}

export function updateAdminUser(id: string, payload: Record<string, unknown>) {
  return forumRequest(`/api/admin/users/${id}/update`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyAdminUser(id: string) {
  return forumRequest(`/api/admin/users/${id}/verify`, { method: 'POST', body: '{}' });
}

/** 修改用户角色（user / admin / bot / verified） */
export function setAdminUserRole(id: string, role: string) {
  return forumRequest(`/api/admin/users/${id}/role`, {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
}

/** 封禁 / 解封用户 */
export function setAdminUserBan(id: string, banned: boolean) {
  return forumRequest(`/api/admin/users/${id}/ban`, {
    method: 'POST',
    body: JSON.stringify({ banned }),
  });
}

export function deleteAdminUser(id: string) {
  return forumRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
}

export function deleteAdminPost(id: string) {
  return forumRequest(`/api/admin/posts/${id}`, { method: 'DELETE' });
}

export function getAdminCategories() {
  return forumRequest<Record<string, unknown>[]>('/api/categories');
}

export function createAdminCategory(name: string) {
  return forumRequest('/api/admin/categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function updateAdminCategory(id: string, name: string) {
  return forumRequest(`/api/admin/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deleteAdminCategory(id: string) {
  return forumRequest(`/api/admin/categories/${id}`, { method: 'DELETE' });
}

export function sendAdminTestEmail(payload: { to: string; template: string }) {
  return forumRequest('/api/admin/email/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function scanAdminStorageGc() {
  return forumRequest<{ total: number; orphanCount: number; orphans?: string[] }>('/api/admin/cleanup/analyze');
}

export function cleanupAdminStorageGc(orphans: string[]) {
  return forumRequest('/api/admin/cleanup/execute', {
    method: 'POST',
    body: JSON.stringify({ orphans }),
  });
}

// ── 存储用量/配置（多桶）──

export interface StorageBucketUsage {
  id: string;
  type: string;
  usedBytes: number;
  maxBytes: number;
}

export interface StorageUsageResult {
  buckets: StorageBucketUsage[];
  strategy: string;
}

export function getAdminStorageUsage() {
  return forumRequest<StorageUsageResult>('/api/admin/storage/usage');
}

export interface StorageBucketConfigInfo {
  id: string;
  type: string;
  binding?: string | null;
  endpoint?: string | null;
  bucket?: string | null;
  region?: string | null;
  maxBytes: number;
}

export interface StorageConfigResult {
  strategy: string;
  buckets: StorageBucketConfigInfo[];
}

export function getAdminStorageConfig() {
  return forumRequest<StorageConfigResult>('/api/admin/storage/config');
}

export interface StorageBucketRecord {
  id: string;
  type: string;
  binding?: string | null;
  endpoint?: string | null;
  bucket?: string | null;
  region?: string | null;
  force_path_style: boolean;
  max_bytes: number;
  enabled: boolean;
  sort_order: number;
  has_secret: boolean;
}

export interface StorageBucketsResult {
  strategy: string;
  buckets: StorageBucketRecord[];
}

export function getAdminStorageBuckets() {
  return forumRequest<StorageBucketsResult>('/api/admin/storage/buckets');
}

export function saveAdminStorageBucket(data: Record<string, unknown>) {
  return forumRequest<{ success: boolean }>('/api/admin/storage/buckets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteAdminStorageBucket(id: string) {
  return forumRequest<{ success: boolean }>(`/api/admin/storage/buckets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export function setAdminStorageStrategy(strategy: string) {
  return forumRequest<{ success: boolean }>('/api/admin/storage/strategy', {
    method: 'POST',
    body: JSON.stringify({ strategy }),
  });
}

// ── 交互小说（webnovel）管理 ──

export interface WebnovelOrder {
  id: string;
  user_id: number;
  points: number;
  amount_cny: number;
  status: string;
  out_trade_no?: string;
  created_at: string;
  paid_at?: string;
}

export function getAdminWebnovelOrders() {
  return forumRequest<WebnovelOrder[]>('/api/webnovel/api/admin/orders');
}

/** 订单手动确认（webhook 自动确认的兜底） */
export function confirmAdminWebnovelOrder(id: string) {
  return forumRequest<{ success: boolean; balance: number }>(`/api/webnovel/api/admin/orders/${encodeURIComponent(id)}/confirm`, {
    method: 'POST',
  });
}

export function giveWebnovelPoints(userId: number, points: number) {
  return forumRequest<{ success: boolean; balance: number }>('/api/webnovel/api/admin/wallets/give', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, points }),
  });
}

export interface WebnovelMailRecord {
  id: number;
  title: string;
  body: string;
  amount: number;
  status: string;
  max_claims: number;
  claimed_count: number;
  created_at: string;
}

export function getAdminWebnovelMails() {
  return forumRequest<WebnovelMailRecord[]>('/api/webnovel/api/admin/mails');
}

export function createAdminWebnovelMail(data: { title: string; body?: string; amount?: number; max_claims?: number }) {
  return forumRequest<{ success: boolean }>('/api/webnovel/api/admin/mails', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function deleteAdminWebnovelMail(id: number) {
  return forumRequest<{ success: boolean }>(`/api/webnovel/api/admin/mails/${id}`, {
    method: 'DELETE',
  });
}

// ── 用户管理：精细化权限 / 动态 ──

export interface UserPermissionMap {
  [key: string]: { label: string; desc: string; enabled: boolean };
}

export function getAdminUserPermissions(userId: string) {
  return forumRequest<{ permissions: UserPermissionMap }>(`/api/admin/users/${encodeURIComponent(userId)}/permissions`);
}

export function saveAdminUserPermissions(userId: string, permissions: Record<string, boolean>) {
  return forumRequest<{ success: boolean }>(`/api/admin/users/${encodeURIComponent(userId)}/permissions`, {
    method: 'POST',
    body: JSON.stringify({ permissions }),
  });
}

export interface UserActivityItem {
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export function getAdminUserActivity(userId: string) {
  return forumRequest<UserActivityItem[]>(`/api/admin/users/${encodeURIComponent(userId)}/activity`);
}

/** 管理员查看指定用户的帖子（公开接口，管理员 token 同样可调） */
export function getAdminUserPosts(userId: string) {
  return forumRequest<Record<string, unknown>[]>(`/api/users/${encodeURIComponent(userId)}/posts?limit=50`);
}

export function getArticleNotificationsCount() {
  return forumRequest<{ count: number }>('/api/subscriptions/article-notifications');
}

// ── QQ 绑定 ──

export function sendQQBindCode(qq: string) {
  return forumRequest<{ success: boolean }>('/api/user/me/qq/send-code', {
    method: 'POST',
    body: JSON.stringify({ qq }),
  });
}

export function bindQQ(qq: string, code: string) {
  return forumRequest<{ success: boolean; qq: string }>(
    '/api/user/me/qq/bind',
    { method: 'POST', body: JSON.stringify({ qq, code }) },
  );
}

export function sendQQUnbindCode() {
  return forumRequest<{ success: boolean }>(
    '/api/user/me/qq/send-unbind-code',
    { method: 'POST' },
  );
}

export function unbindQQ(code: string) {
  return forumRequest<{ success: boolean }>('/api/user/me/qq/unbind', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

// ── 通知偏好 ──

export interface NotifyPrefs {
  email?: boolean;
  qq?: boolean;
  comment?: { email: boolean; qq: boolean };
  reply?: { email: boolean; qq: boolean };
  admin_action?: { email: boolean; qq: boolean };
  post_deleted?: { email: boolean; qq: boolean };
  lora?: { email: boolean; qq: boolean };
  recommendation?: { email: boolean; qq: boolean };
  article_update?: { email: boolean; qq: boolean };
  /** 启用的渠道列表（矩阵允许 ∩ 用户已绑定） */
  channels?: string[];
  /** 优先渠道（默认即优先，第一个） */
  preferred?: string;
}

export function getNotifyPrefs() {
  return forumRequest<NotifyPrefs>('/api/user/me/notify-prefs');
}

export function updateNotifyPrefs(prefs: Partial<NotifyPrefs>) {
  return forumRequest<{ success: boolean }>('/api/user/me/notify-prefs', {
    method: 'POST',
    body: JSON.stringify(prefs),
  });
}

// ── 公告 ──

export function getAnnouncements() {
  return forumRequest<ForumAnnouncement[]>('/api/announcements');
}

export function getAdminAnnouncements() {
  return forumRequest<Record<string, unknown>[]>('/api/admin/announcements');
}

export function createAdminAnnouncement(payload: { title: string; content: string; isPublished?: boolean }) {
  return forumRequest<{ success: boolean; id?: number }>('/api/admin/announcements', {
    method: 'POST',
    body: JSON.stringify({
      title: payload.title,
      content: payload.content,
      is_published: payload.isPublished,
    }),
  });
}

export function updateAdminAnnouncement(id: string, payload: { title?: string; content?: string }) {
  return forumRequest<{ success: boolean }>(`/api/admin/announcements/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteAdminAnnouncement(id: string) {
  return forumRequest<{ success: boolean }>(`/api/admin/announcements/${id}`, { method: 'DELETE' });
}

export function publishAdminAnnouncement(id: string) {
  return forumRequest<{ success: boolean; pushed?: number; total?: number }>(
    `/api/admin/announcements/${id}/publish`,
    { method: 'POST', body: '{}' },
  );
}

// ── 渠道推送策略（权限矩阵）──

export function getAdminChannelPolicy() {
  return forumRequest<ChannelPolicy>('/api/admin/channel-policy');
}

export function saveAdminChannelPolicy(policy: ChannelPolicy) {
  return forumRequest<{ success: boolean }>('/api/admin/channel-policy', {
    method: 'POST',
    body: JSON.stringify(policy),
  });
}
