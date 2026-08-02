import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { Turnstile } from '@marsidev/react-turnstile';
import { Button } from '@/forum-bbs/components/ui/button';
import { Input } from '@/forum-bbs/components/ui/input';
import { Alert } from '@/forum-bbs/components/ui/alert';
import { register, getForumConfig } from '@/forum-bbs/lib/forum/api/client';
import { PASSWORD_MIN, PASSWORD_MAX, isWeakPassword } from '@/forum-bbs/lib/forum/utils/password-policy';

export default function ForumRegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !email || !password) { setError('请填写所有字段'); return; }
    // 前端密码策略校验（与重置密码页一致）
    if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) {
      setError(`密码长度需为 ${PASSWORD_MIN}-${PASSWORD_MAX} 位`);
      return;
    }
    if (isWeakPassword(password)) {
      setError('密码过于简单，请使用更复杂的密码');
      return;
    }
    if (turnstileEnabled && !turnstileToken) {
      setError('验证码尚未加载完成或已过期，请稍后重试');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await register({
        username,
        email: email.toLowerCase(),
        password,
        turnstileToken: turnstileToken || undefined,
      });
      // 注册后统一跳登录页并提示查收激活邮件
      navigate('/forum/auth/login?registered=1');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-6">注册</h1>
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="用户名" />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" />
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={`密码（${PASSWORD_MIN}-${PASSWORD_MAX} 位）`}
          autoComplete="new-password"
        />

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
            论坛已启用 Turnstile 但未配置站点密钥，请联系管理员。
          </Alert>
        )}

        <Button type="submit" disabled={loading} className="w-full">{loading ? '注册中…' : '注册'}</Button>
      </form>
      <p className="text-center text-sm text-muted-foreground mt-4">
        <Link to="/forum/auth/login" className="hover:text-foreground">已有账号？去登录</Link>
      </p>
    </main>
  );
}
