import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Turnstile } from '@marsidev/react-turnstile';
import { toast } from 'sonner';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button } from '@/forum-bbs/components/ui/button';
import { Label } from '@/forum-bbs/components/ui/label';
import { Input } from '@/forum-bbs/components/ui/input';
import { Alert } from '@/forum-bbs/components/ui/alert';
import { resetPassword, getForumConfig, isTotpError } from '@/forum-bbs/lib/forum/api/client';
import { withBase } from '@/forum-bbs/lib/base-path';
import { Spinner } from '@/forum-bbs/components/ui/spinner';

export default function ForumResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken) setToken(urlToken);

    getForumConfig()
      .then((config) => {
        setTurnstileEnabled(!!config.turnstileEnabled);
        setTurnstileSiteKey(config.turnstileSiteKey || '');
      })
      .catch(() => setTurnstileEnabled(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
    if (loading) return;

    if (turnstileEnabled && !turnstileToken) {
      toast.error('重置密码', { description: '验证码尚未加载完成或已过期，请稍后重试。' });
      return;
    }
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      toast.error('重置密码', { description: '缺少重置 token。' });
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 16) {
      toast.error('重置密码', { description: '新密码长度需为 8-16 个字符。' });
      return;
    }
    setLoading(true);
    try {
      await resetPassword({
        token: trimmedToken,
        newPassword,
        totpCode: totpCode.trim() || undefined,
        turnstileToken: turnstileToken || undefined,
      });
      toast.success('重置密码', { description: '密码已重置，正在前往登录页...' });
      window.location.href = withBase('/auth/login');
    } catch (error) {
      if (isTotpError(error)) {
        toast.error('重置密码', { description: '该账号已开启二步验证，请填写 TOTP 验证码后重试。' });
        return;
      }
      toast.error('重置密码', { description: error instanceof Error ? error.message : '重置失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      {/* 去卡片，与 /forum/auth/login、/register 的裸表单保持一致 */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold mb-6">
          <Icon icon="mdi:key-variant" className="size-6 text-primary" />
          重置密码
        </h1>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            从邮件中复制 token 粘贴到下方，并设置新密码。如果通过邮件链接进入，token 已自动填入。
          </p>

          <div className="space-y-2">
            <Label htmlFor="token">重置 token</Label>
            <Input
              id="token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="粘贴邮件中的 token"
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-password">新密码（8-16 个字符）</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="输入新密码"
              autoComplete="new-password"
              minLength={8}
              maxLength={16}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="totp">TOTP 验证码（如需要）</Label>
            <Input
              id="totp"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value)}
              placeholder="账号开启 2FA 时填写"
              autoComplete="one-time-code"
              inputMode="numeric"
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>

          {turnstileEnabled && turnstileSiteKey && (
            <div className="flex justify-center">
              <Turnstile
                siteKey={turnstileSiteKey}
                onSuccess={(token) => setTurnstileToken(token)}
                onExpire={() => setTurnstileToken('')}
              />
            </div>
          )}

          {turnstileEnabled && !turnstileSiteKey && (
            <Alert variant="warning">
              <Icon icon="mdi:shield-off-outline" className="size-4 inline mr-1" />
              论坛已启用 Turnstile 但未配置站点密钥，请联系管理员。
            </Alert>
          )}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button onClick={submit} disabled={loading}>
              {loading ? (
                <Spinner className="size-4" />
              ) : (
                <Icon icon="mdi:check" className="size-4" />
              )}
              重置密码
            </Button>
            <Link to="/auth/login" className="text-sm text-primary underline decoration-dashed underline-offset-4">
              返回登录
            </Link>
            <Link to="/auth/forgot-password" className="text-sm text-primary underline decoration-dashed underline-offset-4">
              重新申请邮件
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
