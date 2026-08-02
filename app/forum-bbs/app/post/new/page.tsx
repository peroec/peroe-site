import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button } from '@/forum-bbs/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/forum-bbs/components/ui/dropdown-menu';
// 必须和帖子详情页用同一个懒加载壳：这里只要**静态**导入原组件，Rolldown 就会
// 把 74KB 编辑器并进公共 chunk（构建期报 INEFFECTIVE_DYNAMIC_IMPORT），
// 详情页那边的懒加载随之失效。本页 SSR 时无登录态、走的是登录提示分支，
// 编辑器不会在服务端渲染，因此这个 Suspense 边界不会出现在 SSR 输出里
import { MarkdownEditor } from '../lazy-markdown-editor';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import { createPost, getCategories, uploadFile } from '@/forum-bbs/lib/forum/api/client';
import type { ForumCategory } from '@/forum-bbs/lib/forum/types';

export default function ForumNewPostPage() {
  const navigate = useNavigate();
  const { user } = useForumAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [categories, setCategories] = useState<ForumCategory[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {
      // B-20：分类加载失败要可见，否则用户不选分类发帖必失败且原因不明
      setError('分类加载失败，请刷新页面重试');
    });
  }, []);

  if (!user) {
    return (
      <main className="container mx-auto max-w-3xl px-4 py-8 text-center">
        <h1 className="text-xl font-bold mb-4">发布新帖</h1>
        <p className="text-muted-foreground mb-4">请先登录后再发帖</p>
        <Link to="/forum/auth/login?redirect=/post/new"><Button>去登录</Button></Link>
      </main>
    );
  }

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) { setError('标题和内容不能为空'); return; }
    setSubmitting(true);
    setError('');
    try {
      const post = await createPost({ title: title.trim(), content: content.trim(), categoryId });
      navigate(`/forum/post/${post.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '发布失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageUpload = async (file: File): Promise<string> => {
    return uploadFile(file, 'post');
  };

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Link to="/forum/" className="text-sm text-muted-foreground hover:text-foreground">← 返回论坛</Link>
        <h1 className="text-xl font-bold">发布新帖</h1>
      </div>

      {error && (
        <div className="-mx-4 border-y border-red-300 bg-red-50 dark:bg-red-950/20 px-4 py-3 sm:mx-0 sm:border mb-4 text-sm text-red-600 dark:text-red-400">{error}</div>
      )}

      <div className="space-y-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (error) setError(''); }}
            placeholder="标题"
            className="flex-1 h-10 px-3 rounded-lg border bg-background text-sm"
          />
          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center justify-between gap-1 h-10 w-40 rounded-lg border border-input bg-transparent px-3 text-sm text-left">
              {categories.find((c) => c.id === categoryId)?.name || '选择分类'}
              <Icon icon="mdi:chevron-down" className="size-4 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40">
              <DropdownMenuItem onClick={() => { setCategoryId(''); if (error) setError(''); }}>选择分类</DropdownMenuItem>
              {categories.map((c) => (
                <DropdownMenuItem key={c.id} onClick={() => { setCategoryId(c.id); if (error) setError(''); }}>{c.name}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <MarkdownEditor
          value={content}
          onChange={(v) => { setContent(v); if (error) setError(''); }}
          placeholder="内容 (支持 Markdown，粘贴图片自动上传)"
          minHeight={500}
          onUpload={handleImageUpload}
        />

        <div className="flex gap-2 justify-end">
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? '发布中…' : '发布'}
          </Button>
        </div>
      </div>
    </main>
  );
}
