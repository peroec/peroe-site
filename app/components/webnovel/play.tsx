import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { addLike, addView, getNovel, getSocial } from '@/lib/webnovel/api';
import { useNovelEngine } from '@/lib/webnovel/engine';

function imageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return path.startsWith('/') ? path : `/media/${path}`;
}

export function NovelPlay({ slug }: { slug: string }) {
  const [novel, setNovel] = useState<{ title: string; content?: unknown } | null>(null);
  const [error, setError] = useState('');
  const [likes, setLikes] = useState(0);
  const [fullScreen, setFullScreen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { loaded, view, pickOption, continueGoto, restart, acquired, dismissAcquired } = useNovelEngine(slug, novel?.content);

  useEffect(() => {
    let cancelled = false;
    getNovel(slug)
      .then((value) => {
        if (cancelled) return;
        setNovel(value);
        addView(slug).catch(() => {});
        getSocial(slug).then((social) => {
          if (!cancelled) { setLikes(social.like_count); setLiked(Boolean((social as any).liked)); }
        }).catch(() => {});
      })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : '加载失败'); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!view?.outletReady || view.outletKind !== 'goto' || !view.gotoTarget || !view.timer?.autoAdvance) return;
    const timer = setTimeout(() => continueGoto(view.gotoTarget as string), 260);
    return () => clearTimeout(timer);
  }, [continueGoto, view]);

  const toggleFullScreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await containerRef.current?.requestFullscreen();
    } catch {}
  };

  const like = async () => {
    try {
      const r = await addLike(slug);
      setLiked(r.liked);
      setLikes(r.likeCount);
    } catch {}
  };

  const scrollTop = () => {
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      containerRef.current?.scrollTo?.({ top: 0, behavior: 'smooth' });
    } catch {}
  };

  const handlePick = (choiceActionId: string, optionId: string) => {
    pickOption(choiceActionId, optionId);
    scrollTop();
  };

  const handleContinue = () => {
    if (!view?.gotoTarget) return;
    continueGoto(view.gotoTarget);
    scrollTop();
  };

  const handleRestart = () => {
    restart();
    scrollTop();
  };

  if (error) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center"><p className="text-muted-foreground">{error}</p><Link to="/webnovel" className="mt-4 inline-block text-primary underline">返回列表</Link></div>;
  }
  if (!novel || !loaded) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">加载作品…</div>;
  if (!view) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-muted-foreground">作者还没有添加任何关卡。</div>;

  const content = (
    <div className={fullScreen ? 'mx-auto max-w-2xl' : ''}>
      <div className="mb-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <Link to={`/webnovel/${slug}`} className="inline-flex min-w-0 items-center gap-1 hover:text-foreground">← <span className="truncate">{novel.title}</span></Link>
        <span className="flex shrink-0 items-center gap-3">
          <button type="button" onClick={() => setInventoryOpen((value) => !value)} className="hover:text-foreground" aria-label="背包" aria-pressed={inventoryOpen}>🎒 {view.inventory.length || ''}</button>
          <span>已探索 {view.visitedCount}/{view.totalPages} 页</span>
          <button type="button" onClick={toggleFullScreen} className="hover:text-foreground" aria-label={fullScreen ? '退出全屏' : '全屏阅读'}>{fullScreen ? '退出全屏' : '全屏'}</button>
        </span>
      </div>

      {inventoryOpen && (
        <div className="mb-3 border border-border p-3">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">背包（{view.inventory.length}）</h2><button type="button" onClick={() => setInventoryOpen(false)} aria-label="关闭背包">×</button></div>
          {view.inventory.length === 0 ? <p className="text-xs text-muted-foreground">还没有获得任何道具。</p> : <ul className="space-y-2">{view.inventory.map((item) => <li key={item.name} className="border-b border-border pb-2 last:border-0"><div className="flex items-center gap-2 text-sm font-semibold">{item.label}{item.quantity !== null && <span className="bg-secondary px-1.5 font-mono text-xs">{item.quantity}</span>}</div>{item.description && <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>}</li>)}</ul>}
        </div>
      )}

      {acquired.length > 0 && <button type="button" onClick={dismissAcquired} className="mb-3 block w-full border border-foreground bg-foreground px-3 py-2 text-left text-background">{acquired.map((item) => <span key={item.name} className="block text-sm">获得道具：<b>{item.label}</b>{item.description ? ` —— ${item.description}` : ''}</span>)}</button>}

      <article className="min-h-[40vh] border-y border-border py-5">
        {view.title && <h1 className="mb-3 text-lg font-bold">{view.title}</h1>}
        {view.images.map((image, index) => <img key={`${image}-${index}`} src={imageUrl(image)} alt="" className="mx-auto mb-4 block max-h-[70vh] h-auto max-w-full rounded-lg object-contain" loading="lazy" decoding="async" />)}
        {view.texts.map((text, index) => <p key={`${text.text.slice(0, 12)}-${index}`} className={`whitespace-pre-wrap break-words ${text.align === 'center' ? 'text-center' : text.align === 'right' ? 'text-right' : ''} ${index > 0 ? 'mt-3' : ''}`}>{text.text}</p>)}
        {view.texts.length === 0 && view.images.length === 0 && <p className="text-muted-foreground">（本页没有内容）</p>}
        {view.timer && view.timer.style !== 'hidden' && <div className="my-4"><div className="h-1.5 w-full border border-border bg-background"><div className="h-full bg-foreground transition-[width] duration-200" style={{ width: `${Math.max(0, Math.min(100, ((view.timer.total - view.timer.remaining) / view.timer.total) * 100))}%` }} /></div>{view.timer.style === 'normal' && <p className="mt-1 font-mono text-xs text-muted-foreground">等待中 {Math.ceil(view.timer.remaining)} 秒</p>}</div>}
        {view.timer?.style === 'hidden' && <p className="py-2 text-center text-xs text-muted-foreground">…</p>}
      </article>

      <div className="py-4">
        {!view.outletReady ? (
          <p className="py-2 text-center text-sm text-muted-foreground">请稍候…</p>
        ) : view.outletKind === 'choice' ? (
          <div className="flex flex-col gap-2">
            {view.options.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">（没有可选的选项，卡在页尾。）</p>
            ) : view.options.map(({ opt, locked, lockLabel }) => (
              <div key={opt.id}>
                <button type="button" disabled={locked} onClick={() => handlePick(view.choiceActionId as string, opt.id)} className="w-full border border-border px-3 py-2.5 text-left text-sm hover:border-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  {locked ? '🔒 ' : '› '}{opt.label}
                </button>
                {locked && <p className="px-3 pt-0.5 text-xs text-muted-foreground">🔒 {lockLabel}</p>}
              </div>
            ))}
          </div>
        ) : view.outletKind === 'goto' && view.gotoTarget ? (
          view.timer?.autoAdvance ? (
            <p className="py-2 text-center text-sm text-muted-foreground">…</p>
          ) : (
            <div className="flex justify-center">
              <button type="button" onClick={handleContinue} className="border border-foreground px-6 py-2.5 text-sm hover:bg-foreground hover:text-background">继续 ›</button>
            </div>
          )
        ) : (
          /* 结局：统一显示 剧终提示 + 点赞 + 重新开始 + 返回交互列表 */
          <div className="space-y-4">
            <p className="border-y border-border py-3 text-center text-sm tracking-widest text-muted-foreground">—— 剧终 ——</p>
            <div className="flex justify-center">
              <button type="button" onClick={like} className="inline-flex items-center gap-1.5 border border-border px-4 py-2 text-sm hover:border-foreground disabled:opacity-60" disabled={liked}>
                {liked ? '♥ 已赞' : '♡ 点赞'} <span className="font-mono">{likes}</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button type="button" onClick={handleRestart} className="border border-foreground bg-foreground px-5 py-2.5 text-sm text-background">剧终 · 重新开始</button>
              <Link to="/webnovel" className="border border-border px-5 py-2.5 text-sm hover:border-foreground">返回交互列表</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return <div ref={containerRef} className={fullScreen ? 'h-screen w-screen overflow-y-auto bg-background px-4 py-6' : 'mx-auto max-w-2xl px-4 py-8'}>{content}</div>;
}
