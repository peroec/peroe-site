import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getNovels } from '@/lib/webnovel/api';
import type { Novel } from '@/lib/webnovel/api';

export function NovelList() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const [novels, setNovels] = useState<Novel[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNovels({ q: q || undefined })
      .then((d) => {
        if (cancelled) return;
        setNovels(d.novels);
        setTotal(d.total);
      })
      .catch(() => { if (!cancelled) setError('加载失败'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [q]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">交互小说</h1>
          <p className="mt-1 text-sm text-muted">关卡式互动剧情 · 匿名游玩，进度保存在本地浏览器</p>
        </div>
        <Link to="/webnovel/editor" className="border border-primary bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm hover:opacity-90">
          创作
        </Link>
      </div>

      <div className="mb-6">
        <input
          type="text"
          value={q}
          onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          placeholder="搜索小说…"
          className="w-full h-9 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">加载中…</div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground text-sm">{error}</div>
      ) : novels.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm">暂无小说</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {novels.map((n) => (
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
              <h2 className="font-semibold mb-1 truncate">{n.title}</h2>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{n.description}</p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{n.author_name}</span>
                <span>▶ {n.play_count}</span>
                <span>❤ {n.like_count}</span>
                <span className="ml-auto">{String(n.created_at).slice(0, 10)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground mt-8">共 {total} 部作品</p>
    </div>
  );
}
