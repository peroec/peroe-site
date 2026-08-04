import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useNovelEngine } from '@/lib/webnovel/engine';
import { getNovel, addView, getSocial } from '@/lib/webnovel/api';

export function NovelPlay({ slug }: { slug: string }) {
  const [novel, setNovel] = useState<{ title: string; content?: any } | null>(null);
  const [error, setError] = useState('');
  const [likes, setLikes] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getNovel(slug)
      .then((n) => {
        if (cancelled) return;
        setNovel(n);
        addView(slug).catch(() => {});
        getSocial(slug).then((s) => { if (!cancelled) setLikes(s.like_count); }).catch(() => {});
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); });
    return () => { cancelled = true; };
  }, [slug]);

  const { state, loaded, currentPage, visibleChoices, choose, restart } = useNovelEngine(slug, novel?.content);

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">{error}</p>
        <Link to="/webnovel" className="text-primary underline mt-4 inline-block">返回列表</Link>
      </div>
    );
  }

  if (!novel || !loaded) {
    return <div className="p-8 text-center text-muted-foreground">加载中…</div>;
  }

  const isEnding = !visibleChoices || visibleChoices.length === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to={`/webnovel/${slug}`} className="text-sm text-muted-foreground hover:text-foreground">← 返回详情</Link>
        <span className="text-xs text-muted-foreground">第 {state?.visited.length ?? 0} 页 · ❤ {likes}</span>
      </div>

      <h1 className="text-xl font-bold mb-6">{novel.title}</h1>

      {/* 变量状态条 */}
      {state && Object.keys(state.variables).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6 text-xs">
          {Object.entries(state.variables).map(([k, v]) => (
            <span key={k} className="px-2 py-1 rounded bg-secondary text-secondary-foreground font-mono">
              {k}: {v}
            </span>
          ))}
        </div>
      )}

      {/* 剧情正文 */}
      {currentPage && (
        <div className="border border-border rounded-lg p-6 mb-6 min-h-[200px]">
          <p className="whitespace-pre-wrap leading-relaxed">{currentPage.narrative}</p>
        </div>
      )}

      {/* 选项 */}
      {currentPage && !isEnding ? (
        <div className="space-y-2">
          {visibleChoices.map((ch) => (
            <button
              key={ch.id}
              onClick={() => choose(ch.id)}
              className="w-full text-left border border-border rounded-lg px-4 py-3 hover:border-foreground transition-colors text-sm"
            >
              {ch.text}
            </button>
          ))}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <p className="text-amber-600 dark:text-amber-400 text-sm">—— 结局 ——</p>
          <button
            onClick={restart}
            className="border border-primary bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-sm hover:opacity-90"
          >
            重新开始
          </button>
        </div>
      )}
    </div>
  );
}
