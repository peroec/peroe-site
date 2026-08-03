import { Heart } from "lucide-react";
import type { Sponsor } from "~/lib/types";
import { useFasData } from "~/lib/fas";

export function meta() {
  return [
    { title: "赞助鸣谢 | peroe" },
    { name: "description", content: "感谢您的支持，您的赞助将帮助我持续创作优质内容" },
  ];
}

export default function Sponsors() {
  // 赞助数据：客户端从 fas.060730.xyz/sponsors.json 拉取（1 小时缓存，与友链同机制）
  const { data: sponsors, isLoading, isError } = useFasData<Sponsor>("/sponsors.json");

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
      {isLoading ? (
        <p className="py-8 text-center text-sm text-muted">加载中…</p>
      ) : isError ? (
        <p className="py-8 text-center text-sm text-muted">赞助名单加载失败，请稍后重试</p>
      ) : (
        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((s) => (
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
      )}
    </main>
  );
}
