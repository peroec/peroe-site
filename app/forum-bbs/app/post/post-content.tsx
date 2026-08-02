import { useMemo, useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button, buttonVariants } from '@/forum-bbs/components/ui/button';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/forum-bbs/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/forum-bbs/components/ui/dialog';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import {
  getPost, getComments, getCategories, createComment, deleteComment, likeComment, likePost, pinComment, updatePost, deletePost, deleteAdminPost, uploadFile, buildCommentTree,
} from '@/forum-bbs/lib/forum/api/client';
import { parseCommentSort, type CommentSort } from '@/forum-bbs/lib/forum/api/map-comment';
import { useCommentStream, insertComment } from '@/forum-bbs/lib/forum/use-comment-stream';
import type { ForumPostDetail, ForumComment, ForumCategory } from '@/forum-bbs/lib/forum/types';

/** 评论可能带服务端渲染好的 html（SSR 首屏），也可能没有（客户端拉取的） */
type ForumCommentWithHtml = ForumComment & { html?: string; replies?: ForumCommentWithHtml[] };

import { remoteThumb } from '@/forum-bbs/lib/cover-thumb';
import { toast } from 'sonner';
import { ImageLightbox } from '@/forum-bbs/components/image-lightbox';
import { BackToList } from '@/forum-bbs/components/back-to-list';
import { MermaidContent } from '@/forum-bbs/components/mermaid-renderer';
import { Skeleton } from '@/forum-bbs/components/ui/skeleton';
// 编辑器走懒加载壳：直接 import '@/forum-bbs/components/markdown-editor' 会把 74KB 编辑器
// 绑进本模块，而三个使用点（回复框/编辑帖子/评论框）首屏一个都不渲染
import { MarkdownEditor } from './lazy-markdown-editor';
// markdown-it + highlight.js + DOMPurify（合计 ~90KB）同理，改为按需加载
import { loadRenderer, useRenderer } from '@/forum-bbs/lib/forum/markdown-client';
import { applySeo, makeExcerpt } from '@/forum-bbs/lib/seo/apply-seo';
import { SITE_URL, canonicalPath } from '@/forum-bbs/lib/seo/route-meta';
import { formatCompactCount } from '@/forum-bbs/lib/format';

// ── Comment Item (recursive) ──

function CommentItem({
  comment, postId, onRefresh, depth = 0,
}: {
  comment: ForumCommentWithHtml;
  postId: string;
  onRefresh: () => void;
  depth: number;
}) {
  const { user } = useForumAuth();
  // 有服务端 html 的评论不需要渲染器，也就不会触发那 90KB 的下载
  const render = useRenderer(!comment.html);
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [liked, setLiked] = useState(comment.liked ?? false);
  const [likeCount, setLikeCount] = useState(comment.likeCount ?? 0);

  const handleLike = useCallback(async () => {
    try {
      const r = await likeComment(comment.id);
      setLiked(r.liked);
      // 用服务端返回的绝对计数，避免相对自增从错误基数漂移（与帖子点赞 B-2 一致）
      const base = comment.likeCount ?? 0;
      setLikeCount(r.likeCount ?? (r.liked ? base + 1 : Math.max(0, base - 1)));
    } catch (e: unknown) {
      toast.error('点赞失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    }
  }, [comment.id, comment.likeCount]);

  const handlePin = useCallback(async () => {
    try {
      await pinComment(comment.id, !comment.isPinned);
      onRefresh();
    } catch (e: unknown) {
      toast.error('置顶操作失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    }
  }, [comment.id, comment.isPinned, onRefresh]);

  const handleReply = useCallback(async () => {
    if (!replyText.trim() || !user) return;
    setSubmitting(true);
    try {
      await createComment(postId, { content: replyText.trim(), parentId: comment.id });
      setReplyText('');
      setReplying(false);
      onRefresh();
    } catch (e: unknown) {
      toast.error('回复失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    }
    setSubmitting(false);
  }, [replyText, user, postId, comment.id, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!confirm('确定要删除此评论吗？')) return;
    try {
      await deleteComment(comment.id);
      onRefresh();
    } catch (e: unknown) {
      toast.error('删除评论失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    }
  }, [comment.id, onRefresh]);

  const isMine = user?.id === comment.author?.id || user?.role === 'admin';

  return (
    <div className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-muted' : ''}`}>
      <div className="py-3">
        {/* Author + time */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground mb-1">
          {comment.author?.avatarUrl && (
            <img src={remoteThumb(comment.author.avatarUrl, 64)} alt="" width={20} height={20} loading="lazy" decoding="async" className="h-5 w-5 rounded-full shrink-0" />
          )}
          <span className="font-medium text-foreground truncate max-w-[10rem]">{comment.author?.username || '匿名'}</span>
          {comment.createdAt && <span className="shrink-0">{comment.createdAt.slice(0, 10)}</span>}
          {comment.isPinned && <span className="text-amber-600 text-xs shrink-0">置顶</span>}
        </div>

        {/* Content */}
        <div
          className="text-sm prose prose-zinc dark:prose-invert max-w-none prose-img:rounded-lg prose-a:text-primary prose-code:before:content-none prose-code:after:content-none"
          // 服务端已渲染并净化好 html 时直接用（DOMPurify 依赖 DOM，SSR 阶段跑不了）；
          // 只有客户端拉回来的评论（后端只回 content 原文）才需要渲染器。
          // 渲染器未就绪时给空串而**不是**原始 markdown —— 那等于把未净化内容摊上页面
          dangerouslySetInnerHTML={{ __html: comment.html ?? (render ? render(comment.content || '') : '') }}
        />

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-muted-foreground">
          <button onClick={handleLike} className={`inline-flex items-center gap-1 shrink-0 hover:text-foreground transition-colors ${liked ? 'text-red-500' : ''}`}>
            <Icon icon={liked ? 'mdi:heart' : 'mdi:heart-outline'} className="size-3.5" />
            {likeCount}
          </button>
          {user && (
            <button onClick={() => setReplying(!replying)} className="inline-flex items-center gap-1 shrink-0 hover:text-foreground transition-colors">
              <Icon icon="mdi:reply-outline" className="size-3.5" />
              回复
            </button>
          )}
          {user?.role === 'admin' && (
            <button onClick={handlePin} className="inline-flex items-center gap-1 shrink-0 hover:text-foreground transition-colors">
              <Icon icon="mdi:pin" className="size-3.5" />
              {comment.isPinned ? '取消置顶' : '置顶'}
            </button>
          )}
          {isMine && (
            <button onClick={handleDelete} className="inline-flex items-center gap-1 shrink-0 hover:text-red-500 transition-colors">
              <Icon icon="mdi:delete-outline" className="size-3.5" />
              删除
            </button>
          )}
        </div>

        {/* Reply form */}
        {replying && (
          <div className="mt-2 space-y-2">
            <MarkdownEditor
              value={replyText}
              onChange={setReplyText}
              placeholder={`回复 @${comment.author?.username || '匿名'}…`}
              minHeight={150}
              onUpload={async (file) => uploadFile(file, 'post')}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleReply} disabled={submitting || !replyText.trim()}>
                {submitting ? '发布中…' : '发布回复'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setReplying(false); setReplyText(''); }}>取消</Button>
            </div>
          </div>
        )}
      </div>

      {/* Nested replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentItem key={reply.id} comment={reply} postId={postId} onRefresh={onRefresh} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Component ──

/**
 * 服务端 loader 预取的帖子数据。html 是服务端渲染好的正文 ——
 * 客户端那条路径要过 DOMPurify，而 DOMPurify 依赖真实 DOM，在 Node 里跑不了，
 * 所以 SSR 阶段直接用这份现成 HTML（后端已把裸 S3 key 重写成公开 URL）。
 */
export interface PostInitialData {
  post: ForumPostDetail;
  html: string;
  /** 服务端预取的评论树，每条带渲染并净化好的 html */
  comments: ForumCommentWithHtml[];
}

const COMMENT_SORTS: { value: CommentSort; label: string }[] = [
  { value: 'hot', label: '最热' },
  { value: 'latest', label: '最新' },
  { value: 'oldest', label: '最早' },
];

/** embedded 模式下不渲染外层 <main>，由路由层统一提供 flex sidebar 布局 */
function Shell({ embedded, children }: { embedded?: boolean; children: React.ReactNode }) {
  return embedded
    ? <>{children}</>
    : <main className="container mx-auto max-w-3xl px-4 py-8 overflow-x-hidden">{children}</main>;
}

export function PostContent({
  initial,
  embedded,
}: {
  initial?: PostInitialData;
  /** 被路由层的 flex sidebar 布局包裹时，不渲染外层 <main> 容器 */
  embedded?: boolean;
} = {}) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // 排序不再是组件内的 useState：它必须是 URL 的一部分，否则「三个筛选按钮」
  // 在禁用 JS 时点了没反应，分享出去的链接也带不上排序
  const commentSort = parseCommentSort(searchParams.get('csort'));
  const { user } = useForumAuth();
  const [post, setPost] = useState<ForumPostDetail | null>(initial?.post ?? null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');
  // 服务端直出的正文 HTML；客户端重新拉取帖子后清空，改走 DOMPurify 那条路径
  const [ssrHtml, setSsrHtml] = useState(initial?.html ?? '');

  // Comments state
  const [comments, setComments] = useState<ForumCommentWithHtml[]>(initial?.comments ?? []);
  const [commentsError, setCommentsError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(!initial);

  // 实时评论（SSE）：新评论即时插入，断线重连后重拉一次全量
  useCommentStream(id, {
    onNewComment: (c) =>
      setComments((prev) => insertComment(prev, c as ForumCommentWithHtml, commentSort)),
    onReconnect: () => {
      // 重连窗口里的广播补不回来，重新拉全量
      if (id) {
        getComments(id, commentSort)
          .then((raw) => setComments(buildCommentTree(raw)))
          .catch(() => {});
      }
    },
  });

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editCategories, setEditCategories] = useState<ForumCategory[]>([]);
  const [editSaving, setEditSaving] = useState(false);
  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCategories();
      setEditCategories(cats);
    } catch {}
  }, []);

  const loadPost = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getPost(id);
      setPost(p);
      setSsrHtml('');
      applySeo({
        title: p.title,
        description: makeExcerpt(p.excerpt || p.content || '') || `${p.title} —— 来自二叉树树论坛的帖子。`,
        path: `/post/${id}`,
        ogType: 'article',
        ogImage: p.coverImageUrl || undefined,
        // Google 论坛富媒体结果（讨论帖卡片）
        jsonLd: {
          '@context': 'https://schema.org',
          '@type': 'DiscussionForumPosting',
          headline: p.title,
          text: makeExcerpt(p.content || '', 500) || undefined,
          datePublished: p.createdAt || undefined,
          author: p.author?.username ? { '@type': 'Person', name: p.author.username } : undefined,
          image: p.coverImageUrl || undefined,
          interactionStatistic: [
            {
              '@type': 'InteractionCounter',
              interactionType: 'https://schema.org/LikeAction',
              userInteractionCount: p.likeCount ?? 0,
            },
            {
              '@type': 'InteractionCounter',
              interactionType: 'https://schema.org/CommentAction',
              userInteractionCount: p.commentCount ?? 0,
            },
          ],
          url: SITE_URL + canonicalPath(`/post/${id}`),
        },
      });
      setPostLiked(p.liked ?? false);
      setPostLikeCount(p.likeCount ?? 0);
      // 通知浮动操作堆显示评论数角标
      window.dispatchEvent(new CustomEvent('page-comment-count', { detail: p.commentCount ?? 0 }));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadComments = useCallback(async () => {
    setCommentsLoading(true);
    // 拉评论的同时就开始下渲染器：后端只回 markdown 原文，这批评论一定要渲染。
    // 两者并行后，评论到达时渲染器通常已就绪，不会先闪一下空内容
    loadRenderer();
    try {
      const raw = await getComments(id, commentSort);
      setComments(buildCommentTree(raw));
      setCommentsError('');
    } catch {
      // B-12：加载失败显示错误态，避免与"确实没有评论"混淆
      setCommentsError('评论加载失败，请稍后重试');
    } finally {
      setCommentsLoading(false);
    }
  }, [id, commentSort]);

  // Post like state（B-2：初始状态须从 SSR initial 数据读取，SSR 路径不跑 loadPost）
  const [postLiked, setPostLiked] = useState(initial?.post?.liked ?? false);
  const [postLikeCount, setPostLikeCount] = useState(initial?.post?.likeCount ?? 0);
  const handlePostLike = useCallback(async () => {
    if (!post) return;
    try {
      const r = await likePost(post.id);
      setPostLiked(r.liked);
      // 用服务端返回的绝对计数，避免相对自增从错误基数漂移（B-2）
      setPostLikeCount(r.likeCount);
    } catch (e: unknown) {
      toast.error('点赞失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    }
  }, [post]);

  const startEdit = useCallback(() => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content || '');
    setEditCategory(post.categoryId || '');
    loadCategories();
    setEditing(true);
  }, [post, loadCategories]);

  const saveEdit = useCallback(async () => {
    if (!post || !editTitle.trim()) return;
    setEditSaving(true);
    try {
      await updatePost(post.id, { title: editTitle.trim(), content: editContent, categoryId: editCategory });
      setEditing(false);
      loadPost();
    } catch (e: unknown) {
      toast.error('编辑失败', { description: e instanceof Error ? e.message : '未知错误' });
    } finally {
      setEditSaving(false);
    }
  }, [post, editTitle, editContent, editCategory, loadPost]);

  const executeDeletePost = useCallback(async () => {
    if (!post) return;
    try {
      // 管理员删别人的帖子用管理接口，自己删自己的用普通接口
      if (user?.role === 'admin' && user?.id !== post.authorId) {
        await deleteAdminPost(post.id);
      } else {
        await deletePost(post.id);
      }
      setDeleteConfirmOpen(false);
      toast.success('删除帖子', { description: '帖子已删除。' });
      navigate('/forum/');
    } catch (e: unknown) {
      toast.error('删除帖子', { description: e instanceof Error ? e.message : '删除失败，请稍后再试。' });
    }
  }, [post, user, navigate]);

  // 首屏已有 loader 数据时跳过第一次帖子请求。使用只读 ref 避免 Strict Mode
  // 双重 effect 时 skipFirstLoad.current = false 导致第二次调用误触发 loadPost。
  const hasInitialPost = useRef(Boolean(initial?.post));
  const didLoadPost = useRef(false);
  useEffect(() => {
    if (hasInitialPost.current) return;
    if (didLoadPost.current) return;
    didLoadPost.current = true;
    loadPost();
  }, [loadPost]);
  // 评论首屏来自 loader。匿名访客的 SSR 结果已经完全正确，不必再拉一次；
  // 已登录用户需要重拉一遍拿每条评论的 liked 状态（服务端拿不到登录态）。
  //
  // 记的是「手上这份评论对应哪个排序」而不是一个「已加载过」的一次性开关：
  // 之前那个开关一旦为 true 就再也不复位，匿名访客切排序时 effect 虽然重跑却
  // 立刻 return —— 三个筛选按钮除了换个高亮什么都不做。用值比对既修好了它，
  // 又天然扛得住 Strict Mode 的双跑（第二次值已相等，不会重复请求）。
  const initialComments = initial?.comments;
  const loadedSort = useRef<CommentSort | null>(null);
  useEffect(() => {
    if (loadedSort.current === commentSort) return;
    loadedSort.current = commentSort;
    // 换排序时 loader 已经按新的 ?csort 取好了整份评论，匿名访客直接用它，
    // 不必再客户端拉一遍
    if (initialComments?.length && !localStorage.getItem('forum-auth-token')) {
      setComments(initialComments);
      setCommentsLoading(false);
      return;
    }
    loadComments();
  }, [commentSort, initialComments, loadComments]);

  // ssrHtml 存在时不需要渲染器；客户端重新拉过帖子后它被清空，才真的要渲染
  const bodyRender = useRenderer(!ssrHtml);
  const contentHtml = useMemo(() => {
    if (ssrHtml) return ssrHtml;
    return bodyRender ? bodyRender(post?.content || '') : '';
  }, [ssrHtml, post?.content, bodyRender]);

  const submitComment = async () => {
    if (!commentText.trim() || !user) return;
    setSubmitting(true);
    try {
      await createComment(id, { content: commentText.trim() });
      setCommentText('');
      loadComments();
    } catch (e: unknown) {
      toast.error('评论发布失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8 overflow-x-hidden">
        <p className="mb-6 font-mono text-xs text-muted-foreground">
          loading post<span className="ml-1 inline-block h-[1em] w-[0.55em] translate-y-px bg-muted-foreground [animation:shell-blink_1s_step-end_infinite]" />
        </p>
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <div className="flex items-center gap-3">
            <Skeleton className="size-6 shrink-0" />
            <Skeleton className="h-4 w-40" />
          </div>
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-4 w-4/5" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Shell embedded={embedded}>
        <p className="text-destructive">{error}</p>
        <Link to="/forum/"><Button variant="outline" size="sm" className="mt-4">← 返回论坛</Button></Link>
      </Shell>
    );
  }

  if (!post) return null;

  return (
    <Shell embedded={embedded}>
      {/* 从搜索 / 第 N 页点进来的，返回时要回到那一屏，不能甩回论坛首页 */}
      <BackToList to="/" label="返回论坛" />

      {/* Post */}
      {/* 正文不再包卡片：这层 border + p-4 在 375px 手机上要吃掉 34px 正文宽度，
          而页面本来就只有这一个帖子，边界交给分隔线即可 */}
      <article>
        <header className="mb-6 pb-6 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            {post.isPinned && (
              <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <Icon icon="mdi:pin" className="size-3" />置顶
              </span>
            )}
            {post.category && <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{post.category.name}</span>}
          </div>
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-3 text-sm text-muted-foreground">
            {post.author?.avatarUrl && (
              <img src={remoteThumb(post.author.avatarUrl, 64)} alt="" width={24} height={24} loading="lazy" decoding="async" className="h-6 w-6 rounded-full shrink-0" />
            )}
            <span className="truncate max-w-[10rem]">{post.author?.username || '匿名'}</span>
            {post.createdAt && <span className="shrink-0">{post.createdAt.slice(0, 10)}</span>}
            <span className="inline-flex items-center gap-1 shrink-0"><Icon icon="mdi:eye-outline" className="size-4" />{formatCompactCount(post.viewCount ?? 0)}</span>
            <button onClick={handlePostLike} className={`inline-flex items-center gap-1 shrink-0 transition-colors ${postLiked ? 'text-red-500' : 'hover:text-red-400'}`}>
              <Icon icon={postLiked ? 'mdi:heart' : 'mdi:heart-outline'} className="size-4" />
              {formatCompactCount((postLikeCount || post?.likeCount) ?? 0)}
            </button>
            {(user?.id === post.author?.id || user?.role === 'admin') && (
              <>
                <button onClick={startEdit} className="inline-flex items-center gap-1 shrink-0 hover:text-foreground transition-colors">
                  <Icon icon="mdi:pencil-outline" className="size-4" />
                  编辑
                </button>
                <button onClick={() => setDeleteConfirmOpen(true)} className="inline-flex items-center gap-1 shrink-0 hover:text-red-500 transition-colors">
                  <Icon icon="mdi:trash-can-outline" className="size-4" />
                  删除
                </button>
              </>
            )}
          </div>
        </header>

        {editing ? (
          <div className="space-y-4 mb-6">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border bg-background text-sm"
            />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex items-center justify-between gap-1 w-full h-10 rounded-lg border border-input bg-transparent px-3 text-sm text-left">
                {editCategories.find((c) => c.id === editCategory)?.name || '选择分类'}
                <Icon icon="mdi:chevron-down" className="size-4 text-muted-foreground shrink-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-full min-w-[200px]">
                <DropdownMenuItem onClick={() => setEditCategory('')}>选择分类</DropdownMenuItem>
                {editCategories.map((c) => <DropdownMenuItem key={c.id} onClick={() => setEditCategory(c.id)}>{c.name}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            <MarkdownEditor
              value={editContent}
              onChange={setEditContent}
              minHeight={400}
              onUpload={async (file) => uploadFile(file, 'post')}
            />
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={editSaving || !editTitle.trim()}>{editSaving ? '保存中…' : '保存'}</Button>
              <Button variant="outline" onClick={() => setEditing(false)}>取消</Button>
            </div>
          </div>
        ) : contentHtml && (
          <MermaidContent
            html={contentHtml}
            className="prose prose-zinc dark:prose-invert max-w-none break-words prose-pre:bg-[#1e1e2e] prose-img:rounded-xl"
          />
        )}
      </article>

      {/* ── Comments ── */}
      <section id="comments" className="mt-8 pt-8 border-t border-border scroll-mt-20">
        <div className="flex items-center justify-between mb-4">
          <h2 id="comments" className="text-lg font-semibold">评论</h2>
          {/* 真链接而不是 onClick 按钮：禁用 JS 时也能换排序（loader 认 ?csort），
              有 JS 时 <Link> 仍走客户端导航。preventScrollReset 让页面停在评论区 */}
          <div className="flex gap-1">
            {COMMENT_SORTS.map((opt) => (
              <Link
                key={opt.value}
                to={`?csort=${opt.value}#comments`}
                preventScrollReset
                replace
                // 同一篇帖子的三种排序对爬虫是同一份内容（canonical 已指回干净
                // 的帖子 URL），不值得让它把每篇帖子抓三遍
                rel="nofollow"
                aria-current={commentSort === opt.value ? 'true' : undefined}
                className={buttonVariants({
                  variant: commentSort === opt.value ? 'default' : 'ghost',
                  size: 'sm',
                  className: 'text-xs',
                })}
              >
                {opt.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Write comment */}
        {user ? (
          <div className="mb-6 space-y-2">
            <MarkdownEditor
              value={commentText}
              onChange={setCommentText}
              placeholder="写下你的评论…"
              minHeight={200}
              onUpload={async (file) => uploadFile(file, 'post')}
            />
            <div className="flex justify-end">
              <Button onClick={submitComment} disabled={submitting || !commentText.trim()} size="sm">
                {submitting ? '发布中…' : '发表评论'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mb-6 -mx-4 px-4 py-4 bg-muted/50 text-center text-sm text-muted-foreground sm:mx-0">
            <Link to={`/forum/auth/login?redirect=/post/${id}`} className="text-primary hover:underline">
              登录
            </Link>
            {' '}后即可评论
          </div>
        )}

        {/* Comment list */}
        {commentsLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex-1 space-y-2 py-0.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : commentsError ? (
          <p className="py-8 text-center text-sm text-destructive">{commentsError}</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">暂无评论</p>
        ) : (
          <div className="divide-y">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} postId={id} onRefresh={loadComments} depth={0} />
            ))}
          </div>
        )}
      </section>

      <ImageLightbox />

      {/* Delete confirmation dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>删除帖子</DialogTitle>
            <DialogDescription>确认删除这篇帖子？此操作不可撤销。</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose>
              <Button variant="outline" size="sm">取消</Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={executeDeletePost}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Shell>
  );
}
