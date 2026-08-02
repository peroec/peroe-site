'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { track } from '@/forum-bbs/lib/track';

/**
 * 代码块复制按钮的全局点击委托。
 * 按钮本体由 renderMarkdown 注入（.code-copy），此处只挂一个 document 级监听，
 * 对动态渲染/边缘预渲染的内容一律生效，无需每个页面自己接线。
 */
export function CodeCopyListener() {
  useEffect(() => {
    const onClick = async (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest?.('.code-copy');
      if (!(btn instanceof HTMLElement)) return;
      // 按 .code-block 容器取，不要按 btn.parentElement 取：按钮在头部那一行里，
      // code 埋在同级 pre 下面（见 render-markdown.ts），
      // 结构再变一次时 closest 也不会跟着失灵
      const code =
        btn.closest('.code-block')?.querySelector('pre code')?.textContent ?? '';
      try {
        await navigator.clipboard.writeText(code);
        // 只改标签文字 + 切一个 class（图标由 CSS 换）。
        // **不要**写回 btn.textContent —— 按钮里还有两个 svg，那样会把图标一起冲掉
        const label = btn.querySelector('.code-copy-label');
        btn.classList.add('is-copied');
        if (label) label.textContent = 'copied';
        setTimeout(() => {
          btn.classList.remove('is-copied');
          if (label) label.textContent = 'copy';
        }, 1500);
        // 只上报语言和所在页，不带代码内容。语言取头部那个标签的文字
        //（render-markdown 的 langLabel 渲染的 .code-lang-name），没有就算 text
        track('复制代码', {
          语言:
            btn
              .closest('.code-block')
              ?.querySelector('.code-lang-name')
              ?.textContent?.trim() || 'text',
          所在页: location.pathname,
        });
      } catch {
        toast.error('复制失败');
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  return null;
}
