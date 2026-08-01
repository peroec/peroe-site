/** 论坛帖子（snake_case，与后端契约一致） */
export interface RawPost {
  id: number;
  author_id: number;
  title: string;
  content: string;
  excerpt: string | null;
  cover_image_url: string | null;
  created_at: string;
  updated_at: string | null;
  is_pinned: number;
  category_id: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  liked: boolean;
  author_name: string;
  author_avatar: string | null;
  author_role: string;
  category_name: string | null;
}

export interface RawComment {
  id: number;
  post_id: number;
  author_id: number;
  parent_id: number | null;
  content: string;
  username: string;
  avatar_url: string | null;
  role: string;
  like_count: number;
  liked: boolean;
  created_at: string;
  updated_at: string | null;
  is_pinned: number;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

export interface BlogPostListItem {
  slug: string;
  title: string;
  description: string;
  coverImage: string;
  tags: string[];
  pin: number;
  views: number;
  date: string;
}

export interface BlogPost extends BlogPostListItem {
  content: string;
}

export interface Friend {
  name: string;
  avatar?: string;
  description?: string;
  url: string;
  vip?: boolean;
}

export interface Sponsor {
  name: string;
  avatar?: string;
  amount: string;
  date: string;
}

export interface AnimeItem {
  title: string;
  cover?: string;
  desc?: string;
  url?: string;
}
