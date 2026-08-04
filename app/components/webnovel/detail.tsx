import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { getNovel, getSocial, addLike } from '@/lib/webnovel/api';
import type { Novel } from '@/lib/webnovel/api';

export function NovelDetail({ slug }: { slug: string }) {
  const [novel, setNovel] = useState<Novel & { is_owner?: boolean } | null>(null);
  const [social, setSocial] = useState<{ play_count: number; like_count: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    getNovel(slug)
      .then((n) => { if (!cancelled) setNovel(n); })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); });
    getSocial(slug).then((s) => { if (!cancelled) setSocial(s); }).catch(() => {});
    return () => { cancelled = true; };
  }, [slug]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <Link to="/webnovel" className="text-primary underline">返回列表</Link>
      </div>
    );
  }

  if (!novel) return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">加载中…</div>;

  const pageCount = novel.content?.pages?.length || 0;
  const isOwner = novel.is_owner;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link to="/webnovel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">← 返回列表</Link>

      <div className="flex items-start gap-4 sm:gap-6 border-b border-border pb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {(novel.tags || []).slice(0, 6).map((t) => (
              <span key={t} className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{t}</span>
            ))}
          </div>
          <h1 className="text-xl font-bold break-words">{novel.title}</h1>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{novel.author_name}</span>
            <span>▶ {social?.play_count ?? novel.play_count}</span>
            <span>❤ {social?.like_count ?? novel.like_count}</span>
            {pageCount > 0 && <span>{pageCount} 页</span>}
            <span>{String(novel.created_at).slice(0, 10)}</span>
            {novel.status !== 'published' && (
              <span className="text-amber-600 dark:text-amber-400">草稿</span>
            )}
          </div>
        </div>
      </div>

      <p className="py-5 border-b border-border whitespace-pre-wrap break-words">{novel.description}</p>

      <div className="py-5">
        <Link
          to={`/webnovel/play/${slug}`}
          className="inline-flex items-center gap-2 border border-primary bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm hover:opacity-90"
        >
          ▶ 开始游玩
        </Link>
        <p className="text-xs text-muted-foreground mt-2">进度会自动保存在当前浏览器。</p>

        <button
          onClick={async () => {
            try { await addLike(slug); setSocial((s) => s ? { ...s, like_count: s.like_count + 1 } : s); } catch {}
          }}
          className="mt-4 border border-border rounded-lg px-3 h-9 text-sm hover:border-foreground transition-colors"
        >
          ❤ 点赞
        </button>
      </div>

      {isOwner && (
        <div className="mt-4">
          <Link to={`/webnovel/editor?slug=${slug}`} className="text-sm text-primary hover:underline">编辑这部作品</Link>
        </div>
      )}
    </div>
  );
}
