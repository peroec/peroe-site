import { Link, useSearchParams } from "react-router";
import { useState } from "react";
import type { Route } from "./+types/forum.auth.login";

export function meta() {
  return [{ title: "登录 | 论坛 | 二叉树树" }];
}

const API_BASE = "http://127.0.0.1:8787";

export default function Login(_props: Route.ComponentProps) {
  const [params] = useSearchParams();
  const redirect = params.get("redirect") || "/forum";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json()) as { token?: string; message?: string };
      if (!res.ok || !data.token) throw new Error(data.message || "登录失败");
      localStorage.setItem("forum_token", data.token);
      location.href = redirect;
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col px-4 py-20">
      <h1 className="mb-8 text-center text-2xl font-bold text-white">登录</h1>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm text-muted">邮箱或用户名</label>
          <input
            type="text"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-muted">密码</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-border bg-card px-3 py-2 text-sm text-foreground focus:border-neutral-500 focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-white py-2.5 text-sm font-medium text-black transition-opacity disabled:opacity-40"
        >
          {loading ? "登录中…" : "登录"}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-2">
        还没有账号？
        <Link
          to={`/forum/auth/register?redirect=${encodeURIComponent(redirect)}`}
          className="ml-1 text-white underline"
        >
          立即注册
        </Link>
      </p>
    </main>
  );
}
