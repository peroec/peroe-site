import type { Route } from "./+types/posts.rss[.]xml";
import { blogGet } from "~/lib/api.server";
import type { BlogPostListItem } from "~/lib/types";

function escapeXml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function loader({ request }: Route.LoaderArgs) {
  const origin = new URL(request.url).origin;
  const posts = await blogGet<BlogPostListItem[]>("/api/blog/posts");

  const items = posts
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${origin}/posts/${p.slug}</link>
      <guid>${origin}/posts/${p.slug}</guid>
      <description>${escapeXml(p.description || "")}</description>
      <pubDate>${new Date(p.date.replace(" ", "T")).toUTCString()}</pubDate>
    </item>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>二叉树树的博客</title>
    <link>${origin}/posts</link>
    <description>技术博客 · 社区论坛 · 实用在线工具集</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
