import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router';
import { Input } from '@/forum-bbs/components/ui/input';
import { Textarea } from '@/forum-bbs/components/ui/textarea';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button } from '@/forum-bbs/components/ui/button';
import { Skeleton } from '@/forum-bbs/components/ui/skeleton';
import { Switch } from '@/forum-bbs/components/ui/switch';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/forum-bbs/components/ui/dropdown-menu';
import { TotpModal } from '@/forum-bbs/components/totp-modal';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import {
  getCurrentUser, isTotpError, totpErrorText,
  updateProfile,
  updateMyProfile,
  uploadFile,
  changeEmail,
  setupTotp,
  verifyTotp,
  disableTotp,
  unlinkGithub,
  deleteAccount,
  startGithubOAuth,
  getMySessions,
  revokeSession,
  revokeOtherSessions,
  sendQQBindCode,
  bindQQ,
  sendQQUnbindCode,
  unbindQQ,
  getNotifyPrefs,
  updateNotifyPrefs,
  type NotifyPrefs,
  type ForumSession,
} from '@/forum-bbs/lib/forum/api/client';
import { parseUserAgent, formatRelativeTime, formatLocation } from '@/forum-bbs/lib/forum/parse-user-agent';
import { toast } from 'sonner';
import type { ForumUser } from '@/forum-bbs/lib/forum/types';
import { absUrl, withBase } from '@/forum-bbs/lib/base-path';

/** 本地生成 TOTP 二维码——密钥不出浏览器，避免经第三方二维码服务泄露 */
function TotpQrCode({ uri }: { uri: string }) {
  const [dataUrl, setDataUrl] = useState('');
  useEffect(() => {
    let cancelled = false;
    import('qrcode').then((m) =>
      (m.default ?? m).toDataURL(uri, { width: 200, margin: 1 }),
    ).then((url) => { if (!cancelled) setDataUrl(url); }).catch(() => {});
    return () => { cancelled = true; };
  }, [uri]);
  if (!dataUrl) return <Skeleton className="w-40 h-40 mx-auto" />;
  return <img src={dataUrl} alt="TOTP QR" className="w-40 h-40 mx-auto" />;
}

function MeContent() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading, logout, setUser } = useForumAuth();

  // Local copy of user data (refreshed by this page's own API call)
  const [localUser, setLocalUser] = useState<ForumUser | null>(null);

  // ── Profile fields ──
  const [avatarUrl, setAvatarUrl] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [region, setRegion] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [articleNotifications, setArticleNotifications] = useState(true);
  // ── QQ 绑定 ──
  const [qqInput, setQqInput] = useState('');
  const [boundQq, setBoundQq] = useState('');
  const [qqCode, setQqCode] = useState('');
  const [qqSending, setQqSending] = useState(false);
  const [qqSent, setQqSent] = useState(false);
  const [qqCountdown, setQqCountdown] = useState(0);
  const [qqMsg, setQqMsg] = useState('');
  const [unbinding, setUnbinding] = useState(false);
  // ── 通知偏好 ──
  const [notifyPrefs, setNotifyPrefs] = useState<NotifyPrefs | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsMsg, setPrefsMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Email change ──
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');

  // ── TOTP ──
  const [totpSecret, setTotpSecret] = useState('');
  const [totpQrUrl, setTotpQrUrl] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [settingTotp, setSettingTotp] = useState(false);
  const [totpMsg, setTotpMsg] = useState('');
  // Disable TOTP
  const [disablePass, setDisablePass] = useState('');
  const [disabling, setDisabling] = useState(false);

  // ── Danger ──
  const [delPass, setDelPass] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  // ── TOTP modal ──
  const [totpModalOpen, setTotpModalOpen] = useState(false);
  const totpActionRef = useRef<{ run: (code: string) => Promise<void> } | null>(null);

  // ── 登录设备 ──
  const [sessions, setSessions] = useState<ForumSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [revokingJti, setRevokingJti] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      setSessions(await getMySessions());
    } catch {
      // 静默：设备列表拉不到不该挡住整个个人中心
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  // Redirect if not logged in (only after auth finishes loading)
  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate('/forum/auth/login?redirect=/me');
  }, [authLoading, user, navigate]);

  // 登录设备列表：登录态确定后拉一次
  useEffect(() => {
    if (!user) return;
    loadSessions();
  }, [user, loadSessions]);

  // Load real data from API
  useEffect(() => {
    if (!user) return;
    setLoadingProfile(true);
    getCurrentUser()
      .then((u) => {
        setLocalUser(u);
        setAvatarUrl(u.avatarUrl || '');
        setUsername(u.username || '');
        setBio(u.bio || '');
        setGender(u.gender || '');
        setAge(u.age ? String(u.age) : '');
        setRegion(u.region || '');
        setEmailNotifications(u.emailNotifications ?? true);
        setArticleNotifications(u.articleNotifications ?? true);
        setBoundQq(u.qq || '');
        setNewEmail(u.email || '');
      })
      .catch(() => {
        // Fallback to auth context
        setLocalUser(user);
        setAvatarUrl(user.avatarUrl || '');
        setUsername(user.username || '');
        setBio(user.bio || '');
        setGender(user.gender || '');
        setAge(user.age ? String(user.age) : '');
        setRegion(user.region || '');
        setEmailNotifications(user.emailNotifications ?? true);
        setArticleNotifications(user.articleNotifications ?? true);
        setBoundQq(user.qq || '');
        setNewEmail(user.email || '');
      })
      .finally(() => setLoadingProfile(false));
  }, [user]);

  // Load notification preferences
  useEffect(() => {
    if (!user) return;
    setPrefsLoading(true);
    getNotifyPrefs()
      .then((p) => setNotifyPrefs(p))
      .catch(() => {})
      .finally(() => setPrefsLoading(false));
  }, [user]);

  // Handle URL params (email change confirmation, GitHub callback)
  useEffect(() => {
    // B-5：区分 ok / failed / conflict，不再一律提示成功
    const emailToken = searchParams.get('email_change_token');
    if (emailToken) {
      if (emailToken === 'ok') setEmailMsg('邮箱变更成功，请使用新邮箱登录');
      else if (emailToken === 'conflict') setEmailMsg('新邮箱已被其他账号占用，变更失败');
      else setEmailMsg('邮箱变更链接无效或已过期');
      const p = new URLSearchParams(searchParams.toString());
      p.delete('email_change_token');
      navigate(`/me${p.toString() ? "?" + p.toString() : ""}`, { replace: true });
    }
    const githubError = searchParams.get('github_error');
    if (githubError) setSaveMsg(`GitHub 绑定失败: ${githubError}`);
    // GitHub 绑定成功（#github_bound=1）：重拉用户数据并提示（ISSUES #53）
    const bound = searchParams.get('github_bound');
    if (bound) {
      setSaveMsg('GitHub 已绑定');
      getCurrentUser().then((u) => { setUser(u); setLocalUser(u); }).catch(() => {});
      const p = new URLSearchParams(searchParams.toString());
      p.delete('github_bound');
      navigate(`/me${p.toString() ? "?" + p.toString() : ""}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // 不能 return null：SSR 与水合前 user 一定为空，无 JS 访客会看到整页空白、
  // 连登录入口都没有（AGENTS.md「登录态未定时渲染『未登录』而不是 null」）。
  if (!user) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8 text-center">
        <h1 className="text-xl font-bold mb-4">个人中心</h1>
        <p className="text-muted-foreground mb-4">请先登录后查看个人中心</p>
        <Link to="/forum/auth/login?redirect=/me"><Button>去登录</Button></Link>
      </main>
    );
  }

  if (loadingProfile) {
    return (
      <main className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="size-5 shrink-0" />
          <Skeleton className="h-7 w-32" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border p-5 space-y-4">
            {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border p-5 space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9" />
                <Skeleton className="h-9" />
              </div>
            ))}
          </div>
        </div>
      </main>
    );
  }

  // ── Handlers ──

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadFile(file, 'avatar');
      setAvatarUrl(url);
      // B-17：文案含"成功"才走绿色样式，统一改为「上传成功」
      setSaveMsg('头像上传成功，请点击保存资料');
    } catch {
      setSaveMsg('头像上传失败');
    }
  };

  const saveProfile = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      await updateProfile({
        username: username.trim(),
        avatarUrl: avatarUrl || '',
        emailNotifications,
        articleNotifications,
      });
      await updateMyProfile({
        gender: gender || null,
        bio: bio || null,
        age: age ? parseInt(age) : null,
        region: region || null,
      });
      setSaveMsg('保存成功');
    } catch (e: unknown) {
      setSaveMsg(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleChangeEmail = async (totpCodeArg?: string) => {
    if (!newEmail.trim()) return;
    setChangingEmail(true);
    setEmailMsg('');
    try {
      const r = await changeEmail({ newEmail: newEmail.trim(), totpCode: totpCodeArg });
      setEmailMsg(r.message || '确认邮件已发送，请前往新邮箱查收');
    } catch (e: unknown) {
      if (isTotpError(e)) {
        totpActionRef.current = { run: async (code: string) => { await handleChangeEmail(code); } };
        setTotpModalOpen(true);
        return;
      }
      setEmailMsg(e instanceof Error ? e.message : '发送失败');
    } finally {
      setChangingEmail(false);
    }
  };

  const startTotpSetup = async () => {
    setSettingTotp(true);
    setTotpMsg('');
    try {
      const r = await setupTotp();
      setTotpSecret(r.secret);
      setTotpQrUrl(r.uri || r.otpauth_url || '');
      setTotpMsg('请使用身份验证器扫描下方二维码');
    } catch (e: unknown) {
      setTotpMsg(e instanceof Error ? e.message : '获取失败');
    } finally {
      setSettingTotp(false);
    }
  };

  const confirmTotp = async () => {
    if (!totpCode.trim()) return;
    setSettingTotp(true);
    try {
      await verifyTotp({ token: totpCode.trim() });
      setTotpSecret('');
      setTotpQrUrl('');
      setTotpCode('');
      setTotpMsg('2FA 已启用');
      // Reload user data
      try { const u = await getCurrentUser(); if (u) { setUser(u); setLocalUser(u); } } catch {}
    } catch (e: unknown) {
      setTotpMsg(e instanceof Error ? e.message : '验证失败');
    } finally {
      setSettingTotp(false);
    }
  };

  const submitDisableTotp = async (totpCodeArg?: string) => {
    if (!disablePass) { setTotpMsg('请输入密码'); return; }
    setDisabling(true);
    try {
      await disableTotp({ password: disablePass, totpCode: totpCodeArg || '' });
      setDisablePass('');
      setTotpMsg('2FA 已关闭');
      try { const u = await getCurrentUser(); if (u) { setUser(u); setLocalUser(u); } } catch {}
    } catch (e: unknown) {
      if (isTotpError(e)) {
        totpActionRef.current = { run: async (code: string) => { await submitDisableTotp(code); } };
        setTotpModalOpen(true);
        return;
      }
      setTotpMsg(e instanceof Error ? e.message : '关闭失败');
    } finally {
      setDisabling(false);
    }
  };

  const executeDelete = async (totpCodeArg?: string) => {
    if (!delPass) { setTotpMsg('请输入密码'); return; }
    setDeleting(true);
    try {
      await deleteAccount({ password: delPass, totpCode: totpCodeArg });
      localStorage.removeItem('forum-auth-token');
      window.location.href = withBase('/');
    } catch (e: unknown) {
      if (isTotpError(e)) {
        totpActionRef.current = { run: async (code: string) => { await executeDelete(code); } };
        setTotpModalOpen(true);
        return;
      }
      setTotpMsg(e instanceof Error ? e.message : '注销失败');
      setDeleting(false);
    }
  };

  const genderOptions = [
    { value: '', label: '不设置' },
    { value: 'male', label: '男' },
    { value: 'female', label: '女' },
    { value: 'other', label: '其他' },
    { value: 'prefer_not_to_say', label: '不方便透露' },
  ];

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <Link to="/forum/" className="inline-flex items-center gap-2 text-2xl font-bold leading-none">
          <Icon icon="mdi:arrow-left" className="size-6" />
          个人中心
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        {/* ── Basic Profile ── */}
        <div className="border-y border-border py-5 sm:border sm:p-5 space-y-4">
          <h2 className="font-semibold text-lg">基础资料</h2>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">头像</label>
            <div className="flex items-center gap-3">
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
              ) : (
                <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                  <Icon icon="mdi:account" className="size-7 text-muted-foreground" />
                </div>
              )}
              <div className="flex flex-col gap-1">
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleAvatarUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>上传图片</Button>
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">用户名</label>
            <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={20} />
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">个签</label>
            <Textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={2} className="resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-muted-foreground block mb-1">性别</label>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center justify-between gap-1 w-full h-9 rounded-lg border border-input bg-transparent px-3 text-sm text-left">
                  {genderOptions.find((o) => o.value === gender)?.label || '选择性别'}
                  <Icon icon="mdi:chevron-down" className="size-4 text-muted-foreground shrink-0" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-full min-w-[140px]">
                  {genderOptions.map((o) => <DropdownMenuItem key={o.value} onClick={() => setGender(o.value)}>{o.label}</DropdownMenuItem>)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <label className="text-sm text-muted-foreground block mb-1">出生年</label>
              {/* B-26：年份上限动态取当前年份 */}
              <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} min={1900} max={new Date().getFullYear()} placeholder="2000" />
            </div>
          </div>

          <div>
            <label className="text-sm text-muted-foreground block mb-1">地区</label>
            <Input type="text" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={100} placeholder="中国·上海" />
          </div>

          {/* ── QQ 绑定 / 解绑 ── */}
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground block">QQ 通知推送</label>
            {boundQq ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">已绑定：</span>
                  <span className="font-mono">{boundQq.slice(0, 3)}****{boundQq.slice(-3)}</span>
                </div>
                {unbinding ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">验证码已发送到你绑定的 QQ，请输入验证码确认解绑</p>
                    <div className="flex gap-2">
                      <Input type="text" value={qqCode} onChange={(e) => setQqCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} placeholder="6 位验证码" className="flex-1" />
                      <Button variant="outline" size="sm" disabled={qqCode.length !== 6 || qqSending} onClick={async () => { setQqSending(true); setQqMsg(''); try { await unbindQQ(qqCode); setBoundQq(''); setQqInput(''); setQqCode(''); setUnbinding(false); setQqMsg('已解绑'); } catch (e: unknown) { setQqMsg(e instanceof Error ? e.message : '解绑失败'); } finally { setQqSending(false); } }}>{qqSending ? '解绑中…' : '确认解绑'}</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" disabled={qqSending} onClick={async () => { setQqSending(true); setQqMsg(''); setQqCode(''); try { await sendQQUnbindCode(); setUnbinding(true); } catch (e: unknown) { setQqMsg(e instanceof Error ? e.message : '发送失败'); } finally { setQqSending(false); } }}>{qqSending ? '发送中…' : '解绑'}</Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input type="text" value={qqInput} onChange={(e) => setQqInput(e.target.value.replace(/\D/g, '').slice(0, 11))} maxLength={11} placeholder="输入 QQ 号" disabled={qqSent} className="flex-1" />
                  <Button variant="outline" size="sm" disabled={!qqInput || qqInput.length < 5 || qqSending || qqCountdown > 0} onClick={async () => { setQqSending(true); setQqMsg(''); try { await sendQQBindCode(qqInput); setQqSent(true); let n = 60; setQqCountdown(n); const iv = setInterval(() => { n--; setQqCountdown(n); if (n <= 0) clearInterval(iv); }, 1000); } catch (e: unknown) { setQqMsg(e instanceof Error ? e.message : '发送失败'); } finally { setQqSending(false); } }}>{qqSending ? '发送中…' : qqCountdown > 0 ? `${qqCountdown}s` : '发送验证码'}</Button>
                </div>
                {qqSent && (
                  <div className="flex gap-2">
                    <Input type="text" value={qqCode} onChange={(e) => setQqCode(e.target.value.replace(/\D/g, '').slice(0, 6))} maxLength={6} placeholder="6 位验证码" className="flex-1" />
                    <Button variant="default" size="sm" disabled={qqCode.length !== 6 || qqSending} onClick={async () => { setQqSending(true); setQqMsg(''); try { const r = await bindQQ(qqInput, qqCode); setBoundQq(r.qq); setQqInput(''); setQqCode(''); setQqSent(false); setQqMsg('绑定成功'); } catch (e: unknown) { setQqMsg(e instanceof Error ? e.message : '验证失败'); } finally { setQqSending(false); } }}>{qqSending ? '验证中…' : '验证并绑定'}</Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">请先<a href="https://qm.qq.com/q/Q9qngmVUgG" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">添加 Bot 为好友</a>，否则无法收到验证码</p>
              </div>
            )}
            {qqMsg && <p className={`text-xs ${qqMsg.includes('成功') || qqMsg.includes('已解绑') ? 'text-green-600' : 'text-destructive'}`}>{qqMsg}</p>}
          </div>

          {/* ── 通知偏好 ── */}
          {!prefsLoading && notifyPrefs && (
            <details className="space-y-2">
              <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground select-none">通知偏好</summary>
              <div className="mt-2 space-y-1.5">
                <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span></span><span className="text-center">邮件</span><span className="text-center">QQ</span>
                  {([
                    ['comment', '帖子评论'],
                    ['reply', '评论回复'],
                    ['admin_action', '管理操作'],
                    ['post_deleted', '帖子被删'],
                    ['lora', 'Lora 审批'],
                    ['recommendation', '自荐审核'],
                    ['article_update', '博客更新'],
                  ] as const).map(([key, label]) => (
                    <div key={key} className="contents">
                      <span>{label}</span>
                      <Switch checked={(notifyPrefs as any)[key]?.email ?? true} onCheckedChange={async (v) => { const next = { ...notifyPrefs, [key]: { ...(notifyPrefs as any)[key], email: v } }; setNotifyPrefs(next); setPrefsMsg(''); try { await updateNotifyPrefs({ [key]: { email: v } } as any); setPrefsMsg('已保存'); } catch { setPrefsMsg('保存失败'); } }} size="sm" />
                      <Switch checked={(notifyPrefs as any)[key]?.qq ?? true} onCheckedChange={async (v) => { const next = { ...notifyPrefs, [key]: { ...(notifyPrefs as any)[key], qq: v } }; setNotifyPrefs(next); setPrefsMsg(''); try { await updateNotifyPrefs({ [key]: { qq: v } } as any); setPrefsMsg('已保存'); } catch { setPrefsMsg('保存失败'); } }} size="sm" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1">QQ 通知需要先绑定 QQ 号并添加 Bot 好友才能收到</p>
                {prefsMsg && <p className={`text-xs ${prefsMsg === '已保存' ? 'text-green-600' : 'text-destructive'}`}>{prefsMsg}</p>}
              </div>
            </details>
          )}

          <Button onClick={saveProfile} disabled={saving} className="w-full">
            {saving ? '保存中…' : '保存资料'}
          </Button>
          {saveMsg && <p className={`text-xs ${saveMsg.includes('成功') ? 'text-green-600' : 'text-destructive'}`}>{saveMsg}</p>}
        </div>

        {/* ── Right column ── */}
        <div className="space-y-6">

          {/* Email Change */}
          <div className="border-y border-border py-5 sm:border sm:p-5 space-y-3">
            <h2 className="font-semibold">邮箱变更</h2>
            <p className="text-xs text-muted-foreground">修改后需要前往新邮箱确认</p>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="新邮箱地址" />
            <Button onClick={() => handleChangeEmail()} disabled={changingEmail} size="sm">{changingEmail ? '发送中…' : '发送确认邮件'}</Button>
            {emailMsg && <p className="text-xs text-muted-foreground">{emailMsg}</p>}
          </div>

          {/* TOTP */}
          <div className="border-y border-border py-5 sm:border sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">双重验证 (TOTP)</h2>
              {user.totpEnabled && <span className="text-xs text-green-600 dark:text-green-400">✓ 已启用</span>}
            </div>

            {user.totpEnabled ? (
              <>
                {totpSecret && <p className="text-xs text-muted-foreground">{totpMsg}</p>}
                <Input type="password" value={disablePass} onChange={(e) => setDisablePass(e.target.value)} placeholder="当前密码" />
                <Button onClick={() => submitDisableTotp()} disabled={disabling || !disablePass} variant="outline" size="sm" className="text-red-600">{disabling ? '关闭中…' : '关闭 2FA'}</Button>
                {totpMsg && <p className="text-xs text-muted-foreground">{totpMsg}</p>}
              </>
            ) : totpSecret ? (
              <>
                <p className="text-xs text-muted-foreground">{totpMsg}</p>
                {totpQrUrl && <TotpQrCode uri={totpQrUrl} />}
                <p className="text-xs font-mono break-all bg-muted p-2 rounded">{totpSecret}</p>
                <Input type="text" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="输入 6 位验证码" inputMode="numeric" />
                <Button onClick={confirmTotp} disabled={settingTotp || totpCode.length !== 6} size="sm">验证并启用</Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">未启用双重验证</p>
                <Button onClick={startTotpSetup} disabled={settingTotp} size="sm">{settingTotp ? '获取中…' : '开始启用 2FA'}</Button>
                {totpMsg && <p className="text-xs text-muted-foreground">{totpMsg}</p>}
              </>
            )}
          </div>

          {/* GitHub */}
          <div className="border-y border-border py-5 sm:border sm:p-5 space-y-3">
            <h2 className="font-semibold">GitHub 账号</h2>
            {(localUser ?? user)?.githubId ? (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  {user.githubAvatarUrl && <img src={user.githubAvatarUrl} alt="" className="h-6 w-6 rounded-full shrink-0" />}
                  <span className="truncate max-w-[12rem]">@{(localUser ?? user)?.githubLogin || '已绑定'}</span>
                  <span className="text-xs text-green-600 shrink-0">✓ 已绑定</span>
                </div>
                {user.hasPassword === false && (
                  <p className="text-xs text-amber-600">未设置密码，解绑后将无法登录</p>
                )}
                <Button variant="outline" size="sm" onClick={async () => {
                  if (!confirm('确定要解绑 GitHub 吗？')) return;
                  try { await unlinkGithub(); setSaveMsg('已解绑'); } catch (e: unknown) { setSaveMsg(e instanceof Error ? e.message : '解绑失败'); }
                }} disabled={user.hasPassword === false}>解绑 GitHub</Button>
              </>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">绑定后可快速登录</p>
                <Button variant="outline" size="sm" onClick={async () => {
                  try {
                    const r = await startGithubOAuth('link', absUrl('/me'));
                    window.location.assign(r.authorize_url);
                  } catch {}
                }}>绑定 GitHub</Button>
              </>
            )}
          </div>

        </div>
      </div>

      {/* ── 登录设备 ── */}
      <div className="border-y border-border py-5 sm:border sm:p-5 mt-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">登录设备</h2>
            <p className="text-xs text-muted-foreground">
              这些设备当前可以用你的账号登录。看到不认识的，直接吊销。
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={loadSessions} disabled={sessionsLoading}>
              {sessionsLoading ? '加载中…' : '刷新'}
            </Button>
            {sessions.filter((s) => !s.current).length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600"
                disabled={revokingAll}
                onClick={async () => {
                  if (!confirm('将退出除本机以外的所有设备，确定吗？')) return;
                  setRevokingAll(true);
                  try {
                    const r = await revokeOtherSessions();
                    toast.success('已吊销', { description: `${r.revoked} 台设备已退出登录。` });
                    loadSessions();
                  } catch (e: unknown) {
                    toast.error('操作失败', { description: e instanceof Error ? e.message : '请稍后再试' });
                  } finally {
                    setRevokingAll(false);
                  }
                }}
              >
                {revokingAll ? '吊销中…' : '退出其他设备'}
              </Button>
            )}
          </div>
        </div>

        {sessionsLoading && sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">正在读取…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2">没有读到会话记录。</p>
        ) : (
          <ul className="divide-y">
            {sessions.map((s) => {
              const ua = parseUserAgent(s.user_agent);
              return (
                <li key={s.jti} className="flex flex-wrap items-center gap-3 py-3">
                  <Icon icon={ua.icon} className="size-6 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{ua.label}</span>
                      {s.current && (
                        <span className="shrink-0 border border-foreground/70 px-1 py-px font-mono text-[10px] leading-none">
                          本机
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      最后活跃 {formatRelativeTime(s.last_seen_at)}
                      {formatLocation(s.country, s.city) ? ` · ${formatLocation(s.country, s.city)}` : ''}
                      {s.ip ? ` · ${s.ip}` : ''}
                    </p>
                  </div>
                  {/* 本机不给「吊销」——那等同于退出登录，页面下方已有专门入口，
                      放这里容易让人误以为只是清掉一条记录 */}
                  {!s.current && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 shrink-0"
                      disabled={revokingJti === s.jti}
                      onClick={async () => {
                        setRevokingJti(s.jti);
                        try {
                          await revokeSession(s.jti);
                          toast.success('已吊销该设备');
                          loadSessions();
                        } catch (e: unknown) {
                          toast.error('吊销失败', { description: e instanceof Error ? e.message : '请稍后再试' });
                        } finally {
                          setRevokingJti(null);
                        }
                      }}
                    >
                      {revokingJti === s.jti ? '吊销中…' : '吊销'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ── Danger Zone ── */}
      <div className="border-y border-red-200 dark:border-red-900/50 py-5 sm:border sm:p-5 mt-6 space-y-3">
        <h2 className="font-semibold text-red-600 dark:text-red-400">危险区域</h2>
        <p className="text-xs text-muted-foreground">注销账号后所有数据将被清除，此操作不可撤销。</p>

        {!confirmDelete ? (
          <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => setConfirmDelete(true)}>
            注销账号
          </Button>
        ) : (
          <div className="space-y-2 border border-red-200 dark:border-red-900/50 rounded-lg p-3">
            <p className="text-xs font-medium text-red-600">确定要注销账号吗？此操作无法撤销。</p>
            <Input type="password" value={delPass} onChange={(e) => setDelPass(e.target.value)} placeholder="当前密码" />
            <div className="flex gap-2">
              <Button onClick={() => executeDelete()} disabled={deleting || !delPass} size="sm" variant="outline" className="text-red-600 border-red-300">
                {deleting ? '注销中…' : '确认注销'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { setConfirmDelete(false); setDelPass(''); }}>取消</Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Logout ── */}
      <div className="flex justify-center mt-6">
        <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => {
          // 不 await：logout 同步清本地态后台吊销会话；先等待会让本页「未登录跳登录页」的 effect 抢先触发
          logout();
          navigate('/forum/');
        }}>退出登录</Button>
      </div>

      <TotpModal
        open={totpModalOpen}
        onClose={() => { setTotpModalOpen(false); totpActionRef.current = null; }}
        onSubmit={async (code) => { await totpActionRef.current?.run(code); }}
      />
    </main>
  );
}

/** 不包 Suspense：流式 SSR 会把边界内容甩进 `<div hidden>`，靠内联脚本搬回，禁用 JS 即空白 */
export default function ForumMePage() {
  return <MeContent />;
}
