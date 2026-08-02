import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Button } from '@/forum-bbs/components/ui/button';
import { Input } from '@/forum-bbs/components/ui/input';
import { Alert } from '@/forum-bbs/components/ui/alert';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import { login, startGithubOAuth, getCurrentUser, isTotpError, totpErrorText } from '@/forum-bbs/lib/forum/api/client';
import { describeGithubError } from '@/forum-bbs/lib/forum/utils/github-oauth';
import { Spinner } from '@/forum-bbs/components/ui/spinner';
// 站内路径在本项目里一律裸写（不带部署前缀），只有绕过 <Link>/navigate 的
// 硬跳转和发给后端的绝对回调地址要自己补前缀
import { absUrl, withBase } from '@/forum-bbs/lib/base-path';

function LoginForm() {
  const [searchParams] = useSearchParams();
  const { setUser, setToken } = useForumAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [totpOpen, setTotpOpen] = useState(false);
  const [totpCode, setTotpCode] = useState('');
  const totpInputs = useRef<(HTMLInputElement | null)[]>([null, null, null, null, null, null]);

  // External redirect confirmation
  const [externalUrl, setExternalUrl] = useState('');
  const [externalConfirmOpen, setExternalConfirmOpen] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const [githubError, setGithubError] = useState('');

  const redirect = searchParams.get('redirect') || '/';

  const performRedirect = useCallback((token: string, redirectOverride?: string) => {
    const target = redirectOverride ?? redirect;
    // Check if redirect is an external URL
    if (target.startsWith('http://') || target.startsWith('https://')) {
      try {
        const u = new URL(target);
        if (u.origin !== window.location.origin) {
          u.searchParams.set('token', token);
          setExternalUrl(u.toString());
          setExternalConfirmOpen(true);
          return;
        }
      } catch {}
    }
    // Internal redirect — hard navigation for clean state.
    // 仅允许站内路径（单个 / 开头），拒绝 //host、javascript: 等注入
    const safeTarget = target.startsWith('/') && !target.startsWith('//') ? target : '/';
    // 硬跳转不经路由，basename 不会自动补，这里手动补
    window.location.href = withBase(safeTarget);
  }, [redirect]);

  // GitHub callback: backend returns token via URL search params or hash fragment
  useEffect(() => {
    let token = searchParams.get('token');
    let isNew = searchParams.get('new') || searchParams.get('is_new');
    let errorCode = searchParams.get('github_error');

    // Also check hash fragment (e.g. #token=xxx&new=0)
    const hash = window.location.hash;
    if (!token && hash) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      token = hashParams.get('token');
      isNew = hashParams.get('new') || hashParams.get('is_new') || isNew;
      errorCode = errorCode || hashParams.get('github_error') || null;
      // Clean up hash so it doesn't linger in the URL
      if (token) {
        window.history.replaceState({}, '', window.location.pathname + window.location.search);
      }
    }

    if (errorCode) {
      setGithubError(describeGithubError(errorCode));
      const u = new URL(window.location.href);
      u.searchParams.delete('github_error');
      window.history.replaceState({}, '', u.toString());
    }

    if (token) {
      setGithubLoading(true);
      setToken(token);
      // Restore redirect saved before GitHub OAuth redirect (backup for backend omitting it)
      const savedRedirect = sessionStorage.getItem('github_oauth_redirect');
      if (savedRedirect) {
        sessionStorage.removeItem('github_oauth_redirect');
      }
      // Fetch user info（skipAuthRedirect：401 时留在本页显示错误，而不是全局硬跳转造成刷新循环）
      getCurrentUser({ skipAuthRedirect: true }).then((user) => {
        setUser(user);
        performRedirect(token, savedRedirect || undefined);
      }).catch(() => {
        setGithubError('获取用户信息失败，请重试。');
        setGithubLoading(false);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loginWithGithub = async () => {
    if (githubLoading) return;
    setGithubLoading(true);
    try {
      // Save post-login destination before leaving — sessionStorage survives cross-origin navigation
      sessionStorage.setItem('github_oauth_redirect', redirect);
      // Pass the current login page as the OAuth return URL (token lands here via hash fragment).
      // 后端 sanitizeRedirect() 会把回跳地址补成带尾斜杠、并且**只放行白名单域名**
      // （2x.nz / www / i / localhost / FORUM_FRONTEND_BASE 的域名）——
      // 换到新子域名部署时，后端那份白名单必须一起加，否则 GitHub 登录会被
      // 静默甩回 https://2x.nz/forum/auth/login/。详见 README「后端要改的地方」。
      const oauthReturnUrl = absUrl('/auth/login');
      const { authorize_url } = await startGithubOAuth('login', oauthReturnUrl);
      window.location.href = authorize_url;
    } catch (e) {
      sessionStorage.removeItem('github_oauth_redirect');
      setGithubLoading(false);
      setGithubError(e instanceof Error ? e.message : 'GitHub 登录初始化失败。');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('请输入邮箱和密码'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await login({ email: email.toLowerCase(), password });
      setToken(res.token);
      setUser(res.user);
      performRedirect(res.token);
    } catch (e: unknown) {
      if (isTotpError(e)) {
        setTotpOpen(true);
        setTotpCode('');
        setTimeout(() => totpInputs.current[0]?.focus(), 100);
        return;
      }
      setError(e instanceof Error ? e.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const submitTotp = async (codeArg?: string) => {
    const code = codeArg ?? totpCode;
    if (loading || code.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await login({ email: email.toLowerCase(), password, totpCode: code });
      setToken(res.token);
      setUser(res.user);
      setTotpOpen(false);
      performRedirect(res.token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '验证失败');
      setTotpCode('');
      setTimeout(() => totpInputs.current[0]?.focus(), 100);
    } finally {
      setLoading(false);
    }
  };

  const onTotpChange = (idx: number, val: string) => {
    const digits = totpCode.split('');
    digits[idx] = val.replace(/\D/g, '').slice(0, 1);
    const newCode = Array.from({ length: 6 }, (_, i) => digits[i] || '').join('');
    setTotpCode(newCode);
    if (val && idx < 5) totpInputs.current[idx + 1]?.focus();
    if (newCode.length === 6) submitTotp(newCode);
  };

  const onTotpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    setTotpCode(pasted);
    totpInputs.current[Math.min(pasted.length, 5)]?.focus();
    if (pasted.length === 6) submitTotp(pasted);
  };

  const onTotpKeyDown = (idx: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !totpCode[idx] && idx > 0) {
      totpInputs.current[idx - 1]?.focus();
    }
  };

  return (
    <main className="container mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold text-center mb-6">登录</h1>

      {searchParams.get('registered') === '1' && (
        <Alert className="mb-4 border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Icon icon="mdi:email-check-outline" className="size-4 shrink-0" />
          注册成功！请检查邮箱并点击激活链接完成验证。
        </Alert>
      )}
      {error && <Alert variant="destructive" className="mb-4">{error}</Alert>}

      <form onSubmit={handleSubmit} className="space-y-4" name="login" method="post">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" autoComplete="username" name="username" />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" autoComplete="current-password" name="password" />
        <Button type="submit" disabled={loading} className="w-full">{loading ? '登录中…' : '登录'}</Button>
      </form>

      {githubError && <Alert variant="destructive">{githubError}</Alert>}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">或</span></div>
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={loginWithGithub} disabled={githubLoading}>
        {githubLoading ? (
          <Spinner className="size-4" />
        ) : (
          <Icon icon="mdi:github" className="size-4" />
        )}
        使用 GitHub 登录
      </Button>

      {/* External redirect confirmation */}
      {externalConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border border-foreground/80 p-6 w-full max-w-sm mx-4 space-y-3">
            <h2 className="text-lg font-semibold">确认外部重定向</h2>
            <p className="text-sm text-muted-foreground">
              即将跳转到第三方站点，登录凭证将以 URL 参数形式传递：
            </p>
            <p className="text-xs font-mono break-all bg-muted p-2 rounded text-muted-foreground">
              {externalUrl}
            </p>
            <p className="text-xs text-amber-600">
              请确认该站点可信后再继续操作。
            </p>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { window.location.href = externalUrl; }}>继续</Button>
              <Button variant="outline" className="flex-1" onClick={() => { setExternalConfirmOpen(false); setExternalUrl(''); }}>取消</Button>
            </div>
          </div>
        </div>
      )}

      {/* TOTP dialog */}
      {totpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => { if (!loading) setTotpOpen(false); }}>
          <div className="bg-background border border-foreground/80 p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">双重验证</h2>
            <p className="text-sm text-muted-foreground mb-4">请输入身份验证器应用中的 6 位动态码</p>
            <div className="flex justify-center gap-2 mb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { totpInputs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  name="totp"
                  maxLength={1}
                  value={totpCode[i] || ''}
                  onChange={(e) => onTotpChange(i, e.target.value)}
                  onKeyDown={(e) => onTotpKeyDown(i, e)}
                  onPaste={onTotpPaste}
                  className="w-10 h-12 text-center text-lg font-mono rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setTotpOpen(false); setTotpCode(''); }} disabled={loading}>取消</Button>
              <Button className="flex-1" onClick={() => submitTotp()} disabled={loading || totpCode.length !== 6}>
                {loading ? '验证中…' : '验证'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-4 text-sm text-muted-foreground">
        <Link to="/auth/register" className="hover:text-foreground">没有账号？去注册</Link>
        <Link to="/auth/forgot-password" className="hover:text-foreground">忘记密码？</Link>
      </div>
    </main>
  );
}

/**
 * 不要包 Suspense：没有东西会挂起，但流式 SSR 会为边界生成占位，把表单甩进
 * 响应末尾的 `<div hidden>`，靠内联脚本搬回 —— 禁用 JS 时页面空白。
 */
export default function ForumLoginPage() {
  return <LoginForm />;
}
