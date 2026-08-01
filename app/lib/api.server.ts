/**
 * 服务端 API 客户端 —— 仅在 loader（SSR）中运行。
 * API_BASE 指向论坛/博客后端（api-server，Hono + D1）。
 */

const API_BASE = process.env.API_BASE || "http://127.0.0.1:8787";

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    throw new Response(`API ${path} 返回 ${res.status}`, { status: res.status });
  }
  return (await res.json()) as T;
}

export { API_BASE };
