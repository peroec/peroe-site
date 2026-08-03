import { marked } from "marked";
import hljs from "highlight.js/lib/common";
import { langIconSvg } from "~/lib/code-icons";
// common 集合未覆盖的博客常用语言：powershell/nginx/http（补注册后才有高亮）
import powershell from "highlight.js/lib/languages/powershell";
import nginx from "highlight.js/lib/languages/nginx";
import http from "highlight.js/lib/languages/http";

for (const [name, lang] of Object.entries({ powershell, nginx, http })) {
  hljs.registerLanguage(name, lang);
}

/**
 * 博客 Markdown 渲染（对齐 2x.nz 线上格式）：
 * - callout 提示框：> [!CAUTION] 标题
 * - 代码块：.code-block（语言标签 + 复制按钮），pre 背景 #1e1e2e
 * - 标题自动锚点 id（中文保留）
 * - 表格、图片 lightbox、懒加载
 */

const CALLOUT_TYPES: Record<string, string> = {
  NOTE: "note",
  TIP: "tip",
  IMPORTANT: "important",
  WARNING: "warning",
  CAUTION: "caution",
  INFO: "info",
  DANGER: "danger",
  SUCCESS: "success",
};

/** 类型 → 中文标题（对齐本地博客 ALERT_STYLES） */
const CALLOUT_TITLES: Record<string, string> = {
  note: "注意",
  tip: "提示",
  important: "重要",
  warning: "警告",
  caution: "小心",
  info: "说明",
  danger: "小心",
  success: "成功",
};

const CALLOUT_ICONS: Record<string, string> = {
  note: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="m18.13 12 1.26-1.26c.44-.44 1-.68 1.61-.74V9l-6-6H5c-1.11 0-2 .89-2 2v14a2 2 0 0 0 2 2h6v-1.87l.13-.13H5V5h7v7zM14 4.5l5.5 5.5H14zm5.13 9.33 2.04 2.04L15.04 22H13v-2.04zm3.72.36-.98.98-2.04-2.04.98-.98c.2-.2.52-.2.72 0l1.32 1.32c.2.2.2.53 0 .72z"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M11 9h2V7h-2m1 13c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8m0-18A10 10 0 0 0 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m-1 15h2v-6h-2z"/></svg>',
  tip: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M20 11h3v2h-3zM1 11h3v2H1zM13 1v3h-2V1zM4.92 3.5l2.13 2.14-1.42 1.41L3.5 4.93zm12.03 2.13 2.12-2.13 1.43 1.43-2.13 2.12zM12 6a6 6 0 0 1 6 6c0 2.22-1.21 4.16-3 5.2V19a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1.8c-1.79-1.04-3-2.98-3-5.2a6 6 0 0 1 6-6m2 15v1a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-1z"/></svg>',
  important: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M11 15h2v2h-2zm0-8h2v6h-2zm1-5C6.47 2 2 6.5 2 12a10 10 0 0 0 10 10 10 10 0 0 0 10-10A10 10 0 0 0 12 2m0 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16z"/></svg>',
  warning: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M12 2 1 21h22M12 6l7.53 13H4.47M11 10v4h2v-4m-2 6v2h2v-2z"/></svg>',
  caution: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M7 2h10l-3.5 7H17l-7 13v-8H7zm2 2v8h3v2.66L14 11h-3.76l3.52-7z"/></svg>',
  danger: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="M8.27 3 3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3M9.1 5h5.8L19 9.1v5.8L14.9 19H9.1L5 14.9V9.1m4.12-1.39L7.71 9.12 10.59 12l-2.88 2.88 1.41 1.41L12 13.41l2.88 2.88 1.41-1.41L13.41 12l2.88-2.88-1.41-1.41L12 10.59z"/></svg>',
  success: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="callout-svg" aria-hidden="true"><path fill="currentColor" d="m9 16.17-3.88-3.88-1.41 1.42L9 19 21 7l-1.41-1.41z"/></svg>',
};

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u3000]/g, " ")
    .replace(/[，。；：？！、“”‘’（）《》〈〉【】]/g, "")
    .replace(/[^\w\s\u4e00-\u9fff-]/g, "")
    .replace(/\s+/g, "-");
}

export function renderMarkdown(content: string): string {
  return marked.parse(content, {
    async: false,
    gfm: true,
  }) as string;
}

// 注册扩展：callout + 自定义渲染器
const ext = marked.use({
  extensions: [
    {
      name: "callout",
      level: "block",
      start(src: string) {
        const m = src.match(/^\s*>?\s*\[!([A-Z]+)\]/);
        return m ? m.index! : -1;
      },
      tokenizer(src: string) {
        // 支持两种写法（对齐本地博客 remark-github-alerts）：
        //   1) > [!CAUTION] 直接跟正文 → 标题用类型中文名，正文是标记后文本
        //   2) > [!CAUTION] 独占一行，正文在后续行
        // 正文行：以 > 开头；遇空行或下一个 [! 标记停止（避免吞掉后续 callout）
        const match = src.match(
          /^\s*>?\s*(\[!([A-Z]+)\])([ \t]*)([^\n]*)(?:\n((?:\s*> *(?:[^\n]*))*(?:\n|$)))?/
        );
        if (!match) return undefined;
        const type = (match[2] || "NOTE").toLowerCase();
        const inlineRest = match[4]?.trim() || "";
        const title = CALLOUT_TITLES[type] || type;
        let body = match[5] || "";
        // 停止条件：下一行是 [! 开头（新 callout）→ 截断；body 不包含后续 callout
        const nextCallout = body.match(/\n\s*>?\s*\[!/);
        if (nextCallout) body = body.slice(0, nextCallout.index);
        body = body
          .split("\n")
          .map((line) => (line.startsWith(">") ? line.replace(/^\s*>/, "") : line))
          .join("\n");
        // 标记后直接跟正文（如 "> [!CAUTION] 本文使用 DeepSeek..."）：正文从标记后开始
        if (inlineRest) {
          body = (inlineRest + "\n" + body).trim();
        }
        return {
          type: "callout",
          raw: match[0],
          tokens: this.lexer.blockTokens(body.trim() || "*空*", []),
          title,
          typeName: type,
        };
      },
      renderer(token: any) {
        return `<div class="callout callout-${token.typeName}"><div class="callout-title">${
          CALLOUT_ICONS[token.typeName] || CALLOUT_ICONS.info
        }${this.parser.parseInline([{ type: "text", text: token.title }] as any)}</div>${this.parser.parse(
          token.tokens as any
        )}</div>`;
      },
    },
  ],
  renderer: {
    heading({ tokens, depth, text }: any) {
      const raw = tokens.map((t: any) => t.text || "").join("");
      const id = slugify(raw);
      const size = depth === 1 ? "text-3xl" : depth === 2 ? "text-2xl" : "text-xl";
      // 用 tokens 重新渲染而非直接用 text：反引号代码（如 `<noscript>`）内的
      // 尖括号必须转义为实体，直接拼接 text 会把裸 HTML 标签打进标题（ISSUES #119）
      const safeText = this.parser.parseInline(tokens as any);
      return `<h${depth} id="${id}" class="${size} font-bold text-white mt-10 mb-4 leading-snug">${safeText}</h${depth}>`;
    },
    code({ text, lang }: any) {
      // mermaid 流程图：输出占位 div，由客户端 MermaidContent 懒加载渲染（与论坛一致）
      if (lang === "mermaid") {
        return `<div class="mermaid">${escapeHtml(text)}</div>\n`;
      }
      const language = typeof lang === "string" && hljs.getLanguage(lang) ? lang : "plaintext";
      let highlighted: string;
      if (language === "plaintext") {
        highlighted = escapeHtml(text);
      } else {
        try {
          // ignoreIllegals：代码含非法 token 时高亮不抛异常（对齐论坛版行为）
          highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value;
        } catch {
          highlighted = escapeHtml(text);
        }
      }
      const langLabel = lang
        ? `<span class="code-lang">${langIconSvg(lang, "code-icon")}<span class="code-lang-name">${escapeHtml(lang)}</span></span>`
        : "";
      return `<div class="code-block"><div class="code-head">${langLabel}<button type="button" class="code-copy" title="复制代码"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="code-icon code-icon-copy" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="code-icon code-icon-copied" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6 9 17l-5-5"/></svg><span class="code-copy-label">copy</span></button></div><pre><code class="language-${language} hljs">${highlighted}</code></pre></div>`;
    },
    image({ href, title, text }: any) {
      // 属性值必须转义：恶意图片语法（![x" onerror="...](y)）可做属性注入 XSS
      const safeHref = escapeHtml(href || "");
      const safeAlt = escapeHtml(text || "");
      const safeTitle = escapeHtml(title || "");
      return `<img src="${safeHref}" alt="${safeAlt}" title="${safeTitle}" loading="lazy" data-lightbox="true" class="prose-img" />`;
    },
    // MDX 里的裸 HTML（<Link>、<Form> 等代码示例）转义为文本显示，
    // 避免被浏览器当真实标签解析；行内代码/代码围栏不受影响
    html({ text }: any) {
      return escapeHtml(text);
    },
  },
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export default ext;
