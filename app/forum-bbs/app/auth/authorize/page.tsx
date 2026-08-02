'use client';

import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Button } from '@/forum-bbs/components/ui/button';
import { Icon } from '@/forum-bbs/components/ui/icon';
import { Spinner } from '@/forum-bbs/components/ui/spinner';
import { useForumAuth } from '@/forum-bbs/lib/forum/stores/auth';
import { withBase } from '@/forum-bbs/lib/base-path';
import { siteConfig } from '@/forum-bbs/lib/site-config';

/**
 * /auth/authorize —— 把论坛身份交接给同一站点下的另一个域名。
 *
 * 生图站（ai.acofork.com）和论坛是两个 origin，localStorage 互不可见，那边读不到
 * 这边的登录态；「跳来论坛登录再跳回去」也没用，回到那个 origin 依然没有 token。
 * 这一页是唯一的交接口：先确认已登录，再由用户**明确点一次授权**，然后把 token
 * 放进 URL fragment 带回请求方。
 *
 * 两个安全点，改的时候不要绕过：
 *
 * 1. **redirect_uri 必须在白名单内**。这是本页的安全根基 —— 不校验就是一个开放
 *    重定向，任何人构造 `?redirect_uri=https://evil.example` 就能把已登录用户的
 *    token 骗走。白名单来自 `VITE_AUTH_ALLOWED_ORIGINS`，比的是 **origin**
 *    （协议+域名+端口），不是前缀匹配 —— `startsWith` 那种写法会被
 *    `https://ai.acofork.com.evil.example` 绕过。
 * 2. **token 走 fragment 而不是查询串**。fragment 不会被浏览器发给服务器，
 *    不进访问日志、不进 Referer。论坛后端的 GitHub 回调用的也是这个办法。
 */

/** 允许交接的 origin。逗号分隔，**只放本站自己的域**（配置在 site.config.json 的 authAllowedOrigins） */
const ALLOWED_ORIGINS = new Set(
  (import.meta.env.VITE_AUTH_ALLOWED_ORIGINS || siteConfig.authAllowedOrigins || 'https://ai.acofork.com')
    .split(',')
    .map((s: string) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean),
);

/** 展示用的站点名。认不出来的域也能授权（只要在白名单里），只是文案通用一些 */
const SITE_LABELS: Record<string, { name: string; desc: string; icon: string }> = {
  'https://ai.acofork.com': {
    name: 'AI 生图',
    desc: '使用你的论坛账号登录生图站，读取你的用户名、头像与生图点余额。',
    icon: 'mdi:palette',
  },
};

function isAllowed(uri: string): boolean {
  try {
    return ALLOWED_ORIGINS.has(new URL(uri).origin);
  } catch {
    return false;
  }
}

export default function AuthorizePage() {
  const { user, loading } = useForumAuth();
  const [redirectUri, setRedirectUri] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    const uri = new URLSearchParams(window.location.search).get('redirect_uri') || '';
    if (!uri || !isAllowed(uri)) {
      setInvalid(true);
      return;
    }
    setRedirectUri(uri);
  }, []);

  // 未登录：先去登录，登录完回到本页继续授权
  useEffect(() => {
    if (loading || user || invalid || !redirectUri) return;
    const back = '/auth/authorize?redirect_uri=' + encodeURIComponent(redirectUri);
    window.location.href = withBase('/auth/login') + '?redirect=' + encodeURIComponent(back);
  }, [loading, user, invalid, redirectUri]);

  function grant() {
    if (!redirectUri) return;
    const token = localStorage.getItem('forum-auth-token');
    if (!token) return;
    setGranting(true);
    const url = new URL(redirectUri);
    url.hash = `auth_token=${encodeURIComponent(token)}`;
    window.location.href = url.toString();
  }

  if (invalid) {
    return (
      <main className="container mx-auto max-w-lg px-4 py-16">
        <h1 className="text-lg font-bold mb-2 flex items-center gap-2">
          <Icon icon="mdi:alert-circle-outline" className="size-5 text-destructive" />
          无效的授权请求
        </h1>
        <p className="text-sm text-muted-foreground mb-4">
          请求方站点不在允许的范围内，已拒绝本次授权。如果你是从站内链接过来的，请重试一次。
        </p>
        <Link to="/"><Button size="sm">返回论坛</Button></Link>
      </main>
    );
  }

  if (loading || !user || !redirectUri) {
    return (
      <main className="container mx-auto max-w-lg px-4 py-16">
        <p className="flex items-center justify-center gap-3 font-mono text-xs text-muted-foreground">
          <Spinner className="size-3.5" /> 正在检查登录状态…
        </p>
      </main>
    );
  }

  const origin = new URL(redirectUri).origin;
  const site = SITE_LABELS[origin] || {
    name: origin,
    desc: '使用你的论坛账号登录该站点。',
    icon: 'mdi:web',
  };

  return (
    <main className="container mx-auto max-w-lg px-4 py-16">
      <h1 className="text-lg font-bold mb-1 flex items-center gap-2">
        <Icon icon={site.icon} className="size-5" />
        授权 {site.name}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">{site.desc}</p>

      <div className="border-y border-border py-3 mb-6 flex items-center gap-3 sm:border sm:p-3">
        {user.avatarUrl && (
          <img src={user.avatarUrl} alt="" width={36} height={36} className="size-9 object-cover" />
        )}
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{user.displayName || user.username}</p>
          <p className="text-xs text-muted-foreground truncate">将以这个账号登录</p>
        </div>
      </div>

      <dl className="text-xs text-muted-foreground space-y-1 mb-6">
        <div className="flex gap-2">
          <dt className="shrink-0">站点</dt>
          <dd className="min-w-0 break-all font-mono text-foreground">{origin}</dd>
        </div>
      </dl>

      <div className="flex gap-2">
        <Button onClick={grant} disabled={granting} className="flex-1">
          {granting ? '正在跳转…' : '授权并继续'}
        </Button>
        <Button
          variant="outline"
          onClick={() => { window.location.href = withBase('/'); }}
          className="flex-1"
        >
          取消
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        授权后该站点将持有你的论坛登录凭证，可代表你调用论坛接口。要撤销，去个人中心的
        「登录设备」里把对应会话下线即可。
      </p>
    </main>
  );
}
