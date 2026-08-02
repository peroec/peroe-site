/**
 * 论坛帖子的 snake_case → camelCase 映射（纯函数，无浏览器/Node 依赖）。
 *
 * 客户端 API client 和服务端 loader（app/routes/forum_.server.ts）共用这一份，
 * 保证 SSR 首屏和客户端交互后重新拉取的数据形状完全一致——两边各写一份映射
 * 会让封面图/置顶/分类等字段在水合前后不一致。
 */
import type { ForumPostSummary } from '../types';

export interface RawPost {
  id: number;
  author_id?: number;
  title: string;
  content?: string;
  excerpt?: string;
  cover_image_url?: string;
  created_at?: string;
  updated_at?: string;
  is_pinned?: number;
  category_id?: number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  liked?: boolean;
  author_name?: string;
  author_avatar?: string;
  author_role?: string;
  category_name?: string;
  rendered?: { html: string };
}

export function extractFirstImageUrl(markdownText?: string): string | undefined {
  if (!markdownText) return undefined;
  // ![alt](url)
  const m = markdownText.match(/!\[[^\]]*\]\((\S+?)(?:\s+["'][^"']*["'])?\)/);
  if (m) return m[1];
  // <img src="url">
  const html = markdownText.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (html) return html[1];
  return undefined;
}

export function mapPost(raw: RawPost): ForumPostSummary {
  const coverImageUrl = raw.cover_image_url
    || extractFirstImageUrl(raw.content)
    || extractFirstImageUrl(raw.excerpt);
  return {
    id: String(raw.id),
    authorId: String(raw.author_id ?? ''),
    title: raw.title,
    content: raw.content,
    excerpt: raw.excerpt,
    coverImageUrl,
    viewCount: raw.view_count ?? 0,
    commentCount: raw.comment_count ?? 0,
    likeCount: raw.like_count ?? 0,
    liked: raw.liked,
    isPinned: raw.is_pinned === 1,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    categoryId: String(raw.category_id ?? ''),
    category: raw.category_name ? { id: String(raw.category_id ?? ''), name: raw.category_name } : undefined,
    author: raw.author_name ? {
      id: String(raw.author_id ?? ''),
      username: raw.author_name,
      avatarUrl: raw.author_avatar,
      role: raw.author_role,
    } : undefined,
  };
}
