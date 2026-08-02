import { useEffect, useState } from 'react';

/**
 * 论坛正文/评论的**客户端** markdown 渲染器 —— 按需加载。
 *
 * 为什么要懒：`render-markdown`（markdown-it + highlight.js）打出来是 75KB，是
 * `/post/:id` 上最大的一个 chunk，再加上 DOMPurify —— 而这两样首屏一个
 * 都用不上：帖子正文由 loader 预渲染成 `ssrHtml`，首屏评论也带着服务端渲染好的
 * `.html`（净化走 app/lib/sanitize.server.ts）。此前它们是模块顶层静态导入，
 * 于是**每个未登录访客**都要把这 90KB 下完才算加载结束。
 *
 * 真正需要它的只有两种情况，都在水合之后：
 *   1. 已登录用户会重新拉一遍评论（见 post-content.tsx 的 hasInitialComments），
 *      拉回来的是原始 markdown，后端不返回 html；
 *   2. 用户自己新发/编辑的内容要立刻显示。
 *
 * 后端接口只回 `content` 原文（实测 /api/posts/19/comments 无 html 字段），
 * 所以这条客户端渲染路径不能省，只能推迟。
 *
 * DOMPurify 依赖真实 DOM，Node 里跑不了 —— 本模块因此只应在浏览器中被调用，
 * 服务端那条路径走 sanitize.server.ts（两边配置逐字节等价，别各写一份）。
 */

type Renderer = (markdown: string) => string;

let cached: Renderer | null = null;
let loading: Promise<Renderer> | null = null;

/** 已就绪则返回渲染器，否则 null（渲染期同步读取用，不触发加载） */
export function peekRenderer(): Renderer | null {
  return cached;
}

/**
 * 加载渲染器。可重复调用，只会真的 import 一次。
 *
 * 调用点应当**尽早**触发（例如与拉评论的请求同时发出），让这 90KB 和网络请求
 * 并行，评论回来时渲染器通常已经就绪，不会出现内容闪空。
 */
export function loadRenderer(): Promise<Renderer> {
  if (cached) return Promise.resolve(cached);
  loading ??= Promise.all([
    import('@/forum-bbs/lib/render-markdown'),
    import('dompurify'),
  ]).then(([md, dp]) => {
    const purify = dp.default;
    cached = (markdown: string) => purify.sanitize(md.renderMarkdown(markdown || ''));
    return cached;
  });
  return loading;
}

/**
 * 渲染期用的 hook：`needed` 为真时触发加载，就绪后重渲染一次。
 *
 * 返回 null 表示还没就绪，调用方应渲染空内容而不是原始 markdown ——
 * 直接显示原文会把 `<script>` 之类未净化的内容摊到页面上。
 *
 * SSR 安全：服务端 `cached` 恒为 null、effect 不跑，因此服务端与客户端首次
 * 渲染的结果一致；有服务端 html 的内容本来就不走这条路径（调用方传 needed=false）。
 */
export function useRenderer(needed: boolean): Renderer | null {
  const [, bump] = useState(0);
  // 记下**本次渲染实际读到的值**，而不是在 effect 里重新读 cached。
  // cached 是模块级变量，React 不知道它变过：若 effect 里写成
  // `if (cached) return`，那么「本次渲染读到 null、effect 执行前别的组件把它
  // 填上了」这一刻会直接 return，这个组件再也不会重渲染 —— 评论永远空白。
  // 把 seen 放进依赖数组：它由 null 变成函数时 effect 会重跑并正常短路。
  const seen = cached;
  useEffect(() => {
    if (!needed || seen) return;
    let alive = true;
    loadRenderer().then(() => {
      if (alive) bump((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [needed, seen]);
  return seen;
}
