import { Tv } from "lucide-react";
import type { AnimeItem } from "~/lib/types";

export function meta() {
  return [
    { title: "追番列表 | 二叉树树" },
    { name: "description", content: "同步个人 Bangumi 追番列表" },
  ];
}

/** 追番数据（对应 Bangumi 同步数据，可按需增删） */
const ANIME_LIST: AnimeItem[] = [
  { title: "BanG Dream! It's MyGO!!!!!", desc: "迷子们的乐队故事" },
  { title: "BanG Dream! Ave Mujica", desc: "颂乐人偶" },
  { title: "孤独摇滚！", desc: "社恐少女的吉他成长记" },
  { title: "葬送的芙莉莲", desc: "勇者一行之后的长生种旅途" },
  { title: "摇曳露营△", desc: "冬日露营的日常" },
  { title: "紫罗兰永恒花园", desc: "自动手记人偶的寻爱之旅" },
  { title: "轻音少女", desc: "放课后茶会" },
  { title: "命运石之门", desc: "El Psy Kongroo" },
  { title: "CLANNAD", desc: "家族与小镇的故事" },
  { title: "凉宫春日的忧郁", desc: "SOS 团" },
];

export default function Anime() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-bold text-white">追番记录</h1>
        <p className="mt-2 text-sm text-muted">
          同步个人 Bangumi 追番列表，当季在追动漫一览
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {ANIME_LIST.map((a) => (
          <div
            key={a.title}
            className="flex gap-4 overflow-hidden rounded-lg border border-border bg-card p-4 transition-colors hover:bg-card-hover"
          >
            <div className="flex h-24 w-18 shrink-0 items-center justify-center rounded bg-background">
              {a.cover ? (
                <img
                  src={a.cover}
                  alt={a.title}
                  className="h-full w-full rounded object-cover"
                />
              ) : (
                <Tv className="h-6 w-6 text-muted-2" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="mb-1 truncate text-sm font-semibold text-white">{a.title}</h2>
              <p className="line-clamp-3 text-xs leading-relaxed text-muted">{a.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
