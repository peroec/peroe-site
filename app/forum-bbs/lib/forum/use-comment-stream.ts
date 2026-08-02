import { useEffect, useRef } from 'react';
import { getBaseUrl } from './api/client';
import { mapComment, type RawComment } from './api/map-comment';
import type { ForumComment } from './types';

/**
 * 订阅某篇帖子的实时事件（SSE）。
 *
 * 后端 `GET /api/sse?postId=N` 由一个 Durable Object（`SSEHub`）承载：帖子下有人
 * 发评论时广播 `new_comment`。广播体的字段名与 `GET /api/posts/:id/comments`
 * 的行**逐字段对齐**，所以这里能直接复用 `mapComment` —— 不给 SSE 另写一份映射，
 * 否则两边迟早漂移（见 AGENTS.md 里 map-post 共用那条）。
 *
 * 纯增强：SSE 只在浏览器里跑，服务端和禁用 JS 的访客完全不受影响，
 * 首屏评论仍由 loader 直出。
 */
export function useCommentStream(
  postId: string,
  handlers: {
    onNewComment?: (comment: ForumComment) => void;
    /** 断线重连后触发 —— 重连窗口里的广播补不回来，调用方应重拉一次全量 */
    onReconnect?: () => void;
  },
) {
  // 回调放 ref：调用方的闭包每次 render 都会变，直接进依赖会让连接被反复重建
  const ref = useRef(handlers);
  ref.current = handlers;

  useEffect(() => {
    if (!postId) return;
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    const url = `${getBaseUrl()}/api/sse?postId=${encodeURIComponent(postId)}`;
    let es: EventSource | null = null;
    // 跨越「隐藏 → 断开 → 重新可见 → 重连」也要记得连过，否则每次重开都被当成首连
    let everOpened = false;

    const open = () => {
      if (es) return;
      es = new EventSource(url);

      es.onopen = () => {
        // 首次连上不算重连；重连（含从后台切回）要让调用方补一次全量
        if (everOpened) ref.current.onReconnect?.();
        everOpened = true;
      };

      es.onmessage = (e) => {
        let msg: { type?: string; payload?: { comment?: RawComment } };
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        if (msg?.type === 'new_comment' && msg.payload?.comment?.id != null) {
          ref.current.onNewComment?.(mapComment(msg.payload.comment));
        }
      };

      // EventSource 自带重连，onerror 不做处理；close() 反而会停掉重连
    };

    const close = () => {
      es?.close();
      es = null;
    };

    /**
     * 标签页切到后台就断开。长期挂在后台的标签会一直占着一条连接和一个
     * Durable Object，而用户根本看不到更新；切回来时重连并补拉，效果一样。
     */
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') close();
      else open();
    };

    if (document.visibilityState !== 'hidden') open();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      close();
    };
  }, [postId]);
}

/**
 * 把一条新评论并入现有评论树。
 *
 * - 已存在则原样返回（重连补拉与广播可能撞车，靠 id 去重）
 * - 有父评论则挂到父评论下；后端会把三级回复压平成二级，所以父级只可能在顶层
 * - 顶层评论按当前排序落位：「最新」放最前，其余放最后（放最后不会顶走
 *   正在阅读的内容）
 */
export function insertComment(
  tree: ForumComment[],
  incoming: ForumComment,
  sort: string,
): ForumComment[] {
  const exists = tree.some(
    (c) => c.id === incoming.id || (c.replies || []).some((r) => r.id === incoming.id),
  );
  if (exists) return tree;

  if (incoming.parentId) {
    const parent = tree.find((c) => c.id === incoming.parentId);
    if (parent) {
      return tree.map((c) =>
        c.id === incoming.parentId
          ? { ...c, replies: [...(c.replies || []), incoming] }
          : c,
      );
    }
    // 父级不在当前列表里（比如父评论已被删），退化成顶层
  }

  return sort === 'latest' ? [incoming, ...tree] : [...tree, incoming];
}
