export interface ForumUser {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  gender?: 'male' | 'female' | 'other';
  age?: number;
  region?: string;
  email?: string;
  role?: string;
  createdAt?: string;
  lastSeenAt?: string | null;
  emailNotifications?: boolean;
  articleNotifications?: boolean;
  totpEnabled?: boolean;
  verified?: boolean;
  githubId?: number | null;
  githubLogin?: string | null;
  githubAvatarUrl?: string | null;
  qq?: string | null;
  hasPassword?: boolean;
}

export interface ForumCategory {
  id: string;
  name: string;
  slug?: string;
  description?: string;
}

export interface ForumPostSummary {
  id: string;
  authorId?: string;
  title: string;
  slug?: string;
  excerpt?: string;
  content?: string;
  coverImageUrl?: string;
  categoryId?: string;
  category?: ForumCategory | null;
  author?: ForumUser | null;
  viewCount?: number;
  commentCount?: number;
  likeCount?: number;
  liked?: boolean;
  isPinned?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ForumPostDetail extends ForumPostSummary {
  rendered?: { html: string };
}

export interface ForumComment {
  id: string;
  postId: string;
  parentId?: string | null;
  content: string;
  author?: ForumUser | null;
  likeCount?: number;
  liked?: boolean;
  createdAt?: string;
  updatedAt?: string;
  isPinned?: boolean;
  replies?: ForumComment[];
}

export interface ForumCommentInput {
  content: string;
  parentId?: string;
  turnstileToken?: string;
}

export interface ForumPostInput {
  title: string;
  categoryId: string;
  content: string;
}

export interface ForumConfig {
  turnstileEnabled?: boolean;
  turnstileSiteKey?: string;
  allowRegistration?: boolean;
  userCount?: number;
}

export interface AdminStats {
  users: number;
  posts: number;
  comments: number;
}

export interface ApiListResult<T> {
  data?: T[];
  items?: T[];
  posts?: T[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export type SortOption = 'latest' | 'oldest' | 'likes' | 'comments' | 'views';
export type CommentSort = 'hot' | 'latest' | 'oldest';
