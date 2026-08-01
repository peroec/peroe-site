import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/forum.post.$id";
import { ArrowLeft, Eye, Heart, Pin } from "lucide-react";
import { marked } from "marked";
import { apiGet } from "~/lib/api.server";
import type { RawComment, RawPost } from "~/lib/types";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) return [{ title: "帖子不存在 | 论坛 | 二叉树树" }];
  return [
    { title: `${loaderData.post.title} | 论坛 | 二叉树树` },
    { name: "description", content: loaderData.post.excerpt || "" },
  ];
}

const SORT_MAP: Record<string, { sort_by: string; sort_dir: string }> = {
  hot: { sort_by: "likes", sort_dir: "desc" },
  new: { sort_by: "time", sort_dir: "desc" },
  old: { sort_by: "time", sort_dir: "asc" },
};

export async function loader({ params, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const sort = SORT_MAP[url.searchParams.get("sort") || "hot"] || SORT_MAP.hot;
  try {
    const [post, comments] = await Promise.all([
      apiGet<RawPost>(`/api/posts/${params.id}`),
      apiGet<RawComment[]>(
        `/api/posts/${params.id}/comments?sort_by=${sort.sort_by}&sort_dir=${sort.sort_dir}`
      ),
    ]);
    return { post, comments };
  } catch {
    throw new Response("帖子不存在", { status: 404 });
  }
}

function formatDate(date: string) {
  return (date || "").slice(0, 10);
}

export default function ForumPost({ loaderData }: Route.ComponentProps) {
  const { post, comments } = loaderData;
  const [params, setParams] = useSearchParams();
  const sort = params.get("sort") || "hot";
  const html = marked.parse(post.content || "", { async: false }) as string;
  const [liked, setLiked] = useState(post.liked);
  const [likeCount, setLikeCount] = useState(post.like_count);

  const toggleLike = async () => {
    const token = localStorage.getItem("forum_token");
    if (!token) {
      location.href = `/forum/auth/login?redirect=${encodeURIComponent(location.pathname)}`;
      return;
    }
    const res = await fetch(`${API_BASE}/api/posts/${post.id}/like`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { liked: boolean; likeCount: number };
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    }
  };

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        to="/forum"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> 返回论坛
      </Link>

      <h1 className="mb-4 text-2xl font-bold leading-snug text-white">{post.title}</h1>

      <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-6 text-sm text-muted-2">
        {post.author_avatar && (
          <img
            src={post.author_avatar}
            alt={post.author_name}
            className="h-8 w-8 rounded-full object-cover"
          />
        )}
        <span className="text-muted">{post.author_name}</span>
        {post.author_role === "admin" && (
          <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-xs text-muted">管理员</span>
        )}
        <time>{formatDate(post.created_at)}</time>
        <span className="flex items-center gap-1">
          <Eye className="h-4 w-4" /> {post.view_count}
        </span>
        <button
          type="button"
          onClick={toggleLike}
          className={`flex items-center gap-1 transition-colors ${
            liked ? "text-accent" : "hover:text-white"
          }`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} /> {likeCount}
        </button>
      </div>

      <article className="prose-dark" dangerouslySetInnerHTML={{ __html: html }} />

      {/* 评论区 */}
      <section className="mt-12 border-t border-border pt-8">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">评论</h2>
          <div className="flex overflow-hidden rounded border border-border text-xs">
            {[
              { key: "hot", label: "最热" },
              { key: "new", label: "最新" },
              { key: "old", label: "最早" },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setParams({ sort: s.key })}
                className={`px-3 py-1.5 transition-colors ${
                  sort === s.key
                    ? "bg-white font-medium text-black"
                    : "text-muted hover:text-white"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <CommentBox postId={post.id} />

        {comments.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-2">暂无评论</p>
        ) : (
          <ul className="space-y-5">
            {comments.map((c) => (
              <li key={c.id} className="flex gap-3">
                {c.avatar_url ? (
                  <img
                    src={c.avatar_url}
                    alt={c.username}
                    className="h-8 w-8 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-xs text-muted">
                    {c.username?.[0] || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-2">
                    <span className="text-sm text-muted">{c.username}</span>
                    {c.role === "admin" && (
                      <span className="rounded bg-neutral-800 px-1 py-px text-[10px]">管理员</span>
                    )}
                    {c.is_pinned === 1 && (
                      <span className="flex items-center gap-0.5 text-amber-400">
                        <Pin className="h-3 w-3" /> 置顶
                      </span>
                    )}
                    <time>{formatDate(c.created_at)}</time>
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {c.content}
                  </p>
                  <span className="mt-1.5 flex items-center gap-1 text-xs text-muted-2">
                    <Heart className="h-3 w-3" /> {c.like_count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

const API_BASE =
  (typeof window !== "undefined" && (window as any).__API_BASE__) ||
  "http://127.0.0.1:8787";

/** 评论输入框（未登录时引导登录） */
function CommentBox({ postId }: { postId: number }) {
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn] = useState(
    () => typeof window !== "undefined" && !!localStorage.getItem("forum_token")
  );

  if (!loggedIn) {
    return (
      <Link
        to={`/forum/auth/login?redirect=${encodeURIComponent(`/forum/post/${postId}`)}`}
        className="mb-8 block rounded-lg border border-border bg-card py-4 text-center text-sm text-muted transition-colors hover:text-white"
      >
        登录 后即可评论
      </Link>
    );
  }

  const submit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("forum_token")}`,
        },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || "评论失败");
      }
      location.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "评论失败");
      setSubmitting(false);
    }
  };

  return (
    <div className="mb-8">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="写下你的评论…"
        rows={3}
        className="w-full resize-y rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-2 focus:border-neutral-500 focus:outline-none"
      />
      {error && <p className="mt-1 text-xs text-accent">{error}</p>}
      <div className="mt-2 text-right">
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !content.trim()}
          className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black transition-opacity disabled:opacity-40"
        >
          {submitting ? "发表中…" : "发表评论"}
        </button>
      </div>
    </div>
  );
}
