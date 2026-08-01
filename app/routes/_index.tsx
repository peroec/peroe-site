import { Link } from "react-router";
import {
  Newspaper,
  MessagesSquare,
  Tv,
  Briefcase,
  Link2,
  ArrowRight,
  ChevronDown,
  Cloud,
  Rss,
  BookOpen,
  MessageSquare,
  PenTool,
  Sparkles,
} from "lucide-react";
import {
  SITE_AVATAR,
  SITE_NAME,
  SITE_SLOGAN,
  SITE_DESCRIPTION,
  SOCIAL_LINKS,
} from "~/lib/site";

export function meta() {
  return [
    { title: "《二叉树树》官方网站" },
    { name: "description", content: SITE_DESCRIPTION },
  ];
}

const MODULE_CARDS = [
  {
    to: "/posts",
    icon: Newspaper,
    title: "技术博客",
    desc: "记录前端、后端、DevOps、ServerLess 与 Cloudflare 的技术探索，定期更新，支持 RSS 订阅。",
    action: "阅读文章",
  },
  {
    to: "/forum",
    icon: MessagesSquare,
    title: "社区论坛",
    desc: "基于 Cloudflare 全栈的社区论坛（Workers + D1），注册即可发帖，期待与你交流想法。",
    action: "进入论坛",
  },
  {
    to: "/anime",
    icon: Tv,
    title: "追番记录",
    desc: "同步个人 Bangumi 追番列表，当季在追动漫一览，了解我的二次元喜好。",
    action: "查看追番",
  },
];

export default function Index() {
  return (
    <main>
      {/* ── Hero ── */}
      <section className="relative flex min-h-[calc(100vh-3.5rem)] flex-col items-center justify-center px-4 text-center">
        <div className="rounded-md border-2 border-accent/70 p-1.5">
          <img
            src={SITE_AVATAR}
            alt={SITE_NAME}
            className="h-28 w-28 rounded-sm object-cover sm:h-36 sm:w-36"
          />
        </div>
        <h1 className="mt-8 text-5xl font-bold tracking-tight text-white sm:text-6xl">
          {SITE_NAME}
        </h1>
        <p className="mt-4 text-lg text-muted-2">{SITE_SLOGAN}</p>
        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-2">
          <BookOpen className="h-4 w-4" /> 技术博客
          <span className="text-border">·</span>
          <MessageSquare className="h-4 w-4" /> 社区论坛
          <span className="text-border">·</span>
          <Sparkles className="h-4 w-4" /> AI 工具
          <span className="text-border">·</span>
          <Briefcase className="h-4 w-4" /> 实用在线工具集
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/posts"
            className="flex items-center gap-2 rounded bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200"
          >
            <Newspaper className="h-4 w-4" /> 阅读博客
          </Link>
          <Link
            to="/forum"
            className="flex items-center gap-2 rounded border border-border px-6 py-2.5 text-sm text-foreground transition-colors hover:bg-card"
          >
            <MessagesSquare className="h-4 w-4" /> 进入论坛
          </Link>
        </div>
        <ChevronDown className="absolute bottom-8 h-5 w-5 animate-bounce text-muted-2" />
      </section>

      {/* ── 探索我在做什么 ── */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <div className="mb-12 text-center">
          <h2 className="text-2xl font-bold text-white">探索我在做什么</h2>
          <p className="mt-2 text-sm text-muted">
            从技术博客到 AI 创作工具，这里是我的数字花园。
          </p>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_CARDS.map(({ to, icon: Icon, title, desc, action }) => (
            <Link
              key={title}
              to={to}
              className="group flex flex-col bg-card p-6 transition-colors hover:bg-card-hover"
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded border border-border bg-background text-muted">
                <Icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mb-2 font-semibold text-white">{title}</h3>
              <p className="mb-6 flex-1 text-sm leading-relaxed text-muted">{desc}</p>
              <span className="flex items-center gap-1 text-sm text-muted transition-colors group-hover:text-white">
                {action} <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          ))}

          {/* 实用工具集（带标签 chips） */}
          <div className="group flex flex-col bg-card p-6 transition-colors hover:bg-card-hover">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded border border-border bg-background text-muted">
              <Briefcase className="h-4.5 w-4.5" />
            </div>
            <h3 className="mb-2 font-semibold text-white">实用工具集</h3>
            <p className="mb-4 flex-1 text-sm leading-relaxed text-muted">
              封面制作、B站封面下载、图片水印、格式转换——一站式解决创作周边需求。
            </p>
            <div className="mb-5 flex flex-wrap gap-1.5">
              {["封面制作", "水印", "图片转换", "B站封面"].map((chip) => (
                <span
                  key={chip}
                  className="rounded border border-border bg-background px-2 py-0.5 text-xs text-muted"
                >
                  {chip}
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 text-sm text-muted transition-colors group-hover:text-white">
              使用工具 <ArrowRight className="h-4 w-4" />
            </span>
          </div>

          {/* 友链 & 赞助（双链接） */}
          <div className="group flex flex-col bg-card p-6 transition-colors hover:bg-card-hover">
            <div className="mb-4 flex h-9 w-9 items-center justify-center rounded border border-border bg-background text-muted">
              <Link2 className="h-4.5 w-4.5" />
            </div>
            <h3 className="mb-2 font-semibold text-white">友链 & 赞助</h3>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-muted">
              与志同道合的创作者互换友链；如果这里的内容帮到了你，欢迎考虑赞助支持。
            </p>
            <div className="flex gap-6">
              <Link
                to="/friends"
                className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-white"
              >
                查看友链 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/sponsors"
                className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-white"
              >
                查看赞助 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 关于我们 ── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="mb-8 text-2xl font-bold text-white">关于我们</h2>
          <div className="space-y-5 text-sm leading-loose text-muted">
            <p>
              你好，我是<strong className="text-white">二叉树树</strong>
              ，这个站点的创意提供者。我不是程序员——这里的所有代码、功能与设计，都由
              <strong className="text-white">大语言模型（LLM）</strong>（Claude /
              ChatGPT / Gemini / Grok / GLM / MiniMax / Qwen / DeepSeek）完成。
            </p>
            <p>
              我负责提需求和把关方向，AI 负责写代码和修 bug。从
              <Cloud className="mx-1 inline h-4 w-4" />
              Cloudflare Workers 到前端界面，每一行代码都是 AI
              生成的——我只做最轻松的部分：想点子。
            </p>
            <p>
              这个网站是我的数字花园——
              <Newspaper className="mx-1 inline h-4 w-4" />
              技术博客记录探索过程，
              <MessagesSquare className="mx-1 inline h-4 w-4" />
              论坛沉淀交流内容，
              <PenTool className="mx-1 inline h-4 w-4" />
              在线工具集是日常开发的副产品，开放给有需要的人使用。
            </p>
            <p>
              同时也是一名动漫爱好者，
              <Tv className="mx-1 inline h-4 w-4" />
              追番记录会在这里同步更新。
            </p>
          </div>
        </div>
      </section>

      {/* ── 关注 & 联系 ── */}
      <section className="border-t border-border">
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="mb-2 text-2xl font-bold text-white">关注 & 联系</h2>
          <p className="mb-8 text-sm text-muted">在这些平台上找到我</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {SOCIAL_LINKS.map((s) => (
              <a
                key={s.label}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-border px-5 py-2 text-sm text-muted transition-colors hover:bg-card hover:text-white"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
