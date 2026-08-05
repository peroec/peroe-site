import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ClipboardCopy, Check, FileJson, Upload, Sparkles } from 'lucide-react';
import { createNovel, getAiPrompt } from '@/lib/webnovel/api';
import { normalizeSource, type NovelSource } from '@/lib/webnovel/schema';

/** 从模型输出里抠出 JSON：去掉 markdown 代码块与客套话，取第一个 { 到最后一个 } */
function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) throw new Error('没有找到 JSON 内容');
  return body.slice(start, end + 1);
}

interface ParsedResult {
  title: string;
  description: string;
  tags: string[];
  content: NovelSource;
}

function parseNovel(raw: string): ParsedResult {
  const json = extractJson(raw);
  let data: Record<string, any>;
  try {
    data = JSON.parse(json);
  } catch {
    throw new Error('JSON 解析失败，请检查模型输出是否完整');
  }
  // 兼容：content 缺失时顶层直接就是 source
  const content = normalizeSource(data.content || data);
  if (content.pages.length === 0) throw new Error('作品内容为空（没有页面）');
  return {
    title: String(data.title || '未命名'),
    description: String(data.description || ''),
    tags: Array.isArray(data.tags) ? data.tags.map(String).filter(Boolean).slice(0, 8) : [],
    content,
  };
}

export function NovelFormat() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [createdSlug, setCreatedSlug] = useState('');

  useEffect(() => {
    getAiPrompt().then((data) => setPrompt(data.prompt)).catch(() => {});
  }, []);

  const pageCount = parsed?.content.pages.length ?? 0;
  const optionCount = useMemo(() => {
    if (!parsed) return 0;
    return parsed.content.pages.reduce((n, page) => n + page.actions.filter((a) => a.type === 'choice').reduce((m, a) => m + (a.options?.length ?? 0), 0), 0);
  }, [parsed]);

  const handleParse = () => {
    setError(''); setParsed(null);
    try {
      setParsed(parseNovel(input));
    } catch (e) {
      setError(e instanceof Error ? e.message : '解析失败');
    }
  };

  const handleFile = async (file: File) => {
    setError(''); setParsed(null);
    try {
      setInput(await file.text());
      setParsed(parseNovel(await file.text()));
    } catch (e) {
      setError(e instanceof Error ? e.message : '文件读取失败');
    }
  };

  const create = async () => {
    if (!parsed) return;
    setCreating(true); setError('');
    try {
      const novel = await createNovel({
        title: parsed.title,
        description: parsed.description,
        tags: parsed.tags,
        content: parsed.content,
      });
      setCreatedSlug(novel.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally { setCreating(false); }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <Link to="/webnovel/editor" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">← 返回创作</Link>
        <h1 className="text-xl font-bold">去格式与提示词页</h1>
        <p className="mt-1 text-sm text-muted-foreground">复制提示词，喂给任意大模型，再把它输出的 JSON 贴到这里 —— 不消耗创作点。允许带 markdown 代码块和模型的客套话，会自动抠出 JSON。</p>
      </header>

      {error && <p className="mb-4 border-y border-destructive py-2 text-sm text-destructive">{error}</p>}

      {/* 提示词 */}
      <section className="mb-6 border-y border-border py-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-base font-semibold"><Sparkles className="size-4" /> 提示词模板</h2>
          <button type="button" className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs hover:border-foreground" onClick={copyPrompt}>
            {copied ? <Check className="size-3.5" /> : <ClipboardCopy className="size-3.5" />}{copied ? '已复制' : '复制提示词'}
          </button>
        </div>
        {prompt ? (
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words border border-border bg-muted p-3 text-xs leading-relaxed">{prompt}</pre>
        ) : (
          <p className="text-sm text-muted-foreground">提示词加载中…</p>
        )}
      </section>

      {/* 粘贴 / 文件导入 */}
      <section className="border-y border-border py-5">
        <h2 className="mb-2 text-base font-semibold">粘贴模型输出</h2>
        <textarea
          className="w-full border border-border bg-background px-2 py-1.5 text-sm"
          rows={8}
          placeholder="把大模型的输出贴到这里（带 markdown 代码块、客套话都可以）…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className="inline-flex items-center gap-1.5 border border-foreground bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40" onClick={handleParse} disabled={!input.trim()}>
            <FileJson className="size-4" /> 解析 JSON
          </button>
          <label className="inline-flex cursor-pointer items-center gap-1.5 border border-border px-3 py-2 text-sm hover:border-foreground">
            <Upload className="size-4" /> 选择 .json 文件
            <input type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
          </label>
        </div>

        {parsed && (
          <div className="mt-4 border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">《{parsed.title}》</p>
                <p className="text-xs text-muted-foreground">{parsed.description || '（无简介）'}{parsed.tags.length > 0 && ` · ${parsed.tags.join(' / ')}`}</p>
                <p className="mt-1 text-xs text-muted-foreground">{pageCount} 页 · {optionCount} 个分支选项 · {parsed.content.variables.length} 个变量</p>
              </div>
              <button type="button" className="border border-foreground bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-40" onClick={create} disabled={creating}>
                {creating ? '创建中…' : '存为草稿'}
              </button>
            </div>
            {createdSlug && (
              <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
                已创建草稿。
                <Link to={`/webnovel/editor?slug=${createdSlug}`} className="ml-1 text-primary underline">进入编辑器 →</Link>
                <Link to={`/webnovel/play/${createdSlug}`} target="_blank" rel="noreferrer" className="ml-2 text-primary underline">预览 →</Link>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
