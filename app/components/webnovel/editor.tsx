import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { getNovel, createNovel, updateNovel, publishNovel, aiGenerate, aiRefine, waitAiJob, getAiStatus, getWallet } from '@/lib/webnovel/api';

export function NovelEditor() {
  const [params] = useSearchParams();
  const editSlug = params.get('slug');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [content, setContent] = useState('');
  const [requirement, setRequirement] = useState('');
  const [refineInstruction, setRefineInstruction] = useState('');
  const [aiEnabled, setAiEnabled] = useState(false);
  const [points, setPoints] = useState(0);
  const [jobMsg, setJobMsg] = useState('');
  const [jobError, setJobError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAiStatus().then((s) => setAiEnabled(s.enabled)).catch(() => {});
    getWallet().then((w) => setPoints(w.points)).catch(() => {});
  }, []);

  // 编辑模式：加载现有内容
  useEffect(() => {
    if (!editSlug) { setLoaded(true); return; }
    getNovel(editSlug)
      .then((n) => {
        setTitle(n.title);
        setDescription(n.description || '');
        setTags((n.tags || []).join(','));
        setContent(JSON.stringify(n.content || {}, null, 2));
        setLoaded(true);
      })
      .catch(() => { setJobError('加载失败'); setLoaded(true); });
  }, [editSlug]);

  const save = useCallback(async (status: string) => {
    if (!title.trim()) { setJobError('标题不能为空'); return; }
    setSaving(true);
    setJobError('');
    try {
      let parsed: any;
      try { parsed = JSON.parse(content || '{}'); } catch { throw new Error('内容 JSON 格式错误'); }
      if (editSlug) {
        await updateNovel(editSlug, { title: title.trim(), description: description.trim(), tags: tags.split(',').map(s => s.trim()).filter(Boolean), content: parsed });
        await publishNovel(editSlug, status);
        setJobMsg(status === 'published' ? '已保存并发布' : '已保存（草稿）');
      } else {
        const n = await createNovel({ title: title.trim(), description: description.trim(), tags: tags.split(',').map(s => s.trim()).filter(Boolean), content: parsed, status });
        window.location.href = `/webnovel/editor?slug=${n.slug}`;
      }
    } catch (e) {
      setJobError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  }, [title, description, tags, content, editSlug]);

  const generate = async () => {
    if (!requirement.trim()) { setJobError('请输入创作需求'); return; }
    setBusy(true); setJobMsg(''); setJobError('');
    try {
      const { job_id } = await aiGenerate(requirement.trim());
      setJobMsg('已开始生成，预计 1-3 分钟…');
      const job = await waitAiJob(job_id, (sec) => setJobMsg(`正在生成… ${sec}s`));
      if (job.status === 'done' && job.result) {
        const r = job.result;
        setTitle(r.title || '');
        setDescription(r.description || '');
        setTags(Array.isArray(r.tags) ? r.tags.join(',') : '');
        setContent(JSON.stringify(r.content || {}, null, 2));
        setRequirement('');
        setJobMsg(`生成完成！消耗 ${job.cost} 创作点，余额 ${points - job.cost}。`);
        setPoints((p) => p - job.cost);
      } else {
        setJobError(job.error || '生成失败');
      }
    } catch (e) {
      setJobError(e instanceof Error ? e.message : '生成失败');
    } finally {
      setBusy(false);
    }
  };

  const refine = async () => {
    if (!editSlug || !refineInstruction.trim()) { setJobError('请输入修改指令'); return; }
    setBusy(true); setJobMsg(''); setJobError('');
    try {
      const { job_id } = await aiRefine(editSlug, refineInstruction.trim());
      setJobMsg('正在修改…');
      const job = await waitAiJob(job_id);
      if (job.status === 'done') {
        // 重新加载
        const n = await getNovel(editSlug);
        setTitle(n.title);
        setContent(JSON.stringify(n.content || {}, null, 2));
        setRefineInstruction('');
        setJobMsg(`修改完成！消耗 ${job.cost} 创作点。`);
        setPoints((p) => p - job.cost);
      } else {
        setJobError(job.error || '修改失败');
      }
    } catch (e) {
      setJobError(e instanceof Error ? e.message : '修改失败');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return <div className="mx-auto max-w-3xl px-4 py-12 text-center text-muted-foreground">加载中…</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/webnovel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← 返回列表</Link>
        <span className="text-xs text-muted-foreground">创作点：<span className="font-mono text-foreground">{points}</span></span>
      </div>

      <h1 className="text-xl font-bold">{editSlug ? '编辑作品' : '创作新小说'}</h1>

      {/* AI 创作 */}
      {aiEnabled && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">✨ AI 创作（消耗创作点）</h2>
          <textarea
            value={requirement}
            onChange={(e) => setRequirement(e.target.value)}
            placeholder="描述你的小说：题材、风格、世界观… 例如：赛博朋克末日，主角是失去记忆的义体维修师，在霓虹都市中寻找自己过去，多结局"
            rows={3}
            maxLength={2000}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
          />
          <button
            onClick={generate}
            disabled={busy || !requirement.trim()}
            className="border border-primary bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40"
          >
            {busy ? '生成中…' : 'AI 生成'}
          </button>
        </div>
      )}

      {/* 基本信息 */}
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">基本信息</h2>
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="标题" maxLength={100} className="w-full h-9 px-3 rounded-lg border bg-background text-sm" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="简介" rows={2} maxLength={300} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="标签（逗号分隔）" className="w-full h-9 px-3 rounded-lg border bg-background text-sm" />
      </div>

      {/* 内容 JSON */}
      <div className="border border-border rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">剧情内容（JSON）</h2>
          <span className="text-xs text-muted-foreground">结构：startPage / variables / pages（narrative + choices）</span>
        </div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={18}
          className="w-full px-3 py-2 rounded-lg border bg-background text-sm font-mono resize-y"
          placeholder={`{
  "startPage": "p1",
  "variables": [{ "name": "hp", "initial": 100 }],
  "pages": [{ "id": "p1", "narrative": "…", "choices": [{ "id": "c1", "text": "…", "condition": { "op": "true" }, "actions": [{ "type": "goto", "target": "p2" }] }] }]
}`}
        />
      </div>

      {/* AI 修改 */}
      {aiEnabled && editSlug && (
        <div className="border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">🔧 AI 修改（在现有内容上改）</h2>
          <textarea
            value={refineInstruction}
            onChange={(e) => setRefineInstruction(e.target.value)}
            placeholder="例如：把结局改得更圆满，增加一个隐藏角色，简化第三页的选项"
            rows={2}
            maxLength={1000}
            className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none"
          />
          <button
            onClick={refine}
            disabled={busy || !refineInstruction.trim()}
            className="border border-border rounded-lg px-4 py-2 text-sm hover:border-foreground disabled:opacity-40"
          >
            {busy ? '修改中…' : 'AI 修改'}
          </button>
        </div>
      )}

      {/* 消息 */}
      {jobMsg && <p className="text-sm text-emerald-600 dark:text-emerald-400">{jobMsg}</p>}
      {jobError && <p className="text-sm text-red-500">{jobError}</p>}

      {/* 操作 */}
      <div className="flex gap-3">
        <button onClick={() => save('draft')} disabled={saving} className="border border-border rounded-lg px-4 py-2 text-sm hover:border-foreground disabled:opacity-40">
          {saving ? '保存中…' : '保存草稿'}
        </button>
        <button onClick={() => save('published')} disabled={saving} className="border border-primary bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm hover:opacity-90 disabled:opacity-40">
          {saving ? '保存中…' : '保存并发布'}
        </button>
      </div>
    </div>
  );
}
