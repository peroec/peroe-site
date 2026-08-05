import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import {
  createNovel, getAiStatus, getNovel, getWallet, syncWallet, getMails, claimMail, createWalletOrder,
  aiGenerate, aiRefine, waitAiJob, getAiJobs, getMyNovels, updateNovel, publishNovel, deleteNovel, uploadNovelImage,
} from '@/lib/webnovel/api';
import type { Novel, WalletInfo, WalletMail, AiJob } from '@/lib/webnovel/api';
import type { NovelAction, NovelCondition, NovelOption, NovelPage, NovelSource, NovelVariable } from '@/lib/webnovel/schema';
import { createAction } from '@/lib/webnovel/engine';
import { Sparkles, Wrench, Check, Pencil, Copy, X, Plus, ChevronUp, ChevronDown, Download } from 'lucide-react';
import { auditNovelSource, createStarterSource, normalizeImportedNovel, normalizeSource } from '@/lib/webnovel/schema';

const ACTION_LABELS: Record<NovelAction['type'], string> = {
  image: '图片', say: '文字', timer: '计时', choice: '分支', goto: '跳转', set: '设置变量', end: '结束',
};
const ACTION_TYPES: NovelAction['type'][] = ['image', 'say', 'timer', 'choice', 'goto', 'set', 'end'];

const AI_PROMPT_EXAMPLES = [
  '一个雨夜的废弃医院探险故事，要有手电筒电量的设定，电量耗尽会触发坏结局',
  '赛博朋克风格：玩家是黑客，要在警察追踪到之前完成入侵，有倒计时压力',
  '古宅悬疑：找到三把钥匙才能打开最终的门，每把钥匙藏在不同分支里',
];

const STATUS_META: Record<string, { label: string; cls: string }> = {
  draft: { label: '草稿', cls: 'bg-secondary text-secondary-foreground' },
  published: { label: '已发布', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  takedown: { label: '已下架', cls: 'bg-destructive/10 text-destructive' },
};

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }

function conditionToBuilder(condition: NovelCondition | undefined): { combine: 'and' | 'or'; clauses: Array<{ kind: 'visited' | 'var'; page?: string; variable?: string; compare?: NovelCondition['compare']; value?: boolean | number | string }> } {
  if (!condition) return { combine: 'and', clauses: [] };
  if (condition.op === 'and' || condition.op === 'or') {
    return {
      combine: condition.op,
      clauses: (condition.items || []).map((item) => item.op === 'visited'
        ? { kind: 'visited', page: item.page }
        : { kind: 'var', variable: item.variable, compare: item.compare || '==', value: item.value }),
    };
  }
  return condition.op === 'visited'
    ? { combine: 'and', clauses: [{ kind: 'visited', page: condition.page }] }
    : condition.op === 'var'
      ? { combine: 'and', clauses: [{ kind: 'var', variable: condition.variable, compare: condition.compare || '==', value: condition.value }] }
      : { combine: 'and', clauses: [] };
}

function builderToCondition(builder: ReturnType<typeof conditionToBuilder>): NovelCondition | undefined {
  if (!builder.clauses.length) return undefined;
  const items = builder.clauses.map((clause) => clause.kind === 'visited'
    ? { op: 'visited' as const, page: clause.page }
    : { op: 'var' as const, variable: clause.variable, compare: clause.compare || '==', value: clause.value });
  return items.length === 1 ? items[0] : { op: builder.combine, items };
}

function defaultValue(variable: NovelVariable | undefined): boolean | number | string {
  if (variable?.type === 'bool') return false;
  if (variable?.type === 'number') return 0;
  return '';
}

function ConditionEditor({ value, pages, variables, label, onChange }: { value?: NovelCondition; pages: NovelPage[]; variables: NovelVariable[]; label: string; onChange: (value: NovelCondition | undefined) => void }) {
  const [builder, setBuilder] = useState(() => conditionToBuilder(value));
  useEffect(() => setBuilder(conditionToBuilder(value)), [value]);
  const patch = (next: ReturnType<typeof conditionToBuilder>) => { setBuilder(next); onChange(builderToCondition(next)); };
  return <div className="space-y-2 border border-border p-2"><p className="text-xs font-semibold text-muted-foreground">{label}</p>{builder.clauses.length > 1 && <select className="h-7 text-xs" value={builder.combine} onChange={(e) => patch({ ...builder, combine: e.target.value as 'and' | 'or' })}><option value="and">全部满足（且）</option><option value="or">任一满足（或）</option></select>}{builder.clauses.map((clause, index) => <div key={index} className="flex flex-wrap items-center gap-1.5"><select className="h-7 text-xs" value={clause.kind} onChange={(e) => { const kind = e.target.value as 'visited' | 'var'; patch({ ...builder, clauses: builder.clauses.map((item, i) => i === index ? (kind === 'visited' ? { kind, page: pages[0]?.id } : { kind, variable: variables[0]?.name, compare: '==', value: defaultValue(variables[0]) }) : item) }); }}><option value="visited">已访问页面</option><option value="var">变量</option></select>{clause.kind === 'visited' ? <select className="h-7 min-w-28 text-xs" value={clause.page || ''} onChange={(e) => patch({ ...builder, clauses: builder.clauses.map((item, i) => i === index ? { ...item, page: e.target.value } : item) })}>{pages.map((page) => <option key={page.id} value={page.id}>{page.title || page.id}</option>)}</select> : <><select className="h-7 min-w-24 text-xs" value={clause.variable || ''} onChange={(e) => { const variable = variables.find((item) => item.name === e.target.value); patch({ ...builder, clauses: builder.clauses.map((item, i) => i === index ? { ...item, variable: e.target.value, value: defaultValue(variable) } : item) }); }}>{variables.length ? variables.map((variable) => <option key={variable.name} value={variable.name}>{variable.name}</option>) : <option value="">（暂无变量）</option>}</select><select className="h-7 text-xs" value={clause.compare || '=='} onChange={(e) => patch({ ...builder, clauses: builder.clauses.map((item, i) => i === index ? { ...item, compare: e.target.value as NovelCondition['compare'] } : item) })}>{['==', '!=', '>', '>=', '<', '<='].map((op) => <option key={op} value={op}>{op}</option>)}</select><input className="h-7 w-24 border border-border bg-background px-2 text-xs" value={String(clause.value ?? '')} onChange={(e) => patch({ ...builder, clauses: builder.clauses.map((item, i) => i === index ? { ...item, value: e.target.value } : item) })} /></>}<button type="button" className="px-1 text-muted-foreground hover:text-foreground" aria-label="删除条件" onClick={() => patch({ ...builder, clauses: builder.clauses.filter((_, i) => i !== index) })}><X className="size-3" /></button></div>)}<div className="flex gap-2"><button type="button" className="border border-border px-2 py-1 text-xs" onClick={() => patch({ ...builder, clauses: [...builder.clauses, { kind: 'visited', page: pages[0]?.id }] })}>+ 添加条件</button>{builder.clauses.length > 0 && <button type="button" className="px-2 py-1 text-xs text-muted-foreground" onClick={() => patch({ combine: 'and', clauses: [] })}>清除</button>}</div></div>;
}

function OptionActions({ option, onChange }: { option: NovelOption; onChange: (value: NovelOption) => void }) {
  const actions = option.actions || [];
  return <div className="space-y-1"><p className="text-xs font-semibold text-muted-foreground">选项动作</p>{actions.map((action, index) => <div key={action.id} className="flex flex-wrap items-center gap-1.5"><span className="text-xs">{action.type === 'set' ? '设置' : '跳转'}</span>{action.type === 'set' && <><input className="h-7 w-24 border border-border bg-background px-2 text-xs" placeholder="变量" value={action.variable || ''} onChange={(e) => onChange({ ...option, actions: actions.map((item, i) => i === index ? { ...item, variable: e.target.value } : item) })} /><select className="h-7 text-xs" value={action.op || 'set'} onChange={(e) => onChange({ ...option, actions: actions.map((item, i) => i === index ? { ...item, op: e.target.value as 'set' | 'add' } : item) })}><option value="set">设为</option><option value="add">累加</option></select><input className="h-7 w-20 border border-border bg-background px-2 text-xs" value={String(action.value ?? '')} onChange={(e) => onChange({ ...option, actions: actions.map((item, i) => i === index ? { ...item, value: e.target.value } : item) })} /></>}<button type="button" className="text-muted-foreground hover:text-foreground" aria-label="删除动作" onClick={() => onChange({ ...option, actions: actions.filter((_, i) => i !== index) })}><X className="size-3" /></button></div>)}<div className="flex gap-2"><button type="button" className="border border-border px-2 py-1 text-xs" onClick={() => onChange({ ...option, actions: [...actions, { ...createAction('set'), variable: '', value: '' }] })}>+ 设置变量</button><button type="button" className="border border-border px-2 py-1 text-xs" onClick={() => onChange({ ...option, actions: [...actions, createAction('goto')] })}>+ 跳转</button></div></div>;
}

function OptionsEditor({ action, pages, variables, onChange }: { action: NovelAction; pages: NovelPage[]; variables: NovelVariable[]; onChange: (value: NovelAction) => void }) {
  const options = action.options || [];
  const patchOption = (index: number, value: NovelOption) => onChange({ ...action, options: options.map((item, i) => i === index ? value : item) });
  return <div className="space-y-2"><p className="text-xs font-semibold text-muted-foreground">分支选项（{options.length}）</p>{options.map((option, index) => <div key={option.id} className="space-y-2 border border-border p-2"><div className="flex flex-wrap items-center gap-1.5"><input className="h-7 min-w-40 flex-1 border border-border bg-background px-2 text-sm" placeholder="选项文字" value={option.label} onChange={(e) => patchOption(index, { ...option, label: e.target.value })} /><select className="h-7 text-xs" value={option.goto || ''} onChange={(e) => patchOption(index, { ...option, goto: e.target.value || undefined })}><option value="">（不跳转）</option>{pages.map((page) => <option key={page.id} value={page.id}>→ {page.title || page.id}</option>)}</select><button type="button" className="text-muted-foreground hover:text-foreground" aria-label="删除选项" onClick={() => onChange({ ...action, options: options.filter((_, i) => i !== index) })}><X className="size-3" /></button></div><div className="grid gap-2 md:grid-cols-2"><ConditionEditor label="可见条件（不满足则隐藏）" value={option.visible} pages={pages} variables={variables} onChange={(value) => patchOption(index, { ...option, visible: value })} /><div className="space-y-2"><ConditionEditor label="锁定条件（不满足则置灰）" value={option.locked} pages={pages} variables={variables} onChange={(value) => patchOption(index, { ...option, locked: value })} /><input className="h-7 w-full border border-border bg-background px-2 text-xs" placeholder="锁定提示" value={option.lockLabel || ''} onChange={(e) => patchOption(index, { ...option, lockLabel: e.target.value })} /></div></div><OptionActions option={option} onChange={(value) => patchOption(index, value)} /></div>)}<button type="button" className="border border-border px-2 py-1 text-xs" onClick={() => onChange({ ...action, options: [...options, { id: `option-${crypto.randomUUID().slice(0, 8)}`, label: '' }] })}>+ 添加选项</button></div>;
}

function ActionEditor({ action, pages, variables, images, onChange, onUpload }: { action: NovelAction; pages: NovelPage[]; variables: NovelVariable[]; images: string[]; onChange: (value: NovelAction) => void; onUpload: (file: File) => Promise<string> }) {
  const [uploading, setUploading] = useState(false);
  if (action.type === 'image') return <div className="space-y-2"><div className="flex flex-wrap gap-2"><input className="h-8 min-w-48 flex-1 border border-border bg-background px-2 text-sm" placeholder="图片 URL 或存储路径" value={action.image || ''} onChange={(e) => onChange({ ...action, image: e.target.value })} /><label className="cursor-pointer border border-border px-3 py-1.5 text-xs">{uploading ? '上传中…' : '上传'}<input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; setUploading(true); try { onChange({ ...action, image: await onUpload(file) }); } finally { setUploading(false); e.target.value = ''; } }} /></label></div>{images.length > 0 && <div className="flex flex-wrap gap-1.5">{images.map((image) => <button type="button" key={image} className="border border-border px-2 py-1 text-xs" onClick={() => onChange({ ...action, image })}>{image.slice(-28)}</button>)}</div>}{action.image && <img src={action.image} alt="" className="h-20 max-w-32 object-cover" />}</div>;
  if (action.type === 'say') return <div className="space-y-2"><textarea className="w-full border border-border bg-background px-2 py-1.5 text-sm" rows={3} placeholder="文字内容" value={action.text || ''} onChange={(e) => onChange({ ...action, text: e.target.value })} /><select className="h-8 text-sm" value={action.align || 'left'} onChange={(e) => onChange({ ...action, align: e.target.value as 'left' | 'center' | 'right' })}><option value="left">左对齐</option><option value="center">居中</option><option value="right">右对齐</option></select></div>;
  if (action.type === 'timer') return <div className="flex flex-wrap items-center gap-2 text-sm"><select className="h-8" value={action.duration?.mode || 'specific'} onChange={(e) => onChange({ ...action, duration: { ...(action.duration || { mode: 'specific' }), mode: e.target.value as 'specific' | 'range' } })}><option value="specific">固定时长</option><option value="range">随机区间</option></select>{action.duration?.mode === 'range' ? <><input type="number" min={1} className="h-8 w-20 border border-border bg-background px-2" value={action.duration.min || 1} onChange={(e) => onChange({ ...action, duration: { ...(action.duration || { mode: 'range' }), mode: 'range', min: Number(e.target.value) } })} /><span>~</span><input type="number" min={1} className="h-8 w-20 border border-border bg-background px-2" value={action.duration.max || 1} onChange={(e) => onChange({ ...action, duration: { ...(action.duration || { mode: 'range' }), mode: 'range', max: Number(e.target.value) } })} /></> : <input type="number" min={1} className="h-8 w-20 border border-border bg-background px-2" value={action.duration?.seconds || 5} onChange={(e) => onChange({ ...action, duration: { ...(action.duration || { mode: 'specific' }), mode: 'specific', seconds: Number(e.target.value) } })} />}<select className="h-8" value={action.style || 'normal'} onChange={(e) => onChange({ ...action, style: e.target.value as 'normal' | 'secret' | 'hidden' })}><option value="normal">显示剩余秒</option><option value="secret">只显示进度</option><option value="hidden">隐藏提示</option></select><label className="inline-flex items-center gap-1 text-xs"><input type="checkbox" checked={Boolean(action.autoAdvance)} onChange={(e) => onChange({ ...action, autoAdvance: e.target.checked })} />结束后自动跳转</label></div>;
  if (action.type === 'choice') return <OptionsEditor action={action} pages={pages} variables={variables} onChange={onChange} />;
  if (action.type === 'goto') return <select className="h-8 text-sm" value={action.target || ''} onChange={(e) => onChange({ ...action, target: e.target.value })}><option value="">（选择目标页）</option>{pages.map((page) => <option key={page.id} value={page.id}>→ {page.title || page.id}</option>)}</select>;
  if (action.type === 'set') return <div className="flex flex-wrap items-center gap-2"><select className="h-8 text-sm" value={action.variable || ''} onChange={(e) => onChange({ ...action, variable: e.target.value })}><option value="">（选择变量）</option>{variables.map((variable) => <option key={variable.name} value={variable.name}>{variable.name}</option>)}</select><select className="h-8 text-sm" value={action.op || 'set'} onChange={(e) => onChange({ ...action, op: e.target.value as 'set' | 'add' })}><option value="set">设为</option><option value="add">累加</option></select><input className="h-8 w-24 border border-border bg-background px-2 text-sm" value={String(action.value ?? '')} onChange={(e) => onChange({ ...action, value: e.target.value })} /></div>;
  return <p className="text-xs text-muted-foreground">执行本动作后作品结束。</p>;
}

function PageSidebar({ source, selected, onSelect, onChange }: { source: NovelSource; selected: string; onSelect: (id: string) => void; onChange: (source: NovelSource) => void }) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [name, setName] = useState('');
  const rename = (id: string) => {
    const next = name.trim() || id;
    if (next === id) { setRenaming(null); return; }
    onChange({ ...source, startPage: source.startPage === id ? next : source.startPage, pages: source.pages.map((page) => ({ ...page, id: page.id === id ? next : page.id, actions: page.actions.map((action) => action.type === 'goto' && action.target === id ? { ...action, target: next } : action.type === 'choice' ? { ...action, options: (action.options || []).map((option) => option.goto === id ? { ...option, goto: next } : option) } : action) })) });
    onSelect(next); setRenaming(null);
  };
  const addPage = () => { const id = `page-${crypto.randomUUID().slice(0, 8)}`; onChange({ ...source, pages: [...source.pages, { id, title: '', actions: [] }] }); onSelect(id); };
  const duplicate = (page: NovelPage) => { const id = `${page.id}-copy-${crypto.randomUUID().slice(0, 6)}`; onChange({ ...source, pages: [...source.pages, { ...clone(page), id, actions: page.actions.map((action) => ({ ...clone(action), id: `${action.id}-copy-${crypto.randomUUID().slice(0, 5)}` })) }] }); onSelect(id); };
  const remove = (id: string) => { if (source.pages.length <= 1) return; const pages = source.pages.filter((page) => page.id !== id).map((page) => ({ ...page, actions: page.actions.map((action) => action.type === 'goto' && action.target === id ? { ...action, target: '' } : action.type === 'choice' ? { ...action, options: (action.options || []).map((option) => option.goto === id ? { ...option, goto: undefined } : option) } : action) })); onChange({ ...source, startPage: source.startPage === id ? pages[0].id : source.startPage, pages }); if (selected === id) onSelect(pages[0].id); };
  return <aside className="md:mr-3 md:border-r md:border-border md:pr-3"><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">页面（{source.pages.length}）</h3><button type="button" className="border border-border px-2 py-1 text-xs" onClick={addPage}>+ 新页</button></div><ul className="space-y-1">{source.pages.map((page) => <li key={page.id} className={`border ${selected === page.id ? 'border-foreground' : 'border-border'}`}>{renaming === page.id ? <div className="flex gap-1 p-1"><input autoFocus className="h-7 min-w-0 flex-1 border border-border bg-background px-1 text-xs" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && rename(page.id)} /><button type="button" aria-label="确认改名" onClick={() => rename(page.id)}><Check className="size-3.5" /></button></div> : <div className="flex items-center gap-1 px-2 py-1.5"><button type="button" className="min-w-0 flex-1 truncate text-left text-xs" onClick={() => onSelect(page.id)}>{page.title || page.id}</button>{page.id === source.startPage && <span className="text-[10px]">start</span>}<button type="button" className="text-xs" aria-label={`重命名 ${page.id}`} onClick={() => { setRenaming(page.id); setName(page.id); }}><Pencil className="size-3" /></button><button type="button" className="text-xs" aria-label={`复制 ${page.id}`} onClick={() => duplicate(page)}><Copy className="size-3" /></button>{page.id !== source.startPage && <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`删除 ${page.id}`} onClick={() => remove(page.id)}><X className="size-3" /></button>}</div>}</li>)}</ul><p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">页面名为 start 的页面是起始页，选项和跳转都会指向页面名。</p></aside>;
}

function VariablesEditor({ variables, onChange }: { variables: NovelVariable[]; onChange: (variables: NovelVariable[]) => void }) {
  const patch = (index: number, value: Partial<NovelVariable>) => onChange(variables.map((item, i) => i === index ? { ...item, ...value } : item));
  return <section className="mt-4 border-t border-border pt-3"><h3 className="mb-2 text-sm font-semibold">道具与变量（{variables.length}）</h3><p className="mb-2 text-xs text-muted-foreground">道具会显示在玩家背包，变量只用于剧情条件和隐藏分支。</p><div className="space-y-2">{variables.map((variable, index) => <div key={`${variable.name}-${index}`} className="space-y-2 border border-border p-2"><div className="flex flex-wrap items-center gap-2"><select className="h-8 text-xs" value={variable.kind} onChange={(e) => patch(index, { kind: e.target.value as 'item' | 'flag' })}><option value="flag">变量（隐藏）</option><option value="item">道具（可见）</option></select><input className="h-8 w-32 border border-border bg-background px-2 text-xs" placeholder="变量名" value={variable.name} onChange={(e) => patch(index, { name: e.target.value })} /><select className="h-8 text-xs" value={variable.type} onChange={(e) => patch(index, { type: e.target.value as 'bool' | 'number' | 'string', initial: defaultValue({ ...variable, type: e.target.value as 'bool' | 'number' | 'string' }) })}><option value="bool">布尔</option><option value="number">数字</option><option value="string">字符串</option></select><input className="h-8 w-24 border border-border bg-background px-2 text-xs" placeholder="初始值" value={String(variable.initial)} onChange={(e) => patch(index, { initial: e.target.value })} /><button type="button" className="text-muted-foreground hover:text-foreground" aria-label="删除变量" onClick={() => onChange(variables.filter((_, i) => i !== index))}><X className="size-3" /></button></div>{variable.kind === 'item' && <div className="flex flex-wrap gap-2"><input className="h-8 w-40 border border-border bg-background px-2 text-xs" placeholder="道具名称" value={variable.label || ''} onChange={(e) => patch(index, { label: e.target.value })} /><input className="h-8 min-w-48 flex-1 border border-border bg-background px-2 text-xs" placeholder="用途说明" value={variable.description || ''} onChange={(e) => patch(index, { description: e.target.value })} /></div>}</div>)}</div><div className="mt-2 flex gap-2"><button type="button" className="border border-border px-2 py-1 text-xs" onClick={() => onChange([...variables, { name: `item-${crypto.randomUUID().slice(0, 6)}`, type: 'bool', initial: false, kind: 'item', label: '', description: '' }])}>+ 添加道具</button><button type="button" className="border border-border px-2 py-1 text-xs" onClick={() => onChange([...variables, { name: `var-${crypto.randomUUID().slice(0, 6)}`, type: 'bool', initial: false, kind: 'flag' }])}>+ 添加变量</button></div></section>;
}

function SourceEditor({ source, onChange, onUpload }: { source: NovelSource; onChange: (source: NovelSource) => void; onUpload: (file: File) => Promise<string> }) {
  const [selected, setSelected] = useState(source.pages[0]?.id || '');
  const page = source.pages.find((item) => item.id === selected) || source.pages[0];
  const patchPage = (pageId: string, update: (page: NovelPage) => NovelPage) => onChange({ ...source, pages: source.pages.map((item) => item.id === pageId ? update(item) : item) });
  const images = useMemo(
    () => [...new Set(source.pages.flatMap((item) => item.actions.filter((action) => action.type === 'image' && action.image).map((action) => action.image as string)))],
    [source.pages],
  );
  if (!page) return null;
  return <div className="grid gap-4 md:grid-cols-[220px_1fr]"><PageSidebar source={source} selected={selected} onSelect={setSelected} onChange={(next) => { onChange(next); if (!next.pages.some((item) => item.id === selected)) setSelected(next.pages[0]?.id || ''); }} /><div><div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-semibold">动作序列（{page.actions.length}）</h3><select className="h-8 text-xs" value="" onChange={(e) => { if (!e.target.value) return; patchPage(page.id, (item) => ({ ...item, actions: [...item.actions, createAction(e.target.value as NovelAction['type'])] })); e.target.value = ''; }}><option value="">添加动作…</option>{ACTION_TYPES.map((type) => <option key={type} value={type}>{ACTION_LABELS[type]}</option>)}</select></div>{page.actions.length === 0 ? <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">这一页还没有动作。</p> : <div className="space-y-2">{page.actions.map((action, index) => <div key={action.id} className={`border border-border p-2 ${action.disabled ? 'opacity-50' : ''}`}><div className="mb-2 flex items-center gap-1.5"><span className="bg-secondary px-1.5 py-0.5 text-xs">{ACTION_LABELS[action.type]}{action.disabled ? '（已禁用）' : ''}</span><span className="flex-1" /><button type="button" disabled={index === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="上移" onClick={() => patchPage(page.id, (item) => { const actions = [...item.actions]; [actions[index - 1], actions[index]] = [actions[index], actions[index - 1]]; return { ...item, actions }; })}><ChevronUp className="size-3.5" /></button><button type="button" disabled={index === page.actions.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-30" aria-label="下移" onClick={() => patchPage(page.id, (item) => { const actions = [...item.actions]; [actions[index], actions[index + 1]] = [actions[index + 1], actions[index]]; return { ...item, actions }; })}><ChevronDown className="size-3.5" /></button><button type="button" className="text-xs" onClick={() => patchPage(page.id, (item) => { const actions = [...item.actions]; actions.splice(index + 1, 0, { ...clone(action), id: `copy-${crypto.randomUUID().slice(0, 8)}` }); return { ...item, actions }; })}>复制</button><button type="button" className="text-xs" onClick={() => patchPage(page.id, (item) => ({ ...item, actions: item.actions.map((current, i) => i === index ? { ...current, disabled: !current.disabled } : current) }))}>{action.disabled ? '启用' : '禁用'}</button><button type="button" className="text-xs" onClick={() => patchPage(page.id, (item) => ({ ...item, actions: item.actions.filter((_, i) => i !== index) }))}>删除</button></div><ActionEditor action={action} pages={source.pages} variables={source.variables} images={images} onChange={(value) => patchPage(page.id, (item) => ({ ...item, actions: item.actions.map((current, i) => i === index ? value : current) }))} onUpload={onUpload} /></div>)}</div>}<VariablesEditor variables={source.variables} onChange={(variables) => onChange({ ...source, variables })} /></div></div>;
}

// ── 编辑器组件（复刻 2x.nz 布局：AI 创作 / 新建作品 / 我的作品）──

interface EditSession {
  novel: Novel;
  title: string;
  description: string;
  tags: string;
  source: NovelSource;
}

function loadSession(novel: Novel): EditSession {
  return {
    novel,
    title: novel.title,
    description: novel.description || '',
    tags: (novel.tags || []).join(', '),
    source: normalizeSource(novel.content || novel.source),
  };
}

export function NovelEditor() {
  const [params] = useSearchParams();
  const [editSlug, setEditSlug] = useState<string | null>(params.get('slug'));

  // AI 创作区
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [mails, setMails] = useState<{ items: WalletMail[]; unclaimed_count: number } | null>(null);
  const [mailsOpen, setMailsOpen] = useState(false);
  const [requirement, setRequirement] = useState('');
  const [jobs, setJobs] = useState<AiJob[]>([]);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [importOpen, setImportOpen] = useState(true);
  const [importText, setImportText] = useState('');

  // 新建作品
  const [newForm, setNewForm] = useState({ title: '', slug: '', description: '', tags: '' });
  const [creating, setCreating] = useState(false);

  // 我的作品
  const [novels, setNovels] = useState<Novel[]>([]);
  const [editing, setEditing] = useState<EditSession | null>(null);
  const [saving, setSaving] = useState(false);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [refineInstruction, setRefineInstruction] = useState('');

  const loadWallet = useCallback(async () => { try { setWallet(await getWallet()); } catch {} }, []);
  const loadMails = useCallback(async () => { try { setMails(await getMails()); } catch {} }, []);
  const loadJobs = useCallback(async () => { try { setJobs(await getAiJobs()); } catch {} }, []);
  const loadNovels = useCallback(async () => { try { setNovels(await getMyNovels()); } catch {} }, []);

  const loadAll = useCallback(() => {
    loadWallet(); loadMails(); loadJobs(); loadNovels();
  }, [loadWallet, loadMails, loadJobs, loadNovels]);

  useEffect(() => {
    getAiStatus().then((value) => setAiEnabled(value.enabled)).catch(() => {});
    loadAll();
  }, [loadAll]);

  // 任务轮询（有进行中任务时每 8s 刷新）
  useEffect(() => {
    if (!jobs.some((job) => job.status === 'pending')) return;
    const timer = setInterval(() => { loadJobs(); loadWallet(); }, 8000);
    return () => clearInterval(timer);
  }, [jobs, loadJobs, loadWallet]);

  // 编辑会话（slug 变化时加载）
  useEffect(() => {
    if (!editSlug) { setEditing(null); return; }
    setBusySlug(editSlug);
    getNovel(editSlug).then((novel) => { setEditing(loadSession(novel)); setBusySlug(null); })
      .catch(() => { setError('加载失败'); setBusySlug(null); });
  }, [editSlug]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadWallet(), loadMails(), loadJobs(), loadNovels()]);
  }, [loadWallet, loadMails, loadJobs, loadNovels]);

  const generate = async () => {
    if (!requirement.trim()) { setError('请输入创作需求'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const { job_id } = await aiGenerate(requirement.trim());
      setMessage('已开始创作，可以关闭页面 —— 完成后作品会自动出现在「我的作品」里。');
      void loadJobs();
      const job = await waitAiJob(job_id, (seconds) => setMessage(`正在生成… ${seconds}s（后台运行，可关闭页面）`));
      if (job.status === 'done' && job.result) {
        const result = job.result as { title?: string; description?: string; tags?: string[]; content?: unknown };
        setRequirement('');
        setMessage(`《${result.title || '未命名'}》已创作完成并存为草稿：${job.tokens} tokens，扣 ${job.cost} 创作点。`);
      } else if (job.status === 'error') {
        setError(job.error || '创作失败（未扣费）');
      }
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '发起失败');
    } finally { setBusy(false); }
  };

  const claim = async (mail: WalletMail) => {
    try {
      const result = await claimMail(mail.id);
      await loadMails();
      await loadWallet();
      setMessage(result.amount > 0 ? `已领取 ${result.amount} 创作点，余额 ${result.balance}。` : '已读。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '领取失败');
    }
  };

  const sync = async () => {
    try {
      const info = await syncWallet();
      setWallet(info);
      setMessage(`已同步，当前余额 ${info.balance} 创作点。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '同步失败');
    }
  };

  const create = async () => {
    if (!newForm.title.trim()) { setError('标题不能为空'); return; }
    setCreating(true); setError(''); setMessage('');
    try {
      const novel = await createNovel({
        title: newForm.title.trim(),
        slug: newForm.slug.trim() || undefined,
        description: newForm.description.trim(),
        tags: newForm.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        content: createStarterSource(),
      });
      setNewForm({ title: '', slug: '', description: '', tags: '' });
      await loadNovels();
      setEditSlug(novel.slug);
      setMessage(`《${novel.title}》已创建为草稿，进入可视化编辑器。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建失败');
    } finally { setCreating(false); }
  };

  const saveEdit = async (status: 'draft' | 'published') => {
    if (!editing) return;
    if (!editing.title.trim()) { setError('标题不能为空'); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      await updateNovel(editing.novel.slug, {
        title: editing.title.trim(),
        description: editing.description.trim(),
        tags: editing.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        content: editing.source,
      });
      await publishNovel(editing.novel.slug, status);
      setMessage(status === 'published' ? '已保存并发布' : '已保存为草稿');
      await refreshAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败');
    } finally { setSaving(false); }
  };

  const setAnonymous = async (slug: string, anonymous: boolean) => {
    try { await updateNovel(slug, { anonymous }); await loadNovels(); } catch {}
  };

  const togglePublish = async (novel: Novel) => {
    setBusySlug(novel.slug);
    try {
      await publishNovel(novel.slug, novel.status === 'published' ? 'draft' : 'published');
      await loadNovels();
    } catch {}
    finally { setBusySlug(null); }
  };

  const removeNovel = async (slug: string) => {
    setBusySlug(slug);
    try { await deleteNovel(slug); await loadNovels(); } catch {}
    finally { setBusySlug(null); }
  };

  const refine = async () => {
    if (!editing || !refineInstruction.trim()) { setError('请输入修改指令'); return; }
    setBusy(true); setMessage(''); setError('');
    try {
      const { job_id } = await aiRefine(editing.novel.slug, refineInstruction.trim());
      setMessage('已开始修改，可以关闭页面 —— 改好后直接写回这部作品。');
      void loadJobs();
      const job = await waitAiJob(job_id, (seconds) => setMessage(`正在修改… ${seconds}s`));
      if (job.status === 'done') {
        const novel = await getNovel(editing.novel.slug);
        setEditing(loadSession(novel));
        setRefineInstruction('');
        setMessage(`已按要求改写：${job.tokens} tokens，扣 ${job.cost} 创作点，余额 ${wallet ? wallet.balance - job.cost : job.cost}。`);
        await refreshAll();
      } else if (job.status === 'error') {
        setError(job.error || '修改失败（未扣费）');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '修改失败');
    } finally { setBusy(false); }
  };

  const upload = async (file: File) => uploadNovelImage(file);

  const importDraft = async (raw: string) => {
    setError(''); setMessage('');
    try {
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const body = fenced ? fenced[1] : raw;
      const start = body.indexOf('{');
      const end = body.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('没有找到 JSON 内容');
      const imported = normalizeImportedNovel(JSON.parse(body.slice(start, end + 1)));
      const issues = auditNovelSource(imported.source);
      const novel = await createNovel({ title: imported.title, description: imported.description, tags: imported.tags, content: imported.source });
      setImportText(''); setImportOpen(false);
      await loadNovels();
      setEditSlug(novel.slug);
      const notes = [...imported.warnings, ...(issues.length ? [`体检提示：${issues.join('；')}`] : [])];
      setMessage(notes.length ? `已导入《${novel.title}》；${notes.join('；')}` : `《${novel.title}》已导入为草稿。`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '导入失败，请检查 JSON');
    }
  };

  const importFile = async (file: File) => {
    try { await importDraft(await file.text()); } catch { setError('文件读取失败'); }
  };

  const exportNovel = (novel: Novel) => {
    const data = {
      title: novel.title,
      description: novel.description || '',
      tags: novel.tags || [],
      source: normalizeSource(novel.content || novel.source),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${novel.slug}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const lowBalance = wallet ? (wallet.balance ?? 0) < (wallet.min_balance ?? 20) : false;
  const liveJob = jobs.find((job) => job.status === 'pending');

  // 充值走订单流程（createWalletOrder → 爱发电支付链接），而不是拼一个无效 URL
  const [recharging, setRecharging] = useState(false);
  const recharge = async () => {
    setRecharging(true); setError(''); setMessage('');
    try {
      const order = await createWalletOrder(wallet?.plan?.[0]?.points ?? 6000);
      if (order.pay_url) {
        window.open(order.pay_url, '_blank');
        setMessage(`订单已创建（${order.points} 点 / ${order.amount_cny} 元），支付完成后自动到账，点「已支付，刷新余额」确认。`);
      } else {
        setMessage('订单已创建，但爱发电支付链接尚未配置（后台「AI 与支付」填写爱发电 user_id）。');
      }
      loadWallet();
    } catch (e) {
      setError(e instanceof Error ? e.message : '下单失败');
    } finally { setRecharging(false); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="mb-5">
        <Link to="/webnovel" className="mb-2 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">← 返回作品列表</Link>
        <h1 className="text-xl font-bold">交互小说创作</h1>
        <p className="mt-1 text-sm text-muted-foreground">按页面组织故事，每页排布图片、文字、计时、分支等动作。发布后生成公开游玩链接。</p>
      </header>

      {error && <p className="mb-4 border-y border-destructive py-2 text-sm text-destructive">{error}</p>}

      {/* ── AI 创作 ── */}
      <section className="mb-6 border-y border-border py-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-1.5 text-base font-semibold"><Sparkles className="size-4" /> AI 创作</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">创作点 {wallet?.balance ?? '…'}{wallet ? `（按 token 计费：${wallet.token_per_point} tokens = 1 点）` : ''}</span>
            <button type="button" className="inline-flex h-6 items-center gap-1 border border-border px-2 hover:border-foreground disabled:opacity-50" onClick={recharge} disabled={recharging}>{recharging ? '下单中…' : `充值（${wallet?.plan?.[0]?.points ?? 6000} 点/份）`}</button>
            <button type="button" className="border border-border px-2 py-0.5 hover:border-foreground" onClick={sync}>已支付，刷新余额</button>
            <button type="button" className={`border px-2 py-0.5 hover:border-foreground ${(mails?.unclaimed_count ?? 0) > 0 ? 'border-foreground' : 'border-border'}`} onClick={() => setMailsOpen((v) => !v)}>站内信{(mails?.unclaimed_count ?? 0) > 0 ? `（${mails?.unclaimed_count ?? 0}）` : ''}</button>
          </div>
        </div>

        {/* 模型输出（实时）：进行中任务放最上面独立展示，与「创作任务」列表同级 */}
        {liveJob && (
          <div className="mb-3 border border-border p-3">
            <div className="mb-1 text-[11px] text-muted-foreground">模型输出（实时）</div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] leading-relaxed text-foreground/90">{liveJob.progress || '等待模型输出…'}</pre>
          </div>
        )}

        {mailsOpen && (
          <div className="mb-3 space-y-1 border border-border p-2">
            {!mails || mails.items.length === 0 ? (
              <p className="text-xs text-muted-foreground">暂无站内信。</p>
            ) : mails.items.map((mail) => (
              <div key={mail.id} className="flex items-start justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{mail.title}</span>
                    {mail.amount > 0 && <span className="bg-secondary px-1.5 text-[11px]">+{mail.amount} 点</span>}
                    {mail.max_claims > 0 && <span className={`text-[11px] ${mail.remaining > 0 ? 'text-amber-600' : 'text-muted-foreground'}`}>{mail.remaining > 0 ? `仅剩 ${mail.remaining} 个名额` : '名额已抢完'}</span>}
                  </div>
                  {mail.body && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{mail.body}</p>}
                </div>
                {mail.claimed ? <span className="shrink-0 text-[11px] text-muted-foreground">已领取</span> : mail.sold_out ? <span className="shrink-0 text-[11px] text-muted-foreground">已抢完</span> : <button type="button" className="shrink-0 border border-border px-2 py-0.5 text-xs" onClick={() => claim(mail)}>{mail.amount > 0 ? '领取' : '知道了'}</button>}
              </div>
            ))}
          </div>
        )}

        {!aiEnabled ? (
          <p className="text-sm text-muted-foreground">AI 尚未配置，请联系管理员在后台「AI 与支付」中设置。（本地开发可在 .dev.vars 配置 AI_OPENAI_* 或 AI_CF_*）</p>
        ) : (
          <>
            <p className="mb-2 text-sm text-muted-foreground">描述你想要的故事，AI 会生成完整的分支剧情（含变量、条件选项、多结局），直接存为草稿，之后可自由编辑。</p>
            <textarea className="w-full border border-border bg-background px-2 py-1.5 text-sm" rows={3} maxLength={2000} placeholder="例如：一个雨夜的废弃医院探险，手电筒有电量限制，耗尽会触发坏结局…" value={requirement} onChange={(e) => setRequirement(e.target.value)} disabled={busy} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" className="border border-foreground bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40" onClick={generate} disabled={busy || !requirement.trim()}>{busy ? '生成中…' : '生成作品'}</button>
              {lowBalance && wallet && <span className="text-xs text-destructive">创作点不足（至少 {wallet.min_balance}），请先充值。</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AI_PROMPT_EXAMPLES.map((prompt) => <button key={prompt} type="button" className="border border-border px-2 py-1 text-[11px] text-muted-foreground hover:border-foreground disabled:opacity-50" onClick={() => setRequirement(prompt)} disabled={busy}>{prompt.slice(0, 18)}…</button>)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <Link to="/webnovel/format" className="text-primary underline">去格式与提示词页</Link>
              复制提示词，喂给任意大模型，再把它输出的 JSON 贴到那里 —— 不消耗创作点。
            </p>
          </>
        )}
        {/* 消息（充值/领取/生成等反馈）全局显示，AI 未配置时也能看到 */}
        {message && <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">{message}</p>}

        {jobs.length > 0 && (
          <details className="mt-3 border border-border" open={jobs.some((job) => job.status === 'pending')}>
            <summary className="cursor-pointer select-none border-b border-border px-2 py-1 text-[11px] text-muted-foreground">创作任务（后台运行，可关闭页面）</summary>
            <ul>
              {jobs.map((job) => (
                <li key={job.job_id} className="flex items-start justify-between gap-2 border-b border-border px-2 py-1.5 text-xs last:border-0">
                  <div className="min-w-0">
                    <span className="mr-1.5 text-muted-foreground">{job.kind === 'refine' ? '修改' : '创作'}</span>
                    {job.status === 'pending' && <span className="text-amber-600">进行中…</span>}
                    {job.status === 'done' && <span className="text-emerald-600">已完成</span>}
                    {job.status === 'error' && <span className="text-destructive">失败：{job.error}</span>}
                    {job.status === 'done' && job.title && <b className="ml-1.5">《{job.title}》</b>}
                    {job.status === 'done' && <span className="ml-1.5 font-mono text-muted-foreground">{job.tokens} tokens · 扣 {job.cost}</span>}
                    <p className="truncate text-muted-foreground">{job.prompt}</p>
                    {job.status === 'done' && job.result && (
                      <details className="mt-1 border-t border-border pt-1">
                        <summary className="cursor-pointer select-none text-[11px] text-muted-foreground">查看模型最终回传</summary>
                        <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap break-all border border-border bg-muted p-2 font-mono text-[11px]">{JSON.stringify(job.result, null, 2)}</pre>
                      </details>
                    )}
                  </div>
                  {job.status === 'done' && job.slug && (
                    <Link to={`/webnovel/play/${job.slug}`} target="_blank" rel="noreferrer" className="shrink-0 border border-border px-1.5 py-0.5 hover:border-foreground">预览</Link>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section className="mb-6 border-y border-border py-5">
        <details open={importOpen} onToggle={(event) => setImportOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer select-none text-base font-semibold">导入 JSON（用你自己的 AI 生成）</summary>
          <p className="mt-2 text-sm text-muted-foreground">去<Link to="/webnovel/format" className="mx-1 underline hover:text-foreground">格式与提示词</Link>页复制提示词，喂给任意大模型，再把它输出的 JSON 贴到这里 —— 不消耗创作点。允许带 markdown 代码块和模型的客套话，会自动抠出 JSON。</p>
          <form className="mt-3" onSubmit={(event) => { event.preventDefault(); void importDraft(importText); }}>
            <textarea className="w-full border border-border bg-background px-3 py-2 font-mono text-xs" rows={6} placeholder="粘贴 AI 输出的 JSON，或从下面选择 .json 文件…" aria-label="要导入的 JSON" value={importText} onChange={(event) => setImportText(event.target.value)} />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="submit" className="border border-primary bg-primary px-2.5 py-1.5 text-xs text-primary-foreground disabled:opacity-50" disabled={!importText.trim()}>导入为草稿</button>
              <label className="inline-flex cursor-pointer items-center gap-1.5 border border-border px-2.5 py-1.5 text-xs hover:border-foreground"><Download className="size-3.5" />选择 .json 文件<input type="file" accept=".json,application/json" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ''; }} /></label>
            </div>
          </form>
        </details>
      </section>

      {/* ── 新建作品 ── */}
      <section className="mb-6 border-y border-border py-5">
        <h2 className="mb-3 text-base font-semibold">新建作品</h2>
        <div className="grid gap-3">
          <div>
            <label className="text-sm text-muted-foreground">标题 *</label>
            <input className="mt-0.5 h-9 w-full border border-border bg-background px-2 text-sm" maxLength={100} value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} placeholder="作品标题" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">访问链接（可空，自动生成）</label>
            <input className="mt-0.5 h-9 w-full border border-border bg-background px-2 text-sm" value={newForm.slug} onChange={(e) => setNewForm({ ...newForm, slug: e.target.value })} placeholder="my-novel-slug（小写字母/数字/横杠）" />
            {newForm.slug && <p className="mt-1 text-xs text-muted-foreground">预览：{window.location.origin}/webnovel/{newForm.slug}</p>}
          </div>
          <div>
            <label className="text-sm text-muted-foreground">简介</label>
            <textarea className="mt-0.5 w-full border border-border bg-background px-2 py-1.5 text-sm" rows={2} maxLength={300} value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} placeholder="一句话介绍你的作品…" />
          </div>
          <div>
            <label className="text-sm text-muted-foreground">标签（逗号分隔）</label>
            <input className="mt-0.5 h-9 w-full border border-border bg-background px-2 text-sm" value={newForm.tags} onChange={(e) => setNewForm({ ...newForm, tags: e.target.value })} placeholder="悬疑, 冒险" />
          </div>
        </div>
        <button type="button" className="mt-3 border border-foreground bg-foreground px-3 py-2 text-sm text-background disabled:opacity-40" onClick={create} disabled={creating || !newForm.title.trim()}>{creating ? '创建中…' : '创建'}</button>
      </section>

      {/* ── 我的作品 ── */}
      <section>
        <h2 className="mb-3 text-base font-semibold">我的作品（{novels.length}）</h2>
        {novels.length === 0 ? (
          <p className="border-y border-border py-8 text-center text-sm text-muted-foreground">还没有作品，从上面创建一个吧。</p>
        ) : (
          <div className="border-t border-border">
            {novels.map((novel) => {
              const meta = STATUS_META[novel.status] || STATUS_META.draft;
              const editingThis = editing && editing.novel.slug === novel.slug;
              return (
                <div key={novel.slug} className="border-b border-border py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{novel.title}</h3>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${meta.cls}`}>{meta.label}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{window.location.origin}/webnovel/{novel.slug}</span>
                        <span>{String(novel.updated_at || novel.created_at || '').slice(0, 10)}</span>
                        {editing && editing.novel.slug === novel.slug && <span>{editing.source.pages.length} 页</span>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {novel.status === 'published' && <Link to={`/webnovel/${novel.slug}`} className="border border-border px-2 py-1 text-xs hover:border-foreground">查看</Link>}
                      <Link to={`/webnovel/play/${novel.slug}`} target="_blank" rel="noreferrer" className="border border-border px-2 py-1 text-xs hover:border-foreground">预览</Link>
                      <button type="button" className="border border-border bg-secondary px-2 py-1 text-xs" onClick={() => { if (editingThis) { setEditing(null); setEditSlug(null); } else { setBusySlug(novel.slug); getNovel(novel.slug).then((n) => { setEditing(loadSession(n)); setEditSlug(novel.slug); }).catch(() => setError('加载失败')).finally(() => setBusySlug(null)); } }}>{editingThis ? '收起' : '编辑'}</button>
                      <button type="button" className="border border-border px-2 py-1 text-xs hover:border-foreground" title="下载作品 JSON" onClick={() => exportNovel(novel)}>导出</button>
                      <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <input type="checkbox" checked={Boolean(novel.anonymous)} disabled={busySlug === novel.slug} onChange={(e) => setAnonymous(novel.slug, e.target.checked)} />匿名
                      </label>
                      <button type="button" className="border border-border px-2 py-1 text-xs disabled:opacity-40" disabled={busySlug === novel.slug} onClick={() => togglePublish(novel)}>{novel.status === 'published' ? '转草稿' : '发布'}</button>
                      {confirmDelete === novel.slug ? (
                        <>
                          <button type="button" className="border border-destructive px-2 py-1 text-xs text-red-500" onClick={() => removeNovel(novel.slug)}>确认删除</button>
                          <button type="button" className="px-1 text-xs" onClick={() => setConfirmDelete(null)}>取消</button>
                        </>
                      ) : (
                        <button type="button" className="px-2 py-1 text-xs text-muted-foreground hover:text-red-500" onClick={() => setConfirmDelete(novel.slug)}>删除</button>
                      )}
                    </div>
                  </div>

                  {/* 内联编辑器 */}
                  {editingThis && editing && (
                    <div className="mt-4 border-t border-border pt-4">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <button type="button" className="border border-foreground bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-40" disabled={saving} onClick={() => saveEdit('draft')}>{saving ? '保存中…' : '保存草稿'}</button>
                        <button type="button" className="border border-foreground px-3 py-1.5 text-sm disabled:opacity-40" disabled={saving} onClick={() => saveEdit('published')}>{saving ? '保存中…' : '保存并发布'}</button>
                        <button type="button" className="border border-border px-3 py-1.5 text-sm" onClick={() => setEditing(loadSession(editing.novel))}>撤销当前输入</button>
                        <span className="text-xs text-muted-foreground">{editing.novel.status === 'published' ? '已发布' : '草稿'} · {editing.source.pages.length} 页</span>
                      </div>
                      <div className="mb-3 grid gap-2 sm:grid-cols-2">
                        <input className="h-9 border border-border bg-background px-2 text-sm" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="标题" />
                        <input className="h-9 border border-border bg-background px-2 text-sm" value={editing.tags} onChange={(e) => setEditing({ ...editing, tags: e.target.value })} placeholder="标签（逗号分隔）" />
                        <textarea className="border border-border bg-background px-2 py-1.5 text-sm sm:col-span-2" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} placeholder="简介" />
                      </div>

                      {aiEnabled && (
                        <div className="mb-4 border border-border p-3">
                          <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold"><Wrench className="size-4" /> AI 修改（在现有内容上改，可反复改）</h3>
                          <textarea className="w-full border border-border bg-background px-2 py-1.5 text-sm" rows={2} maxLength={1000} placeholder="想改什么？例如：把结局改得更黑暗；给走廊那页加一个 10 秒倒计时；多加一条分支线…" value={refineInstruction} onChange={(e) => setRefineInstruction(e.target.value)} disabled={busy} />
                          <button type="button" className="mt-2 border border-border px-3 py-1.5 text-sm disabled:opacity-40" onClick={refine} disabled={busy || !refineInstruction.trim()}>{busy ? '修改中…' : '按要求修改'}</button>
                          <span className="ml-2 text-[11px] text-muted-foreground">按 token 计费，失败不扣费</span>
                        </div>
                      )}

                      <SourceEditor source={editing.source} onChange={(source) => setEditing({ ...editing, source })} onUpload={upload} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
