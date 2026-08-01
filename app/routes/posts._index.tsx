import { Form, Link } from "react-router";
import type { Route } from "./+types/posts._index";
import { Rss, Search, Pin, Eye, Newspaper } from "lucide-react";
import { apiGet } from "~/lib/api.server";
import type { BlogPostListItem } from "~/lib/types";
import { Pagination } from "~/components/Pagination";

const PAGE_SIZE = 20;

export function meta() {
  return [
    { title: "博客文章 | 二叉树树" },
    { name: "description", content: "二叉树树的技术博客文章列表" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const all = await apiGet<BlogPostListItem[]>("/api/blog/posts");
  const filtered = q
    ? all.filter(
        (p) =>
          p.title.toLowerCase().includes(q.toLowerCase()) ||
          (p.description || "").toLowerCase().includes(q.toLowerCase())
      )
    : all;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return { items, q, page, totalPages, total: filtered.length };
}

function formatDate(date: string) {
  return (date || "").slice(0, 10);
}

export default function PostsIndex({ loaderData }: Route.ComponentProps) {
  const { items, q, page, totalPages } = loaderData;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">博客</h1>
        <a
          href="/posts/rss.xml"
          className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
        >
          <Rss className="h-4 w-4" /> RSS
        </a>
      </div>

      <Form method="get" className="mb-8 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="搜索文章…"
            className="w-full rounded border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-2 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded border border-border px-4 text-sm text-muted transition-colors hover:text-white"
        >
          搜索
        </button>
      </Form>

      {items.length === 0 ? (
        <p className="py-24 text-center text-sm text-muted-2">没有找到相关文章</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((post) => (
            <Link
              key={post.slug}
              to={`/posts/${post.slug}`}
              className="group flex overflow-hidden rounded-lg border border-border bg-card transition-colors hover:bg-card-hover"
            >
              {/* 封面 */}
              <div className="relative w-28 shrink-0 overflow-hidden bg-background sm:w-32">
                {post.coverImage ? (
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Newspaper className="h-7 w-7 text-muted-2" />
                  </div>
                )}
              </div>
              {/* 信息 */}
              <div className="flex min-w-0 flex-1 flex-col p-4">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-2">
                  {post.pin === 1 && (
                    <span className="flex items-center gap-0.5 text-amber-400">
                      <Pin className="h-3 w-3" /> 置顶
                    </span>
                  )}
                  <time>{formatDate(post.date)}</time>
                  {post.tags?.[0] && (
                    <>
                      <span>·</span>
                      <span>{post.tags[0]}</span>
                    </>
                  )}
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" /> {post.views}
                  </span>
                </div>
                <h2 className="mb-1 line-clamp-2 text-sm font-semibold leading-snug text-white transition-colors group-hover:text-white">
                  {post.title}
                </h2>
                <p className="line-clamp-2 text-xs leading-relaxed text-muted">
                  {post.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} />
    </main>
  );
}
