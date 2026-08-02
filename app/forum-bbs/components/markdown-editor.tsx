'use client';

import { useRef, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { cn } from '@/forum-bbs/lib/utils';
import DOMPurify from 'dompurify';
import { renderMarkdown } from '@/forum-bbs/lib/render-markdown';

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minHeight?: number;
  onUpload?: (file: File) => Promise<string>;
}

export function MarkdownEditor({ value, onChange, placeholder, minHeight = 400, onUpload }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');

  const html = DOMPurify.sanitize(renderMarkdown(value || ''));

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const file = e.clipboardData.files[0];
    if (!file || !file.type.startsWith('image/') || !onUpload) return;
    e.preventDefault();
    setUploading(true);
    try {
      const url = await onUpload(file);
      setUploading(false);
      const imgTag = `![${file.name}](${url})`;
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const newVal = before + imgTag + after;
      onChange(newVal);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + imgTag.length;
      });
    } catch (e) {
      setUploading(false);
      toast.error('图片上传失败', { description: e instanceof Error ? e.message : '未知错误' });
    }
  }, [value, onChange, onUpload]);

  const handleImagePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/') || !onUpload) return;
    setUploading(true);
    try {
      const url = await onUpload(file);
      setUploading(false);
      const imgTag = `![${file.name}](${url})`;
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = value.slice(0, start);
      const after = value.slice(end);
      const newVal = before + imgTag + after;
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.focus();
        ta.selectionStart = ta.selectionEnd = start + imgTag.length;
      });
    } catch (e) {
      setUploading(false);
      toast.error('图片上传失败', { description: e instanceof Error ? e.message : '未知错误' });
    }
  }, [value, onChange, onUpload]);

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Markdown toolbar */}
      <div className="flex flex-wrap items-center gap-1 px-3 py-1.5 border-b bg-muted/30 text-xs text-muted-foreground">
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background font-bold" onClick={() => wrap('**', '**')} title="加粗">B</button>
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background italic" onClick={() => wrap('*', '*')} title="斜体">I</button>
        <span className="shrink-0 w-px h-4 bg-border mx-1" />
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background font-mono" onClick={() => wrap('`', '`')} title="行内代码">`</button>
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background font-mono text-[10px]" onClick={() => wrap('```\n', '\n```')} title="代码块">code</button>
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background" onClick={() => wrap('[', '](url)')} title="链接"><Icon icon="mdi:link-variant" className="size-3.5" /></button>
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background" onClick={() => wrap('- ', '')} title="无序列表"><Icon icon="mdi:format-list-bulleted" className="size-3.5" /></button>
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background" onClick={() => wrap('1. ', '')} title="有序列表"><Icon icon="mdi:format-list-numbered" className="size-3.5" /></button>
        <button type="button" className="shrink-0 px-2 py-1 rounded hover:bg-foreground hover:text-background" onClick={() => fileInputRef.current?.click()} title="插入图片"><Icon icon="mdi:image-plus" className="size-3.5" /></button>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImagePick} />
        {uploading && <span className="shrink-0 text-xs text-primary animate-pulse">上传中…</span>}
        {/* 提示文字：whitespace-nowrap 防止被挤窄后中文竖排把工具栏撑高；窄屏隐藏（无横向空间时不显示，改由粘贴/点击交互兜底） */}
        <span className="ml-auto hidden sm:inline-flex items-center gap-1 whitespace-nowrap shrink-0 text-muted-foreground/50"><Icon icon="mdi:image-plus" className="size-3.5" />粘贴或点击上传图片</span>
      </div>

      {/* Mobile tab bar - hidden on md+ */}
      <div className="flex md:hidden border-b border-border">
        <button
          type="button"
          className={cn(
            'flex-1 px-3 py-2 text-xs font-mono transition-colors',
            activeTab === 'write'
              ? 'bg-background text-foreground border-b-2 border-foreground'
              : 'bg-muted/30 text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setActiveTab('write')}
        >
          撰写
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 px-3 py-2 text-xs font-mono transition-colors',
            activeTab === 'preview'
              ? 'bg-background text-foreground border-b-2 border-foreground'
              : 'bg-muted/30 text-muted-foreground hover:text-foreground',
          )}
          onClick={() => setActiveTab('preview')}
        >
          预览
        </button>
      </div>

      {/* Split pane */}
      <div className="flex flex-col md:flex-row">
        {/* Editor - hidden on mobile when preview tab is active */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={handlePaste}
          placeholder={placeholder}
          className={cn(
            'min-w-0 resize-none border-0 bg-background p-4 text-sm font-mono leading-relaxed focus:outline-none',
            activeTab === 'write' ? 'flex flex-1' : 'hidden',
            'md:flex md:flex-1 md:border-r',
          )}
          style={{ minHeight: `${minHeight}px`, height: `${minHeight}px` }}
        />

        {/* Preview - hidden on mobile when write tab is active */}
        <div className={cn(
          'min-w-0 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#3b4048_transparent]',
          activeTab === 'preview' ? 'block flex-1' : 'hidden',
          'md:block md:flex-1',
        )} style={{ maxHeight: `${minHeight}px` }}>
          {value ? (
            <div
              className="prose prose-zinc dark:prose-invert max-w-none p-4 text-sm prose-img:rounded-lg prose-a:text-primary prose-code:before:content-none prose-code:after:content-none"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm p-4">
              实时预览
            </div>
          )}
        </div>
      </div>
    </div>
  );

  function wrap(before: string, after: string) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.slice(start, end);
    const newVal = value.slice(0, start) + before + selected + after + value.slice(end);
    onChange(newVal);
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = start + before.length;
      ta.selectionEnd = start + before.length + selected.length;
    });
  }
}
