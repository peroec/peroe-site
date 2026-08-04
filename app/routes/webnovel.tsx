import { NovelList } from "@/components/webnovel/list";

export function meta() {
  return [
    { title: "交互小说 | peroe" },
    { name: "description", content: "关卡式互动剧情 · 匿名游玩，进度保存在本地浏览器" },
  ];
}

export default function WebnovelPage() {
  return <NovelList />;
}
