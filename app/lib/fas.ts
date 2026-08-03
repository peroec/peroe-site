/**
 * 友链 / 赞助数据消费 —— 客户端 fetch（与原站 hub 门户一致）。
 *
 * 数据本体在 af_friends-data 仓库 data/ 下（每条一个 JSON 文件），
 * 由该仓库构建脚本聚合、校验、排序后部署为静态 JSON：
 *   https://fas.060730.xyz/friends.json
 *   https://fas.060730.xyz/sponsors.json
 * 带 Access-Control-Allow-Origin: *，浏览器可直接读。
 *
 * 加友链：去数据仓库 data/friends/ 提交 JSON 文件（GitHub Actions 自动校验）。
 */
import { useEffect, useState } from "react";
import { FAS_ORIGIN, FAS_REPO } from "~/lib/site";

export { FAS_REPO };

interface FasData {
  name: string;
  avatar?: string | null;
  description?: string;
  url: string;
  vip?: boolean;
}

async function fetchJson<T>(path: string): Promise<T[]> {
  const res = await fetch(`${FAS_ORIGIN}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as unknown;
  return Array.isArray(data) ? (data as T[]) : [];
}

// 1 小时内存缓存（跨组件复用、切页不重复请求；isolate 生命周期内有效）
const cacheTtlMs = 60 * 60 * 1000;
const cache = new Map<string, { ts: number; data: unknown[] }>();

/** 客户端取数 + 1 小时缓存（与原站一致，避免频繁请求数据服务） */
export function useFasData<T extends FasData>(path: string): {
  data: T[];
  isLoading: boolean;
  isError: boolean;
} {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const apply = (items: T[]) => {
      if (cancelled) return;
      // 构建脚本已按「VIP 优先 + 名称」排好，这里兜底排序
      const sorted = [...items].sort((a, b) =>
        a.vip === b.vip ? 0 : a.vip ? -1 : 1
      );
      setData(sorted);
      setIsLoading(false);
    };

    // 命中缓存直接返回（同一引用，切页不闪烁不重复请求）
    const hit = cache.get(path);
    if (hit && Date.now() - hit.ts < cacheTtlMs) {
      apply(hit.data as T[]);
      return () => { cancelled = true; };
    }

    setIsLoading(true);
    setIsError(false);
    fetchJson<T>(path)
      .then((items) => {
        cache.set(path, { ts: Date.now(), data: items });
        apply(items);
      })
      .catch(() => {
        if (cancelled) return;
        setIsError(true);
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return { data, isLoading, isError };
}
