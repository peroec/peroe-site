import { Heart } from "lucide-react";
import type { Sponsor } from "~/lib/types";

export function meta() {
  return [
    { title: "赞助鸣谢 | 二叉树树" },
    { name: "description", content: "感谢您的支持，您的赞助将帮助我持续创作优质内容" },
  ];
}

/** 赞助名单（对应 af_friends-data 的赞助数据，可按需增删） */
const SPONSORS: Sponsor[] = [
  { name: "我是个普通的B站用户", amount: "6B币+800电池", date: "2026-07-17" },
  { name: "xiaoll", amount: "180￥", date: "2026-06-07" },
  { name: "RoL1n_SrP", amount: "10￥", date: "2026-02-22" },
  { name: "Arcwolf", amount: "10￥", date: "2026-02-11" },
  { name: "Rownix", amount: "10￥", date: "2026-01-17" },
  { name: "云云云", amount: "50￥", date: "2026-01-12" },
  { name: "风箫li", amount: "10B币+9电池", date: "2026-01-11" },
  { name: "CPer", amount: "5B币+99电池", date: "2026-01-02" },
  { name: "コットンキャンディ", amount: "10 CNY", date: "2026-01-02" },
  { name: "请输入内容404", amount: "11.45 CNY", date: "2025-12-17" },
  { name: "zz4zz", amount: "10￥", date: "2025-11-15" },
  { name: "chuzouX", amount: "10￥", date: "2025-09-07" },
  { name: "明镜台", amount: "100￥", date: "2025-08-02" },
  { name: "AlexMa233", amount: "5 B币", date: "2025-07-27" },
  { name: "MingTone", amount: "50￥", date: "2025-07-21" },
  { name: "匿名用户", amount: "19.80￥", date: "2025-07-15" },
  { name: "酷丁同学", amount: "5 USDC", date: "2025-07-15" },
  { name: "夜轻", amount: "78￥", date: "2025-07-11" },
];

export default function Sponsors() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-12 text-center">
        <h1 className="text-3xl font-bold text-white">赞助支持</h1>
        <p className="mt-3 text-sm text-muted">
          感谢您的支持，您的赞助将帮助我持续创作优质内容
        </p>
      </header>

      {/* 赞助方式 */}
      <section className="mb-14 border-b border-border pb-14 text-center">
        <h2 className="mb-6 text-xl font-semibold text-white">支付宝赞助</h2>
        <div className="mx-auto flex h-56 w-56 items-center justify-center rounded-lg border border-border bg-card">
          <div className="text-center text-muted-2">
            <Heart className="mx-auto mb-2 h-8 w-8" />
            <p className="text-xs">赞助二维码占位</p>
          </div>
        </div>
        <p className="mt-5 text-xs text-muted-2">
          如果你是要加群，请前往置顶文章，使用爱发电进行赞助。这里只是纯赞助，无收益。
        </p>
      </section>

      {/* 赞助名单 */}
      <h2 className="mb-5 text-xl font-semibold text-white">赞助名单</h2>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {SPONSORS.map((s) => (
          <div key={s.name + s.date} className="flex items-center gap-3 bg-card p-4">
            {s.avatar ? (
              <img
                src={s.avatar}
                alt={s.name}
                className="h-11 w-11 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-base text-muted">
                {s.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{s.name}</p>
              <p className="truncate text-xs text-amber-400/90">{s.amount}</p>
              <p className="text-xs text-muted-2">{s.date}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
