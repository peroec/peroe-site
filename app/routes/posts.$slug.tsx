import { Link } from "react-router";
import { useEffect, useState } from "react";
import type { Route } from "./+types/posts.$slug";
import { ArrowLeft, CalendarDays, Eye, FilePen } from "lucide-react";
// 高亮在客户端完成：hljs 随文章页 chunk 加载（懒加载路由），SSR 不执行
import hljs from "highlight.js/lib/common";
import powershell from "highlight.js/lib/languages/powershell";
import nginx from "highlight.js/lib/languages/nginx";
import http from "highlight.js/lib/languages/http";
import { renderMarkdown } from "~/lib/markdown";
import { getPostBySlug } from "~/lib/posts.server";
import { fetchUmamiPageviews } from "~/lib/umami-views";
import {
  ArticleTableOfContents,
  extractArticleHeadings,
} from "~/components/ArticleTableOfContents";
import { Giscus } from "~/components/Giscus";
import { ArticleReadingProgress } from "~/components/ArticleReadingProgress";
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

/** 文章正文：客户端代码高亮 + 复制按钮 + 图片 lightbox（纯客户端增强，SSR 零高亮成本） */
function Article({ html }: { html: string }) {
  useEffect(() => {
    const root = document.querySelector('[data-article]');
    if (!root) return;
    let cancelled = false;

    // 客户端代码高亮：SSR 只输出纯文本 + data-highlight 标记，这里动态高亮。
    // 用 MutationObserver 等 DOM 稳定（React 水合/dangerouslySetInnerHTML
    // 连续 300ms 无变化）后再执行，避免固定延迟在不同环境加载时序下失效。
    const doHighlight = () => {
      const current = document.querySelectorAll<HTMLElement>("[data-article] code[data-highlight]");
      if (current.length === 0) return;
      try {
        hljs.registerLanguage("powershell", powershell);
        hljs.registerLanguage("nginx", nginx);
        hljs.registerLanguage("http", http);
      } catch (e) {
        console.error("[hljs] registerLanguage failed:", e);
      }
      current.forEach((el) => {
        const lang = (el.className.match(/language-([\w-]+)/) || [])[1];
        el.classList.add("hljs");
        if (lang && hljs.getLanguage(lang)) {
          hljs.highlightElement(el);
        }
      });
    };
    let stableTimer = 0;
    const tryHighlight = () => {
      if (stableTimer) clearTimeout(stableTimer);
      stableTimer = window.setTimeout(doHighlight, 300);
    };
    tryHighlight();
    const observer = new MutationObserver(tryHighlight);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    // 3 秒兜底：确保即使观察器漏掉也会高亮一次
    const fallback = window.setTimeout(doHighlight, 3000);

    // 代码复制 + 图片 lightbox：用事件委托绑定到 document，
    // 免疫水合后 DOM 替换（绑定到具体元素会被 React 重置掉）
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const copyBtn = target.closest?.(".code-copy") as HTMLButtonElement | null;
      if (copyBtn) {
        const pre = copyBtn.closest(".code-block")?.querySelector("pre code");
        if (!pre) return;
        const text = pre.textContent || "";
        navigator.clipboard?.writeText(text).catch(() => {});
        copyBtn.classList.add("copied");
        setTimeout(() => copyBtn.classList.remove("copied"), 2000);
        return;
      }
      const img = target.closest?.("img[data-lightbox]") as HTMLImageElement | null;
      if (img) {
        const overlay = document.createElement("div");
        overlay.className = "lightbox";
        overlay.innerHTML = `<img src="${img.src}" alt="${img.alt || ""}" />`;
        overlay.addEventListener("click", () => overlay.remove());
        document.body.appendChild(overlay);
      }
    };
    document.addEventListener("click", onDocClick);

    return () => {
      cancelled = true;
      observer.disconnect();
      clearTimeout(stableTimer);
      clearTimeout(fallback);
      document.removeEventListener("click", onDocClick);
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

  // 浏览量：SSR 恒 0，客户端水合后用 umami 回显（shareToken 未配置则保持 0）
  const [views, setViews] = useState<number>(post.views ?? 0);
  useEffect(() => {
    let cancelled = false;
    // 路径与博客路由一致（umami 精确匹配，注意尾斜杠）
    fetchUmamiPageviews(`/posts/${post.slug}/`).then((v) => {
      if (!cancelled && typeof v === "number") setViews(v);
    });
    return () => { cancelled = true; };
  }, [post.slug]);

  return (
    <>
      <ArticleReadingProgress />
      <main className="article-shell container mx-auto max-w-6xl px-4 py-8">
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
                {views} 次浏览
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
    </>
  );
}
