import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Play, Heart } from 'lucide-react';
import { getMyNovels, getWallet, createWalletOrder, getMyOrders, getWalletLedger, deleteNovel, publishNovel, updateNovel } from '@/lib/webnovel/api';
import type { Novel, WalletLedgerEntry } from '@/lib/webnovel/api';

const RECHARGE_PLANS = [
  { points: 100, amount: 6, label: '6 元 / 100 点' },
  { points: 220, amount: 12, label: '12 元 / 220 点' },
  { points: 600, amount: 30, label: '30 元 / 600 点' },
];

export function NovelMine() {
  const [novels, setNovels] = useState<Novel[]>([]);
  const [points, setPoints] = useState(0);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [ledger, setLedger] = useState<WalletLedgerEntry[]>([]);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');
  const [notLoggedIn, setNotLoggedIn] = useState(false);

  const load = useCallback(async () => {
    try { setNovels(await getMyNovels()); } catch { setNotLoggedIn(true); return; }
    try { setPoints((await getWallet()).balance); } catch {}
    try { setOrders(await getMyOrders()); } catch {}
    try { setLedger(await getWalletLedger()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const recharge = async (plan: { points: number; amount: number }) => {
    setErr(''); setMsg('');
    try {
      const order = await createWalletOrder(plan.points);
      if (order.pay_url) {
        setMsg(`请在爱发电完成支付（${plan.points} 创作点 / ${plan.amount} 元），支付完成后自动到账。`);
        window.open(order.pay_url, '_blank');
      } else {
        setMsg(`订单已创建：${order.order_id}。爱发电支付链接尚未配置（管理员需设置 IFDIAN_USER_ID），请稍后再试。`);
      }
      load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : '下单失败');
    }
  };

  if (notLoggedIn) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-muted-foreground mb-4">请先登录</p>
        <Link to="/forum/auth/login" className="text-primary underline">去登录</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <Link to="/webnovel" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">← 返回列表</Link>
        <h1 className="text-xl font-bold">我的创作</h1>
      </div>

      {/* 钱包 */}
      <div className="border border-border rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">创作点钱包</h2>
          <span className="text-lg font-bold font-mono">{points} 点</span>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-2">充值（爱发电）</p>
          <div className="flex flex-wrap gap-2">
            {RECHARGE_PLANS.map((p) => (
              <button key={p.points} onClick={() => recharge(p)} className="border border-border rounded-lg px-4 py-2 text-sm hover:border-foreground transition-colors">
                {p.label}
              </button>
            ))}
          </div>
          {msg && <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">{msg}</p>}
          {err && <p className="text-xs text-red-500 mt-2">{err}</p>}
        </div>
        {orders.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="mb-1">最近订单：</p>
            {orders.slice(0, 5).map((o) => (
              <div key={String((o as any).id)} className="flex justify-between py-0.5">
                <span className="font-mono">{String((o as any).id).slice(0, 24)}…</span>
                <span>{(o as any).status === 'paid' ? '已到账' : '待支付'} · {(o as any).points} 点</span>
              </div>
            ))}
          </div>
        )}
        {ledger.length > 0 && (
          <div className="text-xs text-muted-foreground">
            <p className="mb-1">创作点流水：</p>
            {ledger.slice(0, 8).map((entry) => (
              <div key={entry.id} className="flex justify-between gap-3 border-b border-border py-0.5 last:border-0">
                <span>{entry.kind}</span>
                <span className={entry.delta_points > 0 ? 'text-emerald-600' : 'text-foreground'}>{entry.delta_points > 0 ? '+' : ''}{entry.delta_points} 点 · 余额 {entry.balance_after}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 作品列表 */}
      <div>
        <h2 className="text-sm font-semibold mb-3">我的作品（{novels.length}）</h2>
        {novels.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">还没有作品，去创作一部吧！</p>
        ) : (
          <div className="space-y-2">
            {novels.map((n) => (
              <div key={n.slug} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {n.status === 'published' ? '已发布' : '草稿'} · <Play className="inline size-3" /> {n.play_count} · <Heart className="inline size-3" /> {n.like_count} · {String(n.created_at).slice(0, 10)}
                  </p>
                </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                    <Link to={`/webnovel/editor?slug=${n.slug}`} className="text-xs text-primary hover:underline">编辑</Link>
                    <Link to={`/webnovel/${n.slug}`} className="text-xs text-muted-foreground hover:underline">查看</Link>
                    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <input type="checkbox" checked={Boolean(n.anonymous)} onChange={async (e) => { try { await updateNovel(n.slug, { anonymous: e.target.checked }); load(); } catch {} }} />匿名
                    </label>
                  {n.status !== 'published' ? (
                    <button className="text-xs text-muted-foreground hover:underline" onClick={async () => { try { await publishNovel(n.slug, 'published'); load(); } catch {} }}>发布</button>
                  ) : (
                    <button className="text-xs text-muted-foreground hover:underline" onClick={async () => { try { await publishNovel(n.slug, 'draft'); load(); } catch {} }}>下架</button>
                  )}
                  <button
                    className="text-xs text-red-500 hover:underline"
                    onClick={async () => {
                      if (!confirm(`删除「${n.title}」？`)) return;
                      try { await deleteNovel(n.slug); load(); } catch {}
                    }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
