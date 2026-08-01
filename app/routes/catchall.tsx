import { Link } from "react-router";
import { Wrench } from "lucide-react";

export function meta() {
  return [{ title: "页面不存在 | 二叉树树" }];
}

export default function CatchAll() {
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
