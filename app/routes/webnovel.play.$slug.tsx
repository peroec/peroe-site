import { useParams } from "react-router";
import { NovelPlay } from "@/components/webnovel/play";

export function meta() {
  return [{ title: "阅读 | 交互小说 | peroe" }, { name: "robots", content: "noindex, nofollow" }];
}

export default function WebnovelPlayPage() {
  const { slug } = useParams();
  return <NovelPlay slug={slug || ""} />;
}
