import MarkdownIt from 'markdown-it';
import iconSubset from '@/forum-bbs/lib/icons/subset.json';
import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import python from 'highlight.js/lib/languages/python';
import json from 'highlight.js/lib/languages/json';
import yaml from 'highlight.js/lib/languages/yaml';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import php from 'highlight.js/lib/languages/php';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import ini from 'highlight.js/lib/languages/ini';
import nginx from 'highlight.js/lib/languages/nginx';
import markdown from 'highlight.js/lib/languages/markdown';

for (const [name, lang] of Object.entries({
  bash, javascript, typescript, python, json, yaml, xml, css, php, rust, sql, dockerfile, ini, nginx, markdown,
})) hljs.registerLanguage(name, lang);

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const CALLOUT_TYPES = ['TIP', 'INFO', 'NOTE', 'WARNING', 'CAUTION', 'DANGER', 'IMPORTANT'];

/* callout 图标：内联 mdi SVG（currentColor 跟随各类型标题色）。
   不用 emoji——与 Shell 主题一致；不用 iconify React 组件——此处输出纯 HTML
   字符串，且边缘预渲染 Worker 复用同一管线。 */
const CALLOUT_ICONS: Record<string, string> = {
  tip: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M20 11h3v2h-3zM1 11h3v2H1zM13 1v3h-2V1zM4.92 3.5l2.13 2.14l-1.42 1.41L3.5 4.93zm12.03 2.13l2.12-2.13l1.43 1.43l-2.13 2.12zM12 6a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V19a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.8c-1.79-1.04-3-2.98-3-5.2a6 6 0 0 1 6-6m2 15v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1zm-3-3h2v-2.13c1.73-.44 3-2.01 3-3.87a4 4 0 0 0-4-4a4 4 0 0 0-4 4c0 1.86 1.27 3.43 3 3.87z"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8s8 3.59 8 8s-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2z"/></svg>',
  note: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="m18.13 12l1.26-1.26c.44-.44 1-.68 1.61-.74V9l-6-6H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h6v-1.87l.13-.13H5V5h7v7zM14 4.5l5.5 5.5H14zm5.13 9.33l2.04 2.04L15.04 22H13v-2.04zm3.72.36l-.98.98l-2.04-2.04l.98-.98c.19-.2.52-.2.72 0l1.32 1.32c.2.2.2.53 0 .72"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M12 2L1 21h22M12 6l7.53 13H4.47M11 10v4h2v-4m-2 6v2h2v-2"/></svg>',
  caution: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M7 2h10l-3.5 7H17l-7 13v-8H7zm2 2v8h3v2.66L14 11h-3.76l3.52-7z"/></svg>',
  danger: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M8.27 3L3 8.27v7.46L8.27 21h7.46C17.5 19.24 21 15.73 21 15.73V8.27L15.73 3M9.1 5h5.8L19 9.1v5.8L14.9 19H9.1L5 14.9V9.1m4.12-1.39L7.71 9.12L10.59 12l-2.88 2.88l1.41 1.41L12 13.41l2.88 2.88l1.41-1.41L13.41 12l2.88-2.88l-1.41-1.41L12 10.59"/></svg>',
  important: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10a10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 0 1-8-8a8 8 0 0 1 8-8a8 8 0 0 1 8 8a8 8 0 0 1-8 8"/></svg>',
};

const CALLOUT_TITLES: Record<string, string> = {
  tip: '提示',
  info: '信息',
  note: '注意',
  warning: '警告',
  caution: '小心',
  danger: '危险',
  important: '重要',
};

/* 代码块 chrome 的图标。
   上面 callout 那批图标是手抄的内联 SVG 常量（写在这个管线还没有图标子集的年代）；
   这里语言图标有十几个，改成查 scripts/build-icon-subset.mjs 构建出来的同一份子集，
   路径数据直接来自 @iconify-json/*，不用人肉抄。
   **图标名必须写成字面量**：子集构建器是拿正则扫源码里的 'prefix:name' 字面量来
   决定收录哪些图标的，拼接出来的名字它扫不到，线上查表就是空。 */
const LANG_ICONS: Record<string, string> = {
  bash: 'mdi:console-line',
  sh: 'mdi:console-line',
  shell: 'mdi:console-line',
  zsh: 'mdi:console-line',
  console: 'mdi:console-line',
  javascript: 'simple-icons:javascript',
  js: 'simple-icons:javascript',
  jsx: 'simple-icons:javascript',
  typescript: 'simple-icons:typescript',
  ts: 'simple-icons:typescript',
  tsx: 'simple-icons:typescript',
  python: 'simple-icons:python',
  py: 'simple-icons:python',
  json: 'mdi:code-json',
  yaml: 'simple-icons:yaml',
  yml: 'simple-icons:yaml',
  xml: 'mdi:xml',
  html: 'mdi:xml',
  css: 'mdi:language-css3',
  php: 'simple-icons:php',
  rust: 'simple-icons:rust',
  rs: 'simple-icons:rust',
  sql: 'mdi:database',
  dockerfile: 'simple-icons:docker',
  docker: 'simple-icons:docker',
  ini: 'mdi:cog-outline',
  conf: 'mdi:cog-outline',
  toml: 'mdi:cog-outline',
  nginx: 'simple-icons:nginx',
  markdown: 'mdi:language-markdown',
  md: 'mdi:language-markdown',
};
/** 没声明语言、或声明了但不在上表里时的通用图标 */
const FALLBACK_LANG_ICON = 'mdi:code-tags';
const COPY_ICON = 'mdi:content-copy';
const COPIED_ICON = 'mdi:check';

type IconEntry = { body?: string; width?: number; height?: number; left?: number; top?: number };
type IconCollection = { icons: Record<string, IconEntry>; width?: number; height?: number };

/** 查子集表出一段 <svg> 字符串。表里没有就返回空串 —— 图标没了但文字还在，不至于崩 */
function iconSvg(name: string, className: string): string {
  const [prefix, id] = name.split(':');
  const collection = (iconSubset as Record<string, IconCollection>)[prefix];
  const data = collection?.icons?.[id];
  if (!data?.body) return '';
  const w = data.width ?? collection.width ?? 24;
  const h = data.height ?? collection.height ?? 24;
  const l = data.left ?? 0;
  const t = data.top ?? 0;
  return (
    `<svg class="${className}" xmlns="http://www.w3.org/2000/svg" ` +
    `viewBox="${l} ${t} ${w} ${h}" aria-hidden="true">${data.body}</svg>`
  );
}

/* 一键复制按钮与语言标签：按钮行为由全局委托监听（code-copy-listener）处理，
   样式在 globals.css（.code-copy / .code-lang）。
   两个图标都渲染出来，复制成功时由 CSS 按 .is-copied 切换显示，省得在监听里
   拼 DOM —— 也就不会像以前那样一句 btn.textContent = '…' 把图标一起冲掉。 */
/* 不要加 aria-label="复制代码"：按钮的可见文字是 "copy"，无障碍名里不含可见文字
   会触发 WCAG 2.5.3（label-content-name-mismatch），语音控制说"复制代码"点不动它。
   可见文字本身就是无障碍名（两个 svg 都是 aria-hidden），中文说明放 title 当 tooltip */
const COPY_BTN =
  '<button type="button" class="code-copy" title="复制代码">' +
  iconSvg(COPY_ICON, 'code-icon code-icon-copy') +
  iconSvg(COPIED_ICON, 'code-icon code-icon-copied') +
  '<span class="code-copy-label">copy</span></button>';

const langLabel = (lang: string) =>
  `<span class="code-lang">` +
  iconSvg(LANG_ICONS[lang] ?? FALLBACK_LANG_ICON, 'code-icon') +
  (lang ? `<span class="code-lang-name">${escapeHtml(lang)}</span>` : '') +
  `</span>`;

/* 代码块结构：头部单独一行放 chrome，代码在下面自己横向滚。
     <div class="code-block">
       <div class="code-head"><span class="code-lang">bash</span><button class="code-copy">copy</button></div>
       <pre class="hljs"><code>…</code></pre>
     </div>
   chrome 曾经是绝对定位压在 pre 左上/右上角的，但 pre 自己就是 overflow-x:auto
   的滚动容器 —— 绝对定位算的是**滚动内容**的坐标系而不是可视区，代码只要有一行
   长过容器宽度，横向一滑 chrome 就被带出可视区，手机上 copy 按钮直接点不到。
   改成独立一行之后不再需要任何定位，横向滚动天然影响不到它，顺带也不会再压住
   代码的第一行。 */
const codeBlock = (lang: string, codeHtml: string) =>
  `<div class="code-block"><div class="code-head">${langLabel(lang)}${COPY_BTN}</div>` +
  `<pre class="hljs"><code>${codeHtml}</code></pre></div>`;

const md = new MarkdownIt({
  html: true,
  linkify: true,
});

/* 围栏代码块**必须**接管 renderer.rules.fence，不能用 MarkdownIt 的 highlight 选项。
   highlight 的返回值只有以 `<pre` 开头时才被原样采用，否则 markdown-it 会再给它
   套一层 `<pre><code>…</code></pre>`（见 markdown-it 的 default_rules.fence）。
   我们要输出的是 <div> 开头的结构，走 highlight 就会变成
   `<pre><code><div class="code-block"><pre class="hljs">…` —— 两层 pre 套娃，
   外层还带着 .prose pre 的背景和内边距，视觉上就是代码缩在一个大出一圈的
   同色底板中间。mermaid 分支同理（它返回的也是 <div>），此前一直被套着。 */
md.renderer.rules.fence = (tokens, idx) => {
  const token = tokens[idx];
  const info = token.info ? md.utils.unescapeAll(token.info).trim() : "";
  const lang = info.split(/\s+/g)[0] || "";
  const str = token.content;

  if (lang === "mermaid") {
    return `<div class="mermaid">${escapeHtml(str)}</div>\n`;
  }
  // 语言标签只显示用户**明确声明**的语言；hljs 的兜底高亮（如空 lang 回退 ini）
  // 不标注 —— 否则纯 ``` 代码块头上会莫名其妙标个 "ini"
  const userLang = hljs.getLanguage(lang) ? lang : "";
  const langName = userLang || (hljs.getLanguage("ini") ? "ini" : "");
  if (langName) {
    try {
      return (
        codeBlock(userLang, hljs.highlight(str, { language: langName, ignoreIllegals: true }).value) + "\n"
      );
    } catch {}
  }
  return codeBlock(userLang, escapeHtml(str)) + "\n";
};

/* 正文图片默认懒加载（列表页/详情页/边缘预渲染共同受益）。
   例外是正文第一张图 —— 它常常就是 LCP 元素，挂 loading="lazy" 会让浏览器
   等到布局算完才去取，实测论坛帖子详情页 LCP 被拖到 10s。由 renderMarkdown 的
   eagerFirstImage 开关控制，只有"正文"该开，评论列表不开（99 条评论各自急加载
   首图等于把懒加载废掉）。
   注意别顺手加 fetchpriority="high"：它不在 DOMPurify 默认白名单里，两条净化
   路径都会把它剥掉，白写。要加就得同时改 sanitize.server.ts 和客户端调用。 */
let eagerFirstImage = false;
let imageCount = 0;
const origImage = md.renderer.rules.image;
md.renderer.rules.image = function (tokens, idx, options, env, self) {
  const isFirst = imageCount++ === 0;
  if (!(isFirst && eagerFirstImage)) tokens[idx].attrSet('loading', 'lazy');
  tokens[idx].attrSet('decoding', 'async');
  return origImage
    ? origImage(tokens, idx, options, env, self)
    : self.renderToken(tokens, idx, options);
};

// Custom callout/admonition renderer for > [!TIP] / > [!WARNING] etc.
let calloutDepth = 0;

const origRender = md.render.bind(md) as typeof md.render;
md.render = function (...args: Parameters<typeof md.render>) {
  calloutDepth = 0;
  imageCount = 0;
  return origRender(...args);
};

const origBlockquoteOpen = md.renderer.rules.blockquote_open;
md.renderer.rules.blockquote_open = function (tokens, idx, options, env, self) {
  const next = tokens[idx + 1];
  if (next?.type === 'paragraph_open') {
    const inline = tokens[idx + 2];
    if (inline?.type === 'inline' && inline.content) {
      const m = inline.content.match(/^\[!(\w+)\]\s*/);
      if (m && CALLOUT_TYPES.includes(m[1].toUpperCase())) {
        const type = m[1].toLowerCase();
        if (inline.children?.[0]?.type === 'text') {
          inline.children[0].content = inline.children[0].content.replace(/^\[!\w+\]\s*/, '');
        }
        inline.content = inline.content.replace(/^\[!\w+\]\s*/, '');
        calloutDepth = 1;
        return `<div class="callout callout-${type}"><div class="callout-title">${CALLOUT_ICONS[type] ?? ''}${CALLOUT_TITLES[type] || m[1]}</div>`;
      }
    }
  }
  return origBlockquoteOpen
    ? origBlockquoteOpen(tokens, idx, options, env, self as any)
    : self.renderToken(tokens, idx, options);
};

const origBlockquoteClose = md.renderer.rules.blockquote_close;
md.renderer.rules.blockquote_close = function (tokens, idx, options, env, self) {
  if (calloutDepth) {
    calloutDepth = 0;
    return '</div>';
  }
  return origBlockquoteClose
    ? origBlockquoteClose(tokens, idx, options, env, self as any)
    : self.renderToken(tokens, idx, options);
};

/**
 * 渲染 Markdown 为 HTML，支持代码高亮、callout 引用块、Mermaid 流程图。
 *
 * @param opts.eagerFirstImage 正文场景传 true：首图不加 loading="lazy"，避免
 *   LCP 图片被推迟发现。评论、列表摘要等次要内容保持默认（全部懒加载）。
 *   SSR 与 CSR 两条路径必须传同一个值，否则同一篇正文两边 HTML 不一致。
 */
export function renderMarkdown(
  content: string,
  opts?: { eagerFirstImage?: boolean },
): string {
  eagerFirstImage = opts?.eagerFirstImage ?? false;
  try {
    return md.render(content);
  } finally {
    eagerFirstImage = false;
  }
}

/**
 * 给 h1-h6 添加 id 锚点（TOC 跳转用）。
 * 客户端 PostBody 与边缘预渲染 Worker 共用，保证锚点一致。
 */
export function addHeadingIds(html: string): string {
  return html.replace(
    /<(h[1-6])\b([^>]*)>(.*?)<\/\1>/gi,
    (_, tag, attrs, text) => {
      if (/id=/.test(attrs)) return `<${tag}${attrs}>${text}</${tag}>`;
      const id = text
        .replace(/<[^>]+>/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9一-鿿㐀-䶿-]/g, '')
        .replace(/^-+|-+$/g, '');
      return `<${tag}${attrs} id="${id}">${text}</${tag}>`;
    },
  );
}
