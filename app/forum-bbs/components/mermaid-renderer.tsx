'use client';

import { useEffect, useMemo, useState, memo, Fragment } from "react";

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

/** 转义 HTML 实体（源码回退显示用） */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 从 HTML 中切分 mermaid 代码块：返回"纯 HTML 片段数组 + mermaid 源码块数组"。
 * 渲染时在片段之间插入 mermaid SVG（React 子树），SSR 时插入源码回退。
 */
export function splitMermaidBlocks(html: string): { parts: string[]; blocks: string[] } {
  const parts: string[] = [];
  const blocks: string[] = [];
  const re = /<div class="mermaid">([\s\S]*?)<\/div>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    parts.push(html.slice(last, m.index));
    blocks.push(unescapeHtml(m[1].trim()));
    last = m.index + m[0].length;
  }
  parts.push(html.slice(last));
  return { parts, blocks };
}

/** 兼容旧导出：保留 extractMermaidBlocks（论坛旧调用方） */
export function extractMermaidBlocks(html: string): { cleanHtml: string; blocks: string[] } {
  const { parts, blocks } = splitMermaidBlocks(html);
  // 占位替换逻辑（SSR 渲染用）：mermaid div → 占位 div + 源码
  let cleanHtml = "";
  for (let i = 0; i < parts.length; i++) {
    cleanHtml += parts[i];
    if (i < blocks.length) {
      cleanHtml += `<div data-mermaid-idx="${i}"><pre class="mermaid-source text-xs text-muted-foreground overflow-x-auto">${escapeHtml(blocks[i])}</pre></div>`;
    }
  }
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
if (typeof document !== 'undefined' && document.querySelector('[data-mermaid-idx], .mermaid')) {
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
  as: Tag = "div",
  containerProps,
}: {
  html: string;
  className?: string;
  /** 容器标签（默认 div；博客正文用 article 保持语义） */
  as?: keyof React.JSX.IntrinsicElements;
  /** 透传给容器的额外属性（如 data-article） */
  containerProps?: Record<string, unknown>;
}) {
  // 渲染为 React 子树：svg 用 state 管理，由 React 插入/替换，
  // 避免 dangerouslySetInnerHTML 在水合后覆盖手写 DOM 的竞态
  const { parts, blocks } = useMemo(() => splitMermaidBlocks(html), [html]);
  const [svgs, setSvgs] = useState<(string | null)[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (blocks.length === 0) return;
    let cancelled = false;

    preloadMermaid().then((mermaid) => {
      if (cancelled) return;
      mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
      const results: (string | null)[] = new Array(blocks.length).fill(null);
      Promise.all(
        blocks.map((code, i) =>
          mermaid
            .render(`mermaid-svg-${i}`, code)
            .then(({ svg }: { svg: string }) => { results[i] = svg; })
            .catch((err: unknown) => {
              console.error(`[mermaid] render failed for block ${i}:`, err);
            }),
        ),
      ).then(() => {
        if (cancelled) return;
        setSvgs(results);
        setReady(true);
      });
    });

    return () => { cancelled = true; };
  }, [blocks]);

  if (!html) return null;

  const Container = Tag as React.ElementType;
  return (
    <Container className={className} {...containerProps}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part && <div dangerouslySetInnerHTML={{ __html: part }} />}
          {i < blocks.length && (
            ready && svgs[i] ? (
              <div className="mermaid-rendered" dangerouslySetInnerHTML={{ __html: svgs[i] }} />
            ) : (
              // 占位 + 源码回退（禁用 JS / 渲染前显示）
              <div className="mermaid">
                <pre className="mermaid-source text-xs text-muted-foreground overflow-x-auto">{escapeHtml(blocks[i])}</pre>
              </div>
            )
          )}
        </Fragment>
      ))}
    </Container>
  );
});

/**
 * 旧 MermaidRenderer —— 已废弃，保留导出避免构建报错。
 * @deprecated 请用 MermaidContent 替代
 */
export function MermaidRenderer() {
  return null;
}
