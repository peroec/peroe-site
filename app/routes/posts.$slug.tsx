import { Link } from "react-router";
import type { Route } from "./+types/posts.$slug";
import { ArrowLeft, CalendarDays, Eye } from "lucide-react";
import { marked } from "marked";
import { apiGet } from "~/lib/api.server";
import type { BlogPost } from "~/lib/types";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) return [{ title: "文章不存在 | 二叉树树" }];
  return [
    { title: `${loaderData.post.title} | 二叉树树` },
    { name: "description", content: loaderData.post.description || "" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  try {
    const post = await apiGet<BlogPost>(`/api/blog/posts/${params.slug}`);
    return { post };
  } catch {
    throw new Response("文章不存在", { status: 404 });
  }
}

export default function PostDetail({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  const html = marked.parse(post.content || "", { async: false }) as string;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        to="/posts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> 返回博客列表
      </Link>

      <h1 className="mb-4 text-3xl font-bold leading-tight text-white">{post.title}</h1>
      {post.description && (
        <p className="mb-4 leading-relaxed text-muted">{post.description}</p>
      )}

      <div className="mb-8 flex flex-wrap items-center gap-2 text-sm text-muted-2">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-4 w-4" /> {(post.date || "").slice(0, 10)}
        </span>
        <span>·</span>
        <span className="flex items-center gap-1">
          <Eye className="h-4 w-4" /> {post.views} 次浏览
        </span>
        {post.tags?.map((t) => (
          <span
            key={t}
            className="rounded border border-border bg-card px-2 py-0.5 text-xs text-muted"
          >
            {t}
          </span>
        ))}
      </div>

      {post.coverImage && (
        <img
          src={post.coverImage}
          alt={post.title}
          className="mb-8 w-full rounded-lg border border-border object-cover"
        />
      )}

      <article
        className="prose-dark"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </main>
  );
}
