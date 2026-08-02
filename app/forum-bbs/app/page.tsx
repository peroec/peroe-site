import { useEffect, useState, useRef, type MouseEvent } from 'react';
import { Form, Link, useLocation, useNavigate, useNavigation, useSubmit } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Skeleton } from '@/forum-bbs/components/ui/skeleton';
import * as Dialog from '@/forum-bbs/components/ui/dialog';
import { EnvironmentSwitcher } from '@/forum-bbs/components/environment-switcher';
import { Pagination } from '@/forum-bbs/components/pagination';
import { Button } from '@/forum-bbs/components/ui/button';
import { formatCompactCount } from '@/forum-bbs/lib/format';
import { remoteThumb } from '@/forum-bbs/lib/cover-thumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/forum-bbs/components/ui/dropdown-menu';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import { track } from '@/forum-bbs/lib/track';
import { RoleBadge } from '@/forum-bbs/components/forum-role-badge';
import { withBase } from '@/forum-bbs/lib/base-path';
import type { ForumPostSummary, ForumCategory, SortOption } from '@/forum-bbs/lib/forum/types';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'latest', label: '最新发布' },
  { value: 'likes', label: '最多点赞' },
  { value: 'comments', label: '最多评论' },
  { value: 'views', label: '最多观看' },
];

function ForumPostSkeleton() {
  return (
    <div className="flex items-center gap-2 sm:gap-3 border-b border-border lg:border-r py-4 lg:p-4">
      <div className="min-w-0 flex-1 space-y-2.5">
        <Skeleton className="h-5 w-3/4" />
        <div className="flex items-center gap-2">
          <Skeleton className="size-5 shrink-0" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <Skeleton className="w-16 sm:w-28 aspect-[4/3] shrink-0" />
    </div>
  );
}

function PostCard({ post, listSearch }: { post: ForumPostSummary; listSearch?: string }) {
  return (
    <Link
      to={`/forum/post/${post.id}`}
      // state：把列表当时的 ?search= / ?page= 带进详情页，详情页的「返回论坛」
      // 才能回到这一屏而不是把用户甩回论坛首页（见 back-to-list.tsx）
      state={listSearch ? { listSearch } : undefined}
      // 单列（<lg）时不画左右竖线、不留左右内边距：一行只有一帖，
      // 竖框线除了把内容挤窄没有别的作用。双列时网格线照旧。
      className="block border-b border-border lg:border-r bg-background py-4 lg:p-4 hover:bg-card transition-colors duration-75"
    >
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {post.isPinned && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Icon icon="mdi:pin" className="size-3" />
                置顶
              </span>
            )}
            {post.category && (
              <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-full">{post.category.name}</span>
            )}
          </div>
          {/* h2 而非 h3：页面 h1 是论坛标题，跳级到 h3 会破坏标题层级 */}
          <h2 className="text-base font-semibold line-clamp-2">{post.title}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-1 text-xs text-muted-foreground">
            {post.author?.avatarUrl && (
              <img src={remoteThumb(post.author.avatarUrl, 64)} alt="" width={20} height={20} loading="lazy" decoding="async" className="h-5 w-5 rounded-full shrink-0" />
            )}
            <span className="truncate max-w-[9rem]">{post.author?.username || '匿名'}</span>
            <RoleBadge role={post.author?.role} />
            {post.createdAt && <span className="shrink-0">{post.createdAt.slice(0, 10)}</span>}
            <span className="inline-flex items-center gap-1 shrink-0">
              <Icon icon="mdi:eye-outline" className="size-3" />{formatCompactCount(post.viewCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <Icon icon="mdi:heart-outline" className="size-3" />{formatCompactCount(post.likeCount ?? 0)}
            </span>
            <span className="inline-flex items-center gap-1 shrink-0">
              <Icon icon="mdi:comment-outline" className="size-3" />{formatCompactCount(post.commentCount ?? 0)}
            </span>
          </div>
        </div>
        {post.coverImageUrl && (
          <img
            /* 封面原本是 S3 原图直出，显示成 112×84 却单张 30~200KB（抽样 8 张
               合计 721KB）。改走本站 /thumb 现缩 + 磁盘缓存，顺带从
               ny-1s.enzonix.com 挪回同源，省掉一次 DNS + TLS 握手。
               srcset 让移动端只取 192w：sizes 里 64px×DPR2 命中它 */
            src={remoteThumb(post.coverImageUrl, 288)}
            srcSet={`${remoteThumb(post.coverImageUrl, 192)} 192w, ${remoteThumb(post.coverImageUrl, 288)} 288w`}
            sizes="(min-width: 640px) 112px, 64px"
            alt=""
            width={112}
            height={84}
            /* 此前没有 loading 属性 —— 一页 20 帖的封面全部急加载，和正文抢带宽 */
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="w-16 sm:w-28 aspect-[4/3] rounded-lg object-cover shrink-0"
          />
        )}
      </div>
    </Link>
  );
}

/**
 * 服务端 loader 预取的首屏数据 —— 也是本页**唯一**的数据来源。
 * 筛选条件全部编码在 URL 里，翻页/搜索/排序/分类都是真链接或 GET 表单，
 * 由 loader 重新取数，组件不再自己 fetch。
 */
export interface ForumInitialData {
  posts: ForumPostSummary[];
  total: number;
  page: number;
  search: string;
  sort: string;
  category: string;
  categories: ForumCategory[];
  pageSize: number;
}

/**
 * 这里**不要**包 Suspense。数据由 loader 提供，没有任何东西会挂起，但 React 的
 * 流式 SSR 仍会为边界生成占位（`<!--$?-->` + `<template id="B:0">`），把列表
 * 甩到响应末尾的 `<div hidden id="S:0">` 里，靠内联 `$RC()` 脚本搬回原位 ——
 * 结果就是**禁用 JS 时整页空白**。去掉边界后列表直接落在 SSR shell 中。
 */
export default function ForumPage({ initial }: { initial: ForumInitialData }) {
  return <ForumContent initial={initial} />;
}

function ForumContent({ initial }: { initial: ForumInitialData }) {
  const listSearch = useLocation().search;
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const { user, logout } = useForumAuth();

  const { posts, total, page, search, sort, category, categories, pageSize } = initial;
  // 只有仍在论坛列表页内的导航才显示骨架（翻页/筛选/搜索），
  // 点击帖子跳转到 /forum/post/:id 时保持列表不变，避免骨架屏闪烁。
  const loading = navigation.state === 'loading' && navigation.location?.pathname === '/';

  const [searchInput, setSearchInput] = useState(search);
  const [forumDialogOpen, setForumDialogOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // 浏览器前进/后退时让输入框跟上 URL
  useEffect(() => { setSearchInput(search); }, [search]);

  // 埋点看已生效的 search（URL 上那个），不是输入框里的草稿 —— 否则边打字边上报，
  // 一次搜索能刷出十几条事件。防抖提交后 search 才变，正好一次一条
  useEffect(() => {
    if (search) track('站内搜索', { 范围: '论坛', 词: search, 结果数: total });
  }, [search]);

  // 有 JS 时保留「停止输入 300ms 自动搜索」的手感；无 JS 时按回车提交表单同样有效
  useEffect(() => {
    if (searchInput === search) return;
    const t = setTimeout(() => {
      if (formRef.current) submit(formRef.current, { replace: true });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, search, submit]);

  /** 生成 /forum 的 URL，未指定的筛选条件保持不变；改筛选条件时回到第 1 页 */
  const urlFor = (patch: { page?: number; search?: string; sort?: string; category?: string }) => {
    const next = { page, search, sort, category, ...patch };
    if (patch.page === undefined) next.page = 1;
    const p = new URLSearchParams();
    if (next.page > 1) p.set('page', String(next.page));
    if (next.search) p.set('search', next.search);
    if (next.sort && next.sort !== 'latest') p.set('sort', next.sort);
    if (next.category) p.set('category', next.category);
    const qs = p.toString();
    return `/forum/${qs ? '?' + qs : ''}`;
  };

  const categoryLabel = category ? categories.find((c) => c.id === category)?.name || '全部分类' : '全部分类';

  /** 有 JS 时 <Link> 走客户端导航、页面不重载，<details> 会一直开着 —— 点到就合上 */
  const closeDetails = (e: MouseEvent<HTMLElement>) => {
    (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
  };

  return (
    <>
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        {/* h1 而不是裸 button：这是本页的主标题，缺了它整页没有一级标题。
            内层保留 button 以打开论坛高级设置对话框（原交互不变）。 */}
        <h1 className="text-2xl font-bold">
          <button onClick={() => setForumDialogOpen(true)} className="hover:text-primary transition-colors text-left cursor-pointer">论坛</button>
        </h1>
        <div className="flex items-center gap-2">
          {/* 登录态未定时渲染「未登录」而不是 null：服务端拿不到登录态，
              渲染 null 会让禁用 JS 的访客连登录入口都看不到。已登录用户会有
              一瞬「登录」按钮闪现，换取无 JS 可用性，值得。 */}
          {user ? (
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 outline-none">
                  {user.avatarUrl ? (
                    <img src={remoteThumb(user.avatarUrl, 64)} alt="" width={28} height={28} loading="lazy" decoding="async" className="h-7 w-7 rounded-full" />
                  ) : (
                    <Icon icon="mdi:account" className="size-6" />
                  )}
                  <span className="text-sm">{user.username}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={() => navigate('/forum/me')}>个人中心</DropdownMenuItem>
                  {user.role === 'admin' && (
                    <DropdownMenuItem className="p-0">
                      <a href={withBase("/admin")} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 w-full">
                        管理员面板
                      </a>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => { logout(); navigate('/forum/'); }}>退出登录</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Link to="/forum/post/new"><Button size="sm">发帖</Button></Link>
            </div>
          ) : (
            <Link to="/forum/auth/login"><Button size="sm">登录</Button></Link>
          )}
        </div>
      </div>

      <div className="flex flex-row flex-wrap gap-2 mb-4">
        {/* GET 表单：无 JS 时回车即可搜索；有 JS 时上面的防抖 effect 自动提交 */}
        <Form ref={formRef} method="get" action="/forum/" className="flex-1 min-w-[12rem]">
          {sort !== 'latest' && <input type="hidden" name="sort" value={sort} />}
          {category && <input type="hidden" name="category" value={category} />}
          <input
            type="text"
            name="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索帖子…"
            aria-label="搜索帖子"
            className="w-full h-8 px-3 rounded-lg border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </Form>
        {/* 分类/排序：原生 <details> + 真链接。
            之前是 DropdownMenu（JS 驱动）配一段 <noscript> 纯链接兜底 ——
            等于同一功能维护两套 UI，且无 JS 时看到的是另一副样子。
            换成 <details> 后浏览器自己管开合，有无 JS 都是同一套。 */}
        <details className="relative group">
          <summary className="inline-flex items-center justify-between gap-1 h-8 w-[120px] cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-lg border border-input bg-transparent px-2.5 text-sm text-left">
            {categoryLabel}
            <Icon icon="mdi:chevron-down" className="size-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="absolute left-0 top-full z-50 mt-1 w-[120px] border border-foreground/80 bg-popover p-1 text-popover-foreground" onClick={closeDetails}>
            <Link to={urlFor({ category: '' })} className="block w-full px-2 py-1.5 text-sm hover:bg-foreground hover:text-background">全部分类</Link>
            {categories.map((c) => (
              <Link key={c.id} to={urlFor({ category: c.id })} className="block w-full px-2 py-1.5 text-sm hover:bg-foreground hover:text-background">{c.name}</Link>
            ))}
          </div>
        </details>
        <details className="relative group">
          <summary className="inline-flex items-center justify-between gap-1 h-8 w-[120px] cursor-pointer list-none [&::-webkit-details-marker]:hidden rounded-lg border border-input bg-transparent px-2.5 text-sm text-left">
            {SORT_OPTIONS.find((o) => o.value === sort)?.label || '排序'}
            <Icon icon="mdi:chevron-down" className="size-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
          </summary>
          <div className="absolute left-0 top-full z-50 mt-1 w-[120px] border border-foreground/80 bg-popover p-1 text-popover-foreground" onClick={closeDetails}>
            {SORT_OPTIONS.map((opt) => (
              <Link key={opt.value} to={urlFor({ sort: opt.value })} className="block w-full px-2 py-1.5 text-sm hover:bg-foreground hover:text-background">{opt.label}</Link>
            ))}
          </div>
        </details>
      </div>

      {loading ? (
        <div className="grid lg:grid-cols-2 border-t border-border lg:border-l">
          {Array.from({ length: 6 }).map((_, i) => (
            <ForumPostSkeleton key={i} />
          ))}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-3">共 {total} 个帖子</p>
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">暂无帖子</p>
          ) : (
            <div className="grid lg:grid-cols-2 border-t border-border lg:border-l">
              {posts.map((post) => <PostCard key={post.id} post={post} listSearch={listSearch} />)}
            </div>
          )}
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / pageSize))}
            hrefFor={(p) => urlFor({ page: p })}
          />
        </>
      )}
    </main>

      <Dialog.Dialog open={forumDialogOpen} onOpenChange={setForumDialogOpen}>
        <Dialog.DialogContent className="max-w-sm">
          <Dialog.DialogHeader>
            <Dialog.DialogTitle>论坛高级设置</Dialog.DialogTitle>
            <Dialog.DialogDescription>论坛环境切换与 API 地址配置</Dialog.DialogDescription>
          </Dialog.DialogHeader>
          <EnvironmentSwitcher type="forum" onClose={() => setForumDialogOpen(false)} />
        </Dialog.DialogContent>
      </Dialog.Dialog>
    </>
  );
}
