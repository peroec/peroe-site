/**
 * umami 浏览量回显（客户端）。
 *
 * 方案来源：本站文章《静态博客也想展示文章浏览量》——
 * umami 开启「分享 URL」后，用 share token 调统计 API 拿每篇 pageviews。
 *
 * 只在浏览器执行（SSR 保持 0），避免拖慢服务端渲染。
 * shareToken 未配置（site.config.json analytics.shareToken 为空）时静默跳过。
 */
import { UMAMI_SHARE } from "~/lib/site";

const UMAMI_ORIGIN = "https://cloud.umami.is";

function apiOrigin(): string {
  const region = UMAMI_SHARE.region === "eu" ? "eu" : "us";
  return `${UMAMI_ORIGIN}/analytics/${region}`;
}

interface StatsResponse {
  pageviews?: number;
  visitors?: number;
  visits?: number;
}

/** 查单个路径的浏览量；失败返回 null（调用方自行降级） */
export async function fetchUmamiPageviews(path: string): Promise<number | null> {
  const token = UMAMI_SHARE.shareToken;
  if (!token || typeof window === "undefined") return null;

  try {
    // 分享接口先换 token（拿 websiteId 与 share JWT）
    const shareRes = await fetch(`${apiOrigin()}/api/share/${token}`);
    if (!shareRes.ok) return null;
    const share = (await shareRes.json()) as { websiteId?: string; token?: string };
    if (!share.websiteId || !share.token) return null;

    const statsRes = await fetch(
      `${apiOrigin()}/api/websites/${share.websiteId}/stats?startAt=0&endAt=${Date.now()}&unit=hour&timezone=Asia/Shanghai&path=eq.${encodeURIComponent(path)}&compare=false`,
      { headers: { "x-umami-share-token": share.token } as HeadersInit },
    );
    if (!statsRes.ok) return null;
    const stats = (await statsRes.json()) as StatsResponse;
    return typeof stats.pageviews === "number" ? stats.pageviews : 0;
  } catch {
    return null;
  }
}

/** 批量查多个路径浏览量（列表页用，Promise.all 并发） */
export async function fetchUmamiPageviewsBulk(paths: string[]): Promise<Map<string, number>> {
  const token = UMAMI_SHARE.shareToken;
  const out = new Map<string, number>();
  if (!token || typeof window === "undefined" || paths.length === 0) return out;

  try {
    const shareRes = await fetch(`${apiOrigin()}/api/share/${token}`);
    if (!shareRes.ok) return out;
    const share = (await shareRes.json()) as { websiteId?: string; token?: string };
    if (!share.websiteId || !share.token) return out;

    const results = await Promise.allSettled(
      paths.map(async (p) => {
        const statsRes = await fetch(
          `${apiOrigin()}/api/websites/${share.websiteId}/stats?startAt=0&endAt=${Date.now()}&unit=hour&timezone=Asia/Shanghai&path=eq.${encodeURIComponent(p)}&compare=false`,
          { headers: { "x-umami-share-token": share.token } as HeadersInit },
        );
        if (!statsRes.ok) return 0;
        const stats = (await statsRes.json()) as StatsResponse;
        return typeof stats.pageviews === "number" ? stats.pageviews : 0;
      }),
    );
    paths.forEach((p, i) => {
      const v = results[i];
      if (v.status === "fulfilled") out.set(p, v.value);
    });
    return out;
  } catch {
    return out;
  }
}
