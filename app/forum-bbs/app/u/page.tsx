import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Skeleton } from '@/forum-bbs/components/ui/skeleton';
import { RoleBadge } from '@/forum-bbs/components/forum-role-badge';
import { getUserProfile, getUserPosts } from '@/forum-bbs/lib/forum/api/client';
import type { ForumPostSummary, ForumUser } from '@/forum-bbs/lib/forum/types';

function UserProfile() {
  const { id } = useParams();
  const [user, setUser] = useState<ForumUser | null>(null);
  const [posts, setPosts] = useState<ForumPostSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getUserProfile(id), getUserPosts(id)])
      .then(([u, p]) => {
        if (cancelled) return;
        setUser(u);
        setPosts(p);
      })
      .catch(() => {
        if (!cancelled) setError('用户不存在或加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8 space-y-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-40" />
      </main>
    );
  }

  if (error || !user) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-12 text-center">
        <h1 className="text-xl font-bold mb-3">用户不存在</h1>
        <p className="text-sm text-muted-foreground mb-4">{error}</p>
        <Link to="/forum/" className="text-primary hover:underline">返回论坛</Link>
      </main>
    );
  }

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Link to="/forum/" className="inline-flex items-center gap-2 text-2xl font-bold leading-none mb-6">
        <Icon icon="mdi:arrow-left" className="size-6" />
        用户主页
      </Link>

      <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 flex items-center gap-4">
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover shrink-0" />
        ) : (
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center shrink-0">
            <Icon icon="mdi:account" className="size-8 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold truncate">{user.username}</h1>
            <RoleBadge role={user.role} />
            {user.verified && <span className="text-xs text-green-600">邮箱已验证</span>}
          </div>
          {user.bio && <p className="text-sm text-muted-foreground mt-0.5">{user.bio}</p>}
          <p className="text-xs text-muted-foreground mt-1">
            {[user.region, user.gender === 'male' ? '男' : user.gender === 'female' ? '女' : null]
              .filter(Boolean)
              .join(' · ') || ' '}
            {user.createdAt ? ` · ${String(user.createdAt).slice(0, 10)} 加入` : ''}
          </p>
        </div>
      </div>

      <h2 className="font-semibold mb-3">发布的帖子（{posts.length}）</h2>
      {posts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">暂无帖子</p>
      ) : (
        <div className="space-y-2">
          {posts.map((p) => (
            <Link
              key={p.id}
              to={`/forum/post/${p.id}`}
              className="block border-y border-border py-3 sm:border sm:p-3 hover:bg-card transition-colors"
            >
              <p className="text-sm font-medium truncate">{p.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {p.createdAt ? String(p.createdAt).slice(0, 10) : ''}
                {' · '}
                <Icon icon="mdi:comment-outline" className="size-3 inline" /> {p.commentCount ?? 0}
                {' · '}
                <Icon icon="mdi:heart-outline" className="size-3 inline" /> {p.likeCount ?? 0}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

/** 不包 Suspense：流式 SSR 会把边界内容甩进 `<div hidden>`，禁用 JS 即空白 */
export default function ForumUserPage() {
  return <UserProfile />;
}
