import { useState } from "react";
import { Link2, Search, Crown } from "lucide-react";
import type { Friend } from "~/lib/types";
import { Pagination } from "~/components/Pagination";
import { useSearchParams } from "react-router";

export function meta() {
  return [
    { title: "友情链接 | 二叉树树" },
    { name: "description", content: "这里是我的朋友们，欢迎互相访问交流" },
  ];
}

/** 友链数据（对应开源仓库 af_friends-data 的结构，可按需增删） */
const FRIENDS: Friend[] = [
  { name: "22", avatar: "", description: "https://space.bilibili.com/44681442", url: "https://space.bilibili.com/44681442", vip: true },
  { name: "带我入坑网站的超级大坏比", avatar: "", description: "Dmcken的免费推广位", url: "#", vip: true },
  { name: "在***教了我很多的好朋友", avatar: "", description: "https://ie.cx", url: "https://ie.cx", vip: true },
  { name: "1zyq1's_Blog", avatar: "", description: "Protect What You Love./爱你所爱！", url: "#" },
  { name: "百里博客", avatar: "", description: "一个高中生的博客", url: "#" },
  { name: "尘の个人博客", avatar: "", description: "一个高中生 UP 搭的博客 QwQ", url: "#" },
  { name: "创梦星际", avatar: "", description: "一名高中生的个人博客", url: "#" },
  { name: "吹水明月的小窝", avatar: "", description: "没有人是笨蛋，大家都只会对喜欢的人用心", url: "#" },
  { name: "粉白妙妙屋", avatar: "", description: "我见青山多妩媚", url: "#" },
];

const PAGE_SIZE = 12;

export default function Friends() {
  const [params] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const [q, setQ] = useState("");

  const filtered = q
    ? FRIENDS.filter(
        (f) =>
          f.name.toLowerCase().includes(q.toLowerCase()) ||
          (f.description || "").toLowerCase().includes(q.toLowerCase())
      )
    : FRIENDS;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-white">友情链接</h1>
        <p className="mt-3 text-sm text-muted">这里是我的朋友们，欢迎互相访问交流</p>
      </header>

      {/* 申请友链 */}
      <section className="mb-12 rounded-lg border border-border bg-card p-6">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-white">
          <Link2 className="h-4 w-4" /> 申请友链
        </h2>
        <p className="mb-3 text-sm text-muted">
          直接在 GitHub 上创建文件，自动验证通过后就会出现在下方列表中。
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>
            打开{" "}
            <a
              href="https://github.com/afoim/af_friends-data/tree/main/data/friends"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white underline"
            >
              afoim/af_friends-data/data/friends
            </a>
            ，点击右上角 … → Create new file
          </li>
          <li>
            <strong className="text-white">Name your file</strong> 处填入文件名，必须以{" "}
            <code className="rounded bg-neutral-800 px-1">.json</code> 结尾（例如{" "}
            <code className="rounded bg-neutral-800 px-1">我的博客.json</code>）
          </li>
          <li>粘贴以下内容，替换成你的信息：</li>
        </ol>
        <pre className="mt-3 overflow-x-auto rounded-md border border-border bg-background p-4 text-xs leading-relaxed text-muted">
{`{
  "name": "你的站点名称",
  "avatar": "https://你的头像URL（可选）",
  "description": "简短描述（可选）",
  "url": "https://你的网站URL",
  "backlink": "https://你的网站/友链页（必填）"
}`}
        </pre>
        <p className="mt-3 text-xs text-muted-2">
          提交后 GitHub Actions 会自动检查头像和网站的可达性，通过后合并。如果有问题，请提{" "}
          <a
            href="https://github.com/afoim/af_friends-data/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline"
          >
            Issue
          </a>
          。
        </p>
      </section>

      {/* 友链列表 */}
      <h2 className="mb-5 text-xl font-semibold text-white">
        友链列表 ({filtered.length})
      </h2>

      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索标题或简介…"
            className="w-full rounded border border-border bg-card py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-2 focus:border-neutral-500 focus:outline-none"
          />
        </div>
        <span className="rounded border border-border px-4 py-2 text-sm text-muted">搜索</span>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {items.map((f) => (
          <a
            key={f.name}
            href={f.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-card p-4 transition-colors hover:bg-card-hover"
          >
            {f.avatar ? (
              <img
                src={f.avatar}
                alt={f.name}
                className="h-12 w-12 shrink-0 rounded-full border border-amber-400/50 object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-lg text-muted">
                {f.name[0]}
              </div>
            )}
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
                {f.name}
                {f.vip && (
                  <span className="flex shrink-0 items-center gap-0.5 rounded bg-amber-400/10 px-1 py-px text-[10px] text-amber-400">
                    <Crown className="h-2.5 w-2.5" /> VIP
                  </span>
                )}
              </p>
              <p className="truncate text-xs text-muted">{f.description}</p>
            </div>
          </a>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} />
    </main>
  );
}
