import { Suspense, lazy, type ComponentProps } from 'react';
import { Spinner } from '@/forum-bbs/components/ui/spinner';

/**
 * MarkdownEditor 的懒加载壳。
 *
 * 编辑器自带 DOMPurify + markdown-it 预览，打出来是 ~74KB 的独立 chunk。
 * 帖子详情页此前静态 import 它，于是**每个未登录访客**也要下这 74KB —— 而
 * 三个使用点（回复框、编辑帖子、评论框）都藏在登录态或交互状态后面，首屏一个
 * 都不渲染。Lighthouse 在 /forum/post/19 上报的 unused-javascript 有一半是它。
 *
 * SSR 安全性：论坛登录态存在 localStorage，服务端一律当未登录 —— 三个使用点
 * 在 SSR 时都不渲染，因此这个 Suspense 边界不会出现在服务端输出里，不会触发
 * AGENTS.md 里说的「流式占位把内容甩到响应末尾」那个坑。
 */
const MarkdownEditorImpl = lazy(() =>
  import('@/forum-bbs/components/markdown-editor').then((m) => ({ default: m.MarkdownEditor })),
);

export function MarkdownEditor(props: ComponentProps<typeof MarkdownEditorImpl>) {
  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center border border-input bg-background text-muted-foreground"
          style={{ minHeight: props.minHeight ?? 400 }}
        >
          <Spinner />
        </div>
      }
    >
      <MarkdownEditorImpl {...props} />
    </Suspense>
  );
}
