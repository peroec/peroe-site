import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getNovels } from '@/lib/webnovel/api';
import type { Novel } from '@/lib/webnovel/api';

const PAGE_SIZE = 12;

function imageUrl(path?: string): string {
  if (!path) return '';
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? path : `/media/${path}`;
}

export function NovelList() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const [novels, setNovels] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // 搜索输入防抖：本地输入态，300ms 后写入 URL 触发请求
  const [input, setInput] = useState(q);

  useEffect(() => {
    const timer = setTimeout(() => {
      setParams(input ? { q: input } : {}, { replace: true });
    }, 300);
    return () => clearTimeout(timer);
  }, [input, setParams]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNovels({ q: q || undefined, page, perPage: PAGE_SIZE })
      .then((d) => {
        if (cancelled) return;
        setNovels(d.novels);
        setTotal(d.total);
      })
      .catch(() => { if (!cancelled) setError('加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q, page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const goPage = (p: number) => {
    const next = new URLSearchParams(params);
    if (p <= 1) next.delete('page');
    else next.set('page', String(p));
    setParams(next);
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">交互小说</h1>
          <p className="mt-1 text-sm text-muted">关卡式互动剧情 · 匿名游玩，进度保存在本地浏览器</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/webnovel/me" className="border border-border text-muted-foreground rounded-lg px-4 py-2 text-sm hover:border-foreground hover:text-foreground transition-colors">
            我的作品
          </Link>
          <Link to="/webnovel/editor" className="border border-primary bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm hover:opacity-90">
            创作
          </Link>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="搜索标题或简介…"
          className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">加载中…</div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{error}</div>
      ) : novels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{q ? '没有找到相关作品' : '还没有已发布的作品，成为第一个创作者吧。'}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {novels.map((n) => {
            const cover = imageUrl(n.cover_image_url);
            return (
              <Link
                key={n.slug}
                to={`/webnovel/${n.slug}`}
                className="border border-border rounded-lg p-4 hover:border-foreground transition-colors"
              >
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {(n.tags || []).slice(0, 4).map((t) => (
                    <span key={t} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold mb-1 truncate">{n.title}</h2>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{n.description}</p>
                  </div>
                  {cover && (
                    <img src={cover} alt="" width={112} height={84} loading="lazy" decoding="async" className="w-16 sm:w-28 aspect-[4/3] rounded-lg object-cover shrink-0" />
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{n.author_name || '匿名'}</span>
                  <span>▶ {n.play_count}</span>
                  <span>❤ {n.like_count}</span>
                  <span className="ml-auto">{String(n.created_at).slice(0, 10)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {totalPages > 1 && !loading && (
        <div className="flex items-center justify-center gap-3 mt-8 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => goPage(page - 1)}
            className="border border-border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:border-foreground disabled:hover:border-border"
          >
            ‹ 上一页
          </button>
          <span className="text-xs text-muted-foreground">第 {page} / {totalPages} 页 · 共 {total} 部</span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => goPage(page + 1)}
            className="border border-border rounded-lg px-3 py-1.5 disabled:opacity-40 hover:border-foreground disabled:hover:border-border"
          >
            下一页 ›
          </button>
        </div>
      )}
    </div>
  );
}
