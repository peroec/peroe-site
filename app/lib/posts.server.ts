/**
 * 博客内容读取 —— 数据源 app/lib/generated-posts.ts（构建时由
 * scripts/generate-posts.mjs 从 content/*.mdx 生成，PagesCMS 管理）。
 * 双平台（CF/EdgeOne）通用：无本地文件系统依赖，运行时直接读内存数据。
 */
import { generatedPosts } from "~/lib/generated-posts";
import type { BlogPost, BlogPostListItem } from "~/lib/types";

/** 列表（非草稿，置顶 + 日期倒序） */
export function getPosts(): BlogPostListItem[] {
  return generatedPosts
    .map(({ content: _c, ...rest }) => ({ ...rest, views: 0 }))
    .sort((a, b) => {
      if (a.pin !== b.pin) return b.pin - a.pin;
      return b.date.localeCompare(a.date);
    });
}

/** 单篇（含正文 markdown） */
export function getPostBySlug(slug: string): BlogPost | null {
  const post = generatedPosts.find((p) => p.slug === slug);
  if (!post) return null;
  const { content, ...meta } = post;
  return { ...meta, views: 0, content };
}

/** 搜索 */
export function searchPosts(q: string): BlogPostListItem[] {
  const needle = q.toLowerCase();
  return getPosts().filter(
    (p) =>
      p.title.toLowerCase().includes(needle) ||
      (p.description || "").toLowerCase().includes(needle)
  );
}
