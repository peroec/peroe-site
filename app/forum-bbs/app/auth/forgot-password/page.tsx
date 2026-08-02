import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { toast } from 'sonner';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button } from '@/forum-bbs/components/ui/button';
import { Label } from '@/forum-bbs/components/ui/label';
import { Input } from '@/forum-bbs/components/ui/input';
import { Alert } from '@/forum-bbs/components/ui/alert';
import { forgotPassword, getForumConfig } from '@/forum-bbs/lib/forum/api/client';
import { Spinner } from '@/forum-bbs/components/ui/spinner';

export default function ForumForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [turnstileEnabled, setTurnstileEnabled] = useState(false);
  const [turnstileSiteKey, setTurnstileSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');

  useEffect(() => {
    getForumConfig()
      .then((config) => {
        setTurnstileEnabled(!!config.turnstileEnabled);
        setTurnstileSiteKey(config.turnstileSiteKey || '');
      })
      .catch(() => setTurnstileEnabled(false));
  }, []);

  async function submit() {
    if (loading) return;

    if (turnstileEnabled && !turnstileToken) {
      toast.error('找回密码', { description: '验证码尚未加载完成或已过期，请稍后重试。' });
      return;
    }
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('找回密码', { description: '请先填写邮箱。' });
      return;
    }
    setLoading(true);
    try {
      await forgotPassword({ email: trimmed, turnstileToken: turnstileToken || undefined });
      toast.success('找回密码', { description: '如果该邮箱已注册，重置密码邮件已发送，请注意查收。' });
    } catch (error) {
      toast.error('找回密码', { description: error instanceof Error ? error.message : '发送失败，请稍后重试。' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      {/* 去卡片，与 /forum/auth/login、/register 的裸表单保持一致 */}
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold mb-6">
          <Icon icon="mdi:email-lock-outline" className="size-6 text-primary" />
          找回密码
        </h1>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            填写注册时使用的邮箱，我们会向该邮箱发送一封含有重置链接的邮件。
          </p>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              maxLength={50}
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
                <Icon icon="mdi:email-fast-outline" className="size-4" />
              )}
              发送重置邮件
            </Button>
            <Link
              to="/forum/auth/login"
              className="text-sm text-primary underline decoration-dashed underline-offset-4"
            >
              返回登录
            </Link>
            <Link
              to="/forum/auth/reset-password"
              className="text-sm text-primary underline decoration-dashed underline-offset-4"
            >
              已有 token？去重置
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
