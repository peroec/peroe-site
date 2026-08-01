/**
 * 服务端 API 客户端 —— 仅在 loader（SSR）中运行。
 * 前后端分离：博客走 blog-api，论坛走 forum-api（两个独立后端仓库）。
 */

const BLOG_API_BASE = process.env.BLOG_API_BASE || "http://127.0.0.1:8788";
const FORUM_API_BASE = process.env.FORUM_API_BASE || "http://127.0.0.1:8787";

async function apiGet<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`);
  if (!res.ok) {
    throw new Response(`API ${path} 返回 ${res.status}`, { status: res.status });
  }
  return (await res.json()) as T;
}

/** 博客后端（blog-api 仓库） */
export function blogGet<T>(path: string): Promise<T> {
  return apiGet<T>(BLOG_API_BASE, path);
}

/** 论坛后端（forum-api 仓库） */
export function forumGet<T>(path: string): Promise<T> {
  return apiGet<T>(FORUM_API_BASE, path);
}

export { BLOG_API_BASE, FORUM_API_BASE };
