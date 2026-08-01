import { Form, Link } from "react-router";
import type { Route } from "./+types/forum._index";
import { Search, Eye, Heart, MessageSquare, Pin, LogIn } from "lucide-react";
import { apiGet } from "~/lib/api.server";
import type { Category, RawPost } from "~/lib/types";
import { Pagination } from "~/components/Pagination";

const PAGE_SIZE = 20;

export function meta() {
  return [
    { title: "论坛社区 | 二叉树树" },
    { name: "description", content: "基于 Cloudflare 全栈的社区论坛" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const categoryId = url.searchParams.get("category_id") || "";
  const sortBy = url.searchParams.get("sort_by") || "time";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    sort_by: sortBy,
  });
  if (q) params.set("q", q);
  if (categoryId) params.set("category_id", categoryId);

  const [data, categories] = await Promise.all([
    apiGet<{ posts: RawPost[]; total: number }>(`/api/posts?${params}`),
    apiGet<Category[]>("/api/categories"),
  ]);

  return {
    posts: data.posts,
    total: data.total,
    categories,
    q,
    categoryId,
    sortBy,
    page,
    totalPages: Math.max(1, Math.ceil(data.total / PAGE_SIZE)),
  };
}

function formatDate(date: string) {
  return (date || "").slice(0, 10);
}

export default function ForumIndex({ loaderData }: Route.ComponentProps) {
  const { posts, total, categories, q, categoryId, sortBy, page, totalPages } =
    loaderData;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">论坛</h1>
        <Link
          to="/forum/auth/login"
          className="flex items-center gap-1.5 rounded bg-white px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
        >
          <LogIn className="h-4 w-4" /> 登录
        </Link>
      </div>

      <Form method="get" className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-52 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="搜索帖子…"
            className="w-full rounded border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-2 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <select
          name="category_id"
          defaultValue={categoryId}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-muted focus:outline-none"
        >
          <option value="">全部分类</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          name="sort_by"
          defaultValue={sortBy}
          className="rounded border border-border bg-card px-3 py-2 text-sm text-muted focus:outline-none"
        >
          <option value="time">最新发布</option>
          <option value="time_asc">最早发布</option>
          <option value="likes">最多点赞</option>
          <option value="comments">最多评论</option>
          <option value="views">最多浏览</option>
        </select>
        <button
          type="submit"
          className="rounded border border-border px-4 text-sm text-muted transition-colors hover:text-white"
        >
          搜索
        </button>
      </Form>

      <p className="mb-4 text-xs text-muted-2">共 {total} 个帖子</p>

      {posts.length === 0 ? (
        <p className="py-24 text-center text-sm text-muted-2">暂无帖子</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.id}
              to={`/forum/post/${post.id}`}
              className="group flex justify-between gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card-hover"
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1.5">
                  {post.is_pinned === 1 ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-amber-400/10 px-1.5 py-0.5 text-xs text-amber-400">
                      <Pin className="h-3 w-3" /> 置顶
                    </span>
                  ) : post.category_name ? (
                    <span className="inline-block rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-muted">
                      {post.category_name}
                    </span>
                  ) : null}
                </div>
                <h2 className="mb-2 line-clamp-2 text-sm font-semibold leading-snug text-white">
                  {post.title}
                </h2>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-2">
                  {post.author_avatar && (
                    <img
                      src={post.author_avatar}
                      alt={post.author_name}
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  )}
                  <span className="text-muted">{post.author_name}</span>
                  {post.author_role === "admin" && (
                    <span className="rounded bg-neutral-800 px-1 py-px text-[10px] text-muted">
                      管理员
                    </span>
                  )}
                  {post.author_role === "bot" && (
                    <span className="rounded bg-neutral-800 px-1 py-px text-[10px] text-muted">
                      机器人
                    </span>
                  )}
                  <time>{formatDate(post.created_at)}</time>
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" /> {post.view_count}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Heart className="h-3 w-3" /> {post.like_count}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <MessageSquare className="h-3 w-3" /> {post.comment_count}
                  </span>
                </div>
              </div>
              {post.cover_image_url && (
                <img
                  src={post.cover_image_url}
                  alt=""
                  className="h-20 w-24 shrink-0 rounded border border-border object-cover"
                />
              )}
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </main>
  );
}
