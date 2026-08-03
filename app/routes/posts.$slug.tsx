import { Link } from "react-router";
import { useEffect } from "react";
import type { Route } from "./+types/posts.$slug";
import { ArrowLeft, CalendarDays, Eye, FilePen } from "lucide-react";
import { renderMarkdown } from "~/lib/markdown";
import { getPostBySlug } from "~/lib/posts.server";
import {
  ArticleTableOfContents,
  extractArticleHeadings,
} from "~/components/ArticleTableOfContents";
import { Giscus } from "~/components/Giscus";
import { MermaidContent } from "~/forum-bbs/components/mermaid-renderer";

export function meta({ loaderData }: Route.MetaArgs) {
  if (!loaderData?.post) return [{ title: "文章不存在 | peroe" }];
  return [
    { title: `${loaderData.post.title} | peroe` },
    { name: "description", content: loaderData.post.description || "" },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const post = getPostBySlug(params.slug || "");
  if (!post) throw new Response("文章不存在", { status: 404 });
  return { post };
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

  return (
    <MermaidContent
      html={html}
      className="prose-dark"
      as="article"
      containerProps={{ "data-article": true }}
    />
  );
}

export default function PostDetail({ loaderData }: Route.ComponentProps) {
  const { post } = loaderData;
  const html = renderMarkdown(post.content || "");
  const headings = extractArticleHeadings(html);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="relative flex gap-8">
        <article className="mx-auto min-w-0 max-w-3xl flex-1">
          <Link
            to="/posts"
            className="mb-2 inline-flex items-center gap-1 py-2 text-sm text-muted transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回博客列表
          </Link>

          <header className="mb-8 border-b border-border pb-6">
            <h1 className="text-3xl font-bold tracking-tight text-white">
              {post.title}
            </h1>
            {post.description && (
              <p className="mt-3 text-base leading-relaxed text-muted">
                {post.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs leading-none text-muted-2">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                <time dateTime={post.date}>{(post.date || "").slice(0, 10)}</time>
              </span>
              <span aria-hidden>·</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3" />
                {post.views} 次浏览
              </span>
              {post.tags?.length > 0 && (
                <div className="flex gap-1.5">
                  {post.tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {post.coverImage && (
              <img
                src={post.coverImage}
                alt={post.title}
                data-lightbox
                className="mt-6 aspect-video w-full cursor-zoom-in object-cover"
                loading="eager"
              />
            )}
          </header>

          <div className="prose-dark max-w-none">
            <Article html={html} />
          </div>

          <div className="mt-10 border-t border-border pt-6">
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-2">
              <FilePen className="h-4 w-4" />
              本文由 PagesCMS 管理
            </span>
          </div>

          <section id="comments" className="mt-10 border-t border-border pt-8">
            <h2 className="mb-6 text-2xl font-semibold text-white">评论</h2>
            <Giscus />
          </section>
        </article>

        <aside className="hidden w-[320px] shrink-0 self-start xl:sticky xl:top-20 xl:block">
          <ArticleTableOfContents headings={headings} />
        </aside>
      </div>

      <div className="xl:hidden">
        <ArticleTableOfContents headings={headings} />
      </div>
    </main>
  );
}
