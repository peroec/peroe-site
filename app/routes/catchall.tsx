import { Link } from "react-router";
import { Wrench } from "lucide-react";

const TOOL_NAMES: Record<string, string> = {
  cover: "封面制作",
  watermark: "水印",
  convert: "图片转换",
  "bilibili-cover": "B站封面",
};

export function meta() {
  return [{ title: "页面不存在 | 二叉树树" }];
}

export default function CatchAll() {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const toolKey = path.replace(/^\//, "");
  const toolName = TOOL_NAMES[toolKey];

  if (toolName) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-28 text-center">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-lg border border-border bg-card">
          <Wrench className="h-6 w-6 text-muted" />
        </div>
        <h1 className="text-2xl font-bold text-white">{toolName}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          该工具属于独立部署的在线工具箱（开源仓库 2xss_box），
          <br />
          请部署工具箱子站后从导航栏「工具」菜单进入。
        </p>
        <Link
          to="/"
          className="mt-8 rounded border border-border px-5 py-2 text-sm text-muted hover:text-white"
        >
          返回首页
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col items-center px-4 py-28 text-center">
      <p className="text-6xl font-bold text-neutral-800">404</p>
      <h1 className="mt-4 text-xl font-bold text-white">页面不存在</h1>
      <Link
        to="/"
        className="mt-8 rounded border border-border px-5 py-2 text-sm text-muted hover:text-white"
      >
        返回首页
      </Link>
    </main>
  );
}
