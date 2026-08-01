import { Link } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/posts.$slug";
import { ArrowLeft, CalendarDays, Eye } from "lucide-react";
import { renderMarkdown } from "~/lib/markdown";
import { blogGet } from "~/lib/api.server";
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
    const post = await blogGet<BlogPost>(`/api/blog/posts/${params.slug}`);
    return { post };
  } catch {
    throw new Response("文章不存在", { status: 404 });
  }
}

/** 文章正文：代码复制按钮 + 图片 lightbox（纯客户端增强） */
function Article({ html }: { html: string }) {
  useEffect(() => {
    const root = document.querySelector('[data-article]');
    if (!root) return;

    const copyButtons = root.querySelectorAll<HTMLButtonElement>(".code-copy");
    const onCopy = (btn: HTMLButtonElement) => {
      const pre = btn.closest(".code-block")?.querySelector("pre code");
      if (!pre) return;
      const text = pre.textContent || "";
      navigator.clipboard?.writeText(text).catch(() => {});
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 2000);
    };
    copyButtons.forEach((btn) => btn.addEventListener("click", () => onCopy(btn)));

    const imgs = root.querySelectorAll<HTMLImageElement>("img[data-lightbox]");
    const onImgClick = (img: HTMLImageElement) => {
      const overlay = document.createElement("div");
      overlay.className = "lightbox";
      overlay.innerHTML = `<img src="${img.src}" alt="${img.alt || ""}" />`;
      overlay.addEventListener("click", () => overlay.remove());
      document.body.appendChild(overlay);
    };
    imgs.forEach((img) => img.addEventListener("click", () => onImgClick(img)));

    return () => {
      copyButtons.forEach((btn) => btn.removeEventListener("click", () => onCopy(btn)));
    };
  }, [html]);

  return <article data-article className="prose-dark" dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function PostDetail({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  const html = renderMarkdown(post.content || "");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <Link
        to="/posts"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> 返回博客列表
      </Link>

      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold leading-tight tracking-tight text-white">
          {post.title}
        </h1>
        {post.description && (
          <p className="mt-3 leading-relaxed text-muted">{post.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-2">
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" /> {(post.date || "").slice(0, 10)}
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" /> {post.views} 次浏览
          </span>
          {post.tags?.map((t) => (
            <span
              key={t}
              className="rounded-full bg-neutral-800 px-2.5 py-0.5 text-xs font-medium text-muted"
            >
              {t}
            </span>
          ))}
        </div>
        {post.coverImage && (
          <img
            src={post.coverImage}
            alt={post.title}
            data-lightbox
            className="mt-6 aspect-video w-full cursor-zoom-in rounded-xl object-cover"
          />
        )}
      </header>

      <Article html={html} />
    </main>
  );
}
