/**
 * 论坛评论的 snake_case → camelCase 映射与树构建（纯函数，无浏览器/Node 依赖）。
 * 与 map-post.ts 同理：客户端 API client 和服务端 loader 共用这一份。
 */
import type { ForumComment } from '../types';

export interface RawComment {
  id: number;
  post_id?: number;
  author_id?: number;
  parent_id?: number | null;
  content?: string;
  username?: string;
  avatar_url?: string;
  role?: string;
  like_count?: number;
  liked?: boolean;
  created_at?: string;
  updated_at?: string;
  is_pinned?: number;
}

export function mapComment(raw: RawComment): ForumComment {
  return {
    id: String(raw.id),
    postId: String(raw.post_id ?? ''),
    parentId: raw.parent_id ? String(raw.parent_id) : null,
    content: raw.content ?? '',
    author: raw.username ? {
      id: String(raw.author_id ?? ''),
      username: raw.username,
      avatarUrl: raw.avatar_url,
      role: raw.role,
    } : undefined,
    likeCount: raw.like_count ?? 0,
    liked: raw.liked,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    isPinned: raw.is_pinned === 1,
    replies: [],
  };
}

/** 扁平评论列表 → 树（根 = 无 parentId） */
export function buildCommentTree(flat: ForumComment[]): ForumComment[] {
  const map = new Map<string, ForumComment>();
  for (const c of flat) map.set(c.id, { ...c, replies: [] });
  const roots: ForumComment[] = [];
  for (const c of map.values()) {
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies!.push(c);
    } else {
      roots.push(c);
    }
  }
  return roots;
}

/** 前端 sort 值 → 后端 API 的 sort_by + sort_dir */
/**
 * 评论排序：URL 上的 `?csort=` 是唯一真相 —— 服务端 loader 和客户端组件读同一个值，
 * 于是三个筛选按钮可以写成真链接，禁用 JS 也能换排序。
 */
export type CommentSort = 'hot' | 'latest' | 'oldest';
export const DEFAULT_COMMENT_SORT: CommentSort = 'hot';

export function parseCommentSort(raw: string | null | undefined): CommentSort {
  return raw === 'latest' || raw === 'oldest' || raw === 'hot' ? raw : DEFAULT_COMMENT_SORT;
}

export function getCommentSortParams(sort: string): { sortBy: string; sortDir: string } {
  switch (sort) {
    case 'oldest':
      return { sortBy: 'time', sortDir: 'asc' };
    case 'latest':
      return { sortBy: 'time', sortDir: 'desc' };
    case 'hot':
    default:
      return { sortBy: 'likes', sortDir: 'desc' };
  }
}
