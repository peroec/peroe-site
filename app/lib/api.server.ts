/**
 * 服务端 API 客户端 —— 仅在 loader（SSR）中运行。
 * 论坛走 forum-api（peroe-api 生产环境回源 forum.060730.xyz）。
 * 博客走本地静态内容（content/posts），见 lib/posts.server.ts。
 *
 * 双平台兼容：通过环境变量 FORUM_API_BASE 覆盖（Cloudflare 用 wrangler vars，
 * EdgeOne 用 edgeone.json 的 env / 平台环境变量），未配置时回退生产地址。
 */

const FORUM_API_BASE =
  process.env.FORUM_API_BASE || "https://forum.060730.xyz";

async function apiGet<T>(base: string, path: string): Promise<T> {
  const res = await fetch(`${base}${path}`, {
    headers: { "User-Agent": "peroe-main-site" },
  });
  if (!res.ok) {
    throw new Response(`API ${path} 返回 ${res.status}`, { status: res.status });
  }
  return (await res.json()) as T;
}

/** 论坛后端（peroe-api 仓库，生产回源 forum.060730.xyz） */
export function forumGet<T>(path: string): Promise<T> {
  return apiGet<T>(FORUM_API_BASE, path);
}

/** 论坛后端 POST（需要 JSON body 时用） */
export async function forumPost<T>(
  path: string,
  body: unknown
): Promise<T> {
  const res = await fetch(`${FORUM_API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "peroe-main-site",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Response(`API ${path} 返回 ${res.status}`, { status: res.status });
  }
  return (await res.json()) as T;
}

export { FORUM_API_BASE };
