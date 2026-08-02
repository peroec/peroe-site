import { marked } from "marked";
import hljs from "highlight.js/lib/common";

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

const CALLOUT_ICONS: Record<string, string> = {
  note: "ℹ️",
  info: "ℹ️",
  tip: "💡",
  important: "❗",
  warning: "⚠️",
  caution: "⚠️",
  danger: "🔥",
  success: "✅",
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
        const match = src.match(
          /^\s*(\[!([A-Z]+)\])\s*([^\n]*)(?:\n((?:\s*>.*\n?)*))?/
        );
        if (!match) return undefined;
        const type = (match[2] || "NOTE").toLowerCase();
        const title = match[3]?.trim() || CALLOUT_TYPES[type] || type;
        let body = match[4] || "";
        body = body
          .split("\n")
          .map((line) => (line.startsWith(">") ? line.replace(/^\s*>/, "") : line))
          .join("\n");
        return {
          type: "callout",
          raw: match[0],
          tokens: this.lexer.blockTokens(body.trim() || "*空*", []),
          title,
          typeName: type,
        };
      },
      renderer(token: any) {
        return `<div class="callout callout-${token.typeName}"><div class="callout-title"><span class="callout-icon">${
          CALLOUT_ICONS[token.typeName] || "ℹ️"
        }</span>${this.parser.parseInline([{ type: "text", text: token.title }] as any)}</div>${this.parser.parse(
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
      return `<h${depth} id="${id}" class="${size} font-bold text-white mt-10 mb-4 leading-snug">${text}</h${depth}>`;
    },
    code({ text, lang }: any) {
      const language = typeof lang === "string" && hljs.getLanguage(lang) ? lang : "plaintext";
      const highlighted =
        language === "plaintext"
          ? escapeHtml(text)
          : hljs.highlight(text, { language }).value;
      const langLabel = lang ? `<span class="code-lang">${escapeHtml(lang)}</span>` : "";
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
