'use client';

import { useEffect, useMemo, memo } from 'react';

/** 解码 HTML 实体 —— mermaid 代码块内的 < > 被 escapeHtml 转义了 */
function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * 从 HTML 中提取 mermaid 代码块，替换为占位 div。
 * 占位 div 内含 `<pre>` 回退 —— 禁用 JS 时显示源码。
 */
export function extractMermaidBlocks(html: string): { cleanHtml: string; blocks: string[] } {
  const blocks: string[] = [];
  const cleanHtml = html.replace(
    /<div class="mermaid">([\s\S]*?)<\/div>/g,
    (_, code: string) => {
      const idx = blocks.length;
      const raw = code.trim();
      blocks.push(unescapeHtml(raw));
      return `<div data-mermaid-idx="${idx}"><pre class="mermaid-source text-xs text-muted-foreground overflow-x-auto">${raw}</pre></div>`;
    },
  );
  return { cleanHtml, blocks };
}

// ── 模块级预加载：JS 解析时就开始拉 mermaid chunk ──
let mermaidReady: Promise<any> | null = null;
function preloadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import('mermaid').then((m) => m.default);
  }
  return mermaidReady;
}

/**
 * 预加载必须**先确认这一页真的有图表**。
 *
 * 本模块被 posts_.slug.tsx / forum.post.$id.tsx 静态导入，所以每篇文章、每个
 * 帖子都会执行到这里。无条件 preload 会让 mermaid 那一堆 chunk（core + rough +
 * purify + dagre…，实测 ~110KB）下到**所有**读者机器上 —— 而 159 篇文章里只有
 * 6 篇含图表。实测未改前 /forum/post/19（零图表）也在下 mermaid.core。
 *
 * 判据用 `[data-mermaid-idx]`：SSR 时 MermaidContent 已经把 `<div class="mermaid">`
 * 换成了带这个属性的占位 div，所以服务端产物里找的是它而不是原始 class。
 * `<script type="module">` 是 defer 的，执行时 HTML 早已解析完，查得到。
 *
 * SPA 导航进来的图表页不走这条路径（模块此前已求值过），由 MermaidContent 的
 * effect 里那次 preloadMermaid() 兜住 —— 只是开始得稍晚，而首屏闪烁本来就只
 * 发生在直接打开的场景。
 */
if (typeof document !== 'undefined' && document.querySelector('[data-mermaid-idx]')) {
  preloadMermaid();
}

/**
 * 正文内容组件 —— 提取 mermaid 块后用 dangerouslySetInnerHTML 渲染纯文本，
 * mermaid 图表作为独立 React 子树存在，不受父组件重渲染影响。
 *
 * 用 React.memo 阻止 props 不变时的重渲染（父组件因 pageviews/auth 等
 * 状态变化重新 render 时，本组件和它的 dangerouslySetInnerHTML 不会被打扰，
 * 注入的 SVG 也就不会被回退成 <pre>）。
 */
export const MermaidContent = memo(function MermaidContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const { cleanHtml, blocks } = useMemo(() => extractMermaidBlocks(html), [html]);

  useEffect(() => {
    if (blocks.length === 0) return;
    let cancelled = false;

    preloadMermaid().then((mermaid) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false });
      for (let i = 0; i < blocks.length; i++) {
        // 只在预先约定好的占位 div 里注入 SVG —— 这些 div 存在于
        // cleanHtml 中，由 dangerouslySetInnerHTML 渲染，但只在初次
        // 挂载时被写入一次（memo 阻止了重写）。
        const placeholder = document.querySelector(`[data-mermaid-idx="${i}"]`);
        if (!placeholder) continue;
        mermaid
          .render(`mermaid-svg-${i}`, blocks[i])
          .then(({ svg }: { svg: string }) => {
            if (!cancelled) placeholder.innerHTML = svg;
          })
          .catch((err: unknown) => {
            console.error(`[mermaid] render failed for block ${i}:`, err);
          });
      }
    });

    return () => { cancelled = true; };
  }, [blocks]);

  if (!html) return null;

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: cleanHtml }}
    />
  );
});

/**
 * 旧 MermaidRenderer —— 已废弃，保留导出避免构建报错。
 * @deprecated 请用 MermaidContent 替代
 */
export function MermaidRenderer() {
  return null;
}
