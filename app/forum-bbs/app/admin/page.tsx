import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button } from '@/forum-bbs/components/ui/button';
import { Switch } from '@/forum-bbs/components/ui/switch';
import { Checkbox } from '@/forum-bbs/components/ui/checkbox';
import { Skeleton } from '@/forum-bbs/components/ui/skeleton';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import {
  getAdminStats,
  getAdminSettings,
  saveAdminSettings,
  getAdminUsers,
  verifyAdminUser,
  deleteAdminUser,
  updateAdminUser,
  setAdminUserRole,
  setAdminUserBan,
  uploadFile,
  getAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  getArticleNotificationsCount,
  scanAdminStorageGc,
  cleanupAdminStorageGc,
  sendAdminTestEmail,
  getAdminAnnouncements,
  createAdminAnnouncement,
  updateAdminAnnouncement,
  deleteAdminAnnouncement,
  publishAdminAnnouncement,
  getAdminChannelPolicy,
  saveAdminChannelPolicy,
  getAdminStorageUsage,
  getAdminStorageConfig,
  type ChannelPolicy,
  type StorageUsageResult,
  type StorageConfigResult,
} from '@/forum-bbs/lib/forum/api/client';
import { toast } from 'sonner';
import type { AdminStats } from '@/forum-bbs/lib/forum/types';

// ── Settings key → Chinese label mapping ──
const SETTING_LABELS: Record<string, string> = {
  turnstile_enabled: 'Turnstile 验证码',
  session_ttl_days: '登录态过期天数',
  allow_registration: '允许注册',
  notify_on_user_delete: '用户删除通知',
  notify_on_post_delete: '帖子删除通知',
  notify_on_username_change: '用户名变更通知',
  notify_on_avatar_change: '头像变更通知',
  notify_on_manual_verify: '手动验证通知',
  notify_on_new_post: '新帖通知',
  smtp_secret: 'SMTP 密钥',
  admin_emails: '管理员邮箱（逗号分隔，注册该邮箱自动为管理员）',
  qq_bot_api: 'QQ Bot 验证码发送接口',
  email_from: '发件人地址',
};

// ── 防滥用限流：key 与后端 RATE_LIMIT_SETTING_DEFAULTS 一一对应 ──
const RATE_LIMIT_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: 'register_ip_cooldown_seconds', label: '注册冷却（同一 IP）', unit: '秒' },
  { key: 'verify_email_resend_cooldown_seconds', label: '验证邮件重发间隔', unit: '秒' },
  { key: 'forgot_password_cooldown_seconds', label: '找回密码冷却', unit: '秒' },
  { key: 'change_email_cooldown_seconds', label: '更换邮箱冷却', unit: '秒' },
  { key: 'login_fail_max_attempts', label: '登录失败锁定阈值', unit: '次' },
  { key: 'login_fail_window_seconds', label: '登录失败统计窗口', unit: '秒' },
  { key: 'totp_fail_max_attempts', label: 'TOTP 失败锁定阈值', unit: '次' },
  { key: 'totp_fail_window_seconds', label: 'TOTP 失败统计窗口', unit: '秒' },
  { key: 'post_cooldown_seconds', label: '发帖冷却', unit: '秒' },
  { key: 'comment_cooldown_seconds', label: '评论冷却', unit: '秒' },
];

const TEMPLATE_OPTIONS = [
  { value: 'smtp_test', label: 'SMTP 测试邮件' },
  { value: 'reset_password', label: '密码重置邮件' },
  { value: 'change_email_confirm', label: '更换邮箱确认邮件' },
  { value: 'register_verify', label: '注册验证邮件' },
  { value: 'admin_resend_verify', label: '后台重发验证邮件' },
  { value: 'admin_avatar_updated', label: '后台头像更新通知' },
  { value: 'admin_username_updated', label: '后台用户名更新通知' },
  { value: 'admin_manual_verified', label: '后台手动验证通知' },
  { value: 'admin_account_deleted', label: '后台删号通知' },
  { value: 'post_new_comment', label: '帖子新评论提醒' },
  { value: 'comment_new_reply', label: '评论新回复提醒' },
  { value: 'notify_on_new_post', label: '新帖通知管理员' },
];

function S3GcSection() {
  const [scanResult, setScanResult] = useState<{ total: number; orphanCount: number; orphans?: string[] } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  return (
    <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-3">
      <h2 className="font-semibold">S3 存储 GC</h2>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={scanning} onClick={async () => {
          setScanning(true);
          try { setScanResult(await scanAdminStorageGc()); } catch { toast.error('分析失败'); }
          setScanning(false);
        }}>{scanning ? '分析中…' : '扫描分析'}</Button>
        {scanResult && scanResult.orphanCount > 0 && (
          <Button size="sm" variant="outline" className="text-red-500" disabled={cleaning} onClick={async () => {
            if (!confirm(`确定要删除 ${scanResult.orphanCount} 个孤儿文件吗？`)) return;
            setCleaning(true);
            try { await cleanupAdminStorageGc(scanResult.orphans || []); toast.success('清理任务已提交'); setScanResult(null); } catch { toast.error('清理失败'); }
            setCleaning(false);
          }}>{cleaning ? '清理中…' : '清理孤儿文件'}</Button>
        )}
      </div>
      {scanResult && (
        <div className="text-sm text-muted-foreground space-y-1">
          <p>总文件数：{scanResult.total}</p>
          <p>孤儿文件：{scanResult.orphanCount}</p>
          {scanResult.orphans && scanResult.orphans.length > 0 && (
            <>
              <div className="text-xs text-muted-foreground/80 max-h-24 overflow-y-auto">
                {scanResult.orphans.slice(0, 8).map((f) => <div key={f}>{f}</div>)}
                {scanResult.orphans.length > 8 && <div>…还有 {scanResult.orphans.length - 8} 个</div>}
              </div>
              <Button size="sm" variant="outline" className="text-red-500" disabled={cleaning} onClick={async () => {
                if (!confirm(`确定要删除 ${scanResult.orphanCount} 个孤儿文件吗？`)) return;
                setCleaning(true);
                try { await cleanupAdminStorageGc(scanResult.orphans || []); toast.success('清理任务已提交'); setScanResult(null); } catch { toast.error('清理失败'); }
                setCleaning(false);
              }}>{cleaning ? '清理中…' : '清理孤儿文件'}</Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function EmailTestSection() {
  const [email, setEmail] = useState('');
  // 默认只选基础测试项，避免误点一次发 12 封（邮件测试模板当前统一为测试模板）
  const [selected, setSelected] = useState<string[]>(['smtp_test']);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[] | null>(null);

  return (
    <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-3">
      <h2 className="font-semibold">邮件测试</h2>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="收件邮箱" className="w-full h-9 px-3 rounded-lg border bg-background text-sm" />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <Checkbox checked={selected.length === TEMPLATE_OPTIONS.length} onCheckedChange={(c) => setSelected(c ? TEMPLATE_OPTIONS.map((t) => t.value) : [])} />
          全选
        </label>
        {TEMPLATE_OPTIONS.map((t) => (
          <label key={t.value} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={selected.includes(t.value)} onCheckedChange={(c) => setSelected(c ? [...selected, t.value] : selected.filter((x) => x !== t.value))} />
            {t.label}
          </label>
        ))}
      </div>
      <Button size="sm" disabled={sending || !email || selected.length === 0} onClick={async () => {
        setSending(true); setResults(null);
        const allResults: Record<string, unknown>[] = [];
        for (const template of selected) {
          try {
            const r = await sendAdminTestEmail({ to: email, template });
            allResults.push({ template, success: true, ...(Array.isArray(r) ? r[0] : r) });
          } catch (e) {
            allResults.push({ template, success: false, error: e instanceof Error ? e.message : '失败' });
          }
        }
        setResults(allResults);
        toast.success(`已发送 ${allResults.filter((r) => r.success).length}/${selected.length} 封`);
        setSending(false);
      }}>{sending ? '发送中…' : '发送测试邮件'}</Button>
      {results && results.length > 0 && (
        <div className="text-xs text-muted-foreground space-y-1 max-h-32 overflow-y-auto">
          {results.map((r, i) => {
            const opt = TEMPLATE_OPTIONS.find((t) => t.value === r.template);
            return <div key={i}>{opt?.label || String(r.template)}: {r.success ? '✓' : '✗'} {String(r.message || r.error || '')}</div>;
          })}
        </div>
      )}
    </div>
  );
}

// ── 公告管理 ──

interface AdminAnnouncementRow {
  id: number;
  title: string;
  content: string;
  is_published: boolean;
  created_at: string;
}

const POLICY_TYPE_LABELS: Record<string, string> = {
  announcement: '全服公告',
  verify: '账号安全（验证码等）',
  notification: '普通通知（评论/回复/管理）',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: '邮箱',
  qq: 'QQ',
};

function AnnouncementsSection() {
  const [list, setList] = useState<AdminAnnouncementRow[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [publishNow, setPublishNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { setList((await getAdminAnnouncements()) as unknown as AdminAnnouncementRow[]); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-4">
      <h2 className="font-semibold">公告管理</h2>
      <p className="text-xs text-muted-foreground">
        发布公告将按「渠道推送策略」推送给订阅用户（QQ / 邮箱，邮箱兜底）。发布后公告会展示在论坛公告栏。
      </p>
      <div className="space-y-2">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="公告标题" maxLength={100} className="w-full h-9 px-3 rounded-lg border bg-background text-sm" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="公告内容" maxLength={5000} rows={3} className="w-full px-3 py-2 rounded-lg border bg-background text-sm resize-none" />
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <Checkbox checked={publishNow} onCheckedChange={(v) => setPublishNow(!!v)} />
            立即发布并推送
          </label>
          <Button size="sm" disabled={saving || !title.trim() || !content.trim()} onClick={async () => {
            setSaving(true);
            try {
              const r = await createAdminAnnouncement({ title: title.trim(), content: content.trim(), isPublished: publishNow });
              setTitle(''); setContent(''); setPublishNow(false);
              toast.success(publishNow ? '已创建并发布' : '已创建（草稿）');
              if (publishNow && r.id) {
                const p = await publishAdminAnnouncement(String(r.id));
                toast.success(`已推送给 ${p.pushed ?? 0} 位用户`);
              }
              load();
            } catch { toast.error('创建失败'); }
            setSaving(false);
          }}>{saving ? '保存中…' : publishNow ? '创建并发布' : '创建草稿'}</Button>
        </div>
      </div>
      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">暂无公告</p>
        ) : (
          list.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border border-border rounded-lg p-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium truncate">{a.title}</span>
                  {a.is_published
                    ? <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full shrink-0">已发布</span>
                    : <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">草稿</span>}
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{a.content.slice(0, 60)}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!a.is_published && (
                  <Button size="sm" variant="ghost" disabled={publishingId === a.id} onClick={async () => {
                    setPublishingId(a.id);
                    try {
                      const r = await publishAdminAnnouncement(String(a.id));
                      toast.success(`已发布并推送给 ${r.pushed ?? 0} 位用户`);
                      load();
                    } catch { toast.error('发布失败'); }
                    setPublishingId(null);
                  }}>{publishingId === a.id ? '发布中…' : '发布并推送'}</Button>
                )}
                <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                  if (!confirm(`删除公告「${a.title}」？`)) return;
                  try { await deleteAdminAnnouncement(String(a.id)); load(); } catch { toast.error('删除失败'); }
                }}>删除</Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── 渠道推送策略（权限矩阵）──

function ChannelPolicySection() {
  const [policy, setPolicy] = useState<ChannelPolicy | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPolicy(await getAdminChannelPolicy()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-4">
      <h2 className="font-semibold">渠道推送策略</h2>
      <p className="text-xs text-muted-foreground">
        勾选决定每个推送渠道可以推送哪类通知。用户侧只能选择「矩阵允许 ∩ 已绑定」的渠道；邮箱为最终兜底渠道。
      </p>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
      ) : policy ? (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <span>通知类型</span><span className="text-center">邮箱</span><span className="text-center">QQ</span>
            {Object.entries(POLICY_TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="contents">
                <span>{label}</span>
                <span className="text-center">
                  <Checkbox checked={policy.email?.[type as keyof ChannelPolicy['email']] ?? false} onCheckedChange={(v) => setPolicy((p) => p ? { ...p, email: { ...p.email, [type]: !!v } as ChannelPolicy['email'] } : p)} />
                </span>
                <span className="text-center">
                  <Checkbox checked={policy.qq?.[type as keyof ChannelPolicy['qq']] ?? false} onCheckedChange={(v) => setPolicy((p) => p ? { ...p, qq: { ...p.qq, [type]: !!v } as ChannelPolicy['qq'] } : p)} />
                </span>
              </div>
            ))}
          </div>
          <Button size="sm" disabled={saving} onClick={async () => {
            if (!policy) return;
            setSaving(true);
            try { await saveAdminChannelPolicy(policy); toast.success('策略已保存'); } catch { toast.error('保存失败'); }
            setSaving(false);
          }}>{saving ? '保存中…' : '保存策略'}</Button>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">加载失败</p>
      )}
    </div>
  );
}

// ── 存储用量/配置（多桶）──

function formatBytes(n: number): string {
  if (n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[i]}`;
}

function StorageSection() {
  const [usage, setUsage] = useState<StorageUsageResult | null>(null);
  const [config, setConfig] = useState<StorageConfigResult | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, cfg] = await Promise.all([getAdminStorageUsage(), getAdminStorageConfig()]);
      setUsage(u); setConfig(cfg);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const strategyLabel = usage?.strategy === 'round-robin' ? '轮询（round-robin）' : '按用量比例（least-used）';

  return (
    <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-4">
      <h2 className="font-semibold">存储设置（多桶）</h2>
      <p className="text-xs text-muted-foreground">
        当前策略：{strategyLabel}。桶配置来自 Worker 环境变量 <code className="px-1 bg-muted">STORAGE_CONFIG</code>（JSON），
        支持 R2 与第三方 S3 混用；写入时按用量比例/轮询选桶，每桶独立容量上限，超限自动切换。
      </p>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
      ) : (
        <div className="space-y-2">
          {config?.buckets.map((b) => {
            const u = usage?.buckets.find((x) => x.id === b.id);
            const used = u?.usedBytes ?? 0;
            const max = u?.maxBytes ?? b.maxBytes ?? 0;
            const pct = max > 0 ? Math.min(100, (used / max) * 100) : 0;
            return (
              <div key={b.id} className="border border-border rounded-lg p-3 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium font-mono">{b.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.type === 'r2' ? 'bg-blue-500/10 text-blue-500' : 'bg-green-500/10 text-green-600'}`}>
                      {b.type === 'r2' ? 'R2' : 'S3'}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatBytes(used)} / {max > 0 ? formatBytes(max) : '∞'}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-green-500'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground font-mono truncate">
                  {b.type === 'r2'
                    ? `binding: ${b.binding || 'UPLOADS'}`
                    : `endpoint: ${b.endpoint || '-'} · bucket: ${b.bucket || '-'} · region: ${b.region || '-'}`}
                </p>
              </div>
            );
          })}
          {(!config || config.buckets.length === 0) && (
            <p className="text-sm text-muted-foreground text-center py-3">未配置存储桶</p>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>{loading ? '加载中…' : '刷新用量'}</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            配置示例（STORAGE_CONFIG）：
            <code className="px-1 bg-muted break-all">{'{"strategy":"least-used","buckets":[{"type":"r2","binding":"UPLOADS","maxBytes":10737418240}]}'}</code>
          </p>
        </div>
      )}
    </div>
  );
}

export default function ForumAdminPage() {
  const { user, loading: authLoading } = useForumAuth();
  const currentUserId = user?.id;
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [subCount, setSubCount] = useState(0);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [editingCat, setEditingCat] = useState<{ id: number; name: string } | null>(null);
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [userQuery, setUserQuery] = useState('');
  /** 正在编辑的用户（内联展开表单），null 表示没有 */
  const [editingUser, setEditingUser] = useState<{
    id: string;
    username: string;
    avatarUrl: string;
    /** 原值，用来只提交真正改动的字段 */
    origUsername: string;
    origAvatarUrl: string;
  } | null>(null);
  const [savingUser, setSavingUser] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadStats = useCallback(async () => {
    try { setStats(await getAdminStats()); } catch {}
  }, []);
  const loadSettings = useCallback(async () => {
    setSettingsLoading(true);
    try { setSettings(await getAdminSettings()); } catch {}
    setSettingsLoading(false);
  }, []);
  const loadCategories = useCallback(async () => {
    try { setCategories(await getAdminCategories() as { id: number; name: string }[]); } catch {}
  }, []);
  const loadUsers = useCallback(async () => {
    try { setUsers(await getAdminUsers(userQuery)); } catch {}
  }, [userQuery]);

  /**
   * 从本机选图上传到对象存储，拿到 URL 填进头像框。
   *
   * 只填表单不直接落库 —— 上传完先在旁边的缩略图看一眼，再点「保存」，
   * 免得手滑选错文件直接盖掉用户头像。
   *
   * uploadFile 内部会先压到 512px / 0.2MB（后端上限 500KB 且按魔数校验，
   * 只收 JPEG / PNG / GIF），所以这里不用自己压。
   */
  const uploadAvatarFile = useCallback(async (file: File) => {
    if (!editingUser) return;
    setUploadingAvatar(true);
    try {
      const url = await uploadFile(file, 'avatar');
      if (!url) throw new Error('上传接口没有返回地址');
      setEditingUser((prev) => (prev ? { ...prev, avatarUrl: url } : prev));
      toast.success('已上传', { description: '确认预览无误后点「保存」生效。' });
    } catch (e: unknown) {
      toast.error('上传失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    } finally {
      setUploadingAvatar(false);
    }
  }, [editingUser]);

  /**
   * 保存用户资料。**只提交真正改动的字段** —— 后端在改用户名/头像时会按站点设置
   * 给用户发通知邮件（notify_on_username_change / notify_on_avatar_change），
   * 原样回传未改动的字段会平白触发一封「管理员修改了你的头像」。
   */
  const saveUser = useCallback(async () => {
    if (!editingUser) return;
    const payload: Record<string, unknown> = {};
    const username = editingUser.username.trim();
    if (username !== editingUser.origUsername) {
      if (!username) { toast.error('用户名不能为空'); return; }
      if (username.length > 20) { toast.error('用户名最多 20 个字符'); return; }
      payload.username = username;
    }
    if (editingUser.avatarUrl !== editingUser.origAvatarUrl) {
      // 空串是后端约定的「重置为默认头像」，不是「不改」
      payload.avatar_url = editingUser.avatarUrl.trim();
    }
    if (Object.keys(payload).length === 0) {
      setEditingUser(null);
      return;
    }
    setSavingUser(true);
    try {
      await updateAdminUser(editingUser.id, payload);
      toast.success('已保存', {
        description: '改动会立即出现在该用户的所有帖子与评论上。',
      });
      setEditingUser(null);
      loadUsers();
    } catch (e: unknown) {
      toast.error('保存失败', { description: e instanceof Error ? e.message : '请稍后再试' });
    } finally {
      setSavingUser(false);
    }
  }, [editingUser, loadUsers]);

  // 只提交限流字段：整个 settings 一起发会把「站点设置」里编辑到一半的值也带上
  const saveRateLimits = useCallback(async () => {
    const payload: Record<string, unknown> = {};
    for (const f of RATE_LIMIT_FIELDS) {
      const raw = String(settings[f.key] ?? '').trim();
      if (!/^\d+$/.test(raw)) {
        toast.error(`${f.label}：请填写不小于 0 的整数`);
        return;
      }
      payload[f.key] = Number(raw);
    }
    try {
      await saveAdminSettings(payload);
      toast.success('限流设置已保存');
      loadSettings();
    } catch {
      toast.error('保存失败');
    }
  }, [settings, loadSettings]);

  useEffect(() => {
    loadStats();
    loadSettings();
    loadCategories();
    getArticleNotificationsCount().then((r) => setSubCount(r.count)).catch(() => {});
  }, [loadStats, loadSettings, loadCategories]);

  // auth 初始化期间 user 为空：先显示骨架，避免管理员误闪「当前账号不是管理员」
  if (authLoading) {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12">
        <div className="space-y-4">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      </main>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <main className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">管理控制台</h1>
        <p className="text-muted-foreground">当前账号不是管理员</p>
        <Link to="/forum/" className="text-primary hover:underline mt-4 inline-block">返回论坛</Link>
      </main>
    );
  }

  const sortedCats = [...categories].sort((a, b) => a.id - b.id);

  return (
    <main className="container mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link to="/forum/" className="inline-flex items-center gap-2 text-2xl font-bold leading-none">
            <Icon icon="mdi:arrow-left" className="size-6" />
            管理控制台
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={() => { loadStats(); loadSettings(); loadCategories(); }}>刷新数据</Button>
      </div>

      {/* Stats */}
      {/* 连体网格：手机端也是 2 列，竖线在这里是有意义的分栏 */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-t border-l border-border mb-6">
        {[
          { label: '用户总数', value: stats?.users, icon: 'mdi:account-group' },
          { label: '帖子总数', value: stats?.posts, icon: 'mdi:post-outline' },
          { label: '评论总数', value: stats?.comments, icon: 'mdi:comment-outline' },
          { label: '文章订阅用户', value: subCount, icon: 'mdi:email-newsletter' },
        ].map((s) => (
          <div key={s.label} className="border-b border-r border-border p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Icon icon={s.icon} className="size-4" />
              {s.label}
            </div>
            <p className="text-2xl font-bold">{s.value ?? '-'}</p>
          </div>
        ))}
      </div>

      {/* Settings */}
      <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-4">
        <h2 className="font-semibold">站点设置</h2>
        {settingsLoading ? (
          <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8" />)}</div>
        ) : (
          <>
            {Object.entries(settings)
              .filter(([k]) => k in SETTING_LABELS)
              .map(([k, v]) => (
                <div key={k} className="flex items-center justify-between">
                  <span className="text-sm">{SETTING_LABELS[k]}</span>
                  {typeof v === 'boolean' ? (
                    <Switch checked={v as boolean} onCheckedChange={(c) => setSettings((s) => ({ ...s, [k]: c }))} />
                  ) : (
                    <input type="text" value={String(v ?? '')} onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))} className="w-24 h-8 px-2 rounded border bg-background text-xs text-right" />
                  )}
                </div>
              ))}
            <Button size="sm" onClick={async () => {
              try { await saveAdminSettings(settings); toast.success('设置已保存'); } catch { toast.error('保存失败'); }
            }}>保存设置</Button>
          </>
        )}
      </div>

      {/* 防滥用限流 */}
      <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-4">
        <div>
          <h2 className="font-semibold">防滥用限流</h2>
          <p className="text-xs text-muted-foreground mt-1">
            IP 取自 Cloudflare 的 CF-Connecting-IP。任一项填 <code className="px-1 bg-muted">0</code> 即关闭该项限流。
          </p>
        </div>
        {settingsLoading ? (
          <div className="space-y-3">{RATE_LIMIT_FIELDS.map((f) => <Skeleton key={f.key} className="h-8" />)}</div>
        ) : (
          <>
            {RATE_LIMIT_FIELDS.map((f) => (
              <div key={f.key} className="flex items-center justify-between gap-3 flex-wrap">
                <span className="text-sm">{f.label}</span>
                <span className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    value={String(settings[f.key] ?? '')}
                    onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                    className="w-24 h-8 px-2 rounded border bg-background text-xs text-right"
                  />
                  <span className="text-xs text-muted-foreground w-4">{f.unit}</span>
                </span>
              </div>
            ))}
            <Button size="sm" onClick={saveRateLimits}>保存限流设置</Button>
          </>
        )}
      </div>

      {/* 渠道推送策略 */}
      <ChannelPolicySection />

      {/* 公告管理 */}
      <AnnouncementsSection />

      {/* S3 GC */}
      <S3GcSection />

      {/* 存储设置（多桶） */}
      <StorageSection />

      {/* Email Test */}
      <EmailTestSection />

      {/* Categories */}
      <div className="border-y border-border py-5 sm:border sm:p-5 mb-6 space-y-4">
        <h2 className="font-semibold">分类管理</h2>
        <div className="flex gap-2">
          <input type="text" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="新分类名称" className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" />
          <Button size="lg" onClick={async () => {
            if (!newCatName.trim()) return;
            try { await createAdminCategory(newCatName.trim()); setNewCatName(''); loadCategories(); } catch { toast.error('添加失败'); }
          }}>添加</Button>
        </div>
        <div className="space-y-2">
          {sortedCats.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-1">
              {editingCat?.id === c.id ? (
                <div className="flex gap-2 flex-1">
                  <input type="text" value={editingCat.name} onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })} className="flex-1 h-8 px-2 rounded border bg-background text-sm" />
                  <Button variant="ghost" onClick={async () => {
                    try { await updateAdminCategory(String(c.id), editingCat.name); setEditingCat(null); loadCategories(); } catch { toast.error('保存失败'); }
                  }}>保存</Button>
                  <Button variant="ghost" onClick={() => setEditingCat(null)}>取消</Button>
                </div>
              ) : (
                <>
                  <span className="text-sm">{c.name}</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingCat({ id: c.id, name: c.name })}>编辑</Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                      if (!confirm(`删除分类「${c.name}」？`)) return;
                      try { await deleteAdminCategory(String(c.id)); loadCategories(); } catch { toast.error('删除失败'); }
                    }}>删除</Button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Users */}
      <div className="border-y border-border py-5 sm:border sm:p-5 space-y-4">
        <h2 className="font-semibold">用户管理</h2>
        <div className="flex gap-2">
          <input type="text" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="搜索用户名或邮箱" className="flex-1 h-9 px-3 rounded-lg border bg-background text-sm" />
          <Button size="lg" onClick={loadUsers}>搜索</Button>
          {userQuery && <Button size="lg" variant="ghost" onClick={() => { setUserQuery(''); setUsers([]); }}>清空</Button>}
        </div>
        <div className="space-y-2">
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">搜索用户以开始</p>
          ) : (
            users.map((u) => {
              const uid = String(u.id);
              const editing = editingUser?.id === uid;
              return (
              <div key={uid} className="py-2 border-b last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    {String(u.avatar_url ?? '') && <img src={String(u.avatar_url)} alt="" className="h-8 w-8 rounded-full shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{String(u.username ?? '')}</p>
                      <p className="text-xs text-muted-foreground truncate">{String(u.email ?? '')}</p>
                    </div>
                    <span className="text-xs text-muted-foreground font-mono shrink-0">#{uid}</span>
                    {String(u.role) === 'admin' && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full shrink-0">管理员</span>}
                    {String(u.role) === 'bot' && <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">机器人</span>}
                    {String(u.role) === 'verified' && <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full shrink-0">已验证</span>}
                    {u.banned ? <span className="text-xs bg-red-500/10 text-red-500 px-2 py-0.5 rounded-full shrink-0">已封禁</span> : null}
                    {u.verified ? <span className="text-xs text-green-600 shrink-0">邮箱已验证</span> : <span className="text-xs text-amber-600 shrink-0">邮箱未验证</span>}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!u.verified && (
                      <Button size="sm" variant="ghost" onClick={async () => {
                        try { await verifyAdminUser(uid); loadUsers(); toast.success('已通过验证'); } catch { toast.error('操作失败'); }
                      }}>通过验证</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setEditingUser(editing ? null : {
                      id: uid,
                      username: String(u.username ?? ''),
                      avatarUrl: String(u.avatar_url ?? ''),
                      origUsername: String(u.username ?? ''),
                      origAvatarUrl: String(u.avatar_url ?? ''),
                    })}>{editing ? '收起' : '编辑'}</Button>
                    <Button size="sm" variant="ghost" disabled={u.role === 'admin' || String(u.id) === currentUserId} onClick={async () => {
                      const role = window.prompt('设置角色（user / admin / bot / verified）：', String(u.role ?? 'user'));
                      if (!role) return;
                      try { await setAdminUserRole(uid, role); loadUsers(); toast.success('角色已更新'); } catch (e) { toast.error(e instanceof Error ? e.message : '操作失败'); }
                    }}>角色</Button>
                    <Button size="sm" variant="ghost" className={u.banned ? '' : 'text-red-500'} onClick={async () => {
                      if (u.banned) {
                        try { await setAdminUserBan(uid, false); loadUsers(); toast.success('已解封'); } catch { toast.error('操作失败'); }
                      } else {
                        if (!confirm(`封禁用户 ${u.username}？该用户将被踢下线且无法登录。`)) return;
                        try { await setAdminUserBan(uid, true); loadUsers(); toast.success('已封禁'); } catch { toast.error('操作失败'); }
                      }
                    }}>{u.banned ? '解封' : '封禁'}</Button>
                    <Button size="sm" variant="ghost" className="text-red-500" onClick={async () => {
                      if (!confirm(`删除用户 ${u.username}？`)) return;
                      try { await deleteAdminUser(uid); loadUsers(); } catch { toast.error('删除失败'); }
                    }}>删除</Button>
                  </div>
                </div>

                {editing && editingUser && (
                  <div className="mt-3 space-y-3 border border-border bg-muted/30 p-3">
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground" htmlFor={`u-name-${uid}`}>用户名（最多 20 字）</label>
                      <input
                        id={`u-name-${uid}`}
                        type="text"
                        value={editingUser.username}
                        maxLength={20}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        className="w-full h-9 px-3 border bg-background text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-muted-foreground" htmlFor={`u-avatar-${uid}`}>头像（可粘贴地址，也可从本机上传；留空 = 重置为默认头像）</label>
                      <div className="flex items-center gap-2">
                        {editingUser.avatarUrl
                          ? <img src={editingUser.avatarUrl} alt="" className="h-9 w-9 rounded-full shrink-0 border border-border" />
                          : <span className="h-9 w-9 shrink-0 border border-dashed border-border" />}
                        <input
                          id={`u-avatar-${uid}`}
                          type="text"
                          value={editingUser.avatarUrl}
                          onChange={(e) => setEditingUser({ ...editingUser, avatarUrl: e.target.value })}
                          placeholder="https://… 或留空重置"
                          className="flex-1 min-w-0 h-9 px-3 border bg-background text-sm font-mono"
                        />
                        <Button size="sm" variant="ghost" className="shrink-0" onClick={() => setEditingUser({ ...editingUser, avatarUrl: '' })}>清空</Button>
                      </div>
                      {/* 上传：input[type=file] 藏在 label 里，外观与其他按钮一致 */}
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <label
                          className={`inline-flex h-8 cursor-pointer items-center gap-1.5 border border-input bg-transparent px-3 font-mono text-sm transition-colors hover:bg-accent ${uploadingAvatar ? 'pointer-events-none opacity-50' : ''}`}
                        >
                          <Icon icon={uploadingAvatar ? 'mdi:progress-upload' : 'mdi:upload'} className="size-4" />
                          {uploadingAvatar ? '上传中…' : '从本机上传'}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/gif"
                            className="hidden"
                            disabled={uploadingAvatar}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              // 先清空 value，否则连续选同一个文件不会再触发 change
                              e.target.value = '';
                              if (f) uploadAvatarFile(f);
                            }}
                          />
                        </label>
                        <span className="text-xs text-muted-foreground">
                          支持 PNG / JPEG / GIF，自动压到 512px 以内
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={saveUser} disabled={savingUser}>{savingUser ? '保存中…' : '保存'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingUser(null)}>取消</Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      只提交实际改动的字段 —— 站点设置里若开了「改名/改头像通知」，未改动的字段不会白发一封邮件。
                    </p>
                  </div>
                )}
              </div>
            );})
          )}
        </div>
      </div>
    </main>
  );
}
