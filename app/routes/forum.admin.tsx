import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/forum.admin";
import {
  ArrowLeft,
  RefreshCw,
  Users,
  FileText,
  MessageSquare,
  Mail,
  Trash2,
  Check,
  Shield,
} from "lucide-react";

export function meta() {
  return [{ title: "管理控制台 | 论坛 | 二叉树树" }];
}

const FORUM_API = "http://127.0.0.1:8787";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("forum_token") || localStorage.getItem("forum-auth-token");
}

async function api(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${FORUM_API}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any).message || `请求失败 ${res.status}`);
  return data;
}

const SETTING_LABELS: Record<string, string> = {
  turnstile_enabled: "Turnstile 验证码",
  session_ttl_days: "登录态过期天数",
  allow_registration: "允许注册",
  notify_on_user_delete: "用户删除通知",
  notify_on_post_delete: "帖子删除通知",
  notify_on_username_change: "用户名变更通知",
  notify_on_avatar_change: "头像变更通知",
  notify_on_manual_verify: "手动验证通知",
  notify_on_new_post: "新帖通知",
  smtp_secret: "SMTP 密钥",
};

const RATE_LIMIT_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "register_ip_cooldown_seconds", label: "注册冷却（同一 IP）", unit: "秒" },
  { key: "verify_email_resend_cooldown_seconds", label: "验证邮件重发间隔", unit: "秒" },
  { key: "forgot_password_cooldown_seconds", label: "找回密码冷却", unit: "秒" },
  { key: "change_email_cooldown_seconds", label: "更换邮箱冷却", unit: "秒" },
  { key: "login_fail_max_attempts", label: "登录失败锁定阈值", unit: "次" },
  { key: "login_fail_window_seconds", label: "登录失败统计窗口", unit: "秒" },
];

export default function ForumAdmin(_props: Route.ComponentProps) {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<{ users: number; posts: number; comments: number } | null>(null);
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [newCat, setNewCat] = useState("");
  const [editingCat, setEditingCat] = useState<{ id: number; name: string } | null>(null);
  const [users, setUsers] = useState<Record<string, any>[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [editingUser, setEditingUser] = useState<Record<string, any> | null>(null);
  const [msg, setMsg] = useState("");

  const flash = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 2500);
  };

  const loadAll = () => {
    api("/api/admin/stats").then(setStats).catch(() => {});
    api("/api/admin/settings").then(setSettings).catch(() => {});
    api("/api/categories").then(setCategories).catch(() => {});
  };

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setChecking(false);
      return;
    }
    api("/api/user/me")
      .then((u) => {
        setIsAdmin((u as any).role === "admin");
        if ((u as any).role === "admin") loadAll();
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center text-muted">
        检查登录状态…
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="mb-4 text-2xl font-bold text-white">管理控制台</h1>
        <p className="text-muted">
          {getToken() ? "当前账号不是管理员" : "请先登录管理员账号"}
        </p>
        <Link
          to={`/forum/auth/login?redirect=${encodeURIComponent("/forum/admin")}`}
          className="mt-6 inline-block rounded border border-border px-5 py-2 text-sm text-muted hover:text-white"
        >
          去登录
        </Link>
      </main>
    );
  }

  const saveSettings = async () => {
    try {
      await api("/api/admin/settings", { method: "POST", body: JSON.stringify(settings) });
      flash("设置已保存");
    } catch {
      flash("保存失败");
    }
  };

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/forum" className="inline-flex items-center gap-2 text-2xl font-bold text-white">
            <ArrowLeft className="h-6 w-6" /> 管理控制台
          </Link>
        </div>
        <button
          type="button"
          onClick={loadAll}
          className="flex items-center gap-1.5 rounded border border-border px-3 py-1.5 text-xs text-muted hover:text-white"
        >
          <RefreshCw className="h-3.5 w-3.5" /> 刷新数据
        </button>
      </div>

      {msg && (
        <p className="mb-4 rounded border border-border bg-card px-4 py-2 text-sm text-muted">{msg}</p>
      )}

      {/* 统计 */}
      <div className="mb-6 grid grid-cols-2 border-l border-t border-border md:grid-cols-4">
        {[
          { label: "用户总数", value: stats?.users, icon: Users },
          { label: "帖子总数", value: stats?.posts, icon: FileText },
          { label: "评论总数", value: stats?.comments, icon: MessageSquare },
          { label: "管理员", value: "✓", icon: Shield },
        ].map((s) => (
          <div key={s.label} className="border-b border-r border-border p-4">
            <div className="mb-1 flex items-center gap-2 text-sm text-muted">
              <s.icon className="h-4 w-4" /> {s.label}
            </div>
            <p className="text-2xl font-bold text-white">{s.value ?? "-"}</p>
          </div>
        ))}
      </div>

      {/* 站点设置 */}
      <section className="mb-6 border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-white">站点设置</h2>
        <div className="space-y-3">
          {Object.entries(settings)
            .filter(([k]) => k in SETTING_LABELS)
            .map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-sm text-muted">{SETTING_LABELS[k]}</span>
                {typeof v === "boolean" ? (
                  <input
                    type="checkbox"
                    checked={v}
                    onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.checked }))}
                    className="h-4 w-4 accent-white"
                  />
                ) : (
                  <input
                    type="text"
                    value={String(v ?? "")}
                    onChange={(e) => setSettings((s) => ({ ...s, [k]: e.target.value }))}
                    className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-xs text-foreground"
                  />
                )}
              </div>
            ))}
        </div>
        <button
          type="button"
          onClick={saveSettings}
          className="mt-4 rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
        >
          保存设置
        </button>
      </section>

      {/* 防滥用限流 */}
      <section className="mb-6 border border-border bg-card p-5">
        <h2 className="mb-1 font-semibold text-white">防滥用限流</h2>
        <p className="mb-4 text-xs text-muted-2">任一项填 0 即关闭该项限流</p>
        <div className="space-y-3">
          {RATE_LIMIT_FIELDS.map((f) => (
            <div key={f.key} className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-sm text-muted">{f.label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  value={String(settings[f.key] ?? "")}
                  onChange={(e) => setSettings((s) => ({ ...s, [f.key]: e.target.value }))}
                  className="w-24 rounded border border-border bg-background px-2 py-1 text-right text-xs text-foreground"
                />
                <span className="w-4 text-xs text-muted-2">{f.unit}</span>
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={saveSettings}
          className="mt-4 rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
        >
          保存限流设置
        </button>
      </section>

      {/* 分类管理 */}
      <section className="mb-6 border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-white">分类管理</h2>
        <div className="mb-4 flex gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            placeholder="新分类名称"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-2"
          />
          <button
            type="button"
            onClick={async () => {
              if (!newCat.trim()) return;
              try {
                await api("/api/admin/categories", {
                  method: "POST",
                  body: JSON.stringify({ name: newCat.trim() }),
                });
                setNewCat("");
                loadAll();
                flash("已添加分类");
              } catch (e: any) {
                flash(e.message);
              }
            }}
            className="rounded bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200"
          >
            添加
          </button>
        </div>
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="flex items-center justify-between border-b border-border py-1 last:border-0">
              {editingCat?.id === c.id ? (
                <div className="flex flex-1 gap-2">
                  <input
                    value={editingCat.name}
                    onChange={(e) => setEditingCat({ ...editingCat, name: e.target.value })}
                    className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground"
                  />
                  <button
                    type="button"
                    className="text-sm text-muted hover:text-white"
                    onClick={async () => {
                      await api(`/api/admin/categories/${c.id}`, {
                        method: "PUT",
                        body: JSON.stringify({ name: editingCat.name }),
                      });
                      setEditingCat(null);
                      loadAll();
                    }}
                  >
                    保存
                  </button>
                  <button type="button" className="text-sm text-muted hover:text-white" onClick={() => setEditingCat(null)}>
                    取消
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm text-foreground">{c.name}</span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-white"
                      onClick={() => setEditingCat({ id: c.id, name: c.name })}
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      className="text-xs text-accent"
                      onClick={async () => {
                        if (!confirm(`删除分类「${c.name}」？`)) return;
                        await api(`/api/admin/categories/${c.id}`, { method: "DELETE" });
                        loadAll();
                      }}
                    >
                      删除
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 用户管理 */}
      <section className="border border-border bg-card p-5">
        <h2 className="mb-4 font-semibold text-white">用户管理</h2>
        <div className="mb-4 flex gap-2">
          <input
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchUsers()}
            placeholder="搜索用户名或邮箱"
            className="flex-1 rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-2"
          />
          <button
            type="button"
            onClick={searchUsers}
            className="rounded bg-white px-4 text-sm font-medium text-black hover:bg-neutral-200"
          >
            搜索
          </button>
          {userQuery && (
            <button
              type="button"
              className="rounded border border-border px-3 text-sm text-muted hover:text-white"
              onClick={() => {
                setUserQuery("");
                setUsers([]);
              }}
            >
              清空
            </button>
          )}
        </div>

        {users.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-2">搜索用户以开始</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div key={u.id} className="border-b border-border py-2 last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt="" className="h-8 w-8 shrink-0 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-800" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{u.username}</p>
                      <p className="truncate text-xs text-muted-2">{u.email}</p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-2">#{u.id}</span>
                    {u.role === "admin" && (
                      <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-muted">管理员</span>
                    )}
                    {u.role === "bot" && (
                      <span className="shrink-0 rounded bg-neutral-800 px-2 py-0.5 text-xs text-muted">机器人</span>
                    )}
                    {u.verified ? (
                      <span className="shrink-0 text-xs text-green-500">已验证</span>
                    ) : (
                      <span className="shrink-0 text-xs text-amber-500">未验证</span>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {!u.verified && (
                      <button
                        type="button"
                        className="flex items-center gap-1 text-xs text-muted hover:text-white"
                        onClick={async () => {
                          await api(`/api/admin/users/${u.id}/verify`, { method: "POST", body: "{}" });
                          searchUsers();
                        }}
                      >
                        <Check className="h-3 w-3" /> 通过验证
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-xs text-muted hover:text-white"
                      onClick={() =>
                        setEditingUser(
                          editingUser?.id === String(u.id)
                            ? null
                            : { id: String(u.id), username: u.username, avatarUrl: u.avatar_url || "" }
                        )
                      }
                    >
                      {editingUser?.id === String(u.id) ? "收起" : "编辑"}
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-xs text-accent"
                      onClick={async () => {
                        if (!confirm(`删除用户 ${u.username}？`)) return;
                        await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
                        searchUsers();
                      }}
                    >
                      <Trash2 className="h-3 w-3" /> 删除
                    </button>
                  </div>
                </div>

                {editingUser?.id === String(u.id) && (
                  <div className="mt-3 space-y-3 rounded border border-border bg-background p-3">
                    <div>
                      <label className="mb-1 block text-xs text-muted-2">用户名（最多 20 字）</label>
                      <input
                        value={editingUser.username}
                        maxLength={20}
                        onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                        className="w-full rounded border border-border bg-card px-2 py-1.5 text-sm text-foreground"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-muted-2">头像 URL（留空 = 重置为默认）</label>
                      <div className="flex items-center gap-2">
                        {editingUser.avatarUrl ? (
                          <img src={editingUser.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full border border-border object-cover" />
                        ) : (
                          <div className="h-9 w-9 shrink-0 rounded-full border border-dashed border-border" />
                        )}
                        <input
                          value={editingUser.avatarUrl}
                          onChange={(e) => setEditingUser({ ...editingUser, avatarUrl: e.target.value })}
                          className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-1.5 font-mono text-sm text-foreground"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          const payload: Record<string, unknown> = {};
                          if (editingUser.username.trim() !== u.username) {
                            payload.username = editingUser.username.trim();
                          }
                          if (editingUser.avatarUrl.trim() !== (u.avatar_url || "")) {
                            payload.avatar_url = editingUser.avatarUrl.trim();
                          }
                          if (Object.keys(payload).length === 0) {
                            setEditingUser(null);
                            return;
                          }
                          try {
                            await api(`/api/admin/users/${u.id}/update`, {
                              method: "POST",
                              body: JSON.stringify(payload),
                            });
                            setEditingUser(null);
                            searchUsers();
                            flash("已保存");
                          } catch (e: any) {
                            flash(e.message);
                          }
                        }}
                        className="rounded bg-white px-4 py-1.5 text-sm font-medium text-black hover:bg-neutral-200"
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        className="rounded border border-border px-3 py-1.5 text-sm text-muted hover:text-white"
                        onClick={() => setEditingUser(null)}
                      >
                        取消
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );

  async function searchUsers() {
    const q = userQuery.trim();
    const data = (await api(q ? `/api/admin/users?q=${encodeURIComponent(q)}` : "/api/admin/users")) as Record<
      string,
      any
    >[];
    setUsers(data);
  }
}
