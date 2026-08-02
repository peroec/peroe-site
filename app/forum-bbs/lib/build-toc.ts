/**
 * 从服务端渲染好的 HTML 中提取 h2/h3 标题，生成目录数据。
 * 博客和论坛共用。
 */
export interface TocItem {
  id: string;
  text: string;
  level: number;
}

export function buildToc(html: string): TocItem[] {
  const headings = html.match(/<h([23])\s[^>]*?id="([^"]+)"[^>]*>(.+?)<\/h[23]>/g);
  if (!headings) return [];
  return headings.map((h) => {
    const m = h.match(/^<h([23])\s[^>]*?id="([^"]+)"[^>]*>(.+?)<\/h[23]>$/)!;
    // 去掉行内 HTML 标签（如 <code>）并解码常见实体，得到纯文本目录项
    const text = m[3]
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"');
    return { level: parseInt(m[1]), id: m[2], text };
  });
}
