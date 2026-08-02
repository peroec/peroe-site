import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { withBase } from '@/forum-bbs/lib/base-path';

/** 列表页跳详情时用 `<Link state={...}>` 带上的现场 */
export interface ListOriginState {
  /** 列表页当时的查询串，形如 `?q=nginx` / `?page=2` */
  listSearch?: string;
}

/** 哪些查询参数算「一屏筛选结果」—— 只有它们出现时才值得把用户送回去 */
const QUERY_KEYS = ['q', 'search'];
const PAGE_KEYS = ['page'];

function describe(search: string, fallback: string, pageBase: 0 | 1): string {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  if (QUERY_KEYS.some((k) => p.get(k))) return '返回搜索结果';
  for (const k of PAGE_KEYS) {
    const n = Number(p.get(k));
    if (Number.isFinite(n) && n > pageBase) return `返回第 ${n + (pageBase === 0 ? 1 : 0)} 页`;
  }
  return fallback;
}

/**
 * 详情页左上角的「返回列表」。
 *
 * 从搜索结果或第 N 页点进详情后，要能回到那一屏，而不是被甩回列表首页重新搜一遍。
 * 两条线索：客户端导航靠 `<Link state>`（列表页的卡片带上），整页加载（新标签打开 /
 * 刷新 / 从别处进来）靠同源 referrer。两者都没有时就是一个普通的列表链接 ——
 * 所以禁用 JS 时它依然是条能点的真链接。
 *
 * 目标只在 effect 里落定：把它写进首帧会让服务端与客户端渲染出不同的 href。
 */
export function BackToList({
  to,
  label,
  pageBase = 1,
  className,
}: {
  /** 列表页路径，如 `/posts`、`/` */
  to: string;
  /** 没有筛选现场时的文案，如「返回博客列表」 */
  label: string;
  /** 列表页 page 参数是 0 基还是 1 基（/posts 是 0 基，/forum 是 1 基） */
  pageBase?: 0 | 1;
  className?: string;
}) {
  const location = useLocation();
  const fromState = (location.state as ListOriginState | null)?.listSearch;
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (fromState) {
      setSearch(fromState);
      return;
    }
    try {
      const ref = document.referrer;
      if (!ref) return;
      const u = new URL(ref);
      if (u.origin !== window.location.origin) return;
      // referrer 是真实 URL，带部署前缀；to 是裸站内路径，比之前先补上
      if (u.pathname !== withBase(to) || !u.search) return;
      setSearch(u.search);
    } catch {
      // referrer 不是个合法 URL，忽略
    }
  }, [fromState, to]);

  return (
    <Link
      to={`${to}${search}`}
      className={
        className ??
        'inline-flex items-center gap-1 py-2 mb-2 text-sm text-muted-foreground hover:text-foreground transition-colors'
      }
    >
      <Icon icon="mdi:arrow-left" className="size-4" />
      {describe(search, label, pageBase)}
    </Link>
  );
}
