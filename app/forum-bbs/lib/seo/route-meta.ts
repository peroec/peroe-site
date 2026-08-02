/**
 * 路由级 SEO 元数据（论坛专用）。
 *
 * 主站那份覆盖全站几十条路由并被 Cloudflare Worker 复用，这里只留论坛这几条，
 * 路径也去掉了 `/forum` 前缀 —— 本项目是独立站点，站内路径一律裸写，
 * 部署前缀由 base-path.ts 统一补（见那里的注释）。
 *
 * 约束不变：**纯数据 + 纯函数**，不碰 window / React。
 */
import { BASE_PATH } from "../base-path";
import { siteConfig } from "../site-config";

export const SITE_NAME = siteConfig.name;
export const SITE_TITLE = siteConfig.title;
export const SITE_URL = (import.meta.env.VITE_SITE_URL || siteConfig.url).replace(/\/+$/, "");
export const SITE_DESCRIPTION = siteConfig.description;
export const DEFAULT_OG_IMAGE = import.meta.env.VITE_OG_IMAGE || siteConfig.ogImage;

export interface RouteMeta {
  /** 页面标题（不含站名后缀）；空串表示直接使用 SITE_TITLE */
  title: string;
  description: string;
  /** 登录态/管理/工具性中间页不进搜索索引 */
  noindex?: boolean;
  ogType?: "website" | "article";
}

/** 拼接完整 <title>：`页面名 | 二叉树树`，首页用整站标题 */
export function formatTitle(title: string): string {
  return title ? `${title} | ${SITE_NAME}` : SITE_TITLE;
}

/** 键是**不带部署前缀**的站内路径 */
export const STATIC_ROUTE_META: Record<string, RouteMeta> = {
  "/": { title: "论坛社区", description: SITE_DESCRIPTION },
  "/post/new": { title: "发布新帖", description: "在二叉树树论坛发布新帖子。", noindex: true },
  "/auth/login": { title: "登录", description: "登录二叉树树论坛账号。", noindex: true },
  "/auth/register": { title: "注册账号", description: "注册二叉树树论坛账号。", noindex: true },
  "/auth/forgot-password": { title: "找回密码", description: "找回论坛账号密码。", noindex: true },
  "/auth/reset-password": { title: "重置密码", description: "重置论坛账号密码。", noindex: true },
  "/auth/authorize": { title: "授权登录", description: "把论坛身份授权给站内其它域名。", noindex: true },
  "/me": { title: "个人中心", description: "论坛个人中心。", noindex: true },
  "/u": { title: "用户主页", description: "论坛用户主页。", noindex: true },
  "/admin": { title: "论坛管理", description: "论坛管理面板。", noindex: true },
  "/agree": { title: "用户协议", description: "用户协议与使用条款。" },
  "/privacy": { title: "隐私政策", description: "隐私政策与 Cookie 说明。" },
};

/** /post/:id 在帖子数据到达前的兜底 meta */
export const FORUM_POST_FALLBACK_META: RouteMeta = {
  title: "论坛帖子",
  description: "来自二叉树树论坛的帖子与讨论。",
  ogType: "article",
};

export const NOT_FOUND_META: RouteMeta = {
  title: "404 页面未找到",
  description: "你访问的页面不存在。",
  noindex: true,
};

/** 去掉尾斜杠（根路径除外），作为 map 查询键 */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.replace(/\/+$/, "") : pathname;
}

/**
 * 剥掉部署前缀，把 `location.pathname` 换算成站内路径。
 * 前缀为空时是恒等变换。
 */
export function stripBase(pathname: string): string {
  if (BASE_PATH && pathname.startsWith(BASE_PATH)) {
    return pathname.slice(BASE_PATH.length) || "/";
  }
  return pathname;
}

/**
 * canonical 路径：规范形态为「无尾斜杠」（根路径除外），并带上部署前缀。
 * 传进来的是**站内**路径（也容忍带前缀的 location.pathname）。
 */
export function canonicalPath(pathname: string): string {
  const inner = normalizePath(stripBase(pathname));
  return inner === "/" ? `${BASE_PATH}/` : BASE_PATH + inner;
}

export function resolveRouteMeta(pathname: string): RouteMeta {
  const path = normalizePath(stripBase(pathname));
  const exact = STATIC_ROUTE_META[path];
  if (exact) return exact;
  if (path.startsWith("/post/")) return FORUM_POST_FALLBACK_META;
  return NOT_FOUND_META;
}

/** 从 markdown/纯文本正文提取 meta description 摘要 */
export function makeExcerpt(text: string, maxLength = 120): string {
  const plain = text
    .replace(/```[\s\S]*?```/g, " ") // 代码块
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文字
    .replace(/<[^>]+>/g, " ") // HTML 标签
    .replace(/[#>*`~|-]+/g, " ") // 标记符号
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain;
}

/**
 * 面包屑结构化数据。站点只有两层（论坛 → 当前页），所以不再逐段查表。
 * 传进来的是站内路径。
 */
export function breadcrumbJsonLd(
  pathname: string,
  currentTitle: string,
): Record<string, unknown> | null {
  const path = normalizePath(stripBase(pathname));
  if (path === "/") return null;
  const items: { name: string; item?: string }[] = [
    { name: SITE_TITLE, item: `${SITE_URL}${BASE_PATH}/` },
    { name: currentTitle || SITE_TITLE },
  ];
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      ...(it.item ? { item: it.item } : {}),
    })),
  };
}
