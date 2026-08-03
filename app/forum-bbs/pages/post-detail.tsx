// 代码高亮样式只在有正文的路由加载，别提到全站入口去
import "@/forum-bbs/styles/hljs.css";
import { useLoaderData, type LoaderFunctionArgs } from "react-router";
import ForumPostPage from "@/forum-bbs/app/post/page";
import type { PostInitialData } from "@/forum-bbs/app/post/post-content";
import { PostToc } from "@/forum-bbs/components/post-toc";
import { buildToc } from "@/forum-bbs/lib/build-toc";
import { getPost, getComments, buildCommentTree } from "@/forum-bbs/lib/forum/api/client";
import { parseCommentSort } from "@/forum-bbs/lib/forum/api/map-comment";
import { loadRenderer } from "@/forum-bbs/lib/forum/markdown-client";
import { useSeo } from "@/forum-bbs/lib/seo/use-seo";
import { SITE_URL, canonicalPath, makeExcerpt } from "@/forum-bbs/lib/seo/route-meta";

/**
 * 帖子详情数据。
 *
 * 与 SSR 版本的两点差别：
 *  1. 正文 HTML 在这里就渲染好（`loadRenderer()` 是 markdown-it + DOMPurify 的
 *     按需加载壳）。**不能**留给组件渲染 —— 目录侧栏要先有 HTML 才能抽出标题，
 *     组件内部渲染的话首帧目录永远是空的。
 *  2. 评论只做树形整理、不预渲染 html：CommentItem 自己会用同一个（已缓存的）
 *     渲染器渲染 markdown。服务端那份预渲染是因为 DOMPurify 在 Node 里跑不了，
 *     这里根本没这个问题。
 *
 * 排序跟着 URL 上的 `?csort=` 走，所以三个排序按钮仍然是真链接。
 */
export async function clientLoader({ params, request }: LoaderFunctionArgs): Promise<PostInitialData> {
  const id = String(params.id || "");
  if (!/^\d+$/.test(id)) throw new Response("Not Found", { status: 404 });

  const commentSort = parseCommentSort(new URL(request.url).searchParams.get("csort"));

  const [post, rawComments, render] = await Promise.all([
    getPost(id).catch((e: unknown) => {
      // 后端 404 转成路由的 404，交给 RootErrorBoundary 画页面
      const status = e && typeof e === "object" && "status" in e ? (e as { status: number }).status : 0;
      if (status === 404) throw new Response("Not Found", { status: 404 });
      // 网络错误不整页崩溃：标记 apiError，页面渲染可恢复的错误提示
      return null;
    }),
    // 评论挂了不该让整篇帖子打不开
    getComments(id, commentSort).catch(() => []),
    loadRenderer(),
  ]);

  if (!post) {
    return {
      post: null,
      html: "",
      comments: buildCommentTree(rawComments),
      apiError: "网络错误，请检查连接后重试",
    };
  }

  return { post, html: render(post.content || ""), comments: buildCommentTree(rawComments) };
}
clientLoader.hydrate = true as const;

export function Component() {
  const { post, html, comments, apiError } = useLoaderData() as PostInitialData;

  // API 网络错误：渲染可恢复提示，不整页崩溃
  if (!post) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-xl font-bold">{apiError || "页面出错，请稍后重试"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          如果你切换到了本地后端，请先启动 127.0.0.1:8787，或切换回生产环境。
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="border border-border px-4 py-2 text-sm hover:text-white"
          >
            重新加载
          </button>
          <a href="/forum" className="border border-border px-4 py-2 text-sm hover:text-white">
            返回论坛
          </a>
        </div>
      </div>
    );
  }

  const toc = buildToc(html);
  const url = SITE_URL + canonicalPath(`/post/${post.id}`);

  useSeo({
    title: post.title,
    description:
      makeExcerpt(post.excerpt || post.content || "", 160) ||
      `${post.title} —— 来自二叉树树论坛的帖子。`,
    path: `/post/${post.id}`,
    ogType: "article",
    ogImage: post.coverImageUrl || undefined,
    // Google 论坛富媒体结果（讨论帖卡片）。纯 CSR 下这段是 JS 注入的，
    // 只有会执行 JS 的抓取工具才看得到 —— 见 README 的 SEO 说明
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "DiscussionForumPosting",
      "@id": `${url}#post`,
      url,
      headline: post.title,
      datePublished: post.createdAt || undefined,
      author: post.author?.username
        ? { "@type": "Person", name: post.author.username }
        : undefined,
      image: post.coverImageUrl || undefined,
      text: (post.excerpt || post.content || "").slice(0, 5000),
      interactionStatistic: [
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/CommentAction",
          userInteractionCount: post.commentCount ?? 0,
        },
        {
          "@type": "InteractionCounter",
          interactionType: "https://schema.org/LikeAction",
          userInteractionCount: post.likeCount ?? 0,
        },
      ],
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
    },
  });

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex gap-8 relative">
        <div className="flex-1 min-w-0">
          {/* key：帖子换了要重挂载。PostContent 把这份数据当 useState 初值
              （post / ssrHtml / comments / 点赞），只在挂载时读一次；同一条路由
              内换 :id 不会重挂，那些 state 就会停在上一篇帖子上。 */}
          <ForumPostPage key={post.id} initial={{ post, html, comments }} embedded />
        </div>
        <PostToc key={post.id} items={toc} />
      </div>
    </main>
  );
}
